// main.js — 14-BIS · 1906 simulator orchestrator.
// Wiring only: render/cameras, the pure FlightModel, HUD + attitude indicator,
// input (keyboard/touch), explore hotspots, historical-flight replay (autopilots
// tuned headlessly in Node) and procedural audio. UI contract = index.html.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { GEO, PARTS, MISSIONS, SPECS, HISTORY, SOURCES, DISCLAIMER } from './data.js';
import { FlightModel, PHYS } from './flight.js';
import { buildAircraft } from './model.js';
import { buildWorld } from './world.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const R2D = 180 / Math.PI;

// ---------------------------------------------------------------- renderer ---
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(13, 5.2, 18);

const world = buildWorld(scene);
const aircraft = buildAircraft();
scene.add(aircraft.group);

// aircraft casts a real sun shadow (was missing — essential for reading height)
aircraft.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

// soft contact shadow on the ground: stays beneath the aircraft and spreads /
// fades with altitude, giving a clear sense of elevation above the field.
function makeShadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,0.9)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const groundShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false, opacity: 0.42 })
);
groundShadow.rotation.x = -Math.PI / 2;
groundShadow.position.y = 0.04;
groundShadow.renderOrder = 2;
scene.add(groundShadow);

const flight = new FlightModel();
let config = 'nov';

// ---------------------------------------------------------------- cameras ----
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxDistance = 90; controls.minDistance = 3;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 1.5, 1.0);

const CAMS = ['chase', 'pilot', 'tower', 'side', 'orbit'];
let camMode = 'chase';
const camPos = camera.position.clone(), camLook = new THREE.Vector3(0, 1.4, 0);
const _fwd = new THREE.Vector3(), _up = new THREE.Vector3();
function setCamera(mode) {
  camMode = mode;
  controls.enabled = (mode === 'orbit');
  $('cameraBtn').textContent = 'Camera: ' + mode[0].toUpperCase() + mode.slice(1);
  if (mode === 'orbit') controls.target.copy(aircraft.group.position).add(new THREE.Vector3(0, 1.2, 0));
}
function cycleCamera() { setCamera(CAMS[(CAMS.indexOf(camMode) + 1) % CAMS.length]); }
function updateCamera(dt) {
  const p = aircraft.group.position;
  _fwd.set(0, 0, 1).applyQuaternion(aircraft.group.quaternion);
  _up.set(0, 1, 0).applyQuaternion(aircraft.group.quaternion);
  if (camMode === 'orbit') {
    controls.target.lerp(p.clone().add(new THREE.Vector3(0, 1.2, 0)), 0.08);
    controls.update(); return;
  }
  let desired, look;
  if (camMode === 'chase') {
    desired = p.clone().addScaledVector(_fwd, -16).addScaledVector(_up, 5.5);
    look = p.clone().addScaledVector(_fwd, 8);
  } else if (camMode === 'pilot') {
    desired = new THREE.Vector3(0, 1.66, GEO.cgX - GEO.basketX).applyQuaternion(aircraft.group.quaternion).add(p);
    look = desired.clone().addScaledVector(_fwd, 30).addScaledVector(_up, -0.4);
  } else if (camMode === 'tower') {
    desired = new THREE.Vector3(26, 7, -18); look = p.clone();
  } else { // side
    desired = p.clone().add(new THREE.Vector3(20, 3.5, -4)); look = p.clone();
  }
  const k = camMode === 'pilot' ? 1 : 1 - Math.exp(-dt * 4.5);
  camPos.lerp(desired, k); camLook.lerp(look, k);
  camera.position.copy(camPos); camera.lookAt(camLook);
}

