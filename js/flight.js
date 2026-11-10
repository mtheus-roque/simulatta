'use strict';
/* Voo espacial */
// ================================================================ VOO
const fl = { scene:new THREE.Scene(), cam:new THREE.PerspectiveCamera(70, innerWidth/innerHeight, .1, 20000),
             bullets:[], ebullets:[], asteroids:[], scraps:[], drones:[], parts:[] };
const GATE_POS = new V3(0,0,45), STATION_POS = new V3(90,30,-430), BEACON_POS = new V3(-150,40,-340);
const DOCK_POS = STATION_POS.clone().add(new V3(0,-4,14));          // boca do hangar da estação (lado +z)
const BODY_DIRS = [ new V3(.15,.35,.92), new V3(-.62,.28,-.73), new V3(.7,.38,-.6) ].map(v=>v.normalize());
const geo = { bullet:new THREE.BoxGeometry(.14,.14,2.4), ebullet:new THREE.IcosahedronGeometry(.55,0),
              scrap:new THREE.BoxGeometry(.7,.5,.9), part:new THREE.BoxGeometry(.35,.35,.35) };
const mat = { bullet:B(0x7ff6ff), ebullet:B(0xff3a3a), scrap:M(0xc8902a,{emissive:0x6a3a08}), part:B(0xffa040) };

