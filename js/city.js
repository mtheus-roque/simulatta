'use strict';
/* Cidades de Aurora — Nova Kessler e Porto Ferrugem (sítios planos sobre o planeta esférico).
   Jogador a pé (com pulo), veículos, nave atmosférica, NPCs, trânsito e minimapa.
   Escala: 1 unidade = 1 metro. */

// ---------------------------------------------------------------- parâmetros
const CITY = { P:72, ROAD:16, WALK:5 };
const HOME_DOOR = new V3(0,0,48.6), HANGAR_PAD = new V3(216,0,0);
const PARK_SPOTS = [[6,41.5],[14,41.5],[22,41.5],[-8,41.5]];
const SHIP_SCALE = 2.2;
const shipLift = m => m==='mule' ? 2.2 : 1.7;
const SHOP_NAMES = [ ['BAR','#ff7a3a'],['NOODLES 麺','#ffb347'],['HOTEL','#ff4a6a'],['RAMEN','#ffd040'],['CLÍNICA','#7dff9a'],
  ['ARMAS','#ff4a4a'],['TATTOO','#ff4ab0'],['KARAOKÊ','#c07aff'],['CAFÉ','#ffb347'],['MERCADO 24H','#5ef2ff'],
  ['IMPLANTES','#5ef2ff'],['BOUTIQUE AURA','#ff9ad8'],['FARMÁCIA','#7dff9a'],['PENHORES','#d8a040'],['CASSINO','#ffd040'],
  ['LAVANDERIA','#8ab4ff'],['SUSHI','#ff7a3a'],['FLIPERAMA','#ff4ab0'],['ELETRÔNICOS','#5ef2ff'],['BARBEARIA','#ff4a6a'] ];
const FUNCTIONAL_KESSLER = [
  { name:'MOTORES ÁUREA',  color:'#5ef2ff', act:['shop','vehicles'], actLabel:'concessionária de veículos' },
  { name:'OFICINA REPARO', color:'#ffb347', act:['shop','modules'],  actLabel:'módulos de nave' },
  { name:'FERRO-VELHO',    color:'#d8a040', act:['shop','sell'],     actLabel:'vender sucata e minérios' },
  { name:'CASA & ANTIGOS', color:'#ff8ad0', act:['shop','furniture'],actLabel:'móveis' },
  { name:'CONTRATOS',      color:'#7dff9a', act:['contracts'],       actLabel:'quadro de contratos' },
];
const FUNCTIONAL_PORTO = [
  { name:'MERCADOR DE MINÉRIOS', color:'#5affc8', act:['shop','sell'],    actLabel:'paga mais por minérios' },
  { name:'OFICINA DA DOCA',      color:'#ffb347', act:['shop','modules'], actLabel:'módulos de nave' },
  { name:'CONTRATOS',            color:'#7dff9a', act:['contracts'],      actLabel:'quadro de contratos' },
];
const SITE_CFG = {
  kessler:{ N:7, seed:1337, styles:[0,1,2,3], tall:1, npcN:70, trafficN:34, airN:26, outer:1650, anchor:HOME_DOOR, spawn:new V3(0,.2,46),
    special:{'3,3':'park','3,4':'home','6,3':'hangar','6,2':'port','6,4':'port2','2,3':'exchange'}, functional:FUNCTIONAL_KESSLER },
  porto:  { N:5, seed:4242, styles:[0,2,4,5], tall:.45, npcN:45, trafficN:16, airN:10, outer:950, anchor:new V3(0,0,-30), spawn:new V3(0,.2,-26),
    special:{'2,2':'market','4,2':'dock'}, functional:FUNCTIONAL_PORTO },
};
const city = { scene:new THREE.Scene(), cam:new THREE.PerspectiveCamera(70, innerWidth/innerHeight, .1, 160000),
  player:null, frame:makeFrame(), yaw:0, pitch:.22, heading:Math.PI, walk:0, vy:0, air:0,
  vehicles:{}, drive:null, fly:null, launch:null, ship:null, shipModel:null, near:null, mining:null,
  camOff:0, lookT:0, tickT:0, shake:0, anim:[], here:null };
let S = null;                                               // sítio em construção

