export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createGame(players, rounds = 3, random = Math.random) {
  if (!Number.isInteger(players) || players < 1 || players > 8) throw new Error('Choisissez entre 1 et 8 joueurs.');
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 8) throw new Error('Choisissez entre 1 et 8 passages.');
  const bag = shuffle(Array.from({ length: players }, (_, i) => i), random);
  return { players, rounds, bag, current: bag.shift(), turn: 1, total: players * rounds,
    untilVisit: 2 + Math.floor(random() * 2), phase: 'drawing', visits: 0 };
}

export function passTurn(game, hasDrawing, random = Math.random) {
  if (game.phase !== 'drawing') return game;
  if (game.turn >= game.total) return { ...game, phase: 'finished' };
  let bag = [...game.bag];
  if (!bag.length) {
    bag = shuffle(Array.from({ length: game.players }, (_, i) => i), random);
    if (bag.length > 1 && bag[0] === game.current) [bag[0], bag[1]] = [bag[1], bag[0]];
  }
  const visit = hasDrawing && (game.untilVisit <= 1 || (game.visits === 0 && game.turn === game.total - 1));
  return { ...game, bag: bag.slice(1), current: bag[0], turn: game.turn + 1,
    phase: visit ? 'living' : 'drawing', visits: game.visits + Number(visit),
    untilVisit: visit ? 2 + Math.floor(random() * 3) : Math.max(1, game.untilVisit - 1) };
}

// Each frame owns its changed strokes. Unchanged strokes are shared immutably.
export function recordFrame(frames, strokes, label) {
  const frame = { strokes, label };
  let result = [...frames, frame];
  // Thin older frames rather than stopping the recording in a long game.
  if (result.length > 600) result = result.filter((_, i) => i % 2 === 0 || i === result.length - 1);
  return result;
}

export function createVisitor(strokes, width, height, seed = 1) {
  const bodies = strokes.map(stroke => ({ ...stroke, points: stroke.points.map(p => ({ ...p, ox: p.x, oy: p.y, vx: 0, vy: 0 })) }));
  // The guest grows a few tendrils from existing marks, never from empty space.
  const sources = bodies.filter(s => s.tool !== 'eraser' && s.points.length > 2);
  for (let i = 0; i < Math.min(3, sources.length); i++) {
    const source = sources[(Math.floor(seed) + i) % sources.length];
    const origin = source.points[Math.floor(source.points.length * .65)];
    bodies.push({ color: source.color, width: Math.max(1, source.width * .65), tool: 'pen', player: -1,
      growing: true, direction: seed + i * 2.4, points: [{ ...origin, vx: 0, vy: 0 }] });
  }
  return { bodies, width, height, seed, time: 0 };
}

// Local elasticity, alignment and short-range exclusion animate actual drawing
// points. A short-range grid keeps distant marks independent.
export function stepVisitor(visitor) {
  visitor.time++;
  if (visitor.time % 4 === 0) for (const stroke of visitor.bodies) {
    if (!stroke.growing) continue;
    const tip = stroke.points.at(-1);
    stroke.direction += Math.sin(visitor.time * .07 + visitor.seed) * .12;
    const x = Math.max(0, Math.min(visitor.width, tip.x + Math.cos(stroke.direction) * 2.5));
    const y = Math.max(0, Math.min(visitor.height, tip.y + Math.sin(stroke.direction) * 2.5));
    stroke.points.push({ x, y, ox: x, oy: y, vx: 0, vy: 0, pressure: .7 });
  }
  const grid = new Map(), cell = 42;
  const points = visitor.bodies.flatMap(s => s.points);
  for (const p of points) {
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  }
  const next = [];
  for (const stroke of visitor.bodies) {
    for (let i = 0; i < stroke.points.length; i++) {
      const p = stroke.points[i], before = stroke.points[i - 1] || p, after = stroke.points[i + 1] || p;
      let fx = (p.ox - p.x) * .012, fy = (p.oy - p.y) * .012;
      // Elastic continuity preserves the gesture while allowing it to curl.
      fx += ((before.x - before.ox) + (after.x - after.ox) - 2 * (p.x - p.ox)) * .12;
      fy += ((before.y - before.oy) + (after.y - after.oy) - 2 * (p.y - p.oy)) * .12;
      let ax = 0, ay = 0, n = 0;
      const gx = Math.floor(p.x / cell), gy = Math.floor(p.y / cell);
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
        const bucket = grid.get(`${gx + x},${gy + y}`) || [];
        const stride = Math.max(1, Math.ceil(bucket.length / 12));
        for (let j = 0; j < bucket.length; j += stride) {
          const q = bucket[j]; if (q === p) continue;
          const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 > 1600 || d2 < .01) continue;
          ax += q.vx; ay += q.vy; n++;
          if (d2 < 49) { fx -= dx / (d2 + 2) * .12; fy -= dy / (d2 + 2) * .12; }
        }
      }
      if (n) { fx += (ax / n - p.vx) * .14; fy += (ay / n - p.vy) * .14; }
      const angle = Math.sin(p.ox * .012 + visitor.seed) + Math.cos(p.oy * .015 - visitor.time * .018);
      fx += Math.cos(angle * 3) * .085; fy += Math.sin(angle * 3) * .085;
      const vx = Math.max(-1, Math.min(1, (p.vx + fx) * .94));
      const vy = Math.max(-1, Math.min(1, (p.vy + fy) * .94));
      next.push([p, vx, vy]);
    }
  }
  for (const [p, vx, vy] of next) {
    p.vx = vx; p.vy = vy;
    p.x = Math.max(0, Math.min(visitor.width, p.x + vx));
    p.y = Math.max(0, Math.min(visitor.height, p.y + vy));
  }
}

export function visitorDrawing(visitor) {
  return visitor.bodies.map(s => ({ color: s.color, width: s.width, tool: s.tool,
    player: s.player, points: s.points.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })) }));
}
