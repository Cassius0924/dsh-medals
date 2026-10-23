import * as THREE from '../vendor/three/three.module.js';
import {NUMERAL_GLYPHS} from './numeral-glyphs.js';


const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const models = new Map();
const stages = new Set();
const textureCache = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scriptBase = new URL('.', document.currentScript?.src || location.href);
let engine;
let frame = 0;
let previousFrame = 0;

function canvasTexture(canvas, color = false) {
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function brushedTexture(radial = false) {
  const key = radial ? 'radial-brush' : 'linear-brush';
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(1024, 1024);
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
    const dx = x - 512, dy = y - 512;
    const distance = radial ? Math.hypot(dx, dy) : y + Math.sin(x * .003) * 2;
    const grain = Math.sin(x * 92.13 + y * 17.71) * Math.sin(x * 13.93 - y * 71.51);
    const value = 128 + Math.sin(distance * 3.7) * 13 + Math.sin(distance * 7.19) * 5 + grain * 5;
    const offset = (y * 1024 + x) * 4;
    image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = canvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, texture);
  return texture;
}

function engineTurnedTexture() {
  if (textureCache.has('engine-turned')) return textureCache.get('engine-turned');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8a8a8a'; ctx.fillRect(0, 0, 1024, 1024);
  ctx.strokeStyle = '#747474'; ctx.lineWidth = 1;
  for (let i = 0; i < 96; i++) {
    const phase = i / 96 * TAU;
    ctx.beginPath();
    for (let j = 0; j <= 160; j++) {
      const t = j / 160;
      const angle = phase + t * .8;
      const radius = 45 + t * 455 + 7 * Math.sin(t * 34 + phase * 6);
      const x = 512 + Math.cos(angle) * radius, y = 512 + Math.sin(angle) * radius;
      if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  const texture = canvasTexture(canvas);
  textureCache.set('engine-turned', texture);
  return texture;
}

function palette(medal) {
  if (medal.design === 'numeric') { const field = {daily:'#a21649',weekly:'#075b5d',monthly:'#482340',days:'#214e7d'}[medal.series] || '#265b9a'; return {metal:medal.metal==='gold'?'#c6a05b':'#bdc5ce',bright:medal.metal==='gold'?'#f3d18c':'#edf0f5',field,dark:medal.metal==='gold'?'#6c4a23':'#4a5665'}; }
  if (medal.locked) return { metal: '#7a8592', bright: '#c8d2db', field: '#18212c', dark: '#35404b' };
  const design=medal.design||medal.id;
  const fields={evergreen:'#164b3c',compass:'#14394b',rosette:'#ede7d9',prism:'#183b55',constellation:'#20244b',galaxy:'#101f38'};
  if(fields[design])return {metal:design==='compass'?'#bdcddd':'#deb976',bright:design==='compass'?'#edf4ff':'#ffe8b5',field:fields[design],dark:'#526078'};
  if (design === 'lunar') return { metal: '#c2d0e0', bright: '#f3f5fa', field: '#22425c', dark: '#6c849b' };
  if (design === 'rise') return { metal: '#c8d9e3', bright: '#f3f5ff', field: '#103b35', dark: '#61778b' };
  if (design === 'dawn') return { metal: '#dfad76', bright: '#ffe0b0', field: '#25213c', dark: '#8d552f' };
  if (design === 'beyond') return { metal: '#bfccd9', bright: '#f4f4ff', field: '#202e49', dark: '#62728c' };
  return { metal: '#e8b965', bright: '#ffe1a1', field: '#092e48', dark: '#936328' };
}

function materials(medal) {
  const p = palette(medal);
  const medallion=medal.design==='numeric'||medal.design==='rosette';
  const satin = new THREE.MeshPhysicalMaterial({ color: p.metal, metalness: .88, roughness: .27, bumpMap: brushedTexture(true), bumpScale: .0013, anisotropy: .35 });
  const polished = new THREE.MeshPhysicalMaterial({ color: p.bright, metalness: .90, roughness: .19 });
  const recess = new THREE.MeshStandardMaterial({ color: p.dark, metalness: 1, roughness: .37 });
  const enamel = new THREE.MeshPhysicalMaterial({ color: p.field, metalness: .34, roughness: .24, clearcoat: .92, clearcoatRoughness: .12, bumpMap: engineTurnedTexture(), bumpScale: .0014 });
  if(medallion){satin.metalness=.82;polished.metalness=.84;polished.roughness=.22;}
  return { satin, polished, recess, enamel, palette: p };
}

function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  group.add(object);
  return object;
}

function ring(group, radius, tube, z, material) {
  return mesh(group, new THREE.TorusGeometry(radius, tube, 12, 192), material, 0, 0, z);
}

function disk(group, radius, z, material) {
  return mesh(group, new THREE.CircleGeometry(radius, 192), material, 0, 0, z);
}

function camberedFace(group, inner, outer, z, material, height = .008) {
  const geometry = new THREE.RingGeometry(inner, outer, 192, 24);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const radius = Math.hypot(positions.getX(i), positions.getY(i));
    const t = clamp((radius - inner) / (outer - inner), 0, 1);
    positions.setZ(i, inner ? Math.sin(t * Math.PI) * height : (1 - t * t) * height);
  }
  geometry.computeVertexNormals();
  return mesh(group, geometry, material, 0, 0, z);
}

function lathe(group, profile, material) {
  const geometry = new THREE.LatheGeometry(profile.map(([radius, z]) => new THREE.Vector2(radius, z)), 192);
  geometry.rotateX(Math.PI / 2);
  return mesh(group, geometry, material);
}

function roundedPolygon(sides, radius, rotation = Math.PI / 2, rounding = .16) {
  const vertices = Array.from({ length: sides }, (_, i) => new THREE.Vector2(Math.cos(rotation + i * TAU / sides), Math.sin(rotation + i * TAU / sides)).multiplyScalar(radius));
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const previous = vertices[(i + sides - 1) % sides], current = vertices[i], next = vertices[(i + 1) % sides];
    const a = current.clone().lerp(previous, rounding), b = current.clone().lerp(next, rounding);
    if (!i) shape.moveTo(a.x, a.y); else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(current.x, current.y, b.x, b.y);
  }
  shape.closePath();
  return shape;
}

function cushion(radius = 1) {
  const shape = new THREE.Shape();
  const corner = .34 * radius, r = .89 * radius;
  shape.moveTo(-r + corner, -r); shape.lineTo(r - corner, -r);
  shape.quadraticCurveTo(r, -r, r, -r + corner); shape.lineTo(r, r - corner);
  shape.quadraticCurveTo(r, r, r - corner, r); shape.lineTo(-r + corner, r);
  shape.quadraticCurveTo(-r, r, -r, r - corner); shape.lineTo(-r, -r + corner);
  shape.quadraticCurveTo(-r, -r, -r + corner, -r);
  return shape;
}

function flutedCircle(radius = 1) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 256; i++) {
    const angle = i / 256 * TAU, r = radius * (1 + .034 * Math.cos(12 * angle));
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
    if (!i) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath(); return shape;
}

function extrude(group, shape, material, { z = 0, depth = .06, bevel = .022, segments = 64 } = {}) {
  return mesh(group, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: segments, steps: 1 }), material, 0, 0, z);
}

function curveTube(group, points, radius, material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  return mesh(group, new THREE.TubeGeometry(curve, Math.min(256, Math.max(48, points.length * 2)), radius, 6, closed), material);
}

function traceShape(group, shape, scale, z, radius, material) {
  return curveTube(group, shape.getSpacedPoints(160).slice(0, -1).map(p => new THREE.Vector3(p.x * scale, p.y * scale, z)), radius, material, true);
}

function bead(group, radius, x, y, z, material) {
  return mesh(group, new THREE.SphereGeometry(radius, 16, 12), material, x, y, z);
}

