'use strict';
/* Viagem entre planetas: troca do planeta ativo (setPlanet), postos avançados dos planetas selvagens
   e texturas dos planetas vistas da órbita. */

const OUTPOST_PAD = new V3(62,0,0);                      // plataforma de pouso dos postos (coordenadas locais = mundo: o posto fica no topo)
const OUTPOST_SPAWN = new V3(0,.2,26);

// ---------------------------------------------------------------- troca de planeta
function setPlanet(id){
  const def=PLANETS[id]; if(!def || def===CUR_P) return false;
  // desfaz tudo o que pertence ao planeta antigo
  if(work.job) cancelJob(true);
  despawnBounty(); clearWanted(); city.mining=null; document.getElementById('minebar').style.display='none';
  [...combat.enemies].forEach(removeEnemy);
  for(const c of combat.camps) if(c.g) city.scene.remove(c.g);
  combat.camps=[]; combat.turfs.forEach(t=>{ t.spawned=false; t.ents=[]; }); combat.hostile={};
  for(const ch of chunks.values()) if(ch.group){ ch.group.traverse(o=>{ if(o.isMesh && o.geometry) o.geometry.dispose(); }); city.scene.remove(ch.group); }
  chunks.clear(); chunkT=-1;
  for(const m of [planet.mesh, planet.ocean, sky.clouds]) if(m){ city.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  for(const s of SITES) if(s.group) city.scene.remove(s.group);
  for(const vid in city.vehicles) city.scene.remove(city.vehicles[vid].g);
  city.vehicles={}; city.drive=null;
  if(city.ship){ city.scene.remove(city.ship.g); city.ship=null; city.shipModel=null; }
  // monta o novo planeta
  usePlanetParams(def);
  applySky(); buildPlanet(city.scene); buildClouds(city.scene);
  for(const s of SITES){ if(s.group) city.scene.add(s.group); else if(s.outpost) buildOutpost(s); else buildSite(s); }
  initCamps();
  if(typeof applyFlightPlanet==='function') applyFlightPlanet();
  return true;
}

// ---------------------------------------------------------------- pouso vindo da órbita (sem portão)
function landFromOrbit(tg){
  const lift=shipLift(activeShip().model);
  let site=tg.site, pad=tg.pad;
  if(!pad){                                               // ponto do solo logo abaixo; dentro de uma cidade, usa a plataforma dela
    const r=groundR(tg.dir), p=PC.clone().addScaledVector(tg.dir, r), s=siteAt(p,200);
    if(s && s.pads.length){ site=s; pad=s.pads.reduce((a,b)=>{ const l=toLocal(s,p,new V3()); return Math.hypot(a.x-l.x,a.z-l.z)<Math.hypot(b.x-l.x,b.z-l.z)?a:b; }); }
    else if(r < seaR()+1){ enterCity({ reentryDir:tg.dir }); toast(`Sem solo firme aqui — pilote até a terra e pouse com [E]`, '#ff7a3a'); return; }
    else {
      const up=surfaceUp(tg.dir,new V3()), q=new THREE.Quaternion().setFromUnitVectors(Y_AXIS, up);
      state.ship={ p:PC.clone().addScaledVector(tg.dir, r+lift).toArray(), q:q.toArray(), up:up.toArray(), yaw:0, pad:null }; state.shipLoc=CUR_P.id; save();
      enterCity({ ground:true }); toast(`Pouso concluído · ${CUR_P.name} · ${biomeName(biomeOf(tg.dir, r-PLANET.R))}`, '#7dff9a'); return;
    }
  }
  const p=toWorld(site, new V3(pad.x, lift, pad.z), new V3());
  state.ship={ p:p.toArray(), q:site.group.quaternion.toArray(), up:site.up.toArray(), yaw:Math.PI/2, pad:pad.name }; state.shipLoc=CUR_P.id; save();
  enterCity({ site, pad }); toast(`Pouso automático concluído — ${pad.name}`, '#7dff9a');
}

// ---------------------------------------------------------------- postos avançados (planetas selvagens)
const OUTPOST_STALLS = [
  { name:'MERCADOR',  color:'#5affc8', act:['shop','sell'], actLabel:'vender minérios e recursos' },
  { name:'CANTINA DO POSTO', color:'#ffb347' },
  { name:'ARMEIRO',   color:'#ff6a5a', act:['shop','weapons'], actLabel:'armas e munição' },
  { name:'REFINARIA', color:'#ffd040', act:['craft'], actLabel:'bancada de fabricação' },
  { name:'ENFERMARIA',color:'#7dff9a' },
  { name:'FERRAMENTAS', color:'#ffd040', act:['shop','tools'], actLabel:'picaretas, furadeiras e lasers' },
];
MENUS['CANTINA DO POSTO'] = ['ramen','barra','cafe','agua'];
MENUS['ENFERMARIA'] = ['kit','agua'];
function buildOutpost(site){
  S = site;
  site.group = new THREE.Group(); site.group.position.copy(site.center); site.group.quaternion.setFromUnitVectors(Y_AXIS, site.up);
  city.scene.add(site.group); site.group.updateMatrixWorld(true);
  site.mat = site.group.matrixWorld.clone(); site.inv = site.mat.clone().invert();
  Object.assign(site, { boxes:[], circles:[], shops:[], npcs:[], traffic:[], air:[], anim:[], pads:[], grid:new Map(), ext:0, N:0, spawn:OUTPOST_SPAWN.clone() });
  crngState = site.id.length*977+13;
  const MAT=city.mat, G=site.group, P=site.paved, hot=site.outpost==='brasa';
  const hull = M(hot?0x7a6a5a:0xc8d0d8,{metalness:.35}), trim = M(hot?0x3a2a24:0x3a4a5a), glow = B(hot?0xff8a3a:0x8ae8ff);
  // chão de concreto e plataformas
  const floorTex = canvasTex(128,128,(g,w,h)=>{ g.fillStyle=hot?'#4a4440':'#7a8088'; g.fillRect(0,0,w,h); g.strokeStyle=hot?'#3a3430':'#5a6068'; g.lineWidth=2;
    for(let i=0;i<=4;i++){ g.beginPath(); g.moveTo(i*32,0); g.lineTo(i*32,h); g.stroke(); g.beginPath(); g.moveTo(0,i*32); g.lineTo(w,i*32); g.stroke(); }
    for(let i=0;i<90;i++){ g.fillStyle=`rgba(0,0,0,${Math.random()*.2})`; g.fillRect(Math.random()*w,Math.random()*h,rand(2,10),rand(2,10)); } });
  floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping; floorTex.repeat.set(P/16,P/16);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2*P,2*P), M(0xffffff,{map:floorTex, flatShading:false})); floor.rotation.x=-Math.PI/2; floor.position.y=-.05; G.add(floor);
  addPad(OUTPOST_PAD.x, OUTPOST_PAD.z, 36, 'P1', `${site.name} · Plataforma 1`);
  addPad(OUTPOST_PAD.x, -58, 30, 'P2', `${site.name} · Plataforma 2`);
  for(const [x,z] of [[OUTPOST_PAD.x-18,-18],[OUTPOST_PAD.x+18,-18],[OUTPOST_PAD.x-18,18],[OUTPOST_PAD.x+18,18]]){
    cityBatch.add(MAT.metal, gCyl(.15,.2,4,6), x,2,z); cityBatch.add(glow, gBox(.6,.6,.6), x,4.2,z); site.circles.push({x,z,r:.3}); }
  // módulo habitacional principal (cúpula + corpo)
  const hab = (x,z,w,d,h)=>{ cityBatch.add(hull, gBox(w,h,d), x,h/2,z); cityBatch.add(trim, gBox(w+.4,.5,d+.4), x,h,z); cityBatch.add(trim, gBox(w+.4,.6,d+.4), x,.3,z);
    for(let k=-1;k<=1;k++) cityBatch.add(glow, gBox(w*.18,.5,.1), x+k*w*.28, h*.62, z+d/2+.06);
    site.boxes.push({ x0:x-w/2-.2, x1:x+w/2+.2, z0:z-d/2-.2, z1:z+d/2+.2, h }); };
  hab(-34,-22,30,16,9); hab(-6,-40,16,12,7); hab(-58,8,12,22,7);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9,16,8,0,Math.PI*2,0,Math.PI/2), M(hot?0x8a5a3a:0x9ad8f0,{metalness:.5,roughness:.2,transparent:true,opacity:.75}));
  dome.position.set(-34,9,-22); G.add(dome);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(18,2.6), B(0xffffff,{map:citySign(site.name, site.color, 512, 72)}));
  sign.position.set(-34,6.6,-13.8); G.add(sign);
  // tanques, antena e caixas
  for(let k=0;k<3;k++){ const x=34+k*11, z=-46; cityBatch.add(MAT.tank, gCyl(4,4,11,12), x,5.5,z); cityBatch.add(hot?MAT.rust:MAT.yellow, gCyl(4.05,4.05,.8,12), x,7.5,z); site.circles.push({x,z,r:4.2}); }
  cityBatch.add(MAT.metal, gCyl(.5,.9,34,6), -70,17,-40); site.circles.push({x:-70,z:-40,r:1});
  const tip = box(1.2,1.2,1.2, B(0xff2a1a), -70,34.6,-40, G); site.anim.push(t=>{ tip.visible = Math.floor(t*1.5)%2===0; });
  const dish=new THREE.Group(); dish.position.set(-70,30,-40); const dd=cyl(4,.5,1.2,10,MAT.white); dd.rotation.x=Math.PI/2.6; dish.add(dd); G.add(dish);
  site.anim.push((t,dt)=>{ dish.rotation.y+=dt*.5; });
  for(let k=0;k<9;k++){ const x=cr(-80,-40), z=cr(30,60), s=cr(1.2,2.2); cityBatch.add(k%2?MAT.rust:trim, gBox(s,s,s), x,s/2,z); site.boxes.push({x0:x-s/2,x1:x+s/2,z0:z-s/2,z1:z+s/2,h:s}); }
  // balcões (lojas) em semicírculo diante do módulo principal
  OUTPOST_STALLS.forEach((f,i)=>{ const a=-1.05+i*.42, r=30, x=-34+Math.sin(a)*r, z=-22+Math.cos(a)*r;
    addStall(f.name, f.color, x, z, a); Object.assign(site.shops[site.shops.length-1], f);
    const n=makeNPC(['human','oskari','vexari'][i%3]); n.position.set(x-Math.sin(a)*.6,0,z-Math.cos(a)*.6); n.rotation.y=a; G.add(n); });
  // luzes
  for(const [x,z,c] of [[-34,-4,hot?0xffa060:0x9ad8ff],[OUTPOST_PAD.x,0,0xfff0d0],[0,30,hot?0xff7a3a:0x7ac8ff]]){ const l=new THREE.PointLight(c,1.3,70); l.position.set(x,14,z); G.add(l); }
  // cerca do perímetro
  for(let k=-P;k<=P;k+=12) for(const [x,z] of [[k,-P],[k,P],[-P,k],[P,k]]) cityBatch.add(trim, gBox(.4,2.4,.4), x,1.2,z);
  cityBatch.build(G); indexBoxes(site); buildOutpostMap(site);
}
function buildOutpostMap(site){
  const SZ=700, sc=SZ/1400, c=document.createElement('canvas'); c.width=c.height=SZ; const g=c.getContext('2d'), X=x=>(x+700)*sc, hot=site.outpost==='brasa';
  g.fillStyle=hot?'#2a1e1a':'#3a4658'; g.fillRect(0,0,SZ,SZ);
  g.fillStyle=hot?'#4a4440':'#7a8088'; g.fillRect(X(-site.paved),X(-site.paved),2*site.paved*sc,2*site.paved*sc);
  g.fillStyle=hot?'#8a6a5a':'#c8d0d8'; for(const b of site.boxes) g.fillRect(X(b.x0),X(b.z0),Math.max(2,(b.x1-b.x0)*sc),Math.max(2,(b.z1-b.z0)*sc));
  g.fillStyle='#e8c040'; for(const p of site.pads){ g.beginPath(); g.arc(X(p.x),X(p.z),14*sc,0,Math.PI*2); g.fill(); }
  site.mapCanvas=c;
}

