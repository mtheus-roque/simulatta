'use strict';
/* Contratos, painéis (I/P/Q/Esc) e HUD */
// ================================================================ CONTRATOS
const activeContract = ()=> CONTRACTS.find(c=>c.id===state.active) || null;
function acceptContract(id){
  const c = CONTRACTS.find(x=>x.id===id); state.active=id; state.progress=0;
  if(c.cargo) for(const k in c.cargo) addItem(k, c.cargo[k]);
  toast('Contrato aceito: '+c.title+(c.cargo?' · carga no inventário':''), '#5ef2ff'); sfx.coin();
}
function abandonContract(){
  const c = activeContract(); if(c?.cargo) for(const k in c.cargo) addItem(k, -qty(k));
  state.active=null; state.progress=0; sfx.ui();
}
function progress(type, n=1){
  const c = activeContract(); if(!c || c.type!==type) return;
  state.progress += n;
  if(state.progress>=c.target){
    state.credits += c.reward; state.completed++; state.active=null; state.progress=0;
    toast(`✔ CONTRATO CONCLUÍDO: ${c.title}  +${CUR}${c.reward}`, '#7dff9a'); sfx.coin();
  }
  save(); updateHUD();
}

// ================================================================ PAINÉIS (I / P / Q / Esc)
const PANELS = {
  inv:      { title:'INVENTÁRIO', key:'I', tabs:{ items:'ITENS', garage:'GARAGEM' } },
  shop:     { title:'LOJA — MERCADO KESSLER', key:'P', tabs:{ modules:'MÓDULOS', ships:'NAVES', vehicles:'VEÍCULOS', furniture:'MÓVEIS', sell:'VENDER' } },
  contracts:{ title:'CONTRATOS', key:'Q', tabs:{} },
  settings: { title:'CONFIGURAÇÕES', key:'Esc', tabs:{ audio:'ÁUDIO', controls:'CONTROLES', video:'VÍDEO', game:'JOGO' } },
};
const ui = { panel:null, tab:null, sel:null, filter:'ALL', ship:null };
function openPanel(name, tab){
  if(mode==='title') return;
  ui.panel = name; ui.tab = tab || (ui.lastTab?.[name]) || Object.keys(PANELS[name].tabs)[0] || null;
  if(!ui.ship) ui.ship = state.activeShip;
  document.getElementById('panel').style.display='flex';
  if(document.pointerLockElement) document.exitPointerLock();
  keysReset(); renderPanel(); sfx.open(); updateLockHint();
}
function closePanel(){
  if(!ui.panel) return;
  (ui.lastTab ||= {})[ui.panel] = ui.tab;
  ui.panel=null; document.getElementById('panel').style.display='none'; sfx.ui();
  lock(); updateLockHint();
}
function togglePanel(name){ if(ui.panel===name) closePanel(); else openPanel(name); }
const docked = () => mode==='hub' || mode==='city';      // naves: hangar ou apartamento
const atHome = () => mode==='hub';                         // decoração: só no apartamento

function renderPanel(){
  const P = PANELS[ui.panel];
  document.getElementById('p-title').textContent = '▌ '+P.title;
  document.getElementById('p-key').innerHTML = `<kbd>${P.key}</kbd> ou <kbd>Esc</kbd> fecha · ${CUR} ${state.credits}`;
  document.getElementById('p-tabs').innerHTML = Object.entries(P.tabs).map(([k,v])=>`<button class="btn ${k===ui.tab?'on':''}" data-a="tab" data-v="${k}">${v}</button>`).join('');
  const body = document.getElementById('p-body');
  body.innerHTML = ({ inv:renderInv, shop:renderShop, contracts:renderContracts, settings:renderSettings })[ui.panel]();
  if(ui.panel==='inv' && ui.tab==='garage'){ const sv=document.getElementById('shipview'); const pv=preview(); sv.appendChild(pv.r.domElement);
    pv.r.setSize(sv.clientWidth||290, sv.clientHeight||190, false); pv.c.aspect=(sv.clientWidth||290)/(sv.clientHeight||190); pv.c.updateProjectionMatrix();
    setPreview(ui.ship?.startsWith('v:') ? ui.ship : (state.ships.find(s=>s.uid===ui.ship)?.model||'kestrel')); }
}

