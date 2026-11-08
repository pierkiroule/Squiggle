import test from 'node:test';
import assert from 'node:assert/strict';
import { createHabitat, seedHabitat, stepHabitat, sampleHabitat, advancePigments } from '../src/living.mjs';

const settings = { memory: .38, wild: .62, diffusion: .55 };
const grain = (x, color) => ({ x, y: 100, homeX: x, homeY: 100, vx: .1, vy: 0, color: [...color], released: 1, settled: 0 });

test('unseeded habitat stays at equilibrium; a gesture consumes resources and propagates activation', () => {
  const h = createHabitat(300, 200);
  for (let i = 0; i < 100; i++) stepHabitat(h, .55);
  assert.ok(h.food.every(v => v === 1));
  assert.ok(h.signal.every(v => v === 0));
  seedHabitat(h, 150, 100);
  const initial = [...h.signal].filter(v => v > .001).length;
  for (let i = 0; i < 80; i++) stepHabitat(h, .55);
  assert.ok([...h.signal].filter(v => v > .001).length > initial);
  assert.ok(sampleHabitat(h, 150, 100).food < .8);
  for (let i = 0; i < 1000; i++) stepHabitat(h, .55);
  assert.ok(h.food.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
  assert.ok(h.signal.every(v => Number.isFinite(v) && v >= 0 && v <= 1));
});

test('pigment exchange is local, synchronous and does not mutate palette arrays', () => {
  const h = createHabitat(300, 200), red = [200, 50, 40], blue = [40, 80, 180];
  const p = [grain(100, red), grain(120, blue), grain(270, red)];
  const reversed = structuredClone(p).reverse();
  advancePigments(p, h, settings); advancePigments(reversed, h, settings);
  assert.ok(p[0].color[0] < red[0] && p[0].color[2] > red[2]);
  assert.deepEqual(p[2].color, red);
  p.forEach((v, i) => assert.deepEqual(v, reversed[2 - i]));
  assert.deepEqual(red, [200, 50, 40]);
});

test('related pigments adhere more strongly than unrelated pigments', () => {
  const h = createHabitat(300, 200);
  const related = [grain(100, [200, 50, 40]), grain(125, [200, 50, 40])];
  const different = [grain(100, [200, 50, 40]), grain(125, [40, 80, 180])];
  advancePigments(related, h, settings); advancePigments(different, h, settings);
  assert.ok(related[0].vx > different[0].vx);
});

test('crowded pigment settles and remains bounded over time', () => {
  const h = createHabitat(300, 200);
  seedHabitat(h, 150, 100);
  const p = Array.from({ length: 50 }, (_, i) => grain(145 + i % 10, [80, 100, 150]));
  for (let i = 0; i < 250; i++) {
    stepHabitat(h, .55); advancePigments(p, h, settings);
  }
  assert.ok(p.some(v => v.settled > .1));
  assert.ok(p.every(v => Number.isFinite(v.x + v.y + v.vx + v.vy + v.activity) && v.x >= 0 && v.x <= 300 && v.y >= 0 && v.y <= 200));
});

test('resize preserves the field and a new habitat clears it', () => {
  const h = createHabitat(300, 200); seedHabitat(h, 150, 100);
  const resized = createHabitat(600, 400, h);
  assert.ok(sampleHabitat(resized, 300, 200).signal > 0);
  assert.ok(createHabitat(600, 400).signal.every(v => v === 0));
});