// ---------------------------------------------------------------- modes ------
let mode = 'explore';
function setMode(m) {
  mode = m;
  document.body.dataset.mode = m;
  document.querySelectorAll('.mode-tab').forEach((b) => {
    const on = b.dataset.mode === m;
    b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on);
  });
  if (m !== 'replay') stopReplay();
  if (m === 'explore') { setCamera('orbit'); $('partDetail').hidden = true; $('partsList').style.display = ''; $('partLead').style.display = ''; }
  if (m === 'fly') { setCamera('chase'); }
  if (m === 'replay') { setCamera('chase'); }
}
document.querySelectorAll('.mode-tab').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ---------------------------------------------------------------- explore ----
const PART_SPEC = {
  canard: '2 × 2 m Hargrave box-kite · 8 m² · elevator + rudder on a universal joint',
  wings: '3 cells per panel · span 11.5 m · chord 2.5 m · area 52 m²',
  dihedral: '10° upward V · the only lateral stability in October',
  basket: 'Open wicker nacelle · pilot stands · hand & shoulder cables',
  engine: 'Antoinette 8V · 37 kW (50 hp) @ 1,500 rpm · water-cooled V-8',
  propeller: '2-blade aluminium paddle · 2 m diameter · pusher',
  gear: '2 spoked bicycle wheels + curved nose skid · self-launched',
  ailerons: 'Octagonal interplane surfaces · Nov 1906 · worked by the shoulders',
  boom: 'Bamboo & pine lattice · aluminium sockets · marked “14”',
};
const HOTSPOT_TO_PART = { aileronR: 'ailerons' };
const partsList = $('partsList');
const partButtons = {};
Object.keys(PARTS).forEach((key, i) => {
  const b = document.createElement('button');
  b.className = 'part-item'; b.dataset.part = key;
  b.innerHTML = `<span class="part-num">${i + 1}</span><span>${PARTS[key].title}</span>`;
  b.addEventListener('click', () => selectPart(key));
  partsList.appendChild(b); partButtons[key] = b;
});
function selectPart(key) {
  const p = PARTS[key]; if (!p) return;
  $('partTitle').textContent = p.title;
  $('partSpec').textContent = PART_SPEC[key] || '';
  $('partBody').textContent = p.text;
  $('partDetail').hidden = false;
  $('partsList').style.display = 'none';
  $('partLead').style.display = 'none';
  Object.entries(partButtons).forEach(([k, b]) => b.classList.toggle('is-active', k === key));
  Object.entries(hotspotEls).forEach(([k, el]) => el.classList.toggle('is-active', (HOTSPOT_TO_PART[k] || k) === key));
}
$('partBack').addEventListener('click', () => {
  $('partDetail').hidden = true; $('partsList').style.display = ''; $('partLead').style.display = '';
  $('partTitle').textContent = 'Anatomy of the 14-bis';
  Object.values(partButtons).forEach((b) => b.classList.remove('is-active'));
  Object.values(hotspotEls).forEach((el) => el.classList.remove('is-active'));
});

// hotspots (projected 3D markers)
const hotspotLayer = $('hotspots');
const hotspotEls = {};
for (const key of Object.keys(aircraft.refs.hotspots)) {
  const partKey = HOTSPOT_TO_PART[key] || key;
  const b = document.createElement('button');
  b.className = 'hotspot'; b.textContent = Object.keys(PARTS).indexOf(partKey) + 1;
  b.title = PARTS[partKey] ? PARTS[partKey].title : key;
  b.addEventListener('click', () => { setMode('explore'); selectPart(partKey); });
  hotspotLayer.appendChild(b); hotspotEls[key] = b;
}
const _hv = new THREE.Vector3();
function updateHotspots() {
  if (mode !== 'explore') return;
  const w = window.innerWidth, h = window.innerHeight;
  for (const key of Object.keys(aircraft.refs.hotspots)) {
    const el = hotspotEls[key];
    aircraft.refs.hotspots[key].getWorldPosition(_hv);
    const dist = camera.position.distanceTo(_hv);
    _hv.project(camera);
    const off = _hv.z > 1 || dist > 75;
    el.classList.toggle('is-hidden', off);
    if (!off) { el.style.left = ((_hv.x * 0.5 + 0.5) * w) + 'px'; el.style.top = ((-_hv.y * 0.5 + 0.5) * h) + 'px'; }
  }
}

