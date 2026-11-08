"use strict";
import { createHabitat, seedHabitat, stepHabitat, advancePigments } from "./living.mjs";

const $ = id => document.getElementById(id);
const canvas = $("art");
const ctx = canvas.getContext("2d", { alpha: false });

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PAPER = "#f1eee6";
const PALETTES = [
  { name: "Nébuleuse", colors: [[63, 72, 142], [130, 77, 151], [209, 102, 126], [228, 156, 88], [63, 137, 148], [86, 98, 112]], labels: ["Outremer", "Améthyste", "Rose garance", "Ocre solaire", "Bleu lagon", "Gris de Payne"] },
  { name: "Terres vivantes", colors: [[132, 64, 49], [191, 113, 65], [202, 160, 74], [91, 117, 82], [53, 106, 112], [100, 73, 93]], labels: ["Sienne", "Argile", "Ocre", "Mousse", "Pétrole", "Prune"] },
  { name: "Marées", colors: [[40, 80, 121], [45, 131, 151], [96, 157, 147], [153, 115, 165], [206, 127, 113], [107, 122, 142]], labels: ["Abysses", "Céruléen", "Écume", "Brume violette", "Corail", "Ardoise"] }
];
let paletteIndex = 0;
const selectedColors = [0, 2];
let mirrored = false;
let diffusion = .55;

const MAX_PARTICLES = 950;
let habitat;
const STEP = 1000 / 30;

let W = 0, H = 0, DPR = 1;
let particles = [];
let currentStroke = null;
let activePointerId = null;
let nextStrokeId = 1;
let role = 0;
let memory = .38;
let wild = .62;
let pigment = .7;
let running = true;
let observing = false;
let elapsed = 0;
let lastTime = performance.now();
let accumulator = 0;
let frameCounter = 0;
let fpsTimer = 0;

function makeLayer() {
  const layer = document.createElement("canvas");
  return { canvas: layer, ctx: layer.getContext("2d") };
}

const traces = makeLayer();
const gesture = makeLayer();
const paper = makeLayer();
const stamps = new Map();

// Reusable translucent pigment grains: soft wash, irregular edges, sediment.
function pigmentStamp(color) {
  // Quantize evolving colors and bound the cache, including long sessions.
  color = color.map(c => Math.round(c / 12) * 12);
  const key = color.join(",");
  if (stamps.has(key)) return stamps.get(key);
  const stamp = document.createElement("canvas");
  stamp.width = stamp.height = 96;
  const g = stamp.getContext("2d");
  const wash = g.createRadialGradient(48, 48, 2, 48, 48, 46);
  wash.addColorStop(0, rgba(color, .28));
  wash.addColorStop(.45, rgba(color, .15));
  wash.addColorStop(.78, rgba(color, .045));
  wash.addColorStop(1, rgba(color, 0));
  g.fillStyle = wash;
  g.fillRect(0, 0, 96, 96);
  for (let i = 0; i < 150; i++) {
    const angle = rand(0, TAU), radius = Math.sqrt(Math.random()) * 39;
    g.fillStyle = rgba(color, rand(.025, .13));
    g.fillRect(48 + Math.cos(angle) * radius, 48 + Math.sin(angle) * radius, rand(.4, 1.5), rand(.4, 1.5));
  }
  if (stamps.size >= 192) stamps.delete(stamps.keys().next().value);
  stamps.set(key, stamp);
  return stamp;
}

function dab(g, x, y, size, color, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  g.drawImage(pigmentStamp(color), x - size, y - size, size * 2, size * 2);
  g.restore();
}


