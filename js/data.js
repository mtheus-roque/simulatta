'use strict';
/* Dados do jogo (itens, naves, contratos) e save */
// ================================================================ DADOS
const CUR = '₢';
const CATS = { MATERIAL:{ic:'▣',c:'#d8a040'}, 'MINÉRIO':{ic:'◆',c:'#8ad8ff'}, RECURSO:{ic:'✿',c:'#c8a0ff'}, COMIDA:{ic:'♨',c:'#ffb347'},
  'MÓDULO':{ic:'⚙',c:'#5ef2ff'}, 'MÓVEL':{ic:'▙',c:'#ff8ad0'}, CARGA:{ic:'▤',c:'#7dff9a'} };
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
  ore_iron:     { name:'Minério de Ferro',     cat:'MINÉRIO', sell:16, desc:'Rocha ferrosa das planícies de Aurora.' },
  ore_copper:   { name:'Minério de Cobre',     cat:'MINÉRIO', sell:24, desc:'Veios esverdeados comuns no Deserto Rubro.' },
  crystal:      { name:'Cristal de Aurorita',  cat:'MINÉRIO', sell:65, desc:'Cristal luminoso das montanhas e geleiras. Porto Ferrugem paga mais.' },
  herbs:        { name:'Ervas Medicinais',     cat:'RECURSO', sell:14, use:{ hp:15, food:3 }, desc:'Folhas roxas das planícies. Fecham cortes — podem ser consumidas.' },
};
// comida (paga com créditos locais) — saciedade (food), vida (hp) e energia ilimitada temporária (boost, em segundos)
const FOODS = {
  ramen:   { name:'Ramen de Missô',           price:18, food:45, hp:5,  desc:'Caldo quente, ovo marinado e cebolinha.' },
  noodles: { name:'Yakisoba Neon',            price:14, food:35,        desc:'Macarrão na chapa com molho que brilha no escuro.' },
  espeto:  { name:'Espetinho de Grilo-Lunar', price:10, food:20,        desc:'Crocante. Melhor não perguntar a origem.' },
  cafe:    { name:'Café Preto K7',            price:6,  food:4,  boost:120, desc:'Energia sem limite por 2 minutos.' },
  doce:    { name:'Dango de Neon',            price:8,  food:12,        desc:'Três bolinhas de arroz doce, uma de cada cor.' },
  sushi:   { name:'Sushi de Alga-Rubra',      price:22, food:35, hp:10, desc:'Peixe de cativeiro com alga do Deserto Rubro.' },
  bebida:  { name:'Cerveja de Arroz',         price:9,  food:8,  hp:3,  desc:'Morna, mas honesta.' },
  barra:   { name:'Barra Proteica',           price:12, food:25,        desc:'Ração de piloto. Cabe no bolso do casaco.' },
  agua:    { name:'Água Reciclada',           price:3,  food:4,  boost:20, desc:'Filtrada três vezes. Dizem.' },
  kit:     { name:'Kit Médico',               price:40, hp:50,          desc:'Spray coagulante e analgésico.' },
};
const MENUS = { 'RAMEN':['ramen','bebida','agua'], 'NOODLES 麺':['noodles','ramen','agua'], 'ESPETINHOS':['espeto','bebida'], 'CAFÉ':['cafe','doce','agua'],
  'CAFÉ K7':['cafe','doce','agua'], 'DOCES':['doce','cafe'], 'SUSHI':['sushi','bebida','agua'], 'BAR':['bebida','espeto','agua'],
  'MERCADO 24H':['barra','agua','doce','espeto'], 'FARMÁCIA':['kit','agua'], 'CLÍNICA':['kit'] };
for(const [id,f] of Object.entries(FOODS)) ITEMS['f_'+id] = { name:f.name, cat:'COMIDA', desc:f.desc, use:{ food:f.food, hp:f.hp, boost:f.boost } };
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
    vehicles:['vanta'], vpos:{}, stats:{ hp:100, food:85 }, mined:{}, ship:null };
}
function load(key, def){ try{ const r=localStorage.getItem(key); if(r) return Object.assign(def, JSON.parse(r)); }catch(e){} return def; }
let state = load(SAVE_KEY, defaultState());
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){} }
const DEFAULT_SETTINGS = { fp:false, master:.8, music:.7, sfx:.8, sens:1, invertY:false, scale:1, fov:72, crt:false };
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

