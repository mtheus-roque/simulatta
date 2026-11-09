'use strict';
/* Planeta Aurora — cidade de Nova Kessler
   Ruas, prédios, comércios, NPCs, trânsito terrestre e aéreo, veículos do jogador,
   hangar e a decolagem até a estratosfera.
   Escala: 1 unidade = 1 metro. */

// ---------------------------------------------------------------- parâmetros
const CITY = { N:7, P:72, ROAD:16, WALK:5 };              // 7x7 quarteirões, 72 m entre eixos de rua
const cityLine = k => (k - CITY.N/2)*CITY.P;              // eixo da rua k (0..N)
const CITY_EXT = CITY.N/2*CITY.P;                          // 252 m do centro até a última rua
const HOME_DOOR = new V3(0,0,48.6), HANGAR_PAD = new V3(216,0,0);
const SUN_DIR = new V3(-.55,.14,-.82).normalize();
const PARK_SPOTS = [[6,41.5],[14,41.5],[22,41.5],[-8,41.5]];
const city = { scene:new THREE.Scene(), cam:new THREE.PerspectiveCamera(70, innerWidth/innerHeight, .1, 160000),
  boxes:[], circles:[], npcs:[], traffic:[], air:[], shops:[], anim:[], vehicles:{}, yaw:0, pitch:.22, walk:0,
  drive:null, camOff:0, lookT:0, launch:null, near:null, tickT:0 };

