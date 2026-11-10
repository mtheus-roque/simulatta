'use strict';
/* Combate a pé: armas de fogo (mira por cima do ombro), corpo a corpo com combo e golpe carregado,
   esquiva, inimigos com IA (gangues de Porto Ferrugem, acampamentos de bandidos, alvos de recompensa). */

const combat = { aiming:false, cool:0, reloadT:0, firing:false, fired:false, holding:false, holdT:0, combo:0, comboT:0,
  iframe:0, dodgeT:0, dodgeDir:new V3(), faceT:0, enemies:[], fx:[], hitT:0, flash:null, hostile:{}, turfs:[], camps:[],
  pSpeed:0, lastP:null, campNote:{} };
const EN_W = {
  pistol: { dmg:7,  rate:.75, mag:8,  acc:.55, range:45 },
  rifle:  { dmg:5,  rate:.2,  mag:20, acc:.42, range:60 },
  shotgun:{ dmg:15, rate:1.3, mag:4,  acc:.65, range:16 },
  melee:  { dmg:9,  rate:1.1, range:1.7 },
};
const _c1=new V3(), _c2=new V3(), _c3=new V3(), _c4=new V3(), _ep=new V3(), _eu=new V3(), _cqi=new THREE.Quaternion(), _cqk=new THREE.Quaternion();
const sparkGeo = new THREE.BoxGeometry(.18,.18,.18);
function initCombat(){ combat.flash=new THREE.PointLight(0xffd090,0,9); city.scene.add(combat.flash); initCamps(); initTurfs(); }

// ---------------------------------------------------------------- armas do jogador
const ownsWeapon = id => id==='fists' || qty('w_'+id)>0;
function curWeapon(){ const id = ownsWeapon(state.weapon) ? state.weapon : 'fists'; return [id, WEAPONS[id]]; }
const clipOf = id => state.clip[id] || 0;
const onFootNow = () => mode==='city' && !city.drive && !city.fly && !city.launch;
function selectWeapon(slot){
  const ids = Object.keys(WEAPONS).filter(id=>WEAPONS[id].key===slot && ownsWeapon(id));
  if(!ids.length){ toast('Nenhuma arma nesse espaço — loja ARMAS ou bancada de fabricação', '#ff4a4a'); sfx.error(); return; }
  const i=ids.indexOf(state.weapon); state.weapon = ids[(i+1)%ids.length];
  combat.reloadT=0; sfx.ui(); toast(`Equipado: ${WEAPONS[state.weapon].name}`, '#ffb347'); save(); updateWeaponHUD();
}
function reloadWeapon(){
  const [id,w]=curWeapon(); if(w.melee || combat.reloadT>0) return;
  if(clipOf(id)>=w.mag) return;
  if(qty(w.ammo)<=0){ toast(`Sem ${ITEMS[w.ammo].name} — compre ou fabrique`, '#ff4a4a'); sfx.error(); return; }
  combat.reloadT=w.reload; noise({dur:.15,vol:.08,filter:'bandpass',freq:1500}); setTimeout(()=>noise({dur:.1,vol:.1,filter:'bandpass',freq:2400}), w.reload*800);
}
function finishReload(){ const [id,w]=curWeapon(); if(w.melee) return; const n=Math.min(w.mag-clipOf(id), qty(w.ammo)); addItem(w.ammo,-n); state.clip[id]=clipOf(id)+n; updateWeaponHUD(); }

