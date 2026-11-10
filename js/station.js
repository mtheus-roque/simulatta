'use strict';
/* Estação Beta: interior andável (hangar de atracação, corredor e promenade) com serviços:
   reparo de casco, oficina de módulos, mercado orbital, contratos, cantina, refino e o terminal de navegação (saltos entre planetas). */

const stn = { scene:new THREE.Scene(), cam:new THREE.PerspectiveCamera(65, innerWidth/innerHeight, .05, 4000),
  yaw:Math.PI, pitch:.25, walk:0, near:null, npcs:[], built:false };
// áreas andáveis (retângulos com altura de teto)
const STN_AREAS = [
  { x0:-14, x1:14, z0:-10, z1:14, h:12 },        // hangar de atracação (baía 3)
  { x0:-2.6, x1:2.6, z0:-22.2, z1:-9.8, h:4.2 }, // corredor pressurizado
  { x0:-20, x1:20, z0:-36, z1:-22, h:7 },        // promenade (janelões para Aurora)
];
const STN_SHIP = new V3(0,0,3);
const STN_MARKET = { name:'ESTAÇÃO BETA', market:{ 'MINÉRIO':1.3, MATERIAL:1.2, RECURSO:.9, 'MÓDULO':1, CARGA:1 } };
MENUS['CANTINA ORBITAL'] = ['ramen','noodles','cafe','barra','agua'];
const STN_SPOTS = [
  { id:'repair', pos:new V3(-12.4,0,2),   label:'[E] Reparos de Casco — consertar a nave',          fn:()=>openPanel('station','repair'), sign:'REPAROS', color:'#7dff9a', face:Math.PI/2 },
  { id:'garage', pos:new V3(12.4,0,2),    label:'[E] Oficina de Naves — instalar módulos',           fn:()=>openPanel('inv','garage'),     sign:'OFICINA', color:'#5ef2ff', face:-Math.PI/2 },
  { id:'nav',    pos:new V3(-18.4,0,-29), label:'[E] Terminal de Navegação — saltar a outro planeta', fn:()=>openPanel('nav'),              sign:'NAVEGAÇÃO', color:'#d07aff', face:Math.PI/2 },
  { id:'market', pos:new V3(-10,0,-32.8), label:'[E] Mercado Orbital — suprimentos e vendas',         fn:()=>openPanel('station','supply'), sign:'MERCADO ORBITAL', color:'#ffd040', face:0 },
  { id:'craft',  pos:new V3(18.4,0,-29),  label:'[E] Laboratório de Refino — bancada de fabricação',  fn:()=>openPanel('craft'),            sign:'REFINO', color:'#ff9a5a', face:-Math.PI/2 },
  { id:'jobs',   pos:new V3(-10,0,-23.6), label:'[E] Quadro de Contratos Orbitais',                   fn:()=>openPanel('contracts','orbit'), sign:'CONTRATOS', color:'#7dff9a', face:Math.PI },
  { id:'food',   pos:new V3(10,0,-23.6),  label:'[E] Cantina Orbital — comer',                         fn:()=>openFood('CANTINA ORBITAL'),  sign:'CANTINA', color:'#ffb347', face:Math.PI },
  { id:'view',   pos:new V3(10,0,-32.8),  label:'[E] Observatório — mapa estelar',                     fn:()=>openPanel('nav'),              sign:'OBSERVATÓRIO', color:'#5ef2ff', face:0 },
];