// RNG com semente: a cidade é sempre a mesma
let crngState = 1337;
const crng = ()=>{ crngState|=0; crngState=crngState+0x6D2B79F5|0; let t=Math.imul(crngState^crngState>>>15,1|crngState); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
const cr = (a,b)=>a+crng()*(b-a);
const pick = arr => arr[(crng()*arr.length)|0];

// ---------------------------------------------------------------- batching (poucas chamadas de desenho)
const _bm=new THREE.Matrix4(), _bq=new THREE.Quaternion(), _bs=new V3(1,1,1), _bp=new V3(), _yAxis=new V3(0,1,0);
const cityBatch = {
  groups:new Map(),
  add(mat, geom, x=0,y=0,z=0, ry=0){
    _bq.setFromAxisAngle(_yAxis, ry); _bm.compose(_bp.set(x,y,z), _bq, _bs); geom.applyMatrix4(_bm);
    const g = geom.index ? geom.toNonIndexed() : geom;
    if(!this.groups.has(mat)) this.groups.set(mat, []); this.groups.get(mat).push(g);
  },
  build(scene){
    const U = THREE.BufferGeometryUtils;
    for(const [mat, list] of this.groups){
      let merged = null;
      if(U && U.mergeBufferGeometries) try{ merged = U.mergeBufferGeometries(list); }catch(e){ merged=null; }
      if(merged) scene.add(new THREE.Mesh(merged, mat)); else list.forEach(g=>scene.add(new THREE.Mesh(g, mat)));
    }
    this.groups.clear();
  }
};
const gBox = (w,h,d)=>new THREE.BoxGeometry(w,h,d);
const gCyl = (rt,rb,h,s=10)=>new THREE.CylinderGeometry(rt,rb,h,s);

// ---------------------------------------------------------------- texturas
function facadeTex(style){
  const W=128, H=112;   // 4 janelas x 4 andares = 16 m x 14 m
  const pal = [ ['#8a847c','#26303a'], ['#2e3a48','#4a6a8a'], ['#6a4a36','#2a2220'], ['#d4d2ca','#1e2a32'] ][style];
  const lit = ['#ffd9a0','#ffe8c0','#ffcf90','#fff4e0','#ffd9a0','#a0e8ff','#ffb070','#ff9ad8'];
  const mk = emi => { const t = canvasTex(W,H,(g)=>{
    g.fillStyle = emi ? '#000' : pal[0]; g.fillRect(0,0,W,H);
    for(let fy=0; fy<4; fy++){
      const y = fy*28;
      if(style===3){ g.fillStyle = emi ? (Math.random()<.55 ? '#2a9ab8' : '#000') : pal[1]; g.fillRect(0,y+9,W,11); continue; }
      for(let fx=0; fx<4; fx++){
        const x = fx*32, on = Math.random()<.34;
        g.fillStyle = emi ? (on ? lit[(Math.random()*lit.length)|0] : '#000') : pal[1];
        if(style===0) g.fillRect(x+7,y+7,18,14); else if(style===1) g.fillRect(x+3,y+3,27,23); else g.fillRect(x+9,y+9,14,10);
      }
    }
    if(!emi) for(let k=0;k<30;k++){ g.fillStyle=`rgba(0,0,0,${Math.random()*.12})`; g.fillRect(Math.random()*W,Math.random()*H,rand(2,10),rand(4,30)); }
  }); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; };
  const map = mk(false), emi = mk(true);
  return new THREE.MeshStandardMaterial({ map, emissiveMap:emi, emissive:0xffffff, emissiveIntensity:.7,
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
const SHOP_NAMES = [ ['BAR','#ff7a3a'],['NOODLES 麺','#ffb347'],['HOTEL','#ff4a6a'],['RAMEN','#ffd040'],['CLÍNICA','#7dff9a'],
  ['ARMAS','#ff4a4a'],['TATTOO','#ff4ab0'],['KARAOKÊ','#c07aff'],['CAFÉ','#ffb347'],['MERCADO 24H','#5ef2ff'],
  ['IMPLANTES','#5ef2ff'],['BOUTIQUE AURA','#ff9ad8'],['FARMÁCIA','#7dff9a'],['PENHORES','#d8a040'],['CASSINO','#ffd040'],
  ['LAVANDERIA','#8ab4ff'],['SUSHI','#ff7a3a'],['FLIPERAMA','#ff4ab0'],['ELETRÔNICOS','#5ef2ff'],['BARBEARIA','#ff4a6a'] ];
const FUNCTIONAL_SHOPS = [
  { name:'MOTORES ÁUREA',   color:'#5ef2ff', act:['shop','vehicles'], actLabel:'concessionária de veículos' },
  { name:'OFICINA REPARO',  color:'#ffb347', act:['shop','modules'],  actLabel:'módulos de nave' },
  { name:'FERRO-VELHO',     color:'#d8a040', act:['shop','sell'],     actLabel:'vender sucata' },
  { name:'CASA & ANTIGOS',  color:'#ff8ad0', act:['shop','furniture'],actLabel:'móveis' },
  { name:'CONTRATOS',       color:'#7dff9a', act:['contracts'],       actLabel:'quadro de contratos' },
];

// ---------------------------------------------------------------- modelos
function makeNPC(sp){
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
    const coat=M(pick([0x6b5636,0x3a3a44,0x5a2a2a,0x2a4a3a,0x7a6a5a,0x2a2a2a,0x8a5a2a])), dark=M(0x24242a);
    const skin=M(pick([0xc89a72,0x8a5a3a,0xe0b090,0x5a3a2a,0xa87a5a])), hair=M(pick([0x1c1612,0x3a2a1a,0x8a6a3a,0xb04a2a,0xd8d0c0]));
    g.userData.legL=leg(.16,.62,.18,dark,-.12); g.userData.legR=leg(.16,.62,.18,dark,.12);
    cyl(.28,.4,.95,7,coat,0,1.0,0,g); box(.66,.24,.34,coat,0,1.42,0,g);
    const h=new THREE.Mesh(new THREE.IcosahedronGeometry(.2,0),skin); h.position.y=1.76; g.add(h);
    box(.36,.12,.36,hair,0,1.9,-.03,g);
  }
  return g;
}
function makeCar(kind, color, glow){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const paint=M(color,{metalness:.55,roughness:.45,flatShading:true}), dark=M(0x16161a), glass=M(0x1a2838,{metalness:.8,roughness:.2}), tire=M(0x111111);
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

// ---------------------------------------------------------------- construção
function buildCity(){
  const s = city.scene;
  crngState = 1337;
  const MAT = city.mat = {
    asphalt:M(0x2a2a2e,{flatShading:false}), walk:M(0x8a8680), grass:M(0x4a7a3a), grass2:M(0x3a6a34), trunk:M(0x5a4030),
    leaf:[M(0x3a7a3a),M(0x4a8a3a),M(0x2f6a3a),M(0x6a8a3a)], metal:M(0x5a5a62,{metalness:.5}), dark:M(0x2a2a30), concrete:M(0x9a968e),
    white:M(0xd8d8d0), lamp:B(0xffe0a8), redLight:B(0xff2a1a), water:M(0x2a8aaa,{emissive:0x0a3a4a,roughness:.2,metalness:.3}),
    shopGlass:[B(0xffc890),B(0xa8f0ff),B(0xffa8d8)], awnings:[M(0xa83a2a),M(0x2a6a8a),M(0xc89a2a),M(0x5a2a6a),M(0x2a7a4a)],
    hangar:M(0x6a6e74,{metalness:.4}), yellow:M(0xd8a020), tank:M(0xd0d0c8,{metalness:.3}),
  };
  city.facade = [0,1,2,3].map(facadeTex);
  city.adTex = CITY_ADS.map(adTex);

  // céu, sol, estrelas, neblina e luz
  const skyTex = canvasTex(16,256,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h);
    gr.addColorStop(0,'#0c1838'); gr.addColorStop(.3,'#34508e'); gr.addColorStop(.43,'#b88a8a'); gr.addColorStop(.49,'#ffb878');
    gr.addColorStop(.52,'#d8a080'); gr.addColorStop(1,'#3a3236'); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  city.skyMat = B(0xffffff,{map:skyTex, side:THREE.BackSide, fog:false, depthWrite:false});
  city.sky = new THREE.Mesh(new THREE.SphereGeometry(30000,32,16), city.skyMat); city.sky.renderOrder=-2; s.add(city.sky);
  const sunTex = canvasTex(128,128,(g)=>{ const rg=g.createRadialGradient(64,64,0,64,64,64); rg.addColorStop(0,'rgba(255,250,230,1)'); rg.addColorStop(.18,'rgba(255,220,160,.95)'); rg.addColorStop(.4,'rgba(255,160,90,.35)'); rg.addColorStop(1,'rgba(255,120,60,0)'); g.fillStyle=rg; g.fillRect(0,0,128,128); });
  city.sun = new THREE.Sprite(new THREE.SpriteMaterial({map:sunTex, fog:false, depthWrite:false, transparent:true})); city.sun.scale.setScalar(5200); city.sun.renderOrder=-1; s.add(city.sun);
  const sg = new THREE.BufferGeometry(), sp = [];
  for(let i=0;i<1600;i++){ const v=new V3(rand(-1,1),rand(.02,1),rand(-1,1)).normalize().multiplyScalar(28000); sp.push(v.x,v.y,v.z); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
  city.stars = new THREE.Points(sg, new THREE.PointsMaterial({color:0xffffff, size:2, sizeAttenuation:false, transparent:true, opacity:0, fog:false, depthWrite:false}));
  city.stars.renderOrder=-1; s.add(city.stars);
  city.fogColor = new THREE.Color(0xd8a084);
  s.fog = new THREE.FogExp2(city.fogColor.clone(), .00011); s.background = city.fogColor.clone();
  s.add(new THREE.HemisphereLight(0x9ab4ff, 0x6a4a3a, .65));
  s.add(new THREE.AmbientLight(0x403040, .35));
  const sun = new THREE.DirectionalLight(0xffc49a, 1.15); sun.position.copy(SUN_DIR).multiplyScalar(100); s.add(sun);

  // terreno
  const grassTex = canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#4a6a34'; g.fillRect(0,0,w,h);
    for(let i=0;i<500;i++){ g.fillStyle=`rgba(${rand(30,90)|0},${rand(70,120)|0},${rand(30,50)|0},.5)`; g.fillRect(Math.random()*w,Math.random()*h,rand(2,8),rand(2,8)); } });
  grassTex.wrapS=grassTex.wrapT=THREE.RepeatWrapping; grassTex.repeat.set(600,600);
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(80000,80000), M(0xffffff,{map:grassTex, flatShading:false}));
  terrain.rotation.x=-Math.PI/2; terrain.position.y=-.3; s.add(terrain); city.terrain=terrain;
  // globo curvo de Aurora (aparece na decolagem, quando a curvatura do planeta fica visível)
  city.globe = new THREE.Group(); city.globe.position.y=-60000.5; city.globe.visible=false; s.add(city.globe);
  const gm = new THREE.Mesh(new THREE.SphereGeometry(60000,96,64), M(0xffffff,{map:fl.planetTex, fog:false, flatShading:false, roughness:.7}));
  gm.rotation.x=Math.PI/2; city.globe.add(gm);
  city.globe.add(new THREE.Mesh(new THREE.SphereGeometry(61800,96,64), B(0x6ab4ff,{transparent:true, opacity:.28, side:THREE.BackSide, blending:THREE.AdditiveBlending, fog:false, depthWrite:false})));
  const outerTex = canvasTex(128,128,(g,w,h)=>{ g.fillStyle='#4a4846'; g.fillRect(0,0,w,h); g.fillStyle='#2c2c30'; g.fillRect(0,56,w,16); g.fillRect(56,0,16,h);
    for(let i=0;i<200;i++){ g.fillStyle=`rgba(0,0,0,${Math.random()*.15})`; g.fillRect(Math.random()*w,Math.random()*h,rand(2,12),rand(2,12)); } });
  outerTex.wrapS=outerTex.wrapT=THREE.RepeatWrapping; outerTex.repeat.set(3400/48,3400/48);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(3400,3400), M(0xffffff,{map:outerTex, flatShading:false}));
  outer.rotation.x=-Math.PI/2; outer.position.y=-.1; s.add(outer);
  const base = new THREE.Mesh(new THREE.PlaneGeometry(2*CITY_EXT+40, 2*CITY_EXT+40), MAT.asphalt); base.rotation.x=-Math.PI/2; base.position.y=-.02; s.add(base);

  // ruas (textura com faixas)
  const roadTex = canvasTex(64,64,(g,w,h)=>{ g.fillStyle='#2a2a2e'; g.fillRect(0,0,w,h);
    for(let i=0;i<120;i++){ g.fillStyle=`rgba(0,0,0,${Math.random()*.25})`; g.fillRect(Math.random()*w,Math.random()*h,rand(1,5),rand(1,5)); }
    g.fillStyle='#e8c040'; g.fillRect(0,31,30,2); g.fillStyle='#d8d8d0'; g.fillRect(0,3,w,1); g.fillRect(0,60,w,1); });
  roadTex.wrapS=roadTex.wrapT=THREE.RepeatWrapping;
  const roadMat = M(0xffffff,{map:roadTex, flatShading:false, roughness:.9});
  const roadLen = 2*CITY_EXT+CITY.ROAD;
  for(let k=0;k<=CITY.N;k++){
    for(const axis of ['x','z']){
      const gg = new THREE.PlaneGeometry(roadLen, CITY.ROAD); gg.rotateX(-Math.PI/2);
      const uv=gg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setX(i, uv.getX(i)*roadLen/16);
      if(axis==='x') cityBatch.add(roadMat, gg, 0, .02, cityLine(k));
      else cityBatch.add(roadMat, gg, cityLine(k), .03, 0, Math.PI/2);
    }
  }

  // quarteirões
  const SPECIAL = { '3,3':'park', '3,4':'home', '6,3':'hangar', '6,2':'port', '6,4':'port2', '2,3':'exchange' };
  for(let i=0;i<CITY.N;i++) for(let j=0;j<CITY.N;j++){
    const x0=cityLine(i)+CITY.ROAD/2, x1=cityLine(i+1)-CITY.ROAD/2, z0=cityLine(j)+CITY.ROAD/2, z1=cityLine(j+1)-CITY.ROAD/2;
    const cx=(x0+x1)/2, cz=(z0+z1)/2, size=x1-x0;
    cityBatch.add(MAT.walk, gBox(size,.2,size), cx,.1,cz);
    // postes e árvores na calçada
    for(let e=0;e<4;e++) for(let q=-2;q<=2;q++){
      const off=q*11, edge=size/2-1.1;
      const [lx,lz] = [[cx+off,z0+1.1],[cx+off,z1-1.1],[x0+1.1,cz+off],[x1-1.1,cz+off]][e];
      if(i===3 && j===4 && e===0 && Math.abs(off)<25) continue;          // entrada da Torre Kessler livre
      if((q+e)%2===0){ cityBatch.add(MAT.metal, gCyl(.1,.14,7,6), lx,3.7,lz); cityBatch.add(MAT.lamp, gBox(.6,.18,.6), lx,7.2,lz); }
      else if(SPECIAL[`${i},${j}`]!=='hangar' && crng()<.55){ cityBatch.add(MAT.trunk, gCyl(.15,.2,2.4,5), lx,1.4,lz); cityBatch.add(pick(MAT.leaf), new THREE.IcosahedronGeometry(cr(1.2,1.7),0), lx,3.3,lz); }
      void edge;
    }
    const ix0=x0+CITY.WALK, ix1=x1-CITY.WALK, iz0=z0+CITY.WALK, iz1=z1-CITY.WALK;
    const sp = SPECIAL[`${i},${j}`];
    if(sp==='park') buildPark(cx,cz,ix1-ix0);
    else if(sp==='home') buildHomeTower(ix0,ix1,iz0,iz1);
    else if(sp==='hangar') buildHangar(ix0,ix1,iz0,iz1);
    else if(sp==='port' || sp==='port2') buildPortBlock(cx,cz,sp==='port');
    else if(sp==='exchange') buildExchange(cx,cz);
    else if(crng()<.14){
      const w=cr(30,42), d=cr(30,42), h=distHeight(cx,cz)*1.5+cr(20,60);
      addTower(cx,cz,w,d,h, (crng()*4)|0, [{nx:1,nz:0},{nx:-1,nz:0},{nx:0,nz:1},{nx:0,nz:-1}], crng()<.35);
    } else {
      const lot=(ix1-ix0)/2;
      for(let a=0;a<2;a++) for(let b=0;b<2;b++){
        const w=cr(15,lot-1.5), d=cr(15,lot-1.5);
        const x = a ? ix1-w/2 : ix0+w/2, z = b ? iz1-d/2 : iz0+d/2;
        addTower(x,z,w,d, distHeight(x,z)+cr(0,30), (crng()*4)|0, [{nx:a?1:-1,nz:0},{nx:0,nz:b?1:-1}], crng()<.16);
      }
    }
  }
  assignShops();
  buildOuterDistricts(); buildSpaceport(); buildHorizon(); buildClouds(); buildAirTraffic();
  cityBatch.build(s);
  buildTraffic(); buildNPCs();
  city.player = makePilot(); s.add(city.player);
  buildMinimap();
}
function distHeight(x,z){ const d=Math.hypot(x,z); const base=150*Math.exp(-d/240); const r=crng(); return 14 + r*30 + base*crng() + (r>.93 ? cr(80,150) : 0); }

function addTower(cx, cz, w, d, h, style, faces, round){
  const MAT=city.mat, mat=city.facade[style];
  if(round){ const r=Math.min(w,d)/2; cityBatch.add(mat, facadeUV(gCyl(r*.92,r,h,18),0,h,0,Math.PI*2*r), cx,h/2,cz); w=d=r*2; }
  else {
    let h1=h; if(h>40 && crng()<.55) h1=h*cr(.5,.78);
    cityBatch.add(mat, facadeUV(gBox(w,h1,d),w,h1,d), cx,h1/2,cz);
    if(h1<h){ const w2=w-cr(3,7), d2=d-cr(3,7), st=crng()<.3?3:style; cityBatch.add(city.facade[st], facadeUV(gBox(w2,h-h1,d2),w2,h-h1,d2), cx,h1+(h-h1)/2,cz); }
  }
  for(let k=0;k<1+(crng()*3|0);k++) cityBatch.add(MAT.metal, gBox(cr(2,4),cr(1,2.2),cr(2,4)), cx+cr(-w/5,w/5), h+.8, cz+cr(-d/5,d/5));
  if(h>85 && crng()<.6){ const sh=cr(12,30); cityBatch.add(MAT.metal, gCyl(.3,.5,sh,6), cx,h+sh/2,cz); cityBatch.add(MAT.redLight, gBox(.9,.9,.9), cx,h+sh,cz); }
  else cityBatch.add(MAT.redLight, gBox(.6,.6,.6), cx+w*.3, h+.3, cz+d*.3);
  city.boxes.push({ x0:cx-w/2, x1:cx+w/2, z0:cz-d/2, z1:cz+d/2, h });
  for(const f of faces) addStorefront(cx,cz,w,d,f);
  if(h>55 && crng()<.4) addHolo(cx,cz,w,d,h,faces[0]);
}
function addStorefront(cx,cz,w,d,f){
  const along = f.nx ? d : w, sw = Math.min(along*.8, 14);
  const ox = cx+f.nx*w/2, oz = cz+f.nz*d/2, ry = Math.atan2(f.nx, f.nz);
  cityBatch.add(pick(city.mat.shopGlass), new THREE.PlaneGeometry(sw,3.2), ox+f.nx*.06, 1.8, oz+f.nz*.06, ry);
  cityBatch.add(pick(city.mat.awnings), gBox(sw,.15,1.6), ox+f.nx*.8, 3.7, oz+f.nz*.8, ry);
  city.shops.push({ x:ox+f.nx*1.8, z:oz+f.nz*1.8, sx:ox+f.nx*.1, sz:oz+f.nz*.1, ry, sw });
}
function addHolo(cx,cz,w,d,h,f){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(18,10), new THREE.MeshBasicMaterial({ map:pick(city.adTex), transparent:true, opacity:.85,
    blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }));
  m.position.set(cx+f.nx*(w/2+1.5), Math.min(h-8, cr(18,h*.8)), cz+f.nz*(d/2+1.5)); m.rotation.y=Math.atan2(f.nx,f.nz);
  city.scene.add(m); const ph=crng()*9;
  city.anim.push(t=>{ m.material.opacity = .72 + Math.sin(t*3+ph)*.1 - (Math.random()<.015 ? .5 : 0); });
}
function assignShops(){
  const sorted = city.shops.filter(s=>!s.name).sort((a,b)=>Math.hypot(a.x-HOME_DOOR.x,a.z-HOME_DOOR.z)-Math.hypot(b.x-HOME_DOOR.x,b.z-HOME_DOOR.z));
  FUNCTIONAL_SHOPS.forEach((f,i)=>Object.assign(sorted[i*2], f));          // espalha os comércios úteis perto de casa
  for(const s of city.shops){
    if(s.done) continue;                                                  // barracas e Bolsa já têm placa própria
    if(!s.name){ const [n,c]=pick(SHOP_NAMES); s.name=n; s.color=c; }
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(s.sw*.75,9),1.6), B(0xffffff,{map:citySign(s.name,s.color)}));
    sm.position.set(s.sx, 5.0, s.sz); sm.rotation.y=s.ry; city.scene.add(sm);
  }
}