// raio contra prédios e chão: devolve a distância do primeiro bloqueio
function rayBlock(o, d, maxT){
  for(let t=1; t<maxT; t+=1.5){
    _c4.copy(o).addScaledVector(d,t);
    const s=siteAt(_c4,60);
    if(s){ const l=toLocal(s,_c4,_ep); if(l.y<-.1 || insideBoxLocal(s,l.x,l.y,l.z,0)) return t; }
    else { const dd=_eu.subVectors(_c4,PC).normalize(); if(_c4.distanceTo(PC) < groundR(dd)) return t; }
  }
  return maxT;
}
const blockedBetween = (a,b)=>{ const dir=_c3.subVectors(b,a), L=dir.length(); dir.multiplyScalar(1/L); return rayBlock(a,dir,L-.8) < L-.8; };
function combatTargets(){
  const out=[], P=city.player.position;
  for(const s of SITES){ if(s.center.distanceTo(P)>2500) continue;
    for(const n of s.npcs){ if(!n.g.visible || n.down>0) continue; out.push({ kind:'npc', n, pos:toWorld(s,n.g.position,new V3()), up:s.up, r:.55, h:1.1 }); } }
  for(const u of surv.units) out.push({ kind:'police', u, pos:toWorld(u.site,u.g.position,new V3()), up:u.site.up, r:u.type==='car'?2.2:u.type==='drone'?.9:.55, h:u.type==='officer'?1.1:u.type==='car'?.8:0 });
  for(const e of combat.enemies) if(e.state!=='dead') out.push({ kind:'enemy', e, pos:e.g.position, up:e.F.up, r:.55, h:e.state==='surrender'?.6:1.1 });
  return out;
}
function raySphere(o,d,c,r){ const oc=_c2.subVectors(c,o), t=oc.dot(d); if(t<0) return -1; const q=oc.lengthSq()-t*t; if(q>r*r) return -1; return t-Math.sqrt(r*r-q); }
function fireWeapon(){
  const [id,w]=curWeapon();
  if(clipOf(id)<=0){ if(qty(w.ammo)>0) reloadWeapon(); else { sfx.error(); toast('Sem munição', '#ff4a4a'); } return; }
  state.clip[id]--; combat.cool=w.rate; combat.faceT=1.2;
  city.player.updateMatrixWorld(true);
  const o=city.cam.position.clone(), dir=new V3(); city.cam.getWorldDirection(dir);
  const muzzle=city.player.localToWorld(new V3(-.42,1.25,.55));
  const spread = w.spread*(combat.aiming?1:2.2)*(combat.pSpeed>2?1.4:1), targets=combatTargets();
  for(let k=0;k<(w.pellets||1);k++){
    const d=dir.clone().add(_c1.set(rand(-1,1),rand(-1,1),rand(-1,1)).multiplyScalar(spread)).normalize();
    let best=rayBlock(o,d,w.range), hit=null, head=false;
    for(const tg of targets){
      const ch=_c3.copy(tg.pos).addScaledVector(tg.up,tg.h);
      let t=raySphere(o,d,ch,tg.r); if(t>0 && t<best){ best=t; hit=tg; head=false; }
      if(tg.kind!=='police' || tg.u.type==='officer'){ const hd=_c3.copy(tg.pos).addScaledVector(tg.up,tg.h+.65); t=raySphere(o,d,hd,.26); if(t>0 && t<=best){ best=t; hit=tg; head=true; } }
    }
    const end=o.clone().addScaledVector(d,best);
    tracer(muzzle,end, id==='rifle'?0x7ff6ff:0xfff0a0);
    if(hit) applyHit(hit, w.dmg*(head?2:1)); else if(best<w.range) spark(end);
  }
  combat.flash.position.copy(muzzle); combat.flash.intensity=3;
  if(id==='shotgun'){ noise({dur:.3,vol:.45,freq:900}); tone({type:'sine',f0:120,f1:40,dur:.25,vol:.3}); }
  else if(id==='rifle'){ tone({type:'square',f0:1400,f1:300,dur:.07,vol:.07}); noise({dur:.06,vol:.12,filter:'highpass',freq:2000}); }
  else { noise({dur:.18,vol:.32,freq:1400}); tone({type:'sine',f0:180,f1:60,dur:.12,vol:.2}); }
  city.pitch += combat.aiming ? .012 : .02;
  if(clipOf(id)===0 && qty(w.ammo)>0) setTimeout(reloadWeapon, 250);
  updateWeaponHUD();
}
function doMelee(heavy){
  const [id,w]=curWeapon(); if(combat.cool>0) return;
  const cost=heavy?14:5; if(surv.st<cost && surv.boost<=0){ toast('Sem energia para golpear', '#ffd040'); return; }
  if(surv.boost<=0) surv.st-=cost; surv.regenWait=.8;
  if(combat.comboT<=0) combat.combo=0; combat.combo=combat.combo%3+1; combat.comboT=.8;
  const mult = heavy?2.6:[1,1.15,1.8][combat.combo-1];
  combat.cool = w.rate*(heavy?1.6:1); surv.punchAnim=.2; combat.faceT=.6;
  noise({dur:.08,vol:.08,filter:'highpass',freq:heavy?900:1800});
  if(id==='baton') tone({type:'sawtooth',f0:300,f1:900,dur:.1,vol:.05});
  const P=city.player.position, fwd=_c1.set(Math.sin(city.heading),0,Math.cos(city.heading)).applyQuaternion(city.frame.q);
  let best=null, bd=99;
  for(const tg of combatTargets()){ if(tg.kind==='police' && tg.u.type!=='officer') continue;
    const v=_c2.subVectors(tg.pos,P), d=v.length(); if(d>w.range+.3) continue; if(v.normalize().dot(fwd)<.35) continue; if(d<bd){ bd=d; best=tg; } }
  if(best){ applyHit(best, w.dmg*mult, { melee:true, stun:w.stun?(heavy?3:w.stun):(heavy||combat.combo===3?1:0) }); city.shake=.15; }
}
function dodge(){
  if(!onFootNow() || combat.dodgeT>0) return;
  if(surv.st<18 && surv.boost<=0){ toast('Sem energia para esquivar', '#ffd040'); return; }
  if(surv.boost<=0) surv.st-=18; surv.regenWait=.9;
  let mx=0, mz=0; if(keys.KeyW) mz+=1; if(keys.KeyS) mz-=1; if(keys.KeyA) mx-=1; if(keys.KeyD) mx+=1; if(!mx&&!mz) mz=-1;
  const fx=-Math.sin(city.yaw), fz=-Math.cos(city.yaw), rx=Math.cos(city.yaw), rz=-Math.sin(city.yaw);
  combat.dodgeDir.set(fx*mz+rx*mx,0,fz*mz+rz*mx).normalize().applyQuaternion(city.frame.q);
  combat.dodgeT=.3; combat.iframe=.4; noise({dur:.2,vol:.12,filter:'bandpass',freq:700});
}
function applyHit(tg, dmg, o={}){
  combat.hitT=.15; sfx.hit();
  if(tg.kind==='npc'){ const n=tg.n; n.hp=(n.hp??30)-dmg;
    if(n.hp<=0){ knockNPC(n,20); n.hp=undefined; crime(2,'Homicídio'); }
    else { if(o.melee||dmg>12) knockNPC(n,3); crime(1, o.melee?'Agressão':'Disparo contra civil'); } }
  else if(tg.kind==='police'){ const u=tg.u, mx={officer:60,drone:40,car:160}; u.hp=(u.hp??mx[u.type])-dmg;
    if(o.stun && u.type==='officer') u.stun=Math.max(u.stun||0,o.stun);
    if(u.hp<=0){ u.site.group.remove(u.g); surv.units.splice(surv.units.indexOf(u),1); noise({dur:.5,vol:.35,freq:500}); crime(2,'Policial abatido'); }
    else crime(1,'Agressão a policial'); }
  else damageEnemy(tg.e, dmg, o);
}

