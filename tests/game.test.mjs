import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, passTurn, recordFrame, createVisitor, stepVisitor, visitorDrawing } from '../src/game.mjs';
const random = () => .4;
const drawing = [{ color: '#354b41', width: 4, tool: 'pen', player: 0, points: [{ x: 100, y: 100, pressure: 1 }, { x: 120, y: 120, pressure: 1 }, { x: 140, y: 110, pressure: 1 }] }];
test('validates player counts and rounds', () => {
  for (const n of [0, 9, NaN, 2.5]) assert.throws(() => createGame(n));
  assert.throws(() => createGame(2, 0));
});
test('every player gets one turn per round, with no repeat at round boundary', () => {
  let g = createGame(4, 3, random), turns = [];
  while (g.phase !== 'finished') {
    if (g.phase === 'living') g = { ...g, phase: 'drawing' };
    turns.push(g.current); g = passTurn(g, true, random);
  }
  assert.equal(turns.length, 12);
  for (let i = 0; i < 12; i += 4) assert.equal(new Set(turns.slice(i, i + 4)).size, 4);
  for (let i = 1; i < turns.length; i++) assert.notEqual(turns[i], turns[i - 1]);
});
test('living guest intervenes, locks passing and yields to the selected player', () => {
  let g = createGame(2, 3, random);
  while (g.phase === 'drawing') g = passTurn(g, true, random);
  assert.equal(g.phase, 'living'); assert.equal(g.visits, 1);
  assert.deepEqual(passTurn(g, true), g);
  assert.equal(passTurn({ ...g, phase: 'drawing' }, true, random).turn, g.turn + 1);
});
test('short solo games still invite the guest; blank games never do', () => {
  assert.equal(passTurn(createGame(1, 2, random), true, random).phase, 'living');
  let g = createGame(2, 2, random);
  while (g.phase !== 'finished') g = passTurn(g, false, random);
  assert.equal(g.visits, 0);
});
test('living transformation alters actual drawing, grows from marks and preserves original snapshots', () => {
  const original = structuredClone(drawing), v = createVisitor(drawing, 1200, 760, 2);
  const first = visitorDrawing(v);
  for (let i = 0; i < 120; i++) stepVisitor(v);
  const final = visitorDrawing(v);
  assert.deepEqual(drawing, original);
  assert.notDeepEqual(final[0].points, original[0].points);
  assert.ok(final[1].points.length > 20);
  assert.equal(first[1].points.length, 1);
  assert.ok(final.flatMap(s => s.points).every(p => Number.isFinite(p.x + p.y) && p.x >= 0 && p.x <= 1200 && p.y >= 0 && p.y <= 760));
});
test('empty drawings remain empty during a visit', () => {
  const v = createVisitor([], 1200, 760); stepVisitor(v); assert.deepEqual(visitorDrawing(v), []);
});
test('recording retains the beginning and final frame when thinning long games', () => {
  let frames = [];
  for (let i = 0; i < 1500; i++) frames = recordFrame(frames, [], String(i));
  assert.ok(frames.length <= 600); assert.equal(frames[0].label, '0'); assert.equal(frames.at(-1).label, '1499');
});