// ---- quarteirões especiais
function buildPark(cx,cz,size){
  const MAT=city.mat;
  cityBatch.add(MAT.grass, gBox(size,.25,size), cx,.13,cz);
  cityBatch.add(MAT.concrete, gBox(size,.27,4), cx,.14,cz); cityBatch.add(MAT.concrete, gBox(4,.27,size), cx,.14,cz);
  for(let k=0;k<30;k++){
    let x,z; do{ x=cr(-size/2+3,size/2-3); z=cr(-size/2+3,size/2-3); }while(Math.abs(x)<4.5||Math.abs(z)<4.5||Math.hypot(x,z)<10);
    const th=cr(2.4,4), r=cr(1.8,3.2);
    cityBatch.add(MAT.trunk, gCyl(.2,.3,th,5), cx+x,th/2,cz+z);
    cityBatch.add(pick(MAT.leaf), new THREE.IcosahedronGeometry(r,0), cx+x,th+r*.7,cz+z);
    city.circles.push({x:cx+x,z:cz+z,r:.5});
  }
  // fonte e holo-globo
  cityBatch.add(MAT.concrete, gCyl(6,6.3,.9,20), cx,.45,cz); cityBatch.add(MAT.water, gCyl(5.5,5.5,.2,20), cx,.85,cz);
  cityBatch.add(MAT.concrete, gCyl(.6,.8,3,8), cx,1.5,cz);
  city.circles.push({x:cx,z:cz,r:6.3});
  const globe = new THREE.Mesh(new THREE.SphereGeometry(3,16,10), B(0x5ef2ff,{wireframe:true,transparent:true,opacity:.55}));
  globe.position.set(cx,7.5,cz); city.scene.add(globe); city.anim.push((t,dt)=>{ globe.rotation.y+=dt*.4; });
  // Monumento ao Êxodo
  cityBatch.add(MAT.concrete, gBox(5,1,5), cx,.5,cz-16); cityBatch.add(MAT.white, gBox(1.6,12,1.6), cx,6.5,cz-16);
  const ark = makeShip('mule'); ark.g.scale.setScalar(1.3); ark.g.position.set(cx,14.5,cz-16); ark.g.rotation.set(-.5,.6,0,'YXZ');
  ark.flames.forEach(f=>f.visible=false); ark.light.intensity=0; city.scene.add(ark.g);
  city.circles.push({x:cx,z:cz-16,r:3});
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(4,1), B(0xffffff,{map:citySign('ÊXODO · 214','#ffd27a')})); plaque.position.set(cx,2,cz-13.4); city.scene.add(plaque);
  for(const [x,z,r] of [[8,3,0],[-8,-3,Math.PI],[3,-8,Math.PI/2],[-3,8,-Math.PI/2]]){ cityBatch.add(MAT.trunk, gBox(2.4,.15,.6), cx+x,.6,cz+z, r); cityBatch.add(MAT.trunk, gBox(2.4,.6,.1), cx+x,.9,cz+z+(r===0?.3:r===Math.PI?-.3:0), r); }
}
function buildHomeTower(ix0,ix1,iz0,iz1){
  const MAT=city.mat, w=36, d=36, z0=iz0+1, cz=z0+d/2, h=150;
  cityBatch.add(city.facade[3], facadeUV(gBox(w,h,d),w,h,d), 0,h/2,cz);
  cityBatch.add(city.facade[1], facadeUV(gBox(w-8,60,d-8),w-8,60,d-8), 0,h+30,cz);
  cityBatch.add(MAT.metal, gCyl(.5,.8,40,6), 0,h+80,cz); cityBatch.add(MAT.redLight, gBox(1.2,1.2,1.2), 0,h+100,cz);
  city.boxes.push({x0:-w/2,x1:w/2,z0:z0,z1:z0+d,h:h+60});
  // entrada
  cityBatch.add(MAT.white, gBox(12,.4,4), 0,4.4,z0-1.8); cityBatch.add(MAT.lamp, gBox(11,.08,3.6), 0,4.18,z0-1.8);
  cityBatch.add(MAT.shopGlass[1], new THREE.PlaneGeometry(6,3.8), 0,1.9,z0-.04, Math.PI);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10,1.6), B(0xffffff,{map:citySign('TORRE KESSLER 07','#5ef2ff',384,64)}));
  sign.position.set(0,5.6,z0-.1); sign.rotation.y=Math.PI; city.scene.add(sign);
  const pl = new THREE.PointLight(0xffd8a0,1.2,16); pl.position.set(0,3.6,z0-3); city.scene.add(pl);
  // barracas de comida de rua
  [['RAMEN','#ffb347',-16],['ESPETINHOS','#ff7a3a',-10],['CAFÉ K7','#5ef2ff',10],['DOCES','#ff9ad8',16]].forEach(([n,c,x])=>{
    const zz=z0-1.6;
    cityBatch.add(MAT.metal, gBox(3.4,1.1,1.4), x,.65,zz); cityBatch.add(pick(MAT.awnings), gBox(3.8,.12,2.2), x,2.7,zz-.3);
    [-1.6,1.6].forEach(dx=>cityBatch.add(MAT.metal, gCyl(.05,.05,2.6,4), x+dx,1.4,zz-1.2));
    const sm=new THREE.Mesh(new THREE.PlaneGeometry(3,.7),B(0xffffff,{map:citySign(n,c,192,48)})); sm.position.set(x,3.15,zz-1.35); sm.rotation.y=Math.PI; city.scene.add(sm);
    city.boxes.push({x0:x-1.7,x1:x+1.7,z0:zz-.7,z1:zz+.7,h:3});
    city.shops.push({ x, z:zz-2, name:n, color:c, food:true, done:true });
  });
}
function buildExchange(cx,cz){
  const w=40, h=110;
  cityBatch.add(city.facade[1], facadeUV(gBox(w,h,w),w,h,w), cx,h/2,cz);
  cityBatch.add(city.facade[3], facadeUV(gCyl(12,16,30,16),0,30,0,Math.PI*32), cx,h+15,cz);
  city.boxes.push({x0:cx-w/2,x1:cx+w/2,z0:cz-w/2,z1:cz+w/2,h:h+30});
  city.tickerTex = canvasTex(1024,64,()=>{}); city.tickerTex.wrapS=THREE.RepeatWrapping;
  for(const [nx,nz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w-.2,3.2), B(0xffffff,{map:city.tickerTex}));
    m.position.set(cx+nx*(w/2+.06),14,cz+nz*(w/2+.06)); m.rotation.y=Math.atan2(nx,nz); city.scene.add(m);
  }
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(16,2.2),B(0xffffff,{map:citySign('KESSLER EXCHANGE','#ffd040',384,64)}));
  sign.position.set(cx+w/2+.1,6,cz); sign.rotation.y=Math.PI/2; city.scene.add(sign);
  city.shops.push({ x:cx+w/2+1.8, z:cz, name:'KESSLER EXCHANGE', color:'#ffd040', msg:'Bolsa de Valores de Nova Kessler — o pregão abre em breve.', done:true });
}
function drawTicker(t){
  if(!city.tickerTex) return;
  const {g}=city.tickerTex.userData, items=['VXR 1.204 ▲2,1%','OSK 884 ▼0,7%','AUR 3.310 ▲0,4%','KSL 512 ▲5,2%','SUCATA ₢12 ●','NEO 77 ▼1,9%','ÊXO 1.000 ▲0,1%'];
  g.fillStyle='#050302'; g.fillRect(0,0,1024,64); g.font='bold 34px "Courier New",monospace'; g.textBaseline='middle';
  let x = -((t*80)%1200);
  for(let rep=0;rep<3;rep++) for(const it of items){ g.fillStyle = it.includes('▼')?'#ff4a4a':it.includes('▲')?'#7dff9a':'#ffd040'; g.fillText(it,x,34); x+=g.measureText(it).width+40; }
  city.tickerTex.needsUpdate=true;
}
function buildHangar(ix0,ix1,iz0,iz1){
  const MAT=city.mat, H=22, xb=ix1-1, zs=(iz1-iz0)/2;
  cityBatch.add(MAT.concrete, gBox(ix1-ix0,.3,iz1-iz0), (ix0+ix1)/2,.15,0);
  const padTex = canvasTex(256,256,(g)=>{ g.fillStyle='#3a3a3e'; g.fillRect(0,0,256,256); g.strokeStyle='#e8c040'; g.lineWidth=10; g.beginPath(); g.arc(128,128,110,0,Math.PI*2); g.stroke();
    g.lineWidth=3; g.beginPath(); g.arc(128,128,90,0,Math.PI*2); g.stroke(); g.fillStyle='#e8c040'; g.font='bold 110px "Courier New",monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('07',128,132); });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(34,34), M(0xffffff,{map:padTex,flatShading:false})); pad.rotation.x=-Math.PI/2; pad.position.set(HANGAR_PAD.x,.32,0); city.scene.add(pad);
  // paredes (sem teto: baía de lançamento aberta)
  cityBatch.add(MAT.hangar, gBox(1.5,H,iz1-iz0), xb,H/2,0); city.boxes.push({x0:xb-.75,x1:xb+.75,z0:iz0,z1:iz1,h:H});
  for(const s of [-1,1]){ const z=s*(zs-.75); cityBatch.add(MAT.hangar, gBox(ix1-ix0,H,1.5), (ix0+ix1)/2,H/2,z); city.boxes.push({x0:ix0,x1:ix1,z0:z-.75,z1:z+.75,h:H});
    for(let k=0;k<5;k++) cityBatch.add(MAT.yellow, gBox(3,.5,.1), ix0+6+k*8, 2, z-s*.8); }
  cityBatch.add(MAT.hangar, gBox(1.5,4,iz1-iz0), ix0+.75,H-2,0);
  cityBatch.add(MAT.lamp, gBox(.2,.3,iz1-iz0-4), xb-.8,H-3,0);
  // pórtico/guindaste
  for(const s of [-1,1]) cityBatch.add(MAT.yellow, gBox(1.2,26,1.2), HANGAR_PAD.x+8, 13, s*(zs-3));
  cityBatch.add(MAT.yellow, gBox(1.6,1.6,iz1-iz0-4), HANGAR_PAD.x+8, 26, 0);
  cityBatch.add(MAT.dark, gBox(3,2,3), HANGAR_PAD.x+8, 24.6, 4);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(20,2.6),B(0xffffff,{map:citySign('HANGAR 07 · DOCAS ORBITAIS','#ff7a3a',512,64)}));
  sign.position.set(ix0-.05,H-2,0); sign.rotation.y=-Math.PI/2; city.scene.add(sign);
  const pl=new THREE.PointLight(0xfff0d0,1.4,60); pl.position.set(HANGAR_PAD.x,18,0); city.scene.add(pl);
  city.circles.push({x:HANGAR_PAD.x,z:0,r:6});
}
function buildPortBlock(cx,cz,tower){
  const MAT=city.mat;
  if(tower){
    cityBatch.add(MAT.white, gCyl(3.5,4.5,40,10), cx-10,20,cz); cityBatch.add(city.facade[1], facadeUV(gCyl(7,5,6,12),0,6,0,44), cx-10,43,cz);
    cityBatch.add(MAT.white, gCyl(7.5,7.5,1,12), cx-10,46.5,cz);
    const dish=new THREE.Group(); dish.position.set(cx-10,49,cz); const d=cyl(3,.4,1.2,10,MAT.white); d.rotation.x=Math.PI/2.5; dish.add(d); city.scene.add(dish);
    city.anim.push((t,dt)=>{ dish.rotation.y+=dt*.8; });
    city.circles.push({x:cx-10,z:cz,r:4.6});
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(9,1.4),B(0xffffff,{map:citySign('CONTROLE ORBITAL','#5ef2ff')})); sign.position.set(cx-10,36,cz+4.7); city.scene.add(sign);
  }
  for(let k=0;k<3;k++){ const x=cx+(tower?6:-12)+k*0, z=cz-12+k*12; cityBatch.add(MAT.tank, gCyl(5,5,14,14), x,7,z); cityBatch.add(MAT.yellow, gCyl(5.05,5.05,1,14), x,9,z); city.circles.push({x,z,r:5.2}); }
}