// RNG com semente: cada cidade é sempre igual
let crngState = 1337;
const crng = ()=>{ crngState|=0; crngState=crngState+0x6D2B79F5|0; let t=Math.imul(crngState^crngState>>>15,1|crngState); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const cr = (a,b)=>a+crng()*(b-a);
const pick = arr => arr[(crng()*arr.length)|0];
const lineOf = k => (k - S.N/2)*CITY.P;

// ---------------------------------------------------------------- batching
const _bm=new THREE.Matrix4(), _bq=new THREE.Quaternion(), _bs=new V3(1,1,1), _bp=new V3();
const cityBatch = {
  groups:new Map(),
  add(mat, geom, x=0,y=0,z=0, ry=0){
    _bq.setFromAxisAngle(Y_AXIS, ry); _bm.compose(_bp.set(x,y,z), _bq, _bs); geom.applyMatrix4(_bm);
    const g = geom.index ? geom.toNonIndexed() : geom;
    if(!this.groups.has(mat)) this.groups.set(mat, []); this.groups.get(mat).push(g);
  },
  build(target){
    const U = THREE.BufferGeometryUtils;
    for(const [mat, list] of this.groups){
      let merged=null; try{ merged = U.mergeBufferGeometries(list); }catch(e){}
      if(merged) target.add(new THREE.Mesh(merged, mat)); else list.forEach(g=>target.add(new THREE.Mesh(g, mat)));
    }
    this.groups.clear();
  }
};
const gBox = (w,h,d)=>new THREE.BoxGeometry(w,h,d);
const gCyl = (rt,rb,h,s=10)=>new THREE.CylinderGeometry(rt,rb,h,s);

// ---------------------------------------------------------------- texturas
function facadeTex(style){
  const W=128, H=112;
  const pal = [ ['#8a847c','#26303a'], ['#2e3a48','#4a6a8a'], ['#6a4a36','#2a2220'], ['#d4d2ca','#1e2a32'], ['#8a5a3a','#2a1a14'], ['#5a5048','#1a1a1e'] ][style];
  const lit = ['#ffd9a0','#ffe8c0','#ffcf90','#fff4e0','#ffd9a0','#a0e8ff','#ffb070','#ff9ad8'];
  const mk = emi => { const t = canvasTex(W,H,(g)=>{
    g.fillStyle = emi ? '#000' : pal[0]; g.fillRect(0,0,W,H);
    for(let fy=0; fy<4; fy++){
      const y = fy*28;
      if(style===3){ g.fillStyle = emi ? (Math.random()<.55 ? '#2a9ab8' : '#000') : pal[1]; g.fillRect(0,y+9,W,11); continue; }
      for(let fx=0; fx<4; fx++){
        const x = fx*32, on = Math.random()<(style>=4?.42:.34);
        g.fillStyle = emi ? (on ? lit[(Math.random()*lit.length)|0] : '#000') : pal[1];
        if(style===0||style===4) g.fillRect(x+7,y+7,18,14); else if(style===1) g.fillRect(x+3,y+3,27,23); else g.fillRect(x+9,y+9,14,10);
      }
    }
    if(!emi) for(let k=0;k<(style>=4?70:30);k++){ g.fillStyle=`rgba(${style>=4?'60,20,0':'0,0,0'},${Math.random()*.18})`; g.fillRect(Math.random()*W,Math.random()*H,rand(2,10),rand(4,30)); }
  }); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; };
  return new THREE.MeshStandardMaterial({ map:mk(false), emissiveMap:mk(true), emissive:0xffffff, emissiveIntensity:.7,
    roughness: style===1?.35:.85, metalness: style===1?.55:.1 });
}
function facadeUV(geom, w, h, d, circ){
  const uv=geom.attributes.uv, n=geom.attributes.normal;
  for(let i=0;i<uv.count;i++){
    if(Math.abs(n.getY(i))>.9){ uv.setXY(i,.008,.992); continue; }
    const horiz = circ || (Math.abs(n.getX(i))>.9 ? d : w);
    uv.setXY(i, uv.getX(i)*horiz/16, uv.getY(i)*h/14);
  }
  return geom;
}
function citySign(text, color, w=256, h=64){
  return canvasTex(w,h,(g)=>{
    g.fillStyle='#0b0706'; g.fillRect(0,0,w,h); g.strokeStyle=color; g.lineWidth=3; g.strokeRect(4,4,w-8,h-8);
    let size=36; g.font=`bold ${size}px "Courier New",monospace`;
    while(g.measureText(text).width > w-24 && size>12){ size-=2; g.font=`bold ${size}px "Courier New",monospace`; }
    g.textAlign='center'; g.textBaseline='middle'; g.shadowColor=color; g.shadowBlur=14; g.fillStyle=color;
    g.fillText(text,w/2,h/2+2); g.fillText(text,w/2,h/2+2);
  });
}
const CITY_ADS = [ ['AURORA AIRLINES','Voe além do Colapso','#5ef2ff'], ['VEXARI DRIVES','Propulsão de confiança','#8ab4ff'],
  ['OSKARI MINING','Força que move mundos','#ffb347'], ['NEO-COMET','O arcade voltou','#ff4ab0'],
  ['ZERO-G COLA','Sabor sem gravidade','#ff5a5a'], ['ÊXODO 214','Nunca esquecer a Terra','#7dff9a'] ];
function adTex([title, sub, color]){
  return canvasTex(256,144,(g,w,h)=>{
    g.fillStyle='#000'; g.fillRect(0,0,w,h); g.strokeStyle=color; g.lineWidth=2; g.strokeRect(3,3,w-6,h-6);
    for(let y=0;y<h;y+=4){ g.fillStyle='rgba(255,255,255,.04)'; g.fillRect(0,y,w,1); }
    g.textAlign='center'; g.shadowColor=color; g.shadowBlur=12; g.fillStyle=color;
    g.font='bold 30px "Courier New",monospace'; g.fillText(title,w/2,66);
    g.font='16px "Courier New",monospace'; g.fillStyle='#ffffff'; g.fillText(sub,w/2,100);
  });
}
function padTex(label){ return canvasTex(256,256,(g)=>{ g.fillStyle='#3a3a3e'; g.fillRect(0,0,256,256); g.strokeStyle='#e8c040'; g.lineWidth=10; g.beginPath(); g.arc(128,128,110,0,Math.PI*2); g.stroke();
  g.lineWidth=3; g.beginPath(); g.arc(128,128,90,0,Math.PI*2); g.stroke(); g.fillStyle='#e8c040'; g.font='bold 110px "Courier New",monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(label,128,132); }); }

// ---------------------------------------------------------------- modelos
function makeNPC(sp, uniform){
  const g = new THREE.Group();
  const leg = (w,h,d,m,x)=>{ const l=box(w,h,d,m,x,h/2,0,g); l.geometry.translate(0,-h/2,0); l.position.y=h; return l; };
  if(sp==='vexari'){
    const skin=M(0x7a8aa6), cloth=M(pick([0x3a3050,0x504060,0x2a4050,0x5a3a3a]));
    g.userData.legL=leg(.12,.95,.14,skin,-.1); g.userData.legR=leg(.12,.95,.14,skin,.1);
    cyl(.17,.24,.9,6,cloth,0,1.38,0,g); box(.5,.14,.22,cloth,0,1.86,0,g);
    box(.09,.75,.1,skin,-.3,1.5,0,g); box(.09,.75,.1,skin,.3,1.5,0,g);
    const h=new THREE.Mesh(new THREE.IcosahedronGeometry(.2,0),skin); h.scale.set(1,1.45,1); h.position.y=2.2; g.add(h);
  } else if(sp==='oskari'){
    const rock=M(0x7a6a56), d=M(0x4a3e34);
    g.userData.legL=leg(.3,.6,.32,d,-.22); g.userData.legR=leg(.3,.6,.32,d,.22);
    const t=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,0),rock); t.scale.set(1.25,1,.9); t.position.y=1.22; g.add(t);
    box(.28,.8,.28,rock,-.78,1.15,0,g); box(.28,.8,.28,rock,.78,1.15,0,g);
    const h=new THREE.Mesh(new THREE.IcosahedronGeometry(.25,0),rock); h.position.y=1.98; g.add(h);
  } else {
    const coat=M(uniform?0x1a2a4a:pick([0x6b5636,0x3a3a44,0x5a2a2a,0x2a4a3a,0x7a6a5a,0x2a2a2a,0x8a5a2a])), dark=M(uniform?0x10141c:0x24242a);
    const skin=M(pick([0xc89a72,0x8a5a3a,0xe0b090,0x5a3a2a,0xa87a5a])), hair=M(uniform?0x0a0e18:pick([0x1c1612,0x3a2a1a,0x8a6a3a,0xb04a2a,0xd8d0c0]));
    g.userData.legL=leg(.16,.62,.18,dark,-.12); g.userData.legR=leg(.16,.62,.18,dark,.12);
    cyl(.28,.4,.95,7,coat,0,1.0,0,g); box(.66,.24,.34,coat,0,1.42,0,g);
    const h=new THREE.Mesh(new THREE.IcosahedronGeometry(.2,0),skin); h.position.y=1.76; g.add(h);
    box(.36,.12,.36,hair,0,1.9,-.03,g);
    if(uniform){ box(.42,.08,.44,hair,0,1.97,0,g); box(.3,.06,.04,B(0x3a8aff),0,1.8,.18,g); box(.3,.12,.04,B(0xffd040),-.2,1.45,.18,g); }
  }
  return g;
}
function makeCar(kind, color, glow, police){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const paint=M(color,{metalness:.55,roughness:.45}), dark=M(0x16161a), glass=M(0x1a2838,{metalness:.8,roughness:.2}), tire=M(0x111111);
  const head=B(0xfff2d8), tail=B(0xff2030), wheels=[];
  const wheel=(x,y,z,r,w)=>{ const p=new THREE.Group(); p.position.set(x,y,z); const m=cyl(r,r,w,10,tire); m.rotation.z=Math.PI/2; p.add(m); g.add(p); wheels.push(p); p.userData.r=r; };
  let L=4.4, Wd=2;
  if(kind==='bike'){
    box(.35,.45,1.9,paint,0,.75,0,body); box(.3,.22,.8,dark,0,1.05,.25,body); box(.75,.06,.06,dark,0,1.15,-.75,body);
    box(.22,.15,.1,head,0,.95,-.98,body); box(.25,.08,.08,tail,0,.9,.98,body);
    wheel(0,.36,-.78,.36,.14); wheel(0,.36,.78,.36,.14); L=2.1; Wd=.6;
  } else if(kind==='truck'){
    box(2.3,.9,5.4,paint,0,1.05,0,body); box(2.1,1,2,paint,0,1.95,-1.2,body); box(1.9,.6,.05,glass,0,2.05,-2.21,body);
    box(.1,.5,2.9,paint,-1.1,1.75,1.25,body); box(.1,.5,2.9,paint,1.1,1.75,1.25,body); box(2.3,.5,.1,paint,0,1.75,2.65,body);
    box(2.4,.25,.3,dark,0,.75,-2.75,body);
    [-.75,.75].forEach(x=>box(.45,.15,.06,head,x,1.25,-2.72,body)); [-.85,.85].forEach(x=>box(.3,.15,.06,tail,x,1.25,2.72,body));
    [[-1.1,-1.8],[1.1,-1.8],[-1.1,1.8],[1.1,1.8]].forEach(([x,z])=>wheel(x,.5,z,.5,.4)); L=5.4; Wd=2.3;
  } else if(kind==='van'){
    box(2.1,1.9,4.8,paint,0,1.35,0,body); box(1.9,.7,.05,glass,0,1.85,-2.41,body); box(.05,.6,2.4,glass,1.06,1.85,-.6,body); box(.05,.6,2.4,glass,-1.06,1.85,-.6,body);
    [-.7,.7].forEach(x=>box(.35,.14,.06,head,x,.95,-2.42,body)); [-.8,.8].forEach(x=>box(.2,.3,.06,tail,x,1.2,2.42,body));
    [[-1,-1.6],[1,-1.6],[-1,1.6],[1,1.6]].forEach(([x,z])=>wheel(x,.42,z,.42,.32)); L=4.8; Wd=2.1;
  } else {
    box(2,.55,4.4,paint,0,.62,0,body); box(1.7,.5,2.1,glass,0,1.12,.25,body); box(1.72,.08,2.0,paint,0,1.4,.3,body);
    box(1.6,.06,.35,paint,0,1.0,2.15,body);
    [-.65,.65].forEach(x=>box(.4,.12,.05,head,x,.72,-2.21,body)); box(1.7,.1,.05,tail,0,.75,2.21,body);
    [[-1,-1.4],[1,-1.4],[-1,1.4],[1,1.4]].forEach(([x,z])=>wheel(x,.38,z,.38,.32));
  }
  if(police){ g.userData.lr = box(.6,.18,.35,B(0xff2030),-.35,1.5,.3,body); g.userData.lb = box(.6,.18,.35,B(0x2a6aff),.35,1.5,.3,body);
    box(2.02,.2,1.4,B(0xe8e8f0),0,.75,.4,body); }
  if(glow){ const ug=new THREE.Mesh(new THREE.PlaneGeometry(Wd+.3,L+.2), B(glow,{transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false}));
    ug.rotation.x=-Math.PI/2; ug.position.y=.05; g.add(ug); }
  return { g, body, wheels, L, kind };
}
function makeHover(color){
  const g=new THREE.Group();
  box(1.8,.55,4,M(color,{metalness:.6}),0,0,0,g); box(1.4,.4,1.6,M(0x1a2838,{metalness:.8}),0,.4,-.2,g);
  box(3,.12,.8,M(0x2a2a30),0,-.1,1.2,g); box(2.4,.25,.4,B(0x7ff6ff),0,-.3,1.2,g); box(1.4,.12,.05,B(0xff2030),0,0,2.02,g);
  return g;
}

// ---------------------------------------------------------------- construção das cidades
function buildCity(){
  const s = city.scene;
  city.mat = {
    asphalt:M(0x2a2a2e,{flatShading:false}), walk:M(0x8a8680), grass:M(0x4a7a3a), trunk:M(0x5a4030),
    leaf:[M(0x3a7a3a),M(0x4a8a3a),M(0x2f6a3a),M(0x6a8a3a)], metal:M(0x5a5a62,{metalness:.5}), dark:M(0x2a2a30), concrete:M(0x9a968e),
    white:M(0xd8d8d0), lamp:B(0xffe0a8), redLight:B(0xff2a1a), water:M(0x2a8aaa,{emissive:0x0a3a4a,roughness:.2,metalness:.3}),
    shopGlass:[B(0xffc890),B(0xa8f0ff),B(0xffa8d8)], awnings:[M(0xa83a2a),M(0x2a6a8a),M(0xc89a2a),M(0x5a2a6a),M(0x2a7a4a)],
    hangar:M(0x6a6e74,{metalness:.4}), yellow:M(0xd8a020), tank:M(0xd0d0c8,{metalness:.3}), rust:M(0x8a4a2a),
  };
  city.facade = [0,1,2,3,4,5].map(facadeTex);
  city.adTex = CITY_ADS.map(adTex);
  const roadTex = canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#2a2a2e'; g.fillRect(0,0,w,h);
    for(let i=0;i<120;i++){ g.fillStyle=`rgba(0,0,0,${Math.random()*.25})`; g.fillRect(Math.random()*w,Math.random()*h,rand(1,5),rand(1,5)); }
    g.fillStyle='#e8c040'; g.fillRect(0,31,30,2); g.fillStyle='#d8d8d0'; g.fillRect(0,3,w,1); g.fillRect(0,60,w,1); });
  roadTex.wrapS=roadTex.wrapT=THREE.RepeatWrapping;
  city.roadMat = M(0xffffff,{map:roadTex, flatShading:false, roughness:.9});
  const outerTex = canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#4a4846'; g.fillRect(0,0,w,h); g.fillStyle='#2c2c30'; g.fillRect(0,56,w,16); g.fillRect(56,0,16,h);
    for(let i=0;i<200;i++){ g.fillStyle=`rgba(0,0,0,${Math.random()*.15})`; g.fillRect(Math.random()*w,Math.random()*h,rand(2,12),rand(2,12)); } });
  outerTex.wrapS=outerTex.wrapT=THREE.RepeatWrapping; city.outerTex=outerTex;

  buildSky(s); buildPlanet(s); buildClouds(s);
  for(const site of SITES) buildSite(site);
  city.player = makePilot(); s.add(city.player);
}
function buildSite(site){
  S = site; Object.assign(site, SITE_CFG[site.id]);
  site.group = new THREE.Group(); site.group.position.copy(site.center); site.group.quaternion.setFromUnitVectors(Y_AXIS, site.up);
  city.scene.add(site.group); site.group.updateMatrixWorld(true);
  site.mat = site.group.matrixWorld.clone(); site.inv = site.mat.clone().invert();
  Object.assign(site, { boxes:[], circles:[], shops:[], npcs:[], traffic:[], air:[], anim:[], pads:[], grid:new Map(), ext:site.N/2*CITY.P });
  crngState = site.seed;
  const MAT = city.mat, G = site.group, ext = site.ext;
  const outerSize = 2*site.paved;
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(outerSize,outerSize), M(0xffffff,{map:city.outerTex.clone(), flatShading:false}));
  outer.material.map.needsUpdate=true; outer.material.map.repeat.set(outerSize/48,outerSize/48);
  outer.rotation.x=-Math.PI/2; outer.position.y=-.1; G.add(outer);
  const base = new THREE.Mesh(new THREE.PlaneGeometry(2*ext+40, 2*ext+40), MAT.asphalt); base.rotation.x=-Math.PI/2; base.position.y=-.02; G.add(base);
  const roadLen = 2*ext+CITY.ROAD;
  for(let k=0;k<=site.N;k++) for(const axis of ['x','z']){
    const gg = new THREE.PlaneGeometry(roadLen, CITY.ROAD); gg.rotateX(-Math.PI/2);
    const uv=gg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setX(i, uv.getX(i)*roadLen/16);
    if(axis==='x') cityBatch.add(city.roadMat, gg, 0, .02, lineOf(k)); else cityBatch.add(city.roadMat, gg, lineOf(k), .03, 0, Math.PI/2);
  }
  for(let i=0;i<site.N;i++) for(let j=0;j<site.N;j++){
    const x0=lineOf(i)+CITY.ROAD/2, x1=lineOf(i+1)-CITY.ROAD/2, z0=lineOf(j)+CITY.ROAD/2, z1=lineOf(j+1)-CITY.ROAD/2;
    const cx=(x0+x1)/2, cz=(z0+z1)/2, size=x1-x0, sp=site.special[`${i},${j}`];
    cityBatch.add(MAT.walk, gBox(size,.2,size), cx,.1,cz);
    for(let e=0;e<4;e++) for(let q=-2;q<=2;q++){
      const off=q*11, [lx,lz] = [[cx+off,z0+1.1],[cx+off,z1-1.1],[x0+1.1,cz+off],[x1-1.1,cz+off]][e];
      if(sp==='home' && e===0 && Math.abs(off)<25) continue;
      if((q+e)%2===0){ cityBatch.add(MAT.metal, gCyl(.1,.14,7,6), lx,3.7,lz); cityBatch.add(MAT.lamp, gBox(.6,.18,.6), lx,7.2,lz); site.circles.push({x:lx,z:lz,r:.2}); }
      else if(sp!=='hangar' && sp!=='dock' && crng()<.55){ cityBatch.add(MAT.trunk, gCyl(.15,.2,2.4,5), lx,1.4,lz); cityBatch.add(pick(MAT.leaf), new THREE.IcosahedronGeometry(cr(1.2,1.7),0), lx,3.3,lz); site.circles.push({x:lx,z:lz,r:.3}); }
    }
    const ix0=x0+CITY.WALK, ix1=x1-CITY.WALK, iz0=z0+CITY.WALK, iz1=z1-CITY.WALK;
    if(sp==='park') buildPark(cx,cz,ix1-ix0);
    else if(sp==='home') buildHomeTower(ix0,ix1,iz0,iz1);
    else if(sp==='hangar') buildHangar(ix0,ix1,iz0,iz1);
    else if(sp==='port' || sp==='port2') buildPortBlock(cx,cz,sp==='port');
    else if(sp==='exchange') buildExchange(cx,cz);
    else if(sp==='market') buildMarket(cx,cz,ix1-ix0);
    else if(sp==='dock') buildDock(ix0,ix1,iz0,iz1);
    else if(crng()<.14){
      const w=cr(30,42), d=cr(30,42), h=distHeight(cx,cz)*1.5+cr(20,60)*site.tall;
      addTower(cx,cz,w,d,h, pick(site.styles), [{nx:1,nz:0},{nx:-1,nz:0},{nx:0,nz:1},{nx:0,nz:-1}], crng()<.35);
    } else {
      const lot=(ix1-ix0)/2;
      for(let a=0;a<2;a++) for(let b=0;b<2;b++){
        const w=cr(15,lot-1.5), d=cr(15,lot-1.5), x = a ? ix1-w/2 : ix0+w/2, z = b ? iz1-d/2 : iz0+d/2;
        addTower(x,z,w,d, distHeight(x,z)+cr(0,30)*site.tall, pick(site.styles), [{nx:a?1:-1,nz:0},{nx:0,nz:b?1:-1}], crng()<.16);
      }
    }
  }
  assignShops();
  buildOuterDistricts();
  if(site.id==='kessler'){ buildSpaceport(); buildHorizon(); }
  buildAirTraffic();
  cityBatch.build(G);
  buildTraffic(); buildNPCs(); indexBoxes(site); buildMinimap(site);
}
function distHeight(x,z){ const d=Math.hypot(x,z); const base=150*Math.exp(-d/240)*S.tall; const r=crng(); return 14 + r*30*S.tall + base*crng() + (r>.93 ? cr(80,150)*S.tall : 0); }
function addTower(cx, cz, w, d, h, style, faces, round){
  const MAT=city.mat, mat=city.facade[style], G=S.group;
  if(round){ const r=Math.min(w,d)/2; cityBatch.add(mat, facadeUV(gCyl(r*.92,r,h,18),0,h,0,Math.PI*2*r), cx,h/2,cz); w=d=r*2; }
  else {
    let h1=h; if(h>40 && crng()<.55) h1=h*cr(.5,.78);
    cityBatch.add(mat, facadeUV(gBox(w,h1,d),w,h1,d), cx,h1/2,cz);
    if(h1<h){ const w2=w-cr(3,7), d2=d-cr(3,7), st=crng()<.3?3:style; cityBatch.add(city.facade[st], facadeUV(gBox(w2,h-h1,d2),w2,h-h1,d2), cx,h1+(h-h1)/2,cz); }
  }
  for(let k=0;k<1+(crng()*3|0);k++) cityBatch.add(MAT.metal, gBox(cr(2,4),cr(1,2.2),cr(2,4)), cx+cr(-w/5,w/5), h+.8, cz+cr(-d/5,d/5));
  if(h>85 && crng()<.6){ const sh=cr(12,30); cityBatch.add(MAT.metal, gCyl(.3,.5,sh,6), cx,h+sh/2,cz); cityBatch.add(MAT.redLight, gBox(.9,.9,.9), cx,h+sh,cz); }
  else cityBatch.add(MAT.redLight, gBox(.6,.6,.6), cx+w*.3, h+.3, cz+d*.3);
  S.boxes.push({ x0:cx-w/2, x1:cx+w/2, z0:cz-d/2, z1:cz+d/2, h });
  for(const f of faces) addStorefront(cx,cz,w,d,f);
  if(h>55 && crng()<.4) addHolo(cx,cz,w,d,h,faces[0]);
  void G;
}
function addStorefront(cx,cz,w,d,f){
  const along = f.nx ? d : w, sw = Math.min(along*.8, 14);
  const ox = cx+f.nx*w/2, oz = cz+f.nz*d/2, ry = Math.atan2(f.nx, f.nz);
  cityBatch.add(pick(city.mat.shopGlass), new THREE.PlaneGeometry(sw,3.2), ox+f.nx*.06, 1.8, oz+f.nz*.06, ry);
  cityBatch.add(pick(city.mat.awnings), gBox(sw,.15,1.6), ox+f.nx*.8, 3.7, oz+f.nz*.8, ry);
  S.shops.push({ x:ox+f.nx*1.8, z:oz+f.nz*1.8, sx:ox+f.nx*.1, sz:oz+f.nz*.1, ry, sw });
}
function addHolo(cx,cz,w,d,h,f){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(18,10), new THREE.MeshBasicMaterial({ map:pick(city.adTex), transparent:true, opacity:.85,
    blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }));
  m.position.set(cx+f.nx*(w/2+1.5), Math.min(h-8, cr(18,h*.8)), cz+f.nz*(d/2+1.5)); m.rotation.y=Math.atan2(f.nx,f.nz);
  S.group.add(m); const ph=crng()*9;
  S.anim.push(t=>{ m.material.opacity = .72 + Math.sin(t*3+ph)*.1 - (Math.random()<.015 ? .5 : 0); });
}
function assignShops(){
  const A=S.anchor;
  const sorted = S.shops.filter(s=>!s.name).sort((a,b)=>Math.hypot(a.x-A.x,a.z-A.z)-Math.hypot(b.x-A.x,b.z-A.z));
  S.functional.forEach((f,i)=>Object.assign(sorted[i*2], f));
  for(const s of S.shops){
    if(s.done) continue;
    if(!s.name){ const [n,c]=pick(SHOP_NAMES); s.name=n; s.color=c; }
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(s.sw*.75,9),1.6), B(0xffffff,{map:citySign(s.name,s.color)}));
    sm.position.set(s.sx, 5.0, s.sz); sm.rotation.y=s.ry; S.group.add(sm);
  }
}
function addStall(n, c, x, z, ry){
  const MAT=city.mat, fx=Math.sin(ry), fz=Math.cos(ry);
  cityBatch.add(MAT.metal, gBox(3.4,1.1,1.4), x,.65,z, ry); cityBatch.add(pick(MAT.awnings), gBox(3.8,.12,2.2), x+fx*.3,2.7,z+fz*.3, ry);
  const sm=new THREE.Mesh(new THREE.PlaneGeometry(3,.7),B(0xffffff,{map:citySign(n,c,192,48)})); sm.position.set(x+fx*1.35,3.15,z+fz*1.35); sm.rotation.y=ry; S.group.add(sm);
  S.boxes.push({x0:x-1.7,x1:x+1.7,z0:z-1.7,z1:z+1.7,h:3});
  S.shops.push({ x:x+fx*2.2, z:z+fz*2.2, name:n, color:c, done:true });
}

