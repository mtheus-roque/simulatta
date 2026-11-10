'use strict';
/* Trabalho e economia: ferramentas e mineração com minijogo, fabricação na bancada,
   quadro de recompensas (caça a procurados) e empregos civis (entregas, táxi e manutenção urbana). */

const work = { job:null, mini:null, bTarget:null, bEscorts:[] };
const DEP_TIER = { herbs:0, iron:1, copper:1, crystal:2, titanium:3, magmatite:2, cryonite:3 };
const _w1=new V3(), _w2=new V3();
function bestTool(){ for(const id of ['laser','drill','pick']) if(qty('t_'+id)>0) return id; return 'hands'; }
const toolForTier = t => Object.values(TOOLS).find(x=>x.tier===t).name;
function payPlayer(n, why, color='#7dff9a'){ n=Math.round(n); state.credits+=n; sfx.coin(); toast(`${why}  +${CUR}${n}`, color); save(); updateHUD(); }
function siteNow(){ return mode==='city' ? siteAt(playerWorld(),120) : mode==='hub' ? SITES[0] : null; }

// ---------------------------------------------------------------- mineração (com minijogo de "ponto quente")
function startMining(dep){
  const tid=bestTool(), tool=TOOLS[tid], need=DEP_TIER[dep.type];
  if(tool.tier<need){ toast(`Precisa de ${toolForTier(need)} para extrair ${DEPOSITS[dep.type].name}`, '#ff4a4a'); sfx.error(); return; }
  city.mining = { dep, t:0, need:(dep.type==='herbs'?1.6:3.2)/tool.speed, bonus:0, zone:rand(.15,.7), cur:0, tool };
  document.getElementById('minebar').style.display='block'; tone({type:'square',f0:300,f1:500,dur:.1,vol:.05});
}
function mineTap(){
  const m=city.mining; if(!m) return;
  if(m.cur>=m.zone && m.cur<=m.zone+.2){ m.bonus=Math.min(3,m.bonus+1); m.zone=rand(.08,.72); tone({type:'square',f0:900,f1:1400,dur:.08,vol:.06}); m.flash='#7dff9a'; }
  else { m.t=Math.max(0,m.t-.5); tone({type:'square',f0:200,dur:.12,vol:.06}); m.flash='#ff4a4a'; }
  m.flashT=.15;
}
function updateMining(dt){
  const m=city.mining, P=city.player.position, bar=document.getElementById('minebar');
  if(P.distanceTo(m.dep.pos)>3.6 || m.dep.gone){ city.mining=null; bar.style.display='none'; setPrompt(''); return; }
  m.t+=dt; m.cur=(Math.sin(m.t*3.6)+1)/2; m.flashT=(m.flashT||0)-dt;
  if(Math.floor(m.t*6)!==Math.floor((m.t-dt)*6)) noise({dur:.05,vol:.08,filter:'bandpass',freq:m.dep.type==='herbs'?1200:m.tool.tier>=2?3600:2600});
  const D=DEPOSITS[m.dep.type];
  bar.innerHTML = `<div class="ml">${D.name} · ${m.tool.name} · bônus <b>+${m.bonus}</b></div>
    <div class="mt"><i class="mz" style="left:${m.zone*100}%;width:20%"></i><i class="mc" style="left:${m.cur*100}%"></i></div>
    <div class="mp"><i style="width:${Math.min(100,m.t/m.need*100)}%;${m.flashT>0?`background:${m.flash}`:''}"></i></div>
    <div class="mh">Aperte <kbd>E</kbd> quando o cursor estiver na faixa verde para extrair mais</div>`;
  setPrompt('');
  if(m.t>=m.need){
    const n=D.qty[0]+((Math.random()*(D.qty[1]-D.qty[0]+1))|0)+m.tool.bonus+m.bonus;
    addItem(D.item,n); m.dep.gone=true; m.dep.g.visible=false; state.mined[m.dep.key]=Date.now(); save(); updateHUD();
    sfx.pickup(); toast(`+${n} ${D.name} → inventário [I]`, '#5affc8'); city.mining=null; bar.style.display='none';
  }
}