// ---------------------------------------------------------------- input ------
const keys = {};
let thrTarget = 1.0;                  // commanded throttle 0..1
const touch = { stickX: 0, stickY: 0, active: false, thrUp: false, thrDn: false, rudL: false, rudR: false };
const isTouchDevice = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouchDevice) document.body.classList.add('touch-device');

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (e.repeat) { keys[k] = true; return; }
  keys[k] = true;
  if (k === 'g') toggleEngine();
  if (k === 'r') resetFlight();
  if (k === 'c') cycleCamera();
  if (k === 'escape') { $('aboutModal').hidden = true; }
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function readControls() {
  let elev = (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0);
  let ail = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
  let rud = (keys['e'] ? 1 : 0) - (keys['q'] ? 1 : 0);
  if (touch.active) { elev = -touch.stickY; ail = touch.stickX; }
  if (touch.rudL) rud = -1; if (touch.rudR) rud = 1;
  if (keys['shift']) thrTarget = clamp(thrTarget + 0.012, 0, 1);
  if (keys['control']) thrTarget = clamp(thrTarget - 0.012, 0, 1);
  if (touch.thrUp) thrTarget = clamp(thrTarget + 0.012, 0, 1);
  if (touch.thrDn) thrTarget = clamp(thrTarget - 0.012, 0, 1);
  const brake = keys[' '] ? 1 : 0;
  return { elev: clamp(elev, -1, 1), rud: clamp(rud, -1, 1), ail: clamp(ail, -1, 1), brake };
}

// touch stick
const touchStick = $('touchStick'), stickKnob = touchStick.querySelector('i');
function stickFromEvent(e) {
  const r = touchStick.getBoundingClientRect();
  const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const m = Math.hypot(dx, dy), s = m > 1 ? 1 / m : 1;
  touch.stickX = clamp(dx * s, -1, 1); touch.stickY = clamp(dy * s, -1, 1);
  stickKnob.style.transform = `translate(calc(-50% + ${touch.stickX * 30}px), calc(-50% + ${touch.stickY * 30}px))`;
}
touchStick.addEventListener('pointerdown', (e) => { touch.active = true; touchStick.setPointerCapture(e.pointerId); stickFromEvent(e); });
touchStick.addEventListener('pointermove', (e) => { if (touch.active) stickFromEvent(e); });
const stickEnd = () => { touch.active = false; touch.stickX = 0; touch.stickY = 0; stickKnob.style.transform = 'translate(-50%,-50%)'; };
touchStick.addEventListener('pointerup', stickEnd); touchStick.addEventListener('pointercancel', stickEnd);
function holdBtn(id, on, off) { const el = $(id); el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); }); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); }
holdBtn('tThrUp', () => touch.thrUp = true, () => touch.thrUp = false);
holdBtn('tThrDn', () => touch.thrDn = true, () => touch.thrDn = false);
holdBtn('tRudL', () => touch.rudL = true, () => touch.rudL = false);
holdBtn('tRudR', () => touch.rudR = true, () => touch.rudR = false);

// ---------------------------------------------------------------- engine -----
let engineOn = false;
function toggleEngine() {
  if (flight.crashed || replay.active) return;
  engineOn = !engineOn;
  if (engineOn) { flight.startEngine(); thrTarget = 1.0; } else { flight.engineOn = false; }
  $('engineBtn').textContent = engineOn ? 'Stop engine' : 'Start engine';
  $('engineBtn').classList.toggle('is-on', engineOn);
  audio.engine(engineOn);
}
$('engineBtn').addEventListener('click', toggleEngine);
$('resetBtn').addEventListener('click', resetFlight);
$('cameraBtn').addEventListener('click', cycleCamera);
function resetFlight() {
  stopReplay();
  flight.reset(); flight.setConfig(config);
  engineOn = false; thrTarget = 1.0;
  $('engineBtn').textContent = 'Start engine'; $('engineBtn').classList.remove('is-on');
  $('hudWarn').hidden = true;
  audio.engine(false);
  syncAircraft();
}

// ---------------------------------------------------------------- replay -----
// Autopilot parameters reproduced from the headless Node tuning (replay_v8/v9).
const REPLAY = {
  oct23: { type: 'zoom', accelTo: 9.7, targetAlt: 1.4, zoomE: 0.30, ge: 0.05, flareH: 1.5, glideThr: 0.18 },
  nov12: { type: 'std', dist: 220, targetAlt: 5.0, accelTo: 10.8, ge: 0.10, flareH: 1.8, glideThr: 0, reserveK: 5 },
};
const replay = { active: false, id: null, phase: 'roll', t: 0 };
let selectedMission = 'nov12';

