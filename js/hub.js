'use strict';
/* Hub: apartamento do jogador */
// ================================================================ HUB (APARTAMENTO)
const hub = { scene:new THREE.Scene(), cam:new THREE.PerspectiveCamera(65, innerWidth/innerHeight, .05, 200),
              furn:{}, carry:null, carryRot:0, walk:0, yaw:0, pitch:.32, dist:4.2 };
const ROOM = { W:16, D:10, H:4.2 };
const T_POS = new V3(-6.6, 0, 2.4), EL_POS = new V3(7.2, 0, 3.0);

function buildHub(){
  const s = hub.scene;
  s.background = new THREE.Color(0x07060a); s.fog = new THREE.Fog(0x07060a, 14, 32);
  s.add(new THREE.AmbientLight(0x6a5a78, .6));
  s.add(new THREE.HemisphereLight(0x8a7aa8, 0x2a1a10, .35));
  const amber = new THREE.PointLight(0xffa040, 1.3, 13); amber.position.set(-5.5,3,-1.5); s.add(amber);
  const win = new THREE.PointLight(0x8a70ff, 1.1, 12); win.position.set(.5,2.4,-3.6); s.add(win);
  const fluor = new THREE.PointLight(0xfff0d0, .8, 16); fluor.position.set(2,3.7,1); s.add(fluor);
  const fluor2 = new THREE.PointLight(0xffe8c8, .5, 12); fluor2.position.set(-3,3.7,3); s.add(fluor2);
  const red = new THREE.PointLight(0xff3020, .8, 6); red.position.set(7,3,3); s.add(red);
  hub.fluor = fluor;

  const { W, D, H } = ROOM;
  const wallTex = canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#2c2a32'; g.fillRect(0,0,w,h);
    for(let i=0;i<4;i++)for(let j=0;j<4;j++){
      const v=62+Math.random()*18; g.fillStyle=`rgb(${v},${v-2},${v+8})`; g.fillRect(i*64+2,j*64+2,60,60);
      g.fillStyle='#24222a'; [[6,6],[56,6],[6,56],[56,56]].forEach(([a,b])=>g.fillRect(i*64+a,j*64+b,3,3));
    }
    for(let k=0;k<70;k++){ g.fillStyle=`rgba(20,12,6,${Math.random()*.25})`; g.fillRect(Math.random()*w,Math.random()*h,rand(2,18),rand(2,30)); }
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  const floorTex = canvasTex(128,128,(g,w,h)=>{
    g.fillStyle='#1c1b20'; g.fillRect(0,0,w,h); g.strokeStyle='#2c2b32'; g.lineWidth=2;
    for(let i=0;i<=8;i++){ g.beginPath(); g.moveTo(i*16,0); g.lineTo(i*16,h); g.stroke(); }
    g.fillStyle='#34333a'; g.fillRect(0,0,w,3); g.fillRect(0,64,w,3);
    for(let k=0;k<40;k++){ g.fillStyle=`rgba(0,0,0,${Math.random()*.3})`; g.fillRect(Math.random()*w,Math.random()*h,rand(3,14),rand(3,14)); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(6,4);
  const wt = (rx)=>{ const t=wallTex.clone(); t.needsUpdate=true; t.repeat.set(rx,1); return t; };

  box(W, .2, D, M(0xffffff,{map:floorTex}), 0, -.1, 0, s);
  box(W, H, .3, M(0xffffff,{map:wt(4)}), 0, H/2, -D/2, s);
  box(W, H, .3, M(0xffffff,{map:wt(4)}), 0, H/2,  D/2, s);
  box(.3, H, D, M(0xffffff,{map:wt(2.5)}), -W/2, H/2, 0, s);
  box(.3, H, D, M(0xffffff,{map:wt(2.5)}), W/2, H/2, 0, s);
  box(W, .3, D, M(0x26242a), 0, H+.15, 0, s);                       // teto
  for(let i=-1;i<=1;i++) box(1.6,.06,.4,B(0xfff4d8),i*5,H-.03,1.5,s);  // luminárias do teto
  plane(3.4,2.4, M(0x4a2c22), -1.2, .01, .6, s).rotation.x = -Math.PI/2;

  // janela panorâmica
  const winTex = canvasTex(512,180,(g,w,h)=>{
    // vista de Nova Kessler ao entardecer, do 80º andar
    const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#1a2450'); gr.addColorStop(.55,'#c88a7a'); gr.addColorStop(.8,'#ffb070'); gr.addColorStop(1,'#6a4a48'); g.fillStyle=gr; g.fillRect(0,0,w,h);
    const sg=g.createRadialGradient(150,128,2,150,128,60); sg.addColorStop(0,'rgba(255,245,220,1)'); sg.addColorStop(1,'rgba(255,160,90,0)'); g.fillStyle=sg; g.fillRect(0,0,w,h);
    g.fillStyle='rgba(90,100,130,.6)'; for(let i=0;i<9;i++){ const x=i*60+Math.random()*30, bw=20+Math.random()*30, bh=40+Math.random()*90; g.fillRect(x,h-bh-20,bw,bh+20); }
    g.fillStyle='#8a8e9a'; g.fillRect(70,0,3,h);                                             // elevador espacial ao longe
    for(let i=0;i<26;i++){ const x=Math.random()*w, bw=14+Math.random()*34, bh=20+Math.random()*70;
      g.fillStyle='#1c1a24'; g.fillRect(x,h-bh,bw,bh);
      for(let k=0;k<10;k++){ g.fillStyle=['#ffd9a0','#a0e8ff','#ff9ad8'][k%3]; g.fillRect(x+2+Math.random()*(bw-4),h-bh+4+Math.random()*(bh-6),2,2); } }
    for(let i=0;i<12;i++){ g.fillStyle=Math.random()<.5?'#ff6040':'#7ff6ff'; g.fillRect(Math.random()*w,20+Math.random()*80,3,1); }
  });
  plane(7.2, 2.3, B(0xffffff,{map:winTex}), .5, 2.25, -D/2+.16, s);
  const frame = M(0x3a3a42);
  box(7.6,.25,.25,frame,.5,3.45,-D/2+.2,s); box(7.6,.25,.25,frame,.5,1.05,-D/2+.2,s);
  box(.25,2.6,.25,frame,-3.2,2.25,-D/2+.2,s); box(.25,2.6,.25,frame,4.2,2.25,-D/2+.2,s); box(.12,2.4,.15,frame,.5,2.25,-D/2+.2,s);
  box(5,.9,.8,M(0x34343c),.5,.45,-D/2+.55,s);
  const leds=[0xff3020,0xffb030,0x40ff80,0x40c0ff];
  for(let i=0;i<14;i++) box(.12,.06,.05,B(leds[i%4]),-1.6+i*.3,.82,-D/2+.96,s);
  // canos
  const copper=M(0x8a5434,{metalness:.5}); const steel=M(0x5a5a62,{metalness:.5});
  [[3.85,-D/2+.35,copper,.09],[3.65,-D/2+.55,steel,.14],[3.9,-D/2+.7,copper,.06],[3.8,D/2-.4,steel,.12]].forEach(([y,z,m,r])=>{ const p=cyl(r,r,W,8,m,0,y,z,s); p.rotation.z=Math.PI/2; });
  [[3.8,-W/2+.35,copper,.08],[3.55,-W/2+.5,steel,.12]].forEach(([y,x,m,r])=>{ const p=cyl(r,r,D,8,m,x,y,0,s); p.rotation.x=Math.PI/2; });
  // parede sul: pôsteres e cabideiro
  const poster = plane(1.2,1.7,B(0xffffff,{map:canvasTex(96,136,(g,w,h)=>{ g.fillStyle='#1a0e22'; g.fillRect(0,0,w,h);
    g.fillStyle='#ff6a3a'; g.beginPath(); g.arc(48,52,30,0,Math.PI*2); g.fill(); g.fillStyle='#1a0e22'; g.fillRect(0,50,w,4); g.fillRect(0,60,w,3);
    g.fillStyle='#ffd27a'; g.font='bold 15px monospace'; g.textAlign='center'; g.fillText('KESSLER',48,108); g.font='10px monospace'; g.fillText('JAZZ CLUB',48,124); })}), -3, 2.2, D/2-.16, s);
  poster.rotation.y = Math.PI;
  const p2 = plane(1.4,.9,B(0xffffff,{map:signTex('PORT 07','#ffb347',192,96,34)}), 2.5, 2.6, D/2-.16, s); p2.rotation.y=Math.PI;
  box(1.6,.9,.5,M(0x3a3632),5,.45,D/2-.4,s);

  // monitores CRT parede oeste
  const radarTex = canvasTex(96,96,()=>{});
  const mapTex = canvasTex(96,96,(g,w,h)=>{ g.fillStyle='#021a08'; g.fillRect(0,0,w,h); g.strokeStyle='#40ff70'; g.lineWidth=1;
    for(let i=0;i<9;i++){ g.beginPath(); g.moveTo(10+i*9,20); g.lineTo(5+i*10,80); g.stroke(); }
    g.beginPath(); for(let i=0;i<12;i++) g.lineTo(15+Math.random()*66,15+Math.random()*66); g.closePath(); g.stroke();
    g.fillStyle='#40ff70'; g.font='10px monospace'; g.fillText('SETOR KESSLER',8,92); });
  const txtTex = canvasTex(96,96,(g,w,h)=>{ g.fillStyle='#04121a'; g.fillRect(0,0,w,h); g.fillStyle='#60d8ff'; g.font='9px monospace';
    ['> SYS OK','> HULL 98%','> NAV.LINK','> CONTRATOS: 3','> ALERTA: PIRATAS','> SETOR MID-SEC','> _'].forEach((l,i)=>g.fillText(l,6,14+i*12)); });
  const ambTex = signTex('BOUNTY', '#ffb347', 128, 96, 24);
  const bezel = M(0x8a8478);
  [[radarTex,1.0,2.6,-3.6],[mapTex,.8,2.9,-2.3],[txtTex,.85,1.75,-2.7],[ambTex,.7,2.2,-1.5]].forEach(([tex,sz,y,z])=>{
    box(.6,sz*.85,sz,bezel,-W/2+.45,y,z,s);
    const sc=plane(sz*.78,sz*.64,B(0xffffff,{map:tex}),-W/2+.76,y+.02,z,s); sc.rotation.y=Math.PI/2;
  });
  hub.radar = radarTex;
  const shelf = new THREE.Group(); shelf.position.set(-7.2,0,-4.1); s.add(shelf);
  box(.6,1.4,1.3,M(0x3a3632),0,.7,0,shelf);
  const vhs=[0x1a1a1a,0x2a2422,0x3a3020,0x22222a];
  for(let r=0;r<3;r++) for(let i=0;i<5;i++) box(.45,.12,.22,M(vhs[(i+r)%4]),.05,.35+r*.4+(i%2)*.12,-.45+i*.22,shelf);
  [[6.6,4.4],[6.9,4.4]].forEach(([x,z])=>cyl(.12,.12,.6,8,M(0xb02020),x,.3,z,s));

  // terminal de dados
  const term = new THREE.Group(); term.position.copy(T_POS); term.rotation.y = Math.PI/2; s.add(term);
  box(1.5,.8,.8,M(0x4a4640),0,.4,0,term);
  box(.85,.7,.7,bezel,0,1.15,-.05,term);
  hub.termTex = canvasTex(128,96,()=>{});
  plane(.68,.5,B(0xffffff,{map:hub.termTex}),0,1.17,.31,term);
  box(.7,.05,.25,M(0x2a2826),0,.82,.25,term);
  const tl = new THREE.PointLight(0xffa040,.6,3); tl.position.set(.6,1.3,0); term.add(tl);

  // elevador
  const el = new THREE.Group(); el.position.set(W/2-.2,0,EL_POS.z); el.rotation.y=-Math.PI/2; s.add(el);
  const hz = canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#5a5a60'; g.fillRect(0,0,w,h); g.fillStyle='#d8a020';
    for(let i=-4;i<8;i++){ g.beginPath(); g.moveTo(i*16,h); g.lineTo(i*16+8,h); g.lineTo(i*16+24,h-16); g.lineTo(i*16+16,h-16); g.fill(); }
    g.fillStyle='#3a3a40'; g.fillRect(31,0,2,h-16); });
  box(.3,3.2,.3,M(0x2a2a30),-1.1,1.6,0,el); box(.3,3.2,.3,M(0x2a2a30),1.1,1.6,0,el); box(2.5,.3,.3,M(0x2a2a30),0,3.2,0,el);
  box(.95,3,.1,M(0xffffff,{map:hz}),-.48,1.5,.05,el); box(.95,3,.1,M(0xffffff,{map:hz}),.48,1.5,.05,el);
  plane(1.6,.42,B(0xffffff,{map:signTex('HANGAR ▸','#ff5a3a')}),0,3.65,.06,el);
  box(.2,.3,.08,M(0x1a1a1a),1.45,1.4,.05,el); box(.08,.08,.05,B(0x40ff60),1.45,1.45,.1,el);

  hub.player = makePilot(); hub.player.position.set(0,0,2.5); s.add(hub.player);
  syncFurniture();
}

// semitransparência do personagem quando a câmera chega perto (ex.: olhando para cima em 3ª pessoa)
function pilotFade(g, camDist){
  const a = clamp((camDist-.9)/2.3, .28, 1);
  if(g.userData.alpha!==undefined && Math.abs(g.userData.alpha-a)<.01) return; g.userData.alpha=a;
  g.traverse(o=>{ if(!o.isMesh) return; const m=o.material; m.transparent = a<1; m.opacity=a; m.depthWrite = a>=1; m.needsUpdate=true; });
}
function makePilot(){
  const g = new THREE.Group();
  const coat=M(0x6b5636), dark=M(0x24242a), skin=M(0xc89a72), hair=M(0x1c1612);
  g.userData.legL = box(.16,.62,.18,dark,-.12,.31,0,g); g.userData.legR = box(.16,.62,.18,dark,.12,.31,0,g);
  [g.userData.legL,g.userData.legR].forEach(l=>{ l.geometry.translate(0,-.31,0); l.position.y=.62; });
  cyl(.3,.44,.95,7,coat,0,1.0,0,g);
  box(.72,.26,.36,coat,0,1.42,0,g);
  box(.3,.2,.26,coat,0,1.6,-.04,g);
  box(.14,.6,.16,coat,-.42,1.15,0,g); box(.14,.6,.16,coat,.42,1.15,0,g);
  const h = new THREE.Mesh(new THREE.IcosahedronGeometry(.2,0), skin); h.position.set(0,1.78,0); g.add(h);
  box(.36,.14,.36,hair,0,1.92,-.03,g);
  box(.22,.06,.04,B(0x5ef2ff),0,1.8,.18,g);
  return g;
}

// móveis — o id do móvel é o id do item no inventário
const FURN = {
  sofa:  { r:1.3, build(){ const g=new THREE.Group(), l=M(0x3a2a24), d=M(0x2a1e1a);
           box(2.4,.45,.9,l,0,.32,0,g); box(2.4,.7,.25,l,0,.8,-.36,g); box(.25,.65,.9,d,-1.2,.45,0,g); box(.25,.65,.9,d,1.2,.45,0,g);
           box(.5,.35,.15,M(0x7a7a5a),.7,.7,-.18,g); box(.3,.25,.02,M(0x6a3a2a),-.5,.56,.1,g); return g; } },
  table: { r:.85, build(){ const g=new THREE.Group(); box(1.4,.08,.8,M(0x5a5a58),0,.45,0,g);
           [[-.6,-.32],[.6,-.32],[-.6,.32],[.6,.32]].forEach(([x,z])=>box(.06,.42,.06,M(0x2a2a2a),x,.21,z,g));
           [[-.3,.1],[.35,-.15]].forEach(([x,z])=>cyl(.06,.06,.12,8,M(0xd8d0c0),x,.55,z,g));
           box(.22,.03,.14,M(0x111111),0,.5,.15,g); box(.22,.03,.14,M(0x1a1a22),.1,.53,-.1,g); return g; } },
  bench: { r:1.1, act:'bench', label:'Bancada de Fabricação', build(){ const g=new THREE.Group();
           box(2,.1,.8,M(0x5a4a3a),0,.9,0,g); box(.6,.85,.75,M(0x3a3a40),-.65,.43,0,g); box(.06,.85,.06,M(0x2a2a2a),.95,.43,.35,g);
           box(2,1.2,.06,M(0x8a8478),0,1.75,-.4,g);
           const tc=[0xb8b8b0,0xd04020,0x40a0d0,0xd8b040];
           for(let i=0;i<9;i++) box(.07,rand(.25,.5),.05,M(tc[i%4],{metalness:.5}),-.8+i*.2,1.75+rand(-.2,.2),-.34,g);
           box(1.8,.05,.1,B(0xfff0c8),0,2.4,-.25,g); box(.3,.15,.2,M(0x406a50),.5,1,.1,g); return g; } },
  arcade:{ r:.65, act:'arcade', label:'Fliperama Neo-Comet', build(){ const g=new THREE.Group();
           box(.8,1.75,.7,M(0x2a1a3a),0,.88,0,g); box(.82,.3,.1,B(0xffffff,{map:signTex('NEO-COMET','#ff4ab0',256,64,32)}),0,1.62,.32,g);
           hub.arcTex = canvasTex(64,64,()=>{}); const sc=plane(.6,.48,B(0xffffff,{map:hub.arcTex}),0,1.2,.37,g); sc.rotation.x=-.25;
           box(.7,.1,.3,M(0x1a1a1a),0,.9,.42,g); cyl(.03,.03,.12,6,M(0xff3040),-.15,1.0,.42,g);
           const pl=new THREE.PointLight(0xff4ab0,.6,3); pl.position.set(0,1.3,.8); g.add(pl); return g; } },
  tape:  { r:.6, act:'tape', label:'Toca-fitas K7', build(){ const g=new THREE.Group();
           box(.8,.6,.6,M(0x3a3632),0,.3,0,g); box(.7,.28,.4,M(0xb8b0a0),0,.74,0,g); box(.5,.14,.05,M(0x1a1a1a),0,.76,.2,g);
           [-.12,.12].forEach(x=>{ const r=cyl(.05,.05,.03,10,M(0xe8e0d0),x,.76,.22,g); r.rotation.x=Math.PI/2; });
           hub.tapeLed = box(.05,.05,.02,B(0x502010),.28,.82,.21,g);
           box(.16,.22,.12,M(0x2a2a2a),-.45,.95,0,g); box(.16,.22,.12,M(0x2a2a2a),.45,.95,0,g); return g; } },
};
function syncFurniture(){
  for(const id in FURN){
    const L = state.placed[id];
    if(L && !hub.furn[id]){ hub.furn[id]=FURN[id].build(); hub.scene.add(hub.furn[id]); }
    if(!L && hub.furn[id]){ hub.scene.remove(hub.furn[id]); delete hub.furn[id]; if(id==='tape') hub.tapeLed=null; if(id==='arcade') hub.arcTex=null; if(hub.carry===id) hub.carry=null; continue; }
    if(L && hub.carry!==id){ hub.furn[id].position.set(L.x,0,L.z); hub.furn[id].rotation.y=L.r; }
  }
}
function placeFromInventory(id){
  const p=hub.player, r=FURN[id].r+.8, {W,D}=ROOM;
  addItem(id,-1);
  state.placed[id] = { x:clamp(p.position.x+Math.sin(p.rotation.y)*r,-W/2+1,W/2-1), z:clamp(p.position.z+Math.cos(p.rotation.y)*r,-D/2+1.2,D/2-1), r:p.rotation.y+Math.PI };
  syncFurniture(); save();
}
function storeFurniture(id){
  if(id==='tape' && music.on) musicToggle();
  delete state.placed[id]; addItem(id,1); syncFurniture(); save();
}

function hubInteractables(){
  const list = [ { id:'terminal', pos:T_POS, label:'[E] Terminal de Dados — contratos' }, { id:'elevator', pos:EL_POS, label:'[E] Elevador → Térreo (rua)' } ];
  for(const id in hub.furn){ const f=FURN[id]; if(f.act && hub.carry!==id) list.push({ id:f.act, pos:hub.furn[id].position,
      label: f.act==='tape' ? `[E] ${music.on?'Parar':'Tocar'} fita` : `[E] ${f.label}` }); }
  return list;
}

const _cf=new V3(), _ct=new V3();
function updateHub(dt, t){
  const p = hub.player;
  let mx=0, mz=0;
  if(!ui.panel){
    if(keys.KeyW||keys.ArrowUp) mz+=1; if(keys.KeyS||keys.ArrowDown) mz-=1;
    if(keys.KeyA||keys.ArrowLeft) mx-=1; if(keys.KeyD||keys.ArrowRight) mx+=1;
  }
  // movimento relativo à câmera
  const fx=-Math.sin(hub.yaw), fz=-Math.cos(hub.yaw), rx=Math.cos(hub.yaw), rz=-Math.sin(hub.yaw);
  let vx = fx*mz + rx*mx, vz = fz*mz + rz*mx;
  const len = Math.hypot(vx,vz);
  if(len>0){
    vx/=len; vz/=len; const sp=(keys.ShiftLeft?6.4:4)*dt;
    p.position.x += vx*sp; p.position.z += vz*sp;
    p.rotation.y = lerpAngle(p.rotation.y, Math.atan2(vx,vz), Math.min(1, 12*dt));
    hub.walk += dt*(keys.ShiftLeft?14:10);
  } else hub.walk *= .85;
  const sw = Math.sin(hub.walk)*.6*(len>0?1:0);
  p.userData.legL.rotation.x = sw; p.userData.legR.rotation.x = -sw;
  const { W, D, H } = ROOM;
  p.position.x = clamp(p.position.x, -W/2+.5, W/2-.5); p.position.z = clamp(p.position.z, -D/2+1.1, D/2-.5);
  const solids = [ [T_POS.x, T_POS.z, .9], [-7.2,-4.1,.8], [5,D/2-.4,.7] ];
  for(const id in hub.furn) if(hub.carry!==id) solids.push([hub.furn[id].position.x, hub.furn[id].position.z, FURN[id].r]);
  for(const [x,z,r] of solids){ const dx=p.position.x-x, dz=p.position.z-z, d=Math.hypot(dx,dz), m=r+.35;
    if(d<m && d>1e-4){ p.position.x = x+dx/d*m; p.position.z = z+dz/d*m; } }
  if(hub.carry){
    const o=hub.furn[hub.carry], r=FURN[hub.carry].r+.55;
    o.position.set(p.position.x+Math.sin(p.rotation.y)*r, .25+Math.sin(t*6)*.04, p.position.z+Math.cos(p.rotation.y)*r);
    o.rotation.y = lerpAngle(o.rotation.y, hub.carryRot, .2);
  }
  // câmera orbital em 3ª pessoa (mouse), presa dentro do cômodo
  _cf.set(Math.sin(hub.yaw)*Math.cos(hub.pitch), Math.sin(hub.pitch), Math.cos(hub.yaw)*Math.cos(hub.pitch));
  p.visible = !settings.fp;
  if(settings.fp){
    // 1ª pessoa: câmera nos olhos, corpo acompanha a visão
    const bob = Math.sin(hub.walk*2)*.03*(len>0?1:0);
    hub.cam.position.set(p.position.x, 1.72+bob, p.position.z);
    hub.cam.lookAt(p.position.x-_cf.x, 1.72+bob-_cf.y, p.position.z-_cf.z);
    p.rotation.y = hub.yaw+Math.PI;
  } else {
  _ct.set(p.position.x, 1.55, p.position.z);
  let d = hub.dist;
  for(; d>.6; d-=.05){ const x=_ct.x+_cf.x*d, y=_ct.y+_cf.y*d, z=_ct.z+_cf.z*d;
    if(x>-W/2+.3 && x<W/2-.3 && z>-D/2+.3 && z<D/2-.3 && y>.25 && y<H-.25) break; }
  hub.cam.position.set(_ct.x+_cf.x*d, _ct.y+_cf.y*d, _ct.z+_cf.z*d);
  hub.cam.lookAt(_ct);
  pilotFade(p, d);
  }
  animateHubScreens(t);
  let best=null, bd=1.9;
  for(const it of hubInteractables()){ const dd=Math.hypot(it.pos.x-p.position.x, it.pos.z-p.position.z); if(dd<bd){ bd=dd; best=it; } }
  hub.near = best;
  let pr = best ? best.label : '';
  if(hub.carry) pr = '[G] Posicionar  ·  [R] Girar';
  else if(!best && nearestMovable()) pr = '[G] Mover móvel';
  setPrompt(ui.panel ? '' : pr);
}
function nearestMovable(){
  const p=hub.player.position; let best=null, bd=99;
  for(const id in hub.furn){ const o=hub.furn[id], d=Math.hypot(o.position.x-p.x,o.position.z-p.z)-FURN[id].r; if(d<bd){bd=d;best=id;} }
  return bd<1.1 ? best : null;
}
let scrT=0;
function animateHubScreens(t){
  hub.fluor.intensity = Math.random()<.015 ? .1 : .8;
  if(t-scrT < .08) return; scrT=t;
  { const {g}=hub.radar.userData, w=96, a=t*2;
    g.fillStyle='rgba(26,12,0,.35)'; g.fillRect(0,0,w,w); g.strokeStyle='#ff9a30'; g.lineWidth=1;
    [14,28,42].forEach(r=>{ g.beginPath(); g.arc(48,48,r,0,Math.PI*2); g.stroke(); });
    g.beginPath(); g.moveTo(48,48); g.lineTo(48+Math.cos(a)*44,48+Math.sin(a)*44); g.stroke();
    if(Math.random()<.2){ g.fillStyle='#ffd080'; g.fillRect(20+Math.random()*56,20+Math.random()*56,3,3); }
    hub.radar.needsUpdate=true; }
  { const {g}=hub.termTex.userData; g.fillStyle='#160c02'; g.fillRect(0,0,128,96); g.fillStyle='#ffb347'; g.font='11px monospace';
    ['KESSLER/APT-07', '----------------', `CR: ${state.credits}`, `SUCATA: ${qty('scrap')}`, '> CONTRATOS [Q]', '> LOJA [P]', '> INVENT. [I]'+(Math.floor(t*2)%2?'_':'')]
      .forEach((l,i)=>g.fillText(l,6,13+i*12)); hub.termTex.needsUpdate=true; }
  if(hub.arcTex){ const {g}=hub.arcTex.userData; g.fillStyle='#05020a'; g.fillRect(0,0,64,64);
    for(let i=0;i<14;i++){ g.fillStyle=['#ff4ab0','#5ef2ff','#ffd040'][i%3]; g.fillRect((i*37+t*40)%64,(i*23+t*25*(i%3+1))%64,2,2); }
    g.fillStyle='#5ef2ff'; g.fillRect(28+Math.sin(t*3)*16,54,8,4); hub.arcTex.needsUpdate=true; }
  if(hub.tapeLed) hub.tapeLed.material.color.setHex(music.on ? (Math.floor(t*4)%2?0xff5020:0xffa040) : 0x401808);
}
function hubInteract(){
  if(hub.carry || !hub.near) return;
  const id = hub.near.id;
  if(id==='terminal') openPanel('contracts');
  else if(id==='elevator') goCity('home');
  else if(id==='tape'){ const on=musicToggle(); toast(on?'♪ Fita: "Blues de Órbita Baixa" — lado A':'■ Fita pausada', '#ffb347'); }
  else if(id==='arcade') toast('NEO-COMET · RECORDE 48.210 — "insira ficha" (em breve)', '#ff4ab0');
  else if(id==='bench') openPanel('craft');
}
function hubCarry(){
  if(hub.carry){
    const id=hub.carry, o=hub.furn[id], {W,D}=ROOM, r=FURN[id].r;
    o.position.x = clamp(o.position.x, -W/2+r*.6, W/2-r*.6); o.position.z = clamp(o.position.z, -D/2+1+r*.4, D/2-r*.6); o.position.y = 0;
    o.rotation.y = hub.carryRot;
    state.placed[id] = { x:o.position.x, z:o.position.z, r:hub.carryRot }; hub.carry=null; save(); sfx.ui();
    return;
  }
  const id = nearestMovable(); if(!id) return;
  hub.carry=id; hub.carryRot=hub.furn[id].rotation.y; sfx.ui();
}

