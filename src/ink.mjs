const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_DENSITY = .85;
export const PALETTES = [
  { name: 'Abysses', colors: ['#254b58', '#526b89', '#9b6486', '#c19162', '#447e79'] },
  { name: 'Incandescence', colors: ['#682c4c', '#b85c66', '#d29453', '#5b547f', '#a87c9c'] },
  { name: 'Sous-bois', colors: ['#315c50', '#78906b', '#a67c49', '#4c6472', '#8c5667'] }
];
export const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

export function createInk(width = 256, height = 184, seed = 1) {
  const n = width * height;
  return { width, height, seed, time: 0, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n),
    wet: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n),
    nr: new Float32Array(n), ng: new Float32Array(n), nb: new Float32Array(n), nw: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n) };
}
export function sample(array, width, height, x, y) {
  x = clamp(x, 0, width - 1); y = clamp(y, 0, height - 1);
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const a = iy * width + ix, b = iy * width + Math.min(ix + 1, width - 1);
  const c = Math.min(iy + 1, height - 1) * width + ix, d = Math.min(iy + 1, height - 1) * width + Math.min(ix + 1, width - 1);
  return (array[a] * (1 - tx) + array[b] * tx) * (1 - ty) + (array[c] * (1 - tx) + array[d] * tx) * ty;
}
export function touchInk(s, x, y, color, radius, dx = 0, dy = 0, pressure = 1) {
  const [r, g, b] = rgb(color), { width: w, height: h } = s;
  for (let yy = Math.max(0, Math.floor(y - radius * 2)); yy <= Math.min(h - 1, Math.ceil(y + radius * 2)); yy++) {
    for (let xx = Math.max(0, Math.floor(x - radius * 2)); xx <= Math.min(w - 1, Math.ceil(x + radius * 2)); xx++) {
      const warpX = Math.sin(yy * .19 + s.seed) * 1.7 + Math.sin(yy * .57) * .45;
      const warpY = Math.cos(xx * .17 - s.seed) * 1.7 + Math.cos(xx * .49) * .45;
      const dist = ((xx - x + warpX) ** 2 + (yy - y + warpY) ** 2) / (radius * radius);
      const weight = (Math.exp(-dist * 2) + Math.exp(-Math.pow((Math.sqrt(dist) - .9) / .13, 2)) * .22) * pressure;
      if (weight < .002) continue;
      const i = yy * w + xx;
      // A shared concentration limit preserves channel ratios and leaves light in the wash.
      s.r[i] = Math.min(5, s.r[i] + (1 - r) * weight * .16);
      s.g[i] = Math.min(5, s.g[i] + (1 - g) * weight * .16);
      s.b[i] = Math.min(5, s.b[i] + (1 - b) * weight * .16);
      const concentration = (s.r[i] + s.g[i] + s.b[i]) / 3;
      if (concentration > MAX_DENSITY) {
        const dilution = MAX_DENSITY / concentration;
        s.r[i] *= dilution; s.g[i] *= dilution; s.b[i] *= dilution;
      }
      s.wet[i] = Math.min(1, s.wet[i] + weight * .3);
      s.vx[i] += clamp(dx, -4, 4) * weight * .25;
      s.vy[i] += clamp(dy, -4, 4) * weight * .25;
    }
  }
}
export function seedInk(s, colors = PALETTES[0].colors) {
  for (let j = 0; j < 22; j++) {
    const a = j * 2.39996 + s.seed, radius = 8 + (j % 5) * 2.5;
    const x = s.width * .5 + Math.cos(a) * s.width * (.07 + (j % 4) * .035);
    const y = s.height * .48 + Math.sin(a) * s.height * (.06 + (j % 5) * .03);
    for (let k = 0; k < 3; k++) touchInk(s, x, y, colors[j % colors.length], radius, Math.cos(a) * .4, Math.sin(a) * .4, 1);
  }
}
export function stepInk(s, activity = .55) {
  const { width: w, height: h } = s;
  s.time += .025;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, l = y * w + Math.max(0, x - 1), r = y * w + Math.min(w - 1, x + 1);
    const u = Math.max(0, y - 1) * w + x, d = Math.min(h - 1, y + 1) * w + x;
    const density = (s.r[i] + s.g[i] + s.b[i]) / 3;
    const gx = (s.r[r] + s.g[r] + s.b[r] - s.r[l] - s.g[l] - s.b[l]) / 3;
    const gy = (s.r[d] + s.g[d] + s.b[d] - s.r[u] - s.g[u] - s.b[u]) / 3;
    // Surface tension, capillary spread and a local activator/inhibitor pair.
    const wetLap = s.wet[l] + s.wet[r] + s.wet[u] + s.wet[d] - 4 * s.wet[i];
    const wet = clamp(s.wet[i] + wetLap * .12 + density * .004 - s.wet[i] * .004, 0, 1);
    s.nw[i] = wet;
    const mobility = wet * (.3 + activity);
    const curl = Math.sin(x * .065 + s.time + s.seed) * Math.cos(y * .071 - s.time * .6);
    let vx = (s.vx[i] * .77 + (s.vx[l] + s.vx[r] + s.vx[u] + s.vx[d]) * .052) - gx * .09 + gy * curl * activity * .12;
    let vy = (s.vy[i] * .77 + (s.vy[l] + s.vy[r] + s.vy[u] + s.vy[d]) * .052) - gy * .09 - gx * curl * activity * .12;
    // Spontaneous local circulation remains confined to the wet ink.
    vx += Math.cos(y * .08 + s.time) * .008 * mobility;
    vy += Math.sin(x * .07 - s.time) * .008 * mobility;
    s.nx[i] = clamp(vx, -.9, .9); s.ny[i] = clamp(vy, -.9, .9);
    const sx = x - vx * mobility, sy = y - vy * mobility;
    for (const [channel, next, rate] of [[s.r, s.nr, .033], [s.g, s.ng, .043], [s.b, s.nb, .055]]) {
      const advected = sample(channel, w, h, sx, sy);
      const lap = channel[l] + channel[r] + channel[u] + channel[d] - 4 * channel[i];
      // Different pigment mobilities separate colors along wetting fronts.
      // Movement redistributes pigment; wetness must not manufacture neutral ink.
      next[i] = clamp(advected + lap * rate * mobility, 0, 5);
    }
    const concentration = (s.nr[i] + s.ng[i] + s.nb[i]) / 3;
    if (concentration > MAX_DENSITY) {
      const dilution = MAX_DENSITY / concentration;
      s.nr[i] *= dilution; s.ng[i] *= dilution; s.nb[i] *= dilution;
    }
  }
  for (const [a, b] of [['r','nr'],['g','ng'],['b','nb'],['wet','nw'],['vx','nx'],['vy','ny']]) [s[a], s[b]] = [s[b], s[a]];
}
export function snapshot(s) {
  return { width: s.width, height: s.height, seed: s.seed, time: s.time,
    ...Object.fromEntries(['r','g','b','wet'].map(k => [k, new Float32Array(s[k])])) };
}
export function densityAt(s, i) { return (s.r[i] + s.g[i] + s.b[i]) / 3; }

