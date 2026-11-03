import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { GLTFExporter } from '../vendor/exporters/GLTFExporter.js';
import { PARTS, SPECS, HERO_FACTS, REFERENCES, ROCKET } from './data.js';
import { buildRocket } from './model.js';
import { makeGlowTexture } from './textures.js';

const B = ROCKET.baseY;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const state = {
  selectedId: null,
  cut: 0,
  cutTarget: 0,
  explode: 0,
  explodeTarget: 0,
  labels: false,
  rotate: false,
  cameraTween: null,
  intro: true,
  dragging: false,
};

/* ============================================================
   Interface
   ============================================================ */

function buildInterface() {
  const specGrid = $('#spec-grid');
  specGrid.innerHTML = SPECS.map((s) => `
    <div class="spec">
      <span class="spec-label">${s.label}</span>
      <span class="spec-value">${s.value}<small>${s.unit}</small></span>
    </div>
  `).join('');

  const list = $('#component-list');
  list.innerHTML = PARTS.map((p) => `
    <button class="comp" data-id="${p.id}" style="--accent:${p.accent}">
      <span class="comp-num">${p.num}</span>
      <span class="comp-main"><strong>${p.name}</strong><small>${p.short}</small></span>
      <span class="comp-arrow">↗</span>
    </button>
  `).join('');

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.comp');
    if (btn) selectPart(btn.dataset.id);
  });

  $('#detail-content').innerHTML = emptyDetailHTML();
  $('#detail').classList.remove('has-selection');

  const layer = $('#hotspot-layer');
  layer.innerHTML = '';
  PARTS.forEach((p) => {
    const btn = document.createElement('button');
    btn.className = 'hotspot';
    btn.type = 'button';
    btn.dataset.id = p.id;
    btn.style.setProperty('--accent', p.accent);
    btn.setAttribute('aria-label', `${p.num}. ${p.name}`);
    btn.innerHTML = `<span class="hs-index">${p.num}</span><span class="hs-label">${p.name}</span>`;
    btn.addEventListener('click', () => selectPart(p.id));
    layer.appendChild(btn);
  });
}

function emptyDetailHTML() {
  return `
    <div class="detail-empty">
      <span class="kicker">Leitura do objeto</span>
      <div class="big-number">14</div>
      <h2>Um organismo<br>de 14 metros.</h2>
      <p>Não é um bloco de metal: é uma cadeia de sistemas que precisa funcionar na ordem exata. Selecione um ponto no modelo ou um componente na lista para revelar sua função.</p>
      <div class="hero-facts">
        ${HERO_FACTS.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('')}
      </div>
      <div class="empty-rule"></div>
      <div class="empty-hint"><span>01</span><span>Clique em um número sobre o foguete. Use “Corte” para ver os tanques e o motor.</span></div>
      <div class="empty-hint" style="margin-top:8px"><span>02</span><span>Estudo técnico e histórico. A V-2 foi empregada como arma de terror pelo regime nazista.</span></div>
      <div class="detail-refs">
        ${REFERENCES.map((r) => `<a href="${r.href}" target="_blank" rel="noopener noreferrer">${r.label}</a>`).join('')}
      </div>
    </div>
  `;
}

function detailHTML(part) {
  return `
    <div class="detail-top">
      <div class="detail-num" style="--accent:${part.accent}">${part.num}</div>
      <button class="detail-close" type="button" aria-label="Fechar detalhe">×</button>
    </div>
    <span class="detail-tag" style="--accent:${part.accent}">${part.tag}</span>
    <h2>${part.name}</h2>
    <p class="detail-summary">${part.summary}</p>
    <p class="detail-body">${part.body}</p>
    <div class="fact-list">
      ${part.facts.map(([label, value]) => `<div class="fact"><span>${label}</span><b>${value}</b></div>`).join('')}
    </div>
    ${part.note ? `<div class="detail-note" style="--accent:${part.accent}"><b>Nota técnica</b>${part.note}</div>` : ''}
    <div class="detail-refs">
      ${REFERENCES.map((r) => `<a href="${r.href}" target="_blank" rel="noopener noreferrer">${r.label}</a>`).join('')}
    </div>
  `;
}