const flightList = $('flightList');
const flightButtons = {};
for (const id of ['oct23', 'nov12']) {
  const m = MISSIONS[id];
  const b = document.createElement('button');
  b.className = 'flight-item'; b.dataset.mission = id;
  b.innerHTML = `<div class="f-title">${m.name}</div><div class="f-date">${m.date}</div><div class="f-desc">${m.goal}</div>`;
  b.addEventListener('click', () => selectMission(id));
  flightList.appendChild(b); flightButtons[id] = b;
}
function selectMission(id) {
  selectedMission = id;
  Object.entries(flightButtons).forEach(([k, b]) => b.classList.toggle('is-active', k === id));
  $('replayStats').hidden = true;
}
selectMission('nov12');

function holdElev(f, targetAlt) {
  return clamp(0.20 + (targetAlt - f.altitude) * 0.06 - f.vel.y * 0.25 + (f.Vair - 11.3) * 0.03, -0.35, 0.55);
}
function autopilot(f, P, st) {
  const alt = f.altitude; let elev = 0, thr = 1;
  if (P.type === 'zoom') {
    if (st.phase === 'roll') { elev = st.t > 2 ? 0.85 : 0; if (!f.onGround && f.Vair > 6) st.phase = 'accel'; }
    else if (st.phase === 'accel') { elev = 0.10; if (f.Vair >= P.accelTo) st.phase = 'zoom'; }
    else if (st.phase === 'zoom') { elev = P.zoomE; if (alt >= P.targetAlt) st.phase = 'glide'; }
    else if (st.phase === 'glide') {
      thr = P.glideThr; elev = P.ge - f.vel.y * 0.12;
      if (alt < P.flareH) elev = Math.max(elev, 0.34 + (P.flareH - alt) * 0.12);
      elev = clamp(elev, -0.05, 0.6);
    }
  } else {
    const reserve = Math.max(12, P.targetAlt * P.reserveK);
    if (st.phase === 'roll') { elev = st.t > 2 ? 0.85 : 0; if (!f.onGround && f.Vair > 6) st.phase = 'climb'; }
    else if (st.phase === 'climb') { elev = f.Vair < P.accelTo ? 0.15 : holdElev(f, P.targetAlt); if (alt >= P.targetAlt * 0.92) st.phase = 'cruise'; }
    else if (st.phase === 'cruise') { elev = holdElev(f, P.targetAlt); if (f.flightDist >= P.dist - reserve) st.phase = 'glide'; }
    else if (st.phase === 'glide') {
      thr = P.glideThr; elev = P.ge;
      if (alt < P.flareH) elev = Math.max(elev, 0.30 + (P.flareH - alt) * 0.10);
      elev = clamp(elev, -0.05, 0.6);
    }
  }
  return { elev, rud: 0, ail: 0, throttle: thr, brake: 0 };
}
const PHASE_CAPTION = {
  roll: 'Running down the grass on her own wheels…',
  accel: 'Building speed in ground effect…',
  climb: 'Rotating — the canard lifts the nose…',
  zoom: 'Pulling up into a hop…',
  cruise: 'Airborne before the witnesses…',
  glide: 'Engine cut — gliding in to land…',
};
function startReplay(id) {
  resetFlight();
  const m = MISSIONS[id], P = REPLAY[id];
  setMode('replay');
  setConfig(m.config);
  replay.active = true; replay.id = id; replay.phase = 'roll'; replay.t = 0;
  engineOn = true; flight.startEngine(); thrTarget = 1.0;
  $('engineBtn').textContent = 'Stop engine'; $('engineBtn').classList.add('is-on');
  document.body.classList.add('replaying');
  $('replayStats').hidden = true;
  $('replayCaption').textContent = m.goal;
  $('replayDist').textContent = '0 m';
  $('replayFill').style.width = '0%';
  setCamera('chase');
  audio.engine(true);
}
function stopReplay() {
  if (!replay.active && !document.body.classList.contains('replaying')) return;
  replay.active = false; replay.id = null;
  document.body.classList.remove('replaying');
}
function endReplay(crashed) {
  const m = MISSIONS[replay.id];
  const lf = flight.lastFlight || { dist: flight.flightDist, time: flight.flightTime, maxAlt: flight.maxAlt, speed: flight.speedKmh };
  replay.active = false;
  document.body.classList.remove('replaying');
  engineOn = false; flight.engineOn = false; audio.engine(false);
  $('engineBtn').textContent = 'Start engine'; $('engineBtn').classList.remove('is-on');
  const rows = [
    ['Distance', lf.dist.toFixed(0) + ' m'],
    ['Duration', lf.time.toFixed(1) + ' s'],
    ['Max height', lf.maxAlt.toFixed(1) + ' m'],
    ['Speed', lf.speed.toFixed(0) + ' km/h'],
    ['Record', m.record.dist + ' m' + (m.record.time ? ' in ' + m.record.time + ' s' : '')],
    ['Prize', m.record.prize],
  ];
  $('replayStats').innerHTML =
    `<div class="kicker">${crashed ? 'Flight ended early' : 'Flight complete'}</div>` +
    rows.map(([k, v]) => `<div class="rs-row"><span>${k}</span><b>${v}</b></div>`).join('') +
    (crashed ? `<p class="rs-note">${flight.crashMsg || ''}</p>` : '');
  $('replayStats').hidden = false;
}
$('replayStart').addEventListener('click', () => startReplay(selectedMission));
$('replayStop').addEventListener('click', () => { stopReplay(); resetFlight(); });
function updateReplayHud() {
  if (!replay.active) return;
  const m = MISSIONS[replay.id];
  const pct = clamp(flight.flightDist / m.record.dist * 100, 0, 100);
  $('replayFill').style.width = pct + '%';
  $('replayDist').textContent = flight.flightDist.toFixed(0) + ' m';
  $('replayCaption').textContent = PHASE_CAPTION[replay.phase] || m.goal;
}

