'use strict';
/* Sobrevivência e lei: vida, energia (stamina), saciedade, comida,
   crimes, nível de procurado (até 3 estrelas) e a polícia de Aurora (agentes, viaturas e drones). */

const surv = { st:100, boost:0, regenWait:0, wanted:0, escapeT:0, site:null, units:[], shots:[], spawnT:0, sirenT:0, siren:0,
  bustT:0, hurtT:0, punchT:0, crimeCd:0, lastPL:null, pSpeed:0, downing:false, saveT:0 };

// ---------------------------------------------------------------- energia, fome e vida
const maxStamina = () => state.stats.food<25 ? 55 : 100;
function survSpeed(running, dt){
  const hungry = state.stats.food<25;
  if(running && surv.st>2){ if(surv.boost<=0) surv.st -= 16*dt; surv.regenWait=1; return hungry?5.6:7.2; }
  return hungry ? 3.4 : 4;
}
function survJump(){ if(surv.st<8) return false; if(surv.boost<=0) surv.st-=8; surv.regenWait=.8; tone({type:'sine',f0:220,f1:330,dur:.08,vol:.04}); return true; }
function feed(f){
  const S=state.stats;
  if(f.food) S.food = Math.min(100, S.food+f.food);
  if(f.hp) S.hp = Math.min(100, S.hp+f.hp);
  if(f.boost) surv.boost = f.boost;
  sfx.pickup(); save(); updateVitals();
}
function playerDamage(n, why){
  if(mode!=='city' || surv.downing) return;
  const S=state.stats; S.hp -= n;
  const d=document.getElementById('dmg'); d.style.transition='none'; d.style.opacity=.8; requestAnimationFrame(()=>{ d.style.transition='opacity .5s'; d.style.opacity=0; });
  sfx.hurt(); if(surv.hurtT<=0){ toast(`${why}  −${Math.round(n)} de vida`, '#ff4a4a'); surv.hurtT=1.5; }
  if(S.hp<=0) playerDown();
  updateVitals();
}
function playerDown(){
  surv.downing=true; state.stats.hp=0;
  const fee = Math.min(state.credits, Math.max(20, Math.round(state.credits*.1)));
  state.credits -= fee; clearWanted(); save(); updateHUD();
  setCenter(`VOCÊ DESMAIOU<br><span style="font-size:24px;color:#ffb347">Levado à Clínica de Nova Kessler · −${CUR}${fee}</span>`, 3);
  setTimeout(()=>transition(()=>{ state.stats.hp=60; state.stats.food=Math.max(state.stats.food,40); enterCity('home'); surv.downing=false; updateVitals(); }), 2000);
}

// ---------------------------------------------------------------- crimes e procurado
function crime(level, why){
  const P = playerWorld(), s = siteAt(P, 300); if(!s) return;
  if(surv.crimeCd>0 && level<2) return; surv.crimeCd=.8;
  const before=surv.wanted; surv.wanted=Math.min(3, surv.wanted+level); surv.site=s; surv.escapeT=0;
  toast(`CRIME: ${why}  ${'★'.repeat(surv.wanted)}`, '#ff4a4a');
  if(before===0) tone({type:'square',f0:880,f1:660,dur:.4,vol:.06});
  updateVitals();
}
function clearWanted(){
  surv.wanted=0; surv.escapeT=0; surv.bustT=0;
  for(const u of surv.units) u.site.group.remove(u.g); for(const b of surv.shots) b.site.group.remove(b.m);
  surv.units=[]; surv.shots=[]; updateVitals();
}
function busted(){
  if(surv.downing) return; surv.downing=true;
  const s=surv.site||SITES[0], fee=Math.min(state.credits, 60*surv.wanted + Math.round(state.credits*.1));
  state.credits-=fee; clearWanted(); save(); updateHUD();
  setCenter(`PRESO!<br><span style="font-size:24px;color:#ffb347">Multa paga: −${CUR}${fee} · liberado após a fiança</span>`, 3);
  setTimeout(()=>transition(()=>{ enterCity({ site:s }); surv.downing=false; }), 2000);
}
function playerWorld(){ return city.fly ? city.ship.g.position : city.drive ? city.drive.g.position : city.player.position; }