function engravingTexture(medal, back = false) {
  const { palette: p } = materialsFor(medal);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.scale(.5, .5);
  ctx.fillStyle = p.metal; ctx.fillRect(0, 0, 2048, 2048);
  const botanical=(medal.design||medal.id)==='evergreen';
  const engraving = medal.locked ? '#29333e' : medal.metal === 'silver' ? '#26384b' : '#24170b';
  ctx.fillStyle = engraving; ctx.strokeStyle = engraving; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (back) {
    ctx.lineWidth = 2;
    for (const radius of [760, 749]) { ctx.beginPath(); ctx.arc(1024, 1024, radius, 0, TAU); ctx.stroke(); }
    ctx.font = '500 48px system-ui'; ctx.fillText('D E E P S E E K   H A R N E S S', 1024, 485);
    ctx.font = botanical?'500 160px system-ui':'500 132px system-ui'; ctx.fillText(botanical?'常青之树':medal.name, 1024, 810);
    ctx.font = botanical?'400 64px system-ui':'400 48px system-ui'; ctx.fillText(botanical?'把每一天的坚持，长成枝叶':medal.locked ? '下一段旅程，正在发生' : medal.inscription, 1024, 1010);
    ctx.fillRect(865, 1145, 318, 2);
    ctx.font = botanical?'400 68px system-ui':'400 52px system-ui'; ctx.fillText(botanical?'恒久生长':medal.locked ? '尚未解锁' : medal.period, 1024, 1250);
    ctx.font = botanical?'500 62px monospace':'500 52px monospace'; ctx.fillText(botanical?'ROOTED IN CONSISTENCY':medal.locked ? 'PERSONAL ACHIEVEMENT' : `No. ${medal.serial}`, 1024, 1390);
    ctx.font = '400 28px system-ui'; ctx.fillText('PERSONAL COLLECTION', 1024, 1540);
  } else {
    function arcText(text, span, radius, bottom = false) {
      ctx.font = '500 34px system-ui';
      const chars = [...text];
      chars.forEach((char, index) => {
        const t = index / Math.max(chars.length - 1, 1);
        const angle = bottom ? Math.PI / 2 + span / 2 - t * span : -Math.PI / 2 - span / 2 + t * span;
        ctx.save(); ctx.translate(1024 + Math.cos(angle) * radius, 1024 + Math.sin(angle) * radius);
        ctx.rotate(angle + (bottom ? -Math.PI / 2 : Math.PI / 2)); ctx.fillText(char, 0, 0); ctx.restore();
      });
    }
    arcText('D E E P S E E K   H A R N E S S', 1.9, 977);
    arcText('P E R S O N A L   A C H I E V E M E N T', 2.1, 977, true);
  }
  const color = canvasTexture(canvas, true);
  let ink;
  if(back){
    const inkCanvas=document.createElement('canvas');inkCanvas.width=inkCanvas.height=1024;
    const inkCtx=inkCanvas.getContext('2d'),pixels=ctx.getImageData(0,0,1024,1024);
    const baseRed=parseInt(p.metal.slice(1,3),16),cutRed=parseInt(engraving.slice(1,3),16);
    for(let i=0;i<pixels.data.length;i+=4){
      const coverage=clamp((baseRed-pixels.data[i])/(baseRed-cutRed),0,1);
      pixels.data[i]=36;pixels.data[i+1]=26;pixels.data[i+2]=15;pixels.data[i+3]=Math.round(coverage*255);
    }
    inkCtx.putImageData(pixels,0,0);ink=canvasTexture(inkCanvas,true);
  }
  const bumpCanvas = document.createElement('canvas'); bumpCanvas.width = bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d'); bumpCtx.drawImage(canvas, 0, 0, 512, 512);
  return { color, bump: canvasTexture(bumpCanvas), ink };
}

const materialCache = new Map();
function materialsFor(medal) {
  const key = `${medal.id}:${!!medal.locked}`;
  if (!materialCache.has(key)) materialCache.set(key, materials(medal));
  return materialCache.get(key);
}

function addBack(group, medal, m, radius=.922) {
  const texture = engravingTexture(medal, true);
  const material = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: texture.color, metalness: .6, roughness: .46, envMapIntensity: .65, bumpMap: texture.bump, bumpScale: .004, anisotropy: .3 });
  const back = camberedFace(group, 0, radius, -.126, material, .025); back.rotation.y = Math.PI;
  // Diffuse cut lettering keeps its contrast beneath broad specular reflections.
  const cutMaterial=new THREE.MeshStandardMaterial({map:texture.ink,transparent:true,alphaTest:.015,metalness:0,roughness:1,envMapIntensity:0,depthWrite:false});
  const lettering=camberedFace(group,0,radius,-.128,cutMaterial,.025);lettering.rotation.y=Math.PI;
  ring(group, radius*1.023, .011, -.126, m.polished);
  ring(group, radius*.976, .003, -.133, m.recess);
}

function circularCase(group, medal, m) {
  lathe(group, [[0, -.12], [.94, -.12], [1.005, -.105], [1.045, -.063], [1.05, .033], [1.037, .082], [1.005, .116], [.93, .116], [.9, .082], [0, .082]], m.satin);
  ring(group, 1.027, .013, .085, m.polished);
  ring(group, .94, .011, .112, m.polished);
  ring(group, .918, .005, .105, m.recess);
  const front = engravingTexture(medal);
  const frontMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: front.color, bumpMap: front.bump, bumpScale: .0025, metalness: 1, roughness: .24 });
  camberedFace(group, .945, 1.013, .118, frontMat);
  disk(group, .906, .086, m.enamel);
  for (let i = 0; i < 120; i++) {
    const a = i / 120 * TAU;
    const tick = mesh(group, new THREE.BoxGeometry(.004, .006, .07), i % 5 ? m.satin : m.polished, Math.cos(a) * 1.046, Math.sin(a) * 1.046, -.018);
    tick.rotation.z = a - Math.PI / 2;
  }
  addBack(group, medal, m);
}

function shapedCase(group, medal, m, shape) {
  extrude(group, shape, m.satin, { z: -.103, depth: .16, bevel: .035 });
  const field = extrude(group, shape, m.enamel, { z: .067, depth: .008, bevel: .02 }); field.scale.set(.88, .88, 1);
  traceShape(group, shape, 1.01, .083, .013, m.polished);
  traceShape(group, shape, .904, .105, .009, m.polished);
  traceShape(group, shape, .87, .09, .004, m.recess);
  addBack(group, medal, m,medal.design==='prism'?.51:medal.design==='constellation'?.82:medal.design==='evergreen'?.72:.922);
}

function guilloche(group, m, inner = .72, outer = .855, petals = 8) {
  for (let i = 0; i < 8; i++) {
    const points = [];
    for (let j = 0; j < 200; j++) {
      const a = j / 200 * TAU;
      const r = (inner + outer) / 2 + (outer - inner) / 2 * Math.sin(petals * a + i / 8 * TAU);
      points.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, .097));
    }
    curveTube(group, points, .0013, i % 4 ? m.recess : m.satin, true);
  }
}

function orbit(group, medal, m) {
  circularCase(group, medal, m); guilloche(group, m);
  ring(group, .7, .006, .113, m.polished);
  for (let i = 0; i < 3; i++) {
    const ellipse = ring(group, .55, .028, .185, m.polished);
    ellipse.scale.set(1.14, .49, 1); ellipse.rotation.z = i * Math.PI / 3 + .13;
    ellipse.rotation.x = .15 * (i - 1);
    const angle = i * TAU / 3 + .33;
    bead(group, .046, .57 * Math.cos(angle), .57 * Math.sin(angle), .218, m.polished);
  }
  const core = new THREE.MeshPhysicalMaterial({ color: medal.locked ? '#71829b' : '#348aad', metalness: .65, roughness: .17, clearcoat: .8, clearcoatRoughness: .12 });
  const sun = mesh(group, new THREE.IcosahedronGeometry(.182, 0), core, 0, 0, .219);
  sun.rotation.set(.2, .32, .14);
  ring(group, .23, .007, .172, m.satin);
  for (let i = 0; i < 12; i++) {
    const angle = i / 12 * TAU;
    bead(group, .008, .88 * Math.cos(angle), .88 * Math.sin(angle), .104, m.polished);
  }
}

function moon(group, medal, m) {
  circularCase(group, medal, m);
  const motherOfPearl = new THREE.MeshPhysicalMaterial({ color: medal.locked ? '#57606e' : '#c6e2ea', metalness: .3, roughness: .28, iridescence: .48, iridescenceIOR: 1.38, iridescenceThicknessRange: [150, 380], clearcoat: .7, clearcoatRoughness: .13, bumpMap: brushedTexture(true), bumpScale: .002 });
  const moonFace = camberedFace(group, 0, .74, .099, motherOfPearl, .028);
  const moonShape = new THREE.Shape();
  const a = Math.atan2(.55, .32), r = Math.hypot(.32, .55);
  moonShape.absarc(0, 0, r, a, TAU - a, false);
  const innerR = Math.hypot(.02, .55), innerAngle = Math.atan2(.55, .02);
  moonShape.absarc(.30, 0, innerR, -innerAngle, innerAngle, true); moonShape.closePath();
  const crescent = extrude(group, moonShape, m.polished, { z: .113, depth: .042, bevel: .025 }); crescent.rotation.z = -.2;
  const craters = [[-.39,.16,.10],[-.48,-.12,.07],[-.26,-.36,.06],[-.28,.40,.045]];
  for (const [x, y, radius] of craters) {
    const crater = ring(group, radius, .008, .182, m.satin); crater.position.x = x; crater.position.y = y;
  }
  const path = [];
  for (let i = 0; i < 160; i++) { const t = i / 160 * TAU; path.push(new THREE.Vector3(Math.cos(t) * .81, Math.sin(t) * .43, .18 + Math.cos(t) * .025)); }
  const ellipse = curveTube(group, path, .009, m.polished, true); ellipse.rotation.z = -.45;
  bead(group, .072, .5, .44, .15, m.polished);
  moonFace.rotation.z = .1;
}

function shard(group, points, m) {
  const [a, b, c, ridge] = points.map(p => new THREE.Vector3(...p));
  const vertices = [a, b, ridge, b, c, ridge, c, a, ridge];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap(v => v.toArray()), 3)); geometry.computeVertexNormals();
  return mesh(group, geometry, m);
}