// ---- Inventário
function renderInv(){
  if(ui.tab==='garage') return renderGarage();
  const ids = Object.keys(state.inv).filter(id=>qty(id)>0 && (ui.filter==='ALL' || ITEMS[id].cat===ui.filter));
  const chips = [['ALL','TODOS'],['MATERIAL','MATERIAIS'],['MÓDULO','MÓDULOS'],['MÓVEL','MÓVEIS'],['CARGA','CARGA']]
    .map(([k,v])=>`<button class="btn sm ${ui.filter===k?'on':''}" data-a="filter" data-v="${k}">${v}</button>`).join('');
  const cards = ids.map(id=>{ const it=ITEMS[id], c=CATS[it.cat];
    return `<div class="card ${ui.sel===id?'sel':''}" data-a="sel" data-v="${id}" style="--cat:${c.c}"><span class="q">x${qty(id)}</span>
      <span class="ic">${c.ic}</span><span class="n">${it.name}</span><span class="d" style="font-size:15px">${it.cat}</span></div>`; }).join('');
  const placed = (ui.filter==='ALL'||ui.filter==='MÓVEL') ? Object.keys(state.placed) : [];
  let side = `<div class="d">Selecione um item para ver detalhes.</div>`;
  const it = ui.sel && ITEMS[ui.sel];
  if(it && qty(ui.sel)>0){
    const c=CATS[it.cat];
    side = `<div style="font-size:54px;color:${c.c}">${c.ic}</div><div style="font-size:26px">${it.name}</div>
      <div><span class="tag" style="margin:0">${it.cat}</span> <span class="p">x${qty(ui.sel)}</span></div>
      <p class="d">${it.desc}</p>`;
    if(it.sell) side += `<p>Valor de venda: <span class="p">${CUR}${it.sell}</span>/un. — venda na Loja [P]</p>`;
    if(it.slot) side += `<p>Encaixe: <b>${SLOTS[it.slot]}</b></p><button class="btn c" data-a="tab" data-v="garage">INSTALAR NA GARAGEM ▸</button>`;
    if(it.cat==='MÓVEL') side += atHome() ? `<button class="btn g" data-a="place" data-v="${ui.sel}">COLOCAR NO APARTAMENTO</button>`
                                          : `<p class="d">Só é possível decorar estando no apartamento.</p>`;
    if(it.cat==='CARGA') side += `<p class="d">Item de contrato — não pode ser vendido.</p>`;
  }
  return `<div class="split"><div>
      <div class="chips">${chips}</div>
      ${ids.length?`<div class="grid">${cards}</div>`:`<div class="empty">Nada aqui. Colete sucata no espaço ou visite a Loja [P].</div>`}
      ${placed.length?`<h3>No apartamento</h3>`+placed.map(id=>`<div class="item"><div>${ITEMS[id].name}<span class="tag">MÓVEL</span></div>
        <button class="btn sm" data-a="store" data-v="${id}" ${atHome()?'':'disabled'}>GUARDAR</button></div>`).join(''):''}
    </div><div class="side">${side}</div></div>`;
}

