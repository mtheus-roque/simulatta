'use strict';
/* Modos de jogo (título, apartamento, planeta Aurora, órbita), input e loop principal */

// ================================================================ MODOS
let mode='title';
function hudFor(m){
  const on = m==='city' ? ['loc','minimap'].concat(city.fly?['aim']:[]) : m==='flight' ? ['flightstats','crosshair','aim'] : [];
  ['flightstats','crosshair','aim','mk-gate','mk-station','mk-home','mk-hangar','mk-obj','loc','minimap','alt','center','minebar']
    .forEach(id=>document.getElementById(id).style.display = on.includes(id) ? 'block' : 'none');
  document.getElementById('mk-station').style.color='';
  droneMk.forEach(m=>m.style.display='none');
  vitalsKey=''; weaponKey='';
  if(m!=='city'){ document.getElementById('weapon').style.display='none'; combat.aiming=false; combat.firing=false; }
}
function enterHub(){
  mode='hub'; hub.player.position.set(EL_POS.x-1.4, 0, EL_POS.z); hub.player.rotation.y=-Math.PI/2; hub.yaw=Math.PI/2; hub.pitch=settings.fp?0:.3;
  hudFor('hub'); updateHUD();
}
function enterCity(where){
  if(city.launch) endLaunch();
  mode='city'; cityPlace(where); hudFor('city'); updateHUD();
}
function goCity(where){
  if(hub.carry) hubCarry();
  sfx.door(); toast('Elevador descendo ao térreo...', '#ffb347');
  transition(()=>{ enterCity(where); toast('Nova Kessler, planeta Aurora · o Hangar 07 fica a leste (H no mapa)', '#5ef2ff'); });
}
function goHub(){ sfx.door(); transition(()=>{ enterHub(); toast('Apartamento 07 · 80º andar', '#ffb347'); }); }
function reachOrbit(){
  endLaunch(); city.fly=null; engineStop();
  mode='flight'; resetFlight(); hudFor('flight'); updateHUD();
  toast(`Órbita alcançada · ${SHIPS[activeShip().model].name} · Setor Kessler`, '#5ef2ff');
}