// ---------------------------------------------------------------- efeitos
function tracer(a,b,color){ const g=new THREE.BufferGeometry().setFromPoints([a.clone(),b.clone()]); const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.9})); city.scene.add(l); combat.fx.push({o:l,life:.07,dispose:true}); }
function spark(p,color=0xffd080){ const m=new THREE.Mesh(sparkGeo,B(color)); m.position.copy(p); city.scene.add(m); combat.fx.push({o:m,life:.14}); }
function updateFx(dt){
  for(let i=combat.fx.length-1;i>=0;i--){ const f=combat.fx[i]; f.life-=dt; if(f.life<=0){ city.scene.remove(f.o); if(f.dispose) f.o.geometry.dispose(); combat.fx.splice(i,1); } }
  if(combat.flash) combat.flash.intensity=Math.max(0,combat.flash.intensity-40*dt);
}

// ---------------------------------------------------------------- inimigos (IA)
function makeEnemyModel(species, style, weapon){
  const g=makeNPC(species||'human');
  const band = style==='gang'?0xc82a2a : style==='bandit'?0x8a6a3a : style==='target'?0xffd040 : 0x3a3a44;
  box(.72,.14,.4,M(band),0,1.52,0,g);
  if(weapon==='melee') box(.06,.06,.75,M(0x6a6a72,{metalness:.6}),-.42,1.1,.38,g);
  else box(.09,.15,weapon==='pistol'?.38:.75,M(0x1a1a1e,{metalness:.5}),-.42,1.15,.32,g);
  return g;
}
function spawnEnemy(posW, o){
  const g=makeEnemyModel(o.species, o.style, o.weapon); city.scene.add(g);
  const e = { g, F:makeFrame(), hp:o.hp||70, maxHp:o.hp||70, style:o.style, weapon:o.weapon, W:EN_W[o.weapon], faction:o.faction, name:o.name||null,
    state:'idle', home:new V3(), fireT:rand(.5,1.5), shots:0, reloadT:0, stun:0, strafe:Math.random()<.5?1:-1, heading:rand(0,6),
    walk:0, wanderT:0, wdir:new V3(), meleeT:0, loot:o.loot??true, bounty:!!o.bounty, hostileAlways:!!o.hostile, aggro:o.aggro||40, owner:o.owner||null };
  groundAt(posW,_ep,_eu); g.position.copy(_ep); e.F.q.setFromUnitVectors(Y_AXIS,_eu); e.F.up.copy(_eu); e.home.copy(_ep);
  combat.enemies.push(e); return e;
}
function removeEnemy(e){ city.scene.remove(e.g); const i=combat.enemies.indexOf(e); if(i>=0) combat.enemies.splice(i,1); }
function damageEnemy(e, dmg, o={}){
  if(e.state==='dead') return;
  e.hp-=dmg; if(e.faction) combat.hostile[e.faction]=true;
  if(e.state==='idle') e.state='alert';
  if(o.stun) e.stun=Math.max(e.stun,o.stun);
  if(e.hp<=0) return enemyDie(e);
  if(e.bounty && e.state!=='surrender' && e.hp < e.maxHp*.22){ e.state='surrender'; e.stun=0; toast(`${e.name} se rendeu! [E] para algemar`, '#7dff9a'); }
}
function enemyDie(e){
  e.state='dead'; e.stun=0; noise({dur:.3,vol:.2,freq:400});
  e.g.quaternion.copy(e.F.q).multiply(qYaw(e.heading)).multiply(_cqk.setFromAxisAngle(_c1.set(1,0,0),-Math.PI/2));
  e.g.position.addScaledVector(e.F.up,.3);
  if(e.bounty) bountyKilled(e);
}
function updateEnemies(dt, t){
  const P=playerWorld(), up = city.drive ? city.drive.F.up : city.fly ? city.fly.F.up : city.frame.up;
  const chest=_c1.copy(P).addScaledVector(up,1.2).clone(), onFoot=!city.drive && !city.fly;
  for(const e of combat.enemies){
    if(e.state==='dead') continue;
    const g=e.g, pos=g.position;
    if(e.state==='surrender'){ g.userData.legL.rotation.x=1.3; g.userData.legR.rotation.x=1.3; continue; }
    if(e.stun>0){ e.stun-=dt; g.quaternion.copy(e.F.q).multiply(qYaw(e.heading)).multiply(_cqk.setFromAxisAngle(_c2.set(1,0,0),-Math.PI/2)); continue; }
    const toP=_c2.subVectors(P,pos); toP.addScaledVector(e.F.up,-toP.dot(e.F.up)); const d=toP.length();
    const hostile = e.hostileAlways || combat.hostile[e.faction];
    if(e.state==='idle' && hostile && d<e.aggro && !city.fly){ e.state='alert'; if(e.style!=='bandit') tone({type:'square',f0:300,f1:500,dur:.15,vol:.04}); }
    if(e.state==='alert' && (city.fly || d>e.aggro*3)) e.state='idle';
    if(e.state==='alert' && !e.bounty && e.hp<e.maxHp*.25) e.state='flee';
    const mv=new V3(); let sp=0;
    if(e.state==='idle'){
      e.wanderT-=dt;
      if(e.wanderT<=0){ e.wanderT=rand(2,5); const back=_c4.subVectors(e.home,pos);
        if(back.length()>10) e.wdir.copy(back).normalize(); else if(Math.random()<.5) e.wdir.set(0,0,0); else e.wdir.set(rand(-1,1),0,rand(-1,1)).normalize().applyQuaternion(e.F.q); }
      mv.copy(e.wdir); sp = e.wdir.lengthSq()>0 ? 1.1 : 0;
    } else if(e.state==='flee'){ mv.copy(toP).negate(); sp=5; if(d>90) e.state='idle'; }
    else {
      const dirP=_c4.copy(toP).normalize();
      if(e.weapon==='melee'){ if(d>1.4){ mv.copy(dirP); sp=4.6; } }
      else {
        if(d>e.W.range*.65){ mv.copy(dirP); sp=3.8; }
        else if(d<6){ mv.copy(dirP).negate(); sp=2.4; }
        else { mv.crossVectors(dirP,e.F.up).multiplyScalar(e.strafe); sp=1.7; if(Math.random()<.008) e.strafe*=-1; }
      }
      // ataque
      if(e.weapon==='melee'){ e.meleeT-=dt; if(d<1.8 && e.meleeT<=0 && onFoot){ e.meleeT=e.W.rate; playerDamage(e.W.dmg, `Golpe de ${e.name||'bandido'}`); } }
      else if(d<e.W.range){
        if(e.reloadT>0) e.reloadT-=dt;
        else { e.fireT-=dt; if(e.fireT<=0){ e.fireT=e.W.rate*rand(.8,1.4);
          const eye=_c4.copy(pos).addScaledVector(e.F.up,1.4).clone();
          if(!blockedBetween(eye,chest)) enemyShoot(e,eye,chest,d); } }
      }
    }
    if(sp>0 && mv.lengthSq()>0){
      const prev=pos.clone(); pos.addScaledVector(mv.normalize(), sp*dt); collideWorld(pos,.4,false);
      groundAt(pos,_ep,_eu); if(groundWater) pos.copy(prev); else { pos.copy(_ep); transport(e.F,_eu); }
      e.walk += dt*sp*2.5;
    } else e.walk*=.8;
    const face = e.state==='alert' ? toP : mv.lengthSq()>0 ? mv : null;
    if(face && face.lengthSq()>1e-4){ _c4.copy(face).applyQuaternion(_cqi.copy(e.F.q).invert()); e.heading=lerpAngle(e.heading, Math.atan2(_c4.x,_c4.z), Math.min(1,8*dt)); }
    g.quaternion.copy(e.F.q).multiply(qYaw(e.heading));
    const sw=Math.sin(e.walk)*.6*(sp>0?1:0); g.userData.legL.rotation.x=sw; g.userData.legR.rotation.x=-sw;
  }
}
function enemyShoot(e, eye, chest, d){
  e.shots++; if(e.shots>=e.W.mag){ e.reloadT=2; e.shots=0; }
  let chance = e.W.acc - d/120 - (combat.pSpeed>3 || city.drive ? .2 : 0); if(combat.iframe>0) chance=0; chance=clamp(chance,.05,.85);
  const hit = Math.random()<chance, end = hit ? chest : chest.clone().add(_c3.set(rand(-1.5,1.5),rand(-.8,1.5),rand(-1.5,1.5)));
  tracer(eye, end, 0xff6a4a);
  if(e.weapon==='shotgun') noise({dur:.25,vol:.25,freq:800}); else tone({type:'square',f0:e.weapon==='rifle'?1100:700,f1:200,dur:.08,vol:.05});
  if(hit) playerDamage(e.W.dmg*(city.drive?.5:1), `Tiro de ${e.name || (e.style==='gang'?'gangue':'bandido')}`);
}

