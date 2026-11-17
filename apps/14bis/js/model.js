// ============================================================
// 14-BIS · 3D model — faithful reconstruction (Nov 1906 form,
// switchable to Oct 1906 form without ailerons).
// Frame: X = span (right +), Y = up, Z = longitudinal (nose +).
// Origin at the centre of gravity. Stations: z = GEO.cgX - x.
// Sources: JATM 3(2) 2011 Table 1/Fig.2; Opdycke (1999);
// ENCIT 2006; public-domain photographs (Wikimedia Commons).
// ============================================================
import * as THREE from 'three';
import { GEO } from './data.js';

const Z = (station) => GEO.cgX - station;   // station -> model z

// ---------- procedural textures (offline, no assets) ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Japanese silk, doped pale yellow, with rib tapes
function silkTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e9dcae'; g.fillRect(0, 0, w, h);
    // subtle fabric noise
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${140 + Math.random() * 60 | 0},${115 + Math.random() * 50 | 0},60,${Math.random() * 0.06})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // rib tapes (vertical stripes = chordwise ribs)
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = 'rgba(120,95,45,0.28)'; g.fillRect(x, 0, 3, h);
      g.fillStyle = 'rgba(255,250,225,0.20)'; g.fillRect(x + 3, 0, 2, h);
    }
    // faint chordwise seam
    g.fillStyle = 'rgba(120,95,45,0.12)'; g.fillRect(0, h / 2, w, 2);
  });
}

function wickerTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#9c7444'; g.fillRect(0, 0, w, h);
    const s = 16;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const odd = ((x + y) / s) % 2 === 0;
      g.fillStyle = odd ? '#b08a54' : '#8a6236';
      g.beginPath();
      if (odd) g.roundRect(x + 1, y + 3, s - 2, s - 6, 5);
      else g.roundRect(x + 3, y + 1, s - 6, s - 2, 5);
      g.fill();
      g.strokeStyle = 'rgba(60,40,15,0.35)'; g.stroke();
    }
  });
}

function numberTexture() {
  return canvasTex(128, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#26221c';
    g.font = 'bold 74px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('14', w / 2, h / 2 + 4);
  });
}

// ---------- materials ----------
const silkTex = silkTexture();
function silkMat(repX, repY) {
  const t = silkTex.clone(); t.needsUpdate = true;
  t.repeat.set(repX, repY);
  return new THREE.MeshStandardMaterial({
    map: t, color: 0xf2e6bd, roughness: 0.85, metalness: 0,
    side: THREE.DoubleSide,
  });
}
const M = {
  wood:   new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.75 }),
  bamboo: new THREE.MeshStandardMaterial({ color: 0xc4a46c, roughness: 0.7 }),
  metal:  new THREE.MeshStandardMaterial({ color: 0x9a9a92, roughness: 0.4, metalness: 0.65 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.7 }),
  dark:   new THREE.MeshStandardMaterial({ color: 0x35302a, roughness: 0.8 }),
  tire:   new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.9 }),
  skin:   new THREE.MeshStandardMaterial({ color: 0xd9a87c, roughness: 0.8 }),
  jacket: new THREE.MeshStandardMaterial({ color: 0x3d372e, roughness: 0.9 }),
  straw:  new THREE.MeshStandardMaterial({ color: 0xf4eed9, roughness: 0.95 }),
  strawBrim: new THREE.MeshStandardMaterial({ color: 0xf1ead2, roughness: 0.95, side: THREE.DoubleSide }),
  shirt:  new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.85 }),
  wicker: new THREE.MeshStandardMaterial({ map: wickerTexture(), color: 0xc9a06a, roughness: 0.85, side: THREE.DoubleSide }),
  wire:   new THREE.LineBasicMaterial({ color: 0x4a443c, transparent: true, opacity: 0.75 }),
};