// ================================================================ INPUT
const keys={}, mouse={}; let mouseDown=false, lockLostAt=0;
const keysReset = ()=>{ for(const k in keys) keys[k]=false; mouseDown=false; };
const isLocked = ()=> document.pointerLockElement===canvas;
function lock(){
  if(mode==='title' || ui.panel || isLocked()) return;
  try{ const p=canvas.requestPointerLock(); if(p && p.catch) p.catch(()=>{}); }catch(e){}
}
function updateLockHint(){ document.getElementById('lockhint').style.display = (mode!=='title' && !ui.panel && !isLocked()) ? 'block' : 'none'; }
document.addEventListener('pointerlockchange', ()=>{
  if(!isLocked()){ lockLostAt=performance.now(); mouseDown=false;
    if(!ui.panel && mode!=='title' && !transitioning) openPanel('settings'); }   // Esc solta o mouse -> abre configurações
  updateLockHint();
});
function pitchLimits(){ return settings.fp ? [-1.3,1.3] : mode==='city' && city.drive ? [-.2,.9] : [-.35,1.2]; }
function look(dx, dy){
  const s = settings.sens*.0022, inv = settings.invertY?-1:1, [lo,hi]=pitchLimits();
  if(mode==='hub'){ hub.yaw -= dx*s; hub.pitch = clamp(hub.pitch + dy*s*inv, lo, hi); }
  else if(mode==='city' && !city.launch){
    if(city.fly){ city.fly.aimYaw -= dx*s*.8; city.fly.aimPitch -= dy*s*.8*inv; return; }
    if(city.drive){ city.camOff -= dx*s; city.lookT = 1.2; } else city.yaw -= dx*s;
    city.pitch = clamp(city.pitch + dy*s*inv, lo, hi);
  }
  else if(mode==='flight' && !fl.dead){ fl.aimYaw -= dx*s*.8; fl.aimPitch -= dy*s*.8*inv; }
}
addEventListener('mousemove', e=>{ if(isLocked() && !ui.panel) look(e.movementX||0, e.movementY||0); });
canvas.addEventListener('mousedown', e=>{
  if(!isLocked()){ lock(); return; }
  if(e.button===0) mouseDown=true;
  if(mode==='city') combatDown(e.button);        // esquerdo: atirar / golpear (segure para golpe forte) · direito: mirar
});
canvas.addEventListener('contextmenu', e=>e.preventDefault());
document.getElementById('lockhint').style.pointerEvents='auto';
document.getElementById('lockhint').addEventListener('click', lock);
addEventListener('mouseup', e=>{ if(e.button===0) mouseDown=false; combatUp(e.button); });
addEventListener('keydown', e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
  keys[e.code]=true;
  if(e.repeat) return;
  if(mode==='title'){ if(e.code==='Enter'||e.code==='Space') start(); return; }
  if(e.code==='Escape'){
    if(performance.now()-lockLostAt < 300) return;
    if(ui.panel) closePanel(); else openPanel('settings');
    return;
  }
  if(e.code==='KeyI') return togglePanel('inv');
  if(e.code==='KeyP') return togglePanel('shop');
  if(e.code==='KeyQ') return togglePanel('contracts');
  if(ui.panel) return;
  if(e.code==='KeyV'){
    settings.fp = !settings.fp; saveSettings(); sfx.ui();
    const [lo,hi]=pitchLimits();
    if(settings.fp){ hub.pitch=0; city.pitch=0; }
    else { hub.pitch=clamp(Math.max(hub.pitch,.15),lo,hi); city.pitch=clamp(Math.max(city.pitch,.15),lo,hi); }
    toast(settings.fp ? 'Visão em 1ª pessoa' : 'Visão em 3ª pessoa', '#5ef2ff');
    return;
  }
  if(mode==='hub'){
    if(e.code==='KeyE') hubInteract();
    if(e.code==='KeyG') hubCarry();
    if(e.code==='KeyR' && hub.carry){ hub.carryRot += Math.PI/4; sfx.ui(); }
  }
  if(mode==='city' && work.mini && miniKey(e.code)) return;      // minijogo de manutenção (setas)
  if(mode==='city' || mode==='hub'){ const n=['Digit1','Digit2','Digit3','Digit4'].indexOf(e.code); if(n>=0) return selectWeapon(n+1); }
  if(mode==='city'){
    if(e.code==='KeyR') reloadWeapon();
    if(e.code==='KeyC') dodge();
    if(e.code==='KeyE') cityInteract();
    if(e.code==='KeyO' && city.fly && (city.fly.alt||0)>150) startAscent();
    if(e.code==='Enter' && city.launch) city.launch.skip = true;
  }
});
addEventListener('keyup', e=>{ keys[e.code]=false; });
addEventListener('blur', keysReset);
addEventListener('resize', ()=>{
  renderer.setSize(innerWidth, innerHeight);
  [hub.cam, fl.cam, city.cam].forEach(c=>{ c.aspect=innerWidth/innerHeight; c.updateProjectionMatrix(); });
});
function start(){
  initAudio(); if(actx && actx.state==='suspended') actx.resume();
  document.getElementById('title').style.display='none'; document.getElementById('hud').style.display='block';
  enterHub(); hub.player.position.set(0,0,2.5); hub.player.rotation.y=Math.PI; hub.yaw=0; hub.pitch=settings.fp?0:.3;
  toast(state.completed||state.kills ? 'Bem-vindo de volta, piloto.' : 'Apartamento 07, Torre Kessler. O elevador leva à rua — e ao planeta inteiro.', '#ffb347');
  lock(); updateLockHint();
}
document.getElementById('start').addEventListener('click', start);

// ================================================================ LOOP
buildHub(); buildFlight(); buildCity(); initCombat(); applySettings(); updateHUD();
const clock = new THREE.Clock(); let T=0;
(function loop(){
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), .05); T+=dt;
  if(centerT>0){ centerT-=dt; if(centerT<=0) document.getElementById('center').style.display='none'; }
  updateSurvival(dt,T);
  if(mode==='flight'){
    if(!ui.panel) updateFlight(dt,T);          // painéis pausam o voo orbital
    renderer.render(fl.scene, fl.cam);
  } else if(mode==='city'){
    updateCity(dt,T);
    renderer.render(city.scene, city.cam);
  } else {
    if(mode==='hub') updateHub(dt,T);
    else { const a=T*.12; hub.cam.position.set(Math.sin(a)*5, 2.6, 2+Math.cos(a)*2); hub.cam.lookAt(0,1.3,-2); animateHubScreens(T); }
    renderer.render(hub.scene, hub.cam);
  }
  if(ui.panel==='inv' && ui.tab==='garage' && pv && pv.ship){ pv.ship.g.rotation.y += dt*.6; pv.r.render(pv.s, pv.c); }
})();