function selectPart(id) {
  const part = PARTS.find((p) => p.id === id);
  if (!part) return;

  state.selectedId = id;
  state.rotate = false;
  controls.autoRotate = false;
  syncDock();

  $$('.comp').forEach((el) => el.classList.toggle('is-active', el.dataset.id === id));
  $$('.hotspot').forEach((el) => el.classList.toggle('is-active', el.dataset.id === id));

  const detail = $('#detail');
  const content = $('#detail-content');
  content.innerHTML = detailHTML(part);
  detail.classList.add('has-selection');
  detail.scrollTop = 0;
  const close = $('.detail-close', content);
  if (close) close.addEventListener('click', clearSelection);

  if (state.explodeTarget > 0.5 || state.explode > 0.02) setExplode(false, false);

  const internal = ['guiagem', 'combustivel', 'oxidante', 'peroxido', 'turbobomba', 'camara', 'lemes', 'tubulacoes', 'quadro'].includes(id);
  if (internal && state.cutTarget < 0.5) {
    state.cutTarget = 1;
    syncDock();
  }
  if (id === 'fuselagem' && state.cutTarget > 0.5) {
    state.cutTarget = 0;
    syncDock();
  }

  showHalo(part);
  tweenCamera(new THREE.Vector3(...part.view.pos), new THREE.Vector3(...part.view.target), 1.2);
  if (window.innerWidth <= 920) document.body.classList.remove('show-dossier');
}

function clearSelection({ resetView = true } = {}) {
  state.selectedId = null;
  $$('.comp').forEach((el) => el.classList.remove('is-active'));
  $$('.hotspot').forEach((el) => el.classList.remove('is-active'));
  $('#detail').classList.remove('has-selection');
  $('#detail-content').innerHTML = emptyDetailHTML();
  hideHalo();
  if (resetView) {
    state.cutTarget = 0;
    state.explodeTarget = 0;
    state.rotate = false;
    controls.autoRotate = false;
    syncDock();
    tweenCamera(overviewPose().pos, overviewPose().target, 1.35);
  }
}

function syncDock() {
  const cutBtn = $('[data-action="cut"]');
  const explodeBtn = $('[data-action="explode"]');
  const labelsBtn = $('[data-action="labels"]');
  const rotateBtn = $('[data-action="rotate"]');
  cutBtn.classList.toggle('is-active', state.cutTarget > 0.5);
  explodeBtn.classList.toggle('is-active', state.explodeTarget > 0.5);
  labelsBtn.classList.toggle('is-active', state.labels);
  rotateBtn.classList.toggle('is-active', state.rotate);
}

/* ============================================================
   Three.js
   ============================================================ */

const viewport = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.localClippingEnabled = true;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07090c, 0.0125);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 140);
camera.position.set(19, 12.5, 25);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 7.4, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = true;
controls.panSpeed = 0.65;
controls.zoomToCursor = true;
controls.minDistance = 4.2;
controls.maxDistance = 42;
controls.minPolarAngle = 0.18;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotateSpeed = 0.42;
controls.rotateSpeed = 0.72;
controls.zoomSpeed = 0.85;
controls.update();

// Environment / reflections
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.035).texture;
scene.environmentIntensity = 0.46;
room.dispose?.();

// Lights
const hemi = new THREE.HemisphereLight(0xabc5d0, 0x070809, 0.25);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffe3c3, 5.6);
key.position.set(9.5, 19, 11);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -11;
key.shadow.camera.right = 11;
key.shadow.camera.top = 18;
key.shadow.camera.bottom = -7;
key.shadow.camera.near = 1;
key.shadow.camera.far = 55;
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.018;
key.shadow.radius = 5;
key.shadow.blurSamples = 12;
scene.add(key);
scene.add(key.target);
key.target.position.set(0, 7.0, 0);