// ---- além do centro: distritos, espaçoporto, horizonte, nuvens
function buildOuterDistricts(){
  const tex = canvasTex(64,64,(g)=>{ g.fillStyle='#6a6a70'; g.fillRect(0,0,64,64); g.fillStyle='#2a3038'; for(let x=0;x<4;x++)for(let y=0;y<8;y++) g.fillRect(x*16+4,y*8+2,9,4); });
  const emi = canvasTex(64,64,(g)=>{ g.fillStyle='#000'; g.fillRect(0,0,64,64); for(let x=0;x<4;x++)for(let y=0;y<8;y++) if(Math.random()<.45){ g.fillStyle=pick(['#ffd9a0','#a0e8ff','#ffb070']); g.fillRect(x*16+4,y*8+2,9,4); } });
  const geom = gBox(1,1,1); geom.translate(0,.5,0);
  const list=[];
  for(let x=-1600;x<=1600;x+=46) for(let z=-1600;z<=1600;z+=46){
    const r=Math.hypot(x,z); if(r<CITY_EXT+60 || r>1650) continue;
    if(x>CITY_EXT && Math.abs(z)<380) continue;                        // espaçoporto
    if(crng()<.3) continue;
    const near=Math.exp(-(r-260)/700);
    list.push([x+cr(-6,6), z+cr(-6,6), cr(18,34), 15+crng()*crng()*170*near + (crng()<.04?cr(100,220):0), cr(18,34)]);
  }
  const mesh = new THREE.InstancedMesh(geom, new THREE.MeshStandardMaterial({map:tex, emissiveMap:emi, emissive:0xffffff, emissiveIntensity:.8, roughness:.8}), list.length);
  const m=new THREE.Matrix4(), q=new THREE.Quaternion(), c=new THREE.Color();
  list.forEach(([x,z,w,h,d],i)=>{ m.compose(new V3(x,0,z), q, new V3(w,h,d)); mesh.setMatrixAt(i,m); c.setHSL(cr(.05,.62),cr(.05,.2),cr(.55,.9)); mesh.setColorAt(i,c); });
  city.scene.add(mesh);
}
function buildSpaceport(){
  const MAT=city.mat, padTex = canvasTex(128,128,(g)=>{ g.fillStyle='#3e3e42'; g.fillRect(0,0,128,128); g.strokeStyle='#e8c040'; g.lineWidth=5; g.beginPath(); g.arc(64,64,54,0,Math.PI*2); g.stroke(); g.strokeStyle='#d8d8d0'; g.lineWidth=2; g.strokeRect(6,6,116,116); });
  const padMat = M(0xffffff,{map:padTex, flatShading:false});
  for(let k=0;k<6;k++){
    const x=400+(k%3)*160, z=(k<3?-1:1)*150;
    const p=new THREE.Mesh(new THREE.PlaneGeometry(110,110),padMat); p.rotation.x=-Math.PI/2; p.position.set(x,.05,z); city.scene.add(p);
    if(k%2===0){ const sh=makeShip(k%4===0?'mule':'kestrel'); sh.g.scale.setScalar(k%4===0?9:6); sh.g.position.set(x,k%4===0?7:3,z); sh.g.rotation.y=crng()*6; sh.flames.forEach(f=>f.visible=false); sh.light.intensity=0; city.scene.add(sh.g); }
  }
  for(let k=0;k<8;k++){ cityBatch.add(MAT.lamp, gBox(1.2,1.2,1.2), 300+k*60, 1, -260); cityBatch.add(MAT.lamp, gBox(1.2,1.2,1.2), 300+k*60, 1, 260); }
}
function buildHorizon(){
  const s=city.scene;
  // arcologias gigantes no horizonte
  const arcTex = canvasTex(64,64,(g)=>{ g.fillStyle='#4a4e58'; g.fillRect(0,0,64,64); g.fillStyle='#22262e'; for(let y=0;y<16;y++) g.fillRect(0,y*4+1,64,2); });
  const arcEmi = canvasTex(64,64,(g)=>{ g.fillStyle='#000'; g.fillRect(0,0,64,64); for(let y=0;y<16;y++) for(let x=0;x<16;x++) if(Math.random()<.3){ g.fillStyle=pick(['#ffcf90','#90e0ff']); g.fillRect(x*4,y*4+1,3,2); } });
  [arcTex,arcEmi].forEach(t=>{ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(10,40); });
  const arcMat = new THREE.MeshStandardMaterial({map:arcTex, emissiveMap:arcEmi, emissive:0xffffff, emissiveIntensity:.9, roughness:.7});
  for(let k=0;k<14;k++){
    const a=crng()*Math.PI*2; if(Math.cos(a)>.85) continue;
    const r=cr(2600,8000), x=Math.cos(a)*r, z=Math.sin(a)*r, h=cr(700,2400), w=cr(140,380);
    const tw = new THREE.Mesh(gCyl(w*.45,w,h,8), arcMat); tw.position.set(x,h/2,z); s.add(tw);
    const tw2 = new THREE.Mesh(gCyl(w*.15,w*.4,h*.35,8), arcMat); tw2.position.set(x,h+h*.175,z); s.add(tw2);
    const lt = new THREE.Mesh(gBox(20,20,20), city.mat.redLight); lt.position.set(x,h*1.35+10,z); s.add(lt);
  }
  // elevador espacial: um cabo até a órbita
  const ex=-5200, ez=-7400;
  const tether = new THREE.Mesh(gCyl(14,14,30000,8), M(0x8a8e98,{emissive:0x10203a, flatShading:false})); tether.position.set(ex,15000,ez); s.add(tether);
  const baseC = new THREE.Mesh(gCyl(90,400,700,12), M(0x6a6e78)); baseC.position.set(ex,350,ez); s.add(baseC);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(260,30,8,32), M(0x9a9ea8,{emissive:0x202838})); ring.position.set(ex,9000,ez); ring.rotation.x=Math.PI/2; s.add(ring);
  for(let k=1;k<12;k++){ const b=new THREE.Mesh(gBox(40,40,40), B(0x7ff6ff)); b.position.set(ex,k*2400,ez); s.add(b); }
  // montanhas
  city.mountains = [];
  for(let k=0;k<40;k++){
    const a=k/40*Math.PI*2+cr(-.05,.05), r=cr(12000,17000), h=cr(1500,4200);
    const m = new THREE.Mesh(new THREE.ConeGeometry(cr(2200,4200),h,6), M(pick([0x5a6878,0x4e5a6a,0x6a7484]))); m.position.set(Math.cos(a)*r,h/2-200,Math.sin(a)*r); m.rotation.y=crng()*6; s.add(m); city.mountains.push(m);
  }
}
function buildClouds(){
  const tex = canvasTex(128,64,(g)=>{ for(let i=0;i<14;i++){ const x=rand(24,104), y=rand(22,42), r=rand(12,26); const rg=g.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0,'rgba(255,255,255,.85)'); rg.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=rg; g.fillRect(0,0,128,64); } });
  for(let k=0;k<90;k++){
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, color:pick([0xffe0d0,0xffd0c0,0xf0d8e0]), transparent:true, opacity:.85, depthWrite:false}));
    const a=crng()*Math.PI*2, r=crng()<.25?cr(0,600):cr(600,9000);
    sp.position.set(HANGAR_PAD.x+Math.cos(a)*r, cr(1400,2700), Math.sin(a)*r); sp.scale.set(cr(700,1500),cr(260,520),1); city.scene.add(sp);
  }
}
function buildAirTraffic(){
  for(let k=0;k<26;k++){
    const g=makeHover(pick([0xb04a2a,0x2a6a8a,0xd8d8d0,0x3a3a44,0xc8a040,0x6a2a6a]));
    const axis=crng()<.5?'x':'z', dir=crng()<.5?1:-1, alt=pick([55,95,140])+cr(-4,4), off=cr(-500,500), s0=cr(-1500,1500);
    g.rotation.y = axis==='x' ? (dir>0?-Math.PI/2:Math.PI/2) : (dir>0?Math.PI:0);
    city.scene.add(g); city.air.push({g,axis,dir,alt,off,s:s0,v:cr(35,70),span:1500});
  }
  for(let k=0;k<3;k++){
    const sh=makeShip('mule'); sh.g.scale.setScalar(26); city.scene.add(sh.g);
    const axis=k%2?'x':'z', dir=k===1?-1:1;
    sh.g.rotation.y = axis==='x' ? (dir>0?-Math.PI/2:Math.PI/2) : (dir>0?Math.PI:0);
    city.air.push({g:sh.g,axis,dir,alt:cr(600,950),off:cr(-1500,1500),s:cr(-5000,5000),v:cr(22,32),span:6000});
  }
}

