'use strict';
/* Áudio procedural e utilitários de renderização */
// ================================================================ ÁUDIO
let actx=null, master=null, sfxBus=null, musicBus=null, noiseBuf=null;
function initAudio(){
  if(actx) return;
  try{
    actx = new (window.AudioContext||window.webkitAudioContext)();
    master = actx.createGain(); sfxBus = actx.createGain(); musicBus = actx.createGain();
    sfxBus.connect(master); musicBus.connect(master);
    const lp = actx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=4200;
    master.connect(lp); lp.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    applySettings();
  }catch(e){ actx=null; }
}
function tone({type='square', f0=440, f1, dur=.1, vol=.15, when=0, attack=.005, dest}={}){
  if(!actx) return; const t = when||actx.currentTime;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type=type; o.frequency.setValueAtTime(f0,t);
  if(f1 && f1!==f0) o.frequency.exponentialRampToValueAtTime(f1, t+dur);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol, t+attack);
  g.gain.exponentialRampToValueAtTime(.0001, t+dur);
  o.connect(g); g.connect(dest||sfxBus); o.start(t); o.stop(t+dur+.05);
}
function noise({dur=.1, vol=.2, filter='lowpass', freq=1000, when=0, dest}={}){
  if(!actx) return; const t = when||actx.currentTime;
  const s = actx.createBufferSource(); s.buffer=noiseBuf;
  const f = actx.createBiquadFilter(); f.type=filter; f.frequency.value=freq;
  const g = actx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f); f.connect(g); g.connect(dest||sfxBus); s.start(t, Math.random()*.5); s.stop(t+dur+.02);
}
const sfx = {
  laser(){ tone({type:'square', f0:900, f1:180, dur:.09, vol:.06}); },
  hit(){ noise({dur:.07, vol:.15, filter:'bandpass', freq:2500}); },
  boom(){ noise({dur:.6, vol:.45, freq:700}); tone({type:'sine', f0:140, f1:35, dur:.5, vol:.35}); },
  hurt(){ tone({type:'sawtooth', f0:220, f1:70, dur:.22, vol:.15}); noise({dur:.15, vol:.2, freq:900}); },
  pickup(){ tone({type:'sine', f0:700, f1:1400, dur:.1, vol:.1}); },
  ui(){ tone({type:'square', f0:1300, dur:.03, vol:.04}); },
  open(){ tone({type:'square', f0:600, f1:1200, dur:.06, vol:.04}); },
  coin(){ tone({type:'square', f0:988, dur:.08, vol:.07}); if(actx) tone({type:'square', f0:1319, dur:.25, vol:.07, when:actx.currentTime+.08}); },
  error(){ tone({type:'square', f0:180, dur:.15, vol:.06}); },
  jump(){ tone({type:'sine', f0:120, f1:1800, dur:.9, vol:.18}); noise({dur:.9, vol:.12, filter:'highpass', freq:2000}); },
  door(){ noise({dur:.5, vol:.15, freq:400}); tone({type:'triangle', f0:90, f1:60, dur:.5, vol:.12}); },
};
// Jazz lo-fi procedural (toca-fitas)
const music = { on:false, gain:null, next:0, step:0, timer:null };
const BPM = 78, EIGHTH = 60/BPM/2;
const PROG = [ {b:38,t:3,v:[53,57,60,64]}, {b:43,t:4,v:[53,57,59,64]}, {b:36,t:4,v:[52,55,59,62]}, {b:45,t:4,v:[52,55,58,61]} ];
const mtof = m => 440*Math.pow(2,(m-69)/12);
function musicToggle(){
  if(!actx) return false;
  if(music.on){ music.on=false; clearInterval(music.timer); const g=music.gain; g.gain.setTargetAtTime(0, actx.currentTime, .2); setTimeout(()=>g.disconnect(), 1500); return false; }
  music.gain = actx.createGain(); music.gain.gain.value=.6; music.gain.connect(musicBus);
  music.on=true; music.next=actx.currentTime+.1; music.step=0;
  music.timer = setInterval(()=>{
    while(music.next < actx.currentTime+.25){
      playStep(music.step, music.next);
      music.next += (music.step%2===0) ? EIGHTH*1.2 : EIGHTH*.8;
      music.step = (music.step+1) % (8*PROG.length);
    }
  }, 50);
  return true;
}
function playStep(s, t){
  const bar = Math.floor(s/8), e = s%8, ch = PROG[bar], g = music.gain;
  if(e===0) ch.v.forEach(n=>{ tone({type:'triangle', f0:mtof(n), dur:EIGHTH*7.5, vol:.03, when:t, attack:.04, dest:g});
                              tone({type:'sine', f0:mtof(n)*1.003, dur:EIGHTH*7, vol:.02, when:t, attack:.05, dest:g}); });
  if(e%2===0){ const nx = PROG[(bar+1)%PROG.length].b, walk=[ch.b, ch.b+ch.t, ch.b+7, nx+1];
    tone({type:'sine', f0:mtof(walk[e/2]), dur:EIGHTH*1.8, vol:.25, when:t, attack:.01, dest:g}); }
  if(e===0||e===4) tone({type:'sine', f0:110, f1:42, dur:.2, vol:.3, when:t, dest:g});
  if(e===2||e===6) noise({dur:.14, vol:.07, filter:'bandpass', freq:1700, when:t, dest:g});
  noise({dur:.035, vol:e%2?.025:.045, filter:'highpass', freq:7000, when:t, dest:g});
  if(e!==0 && Math.random()<.3){ const sc=[62,64,65,67,69,72,74,76], n=sc[(Math.random()*sc.length)|0];
    tone({type:'sine', f0:mtof(n), dur:EIGHTH*2, vol:.055, when:t, dest:g}); tone({type:'sine', f0:mtof(n)*4, dur:EIGHTH*.8, vol:.008, when:t, dest:g}); }
  if(Math.random()<.6) noise({dur:.006, vol:.05*Math.random(), filter:'highpass', freq:3000, when:t+Math.random()*EIGHTH, dest:g});
}