// ---------------------------------------------------------------- planetas vistos da órbita
const orbitTex = {};
function planetOrbitTexture(id){
  if(orbitTex[id]) return orbitTex[id];
  if(id==='aurora') return orbitTex[id]=auroraTexture();
  if(id==='cinzar') return orbitTex[id]=canvasTex(1024,512,(g,w,h)=>{
    g.fillStyle='#2a2422'; g.fillRect(0,0,w,h);
    for(let i=0;i<60;i++){ const x=Math.random()*w, y=Math.random()*h, r=rand(20,80); g.fillStyle=['#3a3230','#4a3a34','#5a3a2a','#1e1a1c'][i%4];
      g.beginPath(); for(let a=0;a<6.3;a+=.5){ const rr=r*rand(.6,1.2); g.lineTo(x+Math.cos(a)*rr*1.6, y+Math.sin(a)*rr); } g.fill(); }
    g.strokeStyle='#ff6a1a'; g.shadowColor='#ff4a00'; g.shadowBlur=8;
    for(let i=0;i<40;i++){ g.lineWidth=rand(1,3); g.beginPath(); let x=Math.random()*w, y=Math.random()*h; g.moveTo(x,y); for(let k=0;k<8;k++){ x+=rand(-40,40); y+=rand(-20,20); g.lineTo(x,y); } g.stroke(); }
    g.shadowBlur=0; for(let i=0;i<14;i++){ g.fillStyle='rgba(255,110,30,.85)'; g.beginPath(); g.ellipse(Math.random()*w,Math.random()*h,rand(10,40),rand(5,15),0,0,Math.PI*2); g.fill(); }
    for(let i=0;i<50;i++){ g.fillStyle='rgba(60,50,46,.55)'; g.beginPath(); g.ellipse(Math.random()*w,Math.random()*h,rand(20,90),rand(4,14),rand(-.3,.3),0,Math.PI*2); g.fill(); }
  });
  return orbitTex[id]=canvasTex(1024,512,(g,w,h)=>{
    g.fillStyle='#c8dcec'; g.fillRect(0,0,w,h);
    for(let i=0;i<70;i++){ g.fillStyle=['#e8f2fa','#a8c8e0','#8ab0d0','#f4f8fc','#5a6a7a'][i%5]; g.beginPath(); g.ellipse(Math.random()*w,Math.random()*h,rand(15,90),rand(8,40),rand(0,3),0,Math.PI*2); g.fill(); }
    g.strokeStyle='rgba(60,90,130,.6)'; for(let i=0;i<60;i++){ g.lineWidth=rand(.5,2); g.beginPath(); let x=Math.random()*w, y=Math.random()*h; g.moveTo(x,y); for(let k=0;k<5;k++){ x+=rand(-50,50); y+=rand(-25,25); g.lineTo(x,y); } g.stroke(); }
    for(let i=0;i<20;i++){ g.fillStyle='rgba(40,60,100,.5)'; g.beginPath(); g.arc(Math.random()*w,Math.random()*h,rand(4,14),0,Math.PI*2); g.fill(); }
  });
}