// ---------------------------------------------------------------- gangues de Porto Ferrugem
const GANG_TURFS = [ { x:-98, z:46 }, { x:118, z:-98 }, { x:46, z:118 } ];
function initTurfs(){ combat.turfs = GANG_TURFS.map((t,i)=>({ ...t, i, spawned:false, ents:[], inT:0, warned:false })); }
function updateTurfs(dt, P){
  if(CUR_P.id!=='aurora') return;                       // gangues só em Porto Ferrugem
  const s=SITES[1], far=s.center.distanceTo(P)>1500;
  if(far){ combat.hostile.ratos=false; }
  for(const tf of combat.turfs){
    const c=toWorld(s,_c1.set(tf.x,0,tf.z),new V3()), d=c.distanceTo(P);
    if(!tf.spawned && d<300){ tf.spawned=true; tf.ents=[];
      const ws=['pistol','melee','rifle','pistol','shotgun'];
      for(let k=0;k<4;k++) tf.ents.push(spawnEnemy(toWorld(s,_c2.set(tf.x+rand(-5,5),0,tf.z+rand(-5,5)),new V3()),
        { style:'gang', faction:'ratos', weapon:ws[(k+tf.i)%ws.length], hp:70, species:['human','human','oskari','vexari'][k], aggro:32, owner:'turf' })); }
    if(tf.spawned && d>600){ tf.ents.forEach(removeEnemy); tf.ents=[]; tf.spawned=false; }
    if(!tf.spawned) continue;
    if(d<22 && !combat.hostile.ratos && !city.fly){
      tf.inT+=dt;
      if(!tf.warned){ tf.warned=true; toast('"Território dos Ratos de Ferrugem. Some daqui!"', '#ff6a5a'); }
      if(tf.inT>5){ combat.hostile.ratos=true; toast('Os Ratos de Ferrugem atacam!', '#ff4a4a'); }
    } else { tf.inT=Math.max(0,tf.inT-dt); if(d>60) tf.warned=false; }
  }
}