function buildFlight(){
  const s = fl.scene;
  s.background = new THREE.Color(0x050308); s.fog = new THREE.FogExp2(0x0c0614, .0014);
  s.add(new THREE.AmbientLight(0x50405a, .7));
  const sun = new THREE.DirectionalLight(0xffb070, 1.1); sun.position.set(1,.5,.3); s.add(sun);
  const fill = new THREE.DirectionalLight(0x6050ff, .45); fill.position.set(-1,-.4,-.6); s.add(fill);
  const sky = canvasTex(1024,512,(g,w,h)=>{
    g.fillStyle='#06040c'; g.fillRect(0,0,w,h);
    for(let i=0;i<26;i++){ const x=Math.random()*w, y=h*.3+Math.random()*h*.4, r=rand(40,200);
      const c=[ 'rgba(120,50,170,.18)','rgba(210,110,50,.14)','rgba(60,50,180,.16)' ][i%3];
      const rg=g.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0,c); rg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=rg; g.fillRect(0,0,w,h); }
    for(let i=0;i<1400;i++){ g.fillStyle=`rgba(255,${200+Math.random()*55|0},${180+Math.random()*75|0},${Math.random()})`; g.fillRect(Math.random()*w,Math.random()*h,1,1); }
  });
  fl.sky = new THREE.Mesh(new THREE.SphereGeometry(9000,24,16), B(0xffffff,{map:sky, side:THREE.BackSide, fog:false, depthWrite:false}));
  fl.sky.renderOrder=-2; s.add(fl.sky);
  // Aurora vista da órbita baixa: oceanos, continentes, nuvens e atmosfera
  fl.planet = new THREE.Mesh(new THREE.SphereGeometry(5200,64,40), M(0xffffff,{map:planetOrbitTexture('aurora'), fog:false, flatShading:false, roughness:.6}));
  fl.planet.rotation.x=Math.PI/2; s.add(fl.planet);                     // polos do planeta em ±z: o "topo" (y) é o equador, onde ficam as cidades
  fl.atmo = new THREE.Mesh(new THREE.SphereGeometry(5420,64,40), B(0x6ab4ff,{transparent:true, opacity:.18, side:THREE.BackSide, blending:THREE.AdditiveBlending, fog:false, depthWrite:false}));
  s.add(fl.atmo);
  // os outros planetas do sistema, ao longe (referência; chega-se a eles pelo salto)
  fl.bodies = Object.values(PLANETS).map((p,i)=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(320,32,20), M(0xffffff,{map:planetOrbitTexture(p.id), fog:false, flatShading:false}));
    m.position.copy(BODY_DIRS[i]).multiplyScalar(7200); m.rotation.x=Math.PI/2; s.add(m); return { id:p.id, m }; });
  buildFlightRest(s); applyFlightPlanet();
}
// a órbita mostra o planeta ativo: Aurora tem a Estação Beta; os outros, uma baliza de salto de volta
function applyFlightPlanet(){
  if(!fl.planet) return;
  const o=CUR_P.orbit, sc=CUR_P.R/40000*.35+.65; fl.planet.material.map=planetOrbitTexture(CUR_P.id); fl.planet.material.needsUpdate=true;
  fl.Rorb=5200*sc; fl.planet.scale.setScalar(sc); fl.atmo.scale.setScalar(sc);
  fl.planet.position.set(0,-(fl.Rorb+800),-1200); fl.atmo.position.copy(fl.planet.position);
  fl.atmo.material.color.setHex(o.atmo); fl.atmo.material.opacity=o.atmoOp;
  if(fl.bodies) fl.bodies.forEach(b=>b.m.visible = b.id!==CUR_P.id);
  const home = CUR_P.id==='aurora'; fl.station.visible=home; fl.beaconG.visible=!home;
}
// textura de Aurora (planeta natal): oceanos, continentes, nuvens e luzes das cidades
function auroraTexture(){
  return canvasTex(1024,512,(g,w,h)=>{
    g.fillStyle='#1c4a7a'; g.fillRect(0,0,w,h);
    for(let i=0;i<46;i++){ const x=Math.random()*w, y=h*.15+Math.random()*h*.7, r=rand(20,90);
      g.fillStyle=['#4a7a3a','#6a7a40','#8a7a50','#3a6a34'][i%4]; g.beginPath();
      for(let a=0;a<6.3;a+=.5){ const rr=r*rand(.6,1.2); g.lineTo(x+Math.cos(a)*rr*1.6, y+Math.sin(a)*rr); } g.fill(); }
    g.fillStyle='#e8eef4'; g.fillRect(0,0,w,h*.06); g.fillRect(0,h*.94,w,h*.06);
    for(let i=0;i<70;i++){ g.fillStyle='rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(Math.random()*w,Math.random()*h,rand(20,90),rand(4,14),rand(-.3,.3),0,Math.PI*2); g.fill(); }
    for(let i=0;i<300;i++){ g.fillStyle='rgba(255,210,140,.9)'; g.fillRect(Math.random()*w,h*.2+Math.random()*h*.6,1,1); }
  });
}
function buildFlightRest(s){
  const dg = new THREE.BufferGeometry(), dp = new Float32Array(500*3);
  for(let i=0;i<dp.length;i++) dp[i]=rand(-80,80);
  dg.setAttribute('position', new THREE.BufferAttribute(dp,3));
  fl.dust = new THREE.Points(dg, new THREE.PointsMaterial({color:0xb09a80, size:.25, transparent:true, opacity:.7}));
  s.add(fl.dust);
  for(let i=0;i<80;i++){
    let p; do{ p=new V3(rand(-420,420),rand(-130,130),rand(-520,320)); }
    while(p.length()<60 || p.distanceTo(STATION_POS)<90 || p.distanceTo(GATE_POS)<40 || p.distanceTo(BEACON_POS)<50);
    const r = rand(3,15); const a = makeAsteroid(r); a.position.copy(p); s.add(a);
    fl.asteroids.push({ mesh:a, r, spin:new V3(rand(-.3,.3),rand(-.3,.3),rand(-.3,.3)) });
  }
  const gate = new THREE.Group(); gate.position.copy(GATE_POS); s.add(gate);
  gate.add(new THREE.Mesh(new THREE.TorusGeometry(8,.7,6,32), M(0x3a3a44,{metalness:.6})));
  gate.add(new THREE.Mesh(new THREE.TorusGeometry(7.2,.25,6,40), B(0x5ef2ff)));
  const swirl = canvasTex(128,128,(g,w,h)=>{ const rg=g.createRadialGradient(64,64,4,64,64,64); rg.addColorStop(0,'rgba(200,255,255,.9)'); rg.addColorStop(.5,'rgba(60,180,255,.35)'); rg.addColorStop(1,'rgba(20,40,120,0)'); g.fillStyle=rg; g.fillRect(0,0,w,h);
    g.strokeStyle='rgba(180,250,255,.5)'; g.lineWidth=2; for(let i=0;i<5;i++){ g.beginPath(); for(let a=0;a<6;a+=.1){ const r=a*9; g.lineTo(64+Math.cos(a+i*1.25)*r,64+Math.sin(a+i*1.25)*r); } g.stroke(); } });
  fl.swirl = new THREE.Mesh(new THREE.CircleGeometry(7,32), B(0xffffff,{map:swirl, transparent:true, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false}));
  gate.add(fl.swirl);
  fl.beacons = []; for(let i=0;i<4;i++) fl.beacons.push(box(.8,.8,.8,B(0xff6030),Math.cos(i*Math.PI/2)*9,Math.sin(i*Math.PI/2)*9,0,gate));
  fl.gate = gate;
  const st = fl.station = new THREE.Group(); st.position.copy(STATION_POS); s.add(st);
  const sm = M(0x6a6a70,{metalness:.5}), sd=M(0x3a3a42);
  fl.stRing = new THREE.Mesh(new THREE.TorusGeometry(30,3,8,28), sm); fl.stRing.rotation.x=Math.PI/2; st.add(fl.stRing);
  cyl(6,6,40,10,sd,0,0,0,st); cyl(9,6,6,10,sm,0,22,0,st); cyl(4,8,8,10,sm,0,-24,0,st);
  for(let i=0;i<4;i++){ const sp=box(30,1.2,1.2,sd,0,0,0,fl.stRing); sp.rotation.z=i*Math.PI/4; }
  [-1,1].forEach(d=>{ box(18,.3,8,M(0x203a70,{emissive:0x0a1a40}),d*48,10,0,st); box(14,.6,.6,sd,d*36,10,0,st); });
  box(8,4,1,B(0xffa040),0,-4,6.2,st);
  plane(16,4,B(0xffffff,{map:signTex('ESTAÇÃO BETA','#ffb347',256,64,30), side:THREE.DoubleSide}),0,8,6.3,st);
  fl.stLights = []; for(let i=0;i<6;i++) fl.stLights.push(box(1,1,1,B(0xff3020),Math.cos(i)*33,0,Math.sin(i)*33,st));
  // baía de atracação (hangar) com guias de luz
  box(14,8,10,sd,0,-4,4,st); box(10,5.6,.3,B(0x0a1620),0,-4,9.1,st);
  for(let i=0;i<6;i++) for(const x of [-6,6]) box(.5,.5,.5,B(0x7dff9a),x,-8.4,10+i*4,st);
  fl.dockLights = st.children.slice(-12);
  // baliza de salto (órbitas dos outros planetas): leva de volta à Estação Beta
  const bg = fl.beaconG = new THREE.Group(); bg.position.copy(BEACON_POS); s.add(bg);
  bg.add(new THREE.Mesh(new THREE.TorusGeometry(9,.8,6,32), M(0x4a3a5a,{metalness:.6})));
  bg.add(new THREE.Mesh(new THREE.TorusGeometry(8,.3,6,40), B(0xd07aff)));
  fl.bSwirl = new THREE.Mesh(new THREE.CircleGeometry(7.8,32), B(0xd07aff,{map:fl.swirl.material.map, transparent:true, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, depthWrite:false}));
  bg.add(fl.bSwirl); bg.visible=false;
}

// Modelos de nave (dados em SHIPS)
function makeShip(modelId){
  const def = SHIPS[modelId];
  const g = new THREE.Group(), model = new THREE.Group(); g.add(model);
  const hull=M(def.color,{metalness:.3}), dark=M(0x2a2a30), metal=M(0x8a8a88,{metalness:.5}), yel=M(0xd8a020);
  const flames=[], engines=[];
  if(modelId==='mule'){
    box(2.2,1.4,4.6,hull,0,0,0,model);
    box(1.6,1,1.2,hull,0,.1,-2.8,model);
    box(1.3,.5,.8,M(0x1a3050,{emissive:0x0a1830,metalness:.6}),0,.55,-3,model);
    [-1.6,1.6].forEach(x=>{ box(1,1.1,3.2,yel,x,-.1,.3,model); box(1.1,.15,.8,dark,x*1.5,-.2,.8,model); });
    box(2.4,.2,2,dark,0,.8,.5,model);
    [-1,1].forEach(x=>{ const gun=cyl(.1,.1,1.6,6,metal,x*.6,-.7,-2.4,model); gun.rotation.x=Math.PI/2; });
    [-.7,.7].forEach(x=>engines.push([x,0,2.6,.42]));
  } else {
    box(1.3,.75,4,hull,0,0,0,model);
    const nose = cyl(.02,.65,1.8,4,hull,0,0,-2.9,model); nose.rotation.x=-Math.PI/2; nose.rotation.y=Math.PI/4;
    box(.75,.45,1.3,M(0x1a3050,{emissive:0x0a1830,metalness:.6}),0,.5,-.7,model);
    box(4.6,.12,1.4,hull,0,-.1,.7,model); box(.35,.5,1.2,yel,-2.3,-.1,.7,model); box(.35,.5,1.2,yel,2.3,-.1,.7,model);
    box(.15,1,1,dark,0,.75,1.5,model);
    [-1.25,1.25].forEach(x=>{ const gun=cyl(.08,.08,1.8,6,metal,x,-.28,-.6,model); gun.rotation.x=Math.PI/2; });
    engines.push([0,0,2.3,.55]);
  }
  for(const [x,y,z,r] of engines){
    const eng = cyl(r,r*1.15,1.4,8,dark,x,y,z,model); eng.rotation.x=Math.PI/2;
    const core = new THREE.Mesh(new THREE.CircleGeometry(r*.9,12), B(0x9fe8ff)); core.position.set(x,y,z+.72); model.add(core);
    const fg = new THREE.CylinderGeometry(r*.8,.04,2,8,1,true); fg.translate(0,-1,0);
    const flame = new THREE.Mesh(fg, B(0x55bbff,{transparent:true, opacity:.75, blending:THREE.AdditiveBlending, depthWrite:false}));
    flame.rotation.x=-Math.PI/2; flame.position.set(x,y,z+.75); model.add(flame); flames.push(flame);
  }
  const light = new THREE.PointLight(0x55bbff, 1.5, 14); light.position.z=4; model.add(light);
  return { g, model, flames, light };
}
function makeAsteroid(r){
  const geom = new THREE.IcosahedronGeometry(r,1), pos=geom.attributes.position, off={};
  for(let i=0;i<pos.count;i++){
    const k = `${pos.getX(i).toFixed(2)},${pos.getY(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`;
    if(!off[k]) off[k] = rand(.75,1.18);
    pos.setXYZ(i, pos.getX(i)*off[k], pos.getY(i)*off[k]*.85, pos.getZ(i)*off[k]);
  }
  geom.computeVertexNormals();
  const c = [0x5a4e46,0x6a5a4a,0x4a4440,0x7a6250][(Math.random()*4)|0];
  const m = new THREE.Mesh(geom, M(c)); m.rotation.set(rand(0,6),rand(0,6),rand(0,6)); return m;
}
function makeDrone(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.3,0), M(0x4a4a52,{metalness:.5})); g.add(body);
  box(3.2,.15,.3,M(0x2a2a2e),0,0,0,g); box(.3,.15,3.2,M(0x2a2a2e),0,0,0,g);
  const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(.42,0), B(0xff2a2a)); eye.position.z=1.05; g.add(eye);
  [-1.6,1.6].forEach(x=>box(.4,.4,.4,M(0x8a3a20),x,0,0,g));
  return { mesh:g, body, eye };
}
function spawnDrone(near){
  const d = makeDrone(); let p;
  do{ p = near.clone().add(new V3(rand(-1,1),rand(-.4,.4),rand(-1,1)).normalize().multiplyScalar(rand(170,280))); }
  while(p.distanceTo(GATE_POS)<60 || p.distanceTo(STATION_POS)<160);
  d.mesh.position.copy(p); fl.scene.add(d.mesh);
  fl.drones.push({ ...d, vel:new V3(), hp:CUR_P.orbit.droneHp, fireT:rand(1,3), orbit:Math.random()<.5?1:-1, flash:0 });
}
function spawnScrap(pos){
  const m = new THREE.Mesh(geo.scrap, mat.scrap); m.position.copy(pos); m.rotation.set(rand(0,6),rand(0,6),0); fl.scene.add(m);
  fl.scraps.push({ mesh:m, spin:rand(1,3) });
}
function burst(pos, n=14, color=0xffa040, spd=25){
  for(let i=0;i<n;i++){
    const m = new THREE.Mesh(geo.part, color===0xffa040?mat.part:B(color)); m.position.copy(pos); fl.scene.add(m);
    fl.parts.push({ mesh:m, vel:new V3(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(rand(spd*.3,spd)), life:rand(.5,1.1) });
  }
}
function resetFlight(at='gate'){
  [...fl.bullets,...fl.ebullets,...fl.scraps,...fl.parts].forEach(o=>fl.scene.remove(o.mesh));
  fl.drones.forEach(d=>fl.scene.remove(d.mesh));
  fl.bullets=[]; fl.ebullets=[]; fl.scraps=[]; fl.parts=[]; fl.drones=[];
  if(fl.ship) fl.scene.remove(fl.ship.g);
  const s = activeShip(); fl.ship = makeShip(s.model); fl.scene.add(fl.ship.g); fl.stats = shipStats(s);
  Object.assign(fl, { yaw:0, pitch:0, aimYaw:0, aimPitch:0, speed:0, throttle:.35, strafe:0, cool:0, shake:0, hitCd:0, dead:false, armed:false, docking:null, bArmed:false, stNote:false, hyper:null, focus:null, lockKey:null, boost:false });
  if(at==='station'){ fl.ship.g.position.copy(DOCK_POS).add(new V3(0,0,8)); fl.yaw=fl.aimYaw=Math.PI; fl.throttle=.25; }      // saindo do hangar da estação
  else if(at==='beacon'){ fl.ship.g.position.copy(BEACON_POS).add(new V3(0,0,30)); fl.yaw=fl.aimYaw=Math.PI; }
  else fl.ship.g.position.set(0,0,18);
  fl.maxHull = fl.stats.hull; fl.hull = state.hull!=null ? clamp(state.hull,1,fl.maxHull) : fl.maxHull;
  fl.hangars = orbitHangars();
  for(let i=0;i<30;i++){ let p; do{ p=new V3(rand(-350,350),rand(-100,100),rand(-450,250)); }while(p.length()<30); spawnScrap(p); }
  for(let i=0;i<CUR_P.orbit.drones;i++) spawnDrone(at==='station' ? fl.ship.g.position.clone().add(new V3(0,0,250)) : new V3(0,0,-80));
  fl.cam.position.copy(fl.ship.g.position).add(new V3(0,3,12)); fl.camReset=true;
  document.getElementById('s-ship').textContent = SHIPS[s.model].name;
}

const _f=new V3(), _r=new V3(), _u=new V3(), _t=new V3(), _a=new V3();
function updateFlight(dt, t){
  const S=fl.ship, sp=S.g.position, st=fl.stats;
  let yawErr = 0, pitchErr = 0;
  if(fl.hyper && !fl.dead){ fl.hyper.t+=dt; fl.shake=Math.max(fl.shake,.15*fl.hyper.t); if(fl.hyper.t>=1.4) doHyperjump(fl.hyper.x); }
  if(fl.docking){ updateDocking(dt); }
  else if(!fl.dead){
    // mira (mouse) -> a nave persegue a mira com taxa de giro limitada
    if(keys.ArrowLeft) fl.aimYaw += 1.4*dt; if(keys.ArrowRight) fl.aimYaw -= 1.4*dt;
    if(keys.ArrowUp) fl.aimPitch += 1.1*dt; if(keys.ArrowDown) fl.aimPitch -= 1.1*dt;
    fl.aimPitch = clamp(fl.aimPitch, -1.25, 1.25);
    fl.aimYaw = fl.yaw + clamp(fl.aimYaw-fl.yaw, -.75, .75);
    yawErr = fl.aimYaw-fl.yaw; pitchErr = fl.aimPitch-fl.pitch;
    const turn = 2.3*st.turn*dt;
    fl.yaw += clamp(yawErr*4*dt, -turn, turn); fl.pitch += clamp(pitchErr*4*dt, -turn, turn);
    if(keys.KeyW) fl.throttle = Math.min(1, fl.throttle+.7*dt);
    if(keys.KeyS) fl.throttle = Math.max(0, fl.throttle-.7*dt);
    if(keys.Space){ fl.throttle = Math.max(0, fl.throttle-2*dt); fl.speed *= Math.exp(-3.5*dt); }
    fl.boost = keys.ShiftLeft && fl.throttle>.2 && !fl.hyper;                       // pós-combustor
    const top = fl.throttle*st.speed*(fl.boost?7:1.8);
    fl.speed += (top - fl.speed)*Math.min(1, (fl.boost?.9:1.4)*dt);
    if(keys.KeyA) fl.strafe -= 70*dt; if(keys.KeyD) fl.strafe += 70*dt;
    fl.strafe = clamp(fl.strafe,-26,26)*Math.exp(-2.2*dt);
    S.g.rotation.set(fl.pitch, fl.yaw, 0, 'YXZ');
    _f.set(0,0,-1).applyQuaternion(S.g.quaternion); _r.set(1,0,0).applyQuaternion(S.g.quaternion); _u.set(0,1,0).applyQuaternion(S.g.quaternion);
    sp.addScaledVector(_f, fl.speed*dt).addScaledVector(_r, fl.strafe*dt);
    S.model.rotation.z += ((yawErr*1.1 - fl.strafe*.022) - S.model.rotation.z)*Math.min(1,5*dt);
    const th = .3 + fl.throttle*1.7 + (fl.boost?2.2:0) + Math.random()*.25;
    S.flames.forEach(f=>f.scale.set(1, th, 1)); S.light.intensity = .6 + fl.throttle*1.8;
    fl.cool -= dt;
    if((mouseDown||keys.KeyF) && fl.cool<=0){
      fl.cool = .16;
      if(!st.weapon){ if(!fl.noWpnT || t-fl.noWpnT>2){ fl.noWpnT=t; toast('Nenhuma arma instalada — veja a Garagem [I]', '#ff4a4a'); sfx.error(); } }
      else {
        for(const o of (st.dual?[-1.25,1.25]:[0])){
          const m = new THREE.Mesh(geo.bullet, mat.bullet);
          m.position.copy(sp).addScaledVector(_r,o).addScaledVector(_f,2.2).addScaledVector(_u,-.25); m.quaternion.copy(S.g.quaternion);
          fl.scene.add(m); fl.bullets.push({ mesh:m, vel:_f.clone().multiplyScalar(230+fl.speed), life:1.6 });
        }
        sfx.laser();
      }
    }
    const oa=orbitAlt();
    if(sp.length()>900 && oa>2600) setCenter('LIMITE DO SETOR — RETORNE', 1);
    if(oa<120){ _t.subVectors(sp, fl.planet.position).setLength(fl.Rorb+120); sp.copy(fl.planet.position).add(_t); fl.speed*=.9; setCenter(`ÓRBITA BAIXA DE ${CUR_P.name} — [E] para descer`, .6); }
  }
  for(let i=fl.bullets.length-1;i>=0;i--){
    const b=fl.bullets[i]; b.life-=dt; b.mesh.position.addScaledVector(b.vel,dt);
    let hit = b.life<=0;
    if(!hit) for(const d of fl.drones){ if(b.mesh.position.distanceTo(d.mesh.position)<2.6){ d.hp--; d.flash=.12; hit=true; sfx.hit(); burst(b.mesh.position,4,0x7ff6ff,12); break; } }
    if(!hit) for(const a of fl.asteroids){ if(b.mesh.position.distanceTo(a.mesh.position)<a.r*.95){ hit=true; burst(b.mesh.position,3,0x8a7a6a,8); break; } }
    if(hit){ fl.scene.remove(b.mesh); fl.bullets.splice(i,1); }
  }
  for(let i=fl.drones.length-1;i>=0;i--){
    const d=fl.drones[i], dp=d.mesh.position;
    if(d.hp<=0){
      burst(dp,22); sfx.boom(); for(let k=0;k<3;k++) spawnScrap(dp.clone().add(new V3(rand(-3,3),rand(-3,3),rand(-3,3))));
      const rw=CUR_P.orbit.reward; state.credits+=rw; state.kills++; toast(`Drone abatido  +${CUR}${rw}`, '#ff8a5a'); progress('kill');
      fl.scene.remove(d.mesh); fl.drones.splice(i,1); save(); updateHUD(); continue;
    }
    _t.copy(sp).sub(dp); const dist=_t.length(); _t.normalize();
    if(dist<300 && !fl.dead){
      const s = dist>45 ? 30 : dist<22 ? -14 : 0;
      const orbit = new V3().crossVectors(_t, new V3(0,1,0)).multiplyScalar(14*d.orbit);
      d.vel.lerp(_t.clone().multiplyScalar(s).add(orbit), Math.min(1, 1.5*dt));
      d.fireT -= dt;
      if(dist<150 && d.fireT<=0 && !(fl.station.visible && sp.distanceTo(STATION_POS)<140) && !fl.docking){
        d.fireT = rand(1.5,2.8);
        const lead = sp.clone().addScaledVector(_f, fl.speed*dist/95*.6);
        const v = lead.sub(dp).normalize().multiplyScalar(95);
        const m = new THREE.Mesh(geo.ebullet, mat.ebullet); m.position.copy(dp); fl.scene.add(m);
        fl.ebullets.push({ mesh:m, vel:v, life:3 });
        tone({type:'square', f0:300, f1:120, dur:.12, vol:.03});
      }
    } else d.vel.multiplyScalar(.98);
    dp.addScaledVector(d.vel, dt);
    for(const a of fl.asteroids){ const dd=dp.distanceTo(a.mesh.position), m=a.r+2; if(dd<m) dp.sub(a.mesh.position).setLength(m).add(a.mesh.position); }
    d.mesh.lookAt(sp); d.body.rotation.z += dt*2;
    d.flash -= dt; d.eye.material = d.flash>0 ? mat.bullet : mat.ebullet;
  }
  while(fl.drones.length<CUR_P.orbit.drones && !fl.dead && !fl.docking) spawnDrone(sp);
  for(let i=fl.ebullets.length-1;i>=0;i--){
    const b=fl.ebullets[i]; b.life-=dt; b.mesh.position.addScaledVector(b.vel,dt); b.mesh.rotation.x+=dt*8;
    let gone = b.life<=0;
    if(!gone && !fl.dead && b.mesh.position.distanceTo(sp)<2.4){ gone=true; damage(8); }
    if(gone){ fl.scene.remove(b.mesh); fl.ebullets.splice(i,1); }
  }
  fl.hitCd -= dt;
  for(const a of fl.asteroids){
    a.mesh.rotation.x += a.spin.x*dt; a.mesh.rotation.y += a.spin.y*dt;
    if(fl.dead) continue;
    const dd = sp.distanceTo(a.mesh.position), m = a.r*.92+1.6;
    if(dd<m){
      sp.sub(a.mesh.position).setLength(m+.2).add(a.mesh.position);
      if(fl.hitCd<=0){ damage(clamp(fl.speed*.35, 6, 35)); fl.speed*=.25; fl.throttle*=.4; fl.hitCd=.6; burst(sp,8,0x8a7a6a,10); }
    }
  }
  for(let i=fl.scraps.length-1;i>=0;i--){
    const c=fl.scraps[i], cp=c.mesh.position; c.mesh.rotation.y+=c.spin*dt; c.mesh.rotation.x+=c.spin*.5*dt;
    if(fl.dead) continue;
    const dd = cp.distanceTo(sp);
    if(dd<16) cp.add(_t.copy(sp).sub(cp).normalize().multiplyScalar(Math.min(dd, (50+fl.speed)*dt)));
    if(dd<2.6){ fl.scene.remove(c.mesh); fl.scraps.splice(i,1); addItem('scrap',1); sfx.pickup(); progress('collect'); save(); updateHUD(); }
  }
  if(fl.scraps.length<22) spawnScrap(sp.clone().add(new V3(rand(-1,1),rand(-.3,.3),rand(-1,1)).normalize().multiplyScalar(rand(150,300))));
  for(let i=fl.parts.length-1;i>=0;i--){
    const p=fl.parts[i]; p.life-=dt; p.mesh.position.addScaledVector(p.vel,dt); p.mesh.scale.setScalar(Math.max(.01,p.life));
    if(p.life<=0){ fl.scene.remove(p.mesh); fl.parts.splice(i,1); }
  }
  fl.swirl.rotation.z -= dt*1.5; fl.gate.rotation.z += dt*.2;
  fl.beacons.forEach((b,i)=>b.visible = Math.floor(t*2+i)%2===0);
  fl.stRing.rotation.z += dt*.08; fl.stLights.forEach((l,i)=>l.visible=Math.floor(t*1.5+i*.5)%2===0);

  fl.bSwirl.rotation.z += dt*2; fl.beaconG.rotation.z -= dt*.25;
  if(fl.dockLights) fl.dockLights.forEach((l,i)=>l.visible = Math.floor(t*6 - (i>>1))%6 < 2);
  if(!fl.dead && !fl.docking){
    const dG = sp.distanceTo(GATE_POS);
    if(dG>30) fl.armed=true;
    if(fl.armed && dG<7.5) jumpHome();
    if(fl.beaconG.visible){ const dB=sp.distanceTo(BEACON_POS); if(dB>30) fl.bArmed=true; if(fl.bArmed && dB<8) beaconJump(); }
  }
  // câmera de perseguição
  _a.set(0,0,-1).applyEuler(new THREE.Euler(fl.aimPitch, fl.aimYaw, 0, 'YXZ'));
  S.model.visible = settings.fp ? false : !fl.dead;
  if(settings.fp){
    // 1ª pessoa: visão de cockpit
    fl.cam.position.copy(sp).add(new V3(0,.55,-.6).applyQuaternion(S.g.quaternion));
    fl.cam.quaternion.copy(S.g.quaternion);
    fl.cam.rotateZ(S.model.rotation.z*.35);
  } else {
    if(!fl.camQ || fl.camReset){ fl.camQ=S.g.quaternion.clone(); fl.camReset=false; }
    fl.camQ.slerp(S.g.quaternion, 1-Math.exp(-7*dt));                     // distância fixa: só a rotação é suavizada
    fl.cam.position.copy(sp).add(new V3(0,2.8,11).applyQuaternion(fl.camQ));
    fl.cam.lookAt(sp.clone().addScaledVector(_f.set(0,0,-1).applyQuaternion(S.g.quaternion), 18).addScaledVector(_a, 12));
  }
  if(fl.shake>0){ fl.cam.position.add(new V3(rand(-1,1),rand(-1,1),rand(-1,1)).multiplyScalar(fl.shake*(settings.fp?.3:1))); fl.shake*=Math.exp(-6*dt); }
  const fov = settings.fov + Math.min(28, fl.speed*.12) + (fl.hyper ? fl.hyper.t*14 : 0);
  if(Math.abs(fl.cam.fov-fov)>.05){ fl.cam.fov += (fov - fl.cam.fov)*Math.min(1,3*dt); fl.cam.updateProjectionMatrix(); }
  fl.sky.position.copy(fl.cam.position);
  const dpos = fl.dust.geometry.attributes.position, c=fl.cam.position;
  for(let i=0;i<dpos.count;i++){
    dpos.setXYZ(i, c.x + ((dpos.getX(i)-c.x+80)%160+160)%160-80, c.y + ((dpos.getY(i)-c.y+80)%160+160)%160-80, c.z + ((dpos.getZ(i)-c.z+80)%160+160)%160-80);
  }
  dpos.needsUpdate = true;
  // HUD
  document.getElementById('s-hull').textContent = Math.max(0,Math.round(fl.hull));
  document.querySelector('#hullbar>i').style.width = Math.max(0,fl.hull/fl.maxHull*100)+'%';
  document.getElementById('s-spd').textContent = Math.round(fl.speed*3.6)+' km/s';
  document.querySelector('#spdbar>i').style.width = (fl.throttle*100)+'%';
  const ap = sp.clone().addScaledVector(_a, 80).project(fl.cam), aim=document.getElementById('aim');
  aim.style.left=((ap.x*.5+.5)*innerWidth)+'px'; aim.style.top=((-ap.y*.5+.5)*innerHeight)+'px';
  const cp = sp.clone().addScaledVector(_f.set(0,0,-1).applyQuaternion(S.g.quaternion), 80).project(fl.cam), ch=document.getElementById('crosshair');
  ch.style.left=((cp.x*.5+.5)*innerWidth)+'px'; ch.style.top=((-cp.y*.5+.5)*innerHeight)+'px';
  marker(document.getElementById('mk-gate'), GATE_POS, `${CUR_P.id==='aurora'?'SALTO → HANGAR':'DESCIDA → '+SITES[0].name}<br>${Math.round(sp.distanceTo(GATE_POS))}m`);
  document.getElementById('mk-station').style.display='none';
  fl.drones.forEach((d,i)=>{ if(droneMk[i]) marker(droneMk[i], d.mesh.position, Math.round(sp.distanceTo(d.mesh.position))+'m'); });
  droneMk.forEach((m,i)=>{ if(i>=fl.drones.length) m.style.display='none'; });
  // planetas e hangares marcados no espaço
  const tgs = flightTargets(); updateFocus(tgs);
  let k=0;
  for(const x of tgs){ if(k>=bodyMk.length) break; const el=bodyMk[k++], f=fl.focus && fl.focus.key===x.key;
    el.classList.toggle('focus', !!f);
    marker(el, x.pos, `${f?'◎ ':''}${x.label}<br>${fmtKm(x.pos.distanceTo(sp))}${f?` · <b>[J]</b> ${x.verb}`:''}`); }
  for(;k<bodyMk.length;k++) bodyMk[k].style.display='none';
  let pr='';
  if(fl.hyper) pr=`HIPERSALTO → ${fl.hyper.x.label.replace(/<[^>]+>/g,'')} · ${Math.max(0,1.4-fl.hyper.t).toFixed(1)} s`;
  else if(fl.docking) pr='Atracando…';
  else if(canDock()) pr='[E] Atracar na Estação Beta';
  else if(canDescend()){ const tg=descentTarget(); pr = tg.pad ? `[E] Descer — pouso automático em ${tg.pad.name}` : `[E] Descer — pousar na superfície (${tg.label})`; }
  else if(fl.station.visible && sp.distanceTo(DOCK_POS)<90) pr='Reduza a velocidade para atracar';
  else if(fl.armed && sp.distanceTo(GATE_POS)<40) pr = CUR_P.id==='aurora' ? 'Atravesse o portão para saltar ao hangar' : `Atravesse o portão para descer a ${CUR_P.name}`;
  else if(fl.beaconG.visible && sp.distanceTo(BEACON_POS)<45) pr='Atravesse a baliza para voltar à Estação Beta';
  else if(fl.focus) pr=`[J] Hipersalto: ${fl.focus.verb} · [T] trocar alvo · Shift: pós-combustor`;
  else pr='Mire num planeta, hangar ou estação (ou [T]) para o hipersalto · Shift: pós-combustor';
  setPrompt(ui.panel?'':pr);
}
// ---------------------------------------------------------------- atracação na Estação Beta
const canDock = () => fl.station.visible && !fl.dead && !fl.docking && fl.ship.g.position.distanceTo(DOCK_POS)<70 && fl.speed<28;
function startDock(){
  if(!canDock()) return;
  const S=fl.ship;
  fl.docking = { t:0, from:S.g.position.clone(), q0:S.g.quaternion.clone(), q1:new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,0,'YXZ')) };
  fl.throttle=0; fl.speed=0; fl.strafe=0; sfx.door(); noise({dur:2,vol:.2,freq:300}); toast('Controle de tráfego: "Baía 3 liberada, piloto. Feixe trator ativo."', '#5ef2ff');
}
function updateDocking(dt){
  const D=fl.docking, S=fl.ship, sp=S.g.position; D.t+=dt;
  const k=smooth01(D.t/3), inside=DOCK_POS.clone().add(new V3(0,0,-6));
  if(D.t<2) sp.lerpVectors(D.from, DOCK_POS.clone().add(new V3(0,0,12)), smooth01(D.t/2));
  else sp.lerpVectors(DOCK_POS.clone().add(new V3(0,0,12)), inside, smooth01((D.t-2)/1.4));
  S.g.quaternion.slerpQuaternions(D.q0, D.q1, k); fl.yaw=0; fl.pitch=0; fl.aimYaw=0; fl.aimPitch=0;
  S.flames.forEach(f=>f.scale.set(1,.25,1));
  if(D.t>=3.2 && !D.done){ D.done=true; state.hull=Math.round(fl.hull); transition(()=>enterStation('dock')); }
}
// baliza: salto de volta à órbita de Aurora, junto da estação
function beaconJump(){
  fl.dead=true; sfx.jump(); state.hull=Math.round(fl.hull); save(); toast('Salto pela baliza…', '#d07aff');
  transition(()=>{ setPlanet('aurora'); resetFlight('station'); fl.ship.g.position.copy(DOCK_POS).add(new V3(0,10,90)); hudFor('flight'); updateHUD();
    toast('Órbita de Aurora · Estação Beta à frente', '#5ef2ff'); }, true);
}
const bodyMk = [];
for(let i=0;i<7;i++){ const m=document.createElement('div'); m.className='mk glow planetmk'; document.getElementById('hud').appendChild(m); bodyMk.push(m); }
// ---------------------------------------------------------------- descida direta da órbita baixa
const _pd=new V3();
function orbitAlt(){ return fl.ship.g.position.distanceTo(fl.planet.position) - fl.Rorb; }
function orbitHangars(){                                   // uma plataforma principal por sítio do planeta ativo
  return SITES.filter(s=>s.pads && s.pads.length).map(s=>{ const pad = s.pads.find(p=>/Hangar 07|Doca 07|Plataforma 1/.test(p.name)) || s.pads[0];
    return { site:s, pad, orb:fl.planet.position.clone().addScaledVector(s.up, fl.Rorb+6) }; });
}
const canDescend = () => !fl.dead && !fl.docking && orbitAlt() < 700;
function descentTarget(){
  const sp=fl.ship.g.position;
  for(const h of fl.hangars) if(h.orb.distanceTo(sp) < 650) return h;
  const d=_pd.subVectors(sp, fl.planet.position).normalize().clone(), r=groundR(d);
  return { dir:d, label: r<seaR()+1 ? (CUR_P.seaMat&&CUR_P.seaMat.emissive?'mar de lava':'oceano') : biomeName(biomeOf(d, r-PLANET.R)) };
}
function startDescent(){
  if(!canDescend()) return;
  const tg=descentTarget(); fl.dead=true; state.hull=Math.round(fl.hull); state.shipLoc='flying'; save();
  noise({dur:3,vol:.35,freq:160}); tone({type:'sawtooth',f0:220,f1:60,dur:2.5,vol:.1}); toast(`Reentrada em ${CUR_P.name}…`, '#ffb347');
  transition(()=>landFromOrbit(tg), true);
}
// ---------------------------------------------------------------- foco e hipersalto
// alvos: hangares do planeta atual, órbita baixa dele, a Estação Beta (ou a baliza) e os outros planetas
function flightTargets(){
  const sp=fl.ship.g.position, L=[], oa=orbitAlt();
  for(const h of fl.hangars) L.push({ key:'h:'+h.pad.name, kind:'hangar', h, pos:h.orb, label:`▼ ${h.pad.name.toUpperCase()}`, verb:'pousar aqui' });
  if(oa>900) L.push({ key:'low', kind:'low', pos:_pd.subVectors(sp,fl.planet.position).setLength(fl.Rorb).add(fl.planet.position).clone(), label:`${CUR_P.name} · ÓRBITA BAIXA`, verb:'ir à órbita baixa' });
  if(fl.station.visible) L.push({ key:'stn', kind:'station', pos:DOCK_POS, label:'ESTAÇÃO BETA · ATRACAR', verb:'ir até a baía' });
  else L.push({ key:'stn', kind:'beacon', pos:BEACON_POS, label:'BALIZA → ESTAÇÃO BETA', verb:'voltar à Estação Beta' });
  for(const b of fl.bodies){ if(!b.m.visible) continue; const P=PLANETS[b.id], cost=P.id==='aurora'?0:P.jump;
    L.push({ key:'p:'+P.id, kind:'planet', id:P.id, pos:b.m.position, label:`${P.name} <span style="color:${P.secC}">${P.sec}</span>`,
      verb:`saltar à órbita${cost?` (${cost} célula${cost>1?'s':''} · você tem ${qty('jumpcell')})`:' (grátis)'}`, cost }); }
  return L;
}
const _fa=new V3();
function updateFocus(tgs){
  if(fl.hyper) return;
  if(fl.lockKey){ const x=tgs.find(t=>t.key===fl.lockKey); if(x){ fl.focus=x; return; } fl.lockKey=null; }
  const sp=fl.ship.g.position; let best=null, ba=.14;                  // ~8°: o que estiver na mira
  for(const x of tgs){ const a=_fa.subVectors(x.pos,sp).normalize().angleTo(_a); if(a<ba){ ba=a; best=x; } }
  fl.focus=best;
}
function cycleFocus(){
  const tgs=flightTargets(); if(!tgs.length) return;
  const i=tgs.findIndex(t=>t.key===(fl.lockKey||(fl.focus&&fl.focus.key)));
  if(fl.lockKey && i===tgs.length-1){ fl.lockKey=null; fl.focus=null; toast('Foco livre — mire para escolher', '#ffb347'); sfx.ui(); return; }
  const x=tgs[(i+1)%tgs.length]; fl.lockKey=x.key; fl.focus=x; sfx.ui(); toast(`Foco: ${x.label.replace(/<[^>]+>/g,'')}`, '#e0c8ff');
}
function startHyperjump(){
  const x=fl.focus; if(!x || fl.dead || fl.docking || fl.hyper) return;
  if(x.kind==='planet' && qty('jumpcell')<x.cost){ toast(`Faltam Células de Salto (${x.cost}) — Mercado Orbital da Estação Beta`, '#ff4a4a'); sfx.error(); return; }
  fl.hyper={ t:0, x }; fl.lockKey=x.key; tone({type:'sawtooth',f0:80,f1:900,dur:1.5,vol:.1}); noise({dur:1.5,vol:.2,freq:600});
}
function doHyperjump(x){
  fl.hyper=null; state.hull=Math.round(fl.hull); sfx.jump();
  if(x.kind==='hangar'){ fl.dead=true; state.shipLoc='flying'; save(); transition(()=>landFromOrbit(x.h), true); return; }
  if(x.kind==='beacon') return beaconJump();
  if(x.kind==='planet'){
    fl.dead=true; if(x.cost) addItem('jumpcell',-x.cost); save();
    transition(()=>{ setPlanet(x.id); resetFlight('gate'); hudFor('flight'); updateHUD();
      const h=fl.hangars[0]; if(h){ fl.ship.g.position.copy(h.orb).addScaledVector(h.site.up, 380).add(new V3(0,0,120)); fl.lockKey='h:'+h.pad.name; }
      toast(`Hipersalto concluído · órbita de ${CUR_P.name} · [J] de novo para pousar em ${h?h.pad.name:'superfície'}`, '#5ef2ff'); }, true);
    return;
  }
  transition(()=>{ const S=fl.ship;                              // salto curto dentro da órbita
    if(x.kind==='station'){ S.g.position.copy(DOCK_POS).add(new V3(0,0,55)); fl.yaw=fl.aimYaw=0; }
    else S.g.position.copy(fl.planet.position).addScaledVector(_pd.subVectors(x.pos,fl.planet.position).normalize(), fl.Rorb+320);
    fl.pitch=fl.aimPitch=0; fl.speed=0; fl.throttle=.2; fl.camReset=true; fl.lockKey=null;
    toast(x.kind==='station' ? 'Estação Beta à frente · reduza e aperte [E] para atracar' : `Órbita baixa de ${CUR_P.name} · [E] desce onde estiver`, '#5ef2ff'); }, true);
}
function flightInteract(){ if(canDock()) startDock(); else startDescent(); }
const droneMk = [];
for(let i=0;i<6;i++){ const m=document.createElement('div'); m.className='mk drone'; document.getElementById('hud').appendChild(m); droneMk.push(m); }
function marker(el, wp, html, cam=fl.cam){
  const v = wp.clone().project(cam);
  let x=(v.x*.5+.5)*innerWidth, y=(-v.y*.5+.5)*innerHeight;
  const behind = v.z>1, pad=46;
  if(behind){ x=innerWidth-x; y=innerHeight-y; }
  const off = behind || x<pad || x>innerWidth-pad || y<pad || y>innerHeight-pad;
  if(off){ const cx=innerWidth/2, cy=innerHeight/2; let dx=x-cx, dy=y-cy;
    if(Math.abs(dx)<1 && Math.abs(dy)<1) dy=1;
    const s=Math.min((cx-pad)/Math.max(Math.abs(dx),.001),(cy-pad)/Math.max(Math.abs(dy),.001));
    const k = behind ? s : Math.min(1,s); x=cx+dx*k; y=cy+dy*k; }
  el.style.display='block'; el.style.left=x+'px'; el.style.top=y+'px';
  if(el._h!==html){ el.innerHTML=html; el._h=html; }
  el.style.opacity = off ? .6 : 1;
}
function damage(n){
  if(fl.docking) return;
  fl.hull -= n; state.hull = Math.max(0,Math.round(fl.hull)); fl.shake = Math.min(1.2, fl.shake+.5); sfx.hurt();
  const d=document.getElementById('dmg'); d.style.transition='none'; d.style.opacity=1; requestAnimationFrame(()=>{ d.style.transition='opacity .5s'; d.style.opacity=0; });
  if(fl.hull<=0) shipDestroyed();
}
function shipDestroyed(){
  fl.dead=true; fl.ship.g.visible=false; burst(fl.ship.g.position,40,0xffa040,40); sfx.boom();
  const lost = Math.ceil(qty('scrap')/2); addItem('scrap',-lost); state.hull=Math.round(fl.maxHull*.4); save(); updateHUD();
  setCenter(`NAVE DESTRUÍDA<br><span style="font-size:24px;color:#ffb347">Rebocada ${CUR_P.id==='aurora'?'ao hangar':'à '+SITES[0].pads[0].name} · ${lost} sucata perdida · casco a 40%</span>`, 2.6);
  setTimeout(()=>transition(()=>enterCity('hangar')), 2600);
}
function jumpHome(){
  fl.dead=true; sfx.jump(); state.hull=Math.round(fl.hull); save(); toast('Salto iniciado...', '#5ef2ff');
  transition(()=>{ enterCity('reentry'); toast(CUR_P.id==='aurora' ? 'Reentrada em Aurora · pilote até o Hangar 07 ou pouse onde quiser (E)' : `Reentrada em ${CUR_P.name} · ${SITES[0].name} fica logo abaixo (H no mapa)`, '#5ef2ff'); }, true);
}