// ---- quarteirões especiais
function buildPark(cx,cz,size){
  const MAT=city.mat;
  cityBatch.add(MAT.grass, gBox(size,.25,size), cx,.13,cz);
  cityBatch.add(MAT.concrete, gBox(size,.27,4), cx,.14,cz); cityBatch.add(MAT.concrete, gBox(4,.27,size), cx,.14,cz);
  for(let k=0;k<30;k++){
    let x,z; do{ x=cr(-size/2+3,size/2-3); z=cr(-size/2+3,size/2-3); }while(Math.abs(x)<4.5||Math.abs(z)<4.5||Math.hypot(x,z)<10);
    const th=cr(2.4,4), r=cr(1.8,3.2);
    cityBatch.add(MAT.trunk, gCyl(.2,.3,th,5), cx+x,th/2,cz+z); cityBatch.add(pick(MAT.leaf), new THREE.IcosahedronGeometry(r,0), cx+x,th+r*.7,cz+z);
    S.circles.push({x:cx+x,z:cz+z,r:.5});
  }
  cityBatch.add(MAT.concrete, gCyl(6,6.3,.9,20), cx,.45,cz); cityBatch.add(MAT.water, gCyl(5.5,5.5,.2,20), cx,.85,cz);
  cityBatch.add(MAT.concrete, gCyl(.6,.8,3,8), cx,1.5,cz); S.circles.push({x:cx,z:cz,r:6.3});
  const globe = new THREE.Mesh(new THREE.SphereGeometry(3,16,10), B(0x5ef2ff,{wireframe:true,transparent:true,opacity:.55}));
  globe.position.set(cx,7.5,cz); S.group.add(globe); S.anim.push((t,dt)=>{ globe.rotation.y+=dt*.4; });
  cityBatch.add(MAT.concrete, gBox(5,1,5), cx,.5,cz-16); cityBatch.add(MAT.white, gBox(1.6,12,1.6), cx,6.5,cz-16);
  const ark = makeShip('mule'); ark.g.scale.setScalar(1.3); ark.g.position.set(cx,14.5,cz-16); ark.g.rotation.set(-.5,.6,0,'YXZ');
  ark.flames.forEach(f=>f.visible=false); ark.light.intensity=0; S.group.add(ark.g); S.circles.push({x:cx,z:cz-16,r:3});
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4,1), B(0xffffff,{map:citySign('ÊXODO · 214','#ffd27a')})); plaque.position.set(cx,2,cz-13.4); S.group.add(plaque);
}
function buildHomeTower(ix0,ix1,iz0,iz1){
  const MAT=city.mat, w=36, d=36, z0=iz0+1, cz=z0+d/2, h=150;
  cityBatch.add(city.facade[3], facadeUV(gBox(w,h,d),w,h,d), 0,h/2,cz);
  cityBatch.add(city.facade[1], facadeUV(gBox(w-8,60,d-8),w-8,60,d-8), 0,h+30,cz);
  cityBatch.add(MAT.metal, gCyl(.5,.8,40,6), 0,h+80,cz); cityBatch.add(MAT.redLight, gBox(1.2,1.2,1.2), 0,h+100,cz);
  S.boxes.push({x0:-w/2,x1:w/2,z0:z0,z1:z0+d,h:h+60});
  cityBatch.add(MAT.white, gBox(12,.4,4), 0,4.4,z0-1.8); cityBatch.add(MAT.lamp, gBox(11,.08,3.6), 0,4.18,z0-1.8);
  cityBatch.add(MAT.shopGlass[1], new THREE.PlaneGeometry(6,3.8), 0,1.9,z0-.04, Math.PI);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10,1.6), B(0xffffff,{map:citySign('TORRE KESSLER 07','#5ef2ff',384,64)}));
  sign.position.set(0,5.6,z0-.1); sign.rotation.y=Math.PI; S.group.add(sign);
  const pl = new THREE.PointLight(0xffd8a0,1.2,16); pl.position.set(0,3.6,z0-3); S.group.add(pl);
  [['RAMEN','#ffb347',-16],['ESPETINHOS','#ff7a3a',-10],['CAFÉ K7','#5ef2ff',10],['DOCES','#ff9ad8',16]].forEach(([n,c,x])=>addStall(n,c,x,z0-.9,Math.PI));
}
function buildExchange(cx,cz){
  const w=40, h=110;
  cityBatch.add(city.facade[1], facadeUV(gBox(w,h,w),w,h,w), cx,h/2,cz);
  cityBatch.add(city.facade[3], facadeUV(gCyl(12,16,30,16),0,30,0,Math.PI*32), cx,h+15,cz);
  S.boxes.push({x0:cx-w/2,x1:cx+w/2,z0:cz-w/2,z1:cz+w/2,h:h+30});
  city.tickerTex = canvasTex(1024,64,()=>{}); city.tickerTex.wrapS=THREE.RepeatWrapping;
  for(const [nx,nz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w-.2,3.2), B(0xffffff,{map:city.tickerTex}));
    m.position.set(cx+nx*(w/2+.06),14,cz+nz*(w/2+.06)); m.rotation.y=Math.atan2(nx,nz); S.group.add(m);
  }
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(16,2.2),B(0xffffff,{map:citySign('KESSLER EXCHANGE','#ffd040',384,64)}));
  sign.position.set(cx+w/2+.1,6,cz); sign.rotation.y=Math.PI/2; S.group.add(sign);
  S.shops.push({ x:cx+w/2+1.8, z:cz, name:'KESSLER EXCHANGE', color:'#ffd040', msg:'Bolsa de Valores de Nova Kessler — o pregão abre em breve.', done:true });
}
function drawTicker(t){
  if(!city.tickerTex) return;
  const {g}=city.tickerTex.userData, items=['VXR 1.204 ▲2,1%','OSK 884 ▼0,7%','AUR 3.310 ▲0,4%','KSL 512 ▲5,2%','SUCATA ₢12 ●','AURORITA ₢65 ▲3,0%','ÊXO 1.000 ▲0,1%'];
  g.fillStyle='#050302'; g.fillRect(0,0,1024,64); g.font='bold 34px "Courier New",monospace'; g.textBaseline='middle';
  let x = -((t*80)%1200);
  for(let rep=0;rep<3;rep++) for(const it of items){ g.fillStyle = it.includes('▼')?'#ff4a4a':it.includes('▲')?'#7dff9a':'#ffd040'; g.fillText(it,x,34); x+=g.measureText(it).width+40; }
  city.tickerTex.needsUpdate=true;
}
function addPad(x,z,size,label,name){
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(size,size), M(0xffffff,{map:padTex(label),flatShading:false})); pad.rotation.x=-Math.PI/2; pad.position.set(x,.32,z); S.group.add(pad);
  S.pads.push({ x, z, name });
}
function buildHangar(ix0,ix1,iz0,iz1){
  const MAT=city.mat, H=22, xb=ix1-1, zs=(iz1-iz0)/2;
  cityBatch.add(MAT.concrete, gBox(ix1-ix0,.3,iz1-iz0), (ix0+ix1)/2,.15,0);
  addPad(HANGAR_PAD.x, 0, 34, '07', 'Hangar 07');
  cityBatch.add(MAT.hangar, gBox(1.5,H,iz1-iz0), xb,H/2,0); S.boxes.push({x0:xb-.75,x1:xb+.75,z0:iz0,z1:iz1,h:H});
  for(const s of [-1,1]){ const z=s*(zs-.75); cityBatch.add(MAT.hangar, gBox(ix1-ix0,H,1.5), (ix0+ix1)/2,H/2,z); S.boxes.push({x0:ix0,x1:ix1,z0:z-.75,z1:z+.75,h:H});
    for(let k=0;k<5;k++) cityBatch.add(MAT.yellow, gBox(3,.5,.1), ix0+6+k*8, 2, z-s*.8); }
  cityBatch.add(MAT.hangar, gBox(1.5,4,iz1-iz0), ix0+.75,H-2,0);
  cityBatch.add(MAT.lamp, gBox(.2,.3,iz1-iz0-4), xb-.8,H-3,0);
  for(const s of [-1,1]) cityBatch.add(MAT.yellow, gBox(1.2,26,1.2), HANGAR_PAD.x+8, 13, s*(zs-3));
  cityBatch.add(MAT.yellow, gBox(1.6,1.6,iz1-iz0-4), HANGAR_PAD.x+8, 26, 0);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(20,2.6),B(0xffffff,{map:citySign('HANGAR 07 · DOCAS ORBITAIS','#ff7a3a',512,64)}));
  sign.position.set(ix0-.05,H-2,0); sign.rotation.y=-Math.PI/2; S.group.add(sign);
  const pl=new THREE.PointLight(0xfff0d0,1.4,60); pl.position.set(HANGAR_PAD.x,18,0); S.group.add(pl);
}
function buildPortBlock(cx,cz,tower){
  const MAT=city.mat;
  if(tower){
    cityBatch.add(MAT.white, gCyl(3.5,4.5,40,10), cx-10,20,cz); cityBatch.add(city.facade[1], facadeUV(gCyl(7,5,6,12),0,6,0,44), cx-10,43,cz);
    cityBatch.add(MAT.white, gCyl(7.5,7.5,1,12), cx-10,46.5,cz);
    const dish=new THREE.Group(); dish.position.set(cx-10,49,cz); const d=cyl(3,.4,1.2,10,MAT.white); d.rotation.x=Math.PI/2.5; dish.add(d); S.group.add(dish);
    S.anim.push((t,dt)=>{ dish.rotation.y+=dt*.8; }); S.circles.push({x:cx-10,z:cz,r:4.6});
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(9,1.4),B(0xffffff,{map:citySign('CONTROLE ORBITAL','#5ef2ff')})); sign.position.set(cx-10,36,cz+4.7); S.group.add(sign);
  }
  for(let k=0;k<3;k++){ const x=cx+(tower?6:-12), z=cz-12+k*12; cityBatch.add(MAT.tank, gCyl(5,5,14,14), x,7,z); cityBatch.add(MAT.yellow, gCyl(5.05,5.05,1,14), x,9,z); S.circles.push({x,z,r:5.2}); }
}
function buildMarket(cx,cz,size){
  const MAT=city.mat;
  cityBatch.add(MAT.concrete, gBox(size,.24,size), cx,.12,cz);
  const stalls=[['RAMEN','#ffd040'],['ESPETINHOS','#ff7a3a'],['SUSHI','#ff7a3a'],['BAR','#ff4ab0'],['NOODLES 麺','#ffb347'],['MERCADO 24H','#5ef2ff'],['FARMÁCIA','#7dff9a'],['CAFÉ','#ffb347']];
  stalls.forEach(([n,c],i)=>{ const a=i/stalls.length*Math.PI*2, r=13; addStall(n,c, cx+Math.sin(a)*r, cz+Math.cos(a)*r, a+Math.PI); });
  cityBatch.add(MAT.rust, gCyl(1.2,1.6,18,8), cx,9,cz); S.circles.push({x:cx,z:cz,r:1.8});
  const sign = new THREE.Mesh(new THREE.BoxGeometry(6,2.4,6), [0,1,2,3,4,5].map(i=>B(0xffffff,{map:citySign('PORTO 07','#ffb347',256,96)})));
  sign.position.set(cx,19,cz); S.group.add(sign); S.anim.push((t,dt)=>{ sign.rotation.y+=dt*.3; });
  for(let k=0;k<8;k++){ const a=k/8*Math.PI*2; const l=new THREE.PointLight(pick([0xff7a3a,0xff4ab0,0x5ef2ff]),.9,14); l.position.set(cx+Math.sin(a)*13,4,cz+Math.cos(a)*13); if(k%2===0) S.group.add(l); }
}
function buildDock(ix0,ix1,iz0,iz1){
  const MAT=city.mat, cx=(ix0+ix1)/2;
  cityBatch.add(MAT.concrete, gBox(ix1-ix0,.3,iz1-iz0), cx,.15,0);
  addPad(cx, 0, 34, '07', 'Doca 07 · Porto Ferrugem');
  for(const s of [-1,1]) cityBatch.add(MAT.yellow, gBox(1.2,20,1.2), cx+s*18, 10, 18);
  cityBatch.add(MAT.yellow, gBox(38,1.4,1.4), cx, 20, 18);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(18,2.4),B(0xffffff,{map:citySign('DOCA 07 · POUSO','#ff7a3a',512,64)})); sign.position.set(cx,17,18.8); S.group.add(sign);
  const pl=new THREE.PointLight(0xffd0a0,1.2,50); pl.position.set(cx,14,0); S.group.add(pl);
}