function growth(group, medal, m) {
  const shape = roundedPolygon(6, 1.045, Math.PI / 6, .13);
  shapedCase(group, medal, m, shape);
  for (let i = 0; i < 18; i++) {
    const x = -.70 + i * .08, points = [];
    for (let j = 0; j <= 50; j++) {
      const t = j / 50;
      points.push(new THREE.Vector3(x + t * .19, -.58 + t * 1.12, .09));
    }
    curveTube(group, points, .0015, m.satin);
  }
  shard(group, [[-.59,-.34,.15],[-.22,-.51,.15],[.05,.47,.18],[-.20,-.10,.33]], m.polished);
  shard(group, [[-.20,-.48,.16],[.16,-.33,.16],[.43,.66,.15],[.13,.02,.37]], m.satin);
  shard(group, [[.18,-.32,.15],[.54,-.13,.15],[.61,.42,.16],[.40,.04,.30]], m.polished);
  const slash = [new THREE.Vector3(-.57,-.59,.13), new THREE.Vector3(-.1,-.62,.13), new THREE.Vector3(.55,-.27,.13)];
  curveTube(group, slash, .009, m.polished);
}

function dawn(group, medal, m) {
  shapedCase(group, medal, m, flutedCircle(1.015));
  guilloche(group, m, .69, .85, 10);
  const sunShape = new THREE.Shape(); sunShape.absarc(0, -.10, .405, 0, Math.PI, false); sunShape.lineTo(.405, -.10);
  extrude(group, sunShape, m.polished, { z: .118, depth: .035, bevel: .012 });
  for (let i = 0; i < 11; i++) {
    const a = .10 + i / 10 * (Math.PI - .20), r0 = .47, r1 = i % 2 ? .64 : .74;
    const shape = new THREE.Shape();
    shape.moveTo(Math.cos(a - .018) * r0, Math.sin(a - .018) * r0 - .10);
    shape.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 - .10);
    shape.lineTo(Math.cos(a + .018) * r0, Math.sin(a + .018) * r0 - .10); shape.closePath();
    extrude(group, shape, m.polished, { z: .119, depth: .015, bevel: .006 });
  }
  for (let i = 0; i < 5; i++) {
    const width = .63 - i * .065, y = -.17 - i * .09;
    curveTube(group, [new THREE.Vector3(-width,y,.13),new THREE.Vector3(0,y-.035,.13),new THREE.Vector3(width,y,.13)], .009 - i * .0008, i % 2 ? m.satin : m.polished);
  }
}

function milestone(group, medal, m) {
  shapedCase(group, medal, m, cushion(1.12));
  for (let i = 0; i < 9; i++) traceShape(group, cushion(1), .82 - i * .018, .093, .0015, i % 2 ? m.recess : m.satin);
  for (let i = 0; i < 3; i++) {
    const size = .63 - i * .18;
    const shape = cushion(size);
    const hole = cushion(size * .64);
    const path = new THREE.Path(hole.getPoints(96).reverse()); shape.holes.push(path);
    const step = extrude(group, shape, i % 2 ? m.satin : m.polished, { z: .114 + i * .055, depth: .022, bevel: .012 }); step.rotation.z = Math.PI / 4;
  }
  const stone = mesh(group, new THREE.OctahedronGeometry(.105, 0), m.polished, 0, 0, .28); stone.rotation.z = Math.PI / 4;
}

function beyond(group, medal, m) {
  shapedCase(group, medal, m, roundedPolygon(12, 1.04, Math.PI / 12, .22));
  guilloche(group, m, .73, .875, 8);
  const ribbonMaterial = new THREE.MeshPhysicalMaterial({ color: medal.locked ? '#8995a4' : '#c6d5ee', metalness: 1, roughness: .18, iridescence: medal.locked ? .15 : .6, iridescenceIOR: 1.38, iridescenceThicknessRange: [180, 420] });
  const path = [];
  for (let i = 0; i < 180; i++) { const a = i / 180 * TAU; path.push(new THREE.Vector3(.62 * Math.sin(a), .34 * Math.sin(2 * a), .205 + .105 * Math.cos(a))); }
  const ribbon = curveTube(group, path, .065, ribbonMaterial, true); ribbon.rotation.z = -.18;
  ring(group, .72, .005, .114, m.polished);
}

function starShape(points,outer,inner){const shape=new THREE.Shape();for(let i=0;i<points*2;i++){const a=Math.PI/2+i*Math.PI/points,r=i%2?inner:outer;if(i)shape.lineTo(Math.cos(a)*r,Math.sin(a)*r);else shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);}shape.closePath();return shape;}
const evergreenBranches=[
  [[0,-.52],[-.035,-.08],[0,.31],[0,.62]],
  [[-.02,-.14],[-.22,.10],[-.39,.28],[-.51,.42]],
  [[0,.06],[-.15,.29],[-.28,.48],[-.33,.61]],
  [[.01,-.04],[.23,.15],[.40,.30],[.51,.43]],
  [[.01,.21],[.16,.38],[.27,.53],[.32,.64]],
];
const evergreenLeaves=[
  [-.53,.41,.85],[-.40,.23,1.03],[-.36,.59,.45],[-.23,.42,-.35],[-.13,.24,-.48],
  [-.13,.66,.25],[0,.76,0],[.13,.65,-.25],[.33,.60,-.45],[.24,.42,.35],
  [.53,.41,-.85],[.40,.23,-1.03],[.12,.25,.48],
];
function treeLeafShape(){
  const shape=new THREE.Shape();shape.moveTo(0,-.14);
  shape.bezierCurveTo(-.12,-.05,-.11,.07,0,.155);
  shape.bezierCurveTo(.11,.07,.12,-.05,0,-.14);shape.closePath();return shape;
}
function treeTrunkShape(){
  const shape=new THREE.Shape();shape.moveTo(-.11,-.59);
  shape.bezierCurveTo(-.04,-.37,-.07,-.18,-.10,.03);
  shape.bezierCurveTo(-.05,-.04,-.015,-.02,0,.14);
  shape.bezierCurveTo(.055,.02,.075,-.05,.12,.07);
  shape.bezierCurveTo(.08,-.20,.075,-.42,.14,-.59);shape.closePath();return shape;
}
function evergreenOutline(){
  const shape=new THREE.Shape();shape.moveTo(0,1.01);
  shape.bezierCurveTo(.42,1.01,.84,.92,.95,.73);shape.lineTo(.93,-.25);
  shape.bezierCurveTo(.91,-.60,.42,-.89,0,-1.04);
  shape.bezierCurveTo(-.42,-.89,-.91,-.60,-.93,-.25);shape.lineTo(-.95,.73);
  shape.bezierCurveTo(-.84,.92,-.42,1.01,0,1.01);shape.closePath();return shape;
}
function evergreen(group,medal,m){
  shapedCase(group,medal,m,evergreenOutline());
  const halo=ring(group,.64,.004,.12,m.satin);halo.position.y=.18;
  const jade=new THREE.MeshPhysicalMaterial({color:'#65a889',metalness:.24,roughness:.23,clearcoat:1,clearcoatRoughness:.10});
  for(const points of evergreenBranches)curveTube(group,points.map(([x,y])=>new THREE.Vector3(x,y,.17)),.021,m.polished);
  extrude(group,treeTrunkShape(),m.polished,{z:.15,depth:.055,bevel:.012,segments:20});
  for(const side of [-1,1])curveTube(group,[new THREE.Vector3(side*.035,-.50,.208),new THREE.Vector3(side*.02,-.30,.211),new THREE.Vector3(side*.04,-.12,.208)],.003,m.recess);
  for(const side of [-1,1])curveTube(group,[new THREE.Vector3(0,-.48,.19),new THREE.Vector3(side*.14,-.57,.19),new THREE.Vector3(side*.32,-.61,.17)],.017,m.satin);
  for(const [x,y,angle] of evergreenLeaves){
    const leaf=new THREE.Group();group.add(leaf);leaf.position.set(x,y,0);leaf.rotation.z=angle;
    extrude(leaf,treeLeafShape(),m.polished,{z:.174,depth:.025,bevel:.007,segments:16});
    shard(leaf,[[.068,0,.208],[0,.137,.208],[-.068,0,.208],[0,0,.267]],jade);
    shard(leaf,[[-.068,0,.208],[0,-.12,.208],[.068,0,.208],[0,0,.267]],jade);
    curveTube(leaf,[new THREE.Vector3(0,-.11,.218),new THREE.Vector3(0,0,.27),new THREE.Vector3(0,.13,.218)],.0035,m.polished);
  }
  const roots=ring(group,.34,.009,.145,m.polished);roots.scale.y=.19;roots.position.y=-.64;
}
function compass(group,medal,m){
  shapedCase(group,medal,m,medalOutline(medal));ring(group,.74,.012,.13,m.polished);
  for(let i=0;i<8;i++){const length=i%2?.44:.68,shape=new THREE.Shape([new THREE.Vector2(0,length),new THREE.Vector2(.10,.07),new THREE.Vector2(0,-.08),new THREE.Vector2(-.10,.07)]);shape.closePath();const point=extrude(group,shape,i%2?m.satin:m.polished,{z:.14,depth:i%2?.015:.035,bevel:.006});point.rotation.z=i*Math.PI/4;}
  mesh(group,new THREE.OctahedronGeometry(.13),m.polished,0,0,.22);
}
function petalShape() {
  const shape=new THREE.Shape();
  shape.moveTo(0,.18);
  shape.bezierCurveTo(-.22,.32,-.36,.62,-.235,.80);
  shape.quadraticCurveTo(-.08,.94,0,1.01);
  shape.quadraticCurveTo(.08,.94,.235,.80);
  shape.bezierCurveTo(.36,.62,.22,.32,0,.18);
  shape.closePath();return shape;
}