function rgba(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1)})`;
}

function resize() {
  const oldW = W, oldH = H;
  W = innerWidth;
  H = innerHeight;
  habitat = createHabitat(W, H, habitat);
  DPR = Math.min(devicePixelRatio || 1, 1.5);

  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  for (const layer of [traces, gesture]) {
    const old = document.createElement("canvas");
    old.width = layer.canvas.width;
    old.height = layer.canvas.height;

    if (old.width && old.height) {
      old.getContext("2d").drawImage(layer.canvas, 0, 0);
    }

    layer.canvas.width = W;
    layer.canvas.height = H;

    if (old.width && old.height) {
      layer.ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, W, H);
    }
  }

  if (oldW && oldH) {
    const sx = W / oldW, sy = H / oldH;

    for (const p of particles) {
      p.x *= sx;
      p.y *= sy;
      p.homeX *= sx;
      p.homeY *= sy;
    }

    if (currentStroke) {
      for (const p of currentStroke.points) {
        p.x *= sx;
        p.y *= sy;
      }
    }
  }

  paper.canvas.width = W;
  paper.canvas.height = H;
  paper.ctx.fillStyle = PAPER;
  paper.ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 35; i++) {
    paper.ctx.fillStyle = `rgba(95,74,59,${rand(.015, .055)})`;
    paper.ctx.fillRect(rand(0, W), rand(0, H), 1, 1);
  }
  render();
}

function colorFor(r, index) {
  return PALETTES[paletteIndex].colors[(selectedColors[r] + index) % 6];
}

function makeParticle(x, y, stroke, index) {
  if (particles.length >= MAX_PARTICLES) {
    particles.splice(0, Math.min(15, particles.length));
  }

  seedHabitat(habitat, x, y);
  const angle = rand(0, TAU);
  particles.push({
    x, y,
    homeX: x,
    homeY: y,
    vx: Math.cos(angle) * rand(.1, .7),
    vy: Math.sin(angle) * rand(.1, .7),
    color: [...stroke.color],
    settled: 0, density: 0, activity: .5, signal: 0, heading: angle,
    index,
    phase: rand(0, TAU),
    size: rand(8, 22),
    ink: rand(.45, 1),
    released: 0
  });
}

function beginStroke(x, y) {
  currentStroke = { id: nextStrokeId++, role, color: colorFor(role, 0), mirrored, points: [{ x, y }] };

  const g = gesture.ctx;
  dab(g, x, y, 24, currentStroke.color, pigment);
  if (currentStroke.mirrored) dab(g, W - x, y, 24, currentStroke.color, pigment);
  if (!running) render();
}

function addPoint(x, y) {
  if (!currentStroke) return;

  const points = currentStroke.points;
  const a = points[points.length - 1];
  const dx = x - a.x, dy = y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1.5) return;

  const n = Math.ceil(dist / 3);
  const g = gesture.ctx;

  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const px = a.x + dx * t, py = a.y + dy * t;
    dab(g, px, py, 18 + Math.min(12, dist * .08), currentStroke.color, pigment * .38);
    if (currentStroke.mirrored) dab(g, W - px, py, 24, currentStroke.color, pigment * .38);

    if (i % 2 === 0 || i === n) points.push({ x: px, y: py });
  }

}

function finishStroke() {
  if (currentStroke) {
    const points = currentStroke.points;
    const stride = Math.max(1, Math.ceil(points.length / 180));

    for (let i = 0; i < points.length; i += stride) {
      for (let grain = 0; grain < 3; grain++) {
        const x = points[i].x + rand(-14, 14), y = points[i].y + rand(-14, 14);
        makeParticle(x, y, currentStroke, i + grain);
        if (currentStroke.mirrored) makeParticle(W - x, y, currentStroke, i + grain);
      }
    }
    currentStroke = null;
  }

  const pointerId = activePointerId;
  activePointerId = null;
  if (pointerId !== null && canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
  render();
}

function updateParticles() {
  stepHabitat(habitat, diffusion);
  stepHabitat(habitat, diffusion);
  advancePigments(particles, habitat, { memory, wild, diffusion });
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (const p of particles) {
    const radius = p.size * (.85 + diffusion * 1.5) * (.8 + p.activity * .45);
    const stretch = 1 + Math.min(.75, Math.hypot(p.vx, p.vy) * .6);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.heading);
    ctx.scale(stretch, 1 / stretch);
    dab(ctx, 0, 0, radius, p.color, pigment * (.18 + p.ink * .28) * (1 - p.settled * .35));
    ctx.restore();
    // Condensation and pores follow local activation and crowding.
    if (p.signal > .12) {
      ctx.strokeStyle = rgba(p.color, pigment * p.signal * .24);
      ctx.lineWidth = .5 + p.settled;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, radius * .55, radius * .28, p.heading, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function updateTraces() {
  const g = traces.ctx;
  g.save();
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = `rgba(0,0,0,${.008 + (1 - memory) * .012})`;
  g.fillRect(0, 0, W, H);
  g.restore();

  for (let i = 0; i < particles.length; i += 2) {
    const p = particles[i];
    dab(g, p.x, p.y, p.size * (1.4 + diffusion), p.color, pigment * (.025 + p.settled * .1));
    if (p.settled > .12 || p.signal > .2) {
      g.fillStyle = rgba(p.color, pigment * .1);
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - Math.cos(p.heading) * (2 + p.settled * 8), p.y - Math.sin(p.heading) * (2 + p.settled * 8));
      g.strokeStyle = rgba(p.color, pigment * (.05 + p.settled * .18));
      g.lineWidth = .7;
      g.stroke();
    }
  }
}

function updateGesture() {
  if (currentStroke) return;
  const g = gesture.ctx;
  g.save();
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = "rgba(0,0,0,.028)";
  g.fillRect(0, 0, W, H);
  g.restore();
}

function update() {
  elapsed += STEP;
  updateParticles();
  if (frameCounter % 2 === 0) {
    updateTraces();
    updateGesture();
  }
  frameCounter++;
}

function render() {
  ctx.drawImage(paper.canvas, 0, 0);
  ctx.drawImage(traces.canvas, 0, 0);
  ctx.drawImage(gesture.canvas, 0, 0);
  drawParticles();
}

function point(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * W / rect.width,
    y: (e.clientY - rect.top) * H / rect.height
  };
}

canvas.addEventListener("pointerdown", e => {
  if (observing || activePointerId !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  activePointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  const p = point(e);
  beginStroke(p.x, p.y);
});

canvas.addEventListener("pointermove", e => {
  if (!currentStroke || observing || e.pointerId !== activePointerId) return;
  e.preventDefault();
  const events = e.getCoalescedEvents?.();
  for (const sample of events?.length ? events : [e]) {
    const p = point(sample);
    addPoint(p.x, p.y);
  }
  if (!running) render();
});

canvas.addEventListener("pointerup", e => {
  if (e.pointerId !== activePointerId) return;
  const p = point(e);
  addPoint(p.x, p.y);
  finishStroke();
});

for (const name of ["pointercancel", "lostpointercapture"]) {
  canvas.addEventListener(name, e => {
    if (e.pointerId === activePointerId) finishStroke();
  });
}

function setPressed(id, pressed) {
  $(id).classList.toggle("active", pressed);
  $(id).setAttribute("aria-pressed", String(pressed));
}

function setRole(r) {
  finishStroke();
  role = r;
  renderPalette();
  observing = false;
  setPressed("patient", r === 0);
  setPressed("psy", r === 1);
  setPressed("observe", false);
  $("invitation").textContent = r === 0
    ? "Tracez librement. Le vivant poursuivra votre geste."
    : "Répondez au dessin, sans chercher à le compléter.";
}

$("patient").onclick = () => setRole(0);
$("psy").onclick = () => setRole(1);
$("observe").onclick = () => {
  finishStroke();
  observing = !observing;
  setPressed("observe", observing);
  $("invitation").textContent = observing
    ? "Observez ce qui apparaît, sans chercher à nommer."
    : "Vous pouvez reprendre le dialogue par le dessin.";
};

function renderPalette() {
  $("swatches").replaceChildren();
  PALETTES[paletteIndex].colors.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "swatch";
    button.style.setProperty("--swatch", rgba(color, 1));
    button.setAttribute("aria-label", PALETTES[paletteIndex].labels[index]);
    button.title = PALETTES[paletteIndex].labels[index];
    button.setAttribute("aria-pressed", String(selectedColors[role] === index));
    button.onclick = () => { finishStroke(); selectedColors[role] = index; renderPalette(); };
    $("swatches").append(button);
  });
}
$("palette").onchange = e => { finishStroke(); paletteIndex = Number(e.target.value); renderPalette(); };
$("mirror").onclick = () => {
  finishStroke(); mirrored = !mirrored; setPressed("mirror", mirrored);
};
$("diffusion").oninput = e => { diffusion = +e.target.value / 100; render(); };
renderPalette();

$("memory").oninput = e => { memory = +e.target.value / 100; };
$("wild").oninput = e => { wild = +e.target.value / 100; };
$("pigment").oninput = e => {
  pigment = +e.target.value / 100;
  render();
};

$("pause").onclick = () => {
  running = !running;
  accumulator = 0;
  $("pause").textContent = running ? "Pause" : "Reprendre";
  $("pause").setAttribute("aria-pressed", String(!running));
};

$("reset").onclick = () => {
  finishStroke();
  particles = [];
  habitat = createHabitat(W, H);
  observing = false;
  elapsed = 0;
  accumulator = 0;
  frameCounter = 0;
  traces.ctx.clearRect(0, 0, W, H);
  gesture.ctx.clearRect(0, 0, W, H);
  setPressed("observe", false);
  $("invitation").textContent = "Une nouvelle rencontre commence. Dessinez.";
  $("status").textContent = "0 pigments";
  render();
};

$("save").onclick = () => {
  render();
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  exportCanvas.getContext("2d").drawImage(canvas, 0, 0);

  exportCanvas.toBlob(blob => {
    if (!blob) {
      $("invitation").textContent = "L’image n’a pas pu être enregistrée. Réessayez.";
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "squiggle-du-vivant.png";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, "image/png");
};

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(now - lastTime, 70);
  lastTime = now;

  if (document.hidden) {
    accumulator = 0;
    return;
  }

  if (running) {
    accumulator += dt;
    let count = 0;
    while (accumulator >= STEP && count < 2) {
      update();
      accumulator -= STEP;
      count++;
    }
    render();
  }

  fpsTimer += dt;
  if (fpsTimer > 1000) {
    $("status").textContent = particles.length + " pigments";
    fpsTimer = 0;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) finishStroke();
  lastTime = performance.now();
  accumulator = 0;
});
window.addEventListener("blur", finishStroke);
resize();
window.addEventListener("resize", resize);
requestAnimationFrame(animate);
