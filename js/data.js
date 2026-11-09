'use strict';
/* Dados do jogo (itens, naves, contratos) e save */
// ================================================================ DADOS
const CUR = '₢';
const CATS = { MATERIAL:{ic:'▣',c:'#d8a040'}, 'MÓDULO':{ic:'⚙',c:'#5ef2ff'}, 'MÓVEL':{ic:'▙',c:'#ff8ad0'}, CARGA:{ic:'▤',c:'#7dff9a'} };
const SLOTS = { engine:'MOTOR', weapon:'ARMA', armor:'BLINDAGEM' };
const ITEMS = {
  scrap:        { name:'Sucata',               cat:'MATERIAL', desc:'Metal recuperado de destroços. Vendável na loja.', sell:12 },
  supplies:     { name:'Caixa de Suprimentos', cat:'CARGA',    desc:'Carga lacrada destinada à Estação Beta.' },
  engine_t1:    { name:'Motor Tier 1',         cat:'MÓDULO', slot:'engine', price:400, desc:'Velocidade máxima +40%.', mod:{speed:1.4} },
  cannon_basic: { name:'Canhão Simples',       cat:'MÓDULO', slot:'weapon', price:120, desc:'Canhão balístico de fábrica.', mod:{} },
  cannon_dual:  { name:'Canhão Duplo',         cat:'MÓDULO', slot:'weapon', price:350, desc:'Dispara dois projéteis por vez.', mod:{dual:true} },
  armor_scrap:  { name:'Blindagem de Sucata',  cat:'MÓDULO', slot:'armor',  price:300, desc:'Casco +60.', mod:{hull:60} },
  sofa:         { name:'Sofá de Couro Puído',  cat:'MÓVEL', desc:'Já viu dias melhores. Muitos dias.' },
  table:        { name:'Mesa de Centro',       cat:'MÓVEL', desc:'Canecas, fitas e parafusos soltos.' },
  bench:        { name:'Bancada de Peças',     cat:'MÓVEL', desc:'Ferramentas e um ferro de solda teimoso.' },
  arcade:       { name:'Fliperama Neo-Comet',  cat:'MÓVEL', price:220, desc:'Gabinete arcade dos anos 2080.' },
  tape:         { name:'Toca-fitas K7',        cat:'MÓVEL', price:120, desc:'Toca jazz lo-fi. Sim, funciona.' },
};
const SHIPS = {
  kestrel: { name:'Kestrel-7', cls:'Interceptador leve',  speed:60, hull:100, turn:1.0,  price:0,   color:0xb04a2a, desc:'Ágil, frágil, barulhento. Do jeito que você gosta.' },
  mule:    { name:'Mule-3',    cls:'Cargueiro de sucata', speed:46, hull:180, turn:.72, price:900, color:0x6a7a52, desc:'Lento, robusto e com espaço para tudo.' },
};
// veículos terrestres (velocidade em m/s)
const VEHICLES = {
  vanta: { name:'Vanta Coupé',      cls:'Esportivo compacto', kind:'coupe', color:0x2a7a9a, glow:0x5ef2ff, speed:40, accel:12, turn:1.0,  price:0,   desc:'O primeiro carro de todo piloto de Nova Kessler. Rápido e barulhento.' },
  lince: { name:'Lince R',          cls:'Moto elétrica',      kind:'bike',  color:0xc83a5a, glow:null,     speed:50, accel:18, turn:1.25, price:480, desc:'Leve, ágil e perigosamente rápida.' },
  rhino: { name:'Rhino Utilitário', cls:'Picape blindada',    kind:'truck', color:0x8a6a3a, glow:0xffb347, speed:32, accel:8,  turn:.75,  price:650, desc:'Aguenta pancada, carrega sucata e não pede desculpas.' },
};
const CONTRACTS = [
  { id:'drones',   title:'Limpeza de Rota',            desc:'Eliminar 3 drones piratas de sucata no Setor Kessler.', type:'kill',    target:3, reward:300 },
  { id:'scrap',    title:'Catador de Órbita',          desc:'Recolher 8 unidades de sucata flutuante.',              type:'collect', target:8, reward:180 },
  { id:'delivery', title:'Suprimentos p/ Estação Beta', desc:'Levar 2 caixas de suprimentos até a doca da Estação Beta.', type:'deliver', target:1, reward:250, cargo:{supplies:2} },
];

// ================================================================ SAVE
const SAVE_KEY = 'simulatta_save_v2', SET_KEY = 'simulatta_settings_v1';
function defaultState(){
  return { credits:150, inv:{ scrap:0 }, active:null, progress:0, completed:0, kills:0,
    placed:{ sofa:{x:-1.2,z:1.7,r:Math.PI}, table:{x:-1.2,z:-.2,r:0}, bench:{x:7,z:-2.4,r:-Math.PI/2} },
    ships:[ { uid:'s1', model:'kestrel', slots:{ engine:null, weapon:'cannon_basic', armor:null } } ], activeShip:'s1',
    vehicles:['vanta'], vpos:{} };
}
function load(key, def){ try{ const r=localStorage.getItem(key); if(r) return Object.assign(def, JSON.parse(r)); }catch(e){} return def; }
let state = load(SAVE_KEY, defaultState());
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){} }
const DEFAULT_SETTINGS = { fp:false, master:.8, music:.7, sfx:.8, sens:1, invertY:false, scale:1, fov:72, crt:false, hints:true };
let settings = load(SET_KEY, Object.assign({}, DEFAULT_SETTINGS));
function saveSettings(){ try{ localStorage.setItem(SET_KEY, JSON.stringify(settings)); }catch(e){} }

// inventário
const qty = id => state.inv[id]||0;
function addItem(id, n=1){ state.inv[id] = qty(id)+n; if(state.inv[id]<=0) delete state.inv[id]; }
const activeShip = () => state.ships.find(s=>s.uid===state.activeShip) || state.ships[0];
function shipStats(s){
  const d = SHIPS[s.model]; const st = { speed:d.speed, hull:d.hull, turn:d.turn, dual:false, weapon:!!s.slots.weapon };
  for(const k in s.slots){ const it=ITEMS[s.slots[k]]; if(!it) continue; const m=it.mod||{};
    if(m.speed) st.speed*=m.speed; if(m.hull) st.hull+=m.hull; if(m.dual) st.dual=true; }
  return st;
}

