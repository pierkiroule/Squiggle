import test from 'node:test';
import assert from 'node:assert/strict';
import { createInk, seedInk, touchInk, stepInk, snapshot, prepareMorph, morphInk, renderInk } from '../src/ink.mjs';
test('a gesture deposits local pigment and momentum, leaving distant matter intact', () => {
  const s=createInk(50,40);touchInk(s,15,20,'#426d9b',5,3,-2);
  assert.ok(s.r[20*50+15]>0);assert.ok(s.wet[20*50+15]>0);assert.ok(s.vx[20*50+15]>0);assert.ok(s.vy[20*50+15]<0);
  assert.equal(s.r[0],0);assert.equal(s.r[39*50+49],0);
});
test('living matter evolves and all channels remain finite and bounded', () => {
  const s=createInk(64,48);seedInk(s);const initial=snapshot(s);
  for(let i=0;i<140;i++)stepInk(s,.8);
  assert.notDeepEqual(s.r,initial.r);
  for(const key of ['r','g','b','wet'])assert.ok(s[key].every(v=>Number.isFinite(v)&&v>=0&&v<=5));
  assert.ok(s.vx.every(v=>Number.isFinite(v)&&Math.abs(v)<=.9));
});
test('resonance snapshots remain independent of continued interaction', () => {
  const s=createInk(40,30);seedInk(s);const a=snapshot(s),original=new Float32Array(a.r);
  touchInk(s,20,15,'#aa3355',5);stepInk(s);
  assert.deepEqual(a.r,original);assert.notDeepEqual(s.r,a.r);
});
test('morph has exact endpoints, spatial flow and finite in-between states without changing captures', () => {
  const s=createInk(40,30);touchInk(s,15,15,'#426d9b',5);const a=snapshot(s);
  const other=createInk(40,30);touchInk(other,20,16,'#aa3355',5);const b=snapshot(other);
  const original=new Float32Array(a.r), m=prepareMorph(a,b), out=createInk(40,30);
  assert.ok(m.vx.some(v=>Math.abs(v)>.1));
  morphInk(m,0,out);assert.deepEqual(out.r,a.r);morphInk(m,1,out);assert.deepEqual(out.r,b.r);
  morphInk(m,.5,out);assert.ok(out.r.every(v=>Number.isFinite(v)&&v>=0));assert.notDeepEqual(out.r,a.r);assert.notDeepEqual(out.r,b.r);
  assert.deepEqual(a.r,original);
});
test('identical states stay still through morph and incompatible states are rejected', () => {
  const s=createInk(24,20);seedInk(s);const a=snapshot(s), out=createInk(24,20);morphInk(prepareMorph(a,a),.4,out);
  for(let i=0;i<a.r.length;i++)assert.ok(Math.abs(a.r[i]-out.r[i])<1e-6);
  assert.throws(()=>prepareMorph(a,snapshot(createInk(20,20))));
});
test('pigment rendering produces opaque rich gradients and responds to relief', () => {
  const s=createInk(64,48);seedInk(s);const a=new Uint8ClampedArray(64*48*4),b=new Uint8ClampedArray(a.length);
  renderInk(s,a,0);renderInk(s,b,1);assert.notDeepEqual(a,b);
  const shades=new Set();for(let i=0;i<a.length;i+=4){assert.equal(a[i+3],255);shades.add(`${a[i]},${a[i+1]},${a[i+2]}`);}
  assert.ok(shades.size>300);
});