const fill = new THREE.DirectionalLight(0x86b6d1, 0.45);
fill.position.set(-12, 7.5, -9);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffa36d, 2.0);
rim.position.set(-3, 9, -15);
scene.add(rim);

const coolRim = new THREE.DirectionalLight(0x79b2cf, 1.55);
coolRim.position.set(10, 6.5, -13);
scene.add(coolRim);

const engineGlow = new THREE.PointLight(0xff6b36, 13, 7, 2);
engineGlow.position.set(0.2, 1.1, 0.8);
scene.add(engineGlow);

const coldGlow = new THREE.PointLight(0x74bcd4, 5, 6, 2);

const cutLight = new THREE.SpotLight(0xffd9b5, 260, 22, Math.PI * 0.20, 0.9, 1.4);
cutLight.position.set(8, 9.5, 8);
cutLight.target.position.set(0, 6.5, 0);
cutLight.castShadow = false;
scene.add(cutLight, cutLight.target);
coldGlow.position.set(-0.8, 5.0, 1.0);
scene.add(coldGlow);

const tableGlow = new THREE.PointLight(0xffb27a, 9, 4.5, 2);
tableGlow.position.set(0, 0.65, 1.1);
scene.add(tableGlow);

// Ground shadow catcher (the pad sits on top)
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(52, 64),
  new THREE.MeshStandardMaterial({ color: 0x07090a, roughness: 1, metalness: 0.0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.205;
ground.receiveShadow = false;
scene.add(ground);

// Model
const model = buildRocket();
scene.add(model.rocket, model.pad, model.ghostHull);
model.ghostHull.position.y = B;
model.setCut(0);
model.setExplode(0);

// Selection halo
const halo = new THREE.Group();
const glowTex = makeGlowTexture();
const haloGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xd7a164, transparent: true, opacity: 0.8,
  blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
}));
haloGlow.scale.set(1.35, 1.35, 1);
haloGlow.renderOrder = 20;
const haloRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.52, 0.008, 6, 72),
  new THREE.MeshBasicMaterial({ color: 0xd7a164, transparent: true, opacity: 0.72, depthTest: false }),
);
haloRing.rotation.x = Math.PI / 2;
haloRing.renderOrder = 19;
halo.add(haloGlow, haloRing);
halo.visible = false;
scene.add(halo);

// Warm haze under the engine
const underGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xff7c3d, transparent: true, opacity: 0.18,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
underGlow.position.set(0, 0.85, 0.1);
underGlow.scale.set(2.6, 2.6, 1);
scene.add(underGlow);

const backdropGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0x477887, transparent: true, opacity: 0.13,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
backdropGlow.position.set(0, 8.0, -7.5);
backdropGlow.scale.set(16, 21, 1);
scene.add(backdropGlow);

// Dust
const dustCount = 260;
const dustPositions = new Float32Array(dustCount * 3);
for (let i = 0; i < dustCount; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 2 + Math.random() * 11;
  dustPositions[i * 3] = Math.cos(a) * r;
  dustPositions[i * 3 + 1] = Math.random() * 18;
  dustPositions[i * 3 + 2] = Math.sin(a) * r;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  map: glowTex, color: 0xb8c8cc, size: 0.038, transparent: true, opacity: 0.28,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
}));
scene.add(dust);

// Eixo técnico visível na vista explodida
const axisGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0.55, 0), new THREE.Vector3(0, 14.2, 0),
]);
const axisLine = new THREE.Line(axisGeo, new THREE.LineDashedMaterial({
  color: 0x8dc4d3, dashSize: 0.24, gapSize: 0.18, transparent: true, opacity: 0.38,
}));
axisLine.computeLineDistances();
axisLine.visible = false;
scene.add(axisLine);

/* ============================================================
   Hotspots
   ============================================================ */

const hotspots = [];
const hotLayer = $('#hotspot-layer');