// ---- além do centro
function buildOuterDistricts(){
  const tex = canvasTex(64,64,(g)=>{ g.fillStyle=S.id==='porto'?'#7a5a44':'#6a6a70'; g.fillRect(0,0,64,64); g.fillStyle='#2a3038'; for(let x=0;x<4;x++)for(let y=0;y<8;y++) g.fillRect(x*16+4,y*8+2,9,4); });
  const emi = canvasTex(64,64,(g)=>{ g.fillStyle='#000'; g.fillRect(0,0,64,64); for(let x=0;x<4;x++)for(let y=0;y<8;y++) if(Math.random()<.45){ g.fillStyle=pick(['#ffd9a0','#a0e8ff','#ffb070']); g.fillRect(x*16+4,y*8+2,9,4); } });
  const geom = gBox(1,1,1); geom.translate(0,.5,0);
  const list=[], lim=S.outer;
  for(let x=-lim;x<=lim;x+=46) for(let z=-lim;z<=lim;z+=46){
    const r=Math.hypot(x,z); if(r<S.ext+60 || r>lim) continue;
    if(S.id==='kessler' && x>S.ext && Math.abs(z)<380) continue;
    if(crng()<.3) continue;
    const near=Math.exp(-(r-260)/700)*S.tall;
    const w=cr(18,34), d=cr(18,34), h=15+crng()*crng()*170*near + (crng()<.04*S.tall?cr(100,220):0);
    const px=x+cr(-6,6), pz=z+cr(-6,6);
    list.push([px,pz,w,h,d]); S.boxes.push({x0:px-w/2,x1:px+w/2,z0:pz-d/2,z1:pz+d/2,h});
  }
  const mesh = new THREE.InstancedMesh(geom, new THREE.MeshStandardMaterial({map:tex, emissiveMap:emi, emissive:0xffffff, emissiveIntensity:.8, roughness:.8}), list.length);
  const m=new THREE.Matrix4(), q=new THREE.Quaternion(), c=new THREE.Color();
  list.forEach(([x,z,w,h,d],i)=>{ m.compose(new V3(x,0,z), q, new V3(w,h,d)); mesh.setMatrixAt(i,m); c.setHSL(cr(.05,.62),cr(.05,.2),cr(.55,.9)); mesh.setColorAt(i,c); });
  S.group.add(mesh);
}
function buildSpaceport(){
  const MAT=city.mat, pm = M(0xffffff,{map:canvasTex(128,128,(g)=>{ g.fillStyle='#3e3e42'; g.fillRect(0,0,128,128); g.strokeStyle='#e8c040'; g.lineWidth=5; g.beginPath(); g.arc(64,64,54,0,Math.PI*2); g.stroke(); g.strokeStyle='#d8d8d0'; g.lineWidth=2; g.strokeRect(6,6,116,116); }), flatShading:false});
  for(let k=0;k<6;k++){
    const x=400+(k%3)*160, z=(k<3?-1:1)*150;
    const p=new THREE.Mesh(new THREE.PlaneGeometry(110,110),pm); p.rotation.x=-Math.PI/2; p.position.set(x,.05,z); S.group.add(p);
    if(k%2===0){ const sh=makeShip(k%4===0?'mule':'kestrel'); sh.g.scale.setScalar(k%4===0?9:6); sh.g.position.set(x,k%4===0?7:3,z); sh.g.rotation.y=crng()*6; sh.flames.forEach(f=>f.visible=false); sh.light.intensity=0; S.group.add(sh.g); S.circles.push({x,z,r:k%4===0?22:16}); }
    else S.pads.push({ x, z, name:'Espaçoporto Kessler' });
  }
  for(let k=0;k<8;k++){ cityBatch.add(MAT.lamp, gBox(1.2,1.2,1.2), 300+k*60, 1, -260); cityBatch.add(MAT.lamp, gBox(1.2,1.2,1.2), 300+k*60, 1, 260); }
}
function buildHorizon(){
  // arcologias gigantes apoiadas no relevo do planeta
  const arcTex = canvasTex(64,64,(g)=>{ g.fillStyle='#4a4e58'; g.fillRect(0,0,64,64); g.fillStyle='#22262e'; for(let y=0;y<16;y++) g.fillRect(0,y*4+1,64,2); });
  const arcEmi = canvasTex(64,64,(g)=>{ g.fillStyle='#000'; g.fillRect(0,0,64,64); for(let y=0;y<16;y++) for(let x=0;x<16;x++) if(Math.random()<.3){ g.fillStyle=pick(['#ffcf90','#90e0ff']); g.fillRect(x*4,y*4+1,3,2); } });
  [arcTex,arcEmi].forEach(t=>{ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(10,40); });
  const arcMat = new THREE.MeshStandardMaterial({map:arcTex, emissiveMap:arcEmi, emissive:0xffffff, emissiveIntensity:.9, roughness:.7});
  for(let k=0;k<12;k++){
    const a=crng()*Math.PI*2; if(Math.cos(a)>.85) continue;
    const r=cr(3600,8000), h=cr(700,2400), w=cr(140,380), g=new THREE.Group();
    const t1=new THREE.Mesh(gCyl(w*.45,w,h,8).translate(0,h/2,0), arcMat); g.add(t1);
    const t2=new THREE.Mesh(gCyl(w*.15,w*.4,h*.35,8).translate(0,h*1.175,0), arcMat); g.add(t2);
    const lt=new THREE.Mesh(gBox(20,20,20), city.mat.redLight); lt.position.y=h*1.35+10; g.add(lt);
    placeOnPlanet(g, new V3(Math.cos(a)*r,0,Math.sin(a)*r), 60); city.scene.add(g);
  }
  // elevador espacial: um cabo até a órbita
  const el = new THREE.Group();
  el.add(new THREE.Mesh(gCyl(14,14,30000,8).translate(0,15000,0), M(0x8a8e98,{emissive:0x10203a, flatShading:false})));
  el.add(new THREE.Mesh(gCyl(90,400,700,12).translate(0,350,0), M(0x6a6e78)));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(260,30,8,32), M(0x9a9ea8,{emissive:0x202838})); ring.position.y=9000; ring.rotation.x=Math.PI/2; el.add(ring);
  for(let k=1;k<12;k++){ const b=new THREE.Mesh(gBox(40,40,40), B(0x7ff6ff)); b.position.y=k*2400; el.add(b); }
  placeOnPlanet(el, new V3(-5200,0,-7400), 20); city.scene.add(el);
}
function buildAirTraffic(){
  for(let k=0;k<S.airN;k++){
    const g=makeHover(pick([0xb04a2a,0x2a6a8a,0xd8d8d0,0x3a3a44,0xc8a040,0x6a2a6a]));
    const axis=crng()<.5?'x':'z', dir=crng()<.5?1:-1, alt=pick([55,95,140])+cr(-4,4), off=cr(-S.ext*2,S.ext*2), span=S.outer*.9;
    g.rotation.y = axis==='x' ? (dir>0?-Math.PI/2:Math.PI/2) : (dir>0?Math.PI:0);
    S.group.add(g); S.air.push({g,axis,dir,alt,off,s:cr(-span,span),v:cr(35,70),span});
  }
  if(S.id!=='kessler') return;
  for(let k=0;k<3;k++){
    const sh=makeShip('mule'); sh.g.scale.setScalar(26); S.group.add(sh.g);
    const axis=k%2?'x':'z', dir=k===1?-1:1;
    sh.g.rotation.y = axis==='x' ? (dir>0?-Math.PI/2:Math.PI/2) : (dir>0?Math.PI:0);
    S.air.push({g:sh.g,axis,dir,alt:cr(600,950),off:cr(-1200,1200),s:cr(-1500,1500),v:cr(22,32),span:1700});
  }
}