// ---------------------------------------------------------------- config -----
function setConfig(cfg) {
  config = cfg;
  aircraft.setConfiguration(cfg); flight.setConfig(cfg);
  document.querySelectorAll('[data-config]').forEach((b) => b.classList.toggle('is-active', b.dataset.config === cfg));
  $('configTip').textContent = cfg === 'oct'
    ? 'October 1906: no ailerons. Roll comes only from rudder + dihedral — she barely turns. Fly straight.'
    : 'November 1906: octagonal ailerons rigged to the pilot’s shoulders. Weak roll authority — lean into gentle turns.';
}
document.querySelectorAll('[data-config]').forEach((b) => b.addEventListener('click', () => setConfig(b.dataset.config)));

// ---------------------------------------------------------------- audio ------
const audio = (() => {
  let ctx = null, master = null, engGain = null, engOsc = null, engOsc2 = null, windGain = null, enabled = true, running = false;
  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = enabled ? 0.5 : 0; master.connect(ctx.destination);
      engGain = ctx.createGain(); engGain.gain.value = 0; engGain.connect(master);
      engOsc = ctx.createOscillator(); engOsc.type = 'sawtooth'; engOsc.frequency.value = 40;
      engOsc2 = ctx.createOscillator(); engOsc2.type = 'square'; engOsc2.frequency.value = 80;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      engOsc.connect(lp); engOsc2.connect(lp); lp.connect(engGain); engOsc.start(); engOsc2.start();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
      windGain = ctx.createGain(); windGain.gain.value = 0;
      noise.connect(bp); bp.connect(windGain); windGain.connect(master); noise.start();
    } catch (e) { ctx = null; }
  }
  return {
    toggle() { enabled = !enabled; if (master) master.gain.value = enabled ? 0.5 : 0; return enabled; },
    engine(on) { running = on; if (on) { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); } },
    update(rpm, Vair) {
      if (!ctx || !enabled) return;
      const f = 28 + (rpm / PHYS.rpmMax) * 70;
      engOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      engOsc2.frequency.setTargetAtTime(f * 2, ctx.currentTime, 0.08);
      engGain.gain.setTargetAtTime(running ? 0.10 + (rpm / PHYS.rpmMax) * 0.10 : 0, ctx.currentTime, 0.1);
      windGain.gain.setTargetAtTime(clamp(Vair / 40, 0, 1) * 0.05, ctx.currentTime, 0.2);
    },
  };
})();
$('soundBtn').addEventListener('click', () => {
  const on = audio.toggle();
  $('soundBtn').classList.toggle('is-on', on);
  $('soundBtn').style.opacity = on ? '1' : '0.5';
  toast(on ? 'Sound on' : 'Sound off');
});