function pearlPetal(group,shape,material) {
  const points=shape.getSpacedPoints(48),ridge=new THREE.Vector3(0,.61,.325),vertices=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    vertices.push(a.x,a.y,.235,b.x,b.y,.235,...ridge.toArray());
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const petal=mesh(group,geometry,material);petal.scale.set(.76,.91,1);petal.position.y=.025;
}

function rosetteMedal(group,medal,m) {
  const outline=medalOutline(medal),petal=petalShape();
  const settingGold=new THREE.MeshPhysicalMaterial({color:new THREE.Color(m.palette.metal).multiplyScalar(.58),metalness:.84,roughness:.24});
  extrude(group,outline,m.satin,{z:-.11,depth:.17,bevel:.021});
  traceShape(group,outline,1,.08,.012,m.polished);
  const pearl=new THREE.MeshPhysicalMaterial({color:'#eee6d4',metalness:.26,roughness:.22,clearcoat:1,clearcoatRoughness:.12,iridescence:.24,iridescenceIOR:1.35,iridescenceThicknessRange:[170,310],side:THREE.DoubleSide});
  for(let i=0;i<8;i++){
    const a=i*TAU/8;
    const under=new THREE.Group();group.add(under);under.rotation.z=a+Math.PI/8;
    const leaf=extrude(under,petal,m.satin,{z:.08,depth:.026,bevel:.012});leaf.scale.set(.72,.94,1);
    traceShape(under,petal,.87,.13,.006,m.polished);
    traceShape(under,petal,.79,.135,.004,m.polished);
    const face=new THREE.Group();group.add(face);face.rotation.z=a;
    extrude(face,petal,settingGold,{z:.13,depth:.045,bevel:.015,segments:16});
    const setting=petalShape();
    setting.holes.push(new THREE.Path(petal.getPoints(96).map(p=>new THREE.Vector2(p.x*.77,p.y*.91+.025)).reverse()));
    extrude(face,setting,settingGold,{z:.185,depth:.035,bevel:.010,segments:16});
    traceShape(face,petal,1,.215,.012,m.polished);
    pearlPetal(face,petal,pearl);
    const inset=traceShape(face,petal,1,.244,.009,m.polished);inset.scale.set(.76,.91,1);inset.position.y=.025;
    curveTube(face,[new THREE.Vector3(0,.35,.27),new THREE.Vector3(0,.60,.329),new THREE.Vector3(0,.88,.26)],.0025,m.satin);
    bead(group,.022,.79*Math.cos(a+Math.PI/8),.79*Math.sin(a+Math.PI/8),.16,m.polished);
  }
  for(let i=0;i<16;i++){
    const a=Math.PI/2+i*TAU/16;
    const point=(r,angle,z)=>[Math.cos(angle)*r,Math.sin(angle)*r,z];
    const left=point(.255,a-.09,.35),right=point(.255,a+.09,.35),tip=point(.46,a,.35);
    const base=new THREE.Shape([left,tip,right].map(([x,y])=>new THREE.Vector2(x,y)));base.closePath();
    extrude(group,base,settingGold,{z:.315,depth:.032,bevel:.007,segments:4});
    shard(group,[left,tip,right,point(.335,a,.425)],m.polished);
  }
  ring(group,.215,.019,.379,m.polished);ring(group,.239,.006,.363,m.satin);
  const crystal=new THREE.MeshPhysicalMaterial({color:'#e5e9ed',metalness:.32,roughness:.10,clearcoat:1,clearcoatRoughness:.05,flatShading:true});
  const gem=mesh(group,new THREE.IcosahedronGeometry(.181,0),crystal,0,0,.405);gem.scale.z=.57;gem.rotation.set(.16,.21,.12);
  for(let i=0;i<8;i++){
    const a=i*TAU/8;
    bead(group,.028,.198*Math.cos(a),.198*Math.sin(a),.418,m.polished);
  }
  addBack(group,medal,m,.78);
}
function prism(group,medal,m){
  shapedCase(group,medal,m,medalOutline(medal));
  traceShape(group,roundedPolygon(3,.77,Math.PI/2,.035),1,.14,.018,m.polished);
  const gem=mesh(group,new THREE.OctahedronGeometry(.43,0),m.polished,0,-.03,.25);gem.rotation.set(.25,.50,.15);
  for(let i=0;i<3;i++){const a=Math.PI/2+i*TAU/3;bead(group,.048,.81*Math.cos(a),.81*Math.sin(a),.15,m.polished);}
}
const constellationPoints=[[-.65,-.25],[-.32,.38],[-.1,.05],[.22,.55],[.58,.26],[.40,-.38],[-.12,-.47]];
function constellation(group,medal,m){
  shapedCase(group,medal,m,medalOutline(medal));
  curveTube(group,constellationPoints.map(([x,y])=>new THREE.Vector3(x,y,.15)),.012,m.polished);
  for(const [i,[x,y]] of constellationPoints.entries()){if(i%2){const star=extrude(group,starShape(5,.10,.045),m.polished,{z:.17,depth:.022,bevel:.005});star.position.x=x;star.position.y=y;}else bead(group,.048,x,y,.17,m.polished);}
  for(const [x,y] of [[-.61,.56],[-.50,-.53],[.05,.75],[.60,-.12],[.18,-.68]])bead(group,.012,x,y,.12,m.satin);
}
function galaxy(group,medal,m){
  shapedCase(group,medal,m,medalOutline(medal));
  for(let arm=0;arm<3;arm++){const points=[];for(let i=0;i<=100;i++){const t=i/100,a=.4+t*4.5+arm*TAU/3,r=.16+t*.58;points.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,.14+.10*(1-t)));}curveTube(group,points,arm===1?.040:.030,arm===1?m.satin:m.polished);}
  const core=new THREE.MeshPhysicalMaterial({color:'#a8d9ea',metalness:.8,roughness:.11,clearcoat:1,iridescence:.6});
  mesh(group,new THREE.IcosahedronGeometry(.15,1),core,0,0,.24);
  ring(group,.83,.006,.12,m.polished);for(let i=0;i<18;i++){const a=i*TAU/18;bead(group,.008,.80*Math.cos(a),.80*Math.sin(a),.13,m.polished);}
}
function glyphPath(text, transform = (x,y) => [x,y]) {
  const path = new THREE.ShapePath();
  let advance = 0;
  for (const char of text) {
    const glyph = NUMERAL_GLYPHS[char];
    if (!glyph) continue;
    for (const [op,...values] of glyph.commands) {
      const p=[];
      for(let i=0;i<values.length;i+=2)p.push(...transform(values[i]+advance,values[i+1]));
      if(op==='M')path.moveTo(...p);
      else if(op==='L')path.lineTo(...p);
      else if(op==='Q')path.quadraticCurveTo(...p);
      else if(op==='C')path.bezierCurveTo(...p);
      else path.currentPath.closePath();
    }
    advance += glyph.advance + 28;
  }
  return path.toShapes();
}

function fittedLettering(text, height, width, y=0) {
  const bounds = new THREE.Box2().setFromPoints(glyphPath(text).flatMap(shape=>shape.getPoints(32)));
  const size=bounds.getSize(new THREE.Vector2()),center=bounds.getCenter(new THREE.Vector2());
  const scale=Math.min(height/size.y,width/size.x);
  return glyphPath(text,(x,py)=>[(x-center.x)*scale,(py-center.y)*scale+y]);
}

const letteringCache = new Map();
function numericLettering(medal) {
  const text=String(medal.number||'1').replace(/[^0-9]/g,'')||'1';
  const suffix=medal.suffix||'';
  const key=`${text}:${suffix}`;
  if(!letteringCache.has(key)){
    const shapes=fittedLettering(text,text.length===1?1.20:1.04,text.length===1?.89:1.30,suffix?.12:0);
    if(suffix==='M')shapes.push(...fittedLettering('M',.23,.28,-.67));
    letteringCache.set(key,shapes);
  }
  return letteringCache.get(key);
}

function scallopedMedallion(radius=1.015, lobes=10) {
  const shape=new THREE.Shape();
  for(let i=0;i<=320;i++){
    const angle=Math.PI/2+i/320*TAU;
    const r=radius*(1+.037*Math.cos(lobes*(angle-Math.PI/2)));
    const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
    if(i)shape.lineTo(x,y);else shape.moveTo(x,y);
  }
  shape.closePath();return shape;
}