// ---------------------------------------------------------------- fabricação
const canCraft = r => Object.entries(r.in).every(([id,n])=>qty(id)>=n);
function craft(rid){
  const r=RECIPES.find(x=>x.id===rid); if(!r || !canCraft(r)) return;
  for(const [id,n] of Object.entries(r.in)) addItem(id,-n);
  for(const [id,n] of Object.entries(r.out)) addItem(id,n);
  const [oid,on]=Object.entries(r.out)[0];
  noise({dur:.4,vol:.15,filter:'bandpass',freq:1800}); sfx.coin(); toast(`Fabricado: ${on>1?on+'x ':''}${ITEMS[oid].name}`, '#7dff9a'); save(); updateHUD(); updateWeaponHUD();
}

// ---------------------------------------------------------------- recompensas
function tangentBasis(up){ const e1=new V3().crossVectors(up, Math.abs(up.z)<.9?new V3(0,0,1):new V3(1,0,0)).normalize(); return [e1, new V3().crossVectors(up,e1)]; }
function offsetDir(up, ang, dist){ const [e1,e2]=tangentBasis(up), a=dist/PLANET.R; return up.clone().multiplyScalar(Math.cos(a)).add(e1.multiplyScalar(Math.cos(ang)*Math.sin(a))).add(e2.multiplyScalar(Math.sin(ang)*Math.sin(a))).normalize(); }
function bountyOffers(){
  const site=siteNow()||SITES[0], idx=SITES.indexOf(site), rng=seeded(state.bountySeed*131+idx*7+3), list=[];
  for(let k=0;k<3;k++){
    const [name,sp]=BOUNTY_NAMES[(rng()*BOUNTY_NAMES.length)|0], danger=1+((rng()*3)|0);
    let d=null;
    for(let t=0;t<40 && !d;t++){ const c=offsetDir(site.up, rng()*Math.PI*2, 4500+rng()*(5000+danger*4000)); if(groundR(c)>seaR()+8) d=c; }
    if(!d) continue;
    const hint=offsetDir(d, rng()*Math.PI*2, rng()*220);
    list.push({ id:`b${state.bountySeed}_${idx}_${k}`, name, species:sp, danger, crime:BOUNTY_CRIMES[(rng()*BOUNTY_CRIMES.length)|0],
      reward:Math.round((380+danger*400+rng()*250)*(CUR_P.bountyMul||1)/10)*10, d:d.toArray(), hint:hint.toArray(), from:site.name, planet:CUR_P.id });
  }
  return list;
}
function acceptBounty(o){ if(state.bounty){ toast('Você já está caçando um alvo', '#ff4a4a'); return; } state.bounty={...o}; save(); toast(`Recompensa aceita: ${o.name} — procure na área marcada`, '#ffd040'); sfx.coin(); }
function abandonBounty(){ despawnBounty(); state.bounty=null; save(); sfx.ui(); }
function despawnBounty(){ if(work.bTarget) removeEnemy(work.bTarget); work.bEscorts.forEach(removeEnemy); work.bTarget=null; work.bEscorts=[]; }
function bountyPos(b){ const d=new V3().fromArray(b.d); return PC.clone().addScaledVector(d, groundR(d)); }
const bountyHere = b => !b.planet || b.planet===CUR_P.id;
function updateBounty(P){
  const b=state.bounty; if(!b || mode!=='city' || !bountyHere(b)) return;
  const pos=bountyPos(b), d=pos.distanceTo(P);
  if(!work.bTarget && d<420 && !city.fly){
    const ws=['pistol','rifle','shotgun'];
    work.bTarget=spawnEnemy(pos,{ style:'target', faction:'b_'+b.id, weapon:ws[b.danger-1], hp:150+b.danger*45, species:b.species, name:b.name, bounty:true, hostile:true, aggro:60 });
    work.bEscorts=[];
    for(let k=0;k<b.danger+1;k++) work.bEscorts.push(spawnEnemy(pos.clone().add(_w1.set(rand(-8,8),0,rand(-8,8)).applyQuaternion(work.bTarget.F.q)),
      { style:'bandit', faction:'b_'+b.id, weapon:['pistol','melee','rifle','shotgun'][k%4], hp:70, hostile:true, aggro:55, species:['human','oskari','vexari'][k%3] }));
    toast(`Alvo avistado: ${b.name}. Capture vivo (+25%) ou abata (60%).`, '#ffd040');
  }
  if(work.bTarget && d>1800){ despawnBounty(); }
}
function captureBounty(){
  const b=state.bounty; if(!b) return;
  payPlayer(b.reward*1.25, `Capturado vivo: ${b.name}`, '#ffd040');
  removeEnemy(work.bTarget); work.bTarget=null; finishBounty();
}
function bountyKilled(e){
  const b=state.bounty; if(!b || e!==work.bTarget) return;
  payPlayer(b.reward*.6, `Alvo abatido: ${b.name} (recompensa reduzida)`, '#ffd040'); finishBounty();
}
function finishBounty(){ state.bounty=null; state.bountySeed++; state.bounties=(state.bounties||0)+1; save(); updateHUD(); }