// ---- Garagem
function renderGarage(){
  const vlist = `<h3>Veículos terrestres</h3><div class="ships">${state.vehicles.map(id=>`<button class="btn shipbtn ${ui.ship==='v:'+id?'on':''}" data-a="veh" data-v="${id}">${VEHICLES[id].name}<br><span style="font-size:15px">${VEHICLES[id].cls}</span></button>`).join('')}</div>`;
  const slist = `<h3 style="margin-top:0">Naves</h3>`;
  if(ui.ship && ui.ship.startsWith('v:')){
    const vd = VEHICLES[ui.ship.slice(2)];
    return `<div class="split"><div>${slist}<div class="ships">${state.ships.map(x=>`<button class="btn shipbtn" data-a="ship" data-v="${x.uid}">${x.uid===state.activeShip?'★ ':''}${SHIPS[x.model].name}<br><span style="font-size:15px">${SHIPS[x.model].cls}</span></button>`).join('')}</div>${vlist}
      <h3>${vd.name} <span class="d">— ${vd.cls}</span></h3><p class="d">${vd.desc}</p>
      <p class="d">Estacionado em Nova Kessler. Aproxime-se e pressione <kbd>E</kbd> para dirigir.</p></div>
      <div class="side"><div id="shipview"></div>
      <div class="stat" style="margin-top:8px"><span>Velocidade máx.</span><span class="p">${Math.round(vd.speed*3.6)} km/h</span></div>
      <div class="stat"><span>Aceleração</span><span class="p">${Math.round(vd.accel/18*100)}%</span></div>
      <div class="stat"><span>Dirigibilidade</span><span class="p">${Math.round(vd.turn*100)}%</span></div></div></div>`;
  }
  const s = state.ships.find(x=>x.uid===ui.ship) || activeShip(); ui.ship = s.uid;
  const def = SHIPS[s.model], st = shipStats(s), isActive = s.uid===state.activeShip;
  const list = state.ships.map(x=>`<button class="btn shipbtn ${x.uid===s.uid?'on':''}" data-a="ship" data-v="${x.uid}">${x.uid===state.activeShip?'★ ':''}${SHIPS[x.model].name}<br><span style="font-size:15px">${SHIPS[x.model].cls}</span></button>`).join('');
  const slots = Object.entries(SLOTS).map(([k,label])=>{
    const cur = s.slots[k], opts = Object.keys(state.inv).filter(id=>qty(id)>0 && ITEMS[id].slot===k);
    return `<div class="slot"><div class="row"><span><span class="d">${label}:</span> ${cur?ITEMS[cur].name:'<span style="color:#7a6040">vazio</span>'}</span>
      ${cur?`<button class="btn sm r" data-a="unequip" data-v="${k}" ${docked()?'':'disabled'}>REMOVER</button>`:''}</div>
      ${opts.map(id=>`<div class="row" style="margin-top:4px"><span class="d">↳ ${ITEMS[id].name} (x${qty(id)})</span>
        <button class="btn sm g" data-a="equip" data-v="${k}:${id}" ${docked()?'':'disabled'}>INSTALAR</button></div>`).join('')}</div>`;
  }).join('');
  return `<div class="split"><div>
      ${slist}<div class="ships">${list}</div>${vlist}
      <h3>${def.name} <span class="d">— ${def.cls}</span></h3>
      <p class="d">${def.desc}</p>
      ${docked()?'':'<p style="color:var(--red)">Modificações só podem ser feitas atracado no hangar.</p>'}
      ${slots}
    </div><div class="side">
      <div id="shipview"></div>
      <div class="stat" style="margin-top:8px"><span>Velocidade máx.</span><span class="p">${Math.round(st.speed*3.6)} km/s</span></div>
      <div class="stat"><span>Casco</span><span class="p">${st.hull}</span></div>
      <div class="stat"><span>Manobrabilidade</span><span class="p">${Math.round(st.turn*100)}%</span></div>
      <div class="stat"><span>Armamento</span><span class="p">${!st.weapon?'nenhum':st.dual?'duplo':'simples'}</span></div>
      <p>${isActive?'<span style="color:var(--green)">★ Nave ativa para decolagem</span>':`<button class="btn g" data-a="activate" data-v="${s.uid}" ${docked()?'':'disabled'}>DEFINIR COMO ATIVA</button>`}</p>
    </div></div>`;
}
let pv=null;
function preview(){
  if(pv) return pv;
  const r = new THREE.WebGLRenderer({ antialias:true, alpha:true }); r.setPixelRatio(Math.min(devicePixelRatio||1,2));
  const s = new THREE.Scene(); s.add(new THREE.AmbientLight(0x8070a0,.9));
  const l = new THREE.DirectionalLight(0xffc080,1.2); l.position.set(3,4,2); s.add(l);
  const l2 = new THREE.DirectionalLight(0x6070ff,.6); l2.position.set(-3,-1,-2); s.add(l2);
  const c = new THREE.PerspectiveCamera(32,1.5,.1,100); c.position.set(9,4.5,9); c.lookAt(0,0,0);
  return pv = { r, s, c, ship:null, model:null };
}
function setPreview(model){
  const p=preview(); if(p.model===model) return; if(p.ship) p.s.remove(p.ship.g);
  if(model.startsWith('v:')){ const vd=VEHICLES[model.slice(2)]; p.ship=makeCar(vd.kind, vd.color, vd.glow); p.ship.g.position.y=-.8; }
  else p.ship=makeShip(model);
  p.s.add(p.ship.g); p.model=model;
}

