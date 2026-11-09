'use strict';
/* Planeta Aurora — esfera completa (R = 40 km): relevo, oceanos, biomas, céu com dia e noite,
   nuvens e recursos selvagens (árvores, rochas, minérios, ervas).
   Nova Kessler fica no "topo" do mundo (y = 0); Porto Ferrugem, do outro lado. */

const PLANET = { R:40000, SEA:-30, LON:512, LAT:256 };
const PC = new V3(0,-PLANET.R,0);                       // centro do planeta
const SUN_W = new V3(-.55,.14,-.82).normalize();        // sol fixo no espaço: há dia e noite pelo planeta
const Y_AXIS = new V3(0,1,0);
const smooth01 = t => { t=clamp(t,0,1); return t*t*(3-2*t); };
function dirLL(lat, lon, out=new V3()){ const c=Math.cos(lat); return out.set(c*Math.sin(lon), c*Math.cos(lon), Math.sin(lat)); }
function llOf(d){ return [Math.asin(clamp(d.z,-1,1)), Math.atan2(d.x,d.y)]; }

// ---- cidades (sítios): moldam o relevo, por isso ficam aqui
const SITES = [
  { id:'kessler', name:'NOVA KESSLER', sub:'Distrito Central · High-Sec', lat:0, lon:0, flatR:3200, blend:3000, paved:1750,
    market:{ 'MINÉRIO':1, RECURSO:1, MATERIAL:1, 'MÓDULO':1 } },
  { id:'porto', name:'PORTO FERRUGEM', sub:'Cidade-porto · Mid-Sec', lat:.12, lon:2.2, flatR:2000, blend:2500, paved:1000,
    market:{ 'MINÉRIO':1.35, RECURSO:1.2, MATERIAL:.85, 'MÓDULO':.9 } },
];
SITES.forEach(s=>{ s.up = dirLL(s.lat, s.lon); s.center = PC.clone().addScaledVector(s.up, PLANET.R); });