const INTERNAL_PARTS = new Set(['guiagem', 'combustivel', 'oxidante', 'peroxido', 'turbobomba', 'camara', 'lemes', 'tubulacoes', 'quadro']);
const EXPLODE_CENTERS = {
  ogiva: [0, 12.7, 0],
  guiagem: [0, 10.52, 0],
  combustivel: [0, 8.21, 0],
  oxidante: [0, 5.02, 0],
  peroxido: [-0.44, 3.22, 0.26],
  turbobomba: [0.39, 2.72, 0.17],
  camara: [0, 2.02, 0],
  tubeira: [0, 0.98, 0],
  aletas: [2.05, 1.25, 1.30],
  lemes: [0, 0.90, 0],
  tubulacoes: [0.28, 4.10, 0.22],
  quadro: [0, 3.10, 0],
  antena: [0.55, 1.10, -0.70],
};

const HALO_SCALE = {
  ogiva: 1.05, guiagem: 0.82, combustivel: 1.30, oxidante: 1.28, peroxido: 0.58,
  turbobomba: 0.62, camara: 0.84, tubeira: 1.00, aletas: 1.65, lemes: 0.66,
  tubulacoes: 0.80, quadro: 0.92, antena: 0.52, fuselagem: 1.80,
};

const PART_CENTERS = {
  guiagem: [0, 10.52, 0],
  combustivel: [0, 8.21, 0],
  oxidante: [0, 5.02, 0],
  peroxido: [-0.44, 3.22, 0.26],
  turbobomba: [0.39, 2.72, 0.17],
  camara: [0, 2.02, 0],
  lemes: [0, 0.90, 0],
  tubulacoes: [0.28, 4.10, 0.22],
  quadro: [0, 3.10, 0],
};

const PART_FOCUS = {
  ...PART_CENTERS,
  ogiva: [0, 12.70, 0],
  aletas: [2.05, 1.25, 1.30],
  antena: [0.55, 1.10, -0.70],
  fuselagem: [0, 7.35, 0],
};

const EXPLODE_EASE = (e) => e * e * (3 - 2 * e);

function partCenterAt(id, explodeAmount) {
  const base = new THREE.Vector3(...(PART_FOCUS[id] || [0, 7.2, 0]));
  const e = EXPLODE_EASE(Math.max(0, Math.min(1, explodeAmount)));
  const group = model.partsById.get(id);
  if (group && group.userData.explodeOffset && id !== 'aletas' && id !== 'fuselagem') {
    base.addScaledVector(group.userData.explodeOffset, e);
  }
  if (id === 'aletas' && model.finExplodables?.[0]) {
    base.addScaledVector(model.finExplodables[0].offset, e);
  }
  base.y += B;
  return base;
}

function hullRadiusAt(y) {
  const profile = y <= 11.28
    ? [[0.64, 0], [0.78, .025], [0.825, .09], [0.825, .92], [0.808, 1.08], [0.825, 1.27], [0.825, 9.9], [0.817, 10.28], [0.802, 10.62], [0.78, 10.96], [0.75, 11.28]]
    : null;
  if (profile) {
    for (let i = 0; i < profile.length - 1; i++) {
      const [r1, y1] = profile[i];
      const [r2, y2] = profile[i + 1];
      if (y >= y1 && y <= y2) return r1 + (r2 - r1) * ((y - y1) / (y2 - y1 || 1));
    }
    return 0.825;
  }
  const t = clamp((y - 11.28) / 2.72, 0, 1);
  return 0.75 * Math.pow(1 - t, 0.72);
}

