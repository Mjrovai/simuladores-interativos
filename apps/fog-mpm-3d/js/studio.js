import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { createMissile } from './missile.js';
import { makeSky, makeRadialSprite, smoothstep } from './world.js';

const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class Studio {
  constructor(renderer, envTexture) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0a1016, 13, 36);
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 120);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 8;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.8;
    this.controls.target.set(0, 0, 0);

    this.tween = null;
    this.explodeCurrent = 0;
    this.explodeTarget = 0;
    this.cutaway = false;
    this.xray = false;
    this.time = 0;

    this._buildSky();
    this._buildStage();
    this._buildLights();
    this._buildMissile();
    this._buildDust();

    this.poses = {
      intro: { p: [2.32, 1.02, 3.1], t: [0.02, 0.04, 0.05] },
      visao: { p: [2.5, 1.18, 3.05], t: [0, 0.02, 0] },
      anatomia: { p: [0.55, 1.28, 3.72], t: [0.30, 0, 0.02] },
      legado: { p: [3.15, 1.8, 2.6], t: [0, 0.05, 0] }
    };
    this.camera.position.set(...this.poses.intro.p);
    this.controls.target.set(...this.poses.intro.t);
    this.camera.lookAt(this.controls.target);
  }

  _buildSky() {
    this.sky = makeSky({
      top: '#05070a', bottom: '#0a1016', glow: '#33261a', exponent: 0.85
    });
    this.sky.scale.setScalar(0.05);
    this.scene.add(this.sky);
  }

  _buildStage() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(30, 96),
      new THREE.MeshStandardMaterial({
        color: 0x0a0e12, roughness: 0.5, metalness: 0.55
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.58;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const glowTex = makeRadialSprite('rgba(255,178,92,0.55)', 'rgba(255,178,92,0)');
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 4.2),
      new THREE.MeshBasicMaterial({
        map: glowTex, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.565;
    this.scene.add(glow);

    const shadowTex = makeRadialSprite('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 1.35),
      new THREE.MeshBasicMaterial({
        map: shadowTex, transparent: true, opacity: 0.7,
        depthWrite: false, color: 0x000000
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.06, -0.552, 0.12);
    this.scene.add(shadow);

    const mkRing = (r, color, opacity) => {
      const pts = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({
        color, transparent: true, opacity
      }));
      l.position.y = -0.57;
      this.scene.add(l);
      return l;
    };
    mkRing(1.15, 0x2c343c, 0.75);
    mkRing(1.85, 0x222a31, 0.6);
    mkRing(2.75, 0x1b2228, 0.5);

    const ticks = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const long = i % 6 === 0;
      const r0 = 2.05, r1 = r0 + (long ? 0.14 : 0.06);
      ticks.push(new THREE.Vector3(Math.cos(a) * r0, -0.568, Math.sin(a) * r0));
      ticks.push(new THREE.Vector3(Math.cos(a) * r1, -0.568, Math.sin(a) * r1));
    }
    const tickGeo = new THREE.BufferGeometry().setFromPoints(ticks);
    this.scene.add(new THREE.LineSegments(tickGeo, new THREE.LineBasicMaterial({
      color: 0x3a444d, transparent: true, opacity: 0.55
    })));
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0x93a5c4, 0x1b1712, 0.55);
    this.scene.add(hemi);

    const key = new THREE.SpotLight(0xffd7a8, 110, 16, 0.66, 0.7, 1.6);
    key.position.set(2.6, 3.9, 2.8);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.008;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    this.scene.add(key, key.target);

    const rim = new THREE.PointLight(0x6fc4e0, 12, 16, 1.8);
    rim.position.set(-2.9, 2.1, -2.5);
    this.scene.add(rim);

    const rimWarm = new THREE.PointLight(0xffa45c, 10, 12, 1.9);
    rimWarm.position.set(2.2, 1.1, -2.6);
    this.scene.add(rimWarm);

    const fill = new THREE.PointLight(0xffb27a, 5.5, 10, 2);
    fill.position.set(0.2, 0.4, 2.6);
    this.scene.add(fill);

    const back = new THREE.DirectionalLight(0x8fb6ff, 0.55);
    back.position.set(-1.5, 1.2, -3);
    this.scene.add(back);
  }

  _buildMissile() {
    this.missile = createMissile({ detailed: true });
    this.missile.group.rotation.set(0.04, 1.45, 0.02);
    this.missile.group.position.y = 0.02;
    this.scene.add(this.missile.group);

    this.setExplode(0);
  }

  _buildDust() {
    const n = 120;
    const pos = new Float32Array(n * 3);
    this.dustSeed = new Float32Array(n * 3);
    const rnd = Math.random;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 0.6 + rnd() * 3.4;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = -0.4 + rnd() * 3.2;
      pos[i * 3 + 2] = Math.sin(a) * r;
      this.dustSeed[i * 3] = 0.02 + rnd() * 0.05;
      this.dustSeed[i * 3 + 1] = rnd() * 6.28;
      this.dustSeed[i * 3 + 2] = 0.01 + rnd() * 0.03;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tex = makeRadialSprite('rgba(255,236,205,0.9)', 'rgba(255,236,205,0)');
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      map: tex, size: 0.014, transparent: true, opacity: 0.32,
      depthWrite: false, blending: THREE.AdditiveBlending,
      color: 0xd9c4a4, sizeAttenuation: true
    }));
    this.scene.add(this.dust);
  }

  setPose(name, instant = false, duration = 1.35) {
    const p = this.poses[name];
    if (!p) return;
    const k = this._frameScale();
    const pos = p.t.map((tv, i) => tv + (p.p[i] - tv) * k);
    this.flyTo(pos, p.t, instant ? 0 : duration);
  }

  _frameScale() {
    const w = window.innerWidth;
    return w > 1100 ? Math.max(0.8, Math.min(1, 1440 / w)) : 1;
  }

  flyTo(p, t, duration = 1.3) {
    if (duration <= 0) {
      this.camera.position.set(...p);
      this.controls.target.set(...t);
      this.controls.update();
      this.tween = null;
      return;
    }
    this.tween = {
      t: 0, dur: duration,
      p0: this.camera.position.clone(),
      p1: new THREE.Vector3(...p),
      t0: this.controls.target.clone(),
      t1: new THREE.Vector3(...t)
    };
    this.controls.enabled = false;
  }

  focusPart(id, duration = 1.0) {
    const anchor = this.missile.anchors[id];
    if (!anchor) return null;
    const wp = new THREE.Vector3();
    anchor.getWorldPosition(wp);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const p = wp.clone().add(dir.multiplyScalar(2.15));
    this.flyTo([p.x, p.y, p.z], [wp.x, wp.y, wp.z], duration);
    return wp;
  }

  setExplode(v) {
    this.explodeTarget = THREE.MathUtils.clamp(v, 0, 1);
  }

  setCutaway(on) {
    this.cutaway = on;
    if (!on && this.missile.sections) {
      this.missile.sections.forEach(s => {
        s.plane.normal.set(1, 0, 0);
        s.plane.constant = 1000;
      });
    }
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    // hover
    this.missile.group.position.y = 0.02 + Math.sin(t * 0.7) * 0.012;
    this.missile.group.rotation.z = 0.02 + Math.sin(t * 0.45) * 0.006;

    if (Math.abs(this.explodeCurrent - this.explodeTarget) > 0.0005) {
      this.explodeCurrent += (this.explodeTarget - this.explodeCurrent) * Math.min(1, dt * 5.5);
      this.missile.setExplode(this.explodeCurrent);
    }

    const wantClip = this.cutaway && this.explodeCurrent < 0.1;
    const wantXray = this.cutaway && this.explodeCurrent >= 0.1;
    if (wantXray !== this.xray) {
      this.xray = wantXray;
      this.missile.setXray(wantXray);
    }
    if (wantClip) {
      const camPos = this.camera.position;
      const axis = new THREE.Vector3();
      const pos = new THREE.Vector3();
      const dir = new THREE.Vector3();
      const perp = new THREE.Vector3();
      this.missile.sections.forEach(sec => {
        sec.group.getWorldPosition(pos);
        axis.set(0, 0, 1).applyQuaternion(sec.group.getWorldQuaternion(this._q || (this._q = new THREE.Quaternion())));
        dir.copy(camPos).sub(pos);
        perp.copy(dir).addScaledVector(axis, -dir.dot(axis));
        if (perp.lengthSq() < 1e-6) return;
        perp.normalize();
        sec.plane.normal.copy(perp).negate();
        sec.plane.constant = perp.dot(pos);
      });
    } else if (this.cutaway) {
      this.missile.sections.forEach(s => { s.plane.constant = 1000; });
    }

    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const k = easeInOut(Math.min(1, tw.t / tw.dur));
      this.camera.position.lerpVectors(tw.p0, tw.p1, k);
      this.controls.target.lerpVectors(tw.t0, tw.t1, k);
      if (tw.t >= tw.dur) {
        this.tween = null;
        this.controls.enabled = true;
      }
    }
    this.controls.update();

    // dust drift
    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + this.dustSeed[i * 3] * dt;
      if (y > 2.8) y = -0.45;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.3 + this.dustSeed[i * 3 + 1]) * dt * 0.012);
    }
    pos.needsUpdate = true;

    // subtle sky parallax
    this.sky.position.copy(this.camera.position);
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.75 ? 54 : aspect < 1.1 ? 44 : 38;
    this.camera.updateProjectionMatrix();
  }
}