// ---------------------------------------------------------------- ruído
function hash3(x,y,z){ let h=(Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(z|0,1440662683))|0; h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16; return (h>>>0)/4294967296; }
function vnoise(x,y,z){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z); let u=x-xi, v=y-yi, w=z-zi;
  u=u*u*(3-2*u); v=v*v*(3-2*v); w=w*w*(3-2*w);
  const a=hash3(xi,yi,zi), b=hash3(xi+1,yi,zi), c=hash3(xi,yi+1,zi), d=hash3(xi+1,yi+1,zi);
  const e=hash3(xi,yi,zi+1), f=hash3(xi+1,yi,zi+1), g=hash3(xi,yi+1,zi+1), h=hash3(xi+1,yi+1,zi+1);
  const x1=a+(b-a)*u, x2=c+(d-c)*u, x3=e+(f-e)*u, x4=g+(h-g)*u, y1=x1+(x2-x1)*v, y2=x3+(x4-x3)*v;
  return y1+(y2-y1)*w;
}
function fbm(x,y,z,o){ let s=0,a=.5,f=1,n=0; for(let i=0;i<o;i++){ s+=a*vnoise(x*f,y*f,z*f); n+=a; a*=.5; f*=2.03; } return s/n; }
function seeded(seed){ let s=seed|0; return ()=>{ s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// ---------------------------------------------------------------- relevo
function rawHeight(d){
  const n = fbm(d.x*2.6+11.3, d.y*2.6+7.1, d.z*2.6+3.7, 5)*2-1;
  const r = 1-Math.abs(fbm(d.x*9+1.7, d.y*9+5.3, d.z*9+9.1, 4)*2-1);
  let h = n*1500 + 40;
  if(h>0) h += r*r*r*smooth01((n+.05)*4)*2400;
  for(const s of SITES){ const a=Math.acos(clamp(d.dot(s.up),-1,1))*PLANET.R; h += 340*Math.exp(-(a*a)/(7000*7000)); }
  return h;
}
function terrainHeight(d){
  let h = rawHeight(d);
  for(const s of SITES){
    const c = d.dot(s.up); if(c<.95) continue;
    const dist = Math.acos(clamp(c,-1,1))*PLANET.R;
    if(dist < s.flatR+s.blend){
      const hp = (PLANET.R-.4)/c - PLANET.R;                 // plano tangente da cidade (chão plano de verdade)
      const w = smooth01((dist-s.flatR)/s.blend);
      h = hp*(1-w) + h*w;
    }
  }
  return h;
}
function dryness(d){
  let v = fbm(d.x*4+40, d.y*4+40, d.z*4+40, 3);
  const s2 = SITES[1], a = Math.acos(clamp(d.dot(s2.up),-1,1))*PLANET.R;
  return v + .35*Math.exp(-(a*a)/(14000*14000));          // Porto Ferrugem fica num deserto avermelhado
}
function biomeOf(d, h){
  if(h < PLANET.SEA+3) return 'beach';
  const lat = Math.abs(Math.asin(clamp(d.z,-1,1)));
  if(h > 1750 || lat > 1.18) return 'snow';
  if(h > 950) return 'rock';
  if(dryness(d) > .6) return 'desert';
  return 'grass';
}
const BIOME_COL = { beach:[0xc8b888,0xb8a878], snow:[0xe8eef2,0xd0d8e0], rock:[0x7a7470,0x8a8078], desert:[0xc8925a,0xb87a48], grass:[0x4a7a3a,0x6a8a3a] };
const BIOME_NAME = { beach:'Litoral', snow:'Geleiras', rock:'Montanhas', desert:'Deserto Rubro', grass:'Planícies Verdes' };

// grade de alturas (a física usa exatamente os mesmos triângulos da malha)
const GW = PLANET.LON+1, GH = new Float32Array(GW*(PLANET.LAT+1));
const planet = { mesh:null, ocean:null };
function buildPlanet(scene){
  const { LON, LAT, R } = PLANET, n=GW*(LAT+1);
  const pos=new Float32Array(n*3), col=new Float32Array(n*3), d=new V3(), c=new THREE.Color(), c2=new THREE.Color();
  for(let j=0;j<=LAT;j++){
    const lat=-Math.PI/2+j/LAT*Math.PI;
    for(let i=0;i<=LON;i++){
      const lon=-Math.PI+i/LON*2*Math.PI, k=j*GW+i;
      dirLL(lat,lon,d); const h=terrainHeight(d); GH[k]=h;
      pos[k*3]=PC.x+d.x*(R+h); pos[k*3+1]=PC.y+d.y*(R+h); pos[k*3+2]=PC.z+d.z*(R+h);
      const [ca,cb]=BIOME_COL[biomeOf(d,h)]; c.setHex(ca).lerp(c2.setHex(cb), vnoise(d.x*300,d.y*300,d.z*300));
      col[k*3]=c.r; col[k*3+1]=c.g; col[k*3+2]=c.b;
    }
  }
  const idx = new Uint32Array(LON*LAT*6); let q=0;
  for(let j=0;j<LAT;j++) for(let i=0;i<LON;i++){ const a=j*GW+i, b=a+1, cc=a+GW, dd=cc+1; idx[q++]=a; idx[q++]=cc; idx[q++]=b; idx[q++]=b; idx[q++]=cc; idx[q++]=dd; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos,3)); g.setAttribute('color', new THREE.BufferAttribute(col,3));
  g.setIndex(new THREE.BufferAttribute(idx,1)); g.computeVertexNormals();
  planet.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:.95 }));
  scene.add(planet.mesh);
  planet.ocean = new THREE.Mesh(new THREE.SphereGeometry(R+PLANET.SEA, 256, 128),
    new THREE.MeshStandardMaterial({ color:0x1a5a8a, roughness:.25, metalness:.3, transparent:true, opacity:.88 }));
  planet.ocean.position.copy(PC); scene.add(planet.ocean);
}
const _ga=new V3(), _gb=new V3(), _gc=new V3(), _ge=new V3();
const GN = new V3();                                       // normal do último triângulo consultado
function gv(i,j,out){ return dirLL(-Math.PI/2+j/PLANET.LAT*Math.PI, -Math.PI+i/PLANET.LON*2*Math.PI, out).multiplyScalar(PLANET.R+GH[j*GW+i]); }
function groundR(d){                                       // raio do solo (a partir do centro) na direção d
  const [lat,lon]=llOf(d);
  const fu=(lon+Math.PI)/(2*Math.PI)*PLANET.LON, fv=(lat+Math.PI/2)/Math.PI*PLANET.LAT;
  const i=clamp(Math.floor(fu),0,PLANET.LON-1), j=clamp(Math.floor(fv),0,PLANET.LAT-1), u=fu-i, v=fv-j;
  if(u+v<1){ gv(i,j,_ga); gv(i,j+1,_gb); gv(i+1,j,_gc); } else { gv(i+1,j,_ga); gv(i,j+1,_gb); gv(i+1,j+1,_gc); }
  GN.subVectors(_gb,_ga).cross(_ge.subVectors(_gc,_ga)); if(GN.dot(d)<0) GN.negate();
  const t = GN.dot(_ga)/GN.dot(d); GN.normalize(); return t;
}
function surfaceUp(d, out){                                // "cima" local: plano da cidade dentro dela, radial fora
  for(const s of SITES){
    const c=d.dot(s.up); if(c<.99) continue;
    const dist=Math.acos(clamp(c,-1,1))*PLANET.R;
    if(dist < s.flatR+800){ const w=smooth01((dist-(s.flatR-800))/1600); return out.copy(s.up).lerp(d,w).normalize(); }
  }
  return out.copy(d);
}
function placeOnPlanet(obj, p, sink=0){                    // apoia um objeto no relevo, alinhado com o "cima" local
  const d=new V3().subVectors(p,PC).normalize(), r=groundR(d);       // vetor próprio: groundR usa os temporários _g*
  obj.position.copy(PC).addScaledVector(d, r-sink); obj.quaternion.setFromUnitVectors(Y_AXIS, d);
}
// referencial que acompanha a curvatura (transporte paralelo do "cima")
const _tq = new THREE.Quaternion();
function makeFrame(){ return { q:new THREE.Quaternion(), up:new V3(0,1,0) }; }
function transport(F, newUp){ _tq.setFromUnitVectors(F.up, newUp); F.q.premultiply(_tq).normalize(); F.up.copy(newUp); }