function setupHotspots() {
  PARTS.forEach((p) => {
    const el = hotLayer.querySelector(`.hotspot[data-id="${p.id}"]`);
    const angle = Math.atan2(p.anchor[0], p.anchor[2]);
    let radius = Math.hypot(p.anchor[0], p.anchor[2]);
    if (p.id !== 'aletas') {
      const surface = hullRadiusAt(p.anchor[1]) + 0.045;
      radius = Math.max(surface, Math.min(radius, surface + 0.02));
    }
    const world = new THREE.Vector3(Math.sin(angle) * radius, p.anchor[1] + B, Math.cos(angle) * radius);
    const normal = new THREE.Vector3(world.x, 0, world.z).normalize();
    hotspots.push({ id: p.id, el, world, normal, offset: p.labelOffset || [0, 0] });
  });
}

function updateHotspots() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const camDir = new THREE.Vector3();
  const projected = new THREE.Vector3();

  for (const hs of hotspots) {
    let world = hs.world;
    let cutCenter = false;
    if (state.explode <= 0.02 && state.cut > 0.45 && INTERNAL_PARTS.has(hs.id)) {
      const c = PART_CENTERS[hs.id];
      if (c) {
        world = new THREE.Vector3(c[0], c[1] + B, c[2]);
        cutCenter = true;
      }
    }
    if (state.explode > 0.02) {
      if (hs.id === 'fuselagem') {
        hs.el.classList.add('is-behind');
        continue;
      }
      const c = EXPLODE_CENTERS[hs.id];
      if (!c) {
        hs.el.classList.add('is-behind');
        continue;
      }
      const group = model.partsById.get(hs.id);
      const p = new THREE.Vector3(c[0], c[1], c[2]);
      if (group && hs.id !== 'aletas') p.add(group.position);
      world = p.setY(p.y + B);
    } else if (!cutCenter) {
      camDir.copy(camera.position).sub(hs.world).normalize();
      if (hs.normal.dot(camDir) < 0.10) {
        hs.el.classList.add('is-behind');
        continue;
      }
    }
    projected.copy(world).project(camera);
    if (projected.z > 1 || projected.z < -1) {
      hs.el.classList.add('is-behind');
      continue;
    }
    const x = (projected.x * 0.5 + 0.5) * w;
    const y = (-projected.y * 0.5 + 0.5) * h;
    if (x < -30 || x > w + 30 || y < -30 || y > h + 30) {
      hs.el.classList.add('is-behind');
      continue;
    }
    hs.el.classList.remove('is-behind');
    const off = state.explode > 0.02 ? [18, -12] : hs.offset;
    hs.el.style.transform = `translate(-50%, -50%) translate(${x + off[0]}px, ${y + off[1]}px)`;
  }
}

function showHalo(part) {
  const hs = hotspots.find((h) => h.id === part.id);
  if (!hs) return;
  const internal = INTERNAL_PARTS.has(part.id);
  const c = PART_CENTERS[part.id];
  if (internal && c) halo.position.set(c[0], c[1] + B, c[2]);
  else halo.position.copy(hs.world);
  halo.visible = true;
  const scale = HALO_SCALE[part.id] || 1.0;
  haloRing.scale.setScalar(scale);
  haloGlow.scale.set(1.05 * scale, 1.05 * scale, 1);
  haloRing.material.color.set(part.accent);
  haloGlow.material.color.set(part.accent);
  haloRing.material.opacity = 0.52;
  haloGlow.material.opacity = 0.62;
}

function hideHalo() {
  halo.visible = false;
}

/* ============================================================
   Camera
   ============================================================ */

function overviewPose() {
  const target = new THREE.Vector3(0, 7.4, 0);
  const dir = new THREE.Vector3(15.4, 3.2, 20.2).normalize();
  const narrow = window.innerWidth / window.innerHeight < 0.92;
  const dist = narrow ? 31.5 : 25.6;
  return { pos: target.clone().addScaledVector(dir, dist), target };
}

function tweenCamera(toPos, toTarget, duration = 1.2, intro = false) {
  state.cameraTween = {
    fromPos: camera.position.clone(),
    toPos: toPos.clone(),
    fromTarget: controls.target.clone(),
    toTarget: toTarget.clone(),
    t: 0,
    duration,
    intro,
  };
  state.rotate = false;
  controls.autoRotate = false;
  syncDock();
}

