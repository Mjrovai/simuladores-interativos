import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { chapters, parts, sources } from './content.js';
import { Studio } from './studio.js';
import { Field } from './field.js';
import { SeekerFeed } from './seeker.js';
import { Engagement, SIM_TOTAL } from './sim.js';

const $ = s => document.querySelector(s);

const dom = {
  canvas: $('#scene'),
  fade: $('#fade'),
  panel: $('#panel'),
  kicker: $('#panelKicker'),
  title: $('#panelTitle'),
  lead: $('#panelLead'),
  body: $('#panelBody'),
  stats: $('#panelStats'),
  steps: $('#panelSteps'),
  cards: $('#panelCards'),
  timeline: $('#panelTimeline'),
  parts: $('#panelParts'),
  note: $('#panelNote'),
  actions: $('#panelActions'),
  rail: $('#rail'),
  hotspots: $('#hotspots'),
  targetTags: $('#targetTags'),
  seeker: $('#seekerPanel'),
  seekerCanvas: $('#seekerCanvas'),
  skLink: $('#skLink'),
  skRange: $('#skRange'),
  simBar: $('#simBar'),
  playBtn: $('#playBtn'),
  scrub: $('#scrub'),
  simTime: $('#simTime'),
  phaseLabels: $('#phaseLabels'),
  resetSim: $('#resetSim'),
  anatomyBar: $('#anatomyBar'),
  explodeSlider: $('#explodeSlider'),
  cutawayToggle: $('#cutawayToggle'),
  cutawayBtn: $('#cutawayBtn'),
  jammerBar: $('#jammerBar'),
  jammerBtn: $('#jammerBtn'),
  jammerStatus: $('#jammerStatus'),
  cpNum: $('#cpNum'),
  cpFill: $('#cpFill'),
  prevBtn: $('#prevBtn'),
  nextBtn: $('#nextBtn'),
  intro: $('#intro'),
  loader: $('#loader'),
  loaderFill: $('#loaderFill'),
  loaderSub: $('#loaderSub')
};

const state = {
  chapter: 0,
  scene: 'studio',
  started: false,
  selectedPart: null,
  cutaway: false,
  jammer: false,
  transitioning: false,
  seekerVisible: false,
  targetTags: [],
  simActive: false,
  autoplayTimer: null
};

let renderer, pmrem, env, studio, field, seeker, sim;
let last = performance.now();
let seekerAcc = 0;
let hudAcc = 0;
let hotspots = [];
let hsCard = null;
const tmpV = new THREE.Vector3();

const DEMO_STATE = {
  t: 14, u: 0.33, phase: 'CRUZEIRO', phaseId: 'cruise',
  altM: 200, rangeKm: 7.4, speed: 180, fiberM: 4800,
  lock: false, link: true, aim: 0.18, pitch: -0.08,
  targetVisible: true, impacted: false, controlYaw: true, manual: false
};

/* ---------------------------------------------------------- boot */

const wait = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

function setLoad(pct, label) {
  dom.loaderFill.style.width = pct + '%';
  dom.loaderSub.textContent = label;
}