// ---------- geometry helpers ----------
const _up = new THREE.Vector3(0, 1, 0);
function tube(a, b, r, mat = M.wood, r2) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const geo = new THREE.CylinderGeometry(r2 ?? r, r, len, 6);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(_up, d.normalize());
  return mesh;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function wireBatch(pairs) {
  const pos = new Float32Array(pairs.length * 6);
  pairs.forEach(([a, b], i) => {
    pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.LineSegments(geo, M.wire);
}

// One Hargrave box-kite cell: span along X, chord along Z, gap along Y.
// Centred at origin. curtains: 'ends' (canard) or 'all' (wing cells share boundaries)
function boxKiteCell(span, chord, gap, { curtains = 'ends', silkRep = 1, ribEvery = 0.42 } = {}) {
  const g = new THREE.Group();
  const hs = span / 2, hc = chord / 2, hg = gap / 2;
  const surfMat = silkMat(span / 3.2, chord / 2.5);

  // fabric planes
  for (const sy of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(span, chord), surfMat);
    p.rotation.x = -Math.PI / 2;
    p.position.y = sy * hg;
    g.add(p);
  }
  // leading / trailing edge spars
  for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(tube(V(-hs, sy * hg, sz * hc), V(hs, sy * hg, sz * hc), 0.026, M.bamboo));
  }
  // chordwise ribs
  const nRibs = Math.max(2, Math.round(span / ribEvery));
  for (let i = 0; i <= nRibs; i++) {
    const x = -hs + (i / nRibs) * span;
    for (const sy of [-1, 1]) {
      g.add(tube(V(x, sy * hg, -hc), V(x, sy * hg, hc), 0.011, M.wood));
    }
  }
  // vertical end curtains
  const curtMat = silkMat(chord / 2.5, gap / 2.3);
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(chord, gap), curtMat);
    c.rotation.y = Math.PI / 2;
    c.position.x = sx * hs;
    g.add(c);
  }
  // interplane struts at the ends (front & rear)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(tube(V(sx * hs, -hg, sz * hc), V(sx * hs, hg, sz * hc), 0.024, M.wood));
    // aluminium socket fittings
    for (const sy of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 6), M.metal);
      s.position.set(sx * hs, sy * hg, sz * hc);
      g.add(s);
    }
  }
  // diagonal bracing wires (X in each end bay + lateral crosses)
  const pairs = [];
  for (const sx of [-1, 1]) {
    pairs.push([V(sx * hs, -hg, -hc), V(sx * hs, hg, hc)]);
    pairs.push([V(sx * hs, -hg, hc), V(sx * hs, hg, -hc)]);
  }
  for (const sy of [-1, 1]) {
    pairs.push([V(-hs, sy * hg, -hc), V(hs, sy * hg, hc)]);
    pairs.push([V(-hs, sy * hg, hc), V(hs, sy * hg, -hc)]);
  }
  g.add(wireBatch(pairs));
  return g;
}

