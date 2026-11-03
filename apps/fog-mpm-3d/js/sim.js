import * as THREE from 'three';
import { makeRadialSprite, smoothstep } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Camera offsets relative to the missile, evaluated against the real path so
// every shot frames the missile. [x, y, z] in world units.
const CAM_SPECS = [
  { t: 0.0, off: [10.5, 3.5, 14.5], aim: [-2.5, -1.0, 0] },
  { t: 1.8, off: [8.8, 4.2, 19.0], aim: [-2.0, -1.6, 0] },
  { t: 4.0, off: [-2.4, 2.4, 11.5], aim: [1.4, 0.2, 0] },
  { t: 7.0, off: [-5.0, 3.4, 12.0], aim: [2.0, 0, 0] },
  { t: 11.0, off: [-4.5, 2.6, 9.0], aim: [2.0, 0, 0] },
  { t: 16.0, off: [-4.2, 2.4, 8.5], aim: [1.8, 0, 0] },
  { t: 22.0, off: [-3.8, 2.6, 7.5], aim: [1.5, 0, 0] },
  { t: 27.0, off: [-3.2, 2.6, 6.5], aim: [1.2, 0, 0] },
  { t: 31.0, off: [-2.5, 2.4, 5.5], aim: [0.8, 0, 0] },
  { t: 34.0, off: [4.0, 3.0, 7.0], aim: [-0.5, -0.5, 0] },
  { t: 36.5, off: [16.0, 9.0, 20.0], aim: [0, 0.8, 0] },
  { t: 38.0, off: [20.0, 11.0, 25.0], aim: [0, 0.8, 0] }
];

const PHASES = [
  { id: 'prep', label: 'PREPARAÇÃO', short: 'PREP', t0: 0, t1: 0.7 },
  { id: 'eject', label: 'EJEÇÃO A AR', short: 'EJEÇÃO', t0: 0.7, t1: 1.5 },
  { id: 'boost', label: 'SUBIDA BALÍSTICA', short: 'SUBIDA', t0: 1.5, t1: 8.0 },
  { id: 'cruise', label: 'CRUZEIRO · YAW MANUAL', short: 'CRUZEIRO', t0: 8.0, t1: 26.0 },
  { id: 'acquire', label: 'ALVO DETECTADO', short: 'ALVO', t0: 26.0, t1: 31.0 },
  { id: 'terminal', label: 'GUIAMENTO MANUAL', short: 'MANUAL', t0: 31.0, t1: 35.0 },
  { id: 'impact', label: 'IMPACTO', short: 'IMPACTO', t0: 35.0, t1: 38.0 }
];

export const SIM_TOTAL = 38;