// ---------------------------------------------------------------- soco
function punch(){
  if(mode!=='city' || city.drive || city.fly || city.launch || ui.panel || surv.punchT>0) return;
  surv.punchT=.45; surv.punchAnim=.2; noise({dur:.08,vol:.08,filter:'highpass',freq:1800});
  const P=city.player.position, s=siteAt(P,50); if(!s) return;
  const fwd=new V3(Math.sin(city.heading),0,Math.cos(city.heading)).applyQuaternion(city.frame.q), w=new V3(), d=new V3();
  for(const n of s.npcs){ if(!n.g.visible || n.down>0) continue; toWorld(s,n.g.position,w); d.subVectors(w,P);
    if(d.length()<1.8 && d.normalize().dot(fwd)>.4){ knockNPC(n,2); crime(1,'Agressão'); return; } }
  for(const u of surv.units){ if(u.type!=='officer' || u.site!==s || u.stun>0) continue; toWorld(s,u.g.position,w); d.subVectors(w,P);
    if(d.length()<1.8 && d.normalize().dot(fwd)>.4){ u.stun=2.5; sfx.hit(); crime(1,'Agressão a policial'); return; } }
}

// ---------------------------------------------------------------- polícia
function makePoliceDrone(){
  const g=new THREE.Group(); box(1,.35,1,M(0x1a2a4a,{metalness:.5}),0,0,0,g);
  for(const [x,z] of [[-.8,-.8],[.8,-.8],[-.8,.8],[.8,.8]]){ box(.9,.04,.12,M(0x2a2a30),x,.25,z,g); }
  g.userData.r=box(.2,.12,.2,B(0xff2030),-.3,-.22,0,g); g.userData.b=box(.2,.12,.2,B(0x2a6aff),.3,-.22,0,g);
  return g;
}
function spawnUnit(type, PL){
  const s=surv.site; let x=0,z=0;
  for(let k=0;k<12;k++){ const a=rand(0,Math.PI*2), r=rand(55,80); x=PL.x+Math.cos(a)*r; z=PL.z+Math.sin(a)*r; if(!insideBoxLocal(s,x,1,z,1)) break; }
  let u;
  if(type==='officer'){ const g=makeNPC('human',true); g.position.set(x,.2,z); u={ type, g, atk:.6, stun:0 }; }
  else if(type==='car'){ const c=makeCar('coupe',0x1a2a4a,0x3a7aff,true); c.g.position.set(x,0,z); u={ type, g:c.g, car:c, yaw:Math.atan2(-(PL.x-x),-(PL.z-z)), v:0, ramT:0 }; }
  else { const g=makePoliceDrone(); g.position.set(x,14,z); u={ type, g, a:rand(0,6), fireT:rand(1,2) }; }
  u.site=s; s.group.add(u.g); surv.units.push(u);
}
const WANT_UNITS = [ {}, {officer:2}, {officer:3,car:1,drone:1}, {officer:4,car:2,drone:3} ];
const _pl=new V3(), _up=new V3();
function updatePolice(dt, t){
  surv.crimeCd=Math.max(0,surv.crimeCd-dt);
  if(surv.wanted<=0){ if(surv.units.length) clearWanted(); return; }
  const s=surv.site, P=playerWorld(), PL=toLocal(s,P,_pl), onFoot=!city.drive && !city.fly;
  if(surv.lastPL) surv.pSpeed = Math.hypot(PL.x-surv.lastPL.x, PL.z-surv.lastPL.z)/Math.max(dt,1e-3); surv.lastPL=PL.clone();
  const far = Math.max(Math.abs(PL.x),Math.abs(PL.z)) > s.paved+600 || PL.y>400;
  // reforços conforme as estrelas
  const want=WANT_UNITS[surv.wanted]; surv.spawnT-=dt;
  if(!far && surv.spawnT<=0){ for(const type of ['officer','car','drone']){ const have=surv.units.filter(u=>u.type===type).length; if(have<(want[type]||0)){ spawnUnit(type,PL); surv.spawnT=.8; break; } } }
  let nearest=1e9, adjacent=false;
  for(const u of surv.units){
    const g=u.g, dx=PL.x-g.position.x, dz=PL.z-g.position.z, d=Math.hypot(dx,dz); nearest=Math.min(nearest,d);
    if(u.type==='officer'){
      if(u.stun>0){ u.stun-=dt; g.rotation.x=-Math.PI/2; g.position.y=.35; continue; } g.rotation.x=0; g.position.y=.2;
      if(d>1.3){ const sp=4.8*dt/d; g.position.x+=dx*sp; g.position.z+=dz*sp; collideLocal(s,g.position,.4); }
      g.rotation.y=Math.atan2(dx,dz); const sw=d>1.3?Math.sin(t*12)*.6:0; g.userData.legL.rotation.x=sw; g.userData.legR.rotation.x=-sw;
      if(d<1.7 && onFoot){ adjacent=true; u.atk-=dt; if(u.atk<=0){ u.atk=1.2; playerDamage(6,'Golpe de cassetete'); } }
    } else if(u.type==='car'){
      const want=Math.atan2(-dx,-dz), diff=((want-u.yaw+Math.PI*3)%(Math.PI*2))-Math.PI;
      u.yaw += clamp(diff,-1.8*dt,1.8*dt);
      const tv = d>9 ? 21*(1-Math.min(.7,Math.abs(diff))) : 3; u.v += clamp(tv-u.v,-14*dt,8*dt);
      g.position.x += -Math.sin(u.yaw)*u.v*dt; g.position.z += -Math.cos(u.yaw)*u.v*dt;
      if(collideLocal(s,g.position,1.5)) u.v*=.5;
      g.rotation.y=u.yaw; for(const w of u.car.wheels) w.rotation.x -= u.v*dt/w.userData.r;
      const on=Math.floor(t*6)%2===0; g.userData.lr.visible=on; g.userData.lb.visible=!on;
      u.ramT-=dt;
      if(d<3.3 && u.ramT<=0){ u.ramT=1;
        if(onFoot && u.v>5){ playerDamage(10,'Atropelado pela polícia'); city.vy=4.5; u.v=0; }
        else if(city.drive){ playerDamage(4,'Viatura bateu em você'); city.drive.speed*=.5; } }
    } else {
      u.a += .7*dt; const tx=PL.x+Math.cos(u.a)*12, tz=PL.z+Math.sin(u.a)*12, ty=PL.y+9;
      const k=1-Math.exp(-2*dt); g.position.x+=(tx-g.position.x)*k; g.position.z+=(tz-g.position.z)*k; g.position.y+=(ty-g.position.y)*k;
      const on=Math.floor(t*5)%2===0; g.userData.r.visible=on; g.userData.b.visible=!on;
      u.fireT-=dt;
      if(u.fireT<=0 && d<70){ u.fireT = surv.wanted>=3 ? 1.1 : 1.7;
        const m=new THREE.Mesh(new THREE.SphereGeometry(.22,6,4), B(0xff3a3a)); m.position.copy(g.position); s.group.add(m);
        const aim=_up.set(PL.x,PL.y+1.1,PL.z).sub(g.position).normalize().multiplyScalar(48);
        surv.shots.push({ m, v:aim.clone(), life:2.5, site:s, dmg:surv.wanted>=3?8:5 }); tone({type:'square',f0:1200,f1:500,dur:.08,vol:.04}); }
    }
  }
  for(let i=surv.shots.length-1;i>=0;i--){
    const b=surv.shots[i]; b.life-=dt; b.m.position.addScaledVector(b.v,dt);
    const hit = b.m.position.distanceTo(_up.set(PL.x,PL.y+1.1,PL.z)) < (city.fly?6:1.3);
    if(hit) playerDamage(city.drive?b.dmg*.5:b.dmg, 'Disparo de drone policial');
    if(hit || b.life<=0){ b.site.group.remove(b.m); surv.shots.splice(i,1); }
  }
  // prisão: agente colado em você parado
  if(adjacent && surv.pSpeed<1.5) surv.bustT+=dt; else surv.bustT=Math.max(0,surv.bustT-dt*.5);
  if(surv.bustT>2.5) return busted();
  // fuga: longe da polícia por tempo suficiente reduz as estrelas
  if(nearest>90 || far){ surv.escapeT += dt*(far?3:1)*(city.fly?3:1); } else surv.escapeT=0;
  if(surv.escapeT>12){ surv.escapeT=0; surv.wanted--; toast(surv.wanted?`Procurado: ${'★'.repeat(surv.wanted)}`:'Você despistou a polícia', '#7dff9a');
    const want2=WANT_UNITS[surv.wanted];
    for(const type of ['officer','car','drone']){ let extra=surv.units.filter(u=>u.type===type).length-(want2[type]||0);
      while(extra-->0){ const i=surv.units.findIndex(u=>u.type===type); s.group.remove(surv.units[i].g); surv.units.splice(i,1); } }
    updateVitals(); }
  // sirene
  surv.sirenT-=dt;
  if(nearest<160 && surv.sirenT<=0){ surv.sirenT=.45; surv.siren^=1; tone({type:'square',f0:surv.siren?980:760,dur:.4,vol:.025}); }
}
function policeBlock(s,l,r){ for(const u of surv.units){ if(u.site!==s || u.type==='drone') continue; pushCircle(l,u.g.position.x,u.g.position.z,r+(u.type==='car'?1.4:.35)); } }
function policeVehicleHit(s,l,v){
  const sp=Math.abs(v.speed);
  for(const u of surv.units){ if(u.site!==s || u.type==='drone') continue;
    const d=Math.hypot(u.g.position.x-l.x, u.g.position.z-l.z);
    if(u.type==='officer' && d<2.2 && sp>4 && u.stun<=0){ u.stun=5; sfx.hit(); crime(1,'Atropelou um policial'); }
    if(u.type==='car' && d<3.2 && sp>6){ crime(1,'Bateu em uma viatura'); v.speed*=.4; } }
}
function* policeUnitsWorld(){ for(const u of surv.units) yield toWorld(u.site,u.g.position,new V3()); }

