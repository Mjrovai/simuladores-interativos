import * as THREE from 'three';

export const MISSILE = { length: 1.5, radius: 0.09, nose: 0.78, tail: -0.72 };

const D2R = THREE.MathUtils.degToRad;

function matSet() {
  return {
    olive: new THREE.MeshStandardMaterial({
      color: 0x5c6349, roughness: 0.58, metalness: 0.32, side: THREE.DoubleSide
    }),
    oliveDark: new THREE.MeshStandardMaterial({
      color: 0x434a34, roughness: 0.65, metalness: 0.26, side: THREE.DoubleSide
    }),
    steel: new THREE.MeshStandardMaterial({
      color: 0x8e9288, roughness: 0.38, metalness: 0.92
    }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x24282a, roughness: 0.48, metalness: 0.75
    }),
    black: new THREE.MeshStandardMaterial({
      color: 0x0c0e0f, roughness: 0.55, metalness: 0.4
    }),
    copper: new THREE.MeshStandardMaterial({
      color: 0xc07a3e, roughness: 0.28, metalness: 1.0, side: THREE.DoubleSide
    }),
    propellant: new THREE.MeshStandardMaterial({
      color: 0x9c5a32, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide
    }),
    propellant2: new THREE.MeshStandardMaterial({
      color: 0x74452a, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide
    }),
    explosive: new THREE.MeshStandardMaterial({
      color: 0xd8b64a, roughness: 0.85, metalness: 0.05,
      transparent: true, opacity: 0.55, side: THREE.DoubleSide,
      emissive: 0x2a1c00, emissiveIntensity: 1
    }),
    circuit: new THREE.MeshStandardMaterial({
      color: 0x1c5238, roughness: 0.55, metalness: 0.3
    }),
    gold: new THREE.MeshStandardMaterial({
      color: 0xb69a54, roughness: 0.3, metalness: 1
    }),
    sensor: new THREE.MeshPhysicalMaterial({
      color: 0x070b0c, roughness: 0.3, metalness: 0.25,
      clearcoat: 0.6, clearcoatRoughness: 0.2
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x0a1719, roughness: 0.04, metalness: 0.55, emissive: 0x061414, emissiveIntensity: 0.6,
      clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide
    }),
    fiber: new THREE.MeshStandardMaterial({
      color: 0x6ff3e4, roughness: 0.25, metalness: 0.1,
      emissive: 0x2fd8c4, emissiveIntensity: 0.9
    }),
    fiberGlow: new THREE.MeshBasicMaterial({
      color: 0x46e3d2, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false
    }),
    band: new THREE.MeshStandardMaterial({
      color: 0xd8b23c, roughness: 0.6, metalness: 0.25
    })
  };
}

function latheZ(profile, seg = 64) {
  const pts = profile.map(([z, r]) => new THREE.Vector2(Math.max(r, 0.0006), z));
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function cylZ(rTop, rBottom, h, z, seg = 48, open = true) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z);
  return g;
}

function addMesh(parent, geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function finGeometry(span, rootChord, tipChord, sweep, thickness) {
  const s = new THREE.Shape();
  s.moveTo(-rootChord / 2, 0);
  s.lineTo(rootChord / 2, 0);
  s.lineTo(rootChord / 2 - sweep, span);
  s.lineTo(rootChord / 2 - sweep - tipChord, span);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -thickness / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function radialFins(count, offset, build) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = offset + (i * Math.PI * 2) / count;
    const pivot = build(a);
    pivot.rotation.z = a;
    group.add(pivot);
  }
  return group;
}