function medalOutline(medal) {
  const design=medal.design || medal.id;
  if(design==='numeric') {
    if(medal.series==='weekly')return roundedPolygon(6,1.05,Math.PI/2,.065);
    if(medal.series==='monthly')return scallopedMedallion();
    if(medal.series==='days')return roundedPolygon(8,1.04,Math.PI/8,.09);
    const shape=new THREE.Shape();shape.absarc(0,0,1.02,0,TAU,false);return shape;
  }
  if(design==='rise')return roundedPolygon(6,1.045,Math.PI/6,.13);
  if(design==='evergreen')return evergreenOutline();
  if(design==='compass')return roundedPolygon(8,1.045,Math.PI/8,.06);
  if(design==='rosette')return scallopedMedallion(1,8);
  if(design==='prism')return roundedPolygon(3,1.12,Math.PI/2,.09);
  if(design==='constellation')return starShape(5,1.07,.89);
  if(design==='galaxy')return roundedPolygon(12,1.04,Math.PI/12,.12);
  if(design==='first')return cushion(1.12);
  if(design==='beyond')return roundedPolygon(12,1.04,Math.PI/12,.22);
  if(design==='dawn')return flutedCircle(1.015);
  const shape=new THREE.Shape();shape.absarc(0,0,1.02,0,TAU,false);return shape;
}
function metalBand(points,width) {
  const left=[],right=[];
  for(let i=0;i<points.length;i++){
    const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
    const tangent=after.clone().sub(before).normalize(),normal=new THREE.Vector2(-tangent.y,tangent.x).multiplyScalar(width);
    left.push(points[i].clone().add(normal));right.push(points[i].clone().sub(normal));
  }
  const shape=new THREE.Shape([...left,...right.reverse()]);shape.closePath();return shape;
}
function numericEngraving(medal) {
  const key=`enamel:${medal.series}:${medal.metal}`;
  if(textureCache.has(key))return textureCache.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;
  const ctx=canvas.getContext('2d'),p=palette(medal);
  ctx.fillStyle=p.field;ctx.fillRect(0,0,1024,1024);
  ctx.translate(512,512);ctx.scale(470,-470);ctx.lineWidth=medal.series==='monthly'?.0032:.0019;
  ctx.strokeStyle=p.bright;ctx.globalAlpha=medal.series==='daily'?.24:medal.series==='monthly'?.62:.29;
  if(medal.series==='daily'){
    for(let i=0;i<28;i++){
      ctx.save();ctx.rotate(i*TAU/28);ctx.beginPath();ctx.ellipse(0,0,.86,.48,0,0,TAU);ctx.stroke();ctx.restore();
    }
  }else if(medal.series==='monthly'){
    for(let i=0;i<6;i++){
      const a=i*TAU/6;
      ctx.beginPath();ctx.ellipse(Math.cos(a)*.34,Math.sin(a)*.34,.53,.53,0,0,TAU);ctx.stroke();
    }
  }else{
    for(const scale of [.81,.78,.75]){
      const points=medalOutline(medal).getPoints(96);ctx.beginPath();
      points.forEach((p,i)=>i?ctx.lineTo(p.x*scale,p.y*scale):ctx.moveTo(p.x*scale,p.y*scale));ctx.closePath();ctx.stroke();
    }
  }
  const texture=canvasTexture(canvas,true);
  texture.repeat.set(.5,.5);texture.offset.set(.5,.5);
  textureCache.set(key,texture);return texture;
}

function domedEnamel(group,outline,material) {
  const segments=160,rings=20,points=outline.getSpacedPoints(segments).slice(0,-1);
  const vertices=[0,0,.167],uvs=[0,0],indices=[];
  for(let r=1;r<=rings;r++)for(const p of points){
    const t=r/rings,x=p.x*.912*t,y=p.y*.912*t;
    vertices.push(x,y,.122+.045*(1-t*t));uvs.push(x,y);
  }
  for(let j=0;j<segments;j++)indices.push(0,1+j,1+(j+1)%segments);
  for(let r=0;r<rings-1;r++)for(let j=0;j<segments;j++){
    const a=1+r*segments+j,b=1+r*segments+(j+1)%segments,c=a+segments,d=b+segments;
    indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  return mesh(group,geometry,material);
}

function numericMedal(group,medal,m) {
  const shape=medalOutline(medal);
  extrude(group,shape,m.satin,{z:-.096,depth:.178,bevel:.031});
  traceShape(group,shape,1,.11,.016,m.polished);
  traceShape(group,shape,.975,.13,.007,m.recess);
  const enamel=new THREE.MeshPhysicalMaterial({map:numericEngraving(medal),metalness:.22,roughness:.20,clearcoat:1,clearcoatRoughness:.065,bumpMap:engineTurnedTexture(),bumpScale:.0007});
  domedEnamel(group,shape,enamel);
  traceShape(group,shape,.925,.125,.011,m.polished);
  traceShape(group,shape,.899,.13,.003,m.satin);
  const numeral=new THREE.MeshPhysicalMaterial({color:m.palette.bright,metalness:.74,roughness:.28,clearcoat:.45,bumpMap:brushedTexture(),bumpScale:.0005});
  for(const letter of numericLettering(medal)){
    const relief=extrude(group,letter,numeral,{z:.17,depth:.048,bevel:.010,segments:12});
    const positions=relief.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i);positions.setZ(i,positions.getZ(i)+.025*(1-x*x-y*y));}
    relief.geometry.computeVertexNormals();
  }
  if(medal.series==='weekly')for(let i=0;i<6;i++){
    const angle=Math.PI/2+i*TAU/6;
    const jewel=mesh(group,new THREE.OctahedronGeometry(.088,0),m.polished,.912*Math.cos(angle),.912*Math.sin(angle),.188);
    jewel.scale.set(.85,1.08,.65);jewel.rotation.z=angle-Math.PI/2;
  }
  addBack(group,medal,m,medal.series==='weekly'?.80:medal.series==='days'?.86:.91);
}

function drawNumericLines(ctx,medal) {
  const shape=(outline,scale=1)=>{
    const trace=path=>{ctx.beginPath();path.getPoints(64).forEach((p,i)=>i?ctx.lineTo(p.x*scale,p.y*scale):ctx.moveTo(p.x*scale,p.y*scale));ctx.closePath();ctx.stroke();};
    trace(outline);for(const hole of outline.holes)trace(hole);
  };
  ctx.strokeStyle='#9ca5b1';ctx.lineWidth=.008;
  for(const scale of [.974,.925,.899])shape(medalOutline(medal),scale);
  ctx.save();ctx.beginPath();ctx.arc(0,0,.88,0,TAU);ctx.clip();
  ctx.strokeStyle='#adb5bf';ctx.lineWidth=.005;
  if(medal.series==='daily')for(let i=0;i<14;i++){
    ctx.beginPath();ctx.ellipse(0,0,.86,.48,i*TAU/14,0,TAU);ctx.stroke();
  }
  else if(medal.series==='monthly')for(let i=0;i<6;i++){
    const a=i*TAU/6;ctx.beginPath();ctx.arc(Math.cos(a)*.34,Math.sin(a)*.34,.53,0,TAU);ctx.stroke();
  }
  else for(const scale of [.81,.77,.73])shape(medalOutline(medal),scale);
  ctx.restore();
  ctx.strokeStyle='#748092';ctx.lineWidth=.012;ctx.fillStyle='#f7f8fa';
  for(const letter of numericLettering(medal)){
    ctx.beginPath();
    for(const path of [letter,...letter.holes]){
      path.getPoints(48).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
    }
    const composite=ctx.globalCompositeOperation;ctx.globalCompositeOperation='destination-out';ctx.fill('evenodd');ctx.globalCompositeOperation=composite;ctx.stroke();
  }
  if(medal.series==='weekly')for(let i=0;i<6;i++){
    const a=Math.PI/2+i*TAU/6,x=.912*Math.cos(a),y=.912*Math.sin(a);
    ctx.beginPath();ctx.moveTo(x,y+.09);ctx.lineTo(x+.065,y);ctx.lineTo(x,y-.09);ctx.lineTo(x-.065,y);ctx.closePath();ctx.stroke();
  }
}