// ---------------------------------------------------------------- HUD --------
const attCtx = $('attitude').getContext('2d');
function drawAttitude() {
  const c = attCtx, S = 110, r = S / 2;
  c.clearRect(0, 0, S, S);
  c.save();
  c.beginPath(); c.arc(r, r, r - 3, 0, Math.PI * 2); c.clip();
  c.translate(r, r); c.rotate(-flight.phi); c.translate(0, clamp(flight.theta * R2D, -25, 25) * 1.7);
  c.fillStyle = '#41506b'; c.fillRect(-S, -S * 2, S * 2, S * 2);     // sky
  c.fillStyle = '#6b5636'; c.fillRect(-S, 0, S * 2, S * 2);          // ground
  c.strokeStyle = '#f2e8d5'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(-S, 0); c.lineTo(S, 0); c.stroke();
  c.lineWidth = 1; c.strokeStyle = 'rgba(242,232,213,.7)';
  for (const p of [-10, -5, 5, 10]) { const y = -p * 1.7; c.beginPath(); c.moveTo(-12, y); c.lineTo(12, y); c.stroke(); }
  c.restore();
  // fixed aircraft symbol
  c.strokeStyle = '#e6c34a'; c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(r - 22, r); c.lineTo(r - 7, r); c.lineTo(r, r + 5); c.lineTo(r + 7, r); c.lineTo(r + 22, r); c.stroke();
  c.beginPath(); c.arc(r, r, r - 3, 0, Math.PI * 2); c.strokeStyle = 'rgba(201,162,39,.5)'; c.lineWidth = 2; c.stroke();
}
function updateHUD() {
  $('hudSpeed').textContent = flight.speedKmh.toFixed(0);
  $('hudAlt').textContent = flight.altitude.toFixed(1);
  $('hudDist').textContent = (flight.onGround ? flight.groundRun : flight.flightDist).toFixed(0);
  $('hudVs').textContent = (flight.vel.y >= 0 ? '+' : '') + flight.vel.y.toFixed(1);
  $('throttleFill').style.width = (flight.throttle * 100) + '%';
  $('hudThrottle').textContent = Math.round(flight.throttle * 100) + '%';
  $('hudRpm').textContent = Math.round(flight.rpm) + ' rpm';
  const warn = $('hudWarn');
  if (flight.crashed) { warn.textContent = flight.crashMsg || 'Damaged'; warn.hidden = false; }
  else if (flight.stalled && !flight.onGround) { warn.textContent = 'STALL — lower the nose'; warn.hidden = false; }
  else warn.hidden = true;
  drawAttitude();
}
$('windSlider').addEventListener('input', (e) => { $('windVal').textContent = (+e.target.value).toFixed(1) + ' m/s'; });

// ---------------------------------------------------------------- sync -------
function syncAircraft() {
  aircraft.group.position.set(flight.pos.x, flight.pos.y, flight.pos.z);
  aircraft.group.rotation.set(flight.theta, flight.psi, flight.phi, 'YXZ');
  aircraft.setControlSurfaces(flight.elev * PHYS.elevMax, -flight.rud * PHYS.rudMax, flight.ail * PHYS.ailMax);
  aircraft.updateWires();
  aircraft.spinProp(flight.propAngle);
  aircraft.spinWheels(flight.wheelAngle);
  const rpmF = flight.rpm / PHYS.rpmMax;
  aircraft.setPropBlur(rpmF > 0.25, clamp(rpmF * 0.5, 0, 0.45));
  // contact shadow: ground projection of the aircraft; spreads + fades with height
  const h = flight.altitude;
  const spread = 1 + h * 0.06;
  groundShadow.position.set(flight.pos.x, 0.04, flight.pos.z);
  groundShadow.scale.set(13 * spread, 11 * spread, 1);
  groundShadow.material.opacity = clamp(0.45 / (1 + h * 0.22), 0.12, 0.45);
}