// ---------------------------------------------------------------- acampamentos de bandidos nas áreas selvagens
const CAMP_RESPAWN = 30*60*1000;
function initCamps(){
  const C=CUR_P.camps, rng=seeded(C.seed), d=new V3(), pre=CUR_P.id==='aurora'?'':CUR_P.id+':';
  for(let k=0;k<C.n;k++){
    for(let tries=0;tries<60;tries++){
      d.set(rng()*2-1,rng()*2-1,rng()*2-1).normalize();
      if(k<6){ d.copy(SITES[k%SITES.length].up).addScaledVector(_c1.set(rng()*2-1,rng()*2-1,rng()*2-1),.25).normalize(); }   // alguns perto das cidades
      const r=groundR(d); if(r<seaR()+8) continue;
      if(SITES.some(s=>Math.acos(clamp(d.dot(s.up),-1,1))*PLANET.R < Math.min(4500, PLANET.R*.15))) continue;
      combat.camps.push({ id:pre+'camp'+k, d:d.clone(), pos:PC.clone().addScaledVector(d,r), g:null, ents:[], spawned:false, crate:false });
      break;
    }
  }
}
function buildCampMesh(c){
  const g=new THREE.Group(), tent=M(0x8a6a4a), tent2=M(0x6a4a3a);
  [[6,4],[-6,3],[2,-7]].forEach(([x,z],i)=>{ const m=new THREE.Mesh(new THREE.ConeGeometry(2.4,3,4),i%2?tent2:tent); m.position.set(x,1.5,z); m.rotation.y=.7; g.add(m); });
  const fire=new THREE.Mesh(new THREE.ConeGeometry(.6,1.2,5),B(0xff8a3a)); fire.position.y=.6; g.add(fire);
  const fl=new THREE.PointLight(0xff8a3a,1.4,22); fl.position.y=2; g.add(fl);
  c.crateMesh=box(1.4,1,1,M(0x5a4a30),-2,.5,4,g); box(1.42,.15,1.02,M(0xd8a020),-2,.75,4,g);
  placeOnPlanet(g,c.pos,0); city.scene.add(g); g.updateMatrixWorld(true); c.g=g;
}
function updateCamps(P){
  for(const c of combat.camps){
    const d=c.pos.distanceTo(P), cleared = state.camps[c.id] && Date.now()-state.camps[c.id] < CAMP_RESPAWN;
    if(d<1600 && !c.g) buildCampMesh(c);
    if(d>2600 && c.g){ city.scene.remove(c.g); c.g=null; }
    if(d<330 && !cleared && !c.spawned && !city.fly){ c.spawned=true; c.ents=[];
      const ws=['rifle','pistol','melee','shotgun'], n=3+((c.id.length+Math.floor(c.pos.x))%2);
      for(let k=0;k<n;k++){ const off=_c1.set(rand(-9,9),0,rand(-9,9)).applyQuaternion(c.g?c.g.quaternion:_cqk.identity());
        c.ents.push(spawnEnemy(c.pos.clone().add(off), { style:'bandit', faction:c.id, weapon:ws[k%4], hp:CUR_P.camps.hp, hostile:true, aggro:45, species:['human','oskari','human','vexari'][k%4], owner:'camp' })); }
      if(!combat.campNote[c.id]){ combat.campNote[c.id]=true; toast('Acampamento de bandidos à vista!', '#ff6a5a'); }
    }
    if(c.spawned && d>800){ c.ents.forEach(removeEnemy); c.ents=[]; c.spawned=false; }
    if(c.spawned && !cleared && c.ents.length && c.ents.every(e=>e.state==='dead')){ state.camps[c.id]=Date.now(); c.crate=true; save(); toast('Acampamento limpo! Revista a caixa de suprimentos [E]', '#7dff9a'); sfx.coin(); }
  }
}