function drawFeatureLines(ctx,medal){
  const design=medal.design||medal.id;
  const line=(points,closed=false)=>{ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(closed)ctx.closePath();ctx.stroke();};
  const shape=(outline,scale=1)=>line(outline.getPoints(96).map(p=>[p.x*scale,p.y*scale]),true);
  const circle=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();};
  ctx.save();ctx.strokeStyle='#a1aab7';ctx.lineWidth=.010;shape(medalOutline(medal),.90);
  ctx.strokeStyle='#758194';ctx.lineWidth=.018;
  if(design==='orbit'){
    for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,.63,.27,i*Math.PI/3+.13,0,TAU);ctx.stroke();const a=i*TAU/3+.33;circle(.63*Math.cos(a),.63*Math.sin(a),.045);}
    line(Array.from({length:6},(_,i)=>[.17*Math.cos(i*TAU/6),.17*Math.sin(i*TAU/6)]),true);
    line([[-.17,0],[.17,0]]);line([[0,-.147],[0,.147]]);
  }else if(design==='beyond'){
    const points=Array.from({length:161},(_,i)=>{const a=i/160*TAU;return new THREE.Vector2(.62*Math.sin(a),.34*Math.sin(2*a));});
    shape(metalBand(points,.035));
  }else if(design==='first'){
    ctx.save();ctx.rotate(Math.PI/4);
    for(let i=0;i<3;i++){const size=.63-i*.18;shape(cushion(size));shape(cushion(size*.64));}
    ctx.restore();line([[0,.10],[.10,0],[0,-.10],[-.10,0]],true);
  }else if(design==='lunar'){
    circle(0,0,.74);
    const crescent=new THREE.Shape(),a=Math.atan2(.55,.32),r=Math.hypot(.32,.55),inner=Math.atan2(.55,.02);
    crescent.absarc(0,0,r,a,TAU-a,false);crescent.absarc(.30,0,Math.hypot(.02,.55),-inner,inner,true);crescent.closePath();
    ctx.save();ctx.rotate(-.2);shape(crescent);ctx.restore();
    for(const [x,y,radius] of [[-.39,.16,.10],[-.48,-.12,.07],[-.26,-.36,.06],[-.28,.40,.045]])circle(x,y,radius);
    ctx.lineWidth=.012;ctx.beginPath();ctx.ellipse(0,0,.81,.43,-.45,0,TAU);ctx.stroke();circle(.5,.44,.055);
  }else if(design==='rise'){
    for(const [a,b,c,ridge] of [[[-.59,-.34],[-.22,-.51],[.05,.47],[-.20,-.10]],[[-.20,-.48],[.16,-.33],[.43,.66],[.13,.02]],[[.18,-.32],[.54,-.13],[.61,.42],[.40,.04]]]){
      line([a,b,c],true);ctx.lineWidth=.010;for(const point of [a,b,c])line([point,ridge]);ctx.lineWidth=.018;
    }
    line([[-.57,-.59],[-.1,-.62],[.55,-.27]]);
  }else if(design==='dawn'){
    ctx.beginPath();ctx.arc(0,-.10,.405,0,Math.PI);ctx.closePath();ctx.stroke();
    for(let i=0;i<11;i++){const a=.10+i/10*(Math.PI-.20),r=i%2?.64:.74;line([[Math.cos(a-.018)*.47,Math.sin(a-.018)*.47-.10],[Math.cos(a)*r,Math.sin(a)*r-.10],[Math.cos(a+.018)*.47,Math.sin(a+.018)*.47-.10]],true);}
    ctx.lineWidth=.012;for(let i=0;i<5;i++){const width=.63-i*.065,y=-.17-i*.09;ctx.beginPath();ctx.moveTo(-width,y);ctx.quadraticCurveTo(0,y-.06,width,y);ctx.stroke();}
  }else if(design==='evergreen'){
    circle(0,.18,.64);
    ctx.lineWidth=.014;
    for(const points of evergreenBranches){const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)));line(curve.getPoints(40).map(p=>[p.x,p.y]));}
    shape(treeTrunkShape());
    for(const side of [-1,1])line([[0,-.48],[side*.14,-.57],[side*.32,-.61]]);
    for(const [x,y,angle] of evergreenLeaves){
      ctx.save();ctx.translate(x,y);ctx.rotate(angle);
      const points=treeLeafShape().getPoints(32);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.globalCompositeOperation='destination-out';ctx.fill();ctx.globalCompositeOperation='source-over';ctx.stroke();
      ctx.lineWidth=.007;line([[0,-.11],[0,.13]]);ctx.restore();
    }
    ctx.beginPath();ctx.ellipse(0,-.64,.34,.065,0,0,TAU);ctx.stroke();
  }else if(design==='compass'){
    circle(0,0,.74);for(let i=0;i<8;i++){ctx.save();ctx.rotate(i*Math.PI/4);line([[0,i%2?.44:.68],[.10,.07],[0,-.08],[-.10,.07]],true);ctx.restore();}circle(0,0,.13);
  }else if(design==='rosette'){
    ctx.lineWidth=.010;
    for(let i=0;i<8;i++){
      ctx.save();ctx.rotate(i*TAU/8+Math.PI/8);shape(petalShape(),.92);ctx.restore();
    }
    const filled=(outline,scale=1)=>{
      ctx.beginPath();outline.getPoints(64).forEach((p,i)=>i?ctx.lineTo(p.x*scale,p.y*scale):ctx.moveTo(p.x*scale,p.y*scale));
      ctx.closePath();const composite=ctx.globalCompositeOperation;ctx.globalCompositeOperation='destination-out';ctx.fill();ctx.globalCompositeOperation=composite;ctx.stroke();
    };
    for(let i=0;i<8;i++){
      ctx.save();ctx.rotate(i*TAU/8);filled(petalShape());shape(petalShape(),.955);
      const p=petalShape().getPoints(64).map(p=>[p.x*.76,p.y*.91+.025]);line(p,true);
      ctx.lineWidth=.006;line([[0,.35],[0,.60],[0,.88]]);ctx.lineWidth=.010;ctx.restore();
    }
    filled(starShape(16,.46,.255));circle(0,0,.239);circle(0,0,.215);
    for(let i=0;i<8;i++){const a=i*TAU/8;circle(.198*Math.cos(a),.198*Math.sin(a),.025);}
    const gem=Array.from({length:8},(_,i)=>[.17*Math.cos(i*TAU/8),.17*Math.sin(i*TAU/8)]);
    line(gem,true);ctx.lineWidth=.007;
    for(let i=0;i<8;i++)line([gem[i],[.075*Math.cos((i+.5)*TAU/8),.075*Math.sin((i+.5)*TAU/8)],gem[(i+1)%8]]);
    circle(0,0,.075);
  }else if(design==='prism'){
    shape(roundedPolygon(3,.77,Math.PI/2,.035));line([[0,.40],[.39,-.04],[0,-.46],[-.39,-.04]],true);line([[0,.40],[0,-.46]]);line([[-.39,-.04],[.39,-.04]]);
  }else if(design==='constellation'){
    line(constellationPoints);for(const [i,[x,y]] of constellationPoints.entries()){ctx.save();ctx.translate(x,y);if(i%2)shape(starShape(5,.10,.045));else circle(0,0,.048);ctx.restore();}
  }else if(design==='galaxy'){
    for(let arm=0;arm<3;arm++){const points=Array.from({length:101},(_,i)=>{const t=i/100,a=.4+t*4.5+arm*TAU/3,r=.16+t*.58;return new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r);});shape(metalBand(points,.024));}circle(0,0,.15);circle(0,0,.83);
  }
  ctx.restore();
}
function drawFlat(stage, locked=false) {
  const {ctx,canvas,medal}=stage,w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(w/2,h/2);const scale=Math.min(w,h)*.345;ctx.scale(scale,-scale);
  const points=medalOutline(medal).getPoints(128);
  const path=()=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();};path();
  ctx.lineJoin='round';ctx.lineCap='round';
  if(!locked){const gradient=ctx.createLinearGradient(-1,1,1,-1);gradient.addColorStop(0,'#f4f1de');gradient.addColorStop(.4,palette(medal).field);gradient.addColorStop(1,'#18354a');ctx.fillStyle=gradient;ctx.fill();}
  ctx.strokeStyle=locked?'#858d98':palette(medal).bright;ctx.lineWidth=locked?.014:.035;ctx.stroke();
  if(!locked&&Math.cos(stage.y)<0){ctx.scale(1,-1);ctx.fillStyle='#e9e6d7';ctx.textAlign='center';ctx.font='.13px system-ui';ctx.fillText('DSH MEDALS',0,-.46);ctx.font='.17px system-ui';ctx.fillText(medal.name,0,-.08);ctx.font='.105px system-ui';ctx.fillText(medal.period,0,.18);ctx.fillText('#'+medal.serial,0,.43);}
  else if(medal.design==='numeric')drawNumericLines(ctx,medal);
  else if(locked)drawFeatureLines(ctx,medal);
  ctx.restore();
}

function buildMedal(medal) {
  const key = `${medal.id}:${medal.serial}:${medal.period}`;
  if (models.has(key)) return models.get(key);
  const group = new THREE.Group(), m = materialsFor(medal);
  ({numeric:numericMedal,orbit,lunar:moon,rise:growth,dawn,first:milestone,beyond,evergreen,compass,rosette:rosetteMedal,prism,constellation,galaxy}[medal.design||medal.id]||orbit)(group,medal,m);
  models.set(key, group);
  return group;
}

function pruneModels() {
  const active=new Set([...stages].map(stage=>stage.model));
  const inactive=[...models.entries()].filter(([,model])=>!active.has(model));
  const sharedMaterials=new Set([...materialCache.values()].flatMap(m=>[m.satin,m.polished,m.recess,m.enamel]));
  const sharedTextures=new Set(textureCache.values());
  for(const [key,model] of inactive.slice(0,Math.max(0,inactive.length-8))){
    models.delete(key);engine?.scene.remove(model);
    const materials=new Set(),textures=new Set();
    model.traverse(object=>{if(!object.isMesh)return;object.geometry.dispose();if(!sharedMaterials.has(object.material))materials.add(object.material);});
    for(const material of materials){for(const value of Object.values(material))if(value?.isTexture&&!sharedTextures.has(value))textures.add(value);material.dispose();}
    textures.forEach(texture=>texture.dispose());
  }
}