function updateCameraTween(dt) {
  const tw = state.cameraTween;
  if (!tw) return;
  tw.t = Math.min(1, tw.t + dt / tw.duration);
  const k = easeInOutCubic(tw.t);
  camera.position.lerpVectors(tw.fromPos, tw.toPos, k);
  controls.target.lerpVectors(tw.fromTarget, tw.toTarget, k);
  controls.update();
  if (tw.t >= 1) {
    state.cameraTween = null;
    if (tw.intro) state.intro = false;
  }
}

controls.addEventListener('start', () => {
  state.cameraTween = null;
  state.dragging = true;
  if (state.rotate) {
    state.rotate = false;
    controls.autoRotate = false;
    syncDock();
  }
});
controls.addEventListener('end', () => { state.dragging = false; });

/* ============================================================
   Actions
   ============================================================ */

function setCut(on, moveCamera = true) {
  const selected = state.selectedId;
  const wasExploded = state.explodeTarget > 0.5 || state.explode > 0.02;
  state.cutTarget = on ? 1 : 0;

  if (on && wasExploded) {
    state.explodeTarget = 0;
    if (moveCamera && selected) followSelectedPart(selected, 0, 1.25);
  }

  if (on && !selected) hideHalo();
  if (selected) {
    const p = PARTS.find((x) => x.id === selected);
    if (p) {
      if (on || !INTERNAL_PARTS.has(selected)) showHalo(p);
      else hideHalo();
    }
  }
  if (moveCamera && !selected) {
    if (on) tweenCamera(new THREE.Vector3(16.0, 11.8, 20.8), new THREE.Vector3(0, 7.0, 0), 1.3);
    else tweenCamera(overviewPose().pos, overviewPose().target, 1.3);
  }
  // Com um componente selecionado, o corte não rouba o enquadramento:
  // a câmera permanece onde o usuário deixou.
  syncDock();
}

function followSelectedPart(id, targetExplode, duration = 1.3) {
  const oldCenter = partCenterAt(id, state.explode);
  const offset = camera.position.clone().sub(oldCenter);
  const newCenter = partCenterAt(id, targetExplode);
  tweenCamera(newCenter.clone().add(offset), newCenter, duration);
}

function setExplode(on, moveCamera = true) {
  const selected = state.selectedId;
  const wasExploded = state.explodeTarget > 0.5 || state.explode > 0.02;

  if (moveCamera && selected && on !== wasExploded) {
    const oldCenter = partCenterAt(selected, state.explode);
    const offset = camera.position.clone().sub(oldCenter);
    if (on) offset.multiplyScalar(1.12);
    state.explodeTarget = on ? 1 : 0;
    state.cutTarget = 0;
    const newCenter = partCenterAt(selected, on ? 1 : 0);
    tweenCamera(newCenter.clone().add(offset), newCenter, 1.35);
    const p = PARTS.find((x) => x.id === selected);
    if (p) {
      if (on || !INTERNAL_PARTS.has(selected) || state.cutTarget > 0.5) showHalo(p);
      else hideHalo();
    }
  } else {
    state.explodeTarget = on ? 1 : 0;
    if (on) state.cutTarget = 0;
    if (on && !selected) hideHalo();
    if (on && !state.labels && !selected && window.innerWidth > 720) toggleLabels();
    if (moveCamera) {
      if (on) tweenCamera(new THREE.Vector3(19.6, 12.4, 27.8), new THREE.Vector3(0.3, 7.7, 0), 1.5);
      else if (!selected) tweenCamera(overviewPose().pos, overviewPose().target, 1.3);
    }
  }
  syncDock();
}

function toggleCut() {
  setCut(state.cutTarget < 0.5, true);
}

function toggleExplode() {
  setExplode(state.explodeTarget < 0.5, true);
}

function toggleLabels() {
  state.labels = !state.labels;
  document.body.classList.toggle('labels-on', state.labels);
  syncDock();
}