// ---------------------------------------------------------------- trânsito e pedestres (coordenadas locais do sítio)
function laneOf(t){ return t.axis==='x' ? { x:t.s, z:t.line + t.dir*3.2 } : { x:t.line - t.dir*3.2, z:t.s }; }
function buildTraffic(){
  const kinds=['coupe','coupe','coupe','van','van','truck','bike'];
  for(let k=0;k<S.trafficN;k++){
    const kind=pick(kinds), c=makeCar(kind, pick([0xb04a2a,0x2a6a8a,0xd8d8d0,0x1a1a1e,0xc8a040,0x6a2a6a,0x3a6a3a,0xe0e0e8]), crng()<.4?pick([0x5ef2ff,0xff4ab0,0xffb347]):null);
    const t = { ...c, axis:crng()<.5?'x':'z', dir:crng()<.5?1:-1, line:lineOf((crng()*(S.N+1))|0), s:cr(-S.ext,S.ext), v:0, vmax:cr(9,15) };
    t.g.rotation.y = t.axis==='x' ? (t.dir>0?-Math.PI/2:Math.PI/2) : (t.dir>0?Math.PI:0);
    S.group.add(t.g); S.traffic.push(t);
  }
}
function buildNPCs(){
  for(let k=0;k<S.npcN;k++){
    let i,j; do{ i=(crng()*S.N)|0; j=(crng()*S.N)|0; }while(S.special[`${i},${j}`]==='hangar');
    const r=crng(), sp = r<.6?'human':r<.82?'vexari':'oskari', g=makeNPC(sp); S.group.add(g);
    const x0=lineOf(i)+CITY.ROAD/2+2.6, x1=lineOf(i+1)-CITY.ROAD/2-2.6, z0=lineOf(j)+CITY.ROAD/2+2.6, z1=lineOf(j+1)-CITY.ROAD/2-2.6;
    S.npcs.push({ g, x0,x1,z0,z1, len:(x1-x0)*4, p:cr(0,(x1-x0)*4), dir:crng()<.5?1:-1, v:sp==='oskari'?cr(.9,1.2):cr(1.1,1.7), wait:0, ph:crng()*6, sp, down:0, dead:false });
  }
}
function npcPos(n,p=n.p){ const L=n.x1-n.x0, q=((p%n.len)+n.len)%n.len;
  if(q<L) return [n.x0+q, n.z0]; if(q<2*L) return [n.x1, n.z0+q-L]; if(q<3*L) return [n.x1-(q-2*L), n.z1]; return [n.x0, n.z1-(q-3*L)]; }
function knockNPC(n, power){
  if(n.down>0) return false;
  n.dead = power>14; n.down = n.dead ? 18 : 5; n.wait=0; sfx.hit(); noise({dur:.2,vol:.25,freq:500});
  return true;
}
function updateTraffic(site, dt, PL, onFoot){
  const lim=site.ext+40;
  for(const t of site.traffic){
    let want = t.vmax; const pos = laneOf(t);
    for(const o of site.traffic){ if(o===t || o.axis!==t.axis || o.line!==t.line || o.dir!==t.dir) continue; const ahead=(o.s-t.s)*t.dir; if(ahead>0 && ahead<11) want=Math.min(want,(ahead-6)*1.5); }
    if(PL){ const lat = t.axis==='x' ? Math.abs(PL.z-pos.z) : Math.abs(PL.x-pos.x), ahead = (t.axis==='x' ? PL.x-pos.x : PL.z-pos.z)*t.dir;
      if(lat<2.6 && ahead>0 && ahead<13) want=0;
      if(onFoot && t.v>3 && Math.hypot(PL.x-pos.x, PL.z-pos.z)<1.9){ playerDamage(12,'Atropelado por um carro'); city.vy=4.5; t.v=0; } }
    want=Math.max(0,want); t.v += clamp(want-t.v, -14*dt, 5*dt); t.s += t.v*t.dir*dt;
    if(t.s>lim) t.s=-lim; if(t.s<-lim) t.s=lim;
    const p=laneOf(t); t.g.position.set(p.x,0,p.z);
    t.g.visible = !PL || (Math.abs(p.x-PL.x)<260 && Math.abs(p.z-PL.z)<260);
    if(t.g.visible) for(const w of t.wheels) w.rotation.x -= t.v*dt/w.userData.r;
  }
}
function updateNPCs(site, dt, t, PL){
  for(const n of site.npcs){
    const [px,pz] = npcPos(n);
    const near = !!PL && Math.hypot(px-PL.x, pz-PL.z) < 170;
    n.g.visible = near;
    if(n.down>0){ n.down-=dt; if(n.down<=0){ if(n.dead){ n.p=rand(0,n.len); n.dead=false; } n.g.rotation.x=0; } }
    const dP = PL ? Math.hypot(px-PL.x, pz-PL.z) : 99;
    if(n.down<=0){ if(n.wait>0) n.wait-=dt; else if(dP > 1.1){ n.p += n.v*n.dir*dt; if(Math.random()<.0015) n.wait=rand(1,4); if(Math.random()<.0004) n.dir*=-1; } }
    if(!near) continue;
    const [nx,nz] = npcPos(n), [ax,az] = npcPos(n, n.p+n.dir*.5);
    if(n.down>0){ n.g.position.set(nx,.35,nz); n.g.rotation.x=-Math.PI/2; continue; }
    n.g.position.set(nx,.2,nz); n.g.rotation.y = Math.atan2(ax-nx, az-nz);
    const sw = n.wait>0||dP<1.2 ? 0 : Math.sin(t*n.v*5+n.ph)*.5;
    n.g.userData.legL.rotation.x=sw; n.g.userData.legR.rotation.x=-sw;
  }
}
function updateAir(site, dt){
  for(const a of site.air){ a.s += a.v*a.dir*dt; if(a.s>a.span) a.s=-a.span; if(a.s<-a.span) a.s=a.span;
    if(a.axis==='x') a.g.position.set(a.s,a.alt,a.off); else a.g.position.set(a.off,a.alt,a.s); }
}

// ---------------------------------------------------------------- espaço: local <-> mundo, colisão
const CELL=40, NONE=[];
const _sl=new V3(), _sw=new V3(), _gl=new V3(), _gd=new V3();
const toLocal = (s,p,out=_sl)=>out.copy(p).applyMatrix4(s.inv);
const toWorld = (s,l,out=_sw)=>out.copy(l).applyMatrix4(s.mat);
function siteAt(p, extra=0){
  for(const s of SITES){ if(!s.inv) continue; const l=toLocal(s,p,_gl); if(l.y>-800 && Math.abs(l.x)<s.paved+extra && Math.abs(l.z)<s.paved+extra) return s; }
  return null;
}
function indexBoxes(s){
  for(const b of s.boxes) for(let x=Math.floor(b.x0/CELL); x<=Math.floor(b.x1/CELL); x++) for(let z=Math.floor(b.z0/CELL); z<=Math.floor(b.z1/CELL); z++){
    const k=x+','+z; if(!s.grid.has(k)) s.grid.set(k,[]); s.grid.get(k).push(b); }
}
const cellBoxes = (s,x,z)=> s.grid.get(Math.floor(x/CELL)+','+Math.floor(z/CELL)) || NONE;
function collideLocal(s, l, r){
  let hit=false;
  for(const ox of [-r,r]) for(const oz of [-r,r]) for(const b of cellBoxes(s,l.x+ox,l.z+oz)){
    if(l.y > b.h) continue;
    if(l.x>b.x0-r && l.x<b.x1+r && l.z>b.z0-r && l.z<b.z1+r){
      const a=l.x-(b.x0-r), c=(b.x1+r)-l.x, d=l.z-(b.z0-r), e=(b.z1+r)-l.z, m=Math.min(a,c,d,e);
      if(m===a) l.x=b.x0-r; else if(m===c) l.x=b.x1+r; else if(m===d) l.z=b.z0-r; else l.z=b.z1+r; hit=true;
    }
  }
  for(const c of s.circles){ const dx=l.x-c.x, dz=l.z-c.z; if(Math.abs(dx)>c.r+r || Math.abs(dz)>c.r+r) continue; const d=Math.hypot(dx,dz), m=c.r+r; if(d<m && d>1e-4){ l.x=c.x+dx/d*m; l.z=c.z+dz/d*m; hit=true; } }
  return hit;
}
function insideBoxLocal(s,x,y,z,m){ for(const b of cellBoxes(s,x,z)) if(x>b.x0-m && x<b.x1+m && z>b.z0-m && z<b.z1+m && y<b.h+m) return true; return false; }
function pushCircle(l, cx, cz, r){ const dx=l.x-cx, dz=l.z-cz, d=Math.hypot(dx,dz); if(d<r && d>1e-4){ l.x=cx+dx/d*r; l.z=cz+dz/d*r; return true; } return false; }
const _cwl=new V3();
function collideWorld(P, r, walker){
  const s = siteAt(P, 200); let hit=false;
  if(s){
    const l=toLocal(s,P,_cwl);
    hit = collideLocal(s,l,r);
    if(walker){
      for(const n of s.npcs) if(n.g.visible && n.down<=0) pushCircle(l, n.g.position.x, n.g.position.z, r+.35);
      for(const t of s.traffic) if(t.g.visible && pushCircle(l, t.g.position.x, t.g.position.z, r+1.3)) hit=true;
      policeBlock(s,l,r);
    }
    toWorld(s,l,P);
  }
  if(walker){ for(const id in city.vehicles){ const v=city.vehicles[id]; if(v===city.drive) continue; const dx=P.distanceTo(v.g.position); if(dx<r+1.4) P.sub(v.g.position).setLength(r+1.4).add(v.g.position); }
    if(city.ship && !city.fly){ const sh=city.ship.g.position; if(P.distanceTo(sh)<r+5) P.sub(sh).setLength(r+5).add(sh); } }
  return hit;
}
let groundWater=false;
function groundAt(p, outP, outUp){
  const s=siteAt(p);
  if(s){ const l=toLocal(s,p,_gl); l.y = isOnSidewalk(s,l.x,l.z)?.2:0; toWorld(s,l,outP); outUp.copy(s.up); GN.copy(s.up); groundWater=false; return s; }
  const d=_gd.subVectors(p,PC).normalize(), r=groundR(d); outP.copy(PC).addScaledVector(d,r); surfaceUp(d,outUp);
  groundWater = r < PLANET.R+PLANET.SEA-1.2; return null;
}
function isOnSidewalk(s,x,z){
  if(Math.abs(x)>=s.ext || Math.abs(z)>=s.ext) return false;
  const ax=((x+s.ext)%CITY.P+CITY.P)%CITY.P, az=((z+s.ext)%CITY.P+CITY.P)%CITY.P;
  return ax>CITY.ROAD/2 && ax<CITY.P-CITY.ROAD/2 && az>CITY.ROAD/2 && az<CITY.P-CITY.ROAD/2;
}
function altitudeOf(P){
  const s=siteAt(P); if(s) return toLocal(s,P,_gl).y;
  const d=_gd.subVectors(P,PC).normalize(); return P.distanceTo(PC) - Math.max(groundR(d), PLANET.R+PLANET.SEA);
}

// ---------------------------------------------------------------- câmera
const _co=new V3(), _cpt=new V3();
function camBlocked(pt){
  const s=siteAt(pt,60); if(s){ const l=toLocal(s,pt,_gl); return l.y<.3 || insideBoxLocal(s,l.x,l.y,l.z,.25); }
  const d=_gd.subVectors(pt,PC).normalize(); return pt.distanceTo(PC) < groundR(d)+.3;
}
function camThird(target, F, yaw, pitch, dist){
  _co.set(Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), Math.cos(yaw)*Math.cos(pitch)).applyQuaternion(F.q);
  let d=.5; while(d<dist){ const n=d+.3; if(camBlocked(_cpt.copy(target).addScaledVector(_co,n))) break; d=n; }
  city.cam.position.copy(target).addScaledVector(_co,d); city.cam.up.copy(F.up); city.cam.lookAt(target);
}
function camFirst(eye, F, yaw, pitch){
  _co.set(Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), Math.cos(yaw)*Math.cos(pitch)).applyQuaternion(F.q);
  city.cam.position.copy(eye); city.cam.up.copy(F.up); city.cam.lookAt(_cpt.copy(eye).sub(_co));
}