// ---------------------------------------------------------------- céu, sol, estrelas e luz
const sky = {};
const FOG_DUSK=new THREE.Color(0xd8a084), FOG_DAY=new THREE.Color(0xa8c0d8), FOG_NIGHT=new THREE.Color(0x0a0e1a), SPACE_C=new THREE.Color(0x05060c), NIGHT_TINT=new THREE.Color(0x182038);
function buildSky(scene){
  const grad = stops => canvasTex(16,256,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); stops.forEach(([o,c])=>gr.addColorStop(o,c)); g.fillStyle=gr; g.fillRect(0,0,w,h); });
  const geo = new THREE.SphereGeometry(30000,32,16);
  sky.dusk = new THREE.Mesh(geo, B(0xffffff,{ map:grad([[0,'#0c1838'],[.3,'#34508e'],[.43,'#b88a8a'],[.49,'#ffb878'],[.52,'#d8a080'],[1,'#3a3236']]), side:THREE.BackSide, fog:false, depthWrite:false }));
  sky.day  = new THREE.Mesh(geo, B(0xffffff,{ map:grad([[0,'#1a4a9a'],[.35,'#4a86d0'],[.48,'#a8d0f0'],[.52,'#c8d8e0'],[1,'#5a6a70']]), side:THREE.BackSide, fog:false, depthWrite:false, transparent:true, opacity:0 }));
  sky.dusk.renderOrder=-3; sky.day.renderOrder=-2; scene.add(sky.dusk, sky.day);
  const sunTex = canvasTex(128,128,(g)=>{ const rg=g.createRadialGradient(64,64,0,64,64,64); rg.addColorStop(0,'rgba(255,250,230,1)'); rg.addColorStop(.18,'rgba(255,220,160,.95)'); rg.addColorStop(.4,'rgba(255,160,90,.35)'); rg.addColorStop(1,'rgba(255,120,60,0)'); g.fillStyle=rg; g.fillRect(0,0,128,128); });
  sky.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map:sunTex, fog:false, depthWrite:false, transparent:true })); sky.sun.scale.setScalar(5200); sky.sun.renderOrder=-1; scene.add(sky.sun);
  const sp=[]; for(let i=0;i<2400;i++){ const v=new V3(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(28000); sp.push(v.x,v.y,v.z); }
  const sg=new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp,3));
  sky.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color:0xffffff, size:2, sizeAttenuation:false, transparent:true, opacity:0, fog:false, depthWrite:false }));
  sky.stars.renderOrder=-1; scene.add(sky.stars);
  scene.fog = new THREE.FogExp2(FOG_DUSK.clone(), .00011); scene.background = FOG_DUSK.clone();
  sky.hemi = new THREE.HemisphereLight(0x9ab4ff, 0x6a4a3a, .65); scene.add(sky.hemi);
  sky.amb = new THREE.AmbientLight(0x403040, .35); scene.add(sky.amb);
  sky.sunL = new THREE.DirectionalLight(0xffc49a, 1.15); sky.sunL.position.copy(SUN_W).multiplyScalar(100); scene.add(sky.sunL);
}
const _sc=new THREE.Color();
function updateSky(scene, camPos, up, altK){
  for(const m of [sky.dusk, sky.day, sky.stars]){ m.position.copy(camPos); }
  sky.dusk.quaternion.setFromUnitVectors(Y_AXIS, up); sky.day.quaternion.copy(sky.dusk.quaternion);
  sky.sun.position.copy(camPos).addScaledVector(SUN_W, 26000);
  const e = up.dot(SUN_W), dayW = smooth01((e-.08)/.35), nightW = smooth01((.02-e)/.22);
  sky.day.material.opacity = dayW;
  const dark = Math.max(nightW*.85, Math.pow(altK,.6));
  _sc.setRGB(1,1,1).lerp(NIGHT_TINT, dark); sky.dusk.material.color.copy(_sc); sky.day.material.color.copy(_sc);
  _sc.copy(FOG_DUSK).lerp(FOG_DAY, dayW).lerp(FOG_NIGHT, nightW).lerp(SPACE_C, Math.pow(altK,.5));
  scene.fog.color.copy(_sc); scene.background.copy(_sc);
  scene.fog.density = .00011*(1-dayW*.35)*Math.pow(1-altK,2.2) + .0000025;
  sky.stars.material.opacity = Math.max(clamp((altK-.25)/.5,0,1), nightW*.9);
  sky.sunL.intensity = 1.2*smooth01((e+.05)/.25); sky.hemi.position.copy(up);
  sky.hemi.intensity = .18 + .5*(1-nightW); sky.amb.intensity = .22 + .15*(1-nightW);
  if(sky.clouds) sky.clouds.material.color.setRGB(1,1,1).lerp(NIGHT_TINT, nightW*.8).lerp(_sc.setHex(0xffd0b8), (1-dayW)*(1-nightW)*.6);
}
function buildClouds(scene){
  const tex = canvasTex(128,128,(g)=>{ for(let i=0;i<16;i++){ const x=rand(28,100), y=rand(28,100), r=rand(14,30); const rg=g.createRadialGradient(x,y,0,x,y,r); rg.addColorStop(0,'rgba(255,255,255,.8)'); rg.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=rg; g.fillRect(0,0,128,128); } });
  const rng = seeded(99), list=[], d=new V3(), m=new THREE.Matrix4(), q=new THREE.Quaternion(), qy=new THREE.Quaternion();
  for(let k=0;k<2000;k++){
    if(k<300){ dirLL(rng()*.25-.125, rng()*.25-.125, d); } else d.set(rng()*2-1, rng()*2-1, rng()*2-1).normalize();
    const alt = 1700+rng()*1000, w=500+rng()*1100, l=w*(.4+rng()*.5);
    const pg = new THREE.PlaneGeometry(w,l); pg.rotateX(-Math.PI/2);
    q.setFromUnitVectors(Y_AXIS, d).multiply(qy.setFromAxisAngle(Y_AXIS, rng()*6));
    m.compose(_ge.copy(PC).addScaledVector(d, PLANET.R+alt), q, _gb.set(1,1,1)); pg.applyMatrix4(m); list.push(pg.toNonIndexed());
  }
  const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(list);
  sky.clouds = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ map:tex, transparent:true, opacity:.85, depthWrite:false, side:THREE.DoubleSide }));
  scene.add(sky.clouds);
}