// ---- Loja
function renderShop(){
  const row = (name, tag, desc, price, btn) => `<div class="item"><div><div>${name}${tag?`<span class="tag">${tag}</span>`:''}</div><div class="d">${desc}</div></div>
    <div style="text-align:right"><div class="p">${price}</div>${btn}</div></div>`;
  const buy = (a, id, price, owned) => owned ? `<button class="btn" disabled>ADQUIRIDO</button>`
    : `<button class="btn g" data-a="${a}" data-v="${id}" ${state.credits<price?'disabled':''}>COMPRAR</button>`;
  let h = `<p class="d">Saldo: <span class="p">${CUR} ${state.credits}</span>${docked()?'':' · comprado em voo vai para o inventário'}</p>`;
  if(ui.tab==='modules')
    for(const [id,it] of Object.entries(ITEMS)) if(it.cat==='MÓDULO' && it.price)
      h += row(it.name, SLOTS[it.slot], `${it.desc} · no inventário: ${qty(id)}`, CUR+it.price, buy('buy',id,it.price,false));
  if(ui.tab==='ships')
    for(const [id,sd] of Object.entries(SHIPS)) if(sd.price)
      h += row(sd.name, sd.cls.toUpperCase(), `${sd.desc} Vel. ${Math.round(sd.speed*3.6)} km/s · casco ${sd.hull}`, CUR+sd.price, buy('buyship',id,sd.price,state.ships.some(s=>s.model===id)));
  if(ui.tab==='vehicles')
    for(const [id,vd] of Object.entries(VEHICLES)) if(vd.price)
      h += row(vd.name, vd.cls.toUpperCase(), `${vd.desc} Vel. máx. ${Math.round(vd.speed*3.6)} km/h`, CUR+vd.price, buy('buyveh',id,vd.price,state.vehicles.includes(id)));
  if(ui.tab==='furniture')
    for(const [id,it] of Object.entries(ITEMS)) if(it.cat==='MÓVEL' && it.price)
      h += row(it.name, 'MÓVEL', it.desc, CUR+it.price, buy('buy',id,it.price, qty(id)>0 || !!state.placed[id]));
  if(ui.tab==='sell'){
    const sellables = Object.keys(state.inv).filter(id=>qty(id)>0 && (ITEMS[id].sell || (ITEMS[id].cat==='MÓDULO' && ITEMS[id].price)));
    if(!sellables.length) h += `<div class="empty">Nada para vender. Sucata e módulos não instalados aparecem aqui.</div>`;
    for(const id of sellables){ const it=ITEMS[id], p=it.sell || Math.floor(it.price/2);
      h += row(`${it.name} <span class="p">x${qty(id)}</span>`, it.cat, it.sell?'Cotação do ferro-velho de hoje.':'Revenda a 50% do preço.', `${CUR}${p}/un.`,
        `<button class="btn sm g" data-a="sell" data-v="${id}:1">VENDER 1</button> ${qty(id)>1?`<button class="btn sm g" data-a="sell" data-v="${id}:all">TUDO (+${CUR}${p*qty(id)})</button>`:''}`); }
  }
  return h;
}
// ---- Contratos
function renderContracts(){
  let h = `<p class="d">Quadro de contratos do distrito. Um contrato ativo por vez.</p>`;
  for(const c of CONTRACTS){
    const act = state.active===c.id;
    h += `<div class="item"><div><div>${c.title} <span class="p">${CUR}${c.reward}</span>${act?'<span class="tag" style="color:var(--cyan)">ATIVO</span>':''}</div><div class="d">${c.desc}</div>
      ${act?`<div style="color:var(--cyan)">${c.type==='deliver'?'Leve a carga até a Estação Beta':`Progresso: ${state.progress}/${c.target}`}</div>`:''}</div>
      ${act?`<button class="btn r" data-a="abandon">ABANDONAR</button>`
           :`<button class="btn g" data-a="accept" data-v="${c.id}" ${state.active?'disabled':''}>ACEITAR</button>`}</div>`;
  }
  return h + `<p class="d" style="margin-top:14px">Contratos concluídos: ${state.completed} · Drones abatidos: ${state.kills}</p>`;
}
// ---- Configurações
function renderSettings(){
  const range=(k,label,min,max,step,fmt)=>`<div class="set"><label for="s-${k}">${label}</label><input id="s-${k}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[k]}" data-s="${k}"><span data-out="${k}">${fmt(settings[k])}</span></div>`;
  const check=(k,label)=>`<div class="set"><label for="s-${k}">${label}</label><input id="s-${k}" type="checkbox" ${settings[k]?'checked':''} data-s="${k}"><span></span></div>`;
  const pct=v=>Math.round(v*100)+'%';
  let h = '';
  if(ui.tab==='audio') h = range('master','Volume geral',0,1,.05,pct)+range('music','Música (toca-fitas)',0,1,.05,pct)+range('sfx','Efeitos sonoros',0,1,.05,pct);
  if(ui.tab==='controls') h = range('sens','Sensibilidade do mouse',.2,3,.1,v=>(+v).toFixed(1)+'x')+check('invertY','Inverter eixo Y')+
    `<h3>Atalhos</h3><table class="keys d">${[['Mouse','Câmera (a pé) / mira (nave)'],['W A S D','Andar / dirigir / acelerar e esquivar'],['Enter','Pular decolagem'],['Shift','Correr'],['V','Alternar 1ª / 3ª pessoa'],['E','Interagir'],['G / R','Mover / girar móvel'],
      ['Clique / F','Atirar'],['Espaço','Freio de emergência'],['I','Inventário e garagem'],['P','Loja'],['Q','Contratos'],['Esc','Configurações / fechar painel']]
      .map(([a,b])=>`<tr><td><kbd>${a}</kbd></td><td>${b}</td></tr>`).join('')}</table>`;
  if(ui.tab==='video') h = range('scale','Escala de resolução',.5,1,.05,pct)+range('fov','Campo de visão (FOV)',55,95,1,v=>v+'°')+
    check('hints','Mostrar dicas de controle')+check('crt','Filtro CRT retrô');
  if(ui.tab==='game') h = `<div class="item"><div>Salvar progresso<div class="d">O jogo salva automaticamente a cada ação.</div></div><button class="btn g" data-a="savenow">SALVAR AGORA</button></div>
    <div class="item"><div>Restaurar configurações padrão</div><button class="btn" data-a="resetset">RESTAURAR</button></div>
    <div class="item"><div>Apagar progresso<div class="d">Créditos, inventário, naves e móveis voltam ao início.</div></div><button class="btn r" data-a="reset">APAGAR SAVE</button></div>`;
  return h + `<p style="margin-top:18px"><button class="btn g" data-a="close">▶ CONTINUAR</button></p>`;
}
function applySettings(){
  if(actx){ master.gain.value=settings.master; musicBus.gain.value=settings.music; sfxBus.gain.value=settings.sfx; }
  renderer.setPixelRatio(Math.min(devicePixelRatio||1, 1.5)*settings.scale); renderer.setSize(innerWidth, innerHeight);
  document.body.classList.toggle('crt', !!settings.crt); document.body.classList.toggle('pixel', !!settings.crt);
  document.body.classList.toggle('nohints', !settings.hints);
  hub.cam.fov = settings.fov-5; hub.cam.updateProjectionMatrix();
}