// ---------------------------------------------------------------- jogador a pé (com pulo)
const _qy=new THREE.Quaternion(), _qa=new THREE.Quaternion(), _mv=new V3(), _prev=new V3(), _gp=new V3(), _gu=new V3(), _tgt=new V3();
const qYaw = (y, out=_qy)=>out.setFromAxisAngle(Y_AXIS, y);
let waterT=0;
function updateWalk(dt,t){
  const p=city.player, F=city.frame, P=p.position, inp=!ui.panel;
  let mx=0, mz=0;
  if(inp){ if(keys.KeyW||keys.ArrowUp) mz+=1; if(keys.KeyS||keys.ArrowDown) mz-=1; if(keys.KeyA||keys.ArrowLeft) mx-=1; if(keys.KeyD||keys.ArrowRight) mx+=1; }
  const fx=-Math.sin(city.yaw), fz=-Math.cos(city.yaw), rx=Math.cos(city.yaw), rz=-Math.sin(city.yaw);
  let vx=fx*mz+rx*mx, vz=fz*mz+rz*mx; const len=Math.hypot(vx,vz);
  const sp = survSpeed(len>0 && inp && keys.ShiftLeft, dt);
  _prev.copy(P);
  if(len>0){ vx/=len; vz/=len; P.add(_mv.set(vx,0,vz).applyQuaternion(F.q).multiplyScalar(sp*dt));
    if(!settings.fp) city.heading = lerpAngle(city.heading, Math.atan2(vx,vz), Math.min(1,12*dt)); city.walk += dt*sp*2.5; }
  else city.walk*=.85;
  if(settings.fp) city.heading = city.yaw+Math.PI;
  // pulo e gravidade
  if(inp && keys.Space && city.air<=.01 && survJump()){ city.vy=5.4; }
  city.vy -= 15*dt; city.air = Math.max(0, city.air+city.vy*dt); if(city.air===0 && city.vy<0) city.vy=0;
  collideWorld(P,.4,true);
  const s = groundAt(P,_gp,_gu);
  if(!s && groundWater){ P.copy(_prev); groundAt(P,_gp,_gu); if(t-waterT>3){ waterT=t; toast('Água profunda — não dá para atravessar a nado', '#5ef2ff'); } }
  P.copy(_gp).addScaledVector(_gu, city.air);
  transport(F,_gu); city.here = s;
  p.quaternion.copy(F.q).multiply(qYaw(city.heading));
  const sw=Math.sin(city.walk)*.6*(len>0&&city.air<.05?1:0); p.userData.legL.rotation.x=sw; p.userData.legR.rotation.x=-sw;
  p.visible=!settings.fp;
  if(settings.fp) camFirst(_tgt.copy(P).addScaledVector(F.up,1.72), F, city.yaw, city.pitch);
  else camThird(_tgt.copy(P).addScaledVector(F.up,1.6), F, city.yaw, city.pitch, 4.6);
  // interação
  let best=null, bd=99;
  for(const it of cityInteractables()){ const d=it.d; if(d<it.r && d<bd){ bd=d; best=it; } }
  city.near=best;
  if(city.mining) updateMining(dt);
  else setPrompt(ui.panel?'':(best?best.label:''));
}
function cityInteractables(){
  const L=[], P=city.player.position, s=siteAt(P,50);
  if(s){
    const l=toLocal(s,P,new V3());
    if(s.id==='kessler') L.push({ d:Math.hypot(l.x-HOME_DOOR.x,l.z-HOME_DOOR.z), r:3.2, label:'[E] Entrar — Torre Kessler 07 (apartamento)', fn:()=>goHub() });
    for(const sh of s.shops){ const d=Math.hypot(l.x-sh.x,l.z-sh.z); if(d>3) continue;
      const food=MENUS[sh.name]; L.push({ d, r:2.6, label: sh.act?`[E] ${sh.name} — ${sh.actLabel}` : food?`[E] ${sh.name} — comer` : `[E] ${sh.name}`, fn:()=>shopAct(sh) }); }
  }
  for(const id in city.vehicles){ const v=city.vehicles[id]; L.push({ d:P.distanceTo(v.g.position), r:v.def.kind==='truck'?3.8:3.1, label:`[E] Dirigir — ${v.def.name}`, fn:()=>enterVehicle(id) }); }
  if(city.ship) L.push({ d:P.distanceTo(city.ship.g.position), r:15, label:`[E] Embarcar — ${SHIPS[activeShip().model].name} · voar`, fn:boardShip });
  for(const dep of nearbyDeposits()){ const d=P.distanceTo(dep.pos); if(d<3) L.push({ d, r:3, label:`[E] Coletar — ${DEPOSITS[dep.type].name}`, fn:()=>startMining(dep) }); }
  return L;
}
function shopAct(s){
  if(s.act) return openPanel(s.act[0], s.act[1]);
  if(MENUS[s.name]) return openFood(s.name);
  if(s.msg) return toast(s.msg, s.color);
  toast(`${s.name} — fechado por enquanto`, s.color);
}
function cityInteract(){
  if(city.launch) return;
  if(city.fly) return flyInteract();
  if(city.drive) return exitVehicle();
  if(city.near) city.near.fn();
}
// coleta de recursos
function startMining(dep){ city.mining={ dep, t:0 }; tone({type:'square',f0:300,f1:500,dur:.1,vol:.05}); }
function updateMining(dt){
  const m=city.mining, P=city.player.position;
  if(P.distanceTo(m.dep.pos)>3.6 || m.dep.gone){ city.mining=null; setPrompt(''); return; }
  m.t+=dt; const need=m.dep.type==='herbs'?1:1.8;
  if(Math.floor(m.t*6)!==Math.floor((m.t-dt)*6)) noise({dur:.05,vol:.08,filter:'bandpass',freq:m.dep.type==='herbs'?1200:2600});
  setPrompt(`Coletando ${DEPOSITS[m.dep.type].name}... ${Math.min(100,Math.round(m.t/need*100))}%`);
  if(m.t>=need){
    const D=DEPOSITS[m.dep.type], n=D.qty[0]+((Math.random()*(D.qty[1]-D.qty[0]+1))|0);
    addItem(D.item,n); m.dep.gone=true; m.dep.g.visible=false; state.mined[m.dep.key]=Date.now(); save(); updateHUD();
    sfx.pickup(); toast(`+${n} ${D.name} → inventário [I]`, '#5affc8'); city.mining=null;
  }
}

// ---------------------------------------------------------------- veículos do jogador
function syncCityVehicles(){
  for(const id of state.vehicles){
    if(city.vehicles[id]) continue;
    const def=VEHICLES[id], c=makeCar(def.kind, def.color, def.glow), k=state.vehicles.indexOf(id), sv=state.vpos[id];
    const v = Object.assign(c, { id, def, speed:0, steer:0, F:makeFrame(), yaw:-Math.PI/2 });
    if(sv && sv.p){ c.g.position.fromArray(sv.p); v.F.q.fromArray(sv.q); v.F.up.fromArray(sv.up); v.yaw=sv.yaw; }
    else { const sp=PARK_SPOTS[k%PARK_SPOTS.length]; c.g.position.set(sp[0],0,sp[1]); }
    c.g.quaternion.copy(v.F.q).multiply(qYaw(v.yaw));
    city.scene.add(c.g); city.vehicles[id]=v;
  }
}
let eng=null;
function engineStart(kind){
  if(!actx || eng) return;
  const o=actx.createOscillator(), o2=actx.createOscillator(), f=actx.createBiquadFilter(), g=actx.createGain();
  o.type = kind==='bike'?'triangle':'sawtooth'; o2.type='square'; f.type='lowpass'; f.frequency.value=400; g.gain.value=0;
  o.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus); o.start(); o2.start();
  g.gain.setTargetAtTime(.045, actx.currentTime, .2); eng={o,o2,g,f,base:kind==='bike'?90:kind==='ship'?55:42, span:kind==='bike'?260:kind==='ship'?200:120};
}
function engineUpdate(r){ if(!eng) return; const fr=eng.base+r*eng.span, t=actx.currentTime;
  eng.o.frequency.setTargetAtTime(fr,t,.05); eng.o2.frequency.setTargetAtTime(fr*.5,t,.05); eng.f.frequency.setTargetAtTime(300+r*1100,t,.05); }
function engineStop(){ if(!eng) return; const e=eng; eng=null; e.g.gain.setTargetAtTime(0, actx.currentTime, .12); setTimeout(()=>{ try{ e.o.stop(); e.o2.stop(); }catch(_){} }, 700); }
function enterVehicle(id){
  const v=city.vehicles[id]; city.drive=v; city.player.visible=false; city.camOff=0; city.pitch=settings.fp?0:.16;
  engineStart(v.def.kind); sfx.door(); toast(`${v.def.name} · W/S acelerar e frear · A/D virar · E sair`, '#5ef2ff');
}
function exitVehicle(){
  const v=city.drive; if(Math.abs(v.speed)>3){ toast('Pare o veículo para sair', '#ff4a4a'); sfx.error(); return; }
  const right=_mv.set(Math.cos(v.yaw),0,-Math.sin(v.yaw)).applyQuaternion(v.F.q), P=city.player.position;
  P.copy(v.g.position).addScaledVector(right,-2.4);
  city.frame.q.copy(v.F.q); city.frame.up.copy(v.F.up); city.heading=v.yaw+Math.PI; city.yaw=v.yaw+city.camOff; city.air=0; city.vy=0;
  v.speed=0; state.vpos[v.id]={ p:v.g.position.toArray(), q:v.F.q.toArray(), up:v.F.up.toArray(), yaw:v.yaw }; save();
  city.drive=null; engineStop(); sfx.door(); city.player.visible=!settings.fp;
}
const _tilt=new THREE.Quaternion();
function updateDrive(dt,t){
  const v=city.drive, d=v.def, inp=!ui.panel, P=v.g.position, F=v.F;
  const thr=inp&&(keys.KeyW||keys.ArrowUp), brk=inp&&(keys.KeyS||keys.ArrowDown);
  if(thr) v.speed += (v.speed<0 ? d.accel*2 : d.accel)*dt;
  if(brk) v.speed -= (v.speed>0 ? d.accel*2 : d.accel*.6)*dt;
  if(!thr && !brk) v.speed *= Math.exp(-.5*dt);
  if(inp && keys.Space) v.speed *= Math.exp(-4*dt);
  v.speed = clamp(v.speed, -d.speed*.3, d.speed);
  const steerIn = inp ? ((keys.KeyA||keys.ArrowLeft)?1:0)-((keys.KeyD||keys.ArrowRight)?1:0) : 0;
  v.steer += (steerIn - v.steer)*Math.min(1,6*dt);
  const sr = Math.abs(v.speed)/d.speed;
  v.yaw += v.steer*d.turn*1.5*dt*clamp(v.speed/5,-1,1)*(1-sr*.45);
  _prev.copy(P);
  P.add(_mv.set(-Math.sin(v.yaw),0,-Math.cos(v.yaw)).applyQuaternion(F.q).multiplyScalar(v.speed*dt));
  if(collideWorld(P, d.kind==='bike'?.7:d.kind==='truck'?1.7:1.4, false) && Math.abs(v.speed)>2){
    const imp=Math.abs(v.speed);
    if(imp>8){ noise({dur:.25,vol:.3,freq:500}); city.shake=.4; } if(imp>14) playerDamage((imp-14)*1.6,'Batida de carro');
    v.speed*=-.25;
  }
  vehicleHits(v);
  const s=groundAt(P,_gp,_gu);
  if(!s && groundWater){ P.copy(_prev); v.speed=0; groundAt(P,_gp,_gu); }
  P.copy(_gp); transport(F,_gu); city.here=s;
  _qa.copy(F.q).multiply(qYaw(v.yaw)); if(!s){ _tilt.setFromUnitVectors(_gu, GN); _qa.premultiply(_tilt); }
  v.g.quaternion.slerp(_qa, Math.min(1,12*dt));
  v.body.rotation.z = -v.steer*sr*(d.kind==='bike'?.45:.06);
  v.body.rotation.x = clamp((thr?-.02:0)+(brk&&v.speed>0?.03:0),-.05,.05);
  for(const w of v.wheels) w.rotation.x -= v.speed*dt/w.userData.r;
  engineUpdate(sr);
  city.lookT -= dt; if(city.lookT<0 && Math.abs(v.speed)>3) city.camOff *= Math.exp(-2*dt);
  const camYaw = v.yaw+city.camOff;
  if(settings.fp){ const side=d.kind==='bike'?0:-.4, up=d.kind==='truck'?2.1:d.kind==='bike'?1.7:1.25;
    camFirst(_tgt.set(side,up,-.2).applyQuaternion(_qa).add(P), F, camYaw, city.pitch); }
  else camThird(_tgt.copy(P).addScaledVector(F.up,1.5), F, camYaw, city.pitch, d.kind==='truck'?9:d.kind==='bike'?5.5:7.5);
  if(city.shake>0){ city.cam.position.x+=rand(-1,1)*city.shake*.2; city.cam.position.y+=rand(-1,1)*city.shake*.2; city.shake*=Math.exp(-6*dt); }
  setPrompt(ui.panel?'':(Math.abs(v.speed)<3?'[E] Sair do veículo':''));
}
function vehicleHits(v){
  const s=siteAt(v.g.position,100); if(!s) return;
  const l=toLocal(s,v.g.position,new V3()), sp=Math.abs(v.speed);
  for(const n of s.npcs){ if(!n.g.visible || n.down>0) continue; const q=n.g.position, d=Math.hypot(q.x-l.x,q.z-l.z);
    if(d<2.2){ if(sp>4){ knockNPC(n, sp); crime(n.dead?2:1, n.dead?'Atropelamento fatal':'Atropelamento'); v.speed*=.85; } else { n.p += n.dir*1.5; n.wait=0; } } }
  for(const o of s.traffic){ const dx=l.x-o.g.position.x, dz=l.z-o.g.position.z, dd=Math.hypot(dx,dz);
    if(dd<3 && dd>1e-3){ l.x=o.g.position.x+dx/dd*3; l.z=o.g.position.z+dz/dd*3; if(sp>6) noise({dur:.2,vol:.25,freq:600}); if(sp>12) playerDamage(sp*.6,'Colisão'); v.speed*=.4; o.v=0; toWorld(s,l,v.g.position); } }
  policeVehicleHit(s, l, v);
}