// ---------------------------------------------------------------- áreas selvagens: vegetação, rochas e jazidas
const CHUNK = .012;                                         // ~480 m
const chunks = new Map();
const DEPOSITS = {
  iron:   { item:'ore_iron',   name:'Minério de Ferro',    qty:[2,4] },
  copper: { item:'ore_copper', name:'Minério de Cobre',    qty:[2,3] },
  crystal:{ item:'crystal',    name:'Cristal de Aurorita', qty:[1,2] },
  herbs:  { item:'herbs',      name:'Ervas Medicinais',    qty:[2,3] },
  titanium:{ item:'ore_titanium', name:'Titânio Bruto',     qty:[1,2] },
};
const RESPAWN_MS = 20*60*1000;
let wildMat = null;
function wildMats(){
  if(wildMat) return wildMat;
  return wildMat = { trunk:M(0x5a4030), leaf:[M(0x3a7a3a),M(0x4a8a3a),M(0x2f6a3a)], pine:M(0x2a5a3a), rock:M(0x7a7068), rockD:M(0xa08068), snowRock:M(0xc8ccd0),
    cactus:M(0x4a7a4a), bush:M(0x3a6a34), flower:B(0xc87aff), ore:M(0x6a5448), oreSpot:B(0xff8a3a), cu:M(0x4a7a6a), cuSpot:B(0x5affc8),
    crystal:M(0x7ff6ff,{emissive:0x2aa8c8, emissiveIntensity:.9, roughness:.2, metalness:.3}) };
}
const _cm=new THREE.Matrix4(), _cq=new THREE.Quaternion(), _cqy=new THREE.Quaternion(), _cs=new V3(), _cp=new V3(), _cd=new V3();
function chunkPlace(ci,cj,rng){
  const lat=(cj+rng())*CHUNK, lon=(ci+rng())*CHUNK; dirLL(lat,lon,_cd);
  const r=groundR(_cd); if(r < PLANET.R+PLANET.SEA+1) return null;
  return { d:_cd.clone(), p:PC.clone().addScaledVector(_cd, r), h:r-PLANET.R };
}
function buildChunk(ci,cj){
  const key=ci+','+cj, ch={ key, group:null, deposits:[] }; chunks.set(key, ch);
  const c=dirLL((cj+.5)*CHUNK,(ci+.5)*CHUNK), cr=groundR(c);
  for(const s of SITES) if(Math.acos(clamp(c.dot(s.up),-1,1))*PLANET.R < s.flatR+400) return ch;
  if(cr < PLANET.R+PLANET.SEA+2) return ch;
  const biome = biomeOf(c, cr-PLANET.R), rng = seeded(Math.floor(hash3(ci,cj,77)*1e9)), W=wildMats(), lists=new Map();
  const put = (mat, geom, at, s=1, sy=s, yaw=rng()*6)=>{ _cq.setFromUnitVectors(Y_AXIS, at.d).multiply(_cqy.setFromAxisAngle(Y_AXIS,yaw));
    _cm.compose(at.p, _cq, _cs.set(s,sy,s)); geom.applyMatrix4(_cm); if(!lists.has(mat)) lists.set(mat,[]); lists.get(mat).push(geom.index?geom.toNonIndexed():geom); };
  const plan = { grass:{trees:22,rocks:6,bush:8,dep:[['herbs',.45],['iron',.3]]}, desert:{cactus:7,rocks:12,dep:[['copper',.5],['iron',.2]]},
                 rock:{rocks:14,pines:6,dep:[['crystal',.45],['iron',.4],['titanium',.15]]}, snow:{rocks:9,dep:[['crystal',.55],['titanium',.35]]}, beach:{rocks:4,dep:[]} }[biome];
  for(let k=0;k<(plan.trees||0);k++){ const a=chunkPlace(ci,cj,rng); if(!a||biomeOf(a.d,a.h)!=='grass') continue; const s=.8+rng()*.8;
    put(W.trunk, gCyl(.25,.35,4,5).translate(0,2,0), a, s); put(W.leaf[(rng()*3)|0], new THREE.IcosahedronGeometry(2.4,0).translate(0,5.4,0), a, s); }
  for(let k=0;k<(plan.pines||0);k++){ const a=chunkPlace(ci,cj,rng); if(!a) continue; const s=.8+rng()*.7;
    put(W.trunk, gCyl(.2,.3,2,5).translate(0,1,0), a, s); put(W.pine, new THREE.ConeGeometry(2.2,7,6).translate(0,5,0), a, s); }
  for(let k=0;k<(plan.rocks||0);k++){ const a=chunkPlace(ci,cj,rng); if(!a) continue; const s=.6+rng()*2.4;
    put(biome==='snow'?W.snowRock:biome==='desert'?W.rockD:W.rock, new THREE.IcosahedronGeometry(1.2,0).translate(0,.5,0), a, s, s*(.5+rng()*.6)); }
  for(let k=0;k<(plan.cactus||0);k++){ const a=chunkPlace(ci,cj,rng); if(!a) continue;
    put(W.cactus, gCyl(.35,.4,4,6).translate(0,2,0), a, 1); put(W.cactus, gCyl(.22,.22,1.6,6).translate(.7,2.6,0), a, 1); }
  for(let k=0;k<(plan.bush||0);k++){ const a=chunkPlace(ci,cj,rng); if(!a) continue; put(W.bush, new THREE.IcosahedronGeometry(1,0).translate(0,.6,0), a, .7+rng()*.6, .5); }
  const g = new THREE.Group();
  for(const [mat,list] of lists){ const merged=THREE.BufferGeometryUtils.mergeBufferGeometries(list); if(merged) g.add(new THREE.Mesh(merged,mat)); }
  // jazidas
  let di=0;
  for(const [type,prob] of plan.dep){
    if(rng()>prob) continue;
    const a=chunkPlace(ci,cj,rng); if(!a) continue;
    const dk=key+':'+(di++), dep={ key:dk, type, pos:a.p, d:a.d, g:makeDeposit(type,rng) };
    dep.g.position.copy(a.p); dep.g.quaternion.setFromUnitVectors(Y_AXIS,a.d);
    const t=state.mined[dk]; dep.gone = !!(t && Date.now()-t < RESPAWN_MS); dep.g.visible=!dep.gone;
    g.add(dep.g); ch.deposits.push(dep);
  }
  city.scene.add(g); ch.group=g;
  return ch;
}
function makeDeposit(type, rng){
  const W=wildMats(), g=new THREE.Group();
  if(type==='crystal'){ for(let i=0;i<5;i++){ const h=1.2+rng()*1.8; const c=new THREE.Mesh(new THREE.ConeGeometry(.3,h,5),W.crystal); c.position.set(rng()*1.2-.6,h/2,rng()*1.2-.6); c.rotation.set(rng()*.5-.25,0,rng()*.5-.25); g.add(c); } }
  else if(type==='herbs'){ const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.8,0),W.bush); b.scale.y=.6; b.position.y=.4; g.add(b);
    for(let i=0;i<7;i++){ const f=new THREE.Mesh(gBox(.15,.15,.15),W.flower); f.position.set(rng()*1.2-.6,.75+rng()*.2,rng()*1.2-.6); g.add(f); } }
  else if(type==='titanium'){ for(let i=0;i<4;i++){ const r=new THREE.Mesh(new THREE.OctahedronGeometry(.6+rng()*.5,0), M(0xb8c0c8,{metalness:.8,roughness:.3})); r.position.set(rng()*1.4-.7,.45,rng()*1.4-.7); r.rotation.set(rng()*3,rng()*3,0); g.add(r); } }
  else { const cu=type==='copper'; for(let i=0;i<3;i++){ const r=new THREE.Mesh(new THREE.IcosahedronGeometry(.7+rng()*.5,0), cu?W.cu:W.ore); r.position.set(rng()*1.4-.7,.4,rng()*1.4-.7); g.add(r); }
    for(let i=0;i<8;i++){ const s=new THREE.Mesh(gBox(.18,.18,.18), cu?W.cuSpot:W.oreSpot); s.position.set(rng()*1.6-.8,.3+rng()*.7,rng()*1.6-.8); g.add(s); } }
  return g;
}
let chunkT=0;
function updateChunks(p, t){
  if(t-chunkT<.35) return; chunkT=t;
  const d=_cp.subVectors(p,PC).normalize(), [lat,lon]=llOf(d), cj=Math.floor(lat/CHUNK), ci=Math.floor(lon/CHUNK);
  const wl=Math.min(24, Math.ceil(4/Math.max(Math.cos(lat),.15))), want=new Set(); let built=0;
  for(let dj=-4;dj<=4;dj++) for(let dii=-wl;dii<=wl;dii++){
    const a=ci+dii, b=cj+dj; if(Math.abs((b+.5)*CHUNK)>Math.PI/2) continue;
    const cc=dirLL((b+.5)*CHUNK,(a+.5)*CHUNK); if(Math.acos(clamp(cc.dot(d),-1,1))*PLANET.R > 2100) continue;
    const key=a+','+b; want.add(key);
    if(!chunks.has(key) && built<3){ buildChunk(a,b); built++; }               // poucos por quadro: sem engasgos
  }
  for(const [key,ch] of chunks) if(!want.has(key)){
    if(ch.group){ ch.group.traverse(o=>{ if(o.isMesh && o.geometry) o.geometry.dispose(); }); city.scene.remove(ch.group); }
    chunks.delete(key);
  }
}
function* nearbyDeposits(){ for(const ch of chunks.values()) for(const dep of ch.deposits) if(!dep.gone) yield dep; }