function toggleRotate() {
  state.rotate = !state.rotate;
  controls.autoRotate = state.rotate;
  if (state.rotate) state.cameraTween = null;
  syncDock();
}

function resetAll() {
  state.rotate = false;
  controls.autoRotate = false;
  state.cutTarget = 0;
  state.explodeTarget = 0;
  if (state.labels) {
    state.labels = false;
    document.body.classList.remove('labels-on');
  }
  clearSelection({ resetView: false });
  syncDock();
  tweenCamera(overviewPose().pos, overviewPose().target, 1.4);
}

$('#dock').addEventListener('click', (e) => {
  const btn = e.target.closest('.dock-btn');
  if (!btn) return;
  switch (btn.dataset.action) {
    case 'overview': resetAll(); break;
    case 'cut': toggleCut(); break;
    case 'explode': toggleExplode(); break;
    case 'labels': toggleLabels(); break;
    case 'rotate': toggleRotate(); break;
    case 'glb': exportGLB(); break;
  }
});

$('#dossier-toggle').addEventListener('click', () => {
  document.body.classList.toggle('show-dossier');
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') resetAll();
  if (e.key.toLowerCase() === 'c') toggleCut();
  if (e.key.toLowerCase() === 'e') toggleExplode();
  if (e.key.toLowerCase() === 'l') toggleLabels();
});

/* ============================================================
   GLB export
   ============================================================ */

let exporting = false;
async function exportGLB() {
  if (exporting) return;
  exporting = true;
  toast('Preparando geometria e materiais…', 5000);

  const oldExplode = model.explodeState.p;
  const oldCut = model.cutState.p;
  const oldHalo = halo.visible;
  model.setExplode(0);
  model.setCut(0);
  halo.visible = false;
  controls.autoRotate = false;
  state.rotate = false;
  syncDock();

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const exporter = new GLTFExporter();
    exporter.parse(model.rocket, (result) => {
      try {
        const blob = new Blob([result], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'V-2_A4_modelo_3d.glb';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        toast(`GLB exportado · ${(blob.size / 1048576).toFixed(1)} MB`, 4200);
      } catch (err) {
        console.error(err);
        toast('Falha ao gerar o arquivo GLB.', 4200);
      } finally {
        model.setExplode(oldExplode);
        model.setCut(oldCut);
        halo.visible = oldHalo;
        exporting = false;
      }
    }, (error) => {
      console.error(error);
      toast('Falha ao exportar o GLB neste navegador.', 4200);
      model.setExplode(oldExplode);
      model.setCut(oldCut);
      halo.visible = oldHalo;
      exporting = false;
    }, { binary: true, onlyVisible: true });
  } catch (err) {
    console.error(err);
    toast('Falha ao exportar o GLB neste navegador.', 4200);
    model.setExplode(oldExplode);
    model.setCut(oldCut);
    halo.visible = oldHalo;
    exporting = false;
  }
}

let toastTimer = 0;
function toast(message, ms = 3000) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), ms);
}

/* ============================================================
   Resize, loop, boot
   ============================================================ */

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (!state.selectedId && state.cutTarget < 0.5 && state.explodeTarget < 0.5 && !state.intro) {
    const p = overviewPose();
    camera.position.copy(p.pos);
    controls.target.copy(p.target);
  }
}
window.addEventListener('resize', onResize);