// ---------------------------------------------------------------- nave: estacionada, voo atmosférico, pouso e subida à órbita
function shipPark(){
  const m=activeShip().model, sp=state.ship;
  if(sp && sp.p) return { p:new V3().fromArray(sp.p), q:new THREE.Quaternion().fromArray(sp.q), up:new V3().fromArray(sp.up), yaw:sp.yaw };
  return { p:new V3(HANGAR_PAD.x, shipLift(m), HANGAR_PAD.z), q:new THREE.Quaternion(), up:new V3(0,1,0), yaw:Math.PI/2 };
}
function syncHangarShip(){
  const m=activeShip().model;
  if(!city.ship || city.shipModel!==m){ if(city.ship) city.scene.remove(city.ship.g); city.ship=makeShip(m); city.ship.g.scale.setScalar(SHIP_SCALE); city.scene.add(city.ship.g); city.shipModel=m; }
  if(city.fly || city.launch) return;
  const pk=shipPark(), s=city.ship;
  s.g.position.copy(pk.p); s.g.quaternion.copy(pk.q).multiply(qYaw(pk.yaw));
  s.flames.forEach(f=>f.scale.set(1,.15,1)); s.light.intensity=.2; s.model.visible=true; s.model.rotation.set(0,0,0);
}
function boardShip(){
  const pk=shipPark();
  city.fly = { F:{ q:pk.q.clone(), up:pk.up.clone() }, yaw:pk.yaw, pitch:0, aimYaw:pk.yaw, aimPitch:0, speed:0, throttle:0, lift:2.4, landing:null };
  city.player.visible=false; city.mining=null; engineStart('ship'); sfx.door(); noise({dur:2.5,vol:.3,freq:220});
  hudFor('city'); toast('Mouse: mira · W/S: potência · Shift: pós-combustor · E: pousar · O: subir à órbita', '#5ef2ff');
}
const _fq=new THREE.Quaternion(), _fe=new THREE.Euler(0,0,0,'YXZ'), _ff=new V3(), _foff=new V3();
function flyQuat(f, out=_fq){ _fe.set(f.pitch, f.yaw, 0, 'YXZ'); return out.copy(f.F.q).multiply(_qa.setFromEuler(_fe)); }
function updateFly(dt,t){
  const f=city.fly, sh=city.ship, P=sh.g.position, st=shipStats(activeShip()), inp=!ui.panel, lift=shipLift(city.shipModel);
  if(f.landing){
    const L=f.landing; L.t+=dt; const k=smooth01(L.t/2.4);
    P.lerpVectors(L.from, L.to, k); sh.g.quaternion.slerpQuaternions(L.qFrom, L.qTo, k);
    sh.flames.forEach(fl=>fl.scale.set(1,.5*(1-k)+.15,1)); engineUpdate(.2*(1-k));
    camThird(_tgt.copy(P), f.F, f.yaw+.6, .3, 34);
    if(L.t>=2.4) finishLanding();
    return;
  }
  if(f.lift>0){ f.lift-=dt; P.addScaledVector(f.F.up, 18*dt); f.speed=0; }
  else if(inp){
    if(keys.ArrowLeft||keys.KeyA) f.aimYaw += 1.1*dt; if(keys.ArrowRight||keys.KeyD) f.aimYaw -= 1.1*dt;
    if(keys.ArrowUp) f.aimPitch += .9*dt; if(keys.ArrowDown) f.aimPitch -= .9*dt;
    if(keys.KeyW) f.throttle=Math.min(1,f.throttle+.6*dt); if(keys.KeyS) f.throttle=Math.max(0,f.throttle-.6*dt);
  }
  f.aimPitch = clamp(f.aimPitch,-1.45,1.45); f.aimYaw = f.yaw + clamp(f.aimYaw-f.yaw,-.9,.9);
  const yawErr=f.aimYaw-f.yaw, pitchErr=f.aimPitch-f.pitch, turn=1.5*st.turn*dt;
  f.yaw += clamp(yawErr*3.5*dt,-turn,turn); f.pitch += clamp(pitchErr*5*dt,-turn*1.5,turn*1.5);   // arfagem (mouse ↑/↓) mais rápida
  const boost = inp && keys.ShiftLeft && f.lift<=0, maxSp = (boost?1100:320)*st.speed/60;
  if(inp && keys.Space){ f.throttle=Math.max(0,f.throttle-1.5*dt); f.speed*=Math.exp(-1.5*dt); }
  f.speed += (f.throttle*maxSp - f.speed)*Math.min(1,(boost?.45:.8)*dt);
  flyQuat(f); sh.g.quaternion.copy(_fq);
  _ff.set(0,0,-1).applyQuaternion(_fq); P.addScaledVector(_ff, f.speed*dt);
  sh.model.rotation.z += ((yawErr*1.2) - sh.model.rotation.z)*Math.min(1,4*dt);
  sh.flames.forEach(fl=>fl.scale.set(1, .4+f.throttle*1.6+(boost?1.5:0)+Math.random()*.3, 1)); sh.light.intensity=.5+f.throttle*2;
  engineUpdate(Math.min(1,f.speed/320));
  // referencial, altitude e colisões
  const s=siteAt(P), d=_gd.subVectors(P,PC).normalize();
  if(s) _gu.copy(s.up); else surfaceUp(d,_gu);
  transport(f.F,_gu); city.here=s;
  let alt;
  if(s){ const l=toLocal(s,P,_gl); alt=l.y; if(f.lift<=0 && insideBoxLocal(s,l.x,l.y,l.z,2)) return shipCrash('Colisão com um prédio'); }
  else { const gr=groundR(d), sea=PLANET.R+PLANET.SEA; alt=P.distanceTo(PC)-Math.max(gr,sea); if(gr<sea && alt<2 && f.speed>20) return shipCrash('Mergulho no oceano'); }
  f.vs = f.alt===undefined ? 0 : f.vs + ((alt-f.alt)/Math.max(dt,1e-3) - f.vs)*Math.min(1,4*dt);   // velocidade vertical
  f.alt=alt;
  if(alt<lift && f.lift<=0){ if(f.speed>34) return shipCrash('Queda da nave'); P.addScaledVector(f.F.up, lift-alt); f.speed*=.6; }
  // câmera
  if(settings.fp){ sh.model.visible=false; city.cam.position.copy(_tgt.set(0,.55,-.6).multiplyScalar(SHIP_SCALE).applyQuaternion(_fq).add(P)); city.cam.quaternion.copy(_fq); }
  else {
    // câmera presa atrás da nave (distância fixa em qualquer velocidade); só a rotação é suavizada, e ela inclina junto ao subir/descer
    sh.model.visible=true; if(!f.camQ) f.camQ=_fq.clone(); f.camQ.slerp(_fq, 1-Math.exp(-6*dt));
    _foff.set(0,4.5,17).multiplyScalar(SHIP_SCALE*.6).applyQuaternion(f.camQ);
    city.cam.position.copy(P).add(_foff); city.cam.up.set(0,1,0).applyQuaternion(f.camQ);
    city.cam.lookAt(_tgt.set(0,0,-30).applyQuaternion(f.camQ).add(P));
  }
  // HUD
  const aim=document.getElementById('aim'), ap=_tgt.copy(P).addScaledVector(_mv.set(0,0,-1).applyEuler(_fe.set(f.aimPitch,f.aimYaw,0,'YXZ')).applyQuaternion(f.F.q),120).project(city.cam);
  aim.style.left=((ap.x*.5+.5)*innerWidth)+'px'; aim.style.top=((-ap.y*.5+.5)*innerHeight)+'px';
  let pr='';
  if(f.lift<=0 && alt<80 && f.speed<45){ const pad=nearPad(P); pr = pad ? `[E] Pousar — ${pad.pad.name}` : '[E] Pousar aqui'; }
  else if(alt>150) pr = '[O] Subir para a órbita';
  setPrompt(ui.panel?'':pr);
}
function nearPad(P){
  const s=siteAt(P,100); if(!s) return null; const l=toLocal(s,P,new V3());
  for(const pad of s.pads) if(Math.hypot(l.x-pad.x,l.z-pad.z)<45) return { s, pad };
  return null;
}
function flyInteract(){
  const f=city.fly; if(f.landing || f.lift>0) return;
  if(!(f.alt<80 && f.speed<45)) return;
  const sh=city.ship, P=sh.g.position, lift=shipLift(city.shipModel), np=nearPad(P);
  let to;
  if(np){ to=toWorld(np.s, new V3(np.pad.x, lift, np.pad.z), new V3()); _gu.copy(np.s.up); }
  else { const s=groundAt(P,_gp,_gu); if(!s && groundWater){ toast('Não é possível pousar na água', '#ff4a4a'); sfx.error(); return; } to=_gp.clone().addScaledVector(_gu,lift); }
  transport(f.F,_gu); f.pitch=0; f.aimPitch=0;
  f.landing = { t:0, from:P.clone(), to, qFrom:sh.g.quaternion.clone(), qTo:flyQuat(f,new THREE.Quaternion()), pad:np?np.pad:null };
  sfx.door();
}
function finishLanding(){
  const f=city.fly, L=f.landing;
  state.ship = { p:L.to.toArray(), q:f.F.q.toArray(), up:f.F.up.toArray(), yaw:f.yaw, pad:L.pad?L.pad.name:null }; save();
  city.fly=null; engineStop();
  const right=_mv.set(Math.cos(f.yaw),0,-Math.sin(f.yaw)).applyQuaternion(f.F.q);
  city.player.position.copy(L.to).addScaledVector(right, 9);
  city.frame.q.copy(f.F.q); city.frame.up.copy(f.F.up); city.yaw=f.yaw+Math.PI/2; city.heading=f.yaw; city.pitch=settings.fp?0:.2; city.air=0; city.vy=0;
  groundAt(city.player.position,_gp,_gu); if(!groundWater) city.player.position.copy(_gp);
  syncHangarShip(); hudFor('city');
  toast(L.pad ? `Pouso concluído — ${L.pad.name}` : 'Pouso concluído', '#7dff9a');
}
function shipCrash(why){
  city.fly=null; engineStop(); sfx.boom(); noise({dur:1.2,vol:.5,freq:400});
  state.stats.hp = Math.max(8, state.stats.hp-40); state.ship=null; save();
  setCenter(`NAVE DESTRUÍDA<br><span style="font-size:24px;color:#ffb347">${why} · rebocada ao Hangar 07</span>`, 2.6);
  setTimeout(()=>transition(()=>enterCity('hangar')), 1800);
}
function startAscent(){
  const f=city.fly; if(!f || f.landing || f.lift>0 || city.launch) return;
  city.launch = { t:0, P0:city.ship.g.position.clone(), U:f.F.up.clone(), alt0:f.alt||0, v0:f.speed, pitch0:f.pitch, done:false };
  noise({dur:5,vol:.4,freq:180}); tone({type:'sawtooth',f0:50,f1:240,dur:6,vol:.12});
  document.getElementById('alt').style.display='block'; ['minimap','loc'].forEach(id=>document.getElementById(id).style.display='none');
  toast('Rumo à órbita · [Enter] pular', '#ffb347');
}
function updateLaunch(dt,t){
  const L=city.launch, f=city.fly, sh=city.ship, P=sh.g.position; L.t+=dt; const u=L.t, ACC=190;
  const gain = L.v0*.3*u + .5*ACC*u*u, alt = L.alt0+gain, v=L.v0*.3+ACC*u;
  P.copy(L.P0).addScaledVector(L.U, gain);
  f.pitch = L.pitch0 + (Math.PI/2-L.pitch0)*smooth01(u/2.5); flyQuat(f); sh.g.quaternion.copy(_fq);
  sh.flames.forEach(fl=>fl.scale.set(1,2.6+Math.random()*.5,1)); sh.light.intensity=2.5; engineUpdate(1);
  const g=1+Math.min(alt/2000,6), w=smooth01((alt-1500)/6000), up=-26+44*w;
  _foff.set(-38*g, up*g, 30*g).applyQuaternion(_qa.copy(f.F.q).multiply(qYaw(f.yaw)));
  city.cam.position.copy(P).add(_foff); city.cam.up.copy(L.U); city.cam.lookAt(P);
  if(u<4){ city.cam.position.x+=rand(-1,1)*.4*(1-u/4); city.cam.position.y+=rand(-1,1)*.4*(1-u/4); }
  const phase = alt<2800?'ATRAVESSANDO NUVENS' : alt<12000?'TROPOSFERA' : alt<20000?'ESTRATOSFERA':'SAÍDA DA ATMOSFERA';
  document.getElementById('alt').innerHTML = `<div style="font-size:30px;color:var(--cyan)">${phase}</div>ALTITUDE <b>${Math.round(alt).toLocaleString('pt-BR')} m</b> · VELOCIDADE <b>${Math.round(v*3.6).toLocaleString('pt-BR')} km/h</b>`;
  if((alt>=21000 || L.skip) && !L.done){ L.done=true; sfx.jump(); transition(()=>reachOrbit(), true); }
}
function endLaunch(){ city.launch=null; document.getElementById('alt').style.display='none'; }

