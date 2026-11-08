import { createGame, passTurn, recordFrame, createVisitor, stepVisitor, visitorDrawing } from './game.mjs';
const $ = id => document.getElementById(id);
const canvas = $('art'), ctx = canvas.getContext('2d');
const COLORS = ['#354b41', '#426d9b', '#a85a70', '#bc7644', '#8070a0', '#4f918d', '#252a32', '#d2a64c'];
const WIDTH = 1200, HEIGHT = 760, VISIT_STEPS = 120;
let game = null, strokes = [], current = null, pointer = null, frames = [], colors = [];
let tool = 'pen', visitor = null, visitStep = 0, visitAccumulator = 0, last = 0;
let playing = false, replayAccumulator = 0, frameIndex = 0, recordClock = 0;
let shown = [], turnStart = 0;

function fit() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  render(shown);
}
// A fixed sheet, letterboxed when needed, preserves every drawing coordinate.
function transform() {
  const scale = Math.min(canvas.width / WIDTH, canvas.height / HEIGHT);
  return { scale, x: (canvas.width - WIDTH * scale) / 2, y: (canvas.height - HEIGHT * scale) / 2 };
}
function render(drawing = strokes) {
  shown = drawing;
  const t = transform();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e9e6de'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(t.scale, 0, 0, t.scale, t.x, t.y);
  ctx.fillStyle = '#faf9f5'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, WIDTH, HEIGHT); ctx.clip();
  for (const stroke of drawing) {
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = stroke.color; ctx.fillStyle = stroke.color;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const points = stroke.points;
    if (points.length === 1) { ctx.beginPath(); ctx.arc(points[0].x, points[0].y, stroke.width * points[0].pressure / 2, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 1; i < points.length; i++) {
      ctx.lineWidth = stroke.width * (points[i].pressure + points[i - 1].pressure) / 2;
      ctx.beginPath(); ctx.moveTo(points[i - 1].x, points[i - 1].y); ctx.lineTo(points[i].x, points[i].y); ctx.stroke();
    }
  }
  ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  // Fill erased areas behind all marks without covering later strokes.
  ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#faf9f5'; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.globalCompositeOperation = 'source-over';
}
function label() { return game.phase === 'living' ? 'Le vivant s’invite' : `Joueur ${game.current + 1} · passage ${game.turn}/${game.total}`; }
function capture(drawing = strokes, text = label()) { frames = recordFrame(frames, drawing, text); }
function swatches() {
  $('swatches').replaceChildren();
  COLORS.forEach((color, i) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'swatch';
    button.style.setProperty('--swatch', color); button.setAttribute('aria-label', ['Forêt', 'Bleu', 'Garance', 'Sienne', 'Violet', 'Lagon', 'Graphite', 'Ocre'][i]);
    button.setAttribute('aria-pressed', String(colors[game.current] === color));
    button.onclick = () => { finishStroke(); colors[game.current] = color; setTool('pen'); swatches(); };
    button.disabled = game.phase !== 'drawing'; $('swatches').append(button);
  });
}
function setTool(value) {
  tool = value;
  for (const id of ['pen', 'eraser']) { $(id).classList.toggle('active', id === value); $(id).setAttribute('aria-pressed', String(id === value)); }
}
function updateUI() {
  const living = game.phase === 'living', finished = game.phase === 'finished';
  $('chapter').textContent = finished ? 'LE FILM DE VOTRE RENCONTRE' : `PASSAGE ${game.turn} / ${game.total}`;
  $('turn').textContent = finished ? 'Votre rêve à plusieurs' : living ? 'Le vivant prend la main' : `À toi, joueur ${game.current + 1}`;
  $('invitation').textContent = finished ? `${game.visits} visite${game.visits === 1 ? '' : 's'} du vivant · ${frames.length} instants à revoir` : living ? 'Les traits se cherchent, s’accordent et se transforment. Puis ce sera à vous.' : 'Dessine autant que tu veux, puis passe la main.';
  $('visitor-badge').hidden = !living;
  $('drawing-controls').hidden = finished; $('replay-controls').hidden = !finished;
  for (const id of ['pen', 'eraser', 'size', 'pass', 'undo', 'finish']) $(id).disabled = living;
  $('undo').disabled = living || strokes.length <= turnStart;
  $('pass').textContent = game.turn === game.total ? 'Terminer la rencontre →' : 'Passer la main →';
  if (!finished) swatches();
}
function start() {
  game = createGame(Number($('players').value), Number($('rounds').value));
  strokes = []; frames = []; current = null; pointer = null; visitor = null; playing = false; turnStart = 0;
  colors = Array.from({ length: game.players }, (_, i) => COLORS[i % COLORS.length]);
  setTool('pen'); $('setup').hidden = true; $('studio').hidden = false;
  capture([], 'La feuille attend votre premier geste'); fit(); render(); updateUI();
}
function point(e) {
  const rect = canvas.getBoundingClientRect(), t = transform();
  return { x: Math.max(0, Math.min(WIDTH, ((e.clientX - rect.left) * canvas.width / rect.width - t.x) / t.scale)),
    y: Math.max(0, Math.min(HEIGHT, ((e.clientY - rect.top) * canvas.height / rect.height - t.y) / t.scale)),
    pressure: e.pointerType === 'pen' ? Math.max(.2, e.pressure) : 1 };
}
function finishStroke() {
  if (current) { strokes = [...strokes, current]; current = null; capture(); updateUI(); }
  const id = pointer; pointer = null;
  if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
}
canvas.addEventListener('pointerdown', e => {
  if (!game || game.phase !== 'drawing' || pointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const rect = canvas.getBoundingClientRect(), t = transform();
  const x = (e.clientX - rect.left) * canvas.width / rect.width, y = (e.clientY - rect.top) * canvas.height / rect.height;
  if (x < t.x || x > t.x + WIDTH * t.scale || y < t.y || y > t.y + HEIGHT * t.scale) return;
  e.preventDefault(); pointer = e.pointerId; canvas.setPointerCapture(pointer);
  current = { player: game.current, color: colors[game.current], width: Number($('size').value) * (tool === 'eraser' ? 3 : 1), tool, points: [point(e)] };
  recordClock = 0; render([...strokes, current]);
});
canvas.addEventListener('pointermove', e => {
  if (!current || e.pointerId !== pointer) return;
  e.preventDefault();
  for (const sample of e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e]) {
    const p = point(sample), previous = current.points.at(-1);
    if (Math.hypot(p.x - previous.x, p.y - previous.y) > .8) {
      // Bounded sampling for long gestures, without limiting their duration.
      if (current.points.length >= 1200) current.points = current.points.filter((_, i) => i % 2 === 0);
      current.points.push(p);
    }
  }
  render([...strokes, current]);
});
canvas.addEventListener('pointerup', e => { if (pointer === e.pointerId) { if (current) current.points.push(point(e)); finishStroke(); render(); } });
for (const name of ['pointercancel', 'lostpointercapture']) canvas.addEventListener(name, e => { if (pointer === e.pointerId) { finishStroke(); render(); } });
function end() {
  finishStroke(); game = { ...game, phase: 'finished' }; visitor = null; capture(strokes, 'Le dessin de votre rencontre');
  $('timeline').max = frames.length - 1; frameIndex = frames.length - 1; $('timeline').value = frameIndex;
  playing = false; $('play').textContent = '▶ Rejouer le rêve'; render(); updateUI();
}
$('setup-form').onsubmit = e => { e.preventDefault(); start(); };
$('pen').onclick = () => { finishStroke(); setTool('pen'); };
$('eraser').onclick = () => { finishStroke(); setTool('eraser'); };
$('undo').onclick = () => { finishStroke(); if (strokes.length > turnStart) { strokes = strokes.slice(0, -1); capture(); render(); updateUI(); } };
$('pass').onclick = () => {
  finishStroke(); capture(); game = passTurn(game, strokes.some(s => s.tool !== 'eraser'));
  if (game.phase === 'finished') { end(); return; }
  if (game.phase === 'living') { visitor = createVisitor(strokes, WIDTH, HEIGHT, Math.random() * 20); visitStep = 0; visitAccumulator = 0; }
  turnStart = strokes.length; setTool('pen'); updateUI();
};
$('finish').onclick = end;
$('play').onclick = () => {
  if (frameIndex === frames.length - 1) frameIndex = 0;
  playing = !playing; replayAccumulator = 0; $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Reprendre'; showFrame();
};
function showFrame() {
  $('timeline').value = frameIndex; $('caption').textContent = `${frames[frameIndex].label} · ${frameIndex + 1} / ${frames.length}`;
  render(frames[frameIndex].strokes);
}
$('timeline').oninput = () => { playing = false; $('play').textContent = '▶ Reprendre'; frameIndex = Number($('timeline').value); showFrame(); };
$('new').onclick = () => { if (game) $('restart-dialog').showModal(); };
$('cancel-new').onclick = () => $('restart-dialog').close();
$('confirm-new').onclick = () => {
  finishStroke(); game = null; visitor = null; strokes = []; frames = []; shown = []; playing = false;
  $('restart-dialog').close(); $('studio').hidden = true; $('setup').hidden = false;
  $('caption').textContent = 'Vos gestes sont libres. Aucune interprétation automatique.';
};
$('save').onclick = () => {
  const out = document.createElement('canvas'); out.width = WIDTH; out.height = HEIGHT;
  const t = transform(); const g = out.getContext('2d'); g.fillStyle = '#faf9f5'; g.fillRect(0, 0, WIDTH, HEIGHT);
  g.drawImage(canvas, t.x, t.y, WIDTH * t.scale, HEIGHT * t.scale, 0, 0, WIDTH, HEIGHT);
  out.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'squiggle-rencontre.png'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }, 'image/png');
};
function animate(now) {
  const dt = Math.min(now - (last || now), 80); last = now;
  if (!document.hidden && game) {
    if (game.phase === 'living') {
      visitAccumulator += dt;
      while (visitAccumulator >= 1000 / 30 && visitStep < VISIT_STEPS) {
        stepVisitor(visitor); visitStep++; visitAccumulator -= 1000 / 30;
        if (visitStep % 6 === 0) capture(visitorDrawing(visitor));
      }
      render(visitorDrawing(visitor));
      if (visitStep === VISIT_STEPS) {
        strokes = visitorDrawing(visitor); visitor = null; game = { ...game, phase: 'drawing' };
        turnStart = strokes.length; capture(strokes, `Le vivant laisse la main au joueur ${game.current + 1}`); updateUI();
      }
    } else if (current) {
      recordClock += dt;
      if (recordClock > 220) { capture([...strokes, { ...current, points: current.points.map(p => ({ ...p })) }]); recordClock = 0; }
    } else if (game.phase === 'finished' && playing) {
      replayAccumulator += dt;
      if (replayAccumulator >= Number($('speed').value)) {
        replayAccumulator = 0; frameIndex = Math.min(frameIndex + 1, frames.length - 1); showFrame();
        if (frameIndex === frames.length - 1) { playing = false; $('play').textContent = '↻ Rejouer le rêve'; }
      }
    }
  }
  requestAnimationFrame(animate);
}
new ResizeObserver(() => { if (game) fit(); }).observe($('paper'));
document.addEventListener('visibilitychange', () => { if (document.hidden) finishStroke(); last = 0; });
window.addEventListener('blur', finishStroke);
requestAnimationFrame(animate);