const clock = new THREE.Clock();
let elapsed = 0;
let frame = 0;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  frame++;

  if (state.cameraTween) updateCameraTween(dt);

  // anima corte / explodido com amortecimento
  const cutSpeed = 4.2;
  const explSpeed = 3.2;
  state.cut += (state.cutTarget - state.cut) * Math.min(1, dt * cutSpeed);
  state.explode += (state.explodeTarget - state.explode) * Math.min(1, dt * explSpeed);
  if (Math.abs(state.cutTarget - state.cut) < 0.002) state.cut = state.cutTarget;
  if (Math.abs(state.explodeTarget - state.explode) < 0.002) state.explode = state.explodeTarget;

  model.setCut(state.cut);
  model.setExplode(state.explode);
  axisLine.visible = state.explode > 0.04;

  // halo pulsante e acompanhamento do componente explodido
  if (halo.visible && state.selectedId && state.explode > 0.02 && state.selectedId !== 'fuselagem') {
    halo.position.copy(partCenterAt(state.selectedId, state.explode));
  }
  if (halo.visible) {
    haloGlow.material.opacity = 0.62 + Math.sin(elapsed * 3.1) * 0.16;
    const s = 1 + Math.sin(elapsed * 2.2) * 0.045;
    haloRing.scale.setScalar((HALO_SCALE[state.selectedId] || 1.0) * s);
  }

  // poeira
  const pos = dust.geometry.attributes.position;
  for (let i = 0; i < dustCount; i++) {
    let y = pos.getY(i) + dt * 0.055;
    if (y > 19) y = 0.2;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
  dust.rotation.y += dt * 0.006;

  underGlow.material.opacity = 0.13 + Math.sin(elapsed * 2.7) * 0.035;

  controls.update();
  if (frame % 2 === 0) updateHotspots();
  renderer.render(scene, camera);
}

/* ============================================================
   Boot
   ============================================================ */

function boot() {
  buildInterface();
  setupHotspots();

  const p = overviewPose();
  camera.position.copy(p.pos).multiplyScalar(1.22);
  camera.position.y += 2.4;
  controls.target.copy(p.target);
  controls.update();
  tweenCamera(p.pos, p.target, 2.2, true);

  renderer.setAnimationLoop(animate);

  const captureMode = new URLSearchParams(location.search).has('capture');
  if (captureMode) {
    $('#loader')?.remove();
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const part = params.get('part');
    if (params.get('labels') === '1') toggleLabels();
    setTimeout(() => {
      if (mode === 'cut') setCut(true);
      if (mode === 'explode') setExplode(true);
      if (part) selectPart(part);
    }, 700);
    return;
  }

  // animação de carregamento
  let progress = 0;
  const bar = $('#loader-progress');
  const pct = $('#loader-pct');
  const status = $('#loader-status');
  const statuses = [
    [12, 'Lendo prancheta A4'],
    [30, 'Soldando anéis e longarinas'],
    [50, 'Instalando tanques'],
    [68, 'Montando turbobomba'],
    [82, 'Calibrando giroscópios'],
    [94, 'Acendendo estúdio'],
  ];
  let si = 0;
  const timer = setInterval(() => {
    progress = Math.min(progress + Math.random() * 9 + 2, 96);
    bar.style.width = `${progress}%`;
    pct.textContent = `${Math.round(progress)}%`;
    while (si < statuses.length && progress >= statuses[si][0]) {
      status.textContent = statuses[si][1];
      si++;
    }
  }, 110);

  // primeiro quadro: libera o loader
  requestAnimationFrame(() => {
    setTimeout(() => {
      clearInterval(timer);
      progress = 100;
      bar.style.width = '100%';
      pct.textContent = '100%';
      status.textContent = 'Pronto para explorar';
      setTimeout(() => $('#loader').classList.add('is-ready'), 380);
    }, 1050);
  });
}

if (new URLSearchParams(location.search).has('capture')) {
  window.__V2 = { camera, controls, state, model, selectPart, resetAll, setCut, setExplode, scene, renderer };
}

try {
  boot();
} catch (err) {
  console.error(err);
  const loader = $('#loader');
  if (loader) {
    loader.innerHTML = `<div class="loader-inner"><span class="loader-kicker">Erro de renderização</span><div class="loader-title" style="font-size:42px">WebGL indisponível</div><p style="color:#9e9d93;font-size:13px;line-height:1.6">Abra este projeto em um navegador com WebGL 2 ativado — Chrome, Safari ou Firefox recentes.</p></div>`;
  }
}