// ---------------------------------------------------------------- trânsito e pedestres
function laneOf(t){ return t.axis==='x' ? { x:t.s, z:t.line + t.dir*3.2 } : { x:t.line - t.dir*3.2, z:t.s }; }
function buildTraffic(){
  const kinds=['coupe','coupe','coupe','van','van','truck','bike'];
  for(let k=0;k<34;k++){
    const kind=pick(kinds), c=makeCar(kind, pick([0xb04a2a,0x2a6a8a,0xd8d8d0,0x1a1a1e,0xc8a040,0x6a2a6a,0x3a6a3a,0xe0e0e8]), crng()<.4?pick([0x5ef2ff,0xff4ab0,0xffb347]):null);
    const t = { ...c, axis:crng()<.5?'x':'z', dir:crng()<.5?1:-1, line:cityLine((crng()*(CITY.N+1))|0), s:cr(-CITY_EXT,CITY_EXT), v:0, vmax:cr(9,15) };
    t.g.rotation.y = t.axis==='x' ? (t.dir>0?-Math.PI/2:Math.PI/2) : (t.dir>0?Math.PI:0);
    city.scene.add(t.g); city.traffic.push(t);
  }
}
function updateTraffic(dt){
  const P = city.drive ? city.drive.g.position : city.player.position, cam=city.cam.position, lim=CITY_EXT+40;
  for(const t of city.traffic){
    let want = t.vmax;
    const pos = laneOf(t);
    for(const o of city.traffic){ if(o===t || o.axis!==t.axis || o.line!==t.line || o.dir!==t.dir) continue; const ahead=(o.s-t.s)*t.dir; if(ahead>0 && ahead<11) want=Math.min(want,(ahead-6)*1.5); }
    const lat = t.axis==='x' ? Math.abs(P.z-pos.z) : Math.abs(P.x-pos.x), ahead = (t.axis==='x' ? P.x-pos.x : P.z-pos.z)*t.dir;
    if(lat<2.6 && ahead>0 && ahead<13) want=0;
    want=Math.max(0,want); t.v += clamp(want-t.v, -14*dt, 5*dt);
    t.s += t.v*t.dir*dt;
    if(t.s>lim) t.s=-lim; if(t.s<-lim) t.s=lim;
    const p=laneOf(t); t.g.position.set(p.x,0,p.z);
    t.g.visible = Math.abs(p.x-cam.x)<260 && Math.abs(p.z-cam.z)<260 && cam.y<600;
    if(t.g.visible) for(const w of t.wheels) w.rotation.x -= t.v*dt/w.userData.r;
  }
}
function buildNPCs(){
  for(let k=0;k<70;k++){
    let i,j; do{ i=(crng()*CITY.N)|0; j=(crng()*CITY.N)|0; }while(i===6 && j===3);
    const r=crng(), sp = r<.6?'human':r<.82?'vexari':'oskari';
    const g=makeNPC(sp); city.scene.add(g);
    const x0=cityLine(i)+CITY.ROAD/2+2.6, x1=cityLine(i+1)-CITY.ROAD/2-2.6, z0=cityLine(j)+CITY.ROAD/2+2.6, z1=cityLine(j+1)-CITY.ROAD/2-2.6;
    city.npcs.push({ g, x0,x1,z0,z1, len:(x1-x0)*4, p:cr(0,(x1-x0)*4), dir:crng()<.5?1:-1, v:sp==='oskari'?cr(.9,1.2):cr(1.1,1.7), wait:0, ph:crng()*6, sp });
  }
}
function npcPos(n){ const L=n.x1-n.x0, p=((n.p%n.len)+n.len)%n.len;
  if(p<L) return [n.x0+p, n.z0]; if(p<2*L) return [n.x1, n.z0+p-L]; if(p<3*L) return [n.x1-(p-2*L), n.z1]; return [n.x0, n.z1-(p-3*L)]; }