// ---------------------------------------------------------------- interações de combate (saque, caixa)
function combatInteractables(P){
  const L=[];
  for(const e of combat.enemies){ const d=P.distanceTo(e.g.position);
    if(e.state==='dead' && e.loot && d<2.4) L.push({ d, r:2.4, prio:true, label:'[E] Revistar', fn:()=>lootBody(e) }); }
  for(const c of combat.camps) if(c.crate && c.g){ const p=c.crateMesh.getWorldPosition(new V3()), d=P.distanceTo(p); if(d<3) L.push({ d, r:3, label:'[E] Abrir caixa de suprimentos', fn:()=>openCrate(c) }); }
  return L;
}
function lootBody(e){
  e.loot=false; const cr=Math.round(rand(10,45)); state.credits+=cr;
  const [, w]=curWeapon(), got=[`${CUR}${cr}`];
  if(!w.melee && Math.random()<.7){ const n=Math.round(rand(4,12)*(w.ammo==='ammo_r'?2.5:1)); addItem(w.ammo,n); got.push(`${n} ${ITEMS[w.ammo].name}`); }
  if(Math.random()<.25){ addItem('herbs',1); got.push('1 Ervas'); }
  sfx.coin(); toast('Encontrado: '+got.join(' · '), '#7dff9a'); save(); updateHUD(); updateWeaponHUD();
}
function openCrate(c){
  c.crate=false; const cr=Math.round(rand(80,200)); state.credits+=cr;
  const ore=['ore_iron','ore_copper','crystal'][(Math.random()*3)|0], n=1+((Math.random()*3)|0);
  addItem(ore,n); addItem('ammo_p',16); if(Math.random()<.4) addItem('ammo_s',6); if(Math.random()<.3) addItem('ammo_r',30);
  sfx.coin(); toast(`Caixa: ${CUR}${cr} · ${n} ${ITEMS[ore].name} · munição`, '#7dff9a'); save(); updateHUD(); updateWeaponHUD();
}