// ================================================================ RENDER
const renderer = new THREE.WebGLRenderer({ antialias:true, logarithmicDepthBuffer:true });   // escala planetária
renderer.setSize(innerWidth, innerHeight);
document.getElementById('game').appendChild(renderer.domElement);
const canvas = renderer.domElement;
const V3 = THREE.Vector3;
const rand = (a,b)=>a+Math.random()*(b-a);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerpAngle = (a,b,t)=>{ const d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI; return a+d*t; };
const M = (color, o={}) => new THREE.MeshStandardMaterial(Object.assign({color, roughness:.85, metalness:.15, flatShading:true}, o));
const B = (color, o={}) => new THREE.MeshBasicMaterial(Object.assign({color}, o));
function box(w,h,d,mat,x=0,y=0,z=0,p){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); if(p)p.add(m); return m; }
function cyl(rt,rb,h,seg,mat,x=0,y=0,z=0,p){ const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat); m.position.set(x,y,z); if(p)p.add(m); return m; }
function plane(w,h,mat,x=0,y=0,z=0,p){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat); m.position.set(x,y,z); if(p)p.add(m); return m; }
function canvasTex(w,h,draw){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); draw(g,w,h,c);
  const t=new THREE.CanvasTexture(c); t.userData={c,g}; return t;
}
function signTex(text, color, w=256, h=64, size=40){
  return canvasTex(w,h,(g)=>{ g.fillStyle='#0b0706'; g.fillRect(0,0,w,h);
    g.strokeStyle=color; g.lineWidth=3; g.strokeRect(4,4,w-8,h-8);
    g.font=`bold ${size}px "Courier New",monospace`; g.textAlign='center'; g.textBaseline='middle';
    g.shadowColor=color; g.shadowBlur=14; g.fillStyle=color; g.fillText(text,w/2,h/2+2); g.fillText(text,w/2,h/2+2); });
}

