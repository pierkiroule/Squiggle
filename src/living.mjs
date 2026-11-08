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

export function createSwarm(width, height, count, random = Math.random) {
  return Array.from({ length: count }, (_, index) => {
    const x = random() * width, y = random() * height, heading = random() * Math.PI * 2;
    const shade = random();
    return { x, y, homeX: x, homeY: y, vx: Math.cos(heading) * .45, vy: Math.sin(heading) * .45,
      color: [75 + shade * 35, 95 + shade * 30, 100 + shade * 35],
      size: .5 + random() * .65, ink: .6 + random() * .4, index,
      heading, released: 1, settled: 0, density: 0, activity: .65, signal: 0 };
  });
}

// A tap produces an expanding force front, not a drawn circle.
export function advanceWaves(waves) {
  for (const wave of waves) { wave.radius += 3.2; wave.strength *= .965; }
  return waves.filter(wave => wave.strength > .035);
}

export function contactForce(p, contacts = [], waves = []) {
  let x = 0, y = 0, stain = 0, color = p.color;
  let anchorX = p.homeX, anchorY = p.homeY;
  for (const touch of contacts) {
    const dx = p.x - touch.x, dy = p.y - touch.y, distance = Math.hypot(dx, dy);
    const reach = 64 + touch.pressure * 38;
    if (distance >= reach) continue;
    const influence = (1 - distance / reach) ** 2;
    const speed = Math.hypot(touch.vx, touch.vy);
    const holding = touch.age > 350 && speed < .6;
    const radial = holding ? -.14 : .08;
    x += influence * (touch.vx * .18 + dx / (distance || 1) * radial);
    y += influence * (touch.vy * .18 + dy / (distance || 1) * radial);
    const amount = influence * (.025 + touch.pressure * .04);
    color = color.map((c, k) => c + (touch.color[k] - c) * amount);
    stain = Math.max(stain, influence);
    anchorX += (touch.x - anchorX) * influence * .018;
    anchorY += (touch.y - anchorY) * influence * .018;
  }
  for (const wave of waves) {
    const dx = p.x - wave.x, dy = p.y - wave.y, distance = Math.hypot(dx, dy);
    const front = Math.max(0, 1 - Math.abs(distance - wave.radius) / 22);
    x += dx / (distance || 1) * front * wave.strength * .5;
    y += dy / (distance || 1) * front * wave.strength * .5;
  }
  return { x, y, color, stain, homeX: anchorX, homeY: anchorY };
}

export function advancePigments(particles, habitat, { memory, wild, diffusion, contacts = [], waves = [] }) {
  const cellSize = 46, columns = Math.ceil(habitat.width / cellSize) + 2, grid = new Map();
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i], key = Math.floor(p.x / cellSize) + Math.floor(p.y / cellSize) * columns;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }
  // Read a single generation; write only after all local interactions are known.
  const next = particles.map((p, i) => {
    const gx = Math.floor(p.x / cellSize), gy = Math.floor(p.y / cellSize);
    let fx = 0, fy = 0, vx = 0, vy = 0, weight = 0, density = 0;
    const exchange = [0, 0, 0];
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      for (const j of grid.get(gx + ox + (gy + oy) * columns) || []) {
        if (i === j) continue;
        const q = particles[j], dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
        if (d2 >= cellSize * cellSize) continue;
        const distance = Math.sqrt(d2), proximity = 1 - distance / cellSize;
        const cr = p.color[0] - q.color[0], cg = p.color[1] - q.color[1], cb = p.color[2] - q.color[2];
        const difference = Math.sqrt(cr * cr + cg * cg + cb * cb) / 442;
        const affinity = Math.exp(-difference * 5);
        density += proximity;
        // Adhesion sorts related pigments; close-range exclusion leaves pores.
        const adhesion = (.00004 + affinity * .00012) * proximity;
        fx += dx * adhesion; fy += dy * adhesion;
        if (distance < 9) { fx -= dx / (d2 + 8) * .55; fy -= dy / (d2 + 8) * .55; }
        vx += q.vx * proximity; vy += q.vy * proximity; weight += proximity;
        for (let k = 0; k < 3; k++) exchange[k] += (q.color[k] - p.color[k]) * proximity;
      }
    }
    if (weight) { fx += (vx / weight - p.vx) * .09; fy += (vy / weight - p.vy) * .09; }
    const local = sampleHabitat(habitat, p.x, p.y);
    // Activation attracts matter; nutrient gradients open new growth fronts.
    const activity = clamp(local.food * .65 + local.signal * .8, .08, 1);
    fx += local.dx * .65 + local.foodX * (.12 + wild * .3);
    fy += local.dy * .65 + local.foodY * (.12 + wild * .3);
    // Turning along activation boundaries makes tendrils instead of global wind.
    fx -= local.dy * wild * .35; fy += local.dx * wild * .35;
    const released = Math.min(1, p.released + .012);
    const contact = contactForce(p, contacts, waves);
    fx += contact.x; fy += contact.y;
    // Persistent individual propulsion keeps the untouched surface alive.
    const heading = p.heading ?? Math.atan2(p.vy, p.vx);
    fx += Math.cos(heading) * (.012 + wild * .012) * (1 - (p.settled || 0) * .5);
    fy += Math.sin(heading) * (.012 + wild * .012) * (1 - (p.settled || 0) * .5);
    const homeForce = memory * .00004;
    fx += (p.homeX - p.x) * homeForce; fy += (p.homeY - p.y) * homeForce;
    const targetDeposit = clamp(density / 18 * (1 - local.food * .65), 0, .9);
    const settled = (p.settled || 0) + (targetDeposit - (p.settled || 0)) * .018;
    const margin = 35;
    if (p.x < margin) fx += (margin - p.x) * .006;
    if (p.x > habitat.width - margin) fx -= (p.x - habitat.width + margin) * .006;
    if (p.y < margin) fy += (margin - p.y) * .006;
    if (p.y > habitat.height - margin) fy -= (p.y - habitat.height + margin) * .006;
    const damping = .975 - settled * .09;
    let nx = (p.vx + fx) * damping, ny = (p.vy + fy) * damping;
    const speed = Math.hypot(nx, ny), limit = (contact.stain > 0 ? 2.4 : .65 + wild * 1.1) * (.6 + activity * .4);
    if (speed > limit) { nx *= limit / speed; ny *= limit / speed; }
    // Like a flock, keep travelling rather than collapsing into static islands.
    const cruise = (.28 + wild * .35) * (1 - settled * .45);
    if (speed < cruise) {
      const direction = speed > .001 ? Math.atan2(ny, nx) : heading;
      const eased = speed + (cruise - speed) * .08;
      nx = Math.cos(direction) * eased; ny = Math.sin(direction) * eased;
    }
    return {
      vx: nx, vy: ny, x: clamp(p.x + nx * released, 0, habitat.width), y: clamp(p.y + ny * released, 0, habitat.height),
      color: contact.color.map((c, k) => clamp(c + (weight ? exchange[k] / weight * (.0003 + diffusion * .0015) : 0), 0, 255)),
      homeX: contact.homeX, homeY: contact.homeY,
      released, settled, density, activity, signal: local.signal,
      heading: Math.hypot(nx, ny) > .02 ? Math.atan2(ny, nx) : (p.heading || 0)
    };
  });
  particles.forEach((p, i) => Object.assign(p, next[i]));
}
