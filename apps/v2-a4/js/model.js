import * as THREE from 'three';
import { ROCKET } from './data.js';
import {
  makeCamo, makeConcrete, makeMetalBrush, makeRadialTexture,
  makeTextDecal, makeStencil, makeHeatTint, makeGrimeBand,
} from './textures.js';

const R = ROCKET.radius;
const B = ROCKET.baseY;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function mesh(geo, mat, { pos, rot, scale, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

function cylinderBetween(a, b, radius, mat, radialSegments = 10) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(vb, va);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, radialSegments, 1, false);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function tube(points, radius, mat, segments = 40, radialSegments = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
  return mesh(geo, mat);
}

function lathe(profile, segments = 128, phiStart = 0, phiLength = TAU) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segments, phiStart, phiLength);
}

function capsuleProfile(radius, height, domeSegments = 12) {
  const pts = [];
  const dome = Math.min(radius, height * 0.28);
  pts.push([0, 0]);
  for (let i = 1; i <= domeSegments; i++) {
    const a = -Math.PI / 2 + (i / domeSegments) * Math.PI / 2;
    pts.push([radius * Math.cos(a), dome + radius * Math.sin(a)]);
  }
  pts.push([radius, height - dome]);
  for (let i = 1; i <= domeSegments; i++) {
    const a = (i / domeSegments) * Math.PI / 2;
    pts.push([radius * Math.cos(a), height - dome + radius * Math.sin(a)]);
  }
  pts.push([0, height]);
  return pts;
}

function ringMesh(y, radius, tubeR, mat, segments = 72) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tubeR, 6, segments), mat);
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function textBand(text, { radius, y, height, theta = 1.05, sub = null, color = 'rgba(238,232,214,.95)', spacing = 2 } = {}) {
  const tex = makeTextDecal(text, {
    width: 1024, height: 256,
    font: '700 150px "Helvetica Neue", Helvetica, Arial, sans-serif',
    color, sub, spacing,
  });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, alphaTest: 0.01, toneMapped: true,
  });
  const geo = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true, -theta / 2, theta);
  const m = mesh(geo, mat, { pos: [0, y, 0], cast: false, receive: false });
  m.renderOrder = 4;
  return { mesh: m, material: mat };
}

function stencilBand(text, { radius, y, height, theta = 0.75, color = 'rgba(32,34,31,.8)' } = {}) {
  const tex = makeStencil(text, color);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, alphaTest: 0.01, toneMapped: true,
  });
  const geo = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true, -theta / 2, theta);
  const m = mesh(geo, mat, { pos: [0, y, 0], cast: false, receive: false });
  m.renderOrder = 4;
  return { mesh: m, material: mat };
}

function roundedPlateGeometry(w, h, r = 0.03, depth = 0.018) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 6 });
}

function placeOnHull(obj, angle, y, out = 0.012) {
  obj.position.set(Math.sin(angle) * (R + out), y, Math.cos(angle) * (R + out));
  obj.rotation.y = angle;
  return obj;
}