// Dense optical-flow registration of pigment density. Morphing warps material
// coordinates in both directions, then blends concentrations, not screenshots.
export function prepareMorph(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('Les états doivent avoir la même résolution.');
  const w = a.width, h = a.height, n = w * h;
  const da = Float32Array.from(a.r, (_, i) => densityAt(a, i));
  const db = Float32Array.from(b.r, (_, i) => densityAt(b, i));
  let vx = new Float32Array(n), vy = new Float32Array(n), nx = new Float32Array(n), ny = new Float32Array(n);
  for (let iter = 0; iter < 28; iter++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, l = y * w + Math.max(x - 1, 0), r = y * w + Math.min(x + 1, w - 1), u = Math.max(y - 1, 0) * w + x, d = Math.min(y + 1, h - 1) * w + x;
      const ax = (vx[l] + vx[r] + vx[u] + vx[d]) / 4, ay = (vy[l] + vy[r] + vy[u] + vy[d]) / 4;
      const sx = x + ax, sy = y + ay;
      const gx = (sample(db, w, h, sx + 1, sy) - sample(db, w, h, sx - 1, sy)) / 2;
      const gy = (sample(db, w, h, sx, sy + 1) - sample(db, w, h, sx, sy - 1)) / 2;
      const error = sample(db, w, h, sx, sy) - da[i], gain = error / (.008 + gx * gx + gy * gy);
      nx[i] = clamp(ax - gx * gain * .5, -22, 22); ny[i] = clamp(ay - gy * gain * .5, -22, 22);
    }
    [vx, nx] = [nx, vx]; [vy, ny] = [ny, vy];
  }
  return { a, b, vx, vy };
}
export function morphInk(morph, t, out) {
  const { a, b, vx, vy } = morph, w = a.width, h = a.height;
  const q = t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    for (const key of ['r','g','b','wet']) {
      out[key][i] = sample(a[key], w, h, x - vx[i] * q, y - vy[i] * q) * (1 - q) + sample(b[key], w, h, x + vx[i] * (1 - q), y + vy[i] * (1 - q)) * q;
    }
  }
  out.time = a.time * (1 - q) + b.time * q; out.seed = a.seed;
  out.relief = (a.relief ?? .55) * (1 - q) + (b.relief ?? .55) * q;
  return out;
}