function updateNPCs(dt,t){
  const P = city.drive ? city.drive.g.position : city.player.position, cam=city.cam.position;
  for(const n of city.npcs){
    const [px,pz] = npcPos(n);
    const near = Math.hypot(px-cam.x, pz-cam.z) < 170 && cam.y<400;
    n.g.visible = near;
    const dP = Math.hypot(px-P.x, pz-P.z);
    if(n.wait>0) n.wait-=dt; else if(dP > (city.drive?3.2:1.1)){ n.p += n.v*n.dir*dt; if(Math.random()<.0015) n.wait=rand(1,4); if(Math.random()<.0004) n.dir*=-1; }
    if(!near) continue;
    const [nx,nz] = npcPos(n);
    n.g.position.set(nx,.2,nz);
    const [ax,az] = npcPos({...n, p:n.p+n.dir*.5});
    n.g.rotation.y = Math.atan2(ax-nx, az-nz);
    const sw = n.wait>0||dP<1.2 ? 0 : Math.sin(t*n.v*5+n.ph)*.5;
    n.g.userData.legL.rotation.x=sw; n.g.userData.legR.rotation.x=-sw;
  }
}
function updateAir(dt){
  for(const a of city.air){
    a.s += a.v*a.dir*dt; if(a.s>a.span) a.s=-a.span; if(a.s<-a.span) a.s=a.span;
    if(a.axis==='x') a.g.position.set(a.s,a.alt,a.off); else a.g.position.set(a.off,a.alt,a.s);
  }
}

// ---------------------------------------------------------------- jogador: colisão e câmera
function cityCollide(pos, r){
  let hit=false;
  for(const b of city.boxes){
    if(pos.x>b.x0-r && pos.x<b.x1+r && pos.z>b.z0-r && pos.z<b.z1+r){
      const l=pos.x-(b.x0-r), rr=(b.x1+r)-pos.x, t=pos.z-(b.z0-r), bt=(b.z1+r)-pos.z, m=Math.min(l,rr,t,bt);
      if(m===l) pos.x=b.x0-r; else if(m===rr) pos.x=b.x1+r; else if(m===t) pos.z=b.z0-r; else pos.z=b.z1+r; hit=true;
    }
  }
  for(const c of city.circles){ const dx=pos.x-c.x, dz=pos.z-c.z, d=Math.hypot(dx,dz), m=c.r+r; if(d<m && d>1e-4){ pos.x=c.x+dx/d*m; pos.z=c.z+dz/d*m; hit=true; } }
  if(Math.abs(pos.x)>1500 || Math.abs(pos.z)>1500){ pos.x=clamp(pos.x,-1500,1500); pos.z=clamp(pos.z,-1500,1500); hit=true; }
  return hit;
}
function insideBox(x,y,z,m){ for(const b of city.boxes) if(x>b.x0-m && x<b.x1+m && z>b.z0-m && z<b.z1+m && y<b.h+m) return true; return false; }
const _ccf = new V3();
function cityThirdPerson(target, yaw, pitch, dist){
  _ccf.set(Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), Math.cos(yaw)*Math.cos(pitch));
  let d=.5; while(d<dist){ const n=d+.25, x=target.x+_ccf.x*n, y=target.y+_ccf.y*n, z=target.z+_ccf.z*n; if(y<.35 || insideBox(x,y,z,.25)) break; d=n; }
  city.cam.position.set(target.x+_ccf.x*d, target.y+_ccf.y*d, target.z+_ccf.z*d); city.cam.lookAt(target);
}
function cityFirstPerson(x,y,z,yaw,pitch){
  _ccf.set(Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), Math.cos(yaw)*Math.cos(pitch));
  city.cam.position.set(x,y,z); city.cam.lookAt(x-_ccf.x, y-_ccf.y, z-_ccf.z);
}

function updateWalk(dt,t){
  const p=city.player; let mx=0, mz=0;
  if(!ui.panel){ if(keys.KeyW||keys.ArrowUp) mz+=1; if(keys.KeyS||keys.ArrowDown) mz-=1; if(keys.KeyA||keys.ArrowLeft) mx-=1; if(keys.KeyD||keys.ArrowRight) mx+=1; }
  const fx=-Math.sin(city.yaw), fz=-Math.cos(city.yaw), rx=Math.cos(city.yaw), rz=-Math.sin(city.yaw);
  let vx=fx*mz+rx*mx, vz=fz*mz+rz*mx; const len=Math.hypot(vx,vz);
  if(len>0){ vx/=len; vz/=len; const sp=(keys.ShiftLeft?7:4)*dt; p.position.x+=vx*sp; p.position.z+=vz*sp;
    if(!settings.fp) p.rotation.y = lerpAngle(p.rotation.y, Math.atan2(vx,vz), Math.min(1,12*dt)); city.walk += dt*(keys.ShiftLeft?15:10); }
  else city.walk*=.85;
  cityCollide(p.position,.4);
  const onWalk = isOnSidewalk(p.position.x,p.position.z); p.position.y = onWalk ? .2 : 0;
  const sw=Math.sin(city.walk)*.6*(len>0?1:0); p.userData.legL.rotation.x=sw; p.userData.legR.rotation.x=-sw;
  p.visible=!settings.fp;
  if(settings.fp){ p.rotation.y=city.yaw+Math.PI; const bob=Math.sin(city.walk*2)*.03*(len>0?1:0); cityFirstPerson(p.position.x,p.position.y+1.72+bob,p.position.z,city.yaw,city.pitch); }
  else cityThirdPerson(_ct.set(p.position.x,p.position.y+1.6,p.position.z), city.yaw, city.pitch, 4.6);
  // interação
  let best=null, bd=99;
  for(const it of cityInteractables()){ const d=Math.hypot(it.pos.x-p.position.x, it.pos.z-p.position.z); if(d<it.r && d<bd){ bd=d; best=it; } }
  city.near=best; setPrompt(ui.panel?'':(best?best.label:''));
}
function isOnSidewalk(x,z){
  const ax=Math.abs(((x+CITY_EXT)%CITY.P+CITY.P)%CITY.P - 0), az=Math.abs(((z+CITY_EXT)%CITY.P+CITY.P)%CITY.P - 0);
  const inX = ax>CITY.ROAD/2 && ax<CITY.P-CITY.ROAD/2, inZ = az>CITY.ROAD/2 && az<CITY.P-CITY.ROAD/2;
  return inX && inZ && Math.abs(x)<CITY_EXT && Math.abs(z)<CITY_EXT;
}
function cityInteractables(){
  const L=[ { pos:HOME_DOOR, r:3.2, label:'[E] Entrar — Torre Kessler 07 (apartamento)', fn:()=>goHub() } ];
  for(const id in city.vehicles){ const v=city.vehicles[id]; L.push({ pos:v.g.position, r:v.def.kind==='truck'?3.8:3.1, label:`[E] Dirigir — ${v.def.name}`, fn:()=>enterVehicle(id) }); }
  L.push({ pos:HANGAR_PAD, r:15, label:`[E] Embarcar — ${SHIPS[activeShip().model].name} · decolar para a órbita`, fn:startLaunch });
  for(const s of city.shops) L.push({ pos:s, r:2.6, label: s.act?`[E] ${s.name} — ${s.actLabel}` : `[E] ${s.name}`, fn:()=>shopAct(s) });
  return L;
}
function shopAct(s){
  if(s.act) return openPanel(s.act[0], s.act[1]);
  if(s.msg) return toast(s.msg, s.color);
  if(s.food) return toast(`${s.name}: "Volte mais tarde, a chapa ainda está esquentando."`, s.color);
  toast(`${s.name} — fechado por enquanto`, s.color);
}
function cityInteract(){
  if(city.launch) return;
  if(city.drive) return exitVehicle();
  if(city.near) city.near.fn();
}