async function boot() {
  try {
    setLoad(10, 'abrindo contexto WebGL');
    await wait(50);

    renderer = new THREE.WebGLRenderer({
      canvas: dom.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(0x06080a, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;

    setLoad(28, 'gerando reflexos do estúdio');
    await nextFrame();
    pmrem = new THREE.PMREMGenerator(renderer);
    env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    setLoad(42, 'montando a fuselagem');
    await wait(40);
    studio = new Studio(renderer, env);

    setLoad(66, 'escavando o campo de tiro');
    await nextFrame();
    seeker = new SeekerFeed(dom.seekerCanvas);
    field = new Field(renderer, env, dom.seekerCanvas);

    setLoad(86, 'calibrando o enlace de fibra');
    await nextFrame();
    sim = new Engagement(field);
    sim.onTick = () => updateSimUI(sim.t);

    buildRail();
    buildHotspots();
    buildTargetTags();
    buildPhaseLabels();
    bindEvents();
    onResize();

    applyChapter(0, { intro: true });

    setLoad(100, 'pronto para o lançamento');
    await wait(380);
    dom.loader.classList.add('done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('ready');
    window.__fog = { studio, field, sim, state, THREE };
    requestAnimationFrame(tick);
  } catch (err) {
    console.error(err);
    dom.loader.innerHTML = `<div class="webgl-error">Não foi possível iniciar o WebGL.<br><br>${String(err.message || err)}</div>`;
  }
}

/* ---------------------------------------------------------- content */

function buildPanel(ch) {
  dom.kicker.textContent = ch.kicker;
  dom.title.textContent = ch.title;
  dom.lead.textContent = ch.lead;
  dom.body.innerHTML = (ch.body || []).map(p => `<p>${p}</p>`).join('');
  dom.stats.innerHTML = (ch.stats || []).map(s =>
    `<div class="stat"><b>${s.v}</b><span>${s.l}</span></div>`
  ).join('');
  dom.steps.innerHTML = (ch.steps || []).map(s => `
    <div class="step">
      <span class="sn">${s.n}</span>
      <div><b>${s.t}</b><p>${s.d}</p></div>
    </div>`).join('');
  dom.cards.innerHTML = (ch.cards || []).map(c => `
    <div class="card">
      <span class="cn">${c.n}</span>
      <div><b>${c.t}</b><p>${c.d}</p></div>
    </div>`).join('');
  dom.timeline.innerHTML = (ch.timeline || []).map(t => `
    <div class="tl"><b>${t.y}</b><span>${t.t}</span></div>`).join('');
  if (ch.id === 'legado') {
    dom.timeline.innerHTML += `<div class="parts-head">FONTES CONSULTADAS</div>` +
      sources.map(s => `<a class="source-link" href="${s.url}" target="_blank" rel="noopener">${s.label} ↗</a>`).join('');
  }
  dom.note.textContent = ch.note || '';

  if (ch.ui && ch.ui.hotspots) {
    dom.parts.innerHTML = '<div class="parts-head">SISTEMAS · CLIQUE PARA EXPLORAR</div>' +
      parts.map((p, i) => `
        <button class="part-btn" data-part="${p.id}">
          <span class="pn">${String(i + 1).padStart(2, '0')}</span>
          <span class="pt">${p.name}</span>
          <span class="pa">↗</span>
        </button>`).join('');
  } else {
    dom.parts.innerHTML = '';
  }

  const actions = [];
  if (ch.id === 'lancamento') actions.push({ a: 'launch', label: 'Assistir ao lançamento' });
  if (ch.id === 'voo') actions.push({ a: 'replay', label: 'Repetir engajamento' });
  if (ch.id === 'alvos') actions.push({ a: 'launch', label: 'Rever o engajamento' });
  if (ch.id === 'anatomia') actions.push({ a: 'cutaway', label: 'Alternar corte seccionado', ghost: true });
  dom.actions.innerHTML = actions.map(x => `
    <button class="btn ${x.ghost ? 'ghost' : ''}" data-action="${x.a}">
      <span>${x.label}</span>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M4 12h15M13 6l6 6-6 6"/>
      </svg>
    </button>`).join('');

  dom.panel.scrollTop = 0;
  const sc = dom.panel.querySelector('.panel-scroll');
  if (sc) sc.scrollTop = 0;
}

function updateChrome() {
  const i = state.chapter;
  dom.cpNum.textContent = String(i + 1).padStart(2, '0');
  dom.cpFill.style.width = `${((i + 1) / chapters.length) * 100}%`;
  dom.prevBtn.disabled = i === 0;
  dom.nextBtn.disabled = i === chapters.length - 1;
  $('#infoBtn').textContent = chapters[i].nav;
  [...dom.rail.children].forEach((b, k) => b.classList.toggle('active', k === i));
}

/* ---------------------------------------------------------- chapters */

function applyChapter(i, { intro = false } = {}) {
  state.chapter = i;
  const ch = chapters[i];
  buildPanel(ch);
  updateChrome();

  resetChapterUI();

  const targetScene = ch.scene;
  const sceneChanged = targetScene !== state.scene;

  const setup = () => {
    state.scene = targetScene;
    setSceneControls();
    if (ch.id === 'voo') {
      sim.reset();
      state.simActive = true;
      dom.simBar.hidden = false;
      state.autoplayTimer = setTimeout(() => {
        if (state.chapter === 4) sim.play();
      }, 750);
    } else if (targetScene === 'studio') {
      studio.setPose(intro ? 'intro' : ch.pose, true);
      if (ch.id === 'anatomia') {
        studio.setExplode(parseFloat(dom.explodeSlider.value) || 0.55);
        dom.hotspots.style.display = 'block';
        dom.anatomyBar.hidden = false;
        dom.cutawayBtn.hidden = false;
        setCutaway(true);
      } else {
        studio.setExplode(0);
      }
    } else {
      field.setPose(ch.pose, intro);
    }

    if (ch.id === 'lancamento') {
      field.setMissileVisible(false);
    }
    if (ch.id === 'guia') {
      field.setMissileAt(0.33);
      field.missile.setFins(1);
      field.missile.setThrust(false);
      dom.seeker.hidden = false;
      dom.jammerBar.hidden = false;
      document.body.classList.add('seeker-on');
      state.seekerVisible = true;
    }
    if (ch.id === 'voo') {
      dom.seeker.hidden = false;
      document.body.classList.add('seeker-on');
      state.seekerVisible = true;
    }
    if (ch.id === 'alvos') {
      field.setMissileVisible(false);
      field.setTargetRings(true);
      dom.targetTags.style.display = 'block';
    }
  };

  if (sceneChanged) {
    state.transitioning = true;
    dom.fade.classList.add('on');
    setTimeout(() => {
      setup();
      dom.fade.classList.remove('on');
      state.transitioning = false;
    }, 280);
  } else {
    setup();
  }
}

function resetChapterUI() {
  clearPart();
  dom.hotspots.style.display = 'none';
  dom.targetTags.style.display = 'none';
  dom.seeker.hidden = true;
  dom.simBar.hidden = true;
  dom.anatomyBar.hidden = true;
  dom.jammerBar.hidden = true;
  dom.cutawayBtn.hidden = true;
  document.body.classList.remove('seeker-on');
  state.seekerVisible = false;
  state.simActive = false;
  if (state.autoplayTimer) {
    clearTimeout(state.autoplayTimer);
    state.autoplayTimer = null;
  }
  if (sim) {
    sim.pause();
    sim.reset({ silent: true });
    field.directorActive = false;
    field.controls.enabled = true;
  }
  if (field) {
    field.setJammer(false);
    field.setTargetRings(false);
    state.jammer = false;
    dom.jammerBtn.classList.remove('on');
    dom.jammerBtn.textContent = 'ATIVAR JAMMER RF';
    dom.jammerStatus.innerHTML = '<i></i> ENLACE DE FIBRA: IMUNE';
  }
  if (studio) {
    studio.setExplode(0);
    if (state.cutaway) setCutaway(false);
  }
}

function setSceneControls() {
  const studioActive = state.scene === 'studio';
  studio.controls.enabled = studioActive && !studio.tween;
  field.controls.enabled = !studioActive && !field.tween && !state.simActive;
}

function buildTargetTags() {
  ['A', 'B', 'C'].forEach((letter, i) => {
    const el = document.createElement('div');
    el.className = 'target-tag';
    el.textContent = letter;
    dom.targetTags.appendChild(el);
    state.targetTags.push(el);
  });
}

function updateTargetTags() {
  const w = window.innerWidth, h = window.innerHeight;
  const pts = [
    field.tank.position.clone().add(new THREE.Vector3(0, 8, 0)),
    field.bunker.position.clone().add(new THREE.Vector3(0, 7.2, 0)),
    field.heli.position.clone().add(new THREE.Vector3(0, 3.6, 0))
  ];
  state.targetTags.forEach((el, i) => {
    tmpV.copy(pts[i]).project(field.camera);
    if (tmpV.z > 1 || tmpV.z < -1) { el.style.display = 'none'; return; }
    el.style.display = 'grid';
    el.style.left = (tmpV.x * 0.5 + 0.5) * w + 'px';
    el.style.top = (-tmpV.y * 0.5 + 0.5) * h + 'px';
  });
}

/* ---------------------------------------------------------- hotspots */

function buildHotspots() {
  hsCard = document.createElement('div');
  hsCard.className = 'hs-card';
  hsCard.innerHTML = `<button class="hsc-close" aria-label="Fechar">×</button>
    <div class="hsc-kicker"></div><h4></h4><p></p>`;
  document.body.appendChild(hsCard);
  hsCard.querySelector('.hsc-close').addEventListener('click', () => clearPart());

  parts.forEach(p => {
    const anchor = studio.missile.anchors[p.id];
    if (!anchor) return;
    const el = document.createElement('button');
    el.className = 'hotspot';
    el.dataset.part = p.id;
    el.setAttribute('aria-label', p.name);
    el.innerHTML = `<span class="dot"></span><span class="hs-label">${p.name}</span>`;
    el.addEventListener('click', e => {
      e.stopPropagation();
      selectPart(p.id);
    });
    dom.hotspots.appendChild(el);
    hotspots.push({ el, anchor, part: p });
  });
  dom.hotspots.style.display = 'none';
  dom.targetTags.style.display = 'none';
}

function updateHotspots() {
  if (state.chapter !== 1 || state.scene !== 'studio') return;
  const w = window.innerWidth, h = window.innerHeight;
  for (const hs of hotspots) {
    hs.anchor.getWorldPosition(tmpV);
    const dist = tmpV.distanceTo(studio.camera.position);
    tmpV.project(studio.camera);
    const off = tmpV.z > 1 || tmpV.z < -1 || dist > 9;
    if (off) {
      hs.el.style.display = 'none';
      continue;
    }
    hs.el.style.display = 'grid';
    const x = (tmpV.x * 0.5 + 0.5) * w;
    const y = (-tmpV.y * 0.5 + 0.5) * h;
    hs.el.style.left = x + 'px';
    hs.el.style.top = y + 'px';
    hs.el.classList.toggle('flip', x > w - 430);
  }
}

function positionCard(x, y, w, h) {
  if (!hsCard) return;
  hsCard.style.left = Math.min(w - 276, Math.max(14, x + 24)) + 'px';
  hsCard.style.top = Math.min(h - 220, Math.max(84, y - 44)) + 'px';
}

function selectPart(id) {
  const part = parts.find(p => p.id === id);
  if (!part) return;
  if (state.selectedPart === id) { clearPart(); return; }
  clearPart(false);
  state.selectedPart = id;
  studio.missile.setPartHighlight(id, true);
  studio.focusPart(id, 0.9);
  hotspots.forEach(h => h.el.classList.toggle('active', h.part.id === id));
  dom.parts.querySelectorAll('.part-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.part === id));
  hsCard.querySelector('.hsc-kicker').textContent =
    `SISTEMA ${String(parts.indexOf(part) + 1).padStart(2, '0')} · FOG-MPM`;
  hsCard.querySelector('h4').textContent = part.name;
  hsCard.querySelector('p').textContent = part.desc;
  hsCard.classList.add('show');
}

function clearPart(returnToOverview = true) {
  if (!state.selectedPart) return;
  studio.missile.setPartHighlight(state.selectedPart, false);
  state.selectedPart = null;
  if (hsCard) hsCard.classList.remove('show');
  hotspots.forEach(h => h.el.classList.remove('active'));
  dom.parts.querySelectorAll('.part-btn').forEach(b => b.classList.remove('active'));
  if (returnToOverview && state.chapter === 1 && !state.transitioning) {
    setTimeout(() => {
      if (!state.selectedPart && state.chapter === 1) studio.setPose('anatomia');
    }, 40);
  }
}

/* ---------------------------------------------------------- sim UI */

function buildPhaseLabels() {
  dom.phaseLabels.innerHTML = Engagement.phases
    .map(p => `<span data-phase="${p.id}">${p.short || p.label}</span>`).join('');
}

function updateSimUI(t) {
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  dom.simTime.textContent = `${mm}:${ss}`;
  dom.scrub.value = String(t);
  dom.scrub.style.setProperty('--p', `${(t / SIM_TOTAL) * 100}%`);
  dom.playBtn.classList.toggle('playing', sim.playing);
  const ph = sim.phase.id;
  dom.phaseLabels.querySelectorAll('span').forEach(s =>
    s.classList.toggle('on', s.dataset.phase === ph));
  const st = sim.state();
  dom.skRange.textContent = `RNG ${st.rangeKm.toFixed(1).replace('.', ',')} KM`;
  dom.skLink.textContent = `FIBRA ${Math.round(st.fiberM).toLocaleString('pt-BR')} M`;
}

/* ---------------------------------------------------------- events */

function bindEvents() {
  dom.rail.addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (b) goTo(Number(b.dataset.i));
  });
  dom.prevBtn.addEventListener('click', () => goTo(state.chapter - 1));
  dom.nextBtn.addEventListener('click', () => goTo(state.chapter + 1));
  $('#brandBtn').addEventListener('click', () => goTo(0));
  $('#infoBtn').addEventListener('click', () => document.body.classList.toggle('panel-open'));
  $('#panelClose').addEventListener('click', () => document.body.classList.remove('panel-open'));
  $('#aboutBtn').addEventListener('click', () => goTo(6));
  $('#startBtn').addEventListener('click', () => {
    document.body.classList.add('started');
    if (!state.started) {
      state.started = true;
      goTo(0);
    }
  });
  $('#fullBtn').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  dom.actions.addEventListener('click', e => {
    const b = e.target.closest('button[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    if (a === 'launch') goTo(4);
    if (a === 'replay') {
      if (state.chapter !== 4) goTo(4);
      else { sim.reset(); sim.play(); }
    }
    if (a === 'cutaway') toggleCutaway();
  });

  dom.parts.addEventListener('click', e => {
    const b = e.target.closest('.part-btn');
    if (b) selectPart(b.dataset.part);
  });

  dom.playBtn.addEventListener('click', () => {
    if (sim.t >= SIM_TOTAL - 0.05) { sim.reset(); sim.play(); }
    else sim.toggle();
    if (sim.playing) {
      clearTimeout(state.autoplayTimer);
      state.autoplayTimer = null;
    }
  });
  dom.resetSim.addEventListener('click', () => {
    sim.reset();
    sim.play();
  });
  dom.scrub.addEventListener('input', e => {
    sim.seek(parseFloat(e.target.value));
  });
  document.querySelectorAll('.speeds button').forEach(b => {
    b.addEventListener('click', () => {
      sim.speed = Number(b.dataset.speed);
      document.querySelectorAll('.speeds button').forEach(x => x.classList.toggle('on', x === b));
    });
  });

  dom.explodeSlider.addEventListener('input', e => {
    studio.setExplode(parseFloat(e.target.value));
  });
  const cut = () => toggleCutaway();
  dom.cutawayToggle.addEventListener('click', cut);
  dom.cutawayBtn.addEventListener('click', cut);

  dom.jammerBtn.addEventListener('click', () => {
    state.jammer = !state.jammer;
    field.setJammer(state.jammer);
    dom.jammerBtn.classList.toggle('on', state.jammer);
    dom.jammerBtn.textContent = state.jammer ? 'DESATIVAR JAMMER' : 'ATIVAR JAMMER RF';
    dom.jammerStatus.innerHTML = state.jammer
      ? '<i></i> JAMMER ATIVO · FIBRA IMUNE'
      : '<i></i> ENLACE DE FIBRA: IMUNE';
  });

  document.addEventListener('keydown', e => {
    if (!state.started) return;
    if (e.key === 'ArrowRight') { goTo(state.chapter + 1); }
    if (e.key === 'ArrowLeft') { goTo(state.chapter - 1); }
    if (e.key === 'Escape') clearPart();
    if (e.code === 'Space' && state.chapter === 4 && state.started) {
      e.preventDefault();
      sim.toggle();
    }
  });

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
  dom.canvas.addEventListener('pointerdown', () => { /* keep focus */ });
}

function setCutaway(on) {
  state.cutaway = on;
  studio.setCutaway(on);
  dom.cutawayToggle.classList.toggle('on', on);
  dom.cutawayBtn.classList.toggle('on', on);
  dom.cutawayToggle.textContent = on ? 'FECHAR CORTE' : 'VER CORTE';
}

function toggleCutaway() {
  setCutaway(!state.cutaway);
}

function goTo(i) {
  if (i < 0 || i >= chapters.length || state.transitioning) return;
  applyChapter(i);
}

/* ---------------------------------------------------------- rail */

function buildRail() {
  dom.rail.innerHTML = chapters.map((c, i) => `
    <button data-i="${i}" class="${i === 0 ? 'active' : ''}">
      <span class="rnum">${c.num}</span>
      <span class="rname">${c.nav}</span>
    </button>`).join('');
}

/* ---------------------------------------------------------- loop */

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;

  if (state.transitioning) {
    renderer.render(activeScene().scene, activeScene().camera);
    return;
  }

  if (state.scene === 'studio') studio.update(dt);
  else field.update(dt);

  if (state.simActive) sim.update(dt);

  if (state.scene === 'field') {
    seekerAcc += dt;
    if (seekerAcc >= 0.07) {
      const st = state.chapter === 4 ? sim.state() : DEMO_STATE;
      seeker.draw(st, seekerAcc);
      field.screenTex.needsUpdate = true;
      dom.skRange.textContent = `RNG ${st.rangeKm.toFixed(1).replace('.', ',')} KM`;
      dom.skLink.textContent = `FIBRA ${Math.round(st.fiberM).toLocaleString('pt-BR')} M`;
      seekerAcc = 0;
    }
  }

  if (state.chapter === 1) updateHotspots();
  if (state.chapter === 5) updateTargetTags();

  hudAcc += dt;
  if (hudAcc > 0.12) {
    hudAcc = 0;
    if (state.chapter === 4 && state.simActive) updateSimUI(sim.t);
  }

  renderer.render(activeScene().scene, activeScene().camera);
}

function activeScene() {
  return state.scene === 'studio' ? studio : field;
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  studio.resize(w, h);
  field.resize(w, h);
}

boot();