export function buildRocket() {
  const rocket = new THREE.Group();
  rocket.name = 'A4_V2';

  const camo = makeCamo();
  const concreteMap = makeConcrete();
  const brush = makeMetalBrush();
  const heatTint = makeHeatTint();
  const grimeTex = makeGrimeBand();

  const clipPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 2.4),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 2.4),
  ];
  const clipMaterials = [];
  const addClip = (mat) => {
    mat.clippingPlanes = clipPlanes;
    mat.clipIntersection = true;
    mat.clipShadows = true;
    clipMaterials.push(mat);
    return mat;
  };

  // ---------- Materiais ----------
  const hullMat = addClip(new THREE.MeshStandardMaterial({
    map: camo.map, roughnessMap: camo.roughnessMap, bumpMap: camo.bumpMap, bumpScale: 0.012,
    color: 0xc9c0aa, roughness: 0.88, metalness: 0.10, envMapIntensity: 0.32,
  }));
  const hullInnerMat = addClip(new THREE.MeshStandardMaterial({
    color: 0x2b2c29, roughness: 0.88, metalness: 0.35, side: THREE.BackSide, envMapIntensity: 0.2,
  }));
  const trimMat = addClip(new THREE.MeshStandardMaterial({ color: 0x3b3d3a, roughness: 0.62, metalness: 0.55 }));
  const rivetMat = addClip(new THREE.MeshStandardMaterial({ color: 0x5b5c54, roughness: 0.55, metalness: 0.7 }));
  const seamMat = addClip(new THREE.LineBasicMaterial({ color: 0x2d2e29, transparent: true, opacity: 0.55 }));
  const hatchMat = addClip(new THREE.MeshStandardMaterial({ color: 0x6c6e61, roughness: 0.72, metalness: 0.38 }));
  const decalMats = [];

  const finMat = new THREE.MeshStandardMaterial({
    map: camo.map, roughnessMap: camo.roughnessMap, bumpMap: camo.bumpMap, bumpScale: 0.010,
    color: 0xc9c0aa, roughness: 0.82, metalness: 0.16, side: THREE.DoubleSide, envMapIntensity: 0.32,
  });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x767a7c, roughness: 0.38, metalness: 0.92, roughnessMap: brush });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x303337, roughness: 0.45, metalness: 0.88, roughnessMap: brush });
  const blackSteelMat = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.6, metalness: 0.7 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0x9a5d3a, roughness: 0.38, metalness: 0.9 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xa57b43, roughness: 0.34, metalness: 0.92 });
  const graphiteMat = new THREE.MeshStandardMaterial({ color: 0x191b1d, roughness: 0.92, metalness: 0.12 });
  const aluMat = new THREE.MeshStandardMaterial({ color: 0x8b918e, roughness: 0.30, metalness: 0.92, roughnessMap: brush });
  const frostMat = new THREE.MeshStandardMaterial({ color: 0xaab6b3, roughness: 0.78, metalness: 0.16, bumpMap: camo.bumpMap, bumpScale: 0.014 });
  const amberMat = new THREE.MeshStandardMaterial({ color: 0xa77b39, roughness: 0.75, metalness: 0.08 });
  const insulationMat = new THREE.MeshStandardMaterial({ color: 0xbab7a8, roughness: 0.94, metalness: 0.04 });
  const wireRed = new THREE.MeshStandardMaterial({ color: 0x8f342c, roughness: 0.65, metalness: 0.1 });
  const wireBlue = new THREE.MeshStandardMaterial({ color: 0x2e566b, roughness: 0.65, metalness: 0.1 });
  const wireYellow = new THREE.MeshStandardMaterial({ color: 0x9c8439, roughness: 0.65, metalness: 0.1 });

  const nozzleMat = new THREE.MeshStandardMaterial({ map: heatTint, roughness: 0.42, metalness: 0.88, side: THREE.DoubleSide });
  const nozzleInnerMat = new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.55, metalness: 0.7, side: THREE.BackSide });

  // ---------- Perfis ----------
  const bodyProfile = [
    [0.64, 0.00], [0.78, 0.025], [0.825, 0.09],
    [0.825, 0.92], [0.808, 1.08], [0.825, 1.27],
    [0.825, 9.90], [0.817, 10.28], [0.802, 10.62],
    [0.780, 10.96], [0.750, 11.28],
  ];
  const noseBase = 11.28;
  const noseHeight = 2.72;
  const noseProfile = [[0.750, noseBase]];
  const noseSegments = 28;
  for (let i = 1; i <= noseSegments; i++) {
    const t = i / noseSegments;
    const r = 0.750 * Math.pow(1 - t, 0.72);
    noseProfile.push([Math.max(0, r), noseBase + t * noseHeight]);
  }
  noseProfile[noseProfile.length - 1] = [0.0, noseBase + noseHeight];

  // ---------- Fuselagem ----------
  const airframe = new THREE.Group();
  airframe.name = 'fuselagem';

  const bodyGeo = lathe(bodyProfile, 160);
  const bodyOuter = mesh(bodyGeo, hullMat);
  airframe.add(bodyOuter);

  const innerProfile = bodyProfile.map(([r, y], i) => [r * (i === 0 || i === bodyProfile.length - 1 ? 0.94 : 0.985), y]);
  const bodyInner = mesh(lathe(innerProfile, 160), hullInnerMat, { cast: false });
  airframe.add(bodyInner);

  // costuras longitudinais discretas
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.13;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const y = 1.02 + (i / 24) * 10.2;
      pts.push(new THREE.Vector3(Math.sin(a) * (R + 0.003), y, Math.cos(a) * (R + 0.003)));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), seamMat);
    airframe.add(line);
  }

  // anéis de junção e rebites
  const ringYs = [1.02, 1.62, 2.28, 3.42, 4.68, 6.12, 7.52, 8.92, 10.20, 11.24];
  for (const y of ringYs) airframe.add(ringMesh(y, R + 0.004, 0.0085, trimMat, 96));

  const rivetGeo = new THREE.SphereGeometry(0.0145, 6, 4);
  const rivetsPerRing = 56;
  const rivetCount = ringYs.length * rivetsPerRing;
  const rivets = new THREE.InstancedMesh(rivetGeo, rivetMat, rivetCount);
  const dummy = new THREE.Object3D();
  let ri = 0;
  for (const y of ringYs) {
    for (let i = 0; i < rivetsPerRing; i++) {
      const a = (i / rivetsPerRing) * TAU + 0.02;
      dummy.position.set(Math.sin(a) * (R + 0.006), y + 0.035, Math.cos(a) * (R + 0.006));
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      rivets.setMatrixAt(ri++, dummy.matrix);
    }
  }
  rivets.instanceMatrix.needsUpdate = true;
  rivets.castShadow = false;
  rivets.receiveShadow = true;
  airframe.add(rivets);

  // escotilhas e painéis de acesso
  const hatchAngles = [1.15, 2.95, 4.35, 5.65];
  for (let i = 0; i < hatchAngles.length; i++) {
    const g = new THREE.Group();
    const w = i % 2 === 0 ? 0.44 : 0.34;
    const h = i % 2 === 0 ? 0.62 : 0.42;
    const plate = mesh(roundedPlateGeometry(w, h, 0.05, 0.018), hatchMat);
    g.add(plate);
    for (let b = 0; b < 6; b++) {
      const bolt = mesh(new THREE.SphereGeometry(0.012, 6, 4), rivetMat, {
        pos: [((b % 3) - 1) * (w * 0.34), (b < 3 ? 1 : -1) * h * 0.38, 0.024],
      });
      g.add(bolt);
    }
    placeOnHull(g, hatchAngles[i], i % 2 === 0 ? 2.55 : 9.10, 0.008);
    airframe.add(g);
  }

  // decalques curvos
  const v2Decal = textBand('V-2', { radius: R + 0.013, y: 9.18, height: 1.24, theta: 1.56, sub: 'A4  ·  1944', spacing: 7 });
  const a4Decal = textBand('A-4', { radius: R + 0.012, y: 2.02, height: 0.42, theta: 0.74, color: 'rgba(245,238,222,.95)', spacing: 5 });
  a4Decal.mesh.rotation.y = 0.62;
  addClip(v2Decal.material);
  addClip(a4Decal.material);
  decalMats.push(v2Decal.material, a4Decal.material);
  const v2DecalBack = v2Decal.mesh.clone();
  v2Decal.mesh.rotation.y = 0.62;
  v2DecalBack.rotation.y = 0.62 + Math.PI;
  airframe.add(v2Decal.mesh, v2DecalBack, a4Decal.mesh);

  // faixa de fuligem e poeira na base
  const grimeMat = addClip(new THREE.MeshBasicMaterial({
    map: grimeTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.82,
  }));
  const grime = mesh(new THREE.CylinderGeometry(R + 0.006, R + 0.006, 2.15, 96, 1, true), grimeMat, {
    pos: [0, 1.55, 0], cast: false, receive: false,
  });
  grime.renderOrder = 3;
  airframe.add(grime);

  // conduítes externos no lado sombreado
  for (const a of [1.95, 4.55]) {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const y = 1.1 + (i / 18) * 9.9;
      const rr = R + 0.035 + Math.sin(i * 0.72) * 0.006;
      pts.push(new THREE.Vector3(Math.sin(a) * rr, y, Math.cos(a) * rr));
    }
    airframe.add(tube(pts, 0.020, blackSteelMat, 48, 6));
    for (let i = 1; i < 9; i++) {
      const y = 1.1 + (i / 9) * 9.9;
      const br = mesh(new THREE.BoxGeometry(0.055, 0.045, 0.035), darkSteelMat);
      br.position.set(Math.sin(a) * (R + 0.018), y, Math.cos(a) * (R + 0.018));
      br.rotation.y = a;
      airframe.add(br);
    }
  }

  // pequenos defletores / reforços na base
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    const bracket = mesh(new THREE.BoxGeometry(0.07, 0.30, 0.18), trimMat);
    bracket.position.set(Math.sin(a) * (R + 0.03), 0.52, Math.cos(a) * (R + 0.03));
    bracket.rotation.y = a;
    airframe.add(bracket);
  }

  // ---------- Nariz e ogiva ----------
  const noseGroup = new THREE.Group();
  noseGroup.name = 'ogiva';
  const noseGeo = lathe(noseProfile, 128);
  const noseOuter = mesh(noseGeo, hullMat);
  noseGroup.add(noseOuter);

  const noseInnerProfile = noseProfile.map(([r, y], i) => [r * (i === noseProfile.length - 1 ? 0 : 0.975), y]);
  const noseInner = mesh(lathe(noseInnerProfile, 128), hullInnerMat, { cast: false });
  noseGroup.add(noseInner);

  const fillerProfile = noseProfile
    .filter(([r], i) => i > 3 && i < noseProfile.length - 1)
    .map(([r, y]) => [Math.max(0.006, r * 0.86), y + 0.02]);
  const filler = mesh(lathe(fillerProfile, 96), amberMat);
  noseGroup.add(filler);

  const fuse = mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.16, 12), darkSteelMat, { pos: [0, 13.98, 0] });
  const fuseTip = mesh(new THREE.ConeGeometry(0.026, 0.10, 12), brassMat, { pos: [0, 14.10, 0] });
  noseGroup.add(fuse, fuseTip);

  const centerTube = mesh(new THREE.CylinderGeometry(0.030, 0.030, 2.55, 10), darkSteelMat, { pos: [0, 12.62, 0] });
  noseGroup.add(centerTube);
  noseGroup.add(ringMesh(noseBase + 0.02, 0.752, 0.014, trimMat, 96));
  noseGroup.add(ringMesh(13.10, 0.44, 0.009, trimMat, 72));

  // costuras longitudinais do cone
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + 0.40;
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      const y = noseBase + 0.05 + t * 2.55;
      const r = 0.75 * Math.pow(1 - t, 0.72) + 0.003;
      pts.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r));
    }
    noseGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), seamMat));
  }

  // ---------- Tanques ----------
  const fuelGroup = new THREE.Group();
  fuelGroup.name = 'combustivel';
  const fuelH = 3.02;
  const fuelTank = mesh(lathe(capsuleProfile(0.715, fuelH), 96), aluMat, { pos: [0, 6.70, 0] });
  fuelGroup.add(fuelTank);
  for (const yy of [0.56, 1.50, 2.44]) fuelGroup.add(ringMesh(6.70 + yy, 0.722, 0.012, darkSteelMat, 72));
  const fuelLabel = stencilBand('B-STOFF', { radius: 0.728, y: 8.34, height: 0.26, theta: 0.88, color: 'rgba(35,37,32,.82)' });
  fuelLabel.mesh.rotation.y = 0.55;
  fuelGroup.add(fuelLabel.mesh);
  const fuelOut = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.19, 12), darkSteelMat, { pos: [0, 6.64, 0] });
  fuelGroup.add(fuelOut);
  fuelGroup.add(tube([[0, 6.62, 0], [0.10, 6.50, 0.06], [0.24, 6.38, 0.12]], 0.045, steelMat, 16, 8));

  const loxGroup = new THREE.Group();
  loxGroup.name = 'oxidante';
  const loxH = 2.92;
  const loxTank = mesh(lathe(capsuleProfile(0.705, loxH), 96), frostMat, { pos: [0, 3.58, 0] });
  loxGroup.add(loxTank);
  for (const yy of [0.54, 1.46, 2.38]) loxGroup.add(ringMesh(3.58 + yy, 0.712, 0.011, darkSteelMat, 72));
  const loxLabel = stencilBand('A-STOFF', { radius: 0.718, y: 5.03, height: 0.26, theta: 0.88, color: 'rgba(30,43,48,.86)' });
  loxLabel.mesh.rotation.y = 0.55;
  loxGroup.add(loxLabel.mesh);
  const loxOut = mesh(new THREE.CylinderGeometry(0.080, 0.080, 0.18, 12), darkSteelMat, { pos: [0, 3.52, 0] });
  loxGroup.add(loxOut);

  // cintas longitudinais, costuras e pequenos bocais dos tanques
  for (const [group, top, rad] of [[fuelGroup, 6.70, 0.715], [loxGroup, 3.58, 0.705]]) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.18;
      const x = Math.sin(a) * (rad + 0.008);
      const z = Math.cos(a) * (rad + 0.008);
      group.add(mesh(new THREE.BoxGeometry(0.024, 2.35, 0.018), darkSteelMat, { pos: [x, top + 1.44, z], rot: [0, a, 0] }));
    }
    for (const yy of [0.38, 0.92, 1.48, 2.02, 2.58]) {
      group.add(ringMesh(top + yy, rad + 0.012, 0.007, darkSteelMat, 64));
    }
  }

  // ---------- Compartimento de guiagem ----------
  const guidance = new THREE.Group();
  guidance.name = 'guiagem';
  const guidanceFloor = mesh(new THREE.CylinderGeometry(0.60, 0.60, 0.045, 48), darkSteelMat, { pos: [0, 10.03, 0] });
  guidance.add(guidanceFloor);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    guidance.add(cylinderBetween([Math.cos(a) * 0.54, 10.03, Math.sin(a) * 0.54], [Math.cos(a) * 0.73, 10.36, Math.sin(a) * 0.73], 0.016, darkSteelMat, 6));
  }

  const computer = new THREE.Group();
  computer.position.set(0.16, 10.30, 0.10);
  const compBox = mesh(new THREE.BoxGeometry(0.36, 0.34, 0.26), darkSteelMat);
  computer.add(compBox);
  for (let i = 0; i < 5; i++) {
    const fin = mesh(new THREE.BoxGeometry(0.34, 0.010, 0.20), steelMat, { pos: [0, 0.08 + i * 0.045, -0.02] });
    computer.add(fin);
  }
  for (let i = 0; i < 4; i++) {
    const knob = mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.018, 10), brassMat, { pos: [-0.12 + i * 0.08, -0.12, 0.135], rot: [Math.PI / 2, 0, 0] });
    computer.add(knob);
  }
  guidance.add(computer);

  const gyro = new THREE.Group();
  gyro.position.set(-0.20, 10.36, 0.12);
  gyro.add(mesh(new THREE.SphereGeometry(0.125, 20, 14), darkSteelMat));
  const g1 = mesh(new THREE.TorusGeometry(0.165, 0.010, 6, 40), brassMat, { rot: [0, 0, 0] });
  const g2 = mesh(new THREE.TorusGeometry(0.185, 0.008, 6, 40), steelMat, { rot: [Math.PI / 2, 0, 0] });
  const g3 = mesh(new THREE.TorusGeometry(0.150, 0.008, 6, 40), steelMat, { rot: [0, Math.PI / 2, 0] });
  gyro.add(g1, g2, g3);
  gyro.add(cylinderBetween([0, -0.20, 0], [0, -0.34, 0], 0.018, steelMat, 6));
  guidance.add(gyro);

  const radio = mesh(new THREE.BoxGeometry(0.30, 0.22, 0.22), new THREE.MeshStandardMaterial({ color: 0x3f474a, roughness: 0.7, metalness: 0.35 }), { pos: [-0.08, 10.30, -0.30] });
  guidance.add(radio);
  for (let i = 0; i < 4; i++) {
    const battery = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 12), new THREE.MeshStandardMaterial({ color: 0x4b4337, roughness: 0.7, metalness: 0.25 }), { pos: [0.30 + (i % 2) * 0.13, 10.24, -0.16 + Math.floor(i / 2) * 0.14] });
    guidance.add(battery);
  }
  guidance.add(tube([[0.18, 10.30, 0.02], [0.02, 10.20, 0.10], [-0.16, 10.18, 0.04]], 0.012, wireRed, 24, 5));
  guidance.add(tube([[0.20, 10.24, -0.06], [0.08, 10.12, -0.02], [-0.14, 10.12, -0.12]], 0.012, wireBlue, 24, 5));
  guidance.add(tube([[0.14, 10.36, -0.02], [0.0, 10.30, -0.20], [-0.06, 10.28, -0.32]], 0.010, wireYellow, 20, 5));
  const lev = stencilBand('LEV-3', { radius: 0.614, y: 10.20, height: 0.14, theta: 0.32, color: 'rgba(220,220,210,.6)' });
  guidance.add(lev.mesh);

  // ---------- Peróxido e gerador de vapor ----------
  const h2o2Group = new THREE.Group();
  h2o2Group.name = 'peroxido';
  const h2o2Tank = mesh(lathe(capsuleProfile(0.215, 0.78), 48), aluMat, { pos: [-0.46, 2.92, 0.28] });
  h2o2Group.add(h2o2Tank);
  for (const yy of [0.18, 0.60]) h2o2Group.add(ringMesh(2.92 + yy, 0.222, 0.009, darkSteelMat, 40));
  const catalyst = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.26, 16), brassMat, { pos: [-0.46, 3.78, 0.28] });
  h2o2Group.add(catalyst);
  const steamGen = mesh(new THREE.SphereGeometry(0.16, 20, 14), copperMat, { pos: [0.02, 2.76, 0.25] });
  h2o2Group.add(steamGen);
  h2o2Group.add(tube([[-0.46, 3.66, 0.28], [-0.38, 3.42, 0.28], [-0.20, 3.12, 0.28]], 0.026, steelMat, 18, 7));
  h2o2Group.add(tube([[-0.30, 2.92, 0.28], [-0.14, 2.82, 0.27], [0.0, 2.77, 0.25]], 0.022, copperMat, 14, 6));
  h2o2Group.add(tube([[0.04, 2.80, 0.25], [0.14, 2.76, 0.20], [0.27, 2.72, 0.14]], 0.030, darkSteelMat, 14, 7));

  // ---------- Turbobomba ----------
  const turbopump = new THREE.Group();
  turbopump.name = 'turbobomba';
  const pumpBody = mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.52, 24), steelMat, { pos: [0.39, 2.64, 0.17] });
  turbopump.add(pumpBody);
  const turbine = mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.26, 24), darkSteelMat, { pos: [0.39, 2.98, 0.17] });
  turbopump.add(turbine);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const bolt = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6), brassMat, {
      pos: [0.39 + Math.cos(a) * 0.17, 3.10, 0.17 + Math.sin(a) * 0.17],
      rot: [0, 0, 0],
    });
    turbopump.add(bolt);
  }
  const volute1 = mesh(new THREE.TorusGeometry(0.155, 0.055, 10, 32), copperMat, { pos: [0.39, 2.48, 0.17], rot: [Math.PI / 2, 0, 0] });
  const volute2 = mesh(new THREE.TorusGeometry(0.145, 0.045, 10, 32), brassMat, { pos: [0.39, 2.78, 0.17], rot: [Math.PI / 2, 0, 0] });
  turbopump.add(volute1, volute2);
  turbopump.add(tube([[0.39, 3.14, 0.17], [0.48, 3.24, 0.18], [0.60, 3.20, 0.20], [0.64, 3.08, 0.22]], 0.045, darkSteelMat, 22, 8));
  turbopump.add(tube([[0.39, 2.38, 0.17], [0.41, 2.26, 0.15], [0.40, 2.18, 0.10]], 0.052, steelMat, 16, 8));
  turbopump.add(cylinderBetween([0.39, 2.38, 0.17], [0.39, 2.62, 0.17], 0.065, darkSteelMat, 12));

  // ---------- Câmara de combustão ----------
  const chamberGroup = new THREE.Group();
  chamberGroup.name = 'camara';
  const chamberProfile = [
    [0.165, 1.64], [0.195, 1.70], [0.250, 1.80], [0.300, 1.94],
    [0.330, 2.08], [0.332, 2.20], [0.315, 2.31], [0.275, 2.40],
    [0.205, 2.46], [0.155, 2.49],
  ];
  const chamber = mesh(lathe(chamberProfile, 80), nozzleMat);
  chamberGroup.add(chamber);
  const chamberInner = mesh(lathe(chamberProfile.map(([r, y]) => [r * 0.97, y]), 80), nozzleInnerMat, { cast: false });
  chamberGroup.add(chamberInner);
  const injPlate = mesh(new THREE.CylinderGeometry(0.292, 0.292, 0.035, 48), darkSteelMat, { pos: [0, 2.49, 0] });
  chamberGroup.add(injPlate);
  const manifold = mesh(new THREE.TorusGeometry(0.285, 0.035, 8, 40), copperMat, { pos: [0, 2.52, 0], rot: [Math.PI / 2, 0, 0] });
  chamberGroup.add(manifold);

  // 18 cabeças de injeção: 6 internas + 12 externas
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const pot = mesh(new THREE.CylinderGeometry(0.038, 0.048, 0.075, 10), brassMat, {
      pos: [Math.cos(a) * 0.125, 2.56, Math.sin(a) * 0.125],
    });
    chamberGroup.add(pot);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + Math.PI / 12;
    const pot = mesh(new THREE.CylinderGeometry(0.034, 0.044, 0.070, 10), brassMat, {
      pos: [Math.cos(a) * 0.235, 2.55, Math.sin(a) * 0.235],
    });
    chamberGroup.add(pot);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    chamberGroup.add(tube([
      [Math.cos(a) * 0.34, 2.32, Math.sin(a) * 0.34],
      [Math.cos(a) * 0.35, 2.12, Math.sin(a) * 0.35],
      [Math.cos(a) * 0.33, 1.90, Math.sin(a) * 0.33],
    ], 0.020, steelMat, 14, 6));
  }

  // ---------- Tubeira ----------
  const nozzleGroup = new THREE.Group();
  nozzleGroup.name = 'tubeira';
  const nozzleProfile = [
    [0.535, 0.56], [0.520, 0.64], [0.500, 0.72], [0.455, 0.86],
    [0.395, 1.02], [0.330, 1.18], [0.265, 1.34], [0.212, 1.48],
    [0.176, 1.58], [0.165, 1.65],
  ];
  const nozzle = mesh(lathe(nozzleProfile, 96), nozzleMat);
  nozzleGroup.add(nozzle);
  const nozzleInner = mesh(lathe(nozzleProfile.map(([r, y]) => [r * 0.972, y]), 96), nozzleInnerMat, { cast: false });
  nozzleGroup.add(nozzleInner);
  nozzleGroup.add(ringMesh(0.575, 0.536, 0.018, darkSteelMat, 96));
  nozzleGroup.add(ringMesh(1.12, 0.374, 0.013, darkSteelMat, 96));
  nozzleGroup.add(ringMesh(1.50, 0.207, 0.010, darkSteelMat, 96));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const rib = mesh(new THREE.BoxGeometry(0.018, 0.58, 0.026), darkSteelMat);
    rib.position.set(Math.cos(a) * 0.47, 0.92, Math.sin(a) * 0.47);
    rib.rotation.y = -a;
    rib.rotation.z = -0.18;
    nozzleGroup.add(rib);
  }

  // ---------- Aletas ----------
  const finsGroup = new THREE.Group();
  finsGroup.name = 'aletas';
  const finShape = new THREE.Shape();
  finShape.moveTo(0.0, 2.52);
  finShape.bezierCurveTo(0.22, 2.51, 0.62, 1.52, 0.955, 0.68);
  finShape.lineTo(0.955, 0.04);
  finShape.lineTo(0.0, 0.04);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.075, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 28,
  });
  finGeo.translate(0, 0, -0.0375);

  const finPivots = [];
  const finAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
  finAngles.forEach((angle, index) => {
    const pivot = new THREE.Group();
    pivot.rotation.y = angle;
    const fin = mesh(finGeo, finMat, { pos: [R - 0.018, 0, 0] });
    pivot.add(fin);

    // bordo de ataque em metal, dos dois lados
    const p0 = new THREE.Vector3(0, 2.52, 0);
    const p1 = new THREE.Vector3(0.22, 2.51, 0);
    const p2 = new THREE.Vector3(0.62, 1.52, 0);
    const p3 = new THREE.Vector3(0.955, 0.68, 0);
    for (const zz of [-0.047, 0.047]) {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const it = 1 - t;
        const x = it * it * it * p0.x + 3 * it * it * t * p1.x + 3 * it * t * t * p2.x + t * t * t * p3.x;
        const yy = it * it * it * p0.y + 3 * it * it * t * p1.y + 3 * it * t * t * p2.y + t * t * t * p3.y;
        pts.push(new THREE.Vector3(R - 0.018 + x, yy, zz));
      }
      pivot.add(tube(pts, 0.009, darkSteelMat, 24, 5));
    }

    // rebites na raiz e no bordo de ataque
    for (let i = 0; i < 11; i++) {
      const yy = 0.14 + i * 0.215;
      for (const zz of [-0.041, 0.041]) {
        const bolt = mesh(new THREE.SphereGeometry(0.012, 6, 4), rivetMat, { pos: [R + 0.004, yy, zz] });
        pivot.add(bolt);
      }
    }
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const x = R - 0.018 + 0.20 + t * 0.68;
      const y = 2.20 - t * 1.32;
      const bolt = mesh(new THREE.SphereGeometry(0.010, 6, 4), rivetMat, { pos: [x, y, 0.044] });
      pivot.add(bolt);
    }

    // leme externo
    const rudder = new THREE.Group();
    const rudderPlate = mesh(roundedPlateGeometry(0.42, 0.38, 0.035, 0.055), darkSteelMat, { pos: [0.78, 0.31, 0], rot: [0, Math.PI / 2, 0.10] });
    rudder.add(rudderPlate);
    rudder.add(cylinderBetween([0.77, 0.51, -0.075], [0.77, 0.51, 0.075], 0.024, brassMat, 8));
    rudder.add(cylinderBetween([0.77, 0.12, -0.075], [0.77, 0.12, 0.075], 0.018, brassMat, 8));
    rudder.add(cylinderBetween([0.60, 0.58, 0.0], [0.74, 0.50, 0.0], 0.012, steelMat, 6));
    pivot.add(rudder);

    // pequena placa de reforço na ponta
    const tipPlate = mesh(new THREE.BoxGeometry(0.16, 0.52, 0.085), trimMat, { pos: [R + 0.86, 0.34, 0] });
    pivot.add(tipPlate);

    finPivots.push(pivot);
    finsGroup.add(pivot);
  });

  // ---------- Lemes de grafite ----------
  const vanesGroup = new THREE.Group();
  vanesGroup.name = 'lemes';
  const vaneAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
  for (const a of vaneAngles) {
    const vane = new THREE.Group();
    const blade = mesh(new THREE.BoxGeometry(0.055, 0.48, 0.26), graphiteMat, { pos: [0.30, 0.86, 0], rot: [0, 0, 0] });
    vane.add(blade);
    const hub = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.10, 10), brassMat, { pos: [0.30, 1.10, 0], rot: [0, 0, Math.PI / 2] });
    vane.add(hub);
    vane.add(cylinderBetween([0.30, 1.09, 0], [0.50, 1.15, 0], 0.017, steelMat, 7));
    vane.rotation.y = a;
    vanesGroup.add(vane);
  }
  vanesGroup.add(ringMesh(1.13, 0.50, 0.018, darkSteelMat, 48));

  // ---------- Tubulações ----------
  const plumbing = new THREE.Group();
  plumbing.name = 'tubulacoes';
  const fuelLine = tube([
    [0.16, 6.62, 0.28], [0.34, 5.95, 0.36], [0.32, 4.70, 0.40],
    [0.40, 3.75, 0.34], [0.40, 3.12, 0.22], [0.39, 2.84, 0.18],
  ], 0.047, aluMat, 70, 9);
  plumbing.add(fuelLine);
  const loxLine = tube([
    [0.12, 3.50, 0.25], [0.30, 3.34, 0.29], [0.46, 3.14, 0.25], [0.40, 2.95, 0.19],
  ], 0.052, frostMat, 34, 9);
  plumbing.add(loxLine);
  plumbing.add(tube([
    [-0.30, 3.18, 0.26], [-0.12, 3.10, 0.30], [0.10, 3.02, 0.25], [0.27, 2.92, 0.18],
  ], 0.024, darkSteelMat, 28, 7));
  plumbing.add(tube([
    [0.52, 3.20, 0.22], [0.60, 3.54, 0.22], [0.60, 4.20, 0.18], [0.56, 5.70, 0.12],
  ], 0.018, wireRed, 40, 6));

  // válvulas e volantes
  for (const [x, y, z] of [[0.43, 4.80, 0.34], [0.44, 3.40, 0.27], [0.39, 2.93, 0.19]]) {
    const body = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.10, 14), brassMat, { pos: [x, y, z], rot: [0, 0, Math.PI / 2] });
    plumbing.add(body);
    const wheel = mesh(new THREE.TorusGeometry(0.070, 0.010, 6, 24), wireRed, { pos: [x + 0.02, y, z + 0.10], rot: [0, Math.PI / 2, 0] });
    plumbing.add(wheel);
    for (let i = 0; i < 3; i++) {
      const spoke = cylinderBetween([x + 0.02, y, z + 0.10], [x + 0.02 + Math.cos(i * TAU / 3) * 0.065, y + Math.sin(i * TAU / 3) * 0.065, z + 0.10], 0.006, brassMat, 5);
      plumbing.add(spoke);
    }
  }

  // suportes de tubulação
  for (let i = 0; i < 6; i++) {
    const y = 3.3 + i * 0.55;
    const clamp = mesh(new THREE.TorusGeometry(0.052, 0.012, 5, 16, Math.PI * 1.2), darkSteelMat, { pos: [0.34, y, 0.38], rot: [0, 0.2, Math.PI / 2] });
    plumbing.add(clamp);
  }

  // ---------- Quadro de empuxo ----------
  const frameGroup = new THREE.Group();
  frameGroup.name = 'quadro';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const x1 = Math.cos(a) * 0.54, z1 = Math.sin(a) * 0.54;
    const x2 = Math.cos(a) * 0.73, z2 = Math.sin(a) * 0.73;
    frameGroup.add(cylinderBetween([x1, 2.38, z1], [x2, 3.55, z2], 0.034, darkSteelMat, 8));
    frameGroup.add(cylinderBetween([x2, 3.55, z2], [x2 * 0.94, 3.55, z2 * 0.94], 0.026, steelMat, 7));
  }
  frameGroup.add(ringMesh(3.55, 0.75, 0.030, darkSteelMat, 48));
  frameGroup.add(ringMesh(2.40, 0.56, 0.022, darkSteelMat, 40));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    frameGroup.add(cylinderBetween([Math.cos(a) * 0.56, 2.40, Math.sin(a) * 0.56], [Math.cos(a) * 0.75, 3.55, Math.sin(a) * 0.75], 0.012, steelMat, 6));
  }

  // ---------- Antenas ----------
  const antennaGroup = new THREE.Group();
  antennaGroup.name = 'antena';
  for (const a of [Math.PI * 0.72, Math.PI * 1.28]) {
    const base = new THREE.Vector3(Math.sin(a) * (R - 0.01), 1.06, Math.cos(a) * (R - 0.01));
    const tip = new THREE.Vector3(Math.sin(a) * (R + 0.34), 0.58, Math.cos(a) * (R + 0.34));
    antennaGroup.add(cylinderBetween(base.toArray(), tip.toArray(), 0.012, blackSteelMat, 6));
    const insulator = mesh(new THREE.CylinderGeometry(0.030, 0.036, 0.10, 10), insulationMat, { pos: [base.x, base.y, base.z] });
    antennaGroup.add(insulator);
  }
  antennaGroup.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), brassMat, { pos: [0, 1.04, -R - 0.02] }));

  // ---------- Estrutura interna ----------
  const internals = new THREE.Group();
  internals.name = 'estrutura_interna';
  for (const y of [1.18, 2.34, 3.50, 4.76, 6.24, 7.72, 9.15, 10.02, 11.24]) {
    internals.add(ringMesh(y, 0.792, 0.016, darkSteelMat, 64));
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const y = 1.1 + (k / 10) * 10.1;
      pts.push(new THREE.Vector3(Math.sin(a) * 0.797, y, Math.cos(a) * 0.797));
    }
    internals.add(tube(pts, 0.012, darkSteelMat, 32, 5));
  }
  internals.add(mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.04, 24), darkSteelMat, { pos: [0, 1.18, 0] }));

  // feixe de cabos e canaletas internas
  internals.add(tube([
    [0.22, 10.10, 0.14], [0.27, 8.60, 0.18], [0.22, 6.65, 0.16],
    [0.25, 4.20, 0.18], [0.31, 3.15, 0.20], [0.34, 2.55, 0.18],
  ], 0.020, blackSteelMat, 70, 6));
  for (const [dx, color] of [[0.035, wireRed], [-0.035, wireBlue], [0.0, wireYellow]]) {
    internals.add(tube([
      [0.22 + dx, 10.08, 0.17], [0.27 + dx, 8.6, 0.21], [0.22 + dx, 6.65, 0.19],
      [0.25 + dx, 4.2, 0.21], [0.31 + dx, 3.15, 0.23],
    ], 0.007, color, 60, 5));
  }
  internals.add(ringMesh(6.64, 0.735, 0.018, darkSteelMat, 64));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    internals.add(cylinderBetween([Math.cos(a) * 0.20, 6.64, Math.sin(a) * 0.20], [Math.cos(a) * 0.73, 6.64, Math.sin(a) * 0.73], 0.016, darkSteelMat, 6));
  }

  // ---------- Montagem ----------
  const partsById = new Map();
  const explodables = [];

  function registerPart(id, object, offset, base = new THREE.Vector3()) {
    object.userData.partId = id;
    object.userData.basePosition = base.clone();
    object.userData.explodeOffset = new THREE.Vector3(...offset);
    partsById.set(id, object);
    explodables.push({ object, base: base.clone(), offset: new THREE.Vector3(...offset), id });
  }

  // Fuselagem: permanece no lugar, mas é ocultada no explodido.
  airframe.userData.partId = 'fuselagem';
  partsById.set('fuselagem', airframe);
  rocket.add(airframe);
  rocket.add(internals);

  registerPart('ogiva', noseGroup, [0, 1.35, 0]);
  registerPart('guiagem', guidance, [0, 0.58, 0]);
  registerPart('combustivel', fuelGroup, [0, 0.16, 0]);
  registerPart('oxidante', loxGroup, [0, -0.18, 0]);
  registerPart('peroxido', h2o2Group, [-2.70, 1.75, 0.55]);
  registerPart('turbobomba', turbopump, [3.05, 2.30, 0.85]);
  registerPart('camara', chamberGroup, [2.85, 1.40, 0.72]);
  registerPart('tubeira', nozzleGroup, [3.10, 0.66, 0.92]);
  registerPart('aletas', finsGroup, [0, 0, 0]);
  registerPart('lemes', vanesGroup, [2.30, 0.05, 1.05]);
  registerPart('tubulacoes', plumbing, [-2.55, 1.10, 0.55]);
  registerPart('quadro', frameGroup, [1.65, -0.18, 0.90]);
  registerPart('antena', antennaGroup, [-2.15, 0.10, -0.75]);

  // Aletas explodem radialmente, cada pivô separadamente.
  const finExplodables = [];
  finsGroup.children.forEach((pivot, i) => {
    const a = finAngles[i];
    finExplodables.push({ object: pivot, base: new THREE.Vector3(), offset: new THREE.Vector3(Math.cos(a) * 1.30, 0.04, Math.sin(a) * 1.30), id: 'aletas' });
  });

  rocket.add(noseGroup, guidance, fuelGroup, loxGroup, h2o2Group, turbopump, chamberGroup, nozzleGroup, finsGroup, vanesGroup, plumbing, frameGroup, antennaGroup);
  rocket.position.y = B;

  // ---------- Fantasma wireframe para o explodido ----------
  const ghostMat = new THREE.MeshBasicMaterial({
    color: 0x79aebb, wireframe: true, transparent: true, opacity: 0.055, depthWrite: false,
  });
  const ghostGeo = lathe(bodyProfile, 36);
  const ghostHull = mesh(ghostGeo, ghostMat, { cast: false, receive: false });
  ghostHull.position.y = B;
  ghostHull.visible = false;
  rocket.parent?.add(ghostHull);
  // O pai é definido pelo chamador; guardamos para anexar depois.

  // ---------- Linhas de corte ----------
  const cutProfiles = [...bodyProfile, ...noseProfile.slice(1)];
  const cutLines = new THREE.Group();
  const cutLineMat = new THREE.LineBasicMaterial({ color: 0x8fd0df, transparent: true, opacity: 0.72 });
  const cutTubeMat = new THREE.MeshBasicMaterial({ color: 0x8fd0df, transparent: true, opacity: 0.62 });
  for (let k = 0; k < 2; k++) {
    const theta = k === 0 ? 0 : Math.PI / 2;
    const pts = cutProfiles.map(([r, y]) => new THREE.Vector3(Math.sin(theta) * r, y, Math.cos(theta) * r));
    cutLines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cutLineMat));
    const curve = new THREE.CatmullRomCurve3(pts);
    cutLines.add(mesh(new THREE.TubeGeometry(curve, 72, 0.009, 6, false), cutTubeMat, { cast: false, receive: false }));
  }
  cutLines.visible = false;

  // ---------- Plataforma de lançamento ----------
  const pad = new THREE.Group();
  pad.name = 'plataforma';
  const concreteMat = new THREE.MeshStandardMaterial({ map: concreteMap, color: 0xa3a09a, roughness: 0.95, metalness: 0.02 });
  const padBase = mesh(new THREE.CylinderGeometry(5.6, 5.9, 0.20, 72), concreteMat, { pos: [0, -0.10, 0], cast: false });
  pad.add(padBase);
  const scorchMat = new THREE.MeshBasicMaterial({ map: makeRadialTexture('rgba(6,6,5,.82)', 'rgba(15,15,13,0)'), transparent: true, depthWrite: false });
  const scorch = mesh(new THREE.PlaneGeometry(7.4, 7.4), scorchMat, { pos: [0, 0.012, 0], rot: [-Math.PI / 2, 0, 0], cast: false, receive: false });
  pad.add(scorch);

  // anéis e juntas do piso
  for (const r of [2.4, 3.5, 4.7, 5.35]) {
    pad.add(ringMesh(0.008, r, 0.012, new THREE.MeshBasicMaterial({ color: 0x1c1e1c, transparent: true, opacity: 0.55 }), 96));
  }
  const gridMat = new THREE.LineBasicMaterial({ color: 0x565b55, transparent: true, opacity: 0.24 });
  const gridPts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    gridPts.push(new THREE.Vector3(Math.cos(a) * 1.2, 0.006, Math.sin(a) * 1.2));
    gridPts.push(new THREE.Vector3(Math.cos(a) * 5.35, 0.006, Math.sin(a) * 5.35));
  }
  pad.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gridPts), gridMat));

  // mesa de lançamento
  const table = new THREE.Group();
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x4b4c45, roughness: 0.62, metalness: 0.58 });
  table.add(mesh(new THREE.TorusGeometry(1.10, 0.105, 8, 48), tableMat, { pos: [0, 0.43, 0], rot: [Math.PI / 2, 0, 0] }));
  table.add(mesh(new THREE.TorusGeometry(2.08, 0.065, 7, 56), tableMat, { pos: [0, 0.43, 0], rot: [Math.PI / 2, 0, 0] }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    table.add(cylinderBetween([Math.cos(a) * 1.10, 0.43, Math.sin(a) * 1.10], [Math.cos(a) * 2.05, 0.43, Math.sin(a) * 2.05], 0.045, tableMat, 7));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const x = Math.cos(a) * 1.62, z = Math.sin(a) * 1.62;
    table.add(cylinderBetween([x, 0.40, z], [x * 1.16, 0.02, z * 1.16], 0.075, tableMat, 8));
    table.add(mesh(new THREE.BoxGeometry(0.26, 0.05, 0.26), tableMat, { pos: [x * 1.16, 0.045, z * 1.16] }));
  }
  // garras de fixação
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const clampG = new THREE.Group();
    clampG.add(mesh(new THREE.BoxGeometry(0.18, 0.28, 0.30), tableMat, { pos: [0, 0.58, 0] }));
    clampG.add(mesh(new THREE.BoxGeometry(0.24, 0.08, 0.12), tableMat, { pos: [0, 0.72, 0.10] }));
    clampG.position.set(Math.cos(a) * 0.93, 0.43, Math.sin(a) * 0.93);
    clampG.rotation.y = -a;
    table.add(clampG);
  }
  pad.add(table);

  // letreiro técnico no piso
  const padLabelTex = makeTextDecal('A4  ·  V-2', {
    width: 1024, height: 256, font: '600 110px "Helvetica Neue", Helvetica, Arial, sans-serif',
    color: 'rgba(190,196,187,.36)', sub: 'PEENEMÜNDE  ·  1942', spacing: 4,
  });
  const padLabelMat = new THREE.MeshBasicMaterial({ map: padLabelTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const padLabel = mesh(new THREE.PlaneGeometry(3.4, 0.85), padLabelMat, { pos: [0, 0.014, 3.35], rot: [-Math.PI / 2, 0, 0], cast: false, receive: false });
  pad.add(padLabel);

  // ---------- Linha de corte e ajustes ----------
  rocket.add(cutLines);
  // O ghost é anexado ao mesmo pai que o foguete, mas com y já absoluto.
  // O chamador deve adicionar `ghostHull` à cena.

  const explodeState = { p: 0 };
  const cutState = { p: 0 };

  function setExplode(p) {
    explodeState.p = clamp(p, 0, 1);
    const e = explodeState.p;
    const ee = e * e * (3 - 2 * e);
    for (const item of explodables) {
      item.object.position.copy(item.base).addScaledVector(item.offset, ee);
    }
    for (const item of finExplodables) {
      item.object.position.copy(item.base).addScaledVector(item.offset, ee);
    }
    // A pele externa sai de cena, deixando o wireframe técnico.
    airframe.visible = e < 0.02;
    ghostHull.visible = false;
    ghostMat.opacity = 0;
    internals.visible = e < 0.02;
  }

  function setCut(p) {
    cutState.p = clamp(p, 0, 1);
    const c = cutState.p;
    clipPlanes[0].constant = lerp(2.4, 0.0, c);
    clipPlanes[1].constant = lerp(2.4, 0.0, c);
    cutLines.visible = c > 0.02;
    cutLineMat.opacity = 0.72 * c;
  }

  // Cintas de sustentação dos tanques, visíveis no corte.
  const cradleMat = darkSteelMat;
  for (const y of [3.62, 6.56, 6.78, 9.70]) {
    const r = y < 6.6 ? 0.73 : 0.74;
    internals.add(ringMesh(y, r, 0.018, cradleMat, 64));
  }

  rocket.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.castShadow !== false;
      o.receiveShadow = true;
    }
  });

  return {
    rocket,
    pad,
    ghostHull,
    cutLines,
    clipPlanes,
    clipMaterials,
    partsById,
    explodables,
    finExplodables,
    internals,
    airframe,
    setExplode,
    setCut,
    explodeState,
    cutState,
    materials: {
      hullMat, finMat, steelMat, darkSteelMat, graphiteMat, aluMat, frostMat, nozzleMat, copperMat, brassMat,
    },
  };
}