// ---------------------------------------------------------------- veículos do jogador
function syncCityVehicles(){
  for(const id of state.vehicles){
    if(city.vehicles[id]) continue;
    const def=VEHICLES[id], c=makeCar(def.kind, def.color, def.glow), k=state.vehicles.indexOf(id);
    const sv = state.vpos[id], spot = PARK_SPOTS[k%PARK_SPOTS.length];
    c.g.position.set(sv?sv.x:spot[0], 0, sv?sv.z:spot[1]); c.yaw = sv?sv.yaw:-Math.PI/2; c.g.rotation.y=c.yaw;
    city.scene.add(c.g); city.vehicles[id] = Object.assign(c, { id, def, speed:0, steer:0 });
  }
}
let eng=null;
function engineStart(kind){
  if(!actx || eng) return;
  const o=actx.createOscillator(), o2=actx.createOscillator(), f=actx.createBiquadFilter(), g=actx.createGain();
  o.type = kind==='bike'?'triangle':'sawtooth'; o2.type='square'; f.type='lowpass'; f.frequency.value=400; g.gain.value=0;
  o.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus); o.start(); o2.start();
  g.gain.setTargetAtTime(.045, actx.currentTime, .2); eng={o,o2,g,f,bike:kind==='bike'};
}
function engineUpdate(r){ if(!eng) return; const base=eng.bike?90:42, fr=base+r*(eng.bike?260:120), t=actx.currentTime;
  eng.o.frequency.setTargetAtTime(fr,t,.05); eng.o2.frequency.setTargetAtTime(fr*.5,t,.05); eng.f.frequency.setTargetAtTime(300+r*1100,t,.05); }
function engineStop(){ if(!eng) return; const e=eng; eng=null; e.g.gain.setTargetAtTime(0, actx.currentTime, .12); setTimeout(()=>{ try{ e.o.stop(); e.o2.stop(); }catch(_){} }, 700); }
function enterVehicle(id){
  const v=city.vehicles[id]; city.drive=v; city.player.visible=false; city.camOff=0; city.pitch=.16;
  engineStart(v.def.kind); sfx.door(); setHelp(); toast(`${v.def.name} · W/S acelerar e frear · A/D virar · E sair`, '#5ef2ff');
}
function exitVehicle(){
  const v=city.drive; if(Math.abs(v.speed)>3){ toast('Pare o veículo para sair', '#ff4a4a'); sfx.error(); return; }
  const rx=Math.cos(v.yaw), rz=-Math.sin(v.yaw), p=city.player.position;
  p.set(v.g.position.x-rx*2.3, 0, v.g.position.z-rz*2.3); if(cityCollide(p,.4)) p.set(v.g.position.x+rx*2.3,0,v.g.position.z+rz*2.3);
  cityCollide(p,.4); city.player.rotation.y = v.yaw+Math.PI; city.yaw = v.yaw+city.camOff;
  v.speed=0; state.vpos[v.id]={ x:v.g.position.x, z:v.g.position.z, yaw:v.yaw }; save();
  city.drive=null; engineStop(); setHelp(); sfx.door();
}
function updateDrive(dt,t){
  const v=city.drive, d=v.def, inp=!ui.panel;
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
  const fx=-Math.sin(v.yaw), fz=-Math.cos(v.yaw), P=v.g.position;
  P.x += fx*v.speed*dt; P.z += fz*v.speed*dt;
  if(cityCollide(P, d.kind==='bike'?.7:d.kind==='truck'?1.7:1.4) && Math.abs(v.speed)>2){
    if(Math.abs(v.speed)>8){ noise({dur:.25,vol:.3,freq:500}); city.shake=.4; } v.speed*=-.25; }
  for(const o of city.traffic){ const dx=P.x-o.g.position.x, dz=P.z-o.g.position.z, dd=Math.hypot(dx,dz);
    if(dd<3 && dd>1e-3){ P.x=o.g.position.x+dx/dd*3; P.z=o.g.position.z+dz/dd*3; if(Math.abs(v.speed)>6) noise({dur:.2,vol:.25,freq:600}); v.speed*=.4; o.v=0; } }
  for(const n of city.npcs){ if(!n.g.visible) continue; const q=n.g.position, dx=q.x-P.x, dz=q.z-P.z, dd=Math.hypot(dx,dz);
    if(dd<2.4){ n.p += n.dir*2; n.wait=0; } }
  v.g.rotation.y=v.yaw; P.y=0;
  v.body.rotation.z = -v.steer*sr*(d.kind==='bike'?.45:.06);
  v.body.rotation.x = clamp((thr?-.02:0)+(brk&&v.speed>0?.03:0),-.05,.05);
  for(const w of v.wheels) w.rotation.x -= v.speed*dt/w.userData.r;
  engineUpdate(sr);
  // câmera
  city.lookT -= dt; if(city.lookT<0 && Math.abs(v.speed)>3) city.camOff *= Math.exp(-2*dt);
  const camYaw = v.yaw+city.camOff;
  if(settings.fp){ const rx=Math.cos(v.yaw), rz=-Math.sin(v.yaw), side=d.kind==='bike'?0:-.4, up=d.kind==='truck'?2.1:d.kind==='bike'?1.7:1.25;
    cityFirstPerson(P.x+rx*side-fx*.2, up, P.z+rz*side-fz*.2, camYaw, city.pitch); }
  else cityThirdPerson(_ct.set(P.x,1.5,P.z), camYaw, city.pitch, d.kind==='truck'?9:d.kind==='bike'?5.5:7.5);
  if(city.shake>0){ city.cam.position.x+=rand(-1,1)*city.shake*.2; city.cam.position.y+=rand(-1,1)*city.shake*.2; city.shake*=Math.exp(-6*dt); }
  setPrompt(ui.panel?'':(Math.abs(v.speed)<3?'[E] Sair do veículo':''));
}

// ---------------------------------------------------------------- hangar e decolagem
function syncHangarShip(){
  const m=activeShip().model;
  if(!city.ship || city.shipModel!==m){ if(city.ship) city.scene.remove(city.ship.g); city.ship=makeShip(m); city.ship.g.scale.setScalar(2.2); city.scene.add(city.ship.g); city.shipModel=m; }
  const s=city.ship; s.g.position.set(HANGAR_PAD.x, m==='mule'?2.2:1.7, HANGAR_PAD.z); s.g.rotation.set(0,Math.PI/2,0,'YXZ');
  s.flames.forEach(f=>f.scale.set(1,.15,1)); s.light.intensity=.2; s.model.visible=true;
}
function setAtmos(k, alt=0){
  const high = alt>3500;
  city.terrain.visible = !high; city.mountains.forEach(m=>m.visible=!high); city.globe.visible = alt>2500;
  const dark = new THREE.Color(0x05060c);
  city.skyMat.color.setRGB(1,1,1).lerp(dark, Math.pow(k,.6));
  city.scene.fog.color.copy(city.fogColor).lerp(dark, Math.pow(k,.5)); city.scene.background.copy(city.scene.fog.color);
  city.scene.fog.density = .00011*Math.pow(1-k,2.2) + .0000025;
  city.stars.material.opacity = clamp((k-.25)/.5,0,1);
  city.sun.material.opacity = 1-k*.3;
}
function startLaunch(){
  if(city.launch) return;
  syncHangarShip(); city.launch = { t:0, alt:0, v:0, done:false };
  city.player.visible=false; setPrompt(''); setHelp();
  document.getElementById('alt').style.display='block';
  ['minimap','loc','mk-home','mk-hangar'].forEach(id=>document.getElementById(id).style.display='none');
  noise({dur:5,vol:.35,freq:220}); tone({type:'sawtooth',f0:40,f1:120,dur:5,vol:.12});
  toast('Sequência de decolagem iniciada · [Enter] pular', '#ffb347');
}
function updateLaunch(dt,t){
  const L=city.launch, s=city.ship, P=HANGAR_PAD; L.t+=dt; const lt=L.t;
  const ACC=190, T0=3.2;
  if(lt<T0){ const k=lt/T0; L.alt = (k*k*(3-2*k))*28; L.v=0; }
  else { const u=lt-T0; L.alt = 28 + .5*ACC*u*u; L.v = ACC*u; }
  if(L.skip) L.alt = Math.max(L.alt, 21500);
  const pitch = lt<T0 ? 0 : Math.min(1,(lt-T0)/2.2)*Math.PI/2;
  s.g.position.set(P.x - Math.sin(pitch)*Math.min(L.alt*.02,60), (city.shipModel==='mule'?2.2:1.7)+L.alt, P.z);
  s.g.rotation.set(pitch, Math.PI/2, 0, 'YXZ');
  s.flames.forEach(f=>f.scale.set(1, .6+Math.min(lt,5)*.9+Math.random()*.4, 1)); s.light.intensity=2.5;
  if(lt>T0 && !L.boom){ L.boom=true; noise({dur:8,vol:.5,freq:160}); tone({type:'sawtooth',f0:60,f1:300,dur:8,vol:.12}); }
  const k = clamp(L.alt/21000,0,1); setAtmos(k, L.alt);
  // câmera
  const sp=s.g.position;
  if(lt<4){ city.cam.position.set(P.x-36, 7, P.z+26); city.cam.lookAt(sp); }
  else { const g=1+Math.min(L.alt/2000,6), u=clamp((L.alt-1500)/6000,0,1), up=-26+(44*u*u*(3-2*u));   // de baixo -> por cima (planeta ao fundo)
    city.cam.position.set(sp.x-38*g, sp.y+up*g, sp.z+30*g); city.cam.lookAt(sp); }
  if(lt<9){ const sh=(lt<T0?.15:.5)*(1-lt/9); city.cam.position.x+=rand(-1,1)*sh; city.cam.position.y+=rand(-1,1)*sh; }
  const phase = L.alt<300?'IGNIÇÃO · DECOLAGEM' : L.alt<2800?'ATRAVESSANDO NUVENS' : L.alt<12000?'TROPOSFERA' : L.alt<20000?'ESTRATOSFERA':'SAÍDA DA ATMOSFERA';
  document.getElementById('alt').innerHTML = `<div style="font-size:30px;color:var(--cyan)">${phase}</div>ALTITUDE <b>${Math.round(L.alt).toLocaleString('pt-BR')} m</b> · VELOCIDADE <b>${Math.round(L.v*3.6).toLocaleString('pt-BR')} km/h</b>`;
  if(L.alt>=21000 && !L.done){ L.done=true; sfx.jump(); transition(()=>reachOrbit(), true); }
}
function endLaunch(){ city.launch=null; document.getElementById('alt').style.display='none'; setAtmos(0); syncHangarShip(); }