// ---------------------------------------------------------------- empregos civis
function sidewalkPoint(s){
  const i=(Math.random()*s.N)|0, j=(Math.random()*s.N)|0, P=CITY.P, R=CITY.ROAD;
  const x0=(i-s.N/2)*P+R/2+2.5, x1=(i+1-s.N/2)*P-R/2-2.5, z0=(j-s.N/2)*P+R/2+2.5, z1=(j+1-s.N/2)*P-R/2-2.5, L=x1-x0, q=Math.random()*4*L;
  if(q<L) return new V3(x0+q,.2,z0); if(q<2*L) return new V3(x1,.2,z0+q-L); if(q<3*L) return new V3(x1-(q-2*L),.2,z1); return new V3(x0,.2,z1-(q-3*L));
}
function pointNear(s, from, dmin, dmax, gen){ let best=null; for(let k=0;k<80;k++){ const p=gen(); const d=Math.hypot(p.x-from.x,p.z-from.z); if(d>=dmin && d<=dmax) return p; if(!best) best=p; } return best; }
function startJob(type){
  const s=siteNow();
  if(!s || mode!=='city' || s.outpost){ toast('Empregos ficam nas cidades de Aurora — vá até a rua', '#ff4a4a'); return; }
  if(work.job){ toast('Você já está em um emprego — termine ou abandone', '#ff4a4a'); return; }
  const PL=toLocal(s,playerWorld(),new V3());
  if(type==='delivery'){
    const shops=s.shops.filter(sh=>sh.name);
    const A=pointNear(s,PL,50,260,()=>shops[(Math.random()*shops.length)|0]), B=pointNear(s,A,160,480,()=>shops[(Math.random()*shops.length)|0]);
    const dist=Math.hypot(A.x-B.x,A.z-B.z);
    work.job={ type, s, step:'pickup', A, B, dist, limit:45+dist/3.2, timer:0 };
    toast(`Entrega: pegue a encomenda em ${A.name}`, '#5ef2ff');
  } else if(type==='taxi'){
    if(!city.drive){ toast('Entre no seu carro antes de aceitar corridas', '#ff4a4a'); return; }
    const pA=pointNear(s,PL,80,300,()=>sidewalkPoint(s)), pB=pointNear(s,pA,250,650,()=>sidewalkPoint(s));
    const g=makeNPC(['human','vexari','oskari'][(Math.random()*3)|0]); g.position.copy(pA); s.group.add(g);
    const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.8,.8,30,8,1,true),B(0xffd040,{transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide})); beacon.position.set(pA.x,15,pA.z); s.group.add(beacon);
    work.job={ type, s, step:'pickup', A:pA, B:pB, npc:g, beacon, dist:Math.hypot(pA.x-pB.x,pA.z-pB.z), t:0, bumps:0 };
    toast('Táxi: um passageiro está esperando (marcador amarelo)', '#5ef2ff');
  } else {
    const panels=[];
    for(let k=0;k<3;k++){ const p=pointNear(s,PL,40,420,()=>sidewalkPoint(s)); const g=new THREE.Group(); g.position.copy(p);
      box(.9,1.6,.5,M(0x4a5a62,{metalness:.5}),0,.8,0,g); const lamp=box(.3,.3,.52,B(0xff3a1a),0,1.35,0,g);
      const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,24,8,1,true),B(0x5ef2ff,{transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide})); beacon.position.y=12; g.add(beacon);
      s.group.add(g); panels.push({ p, g, lamp, beacon, done:false }); }
    work.job={ type:'repair', s, step:'repair', panels };
    toast('Manutenção: conserte os 3 painéis com defeito (marcadores azuis)', '#5ef2ff');
  }
  sfx.coin(); updateHUD();
}
function cancelJob(silent){
  const j=work.job; if(!j) return;
  if(j.npc) j.s.group.remove(j.npc); if(j.beacon) j.s.group.remove(j.beacon); if(j.panels) j.panels.forEach(p=>j.s.group.remove(p.g));
  work.job=null; work.mini=null; document.getElementById('minebar').style.display='none';
  if(!silent) toast('Emprego abandonado', '#ffb347'); updateHUD();
}
function updateJob(dt){
  const j=work.job; if(!j || mode!=='city') return;
  const PL=toLocal(j.s,playerWorld(),new V3());
  if(j.type==='delivery' && j.step==='deliver'){ j.timer+=dt; if(j.timer>j.limit){ toast('Prazo estourado — a entrega foi cancelada', '#ff4a4a'); cancelJob(true); } }
  if(j.type==='taxi'){
    const v=city.drive;
    if(j.step==='pickup'){
      j.npc.rotation.y += dt;
      if(v && Math.hypot(PL.x-j.A.x,PL.z-j.A.z)<7 && Math.abs(v.speed)<2){ j.step='ride'; j.npc.visible=false; j.beacon.position.set(j.B.x,15,j.B.z); j.t=0; j.bumps=0;
        toast('Passageiro a bordo — siga até o destino (marcador amarelo)', '#5ef2ff'); tone({type:'sine',f0:700,f1:900,dur:.15,vol:.05}); }
    } else {
      j.t+=dt;
      if(v && Math.hypot(PL.x-j.B.x,PL.z-j.B.z)<8 && Math.abs(v.speed)<2){
        const tip=Math.max(0, 45 - j.bumps*12 - Math.max(0,j.t-(25+j.dist/12))*1.2);
        payPlayer(30+j.dist*.13+tip, `Corrida concluída${tip>0?` (gorjeta ${CUR}${Math.round(tip)})`:' (sem gorjeta)'}`); cancelJob(true);
      }
    }
  }
}
function workInteractables(P){
  const L=[], j=work.job;
  if(j && (j.type==='delivery'||j.type==='repair')){
    const PL=toLocal(j.s,P,new V3());
    if(j.type==='delivery'){
      const tgt = j.step==='pickup' ? j.A : j.B, d=Math.hypot(PL.x-tgt.x,PL.z-tgt.z);
      if(d<3.2) L.push({ d, r:3.2, prio:true, label: j.step==='pickup' ? `[E] Pegar encomenda — ${tgt.name}` : `[E] Entregar encomenda — ${tgt.name}`, fn:()=>{
        if(j.step==='pickup'){ j.step='deliver'; j.timer=0; toast(`Leve a encomenda até ${j.B.name} em ${Math.round(j.limit)} s`, '#5ef2ff'); sfx.pickup(); updateHUD(); }
        else { const left=1-j.timer/j.limit; payPlayer((35+j.dist*.16)*(left>.4?1.25:1), left>.4?'Entrega rápida (bônus)':'Entrega concluída'); cancelJob(true); } } });
    } else for(const p of j.panels){ if(p.done) continue; const d=Math.hypot(PL.x-p.p.x,PL.z-p.p.z);
      if(d<2.6) L.push({ d, r:2.6, prio:true, label:'[E] Consertar painel', fn:()=>startRepairMini(p) }); }
  }
  if(work.bTarget && work.bTarget.state==='surrender'){ const d=P.distanceTo(work.bTarget.g.position); if(d<2.6) L.push({ d, r:2.6, prio:true, label:`[E] Algemar ${work.bTarget.name}`, fn:captureBounty }); }
  return L;
}
// minijogo de manutenção: sequência de setas
const ARROWS = { ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→' };
function startRepairMini(p){
  const keys4=Object.keys(ARROWS); work.mini={ p, seq:Array.from({length:5},()=>keys4[(Math.random()*4)|0]), idx:0 };
  drawMini(); document.getElementById('minebar').style.display='block'; noise({dur:.3,vol:.1,filter:'highpass',freq:3000});
}
function drawMini(){ const m=work.mini; document.getElementById('minebar').innerHTML = `<div class="ml">Religue os circuitos na ordem</div>
  <div class="seq">${m.seq.map((k,i)=>`<span class="${i<m.idx?'ok':i===m.idx?'cur':''}">${ARROWS[k]}</span>`).join('')}</div>
  <div class="mh">Use as setas do teclado · erro = choque</div>`; }
function miniKey(code){
  const m=work.mini; if(!m || !ARROWS[code]) return false;
  if(code===m.seq[m.idx]){ m.idx++; tone({type:'square',f0:600+m.idx*120,dur:.06,vol:.05});
    if(m.idx>=m.seq.length){ const p=m.p; p.done=true; p.lamp.material=B(0x40ff60); p.g.remove(p.beacon); work.mini=null; document.getElementById('minebar').style.display='none';
      const left=work.job.panels.filter(x=>!x.done).length; sfx.pickup();
      if(left===0){ payPlayer(120,'Manutenção concluída'); cancelJob(true); } else { toast(`Painel consertado — faltam ${left}`, '#5ef2ff'); updateHUD(); }
      return true; } }
  else { m.idx=0; playerDamage(4,'Choque elétrico'); noise({dur:.2,vol:.3,filter:'highpass',freq:2500}); }
  drawMini(); return true;
}

// ---------------------------------------------------------------- objetivo atual (marcador, minimapa e painel lateral)
function currentObjective(){
  const j=work.job;
  if(j){
    if(j.type==='delivery'){ const t=j.step==='pickup'?j.A:j.B; return { pos:toWorld(j.s,_w2.set(t.x,1,t.z),new V3()), label:j.step==='pickup'?'COLETA':'ENTREGA' }; }
    if(j.type==='taxi'){ const t=j.step==='pickup'?j.A:j.B; return { pos:toWorld(j.s,_w2.set(t.x,1,t.z),new V3()), label:j.step==='pickup'?'PASSAGEIRO':'DESTINO' }; }
    const p=j.panels.find(x=>!x.done); if(p) return { pos:toWorld(j.s,_w2.set(p.p.x,1,p.p.z),new V3()), label:'PAINEL' };
  }
  const b=state.bounty;
  if(b && bountyHere(b)){ if(work.bTarget && work.bTarget.state!=='dead') return { pos:work.bTarget.g.position.clone(), label:b.name.toUpperCase() };
    const d=new V3().fromArray(b.hint); return { pos:PC.clone().addScaledVector(d,groundR(d)+40), label:'ÁREA DO ALVO' }; }
  return null;
}
function trackerHTML(){
  let h='';
  const j=work.job;
  if(j){ const J=JOBS[j.type]; let st='';
    if(j.type==='delivery') st = j.step==='pickup' ? `Pegar em ${j.A.name}` : `Entregar em ${j.B.name} · ${Math.max(0,Math.ceil(j.limit-j.timer))} s`;
    else if(j.type==='taxi') st = j.step==='pickup' ? 'Buscar passageiro' : 'Levar ao destino';
    else st = `Painéis: ${j.panels.filter(p=>p.done).length}/3`;
    h += `<div class="trk"><span>EMPREGO</span><b>${J.name}</b><br>${st}</div>`; }
  const b=state.bounty; if(b) h += `<div class="trk"><span>RECOMPENSA</span><b>${b.name}</b> ${'★'.repeat(b.danger)}<br>${CUR}${b.reward} · ${work.bTarget&&work.bTarget.state==='surrender'?'Rendido — algeme!':'Procure na área marcada'}</div>`;
  return h;
}
function updateWork(dt, t){
  if(mode!=='city') return;
  const P=playerWorld();
  updateBounty(P); updateJob(dt);
  const ob=currentObjective(), mk=document.getElementById('mk-obj');
  if(ob && !city.launch){ const d=ob.pos.distanceTo(P); marker(mk, ob.pos, `${ob.label}<br>${fmtKm(d)}`, city.cam); } else mk.style.display='none';
  if(work.job && work.job.type==='delivery' && work.job.step==='deliver' && Math.floor(t*2)!==Math.floor((t-dt)*2)) updateHUD();
}