// ---------- wing panel (3 cells, dihedral applied by caller) ----------
function wingPanel(side) {
  const panel = new THREE.Group();
  const { cellWidth, chord, gap, cellsPerWing } = GEO;
  const hc = chord / 2;
  const silkW = silkMat(cellWidth / 3.2, chord / 2.5);
  const curtW = silkMat(chord / 2.5, gap / 2.3);

  for (let i = 0; i < cellsPerWing; i++) {
    const cx = side * (i + 0.5) * cellWidth;
    // fabric planes per cell (rib texture continuous enough)
    for (const sy of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(cellWidth, chord), silkW);
      p.rotation.x = -Math.PI / 2;
      p.position.set(cx, sy * gap / 2, 0);
      panel.add(p);
      // spars
      for (const sz of [-1, 1]) {
        panel.add(tube(V(cx - cellWidth / 2, sy * gap / 2, sz * hc), V(cx + cellWidth / 2, sy * gap / 2, sz * hc), 0.027, M.bamboo));
      }
      // ribs
      for (let r = 1; r < 4; r++) {
        const x = cx - cellWidth / 2 + (r / 4) * cellWidth;
        panel.add(tube(V(x, sy * gap / 2, -hc), V(x, sy * gap / 2, hc), 0.011, M.wood));
      }
    }
  }
  // curtains + struts + sockets at every cell boundary (4 per panel)
  const pairs = [];
  for (let i = 0; i <= cellsPerWing; i++) {
    const bx = side * i * cellWidth;
    const c = new THREE.Mesh(new THREE.PlaneGeometry(chord, gap), curtW);
    c.rotation.y = Math.PI / 2;
    c.position.set(bx, 0, 0);
    panel.add(c);
    for (const sz of [-1, 1]) {
      panel.add(tube(V(bx, -gap / 2, sz * hc), V(bx, gap / 2, sz * hc), 0.025, M.wood));
      for (const sy of [-1, 1]) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.075, 6), M.metal);
        s.position.set(bx, sy * gap / 2, sz * hc);
        panel.add(s);
      }
      // bay diagonal wires
      if (i < cellsPerWing) {
        const nx = side * (i + 1) * cellWidth;
        pairs.push([V(bx, -gap / 2, sz * hc), V(nx, gap / 2, sz * hc)]);
        pairs.push([V(bx, gap / 2, sz * hc), V(nx, -gap / 2, sz * hc)]);
      }
    }
    // lateral surface wires per bay
    if (i < cellsPerWing) {
      const nx = side * (i + 1) * cellWidth;
      for (const sy of [-1, 1]) {
        pairs.push([V(bx, sy * gap / 2, -hc), V(nx, sy * gap / 2, hc)]);
        pairs.push([V(bx, sy * gap / 2, hc), V(nx, sy * gap / 2, -hc)]);
      }
    }
  }
  panel.add(wireBatch(pairs));
  return panel;
}

// ---------- octagonal interplane aileron (Nov 1906) ----------
// Per Wikipedia (Aileron) & L'Aérophile/Smithsonian: HORIZONTAL octagonal
// surfaces ("gouvernails horizontaux", REP 1904 style), pivoted about a
// spanwise axis on the forward outboard interplane struts, protruding
// forward past the wing leading edge. Differential incidence -> roll.
function aileronSurface() {
  const w = 0.85, h = 0.95, cut = 0.22;   // spanwise width, chordwise depth
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + cut, -h / 2);
  s.lineTo(w / 2 - cut, -h / 2);
  s.lineTo(w / 2, -h / 2 + cut);
  s.lineTo(w / 2, h / 2 - cut);
  s.lineTo(w / 2 - cut, h / 2);
  s.lineTo(-w / 2 + cut, h / 2);
  s.lineTo(-w / 2, h / 2 - cut);
  s.lineTo(-w / 2, -h / 2 + cut);
  s.closePath();
  const geo = new THREE.ShapeGeometry(s);
  const mesh = new THREE.Mesh(geo, silkMat(0.4, 0.45));
  mesh.rotation.x = -Math.PI / 2;   // horizontal surface between the planes
  return mesh;
}