// ---------------------------------------------------------------- entrada na cidade, HUD e minimapa
function cityPlace(where){
  syncCityVehicles(); syncHangarShip(); setAtmos(0); city.drive=null; engineStop();
  const p=city.player; p.visible=!settings.fp;
  if(where==='hangar'){ p.position.set(HANGAR_PAD.x-12,.3,6); city.yaw=-Math.PI/2-.4; p.rotation.y=Math.PI/2; }
  else { p.position.set(HOME_DOOR.x,.2,HOME_DOOR.z-2.5); city.yaw=0; p.rotation.y=Math.PI; }
  city.pitch = settings.fp?0:.2;
}
function buildMinimap(){
  const S=700, sc=S/1400, c=document.createElement('canvas'); c.width=c.height=S; const g=c.getContext('2d');
  const X=x=>(x+700)*sc;
  g.fillStyle='#3a4a34'; g.fillRect(0,0,S,S);
  g.fillStyle='#3a3a40'; g.fillRect(X(-1600),X(-1600),3200*sc,3200*sc);
  g.fillStyle='#55555e'; for(let x=-700;x<700;x+=46) for(let z=-700;z<700;z+=46){ const r=Math.hypot(x,z); if(r>CITY_EXT+60 && !(x>CITY_EXT && Math.abs(z)<380)) g.fillRect(X(x-10),X(z-10),20*sc,20*sc); }
  g.fillStyle='#22222a'; g.fillRect(X(-CITY_EXT-8),X(-CITY_EXT-8),(2*CITY_EXT+16)*sc,(2*CITY_EXT+16)*sc);
  for(let i=0;i<CITY.N;i++) for(let j=0;j<CITY.N;j++){
    const x0=cityLine(i)+CITY.ROAD/2, z0=cityLine(j)+CITY.ROAD/2, sz=CITY.P-CITY.ROAD;
    g.fillStyle = (i===3&&j===3)?'#3a7a3a' : (i===6&&j===3)?'#2a5a7a' : (i===3&&j===4)?'#5a7a8a' : '#6a6870';
    g.fillRect(X(x0),X(z0),sz*sc,sz*sc);
  }
  g.fillStyle='#4a4a52'; g.fillRect(X(CITY_EXT+20),X(-380),(1400)*sc,760*sc);
  city.mapCanvas=c;
}
function drawMinimap(){
  const mm=document.getElementById('minimap'), g=mm.getContext('2d'), W=mm.width, R=170, sc=700/1400;
  const P = city.drive ? city.drive.g.position : city.player.position;
  g.save(); g.clearRect(0,0,W,W); g.beginPath(); g.arc(W/2,W/2,W/2-2,0,Math.PI*2); g.clip();
  g.fillStyle='#2a3a28'; g.fillRect(0,0,W,W);
  const sx=(P.x+700)*sc - R*sc, sz=(P.z+700)*sc - R*sc;
  g.drawImage(city.mapCanvas, sx, sz, 2*R*sc, 2*R*sc, 0, 0, W, W);
  const toMap=(x,z)=>[(x-P.x)/(2*R)*W+W/2, (z-P.z)/(2*R)*W+W/2];
  const icon=(x,z,txt,col)=>{ let [mx,mz]=toMap(x,z); const dx=mx-W/2, dz=mz-W/2, d=Math.hypot(dx,dz), lim=W/2-12; if(d>lim){ mx=W/2+dx/d*lim; mz=W/2+dz/d*lim; }
    g.fillStyle='rgba(0,0,0,.6)'; g.beginPath(); g.arc(mx,mz,9,0,Math.PI*2); g.fill(); g.fillStyle=col; g.font='bold 13px monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(txt,mx,mz+1); };
  for(const s of city.shops) if(s.act){ const [mx,mz]=toMap(s.x,s.z); if(mx>0&&mx<W&&mz>0&&mz<W){ g.fillStyle=s.color; g.fillRect(mx-3,mz-3,6,6); } }
  for(const id in city.vehicles) if(city.vehicles[id]!==city.drive){ const q=city.vehicles[id].g.position; const [mx,mz]=toMap(q.x,q.z); g.fillStyle='#5ef2ff'; g.fillRect(mx-2,mz-3,4,6); }
  icon(HOME_DOOR.x,HOME_DOOR.z,'⌂','#5ef2ff'); icon(HANGAR_PAD.x,HANGAR_PAD.z,'H','#ff7a3a');
  const yaw = city.drive ? city.drive.yaw : (settings.fp ? city.yaw : city.player.rotation.y+Math.PI);
  g.translate(W/2,W/2); g.rotate(-yaw); g.fillStyle='#ffb347'; g.beginPath(); g.moveTo(0,-9); g.lineTo(6,7); g.lineTo(0,3); g.lineTo(-6,7); g.closePath(); g.fill();
  g.restore();
  g.strokeStyle='#9a6a2a'; g.lineWidth=2; g.beginPath(); g.arc(W/2,W/2,W/2-2,0,Math.PI*2); g.stroke();
  g.fillStyle='#ffb347'; g.font='bold 14px monospace'; g.textAlign='center'; g.fillText('N',W/2,14);
}
function cityHUD(){
  const loc=document.getElementById('loc'), v=city.drive;
  const html = city.launch ? '' : v ? `<b>${v.def.name}</b> · ${Math.round(Math.abs(v.speed)*3.6)} km/h` : 'AURORA · NOVA KESSLER<br><span style="font-size:16px;color:var(--muted)">Distrito Central · High-Sec</span>';
  if(loc._h!==html){ loc.innerHTML=html; loc._h=html; }
  if(city.launch){ document.getElementById('mk-home').style.display='none'; document.getElementById('mk-hangar').style.display='none'; return; }
  drawMinimap();
  const P = v ? v.g.position : city.player.position;
  const dh=Math.hypot(HANGAR_PAD.x-P.x,HANGAR_PAD.z-P.z), dc=Math.hypot(HOME_DOOR.x-P.x,HOME_DOOR.z-P.z);
  const mh=document.getElementById('mk-hangar'), mc=document.getElementById('mk-home');
  if(dh>30) marker(mh, _t.set(HANGAR_PAD.x,12,HANGAR_PAD.z), `HANGAR 07<br>${Math.round(dh)}m`, city.cam); else mh.style.display='none';
  if(dc>25) marker(mc, _t.set(HOME_DOOR.x,6,HOME_DOOR.z), `CASA<br>${Math.round(dc)}m`, city.cam); else mc.style.display='none';
}
function updateCity(dt,t){
  if(city.launch) updateLaunch(dt,t);
  else if(city.drive) updateDrive(dt,t);
  else updateWalk(dt,t);
  updateTraffic(dt); updateNPCs(dt,t); updateAir(dt);
  for(const f of city.anim) f(t,dt);
  if(t-city.tickT>.07){ city.tickT=t; drawTicker(t); }
  const c=city.cam.position; city.sky.position.copy(c); city.stars.position.copy(c); city.sun.position.copy(c).addScaledVector(SUN_DIR,26000);
  const fov=settings.fov + (city.drive ? Math.abs(city.drive.speed)*.25 : 0);
  if(Math.abs(city.cam.fov-fov)>.05){ city.cam.fov += (fov-city.cam.fov)*Math.min(1,4*dt); city.cam.updateProjectionMatrix(); }
  cityHUD();
}
