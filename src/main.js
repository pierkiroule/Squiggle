import { createInk, seedInk, stepInk, touchInk, snapshot, prepareMorph, morphInk, renderInk, PALETTES } from './ink.mjs';
const $ = id => document.getElementById(id), canvas = $('art'), ctx = canvas.getContext('2d', { alpha:false });
const W = 280, H = 194;
const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
const g = layer.getContext('2d'), image = g.createImageData(W,H);
const grain = document.createElement('canvas'), grainCtx = grain.getContext('2d');
let ink = createInk(W,H,Math.random()*20); seedInk(ink);
let palette = 0, selected = 0, mirror = false, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let contact = null, pointer = null, states = [], morphs = new Map(), output = createInk(W,H), displayed = ink;
let replay = false, playing = false, position = 0, last = 0, accumulator = 0, recorder = null, chunks = [], exporting = false;
function draw(s = displayed) {
  displayed = s; renderInk(s,image.data,s.relief ?? Number($('relief').value)/100); g.putImageData(image,0,0);
  ctx.drawImage(layer,0,0,canvas.width,canvas.height);
  ctx.save(); ctx.scale(canvas.width/W,canvas.height/H);
  const levels=[.028,.052,.1,.18,.3,.48,.72,1.05];
  const density=new Float32Array(W*H);
  let minX=W-1,maxX=0,minY=H-1,maxY=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;density[i]=(s.r[i]+s.g[i]+s.b[i])/3;if(density[i]>.018){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
  minX=Math.max(0,minX-1);maxX=Math.min(W-2,maxX+1);minY=Math.max(0,minY-1);maxY=Math.min(H-2,maxY+1);
  for(const level of levels){
    ctx.beginPath();
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const i=y*W+x;
      const a=density[i],b=density[i+1],c=density[i+W+1],d=density[i+W];
      if(Math.min(a,b,c,d)>level||Math.max(a,b,c,d)<level)continue;
      const values=[a,b,c,d];
      const hits=[];
      const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
      for(let k=0;k<4;k++){const j=(k+1)%4;if((values[k]<level)!==(values[j]<level)){const t=(level-values[k])/(values[j]-values[k]);hits.push([corners[k][0]+(corners[j][0]-corners[k][0])*t,corners[k][1]+(corners[j][1]-corners[k][1])*t]);}}
      for(let k=0;k+1<hits.length;k+=2){ctx.moveTo(...hits[k]);ctx.lineTo(...hits[k+1]);}
    }
    ctx.strokeStyle=level<.08?'rgba(79,64,63,.24)':'rgba(68,49,62,.11)';ctx.lineWidth=level<.08?.18:.09;ctx.stroke();
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha=.12; ctx.globalCompositeOperation='multiply'; ctx.drawImage(grain,0,0); ctx.restore();
}
function resize() {
  const r=canvas.getBoundingClientRect(), dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.max(1,Math.round(r.width*dpr)); canvas.height=Math.max(1,Math.round(r.height*dpr));
  grain.width=canvas.width; grain.height=canvas.height;
  const pixels=grainCtx.createImageData(grain.width,grain.height);
  for(let i=0;i<pixels.data.length;i+=4){const value=210+Math.random()*45;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}
  grainCtx.putImageData(pixels,0,0);draw();
}
function swatches(){
  $('swatches').replaceChildren();
  PALETTES[palette].colors.forEach((color,i)=>{const b=document.createElement('button');b.type='button';b.className='swatch';b.style.setProperty('--color',color);b.setAttribute('aria-label',`${PALETTES[palette].name}, pigment ${i+1}`);b.setAttribute('aria-pressed',String(i===selected));b.disabled=replay;b.onclick=()=>{selected=i;swatches();};$('swatches').append(b);});
}
function modeUI(){
  $('mode').textContent=replay?'LES RÉSONANCES SE MÉTAMORPHOSENT':paused?'L’ENCRE EST SUSPENDUE':'L’ENCRE EST VIVANTE';
  $('pause').textContent=paused?'Réveiller':'Suspendre';$('pause').setAttribute('aria-pressed',String(paused));
  for(const id of ['palette','size','activity','relief','mirror','pause','resonate'])$(id).disabled=replay;
  $('resonate').disabled=replay||states.length>=24;
  $('playback').hidden=!replay;$('play').textContent=playing?'Ⅱ Pause':'▶ Lire';
  $('animate').disabled=states.length<2||exporting;$('count').textContent=states.length;$('empty').hidden=states.length>0;
  for(const id of ['timeline','duration','return','reset','play'])$(id).disabled=exporting;
  $('video').disabled=exporting||states.length<2||!window.MediaRecorder||!canvas.captureStream;
  $('play').disabled=exporting||states.length<2; $('timeline').disabled=exporting||states.length<2;
  swatches();
}
function dab(x,y,dx=0,dy=0,pressure=1){
  const color=PALETTES[palette].colors[selected],radius=Number($('size').value);
  touchInk(ink,x,y,color,radius,dx,dy,pressure);
  if(mirror)touchInk(ink,W-x,y,color,radius,-dx,dy,pressure);
}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H,pressure:e.pointerType==='pen'?Math.max(.1,e.pressure):.65};}
function release(){contact=null;const id=pointer;pointer=null;if(id!==null&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
canvas.addEventListener('pointerdown',e=>{if(replay||pointer!==null||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(pointer);contact=point(e);dab(contact.x,contact.y,0,0,contact.pressure);draw(ink);});
canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId||!contact)return;e.preventDefault();for(const p of e.getCoalescedEvents?.().length?e.getCoalescedEvents():[e]){const next=point(p),dx=next.x-contact.x,dy=next.y-contact.y,n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/2));for(let i=1;i<=n;i++)dab(contact.x+dx*i/n,contact.y+dy*i/n,dx/n,dy/n,next.pressure);contact=next;}draw(ink);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(pointer===e.pointerId)release();});
$('palette').onchange=()=>{palette=Number($('palette').value);selected=0;swatches();};
$('mirror').onclick=()=>{mirror=!mirror;$('mirror').setAttribute('aria-pressed',String(mirror));};
$('pause').onclick=()=>{paused=!paused;modeUI();};$('relief').oninput=()=>draw();
function stateCards(){
  $('states').replaceChildren();
  states.forEach((state,i)=>{const card=document.createElement('div');card.className='state';const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`Contempler la résonance ${i+1}`);const img=document.createElement('img');img.src=state.thumbnail;img.alt=`Encre de la résonance ${i+1}`;b.append(img);b.disabled=exporting;b.onclick=()=>{release();replay=true;playing=false;position=i;showPosition();modeUI();};const label=document.createElement('p');label.textContent=`${String(i+1).padStart(2,'0')} · Ça résonne`;const remove=document.createElement('button');remove.className='remove';remove.textContent='×';remove.setAttribute('aria-label',`Supprimer la résonance ${i+1}`);remove.disabled=exporting;remove.onclick=()=>{states.splice(i,1);morphs.clear();playing=false;position=Math.min(position,Math.max(0,states.length-1));if(states.length<2){replay=false;draw(ink);}else if(replay)showPosition();stateCards();modeUI();};card.append(b,remove,label);$('states').append(card);});modeUI();
}
$('resonate').onclick=()=>{
  release();if(replay||states.length>=24)return;
  const thumbnail=document.createElement('canvas');thumbnail.width=224;thumbnail.height=150;thumbnail.getContext('2d').drawImage(canvas,0,0,224,150);
  states.push({ink:{...snapshot(ink),relief:Number($('relief').value)/100},thumbnail:thumbnail.toDataURL('image/png')});stateCards();
  $('invitation').textContent=`Résonance ${states.length} retenue. La rencontre peut continuer.`;
};
function showPosition(){
  const i=Math.min(Math.floor(position),states.length-1),t=position-i;
  if(t<.00001||i===states.length-1)draw(states[i].ink);
  else{if(!morphs.has(i))morphs.set(i,prepareMorph(states[i].ink,states[i+1].ink));draw(morphInk(morphs.get(i),t,output));}
  $('timeline').value=Math.round(position/Math.max(1,states.length-1)*1000);
  $('invitation').textContent=`Résonance ${Math.min(i+1,states.length)} → ${Math.min(i+2,states.length)} · ${states.length} états`;
}
function begin(){if(states.length<2)return;release();replay=true;playing=true;position=0;accumulator=0;showPosition();modeUI();}
$('animate').onclick=begin;
$('play').onclick=()=>{if(position>=states.length-1)position=0;playing=!playing;showPosition();modeUI();};
$('timeline').oninput=()=>{playing=false;position=Number($('timeline').value)/1000*(states.length-1);showPosition();modeUI();};
$('return').onclick=()=>{replay=false;playing=false;draw(ink);modeUI();$('invitation').textContent='Tracez dans la matière. Laissez-la vous répondre.';};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('save').onclick=()=>canvas.toBlob(blob=>{if(blob)download(blob,'encre-resonance.png');},'image/png');
$('video').onclick=()=>{
  if(states.length<2||exporting)return;
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
  if(!mime){$('export-status').textContent='L’export vidéo n’est pas disponible dans ce navigateur.';return;}
  try{
    const stream=canvas.captureStream(30);chunks=[];recorder=new MediaRecorder(stream,{mimeType:mime});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());if(chunks.length)download(new Blob(chunks,{type:mime}),'encre-resonances.webm');exporting=false;recorder=null;$('export-status').textContent='Animation exportée en WebM.';stateCards();};
    recorder.onerror=()=>{$('export-status').textContent='L’export vidéo a échoué. Réessayez.';if(recorder?.state!=='inactive')recorder.stop();};
    exporting=true;begin();stateCards();recorder.start(200);$('export-status').textContent='Enregistrement de la métamorphose… gardez cette page ouverte.';
  }catch{exporting=false;recorder=null;$('export-status').textContent='Impossible de démarrer l’export dans ce navigateur.';modeUI();}
};
$('reset').onclick=()=>$('reset-dialog').showModal();$('cancel-reset').onclick=()=>$('reset-dialog').close();
$('confirm-reset').onclick=()=>{release();states=[];morphs.clear();replay=false;playing=false;ink=createInk(W,H,Math.random()*20);seedInk(ink,PALETTES[palette].colors);draw(ink);stateCards();$('reset-dialog').close();$('invitation').textContent='Une nouvelle matière. Une nouvelle rencontre.';};
function animate(now){
  const dt=Math.min(now-(last||now),70);last=now;
  if(!document.hidden){
    if(replay&&playing){position=Math.min(states.length-1,position+dt/Number($('duration').value));showPosition();if(position===states.length-1){playing=false;if(exporting&&recorder?.state==='recording')recorder.stop();modeUI();}}
    else if(!replay&&!paused){accumulator+=dt;if(accumulator>=50){accumulator=0;if(contact)dab(contact.x,contact.y,0,0,contact.pressure*.18);stepInk(ink,Number($('activity').value)/100);draw(ink);}}
  }
  requestAnimationFrame(animate);
}
new ResizeObserver(resize).observe($('paper'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)release();last=0;});window.addEventListener('blur',release);
modeUI();resize();requestAnimationFrame(animate);