// ---------------------------------------------------------------- laço e HUD de combate
let weaponKey='';
function updateWeaponHUD(){
  const el=document.getElementById('weapon'), show = mode==='city' && !city.drive && !city.fly && !city.launch;
  const [id,w]=curWeapon();
  const key=[show,id,clipOf(id),w.ammo?qty(w.ammo):0,combat.reloadT>0].join();
  if(key===weaponKey) return; weaponKey=key;
  el.style.display = show ? 'block' : 'none';
  el.innerHTML = `<div class="wn">${w.name}</div>` + (w.melee ? `<div class="wa">corpo a corpo</div>` :
    `<div class="wa">${combat.reloadT>0?'RECARREGANDO…':`<b>${clipOf(id)}</b> / ${qty(w.ammo)}`}</div>`);
}
function updateCombat(dt, t){
  if(mode!=='city') return;
  for(const k of ['cool','comboT','iframe','dodgeT','faceT','hitT']) combat[k]=Math.max(0,combat[k]-dt);
  if(combat.reloadT>0){ combat.reloadT-=dt; if(combat.reloadT<=0){ combat.reloadT=0; finishReload(); } }
  const P=playerWorld();
  if(combat.lastP) combat.pSpeed = combat.lastP.distanceTo(P)/Math.max(dt,1e-3); combat.lastP = P.clone();
  const onFoot=onFootNow();
  if(!onFoot){ combat.aiming=false; combat.firing=false; combat.holding=false; }
  if(onFoot && combat.firing && !ui.panel && combat.cool<=0 && combat.reloadT<=0){
    const [,w]=curWeapon(); if(!w.melee && (w.auto || !combat.fired)){ fireWeapon(); combat.fired=true; } }
  if(combat.holding) combat.holdT+=dt;
  updateEnemies(dt,t); updateTurfs(dt,P); updateCamps(P); updateFx(dt);
  const ch=document.getElementById('crosshair'), [,w]=curWeapon();
  const showCh = onFoot && !w.melee && !ui.panel;
  ch.style.display = showCh ? 'block' : 'none';
  if(showCh){ ch.style.left='50%'; ch.style.top='50%'; ch.classList.toggle('hit', combat.hitT>0); ch.classList.toggle('aim', combat.aiming); }
  updateWeaponHUD();
}
function combatDown(btn){
  if(!onFootNow() || ui.panel) return;
  if(btn===2){ combat.aiming=true; return; }
  if(btn===0){ const [,w]=curWeapon(); if(w.melee){ combat.holding=true; combat.holdT=0; } else { combat.firing=true; combat.fired=false; combat.faceT=1.2; } }
}
function combatUp(btn){
  if(btn===2){ combat.aiming=false; return; }
  if(btn===0){ combat.firing=false; if(combat.holding){ combat.holding=false; if(onFootNow()) doMelee(combat.holdT>.45); } }
}
function* combatMapDots(){
  for(const e of combat.enemies) if(e.state!=='dead') yield [e.g.position, e.bounty?'#ffd040':'#ff7a3a'];
  for(const c of combat.camps){ const cleared=state.camps[c.id] && Date.now()-state.camps[c.id]<CAMP_RESPAWN; if(!cleared) yield [c.pos,'camp']; }
}