// ---- ações dos painéis
const panelEl = document.getElementById('panel');
panelEl.addEventListener('click', e=>{
  const b = e.target.closest('[data-a]'); if(!b || b.disabled) return;
  const a=b.dataset.a, v=b.dataset.v;
  switch(a){
    case 'close': return closePanel();
    case 'tab': ui.tab=v; sfx.ui(); break;
    case 'filter': ui.filter=v; sfx.ui(); break;
    case 'sel': ui.sel=v; sfx.ui(); break;
    case 'place': placeFromInventory(v); toast(`${ITEMS[v].name} colocado — use [G] para ajustar`, '#ffb347'); sfx.coin(); break;
    case 'store': storeFurniture(v); toast(`${ITEMS[v].name} guardado no inventário`, '#ffb347'); sfx.ui(); break;
    case 'ship': ui.ship=v; sfx.ui(); break;
    case 'activate': state.activeShip=v; if(city.player && !city.launch) syncHangarShip(); toast(`${SHIPS[activeShip().model].name} pronta para decolar`, '#7dff9a'); sfx.coin(); break;
    case 'equip': { const [slot,id]=v.split(':'), s=state.ships.find(x=>x.uid===ui.ship);
      if(s.slots[slot]) addItem(s.slots[slot],1); s.slots[slot]=id; addItem(id,-1); toast(`${ITEMS[id].name} instalado`, '#7dff9a'); sfx.coin(); break; }
    case 'unequip': { const s=state.ships.find(x=>x.uid===ui.ship); addItem(s.slots[v],1); s.slots[v]=null; sfx.ui(); break; }
    case 'buy': { const it=ITEMS[v]; if(state.credits<it.price) break; state.credits-=it.price; addItem(v,1); sfx.coin();
      toast(`Comprado: ${it.name} → inventário [I]`, '#7dff9a'); break; }
    case 'buyship': { const sd=SHIPS[v]; if(state.credits<sd.price) break; state.credits-=sd.price;
      state.ships.push({ uid:'s'+Date.now(), model:v, slots:{ engine:null, weapon:'cannon_basic', armor:null } }); sfx.coin();
      toast(`${sd.name} entregue no hangar → Garagem [I]`, '#7dff9a'); break; }
    case 'sell': { const [id,n]=v.split(':'), it=ITEMS[id], p=it.sell||Math.floor(it.price/2), k=n==='all'?qty(id):1;
      addItem(id,-k); state.credits+=p*k; sfx.coin(); toast(`Vendido: ${k}x ${it.name}  +${CUR}${p*k}`, '#7dff9a'); break; }
    case 'buyveh': { const vd=VEHICLES[v]; if(state.credits<vd.price || state.vehicles.includes(v)) break; state.credits-=vd.price; state.vehicles.push(v);
      if(city.player) syncCityVehicles(); sfx.coin();
      toast(`${vd.name} estacionado em frente à Torre Kessler 07`, '#7dff9a'); break; }
    case 'veh': ui.ship='v:'+v; sfx.ui(); break;
    case 'accept': acceptContract(v); break;
    case 'abandon': abandonContract(); break;
    case 'savenow': save(); saveSettings(); toast('Progresso salvo', '#7dff9a'); break;
    case 'resetset': settings=Object.assign({}, DEFAULT_SETTINGS); applySettings(); saveSettings(); sfx.ui(); break;
    case 'reset': if(confirm('Apagar todo o progresso salvo?')){ try{localStorage.removeItem(SAVE_KEY);}catch(e){} location.reload(); } return;
  }
  save(); updateHUD(); renderPanel();
});
panelEl.addEventListener('input', e=>{
  const k = e.target.dataset.s; if(!k) return;
  settings[k] = e.target.type==='checkbox' ? e.target.checked : parseFloat(e.target.value);
  const out = panelEl.querySelector(`[data-out="${k}"]`);
  if(out){ const v=settings[k]; out.textContent = k==='fov'?v+'°':k==='sens'?v.toFixed(1)+'x':Math.round(v*100)+'%'; }
  applySettings(); saveSettings();
});