function studioEnvironment(renderer) {
  const studio = new THREE.Scene(); studio.background = new THREE.Color(.08, .09, .11);
  const room = new THREE.Mesh(new THREE.BoxGeometry(24,24,24), new THREE.MeshBasicMaterial({ color: new THREE.Color(.095,.11,.135), side: THREE.BackSide })); studio.add(room);
  function softbox(width, height, position, radiance, tint) {
    const color = new THREE.Color(tint).multiplyScalar(radiance);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width,height), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false }));
    panel.position.set(...position); panel.lookAt(0,0,0); studio.add(panel);
  }
  softbox(11, 10, [0,.5,8], 1.8, '#f1f5ff');
  softbox(5, 9, [-4.5,3.8,6], 6, '#fff6e5');
  softbox(1.3, 8, [4,1,5], 11, '#e0ecff');
  softbox(8, 1.8, [0,6,2], 8, '#ffffff');
  softbox(2, 6, [-5,-1,-4], 4, '#91a8d8');
  softbox(7, 1, [1,-5,3], 3, '#f9d5a4');
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(studio, .035, .1, 60, { size: 256 });
  generator.dispose();
  studio.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return target;
}

function getEngine() {
  if (engine) return engine;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setClearColor(0,0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  const scene = new THREE.Scene(); const environment = studioEnvironment(renderer); scene.environment = environment.texture; scene.environmentIntensity = 1.0;
  const camera = new THREE.PerspectiveCamera(30,1,.1,30); camera.position.set(0,0,5.5);
  const key = new THREE.DirectionalLight('#fff3dc', 2.2); key.position.set(-3,4,6); scene.add(key);
  const fill = new THREE.DirectionalLight('#f0f4ff', 1.1);fill.position.set(0,-1,6);scene.add(fill);
  const bounce = new THREE.HemisphereLight('#eef3ff','#b4a394', .65);scene.add(bounce);
  const rim = new THREE.DirectionalLight('#b9d5ff', 1.5); rim.position.set(4,1,2); scene.add(rim);
  // A warm light that sweeps across the metal once when a medal lands.
  const glint = new THREE.DirectionalLight('#fff1d6', 0); scene.add(glint);
  engine = { renderer, scene, camera, environment, glint, renders: 0, healthy: true };
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); engine.healthy = false; for (const stage of stages) stage.useFallback(); });
  return engine;
}

function animationTick(time) {
  frame = 0;
  const candidates = [...stages].filter(stage => stage.shouldAnimate());
  if (!candidates.length) return;
  // Spinning and entrance stages draw every frame; idle breathing stays at a gentle 25fps.
  const throttled = time - previousFrame > 40;
  if (throttled) previousFrame = time;
  for (const stage of candidates) if (throttled || stage.smooth()) stage.draw(time);
  frame = requestAnimationFrame(animationTick);
}

function wake() { if (!frame && !document.hidden && !reducedMotion.matches && [...stages].some(stage => stage.shouldAnimate())) frame = requestAnimationFrame(animationTick); }

const SPIN_SPEED = TAU / 12000; // radians per ms: one turn every 12 seconds
const SPIN_TILT = .12;
const RESUME_DELAY = 2000;
const ENTRANCE_FLIGHT = 1800, ENTRANCE_SETTLE = 450, GLINT_DURATION = 1100;
const POSE = { x: .1, y: -.22 };
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const approach = (value, target, dt, ms) => value + (target - value) * (1 - Math.exp(-dt / ms));