// ---------------------------------------------------------------- entrada na cidade, HUD e minimapa
function cityPlace(where){
  syncCityVehicles(); city.drive=null; city.fly=null; city.mining=null; engineStop();
  const p=city.player, F=city.frame; p.visible=!settings.fp; city.air=0; city.vy=0;
  if(where==='hangar'){ state.ship=null; save(); }
  syncHangarShip();
  if(where==='reentry'){
    p.visible=false; const sh=city.ship;
    city.fly = { F:makeFrame(), yaw:0, pitch:-.12, aimYaw:0, aimPitch:-.12, speed:260, throttle:.8, lift:0, landing:null };
    sh.g.position.set(0,6500,3500); engineStart('ship');
    return;
  }
  const site = where && where.site ? where.site : SITES[0];
  F.q.copy(site.group.quaternion); F.up.copy(site.up);
  let local;
  if(where==='hangar') { local=new V3(HANGAR_PAD.x-12,.3,6); city.yaw=-Math.PI/2-.4; city.heading=Math.PI/2; }
  else if(where==='home'){ local=new V3(HOME_DOOR.x,.2,HOME_DOOR.z-2.5); city.yaw=0; city.heading=Math.PI; }
  else { local=site.spawn.clone(); city.yaw=0; city.heading=Math.PI; }
  toWorld(site, local, p.position);
  city.pitch = settings.fp?0:.2;
}
function buildMinimap(site){
  const SZ=700, sc=SZ/1400, c=document.createElement('canvas'); c.width=c.height=SZ; const g=c.getContext('2d'), X=x=>(x+700)*sc, ext=site.ext;
  g.fillStyle=site.id==='porto'?'#6a4a34':'#3a4a34'; g.fillRect(0,0,SZ,SZ);
  g.fillStyle='#3a3a40'; g.fillRect(X(-site.paved),X(-site.paved),2*site.paved*sc,2*site.paved*sc);
  g.fillStyle='#55555e'; for(const b of site.boxes) if(Math.hypot((b.x0+b.x1)/2,(b.z0+b.z1)/2)>ext) g.fillRect(X(b.x0),X(b.z0),(b.x1-b.x0)*sc,(b.z1-b.z0)*sc);
  g.fillStyle='#22222a'; g.fillRect(X(-ext-8),X(-ext-8),(2*ext+16)*sc,(2*ext+16)*sc);
  for(let i=0;i<site.N;i++) for(let j=0;j<site.N;j++){
    const x0=(i-site.N/2)*CITY.P+CITY.ROAD/2, z0=(j-site.N/2)*CITY.P+CITY.ROAD/2, sz=CITY.P-CITY.ROAD, sp=site.special[`${i},${j}`];
    g.fillStyle = sp==='park'?'#3a7a3a' : sp==='hangar'||sp==='dock'?'#2a5a7a' : sp==='home'?'#5a7a8a' : sp==='market'?'#8a5a3a' : '#6a6870';
    g.fillRect(X(x0),X(z0),sz*sc,sz*sc);
  }
  site.mapCanvas=c;
}
const _mq=new THREE.Quaternion(), _mv2=new V3();
function drawMinimap(){
  const mm=document.getElementById('minimap'), g=mm.getContext('2d'), W=mm.width, R=170, k=W/(2*R);
  const fr = city.fly ? city.fly.F : city.drive ? city.drive.F : city.frame;
  const P = city.fly ? city.ship.g.position : city.drive ? city.drive.g.position : city.player.position;
  const yaw = city.fly ? city.fly.yaw : city.drive ? city.drive.yaw+city.camOff : city.yaw;
  _mq.copy(fr.q).invert(); const cs=Math.cos(yaw), sn=Math.sin(yaw);
  const toMap=(wp)=>{ const v=_mv2.subVectors(wp,P).applyQuaternion(_mq); return [W/2+k*(v.x*cs-v.z*sn), W/2+k*(v.x*sn+v.z*cs)]; };
  g.save(); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,W,W); g.beginPath(); g.arc(W/2,W/2,W/2-2,0,Math.PI*2); g.clip();
  g.fillStyle='#24301f'; g.fillRect(0,0,W,W);
  for(const s of SITES){
    if(s.center.distanceTo(P) > 3000) continue;
    const ex=_mv2.set(1,0,0).applyQuaternion(s.group.quaternion).applyQuaternion(_mq), ezx=new V3(0,0,1).applyQuaternion(s.group.quaternion).applyQuaternion(_mq);
    const L11=k*(cs*ex.x-sn*ex.z), L21=k*(sn*ex.x+cs*ex.z), L12=k*(cs*ezx.x-sn*ezx.z), L22=k*(sn*ezx.x+cs*ezx.z);
    const pl=toLocal(s,P,new V3()), msc=.5, half=700;
    g.setTransform(L11/msc, L21/msc, L12/msc, L22/msc, W/2 + L11*(-half-pl.x) + L12*(-half-pl.z), W/2 + L21*(-half-pl.x) + L22*(-half-pl.z));
    g.drawImage(s.mapCanvas,0,0); g.setTransform(1,0,0,1,0,0);
  }
  const icon=(wp,txt,col,clampEdge=true)=>{ let [mx,mz]=toMap(wp); const dx=mx-W/2, dz=mz-W/2, d=Math.hypot(dx,dz), lim=W/2-12; if(d>lim){ if(!clampEdge) return; mx=W/2+dx/d*lim; mz=W/2+dz/d*lim; }
    g.fillStyle='rgba(0,0,0,.6)'; g.beginPath(); g.arc(mx,mz,9,0,Math.PI*2); g.fill(); g.fillStyle=col; g.font='bold 13px monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,mx,mz+1); };
  const dot=(wp,col,r=3)=>{ const [mx,mz]=toMap(wp); if(Math.hypot(mx-W/2,mz-W/2)>W/2) return; g.fillStyle=col; g.fillRect(mx-r,mz-r,2*r,2*r); };
  for(const s of SITES){ if(s.center.distanceTo(P)>2500) continue; for(const sh of s.shops) if(sh.act) dot(toWorld(s,_tgt.set(sh.x,0,sh.z),new V3()), sh.color); }
  for(const dep of nearbyDeposits()) dot(dep.pos, dep.type==='crystal'?'#7ff6ff':dep.type==='herbs'?'#c87aff':'#ffb347', 3);
  for(const id in city.vehicles) if(city.vehicles[id]!==city.drive) dot(city.vehicles[id].g.position,'#5ef2ff',2);
  for(const u of policeUnitsWorld()) dot(u,'#ff3a3a',3);
  if(city.ship && !city.fly) icon(city.ship.g.position,'✈','#ffb347');
  icon(toWorld(SITES[0],HOME_DOOR,new V3()),'⌂','#5ef2ff'); icon(toWorld(SITES[0],HANGAR_PAD,new V3()),'H','#ff7a3a');
  icon(SITES[1].center,'P','#ff9a5a');
  g.translate(W/2,W/2); g.fillStyle='#ffb347'; g.beginPath(); g.moveTo(0,-9); g.lineTo(6,7); g.lineTo(0,3); g.lineTo(-6,7); g.closePath(); g.fill();
  g.restore();
  g.strokeStyle='#9a6a2a'; g.lineWidth=2; g.beginPath(); g.arc(W/2,W/2,W/2-2,0,Math.PI*2); g.stroke();
}
const fmtKm = m => m>=1000 ? (m/1000).toFixed(1).replace('.',',')+' km' : Math.round(m)+' m';
function cityHUD(){
  const loc=document.getElementById('loc'), v=city.drive, f=city.fly;
  const P = f ? city.ship.g.position : v ? v.g.position : city.player.position;
  let html;
  if(city.launch) html='';
  else if(f){ const vs=Math.round(f.vs||0);
    html = `<b>${SHIPS[activeShip().model].name}</b> · ALT ${fmtKm(Math.max(0,f.alt||0))} <span style="color:${vs>1?'var(--green)':vs<-1?'var(--red)':'var(--muted)'}">${vs>1?'▲':vs<-1?'▼':'■'} ${Math.abs(vs)} m/s</span> · ${Math.round(f.speed*3.6).toLocaleString('pt-BR')} km/h`; }
  else if(v) html = `<b>${v.def.name}</b> · ${Math.round(Math.abs(v.speed)*3.6)} km/h`;
  else if(city.here) html = `AURORA · ${city.here.name}<br><span style="font-size:16px;color:var(--muted)">${city.here.sub}</span>`;
  else { const d=_gd.subVectors(P,PC).normalize(), b=biomeOf(d, groundR(d)-PLANET.R), near=SITES.reduce((a,s)=>s.center.distanceTo(P)<a.center.distanceTo(P)?s:a);
    html = `AURORA · ${BIOME_NAME[b]}<br><span style="font-size:16px;color:var(--muted)">Área selvagem · ${fmtKm(near.center.distanceTo(P))} de ${near.name.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase())}</span>`; }
  if(loc._h!==html){ loc.innerHTML=html; loc._h=html; }
  const mh=document.getElementById('mk-hangar'), mc=document.getElementById('mk-home'), ms=document.getElementById('mk-station');
  if(city.launch){ mh.style.display=mc.style.display=ms.style.display='none'; return; }
  drawMinimap();
  const k1=SITES[0], home=toWorld(k1,_tgt.set(HOME_DOOR.x,6,HOME_DOOR.z),new V3()), dc=home.distanceTo(P);
  const shipP = city.ship && !f ? city.ship.g.position : null, dsh = shipP ? shipP.distanceTo(P) : 0;
  if(shipP && dsh>30) marker(mh, _tgt.copy(shipP), `NAVE<br>${fmtKm(dsh)}`, city.cam); else mh.style.display='none';
  if(dc>25 && dc<6000) marker(mc, home, `CASA<br>${fmtKm(dc)}`, city.cam); else mc.style.display='none';
  const other = SITES.find(s=>s!==city.here && s.center.distanceTo(P)>2500 && s.center.distanceTo(P)<60000 && (f || s.center.distanceTo(P)<15000));
  if(other){ ms.style.color='#ff9a5a'; marker(ms, _tgt.copy(other.center).addScaledVector(other.up,300), `${other.name}<br>${fmtKm(other.center.distanceTo(P))}`, city.cam); }
  else ms.style.display='none';
}
const _camUp=new V3();
function updateCity(dt,t){
  if(city.launch) updateLaunch(dt,t);
  else if(city.fly) updateFly(dt,t);
  else if(city.drive) updateDrive(dt,t);
  else updateWalk(dt,t);
  const P = city.fly ? city.ship.g.position : city.drive ? city.drive.g.position : city.player.position;
  for(const s of SITES){
    const dist = s.center.distanceTo(P);
    s.group.visible = dist < 30000;
    if(dist > 4000) continue;
    const PL = toLocal(s, P, new V3());
    updateTraffic(s, dt, PL, !city.drive && !city.fly);
    updateNPCs(s, dt, t, PL); updateAir(s, dt);
    for(const fn of s.anim) fn(t,dt);
  }
  updateChunks(P, t);
  if(t-city.tickT>.07){ city.tickT=t; drawTicker(t); }
  const cp=city.cam.position, d=_gd.subVectors(cp,PC).normalize(), camAlt = altitudeOf(cp);
  surfaceUp(d,_camUp);
  updateSky(city.scene, cp, _camUp, clamp(camAlt/21000,0,1));
  const fov=settings.fov + (city.drive ? Math.abs(city.drive.speed)*.25 : city.fly ? Math.min(10,city.fly.speed*.01) : 0);
  if(Math.abs(city.cam.fov-fov)>.05){ city.cam.fov += (fov-city.cam.fov)*Math.min(1,4*dt); city.cam.updateProjectionMatrix(); }
  cityHUD();
}