// ============================================================
export function buildAircraft() {
  const root = new THREE.Group();
  const refs = { wheels: [], ailerons: [], hotspots: {} };

  const boomY = GEO.boomY;
  const wingZ = Z(GEO.wingLE + GEO.chord / 2);

  // ----- wings with 10 deg dihedral -----
  for (const side of [-1, 1]) {
    const panel = wingPanel(side);
    panel.position.set(side * GEO.centerGap / 2, boomY, wingZ);
    panel.rotation.z = side * GEO.dihedral;
    root.add(panel);

    // octagonal aileron in outermost cell, pivoted on the forward strut line
    const pivot = new THREE.Group();
    pivot.position.set(side * 2.5 * GEO.cellWidth, 0, GEO.chord / 2);
    pivot.add(aileronSurface());
    // hinge horn
    pivot.add(tube(V(0, 0.02, 0.3), V(0, 0.2, 0.42), 0.012, M.metal));
    panel.add(pivot);
    refs.ailerons.push({ pivot, side });
  }

  // ----- bamboo lattice boom -----
  const boom = new THREE.Group();
  const zNose = Z(0.15), zTail = Z(9.7);
  const wNose = 0.045, wTail = 0.17;
  const corners = (z, w) => [V(-w, boomY - w, z), V(w, boomY - w, z), V(w, boomY + w, z), V(-w, boomY + w, z)];
  const cn = corners(zNose, wNose), ct = corners(zTail, wTail);
  for (let i = 0; i < 4; i++) boom.add(tube(cn[i], ct[i], 0.022, M.bamboo, 0.03));
  // frames + diagonal wires
  const pairs = [];
  const nFrames = 11;
  let prev = null;
  for (let i = 0; i <= nFrames; i++) {
    const t = i / nFrames;
    const z = zNose + (zTail - zNose) * t;
    const w = wNose + (wTail - wNose) * t;
    const c = corners(z, w);
    for (let k = 0; k < 4; k++) {
      boom.add(tube(c[k], c[(k + 1) % 4], 0.012, M.wood));
      if (prev) pairs.push([prev[k], c[(k + 1) % 4]]);
    }
    prev = c;
  }
  boom.add(wireBatch(pairs));
  // "14" markings both sides
  const numTex = numberTexture();
  for (const sx of [-1, 1]) {
    const pl = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.375),
      new THREE.MeshBasicMaterial({ map: numTex, transparent: true, side: THREE.DoubleSide })
    );
    pl.rotation.y = sx * Math.PI / 2;
    pl.position.set(sx * 0.13, boomY, Z(4.6));
    boom.add(pl);
  }
  root.add(boom);

  // ----- canard on universal joint -----
  const canardPivot = new THREE.Group();
  canardPivot.position.set(0, boomY, Z(GEO.canard.x));
  const cell = boxKiteCell(GEO.canard.span, GEO.canard.chord, GEO.canard.gap, { curtains: 'ends' });
  canardPivot.add(cell);
  // universal joint fork
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.metal);
  joint.position.set(0, 0, GEO.canard.chord / 2 + 0.12);
  canardPivot.add(joint);
  root.add(canardPivot);
  refs.canardPivot = canardPivot;

  // ----- nose skid (curved runner, reaches below wheel level) -----
  const skidCurve = new THREE.CatmullRomCurve3([
    V(0, boomY - 0.05, Z(0.35)),
    V(0, 0.55, Z(0.55)),
    V(0, -0.35, Z(1.05)),
    V(0, -0.30, Z(1.55)),
    V(0, 0.25, Z(1.95)),
  ]);
  const skid = new THREE.Mesh(new THREE.TubeGeometry(skidCurve, 24, 0.035, 6), M.wood);
  root.add(skid);
  root.add(tube(V(0, boomY - 0.08, Z(0.9)), V(0, -0.2, Z(1.15)), 0.02, M.wood));
  root.add(tube(V(0, boomY - 0.08, Z(1.7)), V(0, 0.05, Z(1.6)), 0.02, M.wood));

  // ----- wicker basket + pilot -----
  const basketZ = Z(GEO.basketX);
  const basket = new THREE.Group();
  const bw = 0.86, bl = 1.05, bh = 0.95, floorY = 0.72;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(bw, bl), M.wicker);
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY;
  basket.add(floor);
  const wallGeoFB = new THREE.PlaneGeometry(bw, bh);
  const wallGeoS = new THREE.PlaneGeometry(bl, bh);
  const walls = [
    [wallGeoFB, 0, floorY + bh / 2, bl / 2, 0],
    [wallGeoFB, 0, floorY + bh / 2, -bl / 2, Math.PI],
    [wallGeoS, bw / 2, floorY + bh / 2, 0, Math.PI / 2],
    [wallGeoS, -bw / 2, floorY + bh / 2, 0, -Math.PI / 2],
  ];
  for (const [geo, x, y, z, ry] of walls) {
    const wll = new THREE.Mesh(geo, M.wicker);
    wll.position.set(x, y, z); wll.rotation.y = ry;
    basket.add(wll);
  }
  // rim
  const rimPts = [V(-bw / 2, floorY + bh, -bl / 2), V(bw / 2, floorY + bh, -bl / 2), V(bw / 2, floorY + bh, bl / 2), V(-bw / 2, floorY + bh, bl / 2), V(-bw / 2, floorY + bh, -bl / 2)];
  for (let i = 0; i < 4; i++) basket.add(tube(rimPts[i], rimPts[i + 1], 0.028, M.wood));
  // supports to boom
  for (const sx of [-1, 1]) {
    basket.add(tube(V(sx * bw / 2, floorY, 0), V(sx * 0.1, boomY - 0.12, 0), 0.02, M.wood));
  }
  basket.position.z = basketZ;
  root.add(basket);

  // pilot — Santos-Dumont standing, cap & high-collar jacket
  const pilot = new THREE.Group();
  const py = floorY;
  for (const sx of [-1, 1]) {
    pilot.add(tube(V(sx * 0.09, py, 0), V(sx * 0.09, py + 0.82, 0), 0.055, M.dark));
  }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.62, 10), M.jacket);
  torso.position.set(0, py + 1.12, 0);
  pilot.add(torso);
  for (const sx of [-1, 1]) {
    const arm = tube(V(sx * 0.17, py + 1.36, 0.02), V(sx * 0.24, py + 0.95, 0.14), 0.042, M.jacket);
    pilot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.skin);
    hand.position.set(sx * 0.24, py + 0.93, 0.15);
    pilot.add(hand);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), M.skin);
  head.position.set(0, py + 1.56, 0);
  pilot.add(head);
  // period outfit: high white collar + dark tie
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.095, 0.05, 10), M.shirt);
  collar.position.set(0, py + 1.45, 0);
  pilot.add(collar);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.02), M.dark);
  tie.position.set(0, py + 1.34, 0.13);
  pilot.add(tie);
  // iconic white Panama hat — rounded crown, dark band, wide drooping brim
  // (homage to Santos-Dumont, who always wore one; brim droops via a lathe profile)
  const hat = new THREE.Group();
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.118, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), M.straw);
  crown.scale.y = 0.82;
  hat.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.119, 0.122, 0.024, 18), M.dark);
  band.position.y = 0.006;
  hat.add(band);
  const brimPts = [
    new THREE.Vector2(0.115, 0.0), new THREE.Vector2(0.165, -0.018),
    new THREE.Vector2(0.22, -0.05), new THREE.Vector2(0.27, -0.105),
  ];
  const brim = new THREE.Mesh(new THREE.LatheGeometry(brimPts, 30), M.strawBrim);
  hat.add(brim);
  hat.position.set(0, py + 1.625, 0);
  hat.rotation.x = 0.06;                       // tipped slightly forward
  pilot.add(hat);
  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), M.dark);
  stache.position.set(0, py + 1.52, 0.1);
  pilot.add(stache);
  pilot.position.z = basketZ + 0.05;
  root.add(pilot);
  refs.pilotShoulders = [V(-0.17, py + 1.36, basketZ + 0.05), V(0.17, py + 1.36, basketZ + 0.05)];

  // ----- Antoinette 8V engine -----
  const engZ = Z(GEO.engineX);
  const engine = new THREE.Group();
  const crank = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.68), M.dark);
  crank.position.set(0, boomY, 0);
  engine.add(crank);
  for (const bank of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = -0.26 + i * 0.17;
      const dir = V(bank * Math.SQRT1_2, Math.SQRT1_2, 0);
      const base = V(bank * 0.12, boomY + 0.12, z);
      const top = base.clone().addScaledVector(dir, 0.34);
      engine.add(tube(base, top, 0.062, M.copper));
      const headCap = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.05, 8), M.metal);
      headCap.position.copy(top);
      headCap.quaternion.setFromUnitVectors(_up, dir);
      engine.add(headCap);
      // exhaust stub
      engine.add(tube(top, top.clone().add(V(bank * 0.08, 0.1, -0.06)), 0.018, M.metal));
    }
  }
  // radiator panel (water-cooled)
  const rad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.5), M.copper);
  rad.position.set(0.32, boomY + 0.05, 0.05);
  engine.add(rad);
  // flywheel + prop shaft
  const fly = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 16), M.metal);
  fly.rotation.x = Math.PI / 2;
  fly.position.set(0, boomY, -0.42);
  engine.add(fly);
  engine.add(tube(V(0, boomY, -0.42), V(0, boomY, Z(GEO.propX) - engZ + 0.05), 0.03, M.metal));
  engine.position.z = engZ;
  root.add(engine);

  // ----- pusher propeller (2-blade paddle, 2 m) -----
  const propGroup = new THREE.Group();
  propGroup.position.set(0, boomY, Z(GEO.propX));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 10), M.metal);
  hub.rotation.x = Math.PI / 2;
  propGroup.add(hub);
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.07, 0.08);
  bladeShape.lineTo(-0.13, 0.55);
  bladeShape.quadraticCurveTo(-0.12, 0.95, 0, 0.98);
  bladeShape.quadraticCurveTo(0.12, 0.95, 0.13, 0.55);
  bladeShape.lineTo(0.07, 0.08);
  bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.018, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const blade = new THREE.Mesh(bladeGeo, M.metal);
    blade.rotation.z = s === 1 ? 0 : Math.PI;
    blade.rotation.y = 0.35;   // blade pitch
    blade.position.z = -0.01;
    propGroup.add(blade);
  }
  // motion-blur disc at speed
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(GEO.propR, 32),
    new THREE.MeshBasicMaterial({ color: 0xd8d2c0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
  );
  blur.visible = false;
  propGroup.add(blur);
  root.add(propGroup);
  refs.propGroup = propGroup;
  refs.propBlur = blur;

  // ----- landing gear: 2 bicycle wheels + struts -----
  const gearZ = Z(GEO.wheelX);
  for (const sx of [-1, 1]) {
    const wx = sx * GEO.wheelTrack / 2;
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(GEO.wheelR, 0.032, 8, 24), M.tire);
    tire.rotation.y = Math.PI / 2;
    wheel.add(tire);
    const spokes = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      spokes.push([V(0, 0, 0), V(0, Math.cos(a) * (GEO.wheelR - 0.03), Math.sin(a) * (GEO.wheelR - 0.03))]);
    }
    wheel.add(wireBatch(spokes));
    const hubW = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.09, 8), M.metal);
    hubW.rotation.z = Math.PI / 2;
    wheel.add(hubW);
    wheel.position.set(wx, GEO.wheelR, gearZ);
    root.add(wheel);
    refs.wheels.push(wheel);
    // splayed struts from boom
    root.add(tube(V(sx * 0.12, boomY - 0.12, gearZ + 0.18), V(wx, GEO.wheelR, gearZ), 0.022, M.wood));
    root.add(tube(V(sx * 0.12, boomY - 0.12, gearZ - 0.18), V(wx, GEO.wheelR, gearZ), 0.022, M.wood));
    root.add(tube(V(sx * 0.05, boomY - 0.3, gearZ), V(wx * 0.8, GEO.wheelR + 0.1, gearZ), 0.016, M.wood));
  }

  // ----- dynamic control wires (canard -> basket, shoulders -> ailerons) -----
  const dynGeo = new THREE.BufferGeometry();
  const dynPos = new Float32Array(8 * 6);   // 4 canard + 2 aileron + 2 spare
  dynGeo.setAttribute('position', new THREE.BufferAttribute(dynPos, 3));
  const dynWires = new THREE.LineSegments(dynGeo, M.wire);
  dynWires.frustumCulled = false;
  root.add(dynWires);
  refs.dynWires = dynWires;

  // ----- exhibit hotspots -----
  const hs = (name, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    root.add(o);
    refs.hotspots[name] = o;
  };
  hs('canard', 0, boomY + GEO.canard.gap / 2 + 0.15, Z(GEO.canard.x));
  hs('wings', 3.4, boomY + GEO.gap / 2 + 0.3, wingZ);
  hs('dihedral', 5.55, boomY + 5.55 * Math.tan(GEO.dihedral) + GEO.gap / 2, wingZ);
  hs('basket', 0, 1.9, basketZ);
  hs('engine', 0.35, boomY + 0.45, engZ);
  hs('propeller', 0, boomY + GEO.propR * 0.6, Z(GEO.propX));
  hs('gear', GEO.wheelTrack / 2 + 0.15, 0.5, gearZ);
  hs('aileronR', 2.5 * GEO.cellWidth + GEO.centerGap / 2, boomY + 0.25, wingZ + GEO.chord / 2 + 0.15);
  hs('boom', 0, boomY + 0.25, Z(3.4));

  // ----- configuration & control API -----
  let config = 'nov';
  function setConfiguration(cfg) {
    config = cfg;
    for (const a of refs.ailerons) a.pivot.visible = cfg === 'nov';
  }
  function setControlSurfaces(elev, rud, ail) {
    // canard: pitch about lateral axis, yaw about vertical (universal joint)
    canardPivot.rotation.order = 'YXZ';
    canardPivot.rotation.y = rud;
    canardPivot.rotation.x = -elev;
    for (const a of refs.ailerons) {
      a.pivot.rotation.x = config === 'nov' ? ail * a.side : 0;
    }
  }
  const _wv = new THREE.Vector3();
  function updateWires() {
    const pos = dynGeo.attributes.position.array;
    let k = 0;
    const put = (a, b) => {
      pos[k++] = a.x; pos[k++] = a.y; pos[k++] = a.z;
      pos[k++] = b.x; pos[k++] = b.y; pos[k++] = b.z;
    };
    // canard rear corners -> basket rim (pitch/yaw cables)
    const cc = GEO.canard.chord / 2, ch = GEO.canard.gap / 2;
    const anchors = [V(-0.95, ch, -cc), V(0.95, ch, -cc), V(-0.95, -ch, -cc), V(0.95, -ch, -cc)];
    const basketTop = [V(-0.4, 1.68, basketZ - 0.4), V(0.4, 1.68, basketZ - 0.4), V(-0.4, 1.0, basketZ - 0.45), V(0.4, 1.0, basketZ - 0.45)];
    for (let i = 0; i < 4; i++) {
      _wv.copy(anchors[i]);
      canardPivot.localToWorld(_wv);
      root.worldToLocal(_wv);
      put(_wv, basketTop[i]);
    }
    // shoulder harness -> aileron horns (Nov only)
    for (let i = 0; i < 2; i++) {
      const a = refs.ailerons[i];
      if (config === 'nov' && a.pivot.visible) {
        _wv.set(0, 0.2, 0.42);
        a.pivot.localToWorld(_wv);
        root.worldToLocal(_wv);
        put(refs.pilotShoulders[i], _wv);
      } else {
        put(refs.pilotShoulders[i], refs.pilotShoulders[i]);
      }
    }
    dynGeo.attributes.position.needsUpdate = true;
  }

  setConfiguration('nov');
  updateWires();

  return {
    group: root, refs, setConfiguration, setControlSurfaces, updateWires,
    spinProp: (a) => { propGroup.rotation.z = a; },
    spinWheels: (a) => { for (const w of refs.wheels) w.rotation.x = a; },
    setPropBlur: (on, op) => { blur.visible = on; blur.material.opacity = op; },
    get config() { return config; },
  };
}