class MedalStage {
  constructor(canvas, { medal, interactive = false, autoSpin = false, onFallback = () => {} }) {
    this.canvas = canvas; this.medal = medal; this.interactive = interactive; this.autoSpin = autoSpin; this.onFallback = onFallback;
    this.ctx = canvas.getContext('2d', { alpha: true });
    const bounds=canvas.getBoundingClientRect();
    this.x = .17; this.y = -.32; this.visible = bounds.width>0&&bounds.height>0&&bounds.bottom>0&&bounds.top<innerHeight&&bounds.right>0&&bounds.left<innerWidth; this.fallback = false; this.destroyed = false;
    this.cinematic = canvas.matches('.hero-canvas,.reveal-canvas') || interactive;
    this.width = 0; this.height = 0; this.listeners = [];
    this.resetMotion();
    this.resizeObserver = new ResizeObserver(() => this.draw()); this.resizeObserver.observe(canvas);
    this.visibilityObserver = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; if (this.visible) { this.draw(); wake(); } }); this.visibilityObserver.observe(canvas);
    stages.add(this); pruneModels(); this.bind(); this.draw(); wake();
  }

  static get diagnostics() { return { engine: 'three.js', revision: THREE.REVISION, webgl: !!engine?.healthy, renders: engine?.renders || 0, contexts: engine ? 1 : 0, cachedModels: models.size }; }

  resetMotion() {
    this.spin = 0; this.inertia = 0; this.spinDirection = 1; this.paused = false; this.lastTime = 0;
    // Start turning shortly after a medal opens rather than waiting the full resume delay.
    this.idleSince = performance.now() - RESUME_DELAY + 400;
    this.endEntrance(); this.glintStart = 0; this.pose = { scale: 1, z: 0, lift: 0 }; this.glint = 0; this.sweep = 0;
  }

  shouldAnimate() {
    if (this.medal.locked || this.destroyed || this.fallback || !this.visible || !this.cinematic || reducedMotion.matches || document.hidden) return false;
    const dialog = this.canvas.closest('dialog');
    return dialog ? dialog.open : !document.querySelector('dialog[open]');
  }

  // Stop an entrance early (drag, orient, fallback) and still let the caller reveal its copy.
  endEntrance() { const e = this.entrance; this.entrance = null; this.pose = { scale: 1, z: 0, lift: 0 }; if (e && !e.landed) { e.landed = true; e.resolve(); } }

  smooth() { return !!this.entrance || !!this.glintStart || (this.autoSpin && !this.paused) || this.inertia !== 0 || !!this.settling; }

  // Advance entrance, inertia and auto-spin for this frame.
  step(time) {
    const dt = this.lastTime ? Math.min(64, time - this.lastTime) : 0; this.lastTime = time;
    if (this.entrance) return this.stepEntrance(time);
    if (this.glintStart) {
      const g = (time - this.glintStart) / GLINT_DURATION;
      if (g >= 1) { this.glintStart = 0; this.glint = 0; this.sweep = 0; }
      else { this.glint = Math.sin(g * Math.PI) ** 2; this.sweep = easeInOut(g); }
    }
    if (this.dragging || !dt) return;
    if (this.inertia) {
      this.y += this.inertia * dt; this.inertia *= Math.exp(-dt / 420);
      if (Math.abs(this.inertia) < SPIN_SPEED * .5) { this.inertia = 0; this.idleSince = time; }
    }
    if (!this.autoSpin) {
      // Stages without auto-spin drift back to their display pose after being turned.
      if (this.interactive && !this.inertia && time - this.idleSince > RESUME_DELAY + 500) {
        const restY = -.32 + Math.round((this.y + .32) / TAU) * TAU;
        this.y = approach(this.y, restY, dt, 600); this.x = approach(this.x, .17, dt, 600);
        this.settling = Math.abs(this.y - restY) > .002 || Math.abs(this.x - .17) > .002;
      }
      return;
    }
    const resting = !this.paused && !this.inertia && time - this.idleSince > RESUME_DELAY;
    this.spin = approach(this.spin, resting ? SPIN_SPEED * this.spinDirection : 0, dt, 700);
    if (Math.abs(this.spin) < 1e-6) this.spin = 0;
    this.y += this.spin * dt;
    if (resting) this.x = approach(this.x, SPIN_TILT, dt, 1400);
  }

  stepEntrance(time) {
    const e = this.entrance; e.start ??= time;
    const elapsed = time - e.start, f = Math.min(1, elapsed / ENTRANCE_FLIGHT), ease = easeOutCubic(f);
    this.y = POSE.y - this.spinDirection * 2 * TAU * (1 - ease);
    this.x = POSE.x + .55 * (1 - ease);
    const settle = Math.min(1, Math.max(0, (elapsed - ENTRANCE_FLIGHT) / ENTRANCE_SETTLE));
    this.pose = { z: -18 * (1 - ease), lift: -.7 * (1 - ease), scale: .45 + .55 * ease + .04 * Math.sin(settle * Math.PI) * (1 - settle) };
    if (f >= 1 && !e.landed) { e.landed = true; this.glintStart = time; this.glint = 0; e.resolve(); }
    if (e.landed) { const g = Math.min(1, (time - this.glintStart) / GLINT_DURATION); this.glint = Math.sin(g * Math.PI) ** 2; this.sweep = easeInOut(g); }
    if (settle >= 1) { this.entrance = null; this.pose = { scale: 1, z: 0, lift: 0 }; this.idleSince = time; }
  }

  // Fly the medal in from the depth of the scene. Resolves when it lands facing the viewer.
  playEntrance() {
    this.cancel(); this.resetMotion();
    const finish = () => { this.x = POSE.x; this.y = POSE.y; this.draw(); return Promise.resolve(); };
    if (this.medal.locked || this.fallback || reducedMotion.matches) return finish();
    return new Promise(resolve => {
      this.entrance = { start: null, landed: false, resolve };
      this.stepEntrance(this.entrance.start = performance.now()); this.entrance.start = null;
      this.lastTime = 0; this.draw(); wake();
    });
  }

  draw(time = 0) {
    if (this.destroyed || !this.visible || document.hidden) return;
    const bounds = this.canvas.getBoundingClientRect(); if (!bounds.width || !bounds.height) return;
    // Large full-panel stages trade a little sharpness for a steady 60fps.
    const ratio = Math.min(window.devicePixelRatio || 1, bounds.width * bounds.height > 400000 ? 1.5 : 2);
    const w = Math.round(bounds.width * ratio), h = Math.round(bounds.height * ratio);
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    if (this.medal.locked) return drawFlat(this,true);
    if (this.fallback) return this.drawFallback();
    try{this.engine??=getEngine();this.model??=buildMedal(this.medal);}catch{return this.useFallback();}
    const { renderer, scene, camera, glint } = this.engine;
    if (!this.engine.healthy) return this.useFallback();
    if (time && this.cinematic) this.step(time);
    const previous = scene.getObjectByName('active-medal'); if (previous) scene.remove(previous);
    this.model.name = 'active-medal'; scene.add(this.model);
    const breathe = time && !this.dragging && !this.autoSpin && !this.entrance ? Math.sin(time * .00036) * .035 : 0;
    this.model.rotation.set(this.x + breathe * .3, this.y + breathe, -.035);
    this.model.position.set(0, this.pose.lift, this.pose.z); this.model.scale.setScalar(this.pose.scale);
    scene.environmentRotation.set(0, .27 + (time ? Math.sin(time * .00020) * .05 : 0) + (this.glint ? (this.sweep - .5) * 1.0 : 0), .12);
    glint.intensity = this.glint * 1.5; glint.position.set(-7 + this.sweep * 14, 3, 1.5);
    camera.aspect = w / h;
    camera.position.z = camera.aspect < 1 ? 5.25 / camera.aspect : 5.25;
    camera.updateProjectionMatrix();
    if (this.width !== w || this.height !== h) { renderer.setSize(w,h,false); this.width = w; this.height = h; }
    else { const size = renderer.getSize(new THREE.Vector2()); if (size.x !== w || size.y !== h) renderer.setSize(w,h,false); }
    renderer.render(scene,camera);
    // Share one PBR context across the collection; visible canvases retain their rendered frame.
    this.ctx.clearRect(0,0,w,h); this.ctx.drawImage(renderer.domElement,0,0,w,h); this.engine.renders++;
  }

  setMedal(medal) { this.cancel();this.medal = medal;this.model=null;this.x = .17; this.y = -.32;this.resetMotion();this.draw();pruneModels();wake(); }

  orient(side) {
    if(this.medal.locked)return;
    this.cancel(); this.endEntrance(); this.inertia = 0; this.spin = 0; this.paused = side !== 'reset'; this.idleSince = performance.now();
    const base = side === 'back' ? Math.PI : side === 'front' ? 0 : -.32;
    // Turn the short way round, even after many auto-spin revolutions.
    const startX = this.x, startY = this.y, targetX = side === 'reset' ? .17 : 0, targetY = base + Math.round((startY - base) / TAU) * TAU;
    if (reducedMotion.matches || this.fallback) { this.x = targetX; this.y = targetY; this.draw(); return; }
    const start = performance.now();
    const animate = time => { const t = Math.min((time - start) / 650,1), ease = 1 - Math.pow(1-t,4); this.x = startX + (targetX-startX) * ease; this.y = startY + (targetY-startY) * ease; this.idleSince = time; this.draw(); if (t < 1 && !this.destroyed) this.orientationFrame = requestAnimationFrame(animate); else { this.orientationFrame = 0; wake(); } };
    this.orientationFrame = requestAnimationFrame(animate);
  }

  useFallback() { this.fallback = true; this.cancel(); this.endEntrance(); this.onFallback(); this.drawFallback(); }

  drawFallback() {
    if (!this.ctx || this.destroyed) return;
    if(this.medal.locked)return drawFlat(this,true);
    const side = Math.cos(this.y) < 0 ? 'back' : 'front';
    const key = `${this.medal.design==='numeric'?this.medal.id:this.medal.design||this.medal.id}-${side}`;
    if (this.fallbackKey !== key) {
      this.fallbackKey = key; const image = new Image(); this.fallbackImage = image;
      image.onload = () => { if (this.fallbackImage === image) this.drawFallback(); };
      image.onerror = () => { if(this.fallbackImage===image)drawFlat(this,false); };
      image.src = new URL(`assets/medals/${key}.png`, scriptBase).href;
    }
    const image = this.fallbackImage; this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    if (image?.complete && image.naturalWidth) {
      const size = Math.min(this.canvas.width,this.canvas.height); this.ctx.drawImage(image,(this.canvas.width-size)/2,(this.canvas.height-size)/2,size,size);
    }else drawFlat(this,false);
  }

  listen(target, name, handler, options) { target.addEventListener(name,handler,options); this.listeners.push(() => target.removeEventListener(name,handler,options)); }

  bind() {
    if (!this.interactive) return;
    const canvas = this.canvas; canvas.style.touchAction = 'pan-y'; let pointer;
    const grab = () => { this.dragging = true; this.endEntrance(); this.spin = 0; this.inertia = 0; this.paused = false; };
    this.listen(canvas,'pointerdown', event => {
      if (this.medal.locked || event.button !== 0) return; this.cancel();
      pointer = { id:event.pointerId, x:event.clientX, y:event.clientY, originX:this.x, originY:this.y, active:event.pointerType !== 'touch', lastX:event.clientX, lastTime:event.timeStamp, velocity:0 };
      if (pointer.active) { canvas.setPointerCapture(event.pointerId); grab(); }
    });
    this.listen(canvas,'pointermove', event => {
      if (this.medal.locked || !pointer || event.pointerId !== pointer.id) return;
      const dx = event.clientX-pointer.x, dy=event.clientY-pointer.y;
      if (!pointer.active) {
        if (Math.abs(dy)>Math.abs(dx) && Math.abs(dy)>8) { pointer=undefined; return; }
        if (Math.abs(dx)<8) return; pointer.active=true; grab(); canvas.setPointerCapture(event.pointerId);
      }
      // Track a smoothed angular velocity so a flick keeps the medal turning.
      const elapsed = Math.max(1, event.timeStamp - pointer.lastTime), instant = (event.clientX - pointer.lastX) * .011 / elapsed;
      pointer.velocity = pointer.velocity * .6 + instant * .4; pointer.lastX = event.clientX; pointer.lastTime = event.timeStamp;
      this.y=pointer.originY+dx*.011; this.x=clamp(pointer.originX+dy*.006,-1.1,1.1); this.draw();
    });
    for (const name of ['pointerup','pointercancel','lostpointercapture']) this.listen(canvas,name,event=>{
      if (pointer?.active && this.dragging) {
        const stale = event.timeStamp - pointer.lastTime > 90, velocity = stale ? 0 : clamp(pointer.velocity, -.02, .02);
        if (Math.abs(velocity) > SPIN_SPEED) { this.inertia = velocity; this.spinDirection = Math.sign(velocity); }
      }
      pointer=undefined; this.dragging=false; this.idleSince=performance.now(); this.lastTime=0; wake();
    });
    this.listen(canvas,'keydown',event=>{
      if (this.medal.locked) return;
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
      event.preventDefault(); this.cancel(); if (event.key==='Home') return this.orient('reset');
      this.spin = 0; this.inertia = 0; this.idleSince = performance.now();
      if (event.key==='ArrowLeft') this.y-=.16; if(event.key==='ArrowRight')this.y+=.16;
      if(event.key==='ArrowUp')this.x-=.12; if(event.key==='ArrowDown')this.x+=.12; this.draw();
    });
  }

  cancel() { if (this.orientationFrame) cancelAnimationFrame(this.orientationFrame); this.orientationFrame = 0; }
  dispose() { this.destroyed=true; this.cancel(); this.endEntrance(); this.resizeObserver.disconnect(); this.visibilityObserver.disconnect(); for(const remove of this.listeners)remove(); stages.delete(this);pruneModels(); }
}

document.addEventListener('visibilitychange',()=>{ if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{for(const stage of stages)stage.draw();wake();} });
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){cancelAnimationFrame(frame);frame=0;}else wake();});
document.addEventListener('close',()=>{for(const stage of stages)stage.draw();wake();},true);
window.MedalStage = MedalStage;
