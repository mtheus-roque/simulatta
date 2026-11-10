'use strict';
/* Controle de Chamada (tecla K): chama a nave (pouso em piloto automático) ou um carro (Aurora) até perto do jogador. */

const _rm=new V3(), _rgp=new V3(), _rgu=new V3(), _rq=new THREE.Quaternion();
const shipHere = () => (state.shipLoc||'aurora')===CUR_P.id && !!city.ship;
const canSummon = () => mode==='city' && !city.drive && !city.fly && !city.launch && !city.summon && qty('remote')>0;

// ponto livre no chão ao redor do jogador: fora de prédios e da água, de preferência à frente dele
function summonSpot(dist, clear){
  const P=city.player.position, F=city.frame;
  for(let k=0;k<24;k++){
    const ang = city.heading + (k%2?1:-1)*Math.ceil(k/2)*Math.PI/12, d = dist*(k<16?1:1.6);
    const p = _rm.set(Math.sin(ang)*d,0,Math.cos(ang)*d).applyQuaternion(F.q).add(P);
    const s = groundAt(p, _rgp, _rgu); if(!s && groundWater) continue;
    if(s){ const l=toLocal(s,_rgp,new V3()); if(insideBoxLocal(s,l.x,.5,l.z,clear)) continue; if(s.circles.some(c=>Math.hypot(c.x-l.x,c.z-l.z)<c.r+clear*.5)) continue; }
    return { p:_rgp.clone(), up:_rgu.clone(), ang };
  }
  return null;
}
function summon(what){
  if(!canSummon()){ toast(mode!=='city' ? 'O controle só funciona em solo, a pé' : city.summon ? 'Um veículo já está a caminho' : 'Saia do veículo para usar o controle', '#ff4a4a'); sfx.error(); return; }
  closePanel();
  const F=city.frame;
  if(what==='ship'){
    if(!shipHere()){ toast(state.shipLoc==='station' ? 'Sua nave está atracada na Estação Beta' : 'Sua nave não está neste planeta', '#ff4a4a'); sfx.error(); return; }
    if(city.ship.g.position.distanceTo(city.player.position)<30){ toast('Sua nave já está aqui', '#ffb347'); return; }
    const sp=summonSpot(17, 6); if(!sp){ toast('Sem espaço livre para a nave pousar aqui', '#ff4a4a'); sfx.error(); return; }
    const lift=shipLift(city.shipModel), yaw=sp.ang+Math.PI/2;
    const to=sp.p.clone().addScaledVector(sp.up, lift), back=_rm.set(Math.sin(sp.ang),0,Math.cos(sp.ang)).applyQuaternion(F.q).clone();
    city.summon={ kind:'ship', t:0, dur:5, to, from:to.clone().addScaledVector(sp.up,170).addScaledVector(back,160), q:F.q.clone(), up:F.up.clone(), yaw };
    noise({dur:4,vol:.25,freq:200}); tone({type:'sawtooth',f0:140,f1:60,dur:4.5,vol:.06});
    toast(`${SHIPS[city.shipModel].name} a caminho — piloto automático`, '#5ef2ff');
    return;
  }
  const v=city.vehicles[what]; if(!v){ toast('Carros ficam em Aurora', '#ff4a4a'); sfx.error(); return; }
  if(v.g.position.distanceTo(city.player.position)<12){ toast(`${v.def.name} já está aqui`, '#ffb347'); return; }
  const a=summonSpot(55,2.5), b=summonSpot(7,2); if(!a||!b){ toast('Sem espaço livre para o carro chegar aqui', '#ff4a4a'); sfx.error(); return; }
  city.summon={ kind:'car', v, t:0, dur:3.2, from:a.p, to:b.p };
  engineStart(v.def.kind); toast(`${v.def.name} a caminho — direção autônoma`, '#5ef2ff');
}
function updateSummon(dt){
  const S=city.summon; if(!S) return;
  S.t+=dt; const k=smooth01(Math.min(1,S.t/S.dur));
  if(S.kind==='ship'){
    const sh=city.ship, P=sh.g.position;
    P.lerpVectors(S.from, S.to, k).addScaledVector(S.up, Math.sin(k*Math.PI)*25*(1-k));
    sh.g.quaternion.copy(S.q).multiply(qYaw(S.yaw)).multiply(_rq.setFromAxisAngle(_rm.set(1,0,0), -.35*(1-k)));
    sh.flames.forEach(f=>f.scale.set(1,.3+1.6*(1-k)+Math.random()*.2,1)); sh.light.intensity=.4+1.5*(1-k); sh.model.visible=true;
    if(S.t>=S.dur){
      state.ship={ p:S.to.toArray(), q:S.q.toArray(), up:S.up.toArray(), yaw:S.yaw, pad:null }; state.shipLoc=CUR_P.id; save();
      city.summon=null; syncHangarShip(); sfx.door(); toast('Nave pousada ao seu lado · [E] embarcar', '#7dff9a');
    }
    return;
  }
  const v=S.v, F=city.frame;
  _rm.lerpVectors(S.from, S.to, k); groundAt(_rm, _rgp, _rgu); v.g.position.copy(_rgp);
  v.F.q.copy(F.q); v.F.up.copy(F.up); transport(v.F, _rgu);
  const dir=_rm.subVectors(S.to,S.from).applyQuaternion(_rq.copy(F.q).invert()); v.yaw=Math.atan2(-dir.x,-dir.z);
  v.g.quaternion.copy(v.F.q).multiply(qYaw(v.yaw));
  const spd=S.dur>0 ? S.from.distanceTo(S.to)/S.dur*(1-Math.abs(k-.5)) : 0; engineUpdate(Math.min(1,spd/30));
  for(const w of v.wheels) w.rotation.x -= spd*dt/w.userData.r;
  if(S.t>=S.dur){
    v.speed=0; state.vpos[v.id]={ p:v.g.position.toArray(), q:v.F.q.toArray(), up:v.F.up.toArray(), yaw:v.yaw }; save();
    city.summon=null; engineStop(); sfx.door(); toast(`${v.def.name} chegou · [E] dirigir`, '#7dff9a');
  }
}