function buildStation(){
  if(stn.built) return; stn.built=true;
  const s=stn.scene;
  s.background=new THREE.Color(0x020208); s.fog=new THREE.Fog(0x020208, 60, 900);
  s.add(new THREE.AmbientLight(0x6a6a88, .55)); s.add(new THREE.HemisphereLight(0x9ab0ff, 0x2a2018, .35));
  // lá fora: estrelas e o planeta
  const sp=[]; for(let i=0;i<1600;i++){ const v=new V3(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(1800); sp.push(v.x,v.y,v.z); }
  const sg=new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
  s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color:0xffffff, size:2, sizeAttenuation:false, fog:false })));
  stn.planet = new THREE.Mesh(new THREE.SphereGeometry(700,48,32), M(0xffffff,{map:planetOrbitTexture('aurora'), fog:false, flatShading:false, roughness:.7}));
  stn.planet.position.set(0,-640,-480); stn.planet.rotation.x=Math.PI/2; s.add(stn.planet);
  const atmo=new THREE.Mesh(new THREE.SphereGeometry(735,48,32), B(0x6ab4ff,{transparent:true,opacity:.2,side:THREE.BackSide,blending:THREE.AdditiveBlending,fog:false,depthWrite:false}));
  atmo.position.copy(stn.planet.position); s.add(atmo);
  const sun=new THREE.DirectionalLight(0xffc49a,.8); sun.position.set(-1,.4,-1); s.add(sun);

  const panelTex = canvasTex(256,256,(g,w,h)=>{ g.fillStyle='#3a3c44'; g.fillRect(0,0,w,h);
    for(let i=0;i<4;i++) for(let j=0;j<4;j++){ const v=70+Math.random()*16; g.fillStyle=`rgb(${v},${v+2},${v+10})`; g.fillRect(i*64+2,j*64+2,60,60);
      g.fillStyle='#2a2c34'; [[6,6],[56,6],[6,56],[56,56]].forEach(([a,b])=>g.fillRect(i*64+a,j*64+b,3,3)); }
    g.fillStyle='rgba(216,160,32,.6)'; g.fillRect(0,236,w,6); });
  panelTex.wrapS=panelTex.wrapT=THREE.RepeatWrapping;
  const floorTex = canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#22242a'; g.fillRect(0,0,w,h); g.strokeStyle='#33363e'; g.lineWidth=2;
    for(let i=0;i<=4;i++){ g.beginPath(); g.moveTo(i*32,0); g.lineTo(i*32,h); g.stroke(); g.beginPath(); g.moveTo(0,i*32); g.lineTo(w,i*32); g.stroke(); }
    for(let k=0;k<50;k++){ g.fillStyle=`rgba(0,0,0,${Math.random()*.3})`; g.fillRect(Math.random()*w,Math.random()*h,rand(2,10),rand(2,10)); } });
  floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;
  const wallM = (len,h)=>{ const t=panelTex.clone(); t.needsUpdate=true; t.repeat.set(Math.max(1,len/4),Math.max(1,h/4)); return M(0xffffff,{map:t}); };
  const dark=M(0x1e2026), trim=M(0x4a4c56,{metalness:.5}), yel=M(0xd8a020), glass=B(0x9ad8ff,{transparent:true,opacity:.08,side:THREE.DoubleSide,depthWrite:false});
  // pisos e tetos
  for(const a of STN_AREAS){ const w=a.x1-a.x0, d=a.z1-a.z0, cx=(a.x0+a.x1)/2, cz=(a.z0+a.z1)/2;
    const ft=floorTex.clone(); ft.needsUpdate=true; ft.repeat.set(w/4,d/4); box(w,.2,d,M(0xffffff,{map:ft}),cx,-.1,cz,s);
    box(w,.3,d,dark,cx,a.h+.15,cz,s);
    for(let x=a.x0+3;x<a.x1-1;x+=6) box(1.4,.06,.4,B(0xe8f0ff),x,a.h-.03,cz,s); }
  // paredes: wall(x0,z0,x1,z1,h,gap=[a,b])
  const wall=(x0,z0,x1,z1,h,gap)=>{ const alongX=z0===z1, L=alongX?x1-x0:z1-z0, a0=alongX?x0:z0;
    const segs = gap ? [[a0,gap[0]],[gap[1],a0+L]] : [[a0,a0+L]];
    for(const [p,q] of segs){ if(q-p<.05) continue; const m=(p+q)/2, len=q-p;
      if(alongX) box(len,h,.3,wallM(len,h),m,h/2,z0,s); else box(.3,h,len,wallM(len,h),x0,h/2,m,s); }
    if(gap){ const m=(gap[0]+gap[1])/2, len=gap[1]-gap[0], top=h-4.2; if(top>.05){ if(alongX) box(len,top,.3,wallM(len,top),m,4.2+top/2,z0,s); else box(.3,top,len,wallM(len,top),x0,4.2+top/2,m,s); } } };
  // hangar
  wall(-14,-10,14,-10,12,[-2.6,2.6]); wall(-14,-10,-14,14,12); wall(14,-10,14,14,12);
  box(28,3,.4,trim,0,10.5,14,s); box(.6,12,.6,yel,-14,6,14,s); box(.6,12,.6,yel,14,6,14,s);
  const field=plane(28,9,B(0x5ef2ff,{transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),0,4.5,14,s);
  stn.field=field;
  for(let x=-12;x<=12;x+=3) box(1.2,.05,.25,yel,x,.02,12.5,s);
  const padT = canvasTex(256,256,(g)=>{ g.fillStyle='#2e3036'; g.fillRect(0,0,256,256); g.strokeStyle='#e8c040'; g.lineWidth=8; g.beginPath(); g.arc(128,128,110,0,Math.PI*2); g.stroke();
    g.fillStyle='#e8c040'; g.font='bold 90px "Courier New",monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('B3',128,132); });
  plane(16,16,M(0xffffff,{map:padT,flatShading:false}),STN_SHIP.x,.02,STN_SHIP.z,s).rotation.x=-Math.PI/2;
  for(const x of [-9,9]){ cyl(1.2,1.4,6,10,trim,x,3,-7,s); box(.4,.4,.4,B(0xff5a2a),x,6.3,-7,s); }
  const bs=plane(10,1.4,B(0xffffff,{map:signTex('BAÍA 3 · ESTAÇÃO BETA','#ffb347',512,72,34)}),0,6,-9.8,s);
  const hl=new THREE.PointLight(0xfff0d8,1.2,40); hl.position.set(0,10,2); s.add(hl);
  // corredor
  wall(-2.6,-22,-2.6,-10,4.2); wall(2.6,-22,2.6,-10,4.2);
  for(let z=-20;z<=-12;z+=4){ box(.1,.08,1.6,B(0x5ef2ff),-2.4,3.9,z,s); box(.1,.08,1.6,B(0x5ef2ff),2.4,3.9,z,s); }
  // promenade com janelões
  wall(-20,-22,20,-22,7,[-2.6,2.6]); wall(-20,-36,-20,-22,7); wall(20,-36,20,-22,7);
  box(40,1.2,.4,wallM(40,1.2),0,.6,-36,s); box(40,1.2,.4,trim,0,6.4,-36,s);
  plane(40,4.6,glass,0,3.5,-36,s);
  for(let x=-20;x<=20;x+=5) box(.35,7,.45,trim,x,3.5,-36,s);
  for(let x=-16;x<=16;x+=8) box(3,.5,1,M(0x3a2a24),x,.25,-31,s);                     // bancos voltados para a janela
  const pl=new THREE.PointLight(0xffd8a8,1,30); pl.position.set(0,5.5,-29); s.add(pl);
  const pl2=new THREE.PointLight(0x8ab4ff,.8,30); pl2.position.set(-14,5.5,-29); s.add(pl2);
  // balcões de serviço
  for(const sp of STN_SPOTS){
    const g=new THREE.Group(); g.position.copy(sp.pos); g.rotation.y=sp.face; s.add(g);
    box(3.2,1.1,1,M(0x3a3c44,{metalness:.4}),0,.55,-.9,g); box(3.3,.08,1.1,M(0x8a8478),0,1.12,-.9,g);
    box(1.1,.75,.1,B(0x0a1a12),0,1.6,-1.25,g); box(.9,.55,.02,B(new THREE.Color(sp.color).multiplyScalar(.6)),0,1.6,-1.19,g);
    const sg=plane(3.2,.7,B(0xffffff,{map:signTex(sp.sign,sp.color,256,56,26)}),0,2.7,-1.4,g);
    const n=makeNPC(['vexari','human','oskari'][STN_SPOTS.indexOf(sp)%3]); n.position.set(.6,0,-1.9); g.add(n);
    const l=new THREE.PointLight(new THREE.Color(sp.color),.5,6); l.position.set(0,2.2,-.2); g.add(l);
    sp.solid = sp.pos.clone().add(new V3(0,0,-.9).applyAxisAngle(Y_AXIS, sp.face));
  }
  // visitantes andando pela promenade
  for(let i=0;i<5;i++){ const n=makeNPC(['human','vexari','oskari'][i%3]); s.add(n); stn.npcs.push({ g:n, x0:-15, x1:15, z:-27-i*1.4, p:rand(0,30), v:rand(.9,1.4), dir:i%2?1:-1 }); }
  stn.player = makePilot(); s.add(stn.player);
}
function syncStationShip(){
  if(stn.ship) stn.scene.remove(stn.ship.g);
  stn.ship = makeShip(activeShip().model); stn.ship.g.scale.setScalar(SHIP_SCALE); stn.ship.g.position.set(STN_SHIP.x, shipLift(activeShip().model), STN_SHIP.z);
  stn.ship.flames.forEach(f=>f.scale.set(1,.15,1)); stn.ship.light.intensity=.2; stn.scene.add(stn.ship.g);
}

// ---------------------------------------------------------------- entrar / sair
function enterStation(){
  buildStation(); syncStationShip();
  mode='station'; state.shipLoc='station';
  stn.player.position.set(8,0,8); stn.player.rotation.y=Math.PI; stn.yaw=-.5; stn.pitch=settings.fp?0:.25;
  hudFor('station'); updateHUD();
  const c=activeContract();
  if(c?.type==='deliver' && qty('supplies')>0){ addItem('supplies',-qty('supplies')); toast('Carga entregue na Estação Beta', '#7dff9a'); progress('deliver'); }
  toast('Estação Beta · Baía 3 — reparos, mercado, contratos e navegação', '#5ef2ff'); save();
}
function undockStation(){
  sfx.door(); noise({dur:2.5,vol:.3,freq:220}); state.shipLoc='flying';
  transition(()=>{ mode='flight'; resetFlight('station'); hudFor('flight'); updateHUD(); toast('Desatracando da Estação Beta · boa caçada, piloto', '#5ef2ff'); });
}
// salto pelo terminal de navegação: sai da estação direto para a órbita do destino
function jumpTo(id){
  const def=PLANETS[id]; if(!def || def===CUR_P || mode!=='station') return;
  if(qty('jumpcell')<def.jump){ toast(`Precisa de ${def.jump} Célula(s) de Salto — Mercado Orbital`, '#ff4a4a'); sfx.error(); return; }
  addItem('jumpcell',-def.jump); state.shipLoc='flying'; save(); closePanel();
  sfx.jump(); toast(`Salto para ${def.name} iniciado…`, '#d07aff');
  transition(()=>{ setPlanet(id); mode='flight'; resetFlight('beacon'); hudFor('flight'); updateHUD();
    toast(`Órbita de ${def.name} · ${def.sec} · desça sobre um hangar marcado ou em qualquer ponto (E)`, '#5ef2ff'); }, true);
}

// ---------------------------------------------------------------- movimento, câmera e interação
const inAreas = (x,z,m=0)=> STN_AREAS.some(a=>x>a.x0+m && x<a.x1-m && z>a.z0+m && z<a.z1-m);
const _stc=new V3(), _stf=new V3();
function updateStation(dt, t){
  const p=stn.player, P=p.position, inp=!ui.panel;
  let mx=0, mz=0;
  if(inp){ if(keys.KeyW||keys.ArrowUp) mz+=1; if(keys.KeyS||keys.ArrowDown) mz-=1; if(keys.KeyA||keys.ArrowLeft) mx-=1; if(keys.KeyD||keys.ArrowRight) mx+=1; }
  const fx=-Math.sin(stn.yaw), fz=-Math.cos(stn.yaw), rx=Math.cos(stn.yaw), rz=-Math.sin(stn.yaw);
  let vx=fx*mz+rx*mx, vz=fz*mz+rz*mx; const len=Math.hypot(vx,vz);
  if(len>0){
    vx/=len; vz/=len; const sp=survSpeed(inp && keys.ShiftLeft, dt)*dt;
    const nx=P.x+vx*sp, nz=P.z+vz*sp;
    if(inAreas(nx,nz,.4)){ P.x=nx; P.z=nz; } else if(inAreas(nx,P.z,.4)) P.x=nx; else if(inAreas(P.x,nz,.4)) P.z=nz;
    if(!settings.fp) p.rotation.y = lerpAngle(p.rotation.y, Math.atan2(vx,vz), Math.min(1,12*dt));
    stn.walk += dt*sp/dt*2.5;
  } else stn.walk*=.85;
  // sólidos: nave, balcões, tanques e bancos
  const solids=[[STN_SHIP.x,STN_SHIP.z,5.2],[-9,-7,1.5],[9,-7,1.5]];
  for(const s of STN_SPOTS) solids.push([s.solid.x,s.solid.z,1.4]);
  for(let x=-16;x<=16;x+=8) solids.push([x,-31,1.2]);
  for(const [x,z,r] of solids){ const dx=P.x-x, dz=P.z-z, d=Math.hypot(dx,dz), m=r+.35; if(d<m && d>1e-4){ P.x=x+dx/d*m; P.z=z+dz/d*m; } }
  const sw=Math.sin(stn.walk)*.6*(len>0?1:0); p.userData.legL.rotation.x=sw; p.userData.legR.rotation.x=-sw;
  // visitantes
  for(const n of stn.npcs){ n.p+=n.v*n.dir*dt; if(n.p>30||n.p<0){ n.dir*=-1; n.p=clamp(n.p,0,30); }
    n.g.position.set(n.x0+n.p,0,n.z); n.g.rotation.y=n.dir>0?Math.PI/2:-Math.PI/2; const a=Math.sin(t*n.v*5+n.z)*.5; n.g.userData.legL.rotation.x=a; n.g.userData.legR.rotation.x=-a; }
  stn.field.material.opacity=.1+Math.sin(t*2)*.03; stn.planet.rotation.z += dt*.004;
  // câmera
  _stf.set(Math.sin(stn.yaw)*Math.cos(stn.pitch), Math.sin(stn.pitch), Math.cos(stn.yaw)*Math.cos(stn.pitch));
  p.visible=!settings.fp;
  if(settings.fp){ stn.cam.position.set(P.x,1.72,P.z); stn.cam.lookAt(P.x-_stf.x,1.72-_stf.y,P.z-_stf.z); p.rotation.y=stn.yaw+Math.PI; }
  else {
    _stc.set(P.x,1.6,P.z); let d=.5;
    while(d<4.6){ const n=d+.1, x=_stc.x+_stf.x*n, y=_stc.y+_stf.y*n, z=_stc.z+_stf.z*n;
      const a=STN_AREAS.find(a=>x>a.x0+.3 && x<a.x1-.3 && z>a.z0+.3 && z<a.z1-.3); if(!a || y<.25 || y>a.h-.25) break; d=n; }
    stn.cam.position.set(_stc.x+_stf.x*d, _stc.y+_stf.y*d, _stc.z+_stf.z*d); stn.cam.lookAt(_stc); pilotFade(p,d);
  }
  // interação
  let best=null, bd=2.6;
  for(const s of STN_SPOTS){ const d=Math.hypot(s.pos.x-P.x, s.pos.z-P.z); if(d<bd){ bd=d; best=s; } }
  if(!best && Math.hypot(P.x-STN_SHIP.x, P.z-STN_SHIP.z)<8.5) best={ label:`[E] Embarcar — ${SHIPS[activeShip().model].name} · desatracar`, fn:undockStation };
  stn.near=best; setPrompt(ui.panel?'':(best?best.label:''));
}
function stationInteract(){ if(stn.near) stn.near.fn(); }

// ---------------------------------------------------------------- painéis da estação (serviços e navegação)
const REPAIR_COST = 2;                                    // créditos por ponto de casco
function shipHull(){ const max=shipStats(activeShip()).hull; return [state.hull!=null ? Math.min(state.hull,max) : max, max]; }
function renderStation(){
  if(ui.tab==='sell') return renderSell();
  if(ui.tab==='supply'){
    const row=(id,extra='')=>{ const it=ITEMS[id]; return `<div class="item"><div><div>${it.name}<span class="tag">${it.slot?SLOTS[it.slot]:it.cat}</span></div><div class="d">${it.desc} ${extra}</div></div>
      <div style="text-align:right"><div class="p">${CUR}${it.price}</div><button class="btn g" data-a="buy" data-v="${id}" ${state.credits<it.price?'disabled':''}>COMPRAR</button></div></div>`; };
    return `<p class="d">Suprimentos que só a Estação Beta vende. Saldo <span class="p">${CUR} ${state.credits}</span></p>`
      + row('jumpcell', `Você tem: <b>${qty('jumpcell')}</b>.`) + row('engine_t2', `No inventário: ${qty('engine_t2')}.`) + row('armor_t2', `No inventário: ${qty('armor_t2')}.`)
      + `<p class="d" style="margin-top:10px">Módulos comprados ficam no inventário — instale na <b>Oficina de Naves</b> (hangar).</p>`;
  }
  const [hp,max]=shipHull(), miss=max-hp, cost=miss*REPAIR_COST, q=Math.ceil(max*.25);
  return `<p class="d">Doca de reparos da Baía 3. ${CUR}${REPAIR_COST} por ponto de casco.</p>
    <div class="item"><div style="flex:1"><div>${SHIPS[activeShip().model].name} · casco <b>${hp}</b> / ${max}</div>
      <div class="bar" style="height:14px;margin-top:8px"><i style="width:${hp/max*100}%;background:${hp/max<.35?'var(--red)':'var(--green)'}"></i></div></div></div>
    ${miss<=0 ? `<div class="empty">Casco íntegro. Nada a reparar.</div>` : `<div style="display:flex;gap:10px;margin-top:10px">
      <button class="btn g" data-a="repair" data-v="part" ${state.credits<Math.min(q,miss)*REPAIR_COST?'disabled':''}>REPARAR +${Math.min(q,miss)} (${CUR}${Math.min(q,miss)*REPAIR_COST})</button>
      <button class="btn g" data-a="repair" data-v="all" ${state.credits<cost?'disabled':''}>REPARAR TUDO (${CUR}${cost})</button></div>`}
    <p class="d" style="margin-top:14px">O dano sofrido em órbita continua na nave entre os voos. Nave destruída volta rebocada com 40% do casco.</p>`;
}
function repairShip(v){
  const [hp,max]=shipHull(), miss=max-hp; if(miss<=0) return;
  let n = v==='all' ? miss : Math.min(miss, Math.ceil(max*.25)); n=Math.min(n, Math.floor(state.credits/REPAIR_COST)); if(n<=0) return;
  state.credits-=n*REPAIR_COST; state.hull = hp+n>=max ? null : hp+n; sfx.coin(); noise({dur:.5,vol:.15,filter:'bandpass',freq:2200});
  toast(`Casco reparado +${n}  −${CUR}${n*REPAIR_COST}`, '#7dff9a'); save(); updateHUD();
}
function renderNav(){
  const here = mode==='station';
  let h = `<p class="d">${here?'Rotas de salto da Estação Beta.':'Consulte e salte pelo terminal de navegação da Estação Beta (órbita de Aurora).'} Células de Salto: <b>${qty('jumpcell')}</b> · à venda no Mercado Orbital (${CUR}${ITEMS.jumpcell.price}).</p>`;
  for(const p of Object.values(PLANETS)){
    const cur = p===CUR_P;
    h += `<div class="item"><div style="flex:1"><div style="font-size:24px">${p.name} <span class="tag" style="color:${p.secC}">${p.sec}</span> <span class="tag">${p.kind.toUpperCase()}</span>${cur?'<span class="tag" style="color:var(--cyan)">VOCÊ ESTÁ AQUI</span>':''}</div>
      <div class="d">${p.desc}</div><div class="d">Recursos: ${p.res.join(' · ')} · Pouso: ${p.sites.map(s=>s.name).join(', ')}</div></div>
      <div style="text-align:right;min-width:150px">${cur?'':`<div class="p">${p.jump?p.jump+' célula'+(p.jump>1?'s':''):'retorno grátis'}</div>
      <button class="btn g" data-a="jump" data-v="${p.id}" ${!here||qty('jumpcell')<p.jump?'disabled':''}>SALTAR</button>`}</div></div>`;
  }
  return h + `<p class="d" style="margin-top:12px">Em voo, mire num planeta (ou aperte <kbd>T</kbd>) e use <kbd>J</kbd> para o <b>hipersalto</b> direto — mesmo custo em células. Voltar a Aurora é grátis.</p>`;
}
