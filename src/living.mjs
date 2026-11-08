// A biological analogy, not a model of an organism: local activation,
// long-range inhibition, limited resources and collective pigment transport.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createHabitat(width, height, previous) {
  const cols = Math.max(5, Math.min(160, Math.ceil(width / 10)));
  const rows = Math.max(5, Math.min(120, Math.ceil(height / 10)));
  const length = cols * rows;
  const habitat = { width, height, cols, rows, food: new Float32Array(length).fill(1), signal: new Float32Array(length), nextFood: new Float32Array(length), nextSignal: new Float32Array(length) };
  if (previous) {
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const old = Math.min(previous.rows - 1, Math.floor(y * previous.rows / rows)) * previous.cols + Math.min(previous.cols - 1, Math.floor(x * previous.cols / cols));
      habitat.food[y * cols + x] = previous.food[old];
      habitat.signal[y * cols + x] = previous.signal[old];
    }
  }
  return habitat;
}

function cell(h, x, y) {
  return clamp(Math.floor(y / h.height * h.rows), 0, h.rows - 1) * h.cols + clamp(Math.floor(x / h.width * h.cols), 0, h.cols - 1);
}

export function seedHabitat(h, x, y) {
  const center = cell(h, x, y), cx = center % h.cols, cy = Math.floor(center / h.cols);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const i = clamp(cy + dy, 0, h.rows - 1) * h.cols + clamp(cx + dx, 0, h.cols - 1);
    h.signal[i] = Math.max(h.signal[i], dx === 0 && dy === 0 ? .65 : .35);
    h.food[i] = Math.min(h.food[i], .55);
  }
}

export function stepHabitat(h, diffusion) {
  const { cols, rows, food: a, signal: b, nextFood: na, nextSignal: nb } = h;
  const feed = .027 + diffusion * .012, loss = .059;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    const left = y * cols + Math.max(0, x - 1), right = y * cols + Math.min(cols - 1, x + 1);
    const up = Math.max(0, y - 1) * cols + x, down = Math.min(rows - 1, y + 1) * cols + x;
    // Gray–Scott reaction/diffusion. Reflecting edges, simultaneous updates.
    const reaction = a[i] * b[i] * b[i];
    na[i] = clamp(a[i] + .19 * (a[left] + a[right] + a[up] + a[down] - 4 * a[i]) - reaction + feed * (1 - a[i]), 0, 1);
    nb[i] = clamp(b[i] + .09 * (b[left] + b[right] + b[up] + b[down] - 4 * b[i]) + reaction - (feed + loss) * b[i], 0, 1);
  }
  h.food = na; h.nextFood = a;
  h.signal = nb; h.nextSignal = b;
}

export function sampleHabitat(h, x, y) {
  const i = cell(h, x, y), cx = i % h.cols, cy = Math.floor(i / h.cols);
  const left = cy * h.cols + Math.max(0, cx - 1), right = cy * h.cols + Math.min(h.cols - 1, cx + 1);
  const up = Math.max(0, cy - 1) * h.cols + cx, down = Math.min(h.rows - 1, cy + 1) * h.cols + cx;
  return { food: h.food[i], signal: h.signal[i], dx: h.signal[right] - h.signal[left], dy: h.signal[down] - h.signal[up], foodX: h.food[right] - h.food[left], foodY: h.food[down] - h.food[up] };
}

export function advancePigments(particles, habitat, { memory, wild, diffusion }) {
  const cellSize = 44, grid = new Map();
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i], key = `${Math.floor(p.x / cellSize)},${Math.floor(p.y / cellSize)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }
  // Read a single generation; write only after all local interactions are known.
  const next = particles.map((p, i) => {
    const gx = Math.floor(p.x / cellSize), gy = Math.floor(p.y / cellSize);
    let fx = 0, fy = 0, vx = 0, vy = 0, weight = 0, density = 0;
    const exchange = [0, 0, 0];
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      for (const j of grid.get(`${gx + ox},${gy + oy}`) || []) {
        if (i === j) continue;
        const q = particles[j], dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
        if (d2 >= cellSize * cellSize) continue;
        const distance = Math.sqrt(d2), proximity = 1 - distance / cellSize;
        const difference = Math.hypot(...p.color.map((c, k) => c - q.color[k])) / 442;
        const affinity = Math.exp(-difference * 5);
        density += proximity;
        // Adhesion sorts related pigments; close-range exclusion leaves pores.
        const adhesion = (.0005 + affinity * .0025) * proximity;
        fx += dx * adhesion; fy += dy * adhesion;
        if (distance < 12) { fx -= dx / (d2 + 8) * .55; fy -= dy / (d2 + 8) * .55; }
        vx += q.vx * proximity; vy += q.vy * proximity; weight += proximity;
        for (let k = 0; k < 3; k++) exchange[k] += (q.color[k] - p.color[k]) * proximity;
      }
    }
    if (weight) { fx += (vx / weight - p.vx) * .055; fy += (vy / weight - p.vy) * .055; }
    const local = sampleHabitat(habitat, p.x, p.y);
    // Activation attracts matter; nutrient gradients open new growth fronts.
    const activity = clamp(local.food * .65 + local.signal * .8, .08, 1);
    fx += local.dx * .65 + local.foodX * (.12 + wild * .3);
    fy += local.dy * .65 + local.foodY * (.12 + wild * .3);
    // Turning along activation boundaries makes tendrils instead of global wind.
    fx -= local.dy * wild * .35; fy += local.dx * wild * .35;
    const released = Math.min(1, p.released + .012);
    const homeForce = memory * .003 * (1 - released * .93);
    fx += (p.homeX - p.x) * homeForce; fy += (p.homeY - p.y) * homeForce;
    const targetDeposit = clamp(density / 18 * (1 - local.food * .65), 0, .9);
    const settled = (p.settled || 0) + (targetDeposit - (p.settled || 0)) * .018;
    const damping = .975 - settled * .09;
    let nx = (p.vx + fx) * damping, ny = (p.vy + fy) * damping;
    const speed = Math.hypot(nx, ny), limit = (.35 + wild * 1.1) * (.4 + activity * .6);
    if (speed > limit) { nx *= limit / speed; ny *= limit / speed; }
    return {
      vx: nx, vy: ny, x: clamp(p.x + nx * released, 0, habitat.width), y: clamp(p.y + ny * released, 0, habitat.height),
      color: p.color.map((c, k) => clamp(c + (weight ? exchange[k] / weight * (.001 + diffusion * .006) : 0), 0, 255)),
      released, settled, density, activity, signal: local.signal,
      heading: Math.hypot(nx, ny) > .02 ? Math.atan2(ny, nx) : (p.heading || 0)
    };
  });
  particles.forEach((p, i) => Object.assign(p, next[i]));
}