// ---------------------------------------------------------------- toast ------
let toastTimer = null;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------------------------------------------------------------- modals -----
function buildAbout() {
  const photos = `<div class="about-photos">` +
    `<figure><img src="photos/01-portrait.jpg" alt="Santos-Dumont in his Panama hat" loading="lazy"><figcaption>Santos-Dumont, c. 1900</figcaption></figure>` +
    `<figure><img src="photos/05-14bis.jpg" alt="The 14-bis at Bagatelle" loading="lazy"><figcaption>The 14-bis, 1906</figcaption></figure>` +
    `<figure><img src="photos/03-eiffel.jpg" alt="Airship No. 6 rounding the Eiffel Tower" loading="lazy"><figcaption>No. 6 at the Eiffel Tower, 1901</figcaption></figure>` +
    `</div>` +
    `<p class="about-credit">Photographs colorized by AI in 2019 (CNN, Zhang–Isola–Efros, via OpenCV) for the tribute <a href="https://youtu.be/CneKRDwZDK0" target="_blank" rel="noopener">Santos Dumont In Colour</a>. <a href="../santos-dumont-in-color/">Explore the full colorized archive →</a> · <a href="https://www.hackster.io/mjrobot/colorizing-old-b-w-photos-and-videos-with-the-help-of-ai-761a85" target="_blank" rel="noopener">How it was done</a>.</p>`;
  const specs = `<h3>Specifications</h3><table class="spec-table">` +
    SPECS.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('') + `</table>`;
  const hist = `<h3>Timeline</h3><ul class="timeline">` +
    HISTORY.map((h) => `<li><b>${h.date} — ${h.title}.</b> ${h.text}</li>`).join('') + `</ul>`;
  const src = `<h3>Sources</h3><ul>` +
    SOURCES.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a> — ${s.note}</li>`).join('') + `</ul>`;
  $('aboutBody').innerHTML = photos + `<p>${DISCLAIMER}</p>` + specs + hist + src;
}
$('aboutBtn').addEventListener('click', () => { buildAbout(); $('aboutModal').hidden = false; });
$('aboutClose').addEventListener('click', () => { $('aboutModal').hidden = true; });
$('aboutModal').addEventListener('click', (e) => { if (e.target === $('aboutModal')) $('aboutModal').hidden = true; });
$('fullBtn').addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
});
$('controlsClose').addEventListener('click', () => { $('controlsCard').style.display = 'none'; $('controlsReopen').hidden = false; $('controlsReopen').style.display = 'block'; });
$('controlsReopen').addEventListener('click', () => { $('controlsCard').style.display = ''; $('controlsReopen').hidden = true; $('controlsReopen').style.display = ''; });

// ---------------------------------------------------------------- loop -------
const FIXED = 1 / 120;
let acc = 0, last = performance.now();
function update(dt, nowSec) {
  const wind = +$('windSlider').value;
  const flying = (mode === 'fly' || replay.active) && !flight.crashed;
  if (flying) {
    let inp;
    if (replay.active) { replay.t += dt; inp = autopilot(flight, REPLAY[replay.id], replay); }
    else { const c = readControls(); inp = { elev: c.elev, rud: c.rud, ail: c.ail, throttle: engineOn ? thrTarget : 0, brake: c.brake }; }
    acc += dt; let steps = 0;
    while (acc >= FIXED && steps < 16) {
      flight.step(inp, FIXED, wind); acc -= FIXED; steps++;
      for (const ev of flight.takeEvents()) {
        if (ev === 'crash') { if (replay.active) endReplay(true); else toast(flight.crashMsg || 'Crashed'); }
        if (ev === 'touchdown' && replay.active && replay.phase === 'glide') endReplay(false);
        if (ev === 'liftoff' && !replay.active) toast('Airborne!');
      }
    }
    if (flight.crashed) { engineOn = false; flight.engineOn = false; audio.engine(false); $('engineBtn').textContent = 'Start engine'; $('engineBtn').classList.remove('is-on'); }
  } else { acc = 0; flight.takeEvents(); }

  syncAircraft();
  updateCamera(dt);
  updateHotspots();
  if (mode === 'fly' || replay.active) updateHUD();
  updateReplayHud();
  world.update(dt, nowSec, aircraft.group.position, replay.active ? replay.id : null);
  audio.update(flight.rpm, flight.Vair);
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  update(dt, now / 1000);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- resize -----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- boot -------
setConfig('nov');
syncAircraft();
setMode('explore');
setCamera('orbit');
document.body.classList.remove('is-loading');
requestAnimationFrame(frame);
window.__14bis = { flight, aircraft, scene, renderer, camera, controls, update, startReplay, setConfig, setMode, setCamera, MISSIONS, REPLAY };