// ---------------------------------------------------------------- laço e HUD
function updateSurvival(dt, t){
  if(mode==='title') return;
  const S=state.stats;
  const running = mode==='city' && !city.drive && !city.fly && keys.ShiftLeft;
  S.food = Math.max(0, S.food - (running?2:1)*100/(50*60)*dt);          // de cheio a vazio em ~50 min
  surv.boost=Math.max(0,surv.boost-dt); surv.hurtT-=dt; surv.punchT-=dt;
  if(surv.regenWait>0) surv.regenWait-=dt; else surv.st=Math.min(maxStamina(), surv.st+20*dt);
  surv.st=Math.min(surv.st, maxStamina());
  if(S.food>50 && surv.wanted===0 && S.hp<100) S.hp=Math.min(100, S.hp+.4*dt);
  if(S.food<=0) S.hp=Math.max(10, S.hp-.15*dt);
  if(mode==='city' && !surv.downing) updatePolice(dt,t);
  if(surv.punchAnim>0){ surv.punchAnim-=dt; const k=Math.sin(Math.max(0,surv.punchAnim)/.2*Math.PI); city.player.children.forEach((c,i)=>{ if(i===6) c.position.z=k*.45; }); }
  surv.saveT-=dt; if(surv.saveT<=0){ surv.saveT=10; save(); }
  updateVitals();
}
let vitalsKey='';
function updateVitals(){
  const S=state.stats, key=[Math.round(S.hp),Math.round(surv.st),Math.round(S.food),surv.wanted,surv.boost>0,mode].join();
  if(key===vitalsKey) return; vitalsKey=key;
  const set=(id,v,max=100)=>{ document.querySelector(`#${id}>i`).style.width=clamp(v/max*100,0,100)+'%'; };
  set('v-hp',S.hp); set('v-st',surv.st); set('v-food',S.food);
  document.getElementById('v-st').classList.toggle('boost', surv.boost>0);
  document.getElementById('v-food').classList.toggle('low', S.food<25);
  document.getElementById('vitals').style.display = (mode==='city' || mode==='hub') ? 'block' : 'none';
  const w=document.getElementById('wanted');
  w.style.display = surv.wanted>0 ? 'block' : 'none';
  w.innerHTML = 'PROCURADO ' + '<b>★</b>'.repeat(surv.wanted) + '<span>★</span>'.repeat(3-surv.wanted);
}