// Beer–Lambert absorption, capillary rims, stable granulation and raking light.
export function renderInk(s, pixels, relief = .55) {
  const w = s.width, h = s.height;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = i * 4, den = densityAt(s, i);
    const l = y * w + Math.max(x - 1, 0), r = y * w + Math.min(x + 1, w - 1), u = Math.max(y - 1, 0) * w + x, d = Math.min(y + 1, h - 1) * w + x;
    const gx = densityAt(s, r) - densityAt(s, l), gy = densityAt(s, d) - densityAt(s, u);
    const edge = Math.hypot(gx, gy);
    let hash = Math.imul(x + Math.floor(s.seed * 100), 374761393) + Math.imul(y, 668265263);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    const grain = ((hash ^ (hash >>> 16)) >>> 0) / 4294967295 - .5;
    const veins = Math.pow(Math.sin(den * 47 + Math.sin(x * .19) * Math.cos(y * .17)) * .5 + .5, 12);
    const coverage = clamp((den - .018) / .025, 0, 1);
    const edgeDeposit = Math.exp(-Math.pow((den - .055) / .022, 2)) * .6;
    const rim = Math.min(.7, edge * 2.5) * (1 - s.wet[i] * .35);
    const texture = 1 + grain * .16 * Math.min(1, den * 5) + rim + edgeDeposit + veins * .32;
    const lighting = clamp(1 + (gx * .8 - gy * 1.3) * relief * 1.2, .88, 1.15);
    const pearl = Math.max(0, (gx - gy) * .5) * relief * 32;
    const paper = [246, 242, 234];
    // Compress optical depth together, including older dense saved states.
    // Discount common absorption so overlapping hues do not become charcoal.
    const dilution = den > MAX_DENSITY ? MAX_DENSITY / den : 1;
    const neutral = Math.min(s.r[i], s.g[i], s.b[i]) * .72;
    for (let c = 0; c < 3; c++) {
      const channel = c === 0 ? s.r : c === 1 ? s.g : s.b;
      const stained = paper[c] * Math.exp(-(channel[i] - neutral) * dilution * texture * 1.8) * lighting + pearl;
      pixels[p + c] = clamp(paper[c] * (1 - coverage) + stained * coverage + grain * .7, 0, 255);
    }
    pixels[p + 3] = 255;
  }
}
