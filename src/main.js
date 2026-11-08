"use strict";
import { createHabitat, seedHabitat, stepHabitat, advancePigments, createSwarm, advanceWaves, contactForce } from "./living.mjs";

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

const MAX_PARTICLES = 6500;
let habitat;
const STEP = 1000 / 30;

let W = 0, H = 0, DPR = 1;
let particles = [];
let currentStroke = null;
let activePointerId = null;
let waves = [];
let role = 0;
let memory = .38;
let wild = .62;
let pigment = .7;
let running = true;
let observing = false;
let lastTime = performance.now();
let accumulator = 0;
let fpsTimer = 0;

function makeLayer() {
  const layer = document.createElement("canvas");
  return { canvas: layer, ctx: layer.getContext("2d") };
}

const paper = makeLayer();

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

  if (oldW && oldH) {
    const sx = W / oldW, sy = H / oldH;

    for (const p of particles) {
      p.x *= sx;
      p.y *= sy;
      p.homeX *= sx;
      p.homeY *= sy;
    }

    for (const wave of waves) { wave.x *= sx; wave.y *= sy; }
    if (currentStroke) {
      currentStroke.x *= sx; currentStroke.y *= sy;
      currentStroke.vx *= sx; currentStroke.vy *= sy;
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

function renewSurface() {
  const count = clamp(Math.round(W * H / 190), 2200, MAX_PARTICLES);
  particles = createSwarm(W, H, count);
  habitat = createHabitat(W, H);
  waves = [];
  $("status").textContent = particles.length + " micrograins";
}

function beginStroke(x, y, pressure = .5) {
  currentStroke = { x, y, vx: 0, vy: 0, age: 0, distance: 0, pressure,
    color: [...colorFor(role, 0)], mirrored, started: performance.now() };
  seedHabitat(habitat, x, y);
}

function addPoint(x, y, pressure = .5) {
  if (!currentStroke) return;
  const dx = x - currentStroke.x, dy = y - currentStroke.y;
  currentStroke.distance += Math.hypot(dx, dy);
  // Limit impulses from sparse pointer events and retain a smooth wake.
  currentStroke.vx = clamp(dx, -12, 12);
  currentStroke.vy = clamp(dy, -12, 12);
  currentStroke.x = x; currentStroke.y = y;
  currentStroke.pressure = pressure;
}

function finishStroke(cancelled = false) {
  if (!cancelled && currentStroke && performance.now() - currentStroke.started < 350 && currentStroke.distance < 12) {
    const { x, y, mirrored: mirror } = currentStroke;
    // Even a very brief tap stains the existing grains, without adding dots.
    if (running) {
      const contacts = [currentStroke];
      if (mirror) contacts.push({ ...currentStroke, x: W - x });
      for (const p of particles) p.color = contactForce(p, contacts).color;
    }
    waves.push({ x, y, radius: 0, strength: 1 });
    if (mirror) waves.push({ x: W - x, y, radius: 0, strength: 1 });
    waves = waves.slice(-24);
  }
  currentStroke = null;
  const pointerId = activePointerId;
  activePointerId = null;
  if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  render();
}

function update() {
  const contacts = [];
  if (currentStroke) {
    currentStroke.age = performance.now() - currentStroke.started;
    contacts.push(currentStroke);
    if (currentStroke.mirrored) contacts.push({ ...currentStroke, x: W - currentStroke.x, vx: -currentStroke.vx });
    seedHabitat(habitat, currentStroke.x, currentStroke.y);
    if (currentStroke.mirrored) seedHabitat(habitat, W - currentStroke.x, currentStroke.y);
  }
  waves = advanceWaves(waves);
  stepHabitat(habitat, diffusion);
  advancePigments(particles, habitat, { memory, wild, diffusion, contacts, waves });
  if (currentStroke) { currentStroke.vx *= .65; currentStroke.vy *= .65; }
}

function render() {
  ctx.drawImage(paper.canvas, 0, 0);
  // Every pigment remains an individual dot: shapes come from their density.
  for (const p of particles) {
    ctx.fillStyle = rgba(p.color, (.35 + pigment * .6) * p.ink);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (.8 + pigment * .4), 0, TAU);
    ctx.fill();
  }
}

function point(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * W / rect.width,
    y: (e.clientY - rect.top) * H / rect.height
  };
}

canvas.addEventListener("pointerdown", e => {
  if (!running || observing || activePointerId !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  activePointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  const p = point(e);
  beginStroke(p.x, p.y, e.pressure || .5);
});

canvas.addEventListener("pointermove", e => {
  if (!currentStroke || observing || e.pointerId !== activePointerId) return;
  e.preventDefault();
  const events = e.getCoalescedEvents?.();
  for (const sample of events?.length ? events : [e]) {
    const p = point(sample);
    addPoint(p.x, p.y, sample.pressure || .5);
  }
  if (!running) render();
});

canvas.addEventListener("pointerup", e => {
  if (e.pointerId !== activePointerId) return;
  const p = point(e);
  addPoint(p.x, p.y, e.pressure || .5);
  finishStroke();
});

for (const name of ["pointercancel", "lostpointercapture"]) {
  canvas.addEventListener(name, e => {
    if (e.pointerId === activePointerId) finishStroke(true);
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
    ? "Effleurez la nuée, tracez un courant, laissez une empreinte."
    : "Répondez au mouvement par une autre touche de couleur.";
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
  finishStroke(true);
  running = !running;
  accumulator = 0;
  $("pause").textContent = running ? "Pause" : "Reprendre";
  $("pause").setAttribute("aria-pressed", String(!running));
};

$("reset").onclick = () => {
  finishStroke();
  renewSurface();
  observing = false;
  accumulator = 0;

  setPressed("observe", false);
  $("invitation").textContent = "Une nouvelle surface vivante. Effleurez, tapotez ou restez un instant.";

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
    $("status").textContent = particles.length + " micrograins";
    fpsTimer = 0;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) finishStroke(true);
  lastTime = performance.now();
  accumulator = 0;
});
window.addEventListener("blur", () => finishStroke(true));
resize();
renewSurface();
render();
window.addEventListener("resize", resize);
requestAnimationFrame(animate);