// ================================================================ HUD helpers
function updateHUD(){
  document.getElementById('s-cr').textContent = `${CUR} ${state.credits}`;
  document.getElementById('s-sc').textContent = qty('scrap');
  const c = activeContract(), el=document.getElementById('contract');
  el.innerHTML = c ? `CONTRATO ATIVO <kbd>Q</kbd><br><b>${c.title}</b><br>${c.type==='deliver'?'Destino: Estação Beta':`Progresso: ${state.progress}/${c.target}`}`
                   : `Sem contrato ativo<br><span style="color:#9a7a4a">Pressione <kbd>Q</kbd> para ver contratos</span>`;
}
function toast(msg, color='#ffb347'){
  const t=document.createElement('div'); t.className='toast'; t.style.color=color; t.textContent=msg;
  const box=document.getElementById('toasts'); box.appendChild(t); while(box.children.length>4) box.firstChild.remove();
  setTimeout(()=>{ t.style.opacity=0; setTimeout(()=>t.remove(),600); }, 2800);
}
let lastPrompt=null;
function setPrompt(s){ if(s!==lastPrompt){ document.getElementById('prompt').textContent=s; lastPrompt=s; } }
let centerT=0;
function setCenter(html, dur){ const c=document.getElementById('center'); c.innerHTML=html; c.style.display='block'; centerT=dur; }
function setHelp(){
  const k=s=>`<kbd>${s}</kbd>`, menus=` ${k('V')} 1ª/3ª pessoa · ${k('I')} inventário ${k('P')} loja ${k('Q')} contratos ${k('Esc')} config.`;
  let h;
  if(mode==='hub') h = `${k('Mouse')} câmera ${k('WASD')} andar ${k('Shift')} correr ${k('E')} interagir ${k('G')} mover móvel`;
  else if(mode==='city' && city.launch) h = `Decolando... ${k('Enter')} pular sequência`;
  else if(mode==='city' && city.drive) h = `${k('Mouse')} olhar ${k('W')} acelerar ${k('S')} frear/ré ${k('A')}/${k('D')} virar ${k('Espaço')} freio de mão ${k('E')} sair`;
  else if(mode==='city') h = `${k('Mouse')} câmera ${k('WASD')} andar ${k('Shift')} correr ${k('E')} interagir / dirigir`;
  else h = `${k('Mouse')} mira ${k('W')}/${k('S')} acelerar ${k('A')}/${k('D')} esquiva ${k('Espaço')} freio ${k('Clique')} atirar`;
  document.getElementById('help').innerHTML = h + menus;
}
let transitioning=false;
function transition(fn, white){
  transitioning=true;
  const f=document.getElementById('fade'); f.style.background = white?'#dff':'#000'; f.style.opacity=1;
  setTimeout(()=>{ fn(); f.style.opacity=0; transitioning=false; }, 600);
}