class Particles {
  constructor(scene, max, { additive = false, texture }) {
    this.max = max;
    this.cursor = 0;
    this.parts = [];
    for (let i = 0; i < max; i++) {
      this.parts.push({
        active: false, age: 0, life: 1,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        size: 1, grow: 0, drag: 0.98, gravity: 0,
        color: new THREE.Color(), alpha: 1, fadeIn: 0.1
      });
    }
    const pos = new Float32Array(max * 3);
    const size = new Float32Array(max);
    const alpha = new Float32Array(max);
    const color = new Float32Array(max * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    this.geo.setDrawRange(0, max);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uMap: { value: texture } },
      vertexShader: /* glsl */`
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = aAlpha;
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(aSize * (420.0 / max(0.2, -mv.z)), 240.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float a = smoothstep(0.5, 0.12, d) * vAlpha;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vColor, a);
        }`
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(opts) {
    const p = this.parts[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.active = true;
    p.age = 0;
    p.life = opts.life ?? 2;
    p.pos.copy(opts.pos);
    p.vel.copy(opts.vel ?? new THREE.Vector3());
    p.size = opts.size ?? 1;
    p.grow = opts.grow ?? 0.5;
    p.drag = opts.drag ?? 0.98;
    p.gravity = opts.gravity ?? 0;
    p.color.set(opts.color ?? 0xb9b2a5);
    p.alpha = opts.alpha ?? 1;
    p.fadeIn = opts.fadeIn ?? 0.12;
  }

  update(dt) {
    const pos = this.geo.attributes.position.array;
    const size = this.geo.attributes.aSize.array;
    const alpha = this.geo.attributes.aAlpha.array;
    const color = this.geo.attributes.aColor.array;
    for (let i = 0; i < this.max; i++) {
      const p = this.parts[i];
      if (!p.active) {
        alpha[i] = 0;
        size[i] = 0;
        continue;
      }
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        alpha[i] = 0;
        size[i] = 0;
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.pos.addScaledVector(p.vel, dt);
      p.size += p.grow * dt;
      const k = p.age / p.life;
      const fade = Math.min(1, p.age / p.fadeIn) * (1 - k) * (1 - k * 0.3);
      pos[i * 3] = p.pos.x;
      pos[i * 3 + 1] = p.pos.y;
      pos[i * 3 + 2] = p.pos.z;
      size[i] = Math.max(0, p.size);
      alpha[i] = fade * p.alpha;
      color[i * 3] = p.color.r;
      color[i * 3 + 1] = p.color.g;
      color[i * 3 + 2] = p.color.b;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
  }

  clear() {
    this.parts.forEach(p => { p.active = false; });
    const alpha = this.geo.attributes.aAlpha.array;
    const size = this.geo.attributes.aSize.array;
    alpha.fill(0); size.fill(0);
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

export class Engagement {
  constructor(field) {
    this.field = field;
    this.t = 0;
    this.playing = false;
    this.speed = 1;
    this.impacted = false;
    this.finished = false;
    this.onTick = null;
    this.camPos = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.flashTime = 0;

    this.camKeys = CAM_SPECS.map(spec => {
      const p = field.path.getPointAt(this.uFromTime(spec.t));
      return {
        t: spec.t,
        p: p.clone().add(new THREE.Vector3(...spec.off)),
        q: p.clone().add(new THREE.Vector3(...spec.aim))
      };
    });

    const tex = makeRadialSprite('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.smoke = new Particles(field.scene, 460, { additive: false, texture: tex });
    this.sparks = new Particles(field.scene, 140, { additive: true, texture: tex });

    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeRadialSprite('rgba(255,236,190,1)', 'rgba(255,120,40,0)'),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false
    }));
    this.flash.position.copy(field.impactPoint);
    this.flash.scale.setScalar(1);
    field.scene.add(this.flash);

    this.impactLight = new THREE.PointLight(0xff9a4a, 0, 60, 2);
    this.impactLight.position.copy(field.impactPoint).add(new THREE.Vector3(0, 3, 0));
    field.scene.add(this.impactLight);
  }

  get phase() {
    for (const p of PHASES) if (this.t >= p.t0 && this.t < p.t1) return p;
    return PHASES[PHASES.length - 1];
  }

  uFromTime(t) {
    if (t <= 0.7) return 0;
    if (t <= 1.5) return 0.032 * smoothstep(0.7, 1.5, t);
    const k = THREE.MathUtils.clamp((t - 1.5) / 33.5, 0, 1);
    return 0.032 + 0.968 * Math.pow(k, 0.9);
  }

  reset({ silent = false } = {}) {
    this.t = 0;
    this.playing = false;
    this.finished = false;
    this.impacted = false;
    this.flashTime = 0;
    this.smoke.clear();
    this.sparks.clear();
    this.flash.material.opacity = 0;
    this.impactLight.intensity = 0;
    this.field.muzzleGlow.intensity = 0;
    this.field.controls.enabled = false;
    this.field.directorActive = true;
    this.field.setMissileAt(0);
    this.field.setMissileVisible(false);
    this.field.missile.setFins(0);
    this.field.missile.setThrust(false);
    this.applyCamera(0, 0);
    if (!silent && this.onTick) this.onTick(this.t, this);
  }

  play() {
    if (this.t >= SIM_TOTAL - 0.001) this.reset();
    this.playing = true;
    this.field.controls.enabled = false;
    this.field.directorActive = true;
  }

  pause() {
    this.playing = false;
  }

  toggle() {
    if (this.playing) this.pause(); else this.play();
  }

  seek(t) {
    this.t = THREE.MathUtils.clamp(t, 0, SIM_TOTAL);
    this.playing = false;
    this.impacted = this.t >= 35;
    this.finished = this.t >= SIM_TOTAL - 0.001;
    this.smoke.clear();
    this.sparks.clear();
    this.flash.material.opacity = 0;
    this.impactLight.intensity = 0;
    const u = this.uFromTime(this.t);
    this.field.setMissileAt(u);
    this.field.missile.setFins(THREE.MathUtils.clamp((this.t - 1.5) / 0.7, 0, 1));
    this.field.missile.setThrust(this.t > 1.5 && this.t < 9.0);
    this.field.missile.group.visible = this.t > 0.95 && this.t < 35;
    this.field.missileVisible = this.field.missile.group.visible;
    if (this.t >= 35) {
      const p = this.field.impactPoint.clone();
      this.flash.position.copy(p);
      this.flashTime = 0.35;
      this.flash.scale.setScalar(8);
      this.flash.material.opacity = 0.55;
      this.impactLight.intensity = 90;
      this._burstSmoke(p);
      this.field.missile.group.visible = false;
    }
    this.applyCamera(this.t, 0);
    if (this.onTick) this.onTick(this.t, this);
  }

  _stepCamera(t) {
    const keys = this.camKeys;
    if (t <= keys[0].t) return { p: keys[0].p, q: keys[0].q };
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t >= a.t && t <= b.t) {
        const k = smoothstep(0, 1, (t - a.t) / (b.t - a.t));
        return { p: a.p.clone().lerp(b.p, k), q: a.q.clone().lerp(b.q, k) };
      }
    }
    const last = keys[keys.length - 1];
    return { p: last.p, q: last.q };
  }

  applyCamera(t, dt) {
    const k = this._stepCamera(t);
    this.camPos.copy(k.p);
    this.camTarget.copy(k.q);
    const aspect = this.field.camera.aspect;
    if (aspect < 0.9) {
      const boost = 1 + (0.9 - aspect) * 1.35;
      this.camPos.sub(this.camTarget).multiplyScalar(boost).add(this.camTarget);
    }
    if (this.field.directorActive) {
      this.field.camera.position.copy(this.camPos);
      this.field.camera.lookAt(this.camTarget);
    }
  }

  _burstSmoke(p) {
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 14;
      this.smoke.spawn({
        pos: p.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2
        )),
        vel: new THREE.Vector3(Math.cos(a) * s, 3 + Math.random() * 7, Math.sin(a) * s),
        size: 1.8 + Math.random() * 2.2,
        grow: 3.5, life: 4 + Math.random() * 4, drag: 0.975,
        gravity: 0.5, color: i % 5 === 0 ? 0x6b5a48 : 0xb0a48e,
        alpha: 0.6
      });
    }
  }

  _impact() {
    this.impacted = true;
    this.flashTime = 0;
    const p = this.field.impactPoint.clone();
    this.flash.position.copy(p);
    this._burstSmoke(p);
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 6 + Math.random() * 18;
      this.sparks.spawn({
        pos: p.clone(),
        vel: new THREE.Vector3(Math.cos(a) * s, Math.random() * 14, Math.sin(a) * s),
        size: 0.4 + Math.random() * 0.5, grow: 0.2,
        life: 0.6 + Math.random() * 0.8, drag: 0.985, gravity: -9,
        color: Math.random() < 0.5 ? 0xffb050 : 0xff6a2a, alpha: 1
      });
    }
    this.field.missile.group.visible = false;
    this.field.missileVisible = false;
    this.flash.scale.setScalar(4);
    this.flash.material.opacity = 0;
  }

  update(dt) {
    if (this.playing) {
      this.t = Math.min(SIM_TOTAL, this.t + dt * this.speed);
      if (this.t >= SIM_TOTAL) { this.finished = true; this.playing = false; }
    }
    const t = this.t;
    const u = this.uFromTime(t);
    this.field.setMissileAt(u);
    this.field.missile.setFins(Math.min(1, Math.max(0, (t - 1.5) / 0.7)));
    this.field.missile.setThrust(t > 1.5 && t < 9.0);

    if (t >= 35 && !this.impacted) this._impact();
    if (t < 35 && this.impacted) {
      this.impacted = false;
      this.flashTime = 0;
      this.flash.material.opacity = 0;
      this.impactLight.intensity = 0;
    }
    if (this.impacted) {
      this.field.missile.group.visible = false;
      this.field.missileVisible = false;
    }

    // two lateral plumes, canted aft so they clear the tail fiber spool
    if (this.playing && t > 1.5 && t < 8.5) {
      const n = t < 3 ? 4 : 2;
      for (const side of [-1, 1]) {
        const nozzle = new THREE.Vector3(side * 0.19, 0, -0.44)
          .applyMatrix4(this.field.missile.group.matrixWorld);
        for (let i = 0; i < n; i++) {
          this.smoke.spawn({
            pos: nozzle.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * 0.2,
              (Math.random() - 0.5) * 0.2,
              (Math.random() - 0.5) * 0.2
            )),
            vel: new THREE.Vector3(
              side * (2.2 + Math.random() * 1.6),
              (Math.random() - 0.5) * 1.2,
              -1.6 - Math.random() * 1.8
            ),
            size: 0.55 + Math.random() * 0.55,
            grow: 0.9 + Math.random() * 0.8,
            life: 2.6 + Math.random() * 2.2,
            drag: 0.985,
            gravity: 0.35,
            color: 0xbeb5a4,
            alpha: 0.34
          });
          if (Math.random() < 0.3) {
            this.sparks.spawn({
              pos: nozzle.clone(),
              vel: new THREE.Vector3(
                side * (3 + Math.random() * 5),
                (Math.random() - 0.5) * 4,
                -3 - Math.random() * 4
              ),
              size: 0.2, grow: 0.1, life: 0.3, drag: 0.96,
              gravity: -2, color: 0xffb060, alpha: 1
            });
          }
        }
      }
    }

    // pneumatic ejection: compressed air, no rocket smoke yet
    if (this.playing && t > 0.72 && t < 1.45) {
      for (let i = 0; i < 2; i++) {
        this.smoke.spawn({
          pos: this.field.launchPos.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.8,
            (Math.random() - 0.5) * 0.8
          )),
          vel: this.field.launchDir.clone().multiplyScalar(-1.5 - Math.random() * 2)
            .add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.8, (Math.random() - 0.5) * 1.5)),
          size: 0.5 + Math.random() * 0.5,
          grow: 1.4,
          life: 1.4 + Math.random() * 1.0,
          drag: 0.97,
          gravity: 0.1,
          color: 0xd8d6cc,
          alpha: 0.22
        });
      }
    }

    this.field.muzzleGlow.intensity = (this.playing && t > 1.4 && t < 3.2)
      ? 40 * (1 - (t - 1.4) / 1.8) : 0;

    this.smoke.update(dt);
    this.sparks.update(dt);

    if (this.impacted) {
      this.flashTime += dt;
      const ft = this.flashTime;
      this.flash.scale.setScalar(4 + ft * 45);
      this.flash.material.opacity = Math.max(0, 0.95 * Math.exp(-ft * 2.2));
      this.impactLight.intensity = Math.max(0, 260 * Math.exp(-ft * 4.2));
    }

    if (!this.impacted) this.applyCamera(t, dt);
    else this.applyCamera(Math.max(t, 36), dt);

    if (this.onTick) this.onTick(t, this);
  }

  state() {
    const t = this.t;
    const u = this.uFromTime(t);
    const phase = this.phase;
    let alt = 0;
    if (t < 1.5) alt = Math.max(0, (t - 0.7) / 0.8) * 6;
    else if (t < 8) alt = 6 + ((t - 1.5) / 6.5) * 194;
    else if (t < 32) alt = 200 + Math.sin(t * 0.6) * 3;
    else if (t < 35) {
      const k = (t - 32) / 3;
      alt = 200 * Math.pow(1 - k, 1.5);
    }
    const rangeKm = Math.max(0.12, 12 * (1 - u));
    const speed = t > 32 ? 150 : 180;
    let aim = 0;
    if (t > 9 && t < 27.5) aim = Math.sin((t - 9) * 0.22) * 0.85;
    if (t >= 27.5) aim = 0;
    const pitch = t > 31 ? (t - 31) / 4 : -0.08;
    return {
      t, u, phase: phase.label, phaseId: phase.id,
      altM: alt, rangeKm, speed, fiberM: 12000 * u,
      lock: t >= 27.5, link: true, aim,
      pitch, targetVisible: t > 6,
      controlYaw: t > 8,
      manual: t > 31,
      impacted: this.impacted
    };
  }

  static get phases() { return PHASES; }
}