export function makeLabelTexture(text, sub = '', opts = {}) {
  const w = opts.w || 512;
  const h = opts.h || 160;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);
  x.fillStyle = opts.color || '#d7d0b6';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `700 ${opts.size || 74}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  x.fillText(text, w / 2, sub ? h * 0.38 : h * 0.5);
  if (sub) {
    x.font = `500 ${opts.subSize || 26}px "IBM Plex Mono", monospace`;
    x.globalAlpha = 0.7;
    x.fillText(sub, w / 2, h * 0.72);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function createMissile({ detailed = true } = {}) {
  const group = new THREE.Group();
  const m = matSet();
  const casings = [];
  const casing = mesh => { mesh.userData.casing = true; casings.push(mesh); return mesh; };
  const tailFinMeshes = [];
  const nozzleGlows = [];

  // ---------- SEEKER / NOSE ----------
  const seeker = new THREE.Group();
  seeker.userData.explode = new THREE.Vector3(0, 0, 0.62);
  seeker.userData.id = 'seeker';
  group.add(seeker);

  // rounded nose with a front-facing camera window
  const nose = [];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22;
    const z = 0.50 + t * 0.24;
    const r = 0.09 * (1 - 0.30 * Math.pow(t, 1.8));
    nose.push([z, r]);
  }
  nose[nose.length - 1][1] = 0.063;
  casing(addMesh(seeker, latheZ(nose), m.oliveDark));

  // rounded shoulder and flat front face
  addMesh(seeker, latheZ([[0.74, 0.063], [0.755, 0.0625], [0.766, 0.061], [0.773, 0.059]]), m.olive);
  const frontRing = addMesh(seeker, new THREE.TorusGeometry(0.0585, 0.0045, 10, 40), m.steel);
  frontRing.position.z = 0.773;
  const frontInner = addMesh(seeker, new THREE.CircleGeometry(0.056, 32), m.black);
  frontInner.position.z = 0.770;
  const frontGlass = addMesh(seeker, new THREE.CircleGeometry(0.052, 32), m.sensor);
  frontGlass.position.z = 0.774;
  const frontGlint = addMesh(seeker, new THREE.RingGeometry(0.045, 0.052, 32), m.dark);
  frontGlint.position.z = 0.7745;

  // TV camera gimbal, angled slightly downward behind the front window
  const gimbal = addMesh(seeker, new THREE.SphereGeometry(0.04, 24, 16), m.dark);
  gimbal.position.z = 0.70;
  const camera = new THREE.Group();
  camera.position.set(0, 0, 0.725);
  camera.rotation.x = -0.16;
  const cameraBody = addMesh(camera, new THREE.BoxGeometry(0.07, 0.07, 0.09), m.dark);
  const lens = addMesh(camera, cylZ(0.03, 0.032, 0.05, 0.06, 24, false), m.glass);
  const lensRing = addMesh(camera, new THREE.TorusGeometry(0.031, 0.004, 8, 32), m.steel);
  lensRing.position.z = 0.086;
  seeker.add(camera);
  const irLed = addMesh(seeker, new THREE.SphereGeometry(0.006, 8, 8), m.fiber);
  irLed.position.set(0.022, 0.018, 0.745);

  const seekerAnchor = new THREE.Object3D();
  seekerAnchor.position.set(0, 0, 0.66);
  seeker.add(seekerAnchor);
  seeker.userData.anchor = seekerAnchor;

  // ---------- WARHEAD ----------
  const warhead = new THREE.Group();
  warhead.userData.explode = new THREE.Vector3(0, 0, 0.34);
  warhead.userData.id = 'warhead';
  group.add(warhead);

  casing(addMesh(warhead, cylZ(0.09, 0.09, 0.40, 0.30, 48, true), m.olive));
  addMesh(warhead, cylZ(0.082, 0.082, 0.30, 0.27, 40, true), m.oliveDark);
  const liner = addMesh(warhead, new THREE.ConeGeometry(0.072, 0.17, 40, 1, true), m.copper);
  liner.rotation.x = Math.PI / 2;
  liner.position.z = 0.285;
  const filler = addMesh(warhead, cylZ(0.079, 0.079, 0.18, 0.285, 32, false), m.explosive);
  filler.material.depthWrite = false;
  const fuze = addMesh(warhead, cylZ(0.021, 0.021, 0.06, 0.415, 20, false), m.steel);
  const fuzeTip = addMesh(warhead, new THREE.SphereGeometry(0.021, 16, 12), m.dark);
  fuzeTip.position.z = 0.445;
  const ringA = addMesh(warhead, new THREE.TorusGeometry(0.085, 0.004, 8, 40), m.dark);
  ringA.rotation.x = Math.PI / 2; ringA.position.z = 0.405;
  const ringB = addMesh(warhead, new THREE.TorusGeometry(0.091, 0.003, 8, 48), m.dark);
  ringB.rotation.x = Math.PI / 2; ringB.position.z = 0.12;

  // four fixed canards for yaw / pitch / roll
  const canards = radialFins(4, Math.PI / 4, () => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, 0.40);
    const fin = new THREE.Mesh(finGeometry(0.12, 0.13, 0.13, 0.0, 0.005), m.olive);
    fin.position.set(0, 0.089, 0);
    fin.castShadow = true;
    pivot.add(fin);
    return pivot;
  });
  warhead.add(canards);

  const warheadAnchor = new THREE.Object3D();
  warheadAnchor.position.set(0, 0, 0.28);
  warhead.add(warheadAnchor);
  warhead.userData.anchor = warheadAnchor;

  const canardAnchor = new THREE.Object3D();
  canardAnchor.position.set(0, 0.14, 0.40);
  canards.add(canardAnchor);

  // ---------- AUTOPILOT ----------
  const auto = new THREE.Group();
  auto.userData.explode = new THREE.Vector3(0, 0, 0.04);
  auto.userData.id = 'autopilot';
  group.add(auto);
  casing(addMesh(auto, cylZ(0.09, 0.09, 0.14, 0.03, 48, true), m.olive));

  if (detailed) {
    for (let i = 0; i < 3; i++) {
      const pcb = addMesh(auto, new THREE.BoxGeometry(0.105, 0.005, 0.085), m.circuit);
      pcb.position.set(0, -0.028 + i * 0.028, 0.03);
      for (let k = 0; k < 3; k++) {
        const chip = addMesh(auto, new THREE.BoxGeometry(0.018, 0.006, 0.018), m.black);
        chip.position.set(-0.03 + k * 0.03, -0.028 + i * 0.028 + 0.005, 0.04 + (k % 2) * 0.02);
      }
    }
    const gyro = addMesh(auto, new THREE.SphereGeometry(0.024, 20, 14), m.steel);
    gyro.position.z = 0.075;
    const servo = addMesh(auto, new THREE.BoxGeometry(0.03, 0.03, 0.05), m.dark);
    servo.position.set(0.045, 0.03, -0.01);
  }
  const autoAnchor = new THREE.Object3D();
  autoAnchor.position.set(0, 0.02, 0.03);
  auto.add(autoAnchor);
  auto.userData.anchor = autoAnchor;

  // ---------- TWO-STAGE MOTOR ----------
  const motor = new THREE.Group();
  motor.userData.explode = new THREE.Vector3(0, 0, -0.28);
  motor.userData.id = 'motor';
  group.add(motor);
  casing(addMesh(motor, cylZ(0.09, 0.09, 0.38, -0.23, 48, true), m.dark));
  const ringMotor = addMesh(motor, new THREE.TorusGeometry(0.091, 0.003, 8, 48), m.dark);
  ringMotor.rotation.x = Math.PI / 2; ringMotor.position.z = -0.04;

  if (detailed) {
    // stage 1: star grain, fast burn during the climb
    const star = new THREE.Shape();
    const spikes = 6;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 0.062 : 0.03;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) star.moveTo(x, y); else star.lineTo(x, y);
    }
    star.closePath();
    const starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.14, bevelEnabled: false, steps: 1 });
    const grainStar = addMesh(motor, starGeo, m.propellant);
    grainStar.position.z = -0.22;

    // stage 2: cigarette grain, slow burn during cruise
    const h = 0.16;
    const zc = -0.32;
    const outer = addMesh(motor, new THREE.CylinderGeometry(0.066, 0.066, h, 32, 1, true), m.propellant2);
    outer.rotation.x = Math.PI / 2; outer.position.z = zc;
    const inner = addMesh(motor, new THREE.CylinderGeometry(0.027, 0.027, h, 24, 1, true), m.propellant2);
    inner.rotation.x = Math.PI / 2; inner.position.z = zc;
    for (const z of [zc - h / 2, zc + h / 2]) {
      const ring = addMesh(motor, new THREE.RingGeometry(0.027, 0.066, 32), m.propellant2);
      ring.position.z = z;
      if (z < zc) ring.rotation.y = Math.PI;
    }
    const bulkhead = addMesh(motor, new THREE.CylinderGeometry(0.075, 0.075, 0.012, 32), m.steel);
    bulkhead.rotation.x = Math.PI / 2; bulkhead.position.z = -0.235;
  }

  // two lateral exhausts, canted aft so the plume clears the tail spool
  for (const side of [-1, 1]) {
    const noz = new THREE.Group();
    noz.position.set(side * 0.062, 0, -0.385);
    const len = 0.11;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.042, len, 20, 1, true), m.steel);
    bell.rotation.z = -side * Math.PI / 2;
    bell.position.x = side * len / 2;
    bell.castShadow = true;
    noz.add(bell);
    const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.05, 16), m.dark);
    throat.rotation.z = Math.PI / 2;
    throat.position.x = -side * 0.005;
    noz.add(throat);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.065, 24),
      new THREE.MeshBasicMaterial({ color: 0xff7a24, transparent: true, opacity: 0, side: THREE.DoubleSide })
    );
    glow.rotation.y = side * Math.PI / 2;
    glow.position.x = side * (len + 0.002);
    noz.add(glow);
    nozzleGlows.push(glow);
    noz.rotation.y = side * 0.34;
    motor.add(noz);
  }
  const heatShield = addMesh(motor, new THREE.BoxGeometry(0.05, 0.11, 0.14), m.black);
  heatShield.position.set(0, 0, -0.385);

  const motorAnchor = new THREE.Object3D();
  motorAnchor.position.set(0, 0, -0.24);
  motor.add(motorAnchor);
  motor.userData.anchor = motorAnchor;

  // ---------- TAIL / FIBER SPOOL ----------
  const spool = new THREE.Group();
  spool.userData.explode = new THREE.Vector3(0, 0, -0.58);
  spool.userData.id = 'spool';
  group.add(spool);
  casing(addMesh(spool, cylZ(0.092, 0.092, 0.24, -0.54, 48, true), m.olive));

  // wound fiber drum at the very tail
  addMesh(spool, cylZ(0.058, 0.058, 0.18, -0.55, 32, false), m.dark);
  {
    const pts = [];
    const turns = 9;
    const n = 260;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * Math.PI * 2 * turns;
      pts.push(new THREE.Vector3(
        Math.cos(a) * 0.066,
        Math.sin(a) * 0.066,
        -0.635 + t * 0.16
      ));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 280, 0.0026, 5, false);
    addMesh(spool, tube, m.fiber, false);
  }
  const flange1 = addMesh(spool, cyclTorus(0.075, 0.005, -0.455), m.steel);
  const flange2 = addMesh(spool, cyclTorus(0.075, 0.005, -0.64), m.steel);

  // fiber payout eyelet at the aft tip
  const eyelet = addMesh(spool, new THREE.TorusGeometry(0.013, 0.0035, 8, 20), m.steel);
  eyelet.position.set(0, 0, -0.665);
  const fiberOut = addMesh(spool, cylZ(0.0025, 0.0025, 0.1, -0.715, 6, false), m.fiber, false);
  const rearCap = addMesh(spool, new THREE.CylinderGeometry(0.092, 0.092, 0.012, 36), m.dark);
  rearCap.rotation.x = Math.PI / 2;
  rearCap.position.z = -0.66;
  const rearPort = addMesh(spool, new THREE.CircleGeometry(0.055, 32), m.black);
  rearPort.position.z = -0.6675;
  rearPort.rotation.y = Math.PI;
  const rearRing = addMesh(spool, new THREE.TorusGeometry(0.057, 0.005, 8, 36), m.steel);
  rearRing.rotation.x = Math.PI / 2;
  rearRing.position.z = -0.667;

  // four folding tail fins, stowed until the missile leaves the tube
  const tailFins = radialFins(4, Math.PI / 4, () => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, -0.60);
    const fin = new THREE.Mesh(finGeometry(0.16, 0.14, 0.14, 0.0, 0.006), m.olive);
    fin.position.set(0, 0.093, 0);
    fin.castShadow = true;
    pivot.add(fin);
    tailFinMeshes.push(fin);
    return pivot;
  });
  spool.add(tailFins);

  const finAnchor = new THREE.Object3D();
  finAnchor.position.set(0, 0.2, -0.60);
  spool.add(finAnchor);
  const spoolAnchor = new THREE.Object3D();
  spoolAnchor.position.set(0, 0, -0.54);
  spool.add(spoolAnchor);

  // tail stencil on the spool
  const stencilTex = makeLabelTexture('FOG-MPM', 'AVIBRAS · M-01', {
    w: 640, h: 160, size: 84, subSize: 26, color: '#20292a'
  });
  const stencil = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.085),
    new THREE.MeshStandardMaterial({ map: stencilTex, transparent: true, roughness: 0.85, metalness: 0.05 })
  );
  stencil.position.set(-0.0915, 0, 0.24);
  stencil.rotation.y = -Math.PI / 2;
  warhead.add(stencil);

  // ---------- DETAILS ----------
  const b1 = addMesh(warhead, new THREE.CylinderGeometry(0.0905, 0.0905, 0.018, 48, 1, true), m.band, false);
  b1.rotation.x = Math.PI / 2; b1.position.z = 0.075;
  const b2 = addMesh(motor, new THREE.CylinderGeometry(0.0915, 0.0915, 0.014, 48, 1, true), m.band, false);
  b2.rotation.x = Math.PI / 2; b2.position.z = -0.04;
  const b3 = addMesh(spool, new THREE.CylinderGeometry(0.0935, 0.0935, 0.012, 48, 1, true), m.band, false);
  b3.rotation.x = Math.PI / 2; b3.position.z = -0.425;

  const plug = addMesh(warhead, new THREE.BoxGeometry(0.03, 0.015, 0.05), m.steel);
  plug.position.set(0.088, 0, 0.06);
  const hatch = addMesh(warhead, new THREE.BoxGeometry(0.008, 0.055, 0.10), m.steel);
  hatch.position.set(0.088, -0.01, 0.17);
  const hatch2 = addMesh(auto, new THREE.BoxGeometry(0.008, 0.045, 0.07), m.dark);
  hatch2.position.set(0.088, 0.03, -0.01);
  const vent = addMesh(motor, new THREE.BoxGeometry(0.03, 0.006, 0.05), m.black);
  vent.position.set(0.0, 0.088, -0.30);

  // pneumatic / umbilical port on the tail
  const airPort = addMesh(spool, new THREE.CylinderGeometry(0.018, 0.018, 0.04, 12), m.steel);
  airPort.rotation.z = Math.PI / 2;
  airPort.position.set(0.095, -0.03, -0.56);

  // ---------- SECTION MATERIALS + CLIP PLANES ----------
  const sectionList = [seeker, warhead, auto, motor, spool];
  const sections = [];
  sectionList.forEach(g => {
    const cache = new Map();
    g.traverse(o => {
      if (!o.isMesh || !o.material) return;
      if (!cache.has(o.material)) cache.set(o.material, o.material.clone());
      o.material = cache.get(o.material);
    });
    const mats = [...cache.values()];
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1000);
    // give each outer casing its own material so X-ray does not ghost the fins
    g.traverse(o => {
      if (o.isMesh && o.userData.casing) {
        const unique = o.material.clone();
        o.material = unique;
        mats.push(unique);
      }
    });
    mats.forEach(mm => {
      mm.clippingPlanes = [plane];
      mm.clipShadows = true;
      mm.needsUpdate = true;
    });
    sections.push({ id: g.userData.id, group: g, plane, materials: mats });
  });

  // ---------- API ----------
  const parts = {
    seeker, warhead, autopilot: auto, motor,
    spool, fins: tailFins, canards
  };
  const basePositions = new Map();
  Object.values(parts).forEach(p => basePositions.set(p, p.position.clone()));

  const api = {
    group,
    parts,
    materials: m,
    sections,
    anchors: {
      seeker: seekerAnchor,
      warhead: warheadAnchor,
      autopilot: autoAnchor,
      motor: motorAnchor,
      spool: spoolAnchor,
      fins: finAnchor,
      canards: canardAnchor
    },
    setExplode(v) {
      v = THREE.MathUtils.clamp(v, 0, 1);
      Object.values(parts).forEach(p => {
        const e = p.userData.explode;
        const base = basePositions.get(p);
        if (e) p.position.set(base.x + e.x * v, base.y + e.y * v, base.z + e.z * v);
      });
      api.explode = v;
    },
    setFins(open) {
      const k = THREE.MathUtils.clamp(open, 0, 1);
      tailFinMeshes.forEach(fin => { fin.scale.y = 0.14 + 0.86 * k; });
    },
    setXray(on) {
      casings.forEach(mesh => {
        const mat = mesh.material;
        if (!mat) return;
        mat.transparent = on;
        mat.opacity = on ? 0.24 : 1;
        mat.depthWrite = !on;
        mat.needsUpdate = true;
      });
    },
    setThrust(on) {
      nozzleGlows.forEach(glow => { glow.material.opacity = on ? 0.95 : 0; });
    },
    setPartHighlight(id, on) {
      const target = parts[id];
      if (!target) return;
      target.traverse(o => {
        if (!o.isMesh || !o.material || !o.material.emissive) return;
        if (o.material.userData.originalEmissive === undefined) {
          o.material.userData.originalEmissive = o.material.emissive.getHex();
          o.material.userData.originalIntensity = o.material.emissiveIntensity ?? 1;
        }
        if (on) {
          o.material.emissive.setHex(0x5c3d10);
          o.material.emissiveIntensity = 0.75;
        } else {
          o.material.emissive.setHex(o.material.userData.originalEmissive);
          o.material.emissiveIntensity = o.material.userData.originalIntensity;
        }
      });
    },
    dispose() {
      group.traverse(o => {
        if (o.isMesh) {
          o.geometry?.dispose();
          if (Array.isArray(o.material)) o.material.forEach(mm => mm.dispose());
          else o.material?.dispose();
        }
      });
    }
  };
  api.setFins(1);
  return api;
}

function cyclTorus(r, tube, z) {
  const g = new THREE.TorusGeometry(r, tube, 8, 48);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, z);
  return g;
}

/** Rectangular launch canister, opening at +Z. */
export function createCanister({ withLabels = true, length = 1.9 } = {}) {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0x7d745a, roughness: 0.78, metalness: 0.18 });
  const shellDark = new THREE.MeshStandardMaterial({ color: 0x5d5744, roughness: 0.8, metalness: 0.18 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6f7169, roughness: 0.5, metalness: 0.8 });
  const inner = new THREE.MeshStandardMaterial({ color: 0x0b0c0c, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd0aa3a, roughness: 0.7, metalness: 0.2 });

  const L = length, W = 0.31, T = 0.014;
  const walls = [
    [W, L, T, 0, W / 2 - T / 2, 0],
    [W, L, T, 0, -W / 2 + T / 2, 0],
    [T, L, W, W / 2 - T / 2, 0, 0],
    [T, L, W, -W / 2 + T / 2, 0, 0]
  ];
  walls.forEach(([w, l, h, x, y, z], i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), i < 2 ? shell : shellDark);
    b.position.set(x, y, z);
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  });

  // inner rails
  for (const [x, y] of [[0.09, 0.09], [-0.09, 0.09], [0.09, -0.09], [-0.09, -0.09]]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, L - 0.12), steel);
    rail.position.set(x, y, 0);
    g.add(rail);
  }

  // ribs
  [-L * 0.33, 0, L * 0.33].forEach(z => {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.018, 0.05), shellDark);
    rib.position.set(0, W / 2 + 0.005, z);
    g.add(rib);
    const rib2 = rib.clone();
    rib2.position.y = -W / 2 - 0.005;
    g.add(rib2);
  });

  // muzzle frame + dark opening
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, W + 0.03, 0.05), steel);
  frame.position.z = L / 2 - 0.01;
  g.add(frame);
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.05, W - 0.05), inner);
  hole.position.z = L / 2 + 0.017;
  g.add(hole);
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, W - 0.03), inner);
  rear.position.z = -L / 2 - 0.001;
  rear.rotation.y = Math.PI;
  g.add(rear);

  // hazard stripes plate
  const stripeTex = makeHazardTexture();
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.06),
    new THREE.MeshStandardMaterial({ map: stripeTex, transparent: true, roughness: 0.7 })
  );
  stripe.position.set(0, 0.09, L / 2 + 0.02);
  g.add(stripe);

  if (withLabels) {
    const tex = makeLabelTexture('FOG-MPM', 'AVIBRAS · MÍSSIL MULTIPROPÓSITO');
    const side = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.2),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, metalness: 0.1 })
    );
    side.position.set(W / 2 + 0.006, 0.04, -0.15);
    side.rotation.y = Math.PI / 2;
    side.rotation.z = Math.PI;
    g.add(side);
  }

  // trunnions
  for (const x of [-0.19, 0.19]) {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 16), steel);
    tr.rotation.z = Math.PI / 2;
    tr.position.set(x, 0, 0.1);
    g.add(tr);
  }

  // top lifting lugs
  [-0.45, 0.45].forEach(z => {
    const lug = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 16, Math.PI), steel);
    lug.position.set(0, W / 2 + 0.03, z);
    g.add(lug);
  });

  g.userData.inner = inner;
  g.userData.yellow = yellow;
  g.userData.bounds = { L, W };
  return g;
}

export function makeHazardTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#d8b23c';
  x.fillRect(0, 0, 512, 96);
  x.fillStyle = '#15130e';
  for (let i = -2; i < 14; i++) {
    x.beginPath();
    x.moveTo(i * 44, 96);
    x.lineTo(i * 44 + 24, 96);
    x.lineTo(i * 44 + 60, 0);
    x.lineTo(i * 44 + 36, 0);
    x.closePath();
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
