"use strict";

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
const CELL = 38;
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

function flow(x, y, t) {
  const angle =
    Math.sin(x * .008 + t * .29) * 1.7 +
    Math.cos(y * .011 - t * .21) * 1.5 +
    Math.sin((x + y) * .017 + t * .13) * .9 +
    Math.cos((x - y) * .026 - t * .18) * .65;

  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function colorFor(r, index) {
  return PALETTES[paletteIndex].colors[(selectedColors[r] + index) % 6];
}

function makeParticle(x, y, stroke, index) {
  if (particles.length >= MAX_PARTICLES) {
    particles.splice(0, Math.min(15, particles.length));
  }

  const angle = rand(0, TAU);
  particles.push({
    x, y,
    homeX: x,
    homeY: y,
    vx: Math.cos(angle) * rand(.1, .7),
    vy: Math.sin(angle) * rand(.1, .7),
    color: stroke.color,
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

function buildGrid() {
  const grid = new Map();
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const key = Math.floor(p.x / CELL) + "," + Math.floor(p.y / CELL);
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  }
  return grid;
}

function updateParticles() {
  const grid = buildGrid();
  const t = elapsed * .001;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.released = Math.min(1, p.released + .006 + wild * .012);

    const gx = Math.floor(p.x / CELL), gy = Math.floor(p.y / CELL);
    let separationX = 0, separationY = 0;
    let alignmentX = 0, alignmentY = 0;
    let cohesionX = 0, cohesionY = 0;
    let neighbors = 0;

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const bucket = grid.get((gx + ox) + "," + (gy + oy));
        if (!bucket) continue;

        for (const j of bucket) {
          if (i === j) continue;
          const q = particles[j];
          const dx = q.x - p.x, dy = q.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1 || d2 > 1450) continue;

          neighbors++;
          alignmentX += q.vx;
          alignmentY += q.vy;
          cohesionX += dx;
          cohesionY += dy;

          if (d2 < 140) {
            separationX -= dx / (d2 + 4);
            separationY -= dy / (d2 + 4);
          }
          if (neighbors >= 16) break;
        }
      }
    }

    let fx = 0, fy = 0;
    if (neighbors) {
      fx += cohesionX / neighbors * .002;
      fy += cohesionY / neighbors * .002;
      fx += (alignmentX / neighbors - p.vx) * .035;
      fy += (alignmentY / neighbors - p.vy) * .035;
      fx += separationX * .55;
      fy += separationY * .55;
    }

    const wind = flow(p.x, p.y, t);
    fx += wind.x * (.025 + wild * .09);
    fy += wind.y * (.025 + wild * .09);
    fx += Math.sin(t * 1.4 + p.phase) * wild * .025;
    fy += Math.cos(t * 1.1 + p.phase) * wild * .025;

    const homeForce = memory * .0045 * (1 - p.released * .88);
    fx += (p.homeX - p.x) * homeForce;
    fy += (p.homeY - p.y) * homeForce;

    const margin = 55;
    if (p.x < margin) fx += .09;
    if (p.x > W - margin) fx -= .09;
    if (p.y < margin) fy += .09;
    if (p.y > H - margin) fy -= .09;

    p.vx = (p.vx + fx) * .982;
    p.vy = (p.vy + fy) * .982;

    const maxSpeed = .45 + wild * 1.25;
    const v = Math.hypot(p.vx, p.vy) + .001;
    if (v > maxSpeed) {
      p.vx = p.vx / v * maxSpeed;
      p.vy = p.vy / v * maxSpeed;
    }
    p.x += p.vx * p.released;
    p.y += p.vy * p.released;
  }
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  for (const p of particles) {
    const breath = 1 + Math.sin(elapsed * .00045 + p.phase) * .14;
    const radius = p.size * (1.2 + diffusion * 1.7) * breath;
    dab(ctx, p.x, p.y, radius, p.color, pigment * (.3 + p.ink * .45));
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
    dab(g, p.x, p.y, p.size * (1.4 + diffusion), p.color, pigment * .08);
    if (p.index % 5 === 0) {
      g.fillStyle = rgba(p.color, pigment * .1);
      g.fillRect(p.x + Math.sin(p.phase) * p.size, p.y + Math.cos(p.phase) * p.size, 1, 1);
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