// ---------------------------------------------------------------- painel do controle
function renderRemote(){
  if(qty('remote')<=0) return `<div class="empty">Você não tem um Controle de Chamada.</div>`;
  const P = mode==='city' ? city.player.position : null;
  const row=(name, sub, id, ok)=>`<div class="item"><div><div>${name}</div><div class="d">${sub}</div></div>
    <button class="btn g" data-a="summon" data-v="${id}" ${ok&&canSummon()?'':'disabled'}>CHAMAR</button></div>`;
  let h = `<p class="d">${mode!=='city' ? 'O controle só funciona em solo, a pé — na cidade, nos postos ou nas áreas selvagens.' : city.drive||city.fly ? 'Saia do veículo para chamar outro.' : 'Escolha o que chamar até a sua posição.'}</p>`;
  const sm=SHIPS[activeShip().model].name;
  if(shipHere()) h += row(`✈ ${sm}`, `Pousa em piloto automático ao seu lado${P?` · está a ${fmtKm(city.ship.g.position.distanceTo(P))}`:''}.`, 'ship', true);
  else h += row(`✈ ${sm}`, state.shipLoc==='station' ? 'Atracada na Estação Beta.' : (state.shipLoc==='flying' ? 'Em voo.' : 'Em outro planeta.'), 'ship', false);
  for(const id of state.vehicles){ const vd=VEHICLES[id], v=city.vehicles[id];
    h += row(`⛟ ${vd.name}`, CUR_P.id!=='aurora' ? 'Ficou em Aurora.' : v && P ? `Vem dirigindo sozinho · está a ${fmtKm(v.g.position.distanceTo(P))}.` : 'Disponível na cidade.', id, CUR_P.id==='aurora' && !!v); }
  return h + `<p class="d" style="margin-top:12px">Atalho: <kbd>K</kbd>. O veículo procura um ponto livre perto de você — fora de prédios e da água.</p>`;
}
