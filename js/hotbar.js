'use strict';
/* Barra de itens (hotbar): mostra o que o jogador carrega — armas por espaço (1–4) e a ferramenta de extração.
   Destaca a arma equipada, mostra munição e permite trocar de arma com a roda do mouse. */

// ícones em pixel art (SVG 16x16, cor = currentColor)
const HB_ICONS = {
  fists:   'M4 6h8v2h1v4h-1v2H5v-2H4zM5 4h2v2H5zM7 3h2v3H7zM9 3h2v3H9zM11 4h1v2h-1z',
  baton:   'M3 12l7-7 2 2-7 7zM10 3h3v3h-1V4h-2zM2 13h2v2H2z',
  knife:   'M2 13l2-2 1 1-2 2zM5 10l7-7h2v2l-7 7z',
  pistol:  'M2 5h12v3H8v2H7v3H4v-3l1-2H2z',
  shotgun: 'M1 6h14v2H8v1H6l-1 3H3l1-3H1z',
  rifle:   'M1 6h11V5h3v3h-4v1H9v1H7l-1 3H4l1-3H1zM10 4h1v1h-1z',
  hands:   'M5 3h1v6h1V2h1v7h1V3h1v6h1V5h1v6l-2 3H6l-2-3V8h1z',
  pick:    'M2 4c3-2 9-2 12 0v1H9l-1 1v8H7V6L6 5H2z',
  drill:   'M2 6h6V4h3v2h2l2 2-2 2h-2v2H8v-2H2zM4 10h2v4H4z',
  laser:   'M2 6h8l2-1h2v6h-2l-2-1H2zM5 10h2v4H5zM14 7h2v2h-2z',
};
const hbIcon = id => `<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="currentColor" d="${HB_ICONS[id]||HB_ICONS.hands}"/></svg>`;
const HB_LABEL = { 1:'CORPO A CORPO', 2:'PISTOLA', 3:'ESPINGARDA', 4:'FUZIL' };

// armas que o jogador possui num espaço; a equipada vem primeiro
function hbSlotWeapons(slot){ return Object.keys(WEAPONS).filter(id=>WEAPONS[id].key===slot && ownsWeapon(id)); }
function hbShown(){ return mode==='hub' || mode==='station' || (mode==='city' && onFootNow()); }

let hotbarKey='';
function updateHotbar(){
  const el=document.getElementById('hotbar'); if(!el) return;
  const show = hbShown() && !ui.panel;
  const [cur]=curWeapon(), tool=bestTool();
  const parts=[show,cur,tool,combat.reloadT>0];
  for(let s=1;s<=4;s++){ const ids=hbSlotWeapons(s); parts.push(ids.join('+')); for(const id of ids){ const w=WEAPONS[id]; if(w.ammo) parts.push(clipOf(id), qty(w.ammo)); } }
  const key=parts.join();
  if(key===hotbarKey) return; hotbarKey=key;
  el.style.display = show ? 'flex' : 'none';
  if(!show) return;
  let h='';
  for(let s=1;s<=4;s++){
    const ids=hbSlotWeapons(s), id = ids.includes(cur) ? cur : ids[0];
    if(!id){ h += `<div class="hs empty" title="${HB_LABEL[s]}"><kbd>${s}</kbd><div class="hi">${hbIcon(['','fists','pistol','shotgun','rifle'][s])}</div><div class="hn">vazio</div></div>`; continue; }
    const w=WEAPONS[id], on = id===cur, more = ids.length>1 ? `<span class="hm">+${ids.length-1}</span>` : '';
    const sub = w.melee ? (w.stun?'atordoa':'corpo a corpo')
      : (on && combat.reloadT>0) ? '<span class="rl">RECARREG…</span>'
      : `<b class="${clipOf(id)===0?'out':''}">${clipOf(id)}</b>/${qty(w.ammo)}`;
    h += `<div class="hs${on?' on':''}"><kbd>${s}</kbd>${more}<div class="hi">${hbIcon(id)}</div><div class="hn">${w.name}</div><div class="ha">${sub}</div></div>`;
  }
  const t=TOOLS[tool];
  h += `<div class="sep"></div><div class="hs tool" title="Ferramenta em uso: sempre a melhor que você tem"><kbd>⚒</kbd><div class="hi">${hbIcon(tool)}</div><div class="hn">${t.name}</div><div class="ha">nível ${t.tier}</div></div>`;
  el.innerHTML = h;
}

// roda do mouse: alterna entre todas as armas possuídas
function cycleWeapon(dir){
  const ids=[1,2,3,4].flatMap(hbSlotWeapons); if(ids.length<2) return;
  const [cur]=curWeapon(), i=Math.max(0,ids.indexOf(cur));
  state.weapon = ids[(i+dir+ids.length)%ids.length];
  combat.reloadT=0; sfx.ui(); save(); updateWeaponHUD(); updateHotbar();
}
addEventListener('wheel', e=>{
  if(!hbShown() || ui.panel || !document.pointerLockElement) return;
  cycleWeapon(e.deltaY>0 ? 1 : -1);
}, { passive:true });
