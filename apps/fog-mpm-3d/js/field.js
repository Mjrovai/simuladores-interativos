import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { createMissile, createCanister, makeHazardTexture } from './missile.js';
import {
  makeSky, makeGroundTexture, makeCamoTexture, makeRadialSprite,
  makeConcreteTexture, fbm, smoothstep, mulberry32
} from './world.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  const flat = smoothstep(14, 60, r);
  const rolling = (fbm(x * 0.035 + 2.3, z * 0.035 - 1.7) - 0.5) * 2.4;
  const hills = Math.pow(smoothstep(150, 320, r), 1.4) * (16 + 42 * fbm(x * 0.006, z * 0.006));
  return rolling * flat * 0.7 + hills;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rTop, rBottom, h, mat, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class Field {
  constructor(renderer, envTexture, seekerCanvas) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc39468, 110, 470);
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 0.28;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
    this.camera.position.set(14, 6.5, 15.5);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 240;
    this.controls.maxPolarAngle = Math.PI * 0.492;
    this.controls.target.set(2, 2.2, 1);
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.9;

    this.tween = null;
    this.time = 0;
    this.jammerOn = false;
    this.missileVisible = false;
    this.directorActive = false;

    this.seekerCanvas = seekerCanvas;
    this.screenTex = new THREE.CanvasTexture(seekerCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;

    this._buildEnvironment();
    this._buildTerrain();
    this._buildLights();
    this._buildTruck();
    this._buildLauncher();
    this._buildMissile();
    this._buildTargets();
    this._buildConsole();
    this._buildJammer();
    this._buildProps();
    this._buildFiber();

    const gp = this.path.getPointAt(0.33);
    this.poses = {
      launcher: { p: [12.5, 7.4, 16.0], t: [1.2, 3.0, 1.0] },
      guidance: {
        p: [gp.x - 6.8, gp.y + 1.2, gp.z + 8.4],
        t: [gp.x + 1.2, gp.y - 0.1, gp.z - 0.5]
      },
      targets: { p: [84, 18, 26], t: [112, 7, -4] },
      sim: { p: [12.5, 7.4, 16.0], t: [1.2, 3.0, 1.0] }
    };
    this.camera.lookAt(this.controls.target);
  }

  _buildEnvironment() {
    this.sky = makeSky({
      top: '#101d31', bottom: '#d99a63', glow: '#ffb168', exponent: 0.55
    });
    this.scene.add(this.sky);

    const sunTex = makeRadialSprite('rgba(255,236,196,1)', 'rgba(255,196,120,0)');
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false
    }));
    sun.position.set(-250, 55, -330);
    sun.scale.set(150, 150, 1);
    this.scene.add(sun);
  }

  _buildTerrain() {
    const size = 700, seg = 190;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
    }
    geo.computeVertexNormals();

    const tex = makeGroundTexture();
    tex.repeat.set(95, 95);
    const mat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.96, metalness: 0.02, color: 0xa39a84
    });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // launch pad
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(11, 64),
      new THREE.MeshStandardMaterial({ color: 0x6f6149, roughness: 1, metalness: 0 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.02;
    pad.receiveShadow = true;
    this.scene.add(pad);

    // dark scorch at the muzzle side
    const scorch = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 32),
      new THREE.MeshBasicMaterial({
        map: makeRadialSprite('rgba(30,24,18,0.75)', 'rgba(30,24,18,0)'),
        transparent: true, depthWrite: false
      })
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(3.4, 0.04, 1.4);
    this.scene.add(scorch);
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0x9db4d4, 0x6a5538, 1.05);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffc08a, 2.6);
    sun.position.set(-90, 110, -130);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 260;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.sun = sun;

    const fill = new THREE.DirectionalLight(0x86a4cf, 0.55);
    fill.position.set(60, 40, 80);
    this.scene.add(fill);
  }

  _buildTruck() {
    const g = new THREE.Group();
    this.truck = g;
    this.scene.add(g);

    const camoTex = makeCamoTexture();
    camoTex.repeat.set(2.5, 2.5);
    const body = new THREE.MeshStandardMaterial({
      map: camoTex, color: 0xd8d2b8, roughness: 0.82, metalness: 0.18
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x33362c, roughness: 0.7, metalness: 0.35 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.95, metalness: 0.05 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x6f7167, roughness: 0.5, metalness: 0.75 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x101c22, roughness: 0.08, metalness: 0.6, clearcoat: 1
    });
    this.truckMats = { body, dark, rubber, steel, glass };

    // chassis + bed
    g.add(box(2.1, 0.3, 7.7, dark, 0, 1.02, 0));
    for (const z of [-3, -1.5, 0, 1.5, 3]) g.add(box(2.3, 0.14, 0.2, steel, 0, 1.02, z));
    g.add(box(2.45, 0.12, 5.1, body, 0, 1.26, 1.35));
    g.add(box(0.07, 0.5, 5.1, dark, 1.19, 1.5, 1.35));
    g.add(box(0.07, 0.5, 5.1, dark, -1.19, 1.5, 1.35));
    g.add(box(2.45, 0.5, 0.07, dark, 0, 1.5, 3.9));

    // wheels
    for (const z of [-2.75, 0.1, 2.95]) {
      for (const x of [-1.2, 1.2]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.36, 26), rubber);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(x, 0.62, z);
        tire.castShadow = true; tire.receiveShadow = true;
        g.add(tire);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.38, 16), steel);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(x, 0.62, z);
        g.add(hub);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 10), dark);
        cap.rotation.z = Math.PI / 2;
        cap.position.set(x, 0.62, z);
        g.add(cap);
      }
    }
    // fenders
    for (const z of [-2.75, 0.1, 2.95]) {
      g.add(box(0.1, 0.1, 1.45, dark, 1.28, 1.24, z));
      g.add(box(0.1, 0.1, 1.45, dark, -1.28, 1.24, z));
    }

    // cab
    const cab = box(2.3, 1.75, 1.85, body, 0, 2.16, -3.0);
    g.add(cab);
    g.add(box(2.34, 0.12, 1.95, dark, 0, 3.06, -3.0));
    // windshield
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.72), glass);
    ws.position.set(0, 2.55, -3.935);
    ws.rotation.x = -0.1;
    g.add(ws);
    // side windows
    for (const x of [-1.16, 1.16]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.58), glass);
      sw.position.set(x, 2.52, -3.25);
      sw.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(sw);
    }
    // grille, bumper, lights
    g.add(box(1.7, 0.42, 0.08, dark, 0, 1.95, -3.95));
    for (let i = 0; i < 5; i++) g.add(box(1.6, 0.035, 0.05, steel, 0, 1.79 + i * 0.08, -3.99));
    g.add(box(2.45, 0.24, 0.2, steel, 0, 1.28, -4.02));
    for (const x of [-0.82, 0.82]) {
      const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16),
        new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0x8a6a32, emissiveIntensity: 1.2 })
      );
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(x, 1.62, -3.99);
      g.add(lamp);
    }
    // mirrors
    for (const x of [-1.3, 1.3]) {
      g.add(box(0.05, 0.05, 0.5, steel, x, 2.75, -3.6));
      g.add(box(0.16, 0.3, 0.05, dark, x * 1.13, 2.55, -3.85));
    }
    // roof hatch + antenna
    g.add(box(0.7, 0.07, 0.7, dark, 0, 3.12, -2.9));
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 1.6, 6), steel);
    ant.position.set(-0.9, 3.35, -2.4);
    g.add(ant);

    // fuel tank, toolbox, spare
    const tank = cyl(0.32, 0.32, 1.3, steel, 18);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(-1.25, 1.12, -1.4);
    g.add(tank);
    g.add(box(0.7, 0.45, 0.9, dark, 1.1, 1.55, -1.3));
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 22), rubber);
    spare.rotation.z = Math.PI / 2;
    spare.position.set(0, 1.55, -4.15);
    g.add(spare);

    // crates on the bed
    g.add(box(0.9, 0.55, 0.7, body, -0.75, 1.65, 3.3));
    g.add(box(0.7, 0.4, 0.6, body, 0.85, 1.55, 3.4));
  }

  _buildLauncher() {
    const { dark, steel } = this.truckMats;
    const g = new THREE.Group();
    g.position.set(0, 2.85, 1.55);
    g.rotation.y = -0.12; // azimute variável, fixado no disparo
    this.launcher = g;
    this.scene.add(g);

    // pedestal over the truck bed
    g.add(box(1.65, 1.25, 1.65, dark, 0, -0.98, 0));
    const base = cyl(0.8, 0.86, 0.18, steel, 28);
    base.position.y = -0.28;
    g.add(base);
    const turntable = cyl(0.66, 0.66, 0.18, dark, 28);
    turntable.position.y = -0.12;
    g.add(turntable);

    // cradle travels at a fixed 60° elevation
    const cradle = new THREE.Group();
    cradle.rotation.z = THREE.MathUtils.degToRad(60);
    g.add(cradle);
    this.cradle = cradle;

    const frameMat = new THREE.MeshStandardMaterial({
      map: (() => { const t = makeCamoTexture(); t.repeat.set(1.4, 1.4); return t; })(),
      color: 0xc9c4a8, roughness: 0.8, metalness: 0.2
    });
    const rear = box(0.55, 1.15, 1.3, frameMat, -1.15, 0, 0);
    cradle.add(rear);
    cradle.add(box(1.1, 0.12, 1.3, frameMat, -0.6, -0.52, 0));
    cradle.add(box(1.1, 0.12, 1.3, frameMat, 0.4, -0.52, 0));
    for (const z of [-0.66, 0.66]) {
      cradle.add(box(2.7, 0.08, 0.12, frameMat, 0.12, -0.5, z));
      cradle.add(box(2.7, 0.08, 0.12, frameMat, 0.12, 0.5, z));
    }
    // elevation actuator (base -> cradle)
    const act = cyl(0.1, 0.1, 1.5, steel, 14);
    act.rotation.z = Math.PI / 2 - 0.35;
    act.position.set(-0.75, -0.8, 0);
    cradle.add(act);

    // canisters
    for (const z of [-0.34, 0.34]) {
      const can = createCanister({ length: 2.55, withLabels: false });
      can.rotation.y = Math.PI / 2;
      can.position.set(0.12, 0, z);
      cradle.add(can);
    }

    // stencil plate on the cradle side
    const tex = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 128;
      const x = c.getContext('2d');
      x.clearRect(0, 0, 512, 128);
      x.fillStyle = '#ddd6b7';
      x.font = '700 62px "Barlow Condensed", sans-serif';
      x.textAlign = 'center';
      x.fillText('FOG-MPM', 256, 62);
      x.font = '500 22px "IBM Plex Mono", monospace';
      x.globalAlpha = 0.7;
      x.fillText('MÍSSIL MULTIPROPÓSITO', 256, 98);
      return c;
    })());
    tex.colorSpace = THREE.SRGBColorSpace;
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.24),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8 })
    );
    plate.position.set(-0.1, 0.16, 0.69);
    cradle.add(plate);

    // hazard strip
    const hz = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.1),
      new THREE.MeshStandardMaterial({ map: makeHazardTexture(), transparent: true, roughness: 0.8 })
    );
    hz.position.set(1.2, 0.56, 0.69);
    cradle.add(hz);

    // pneumatic bottle and hose for the air-piston ejection
    const tank = cyl(0.2, 0.2, 1.1, steel, 16);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(-1.0, -1.3, 0.9);
    g.add(tank);
    const hosePts = [
      new THREE.Vector3(-1.0, -1.25, 1.4),
      new THREE.Vector3(-1.05, -1.2, 0.6),
      new THREE.Vector3(-0.8, -1.05, -0.1),
      new THREE.Vector3(-0.58, -1.0, -0.34)
    ];
    const hose = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 24, 0.022, 6, false),
      new THREE.MeshStandardMaterial({ color: 0x22251f, roughness: 0.9 })
    );
    g.add(hose);

    // anchors inside the cradle
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(1.45, 0, -0.34);
    cradle.add(this.muzzle);
    this.fiberAnchor = new THREE.Object3D();
    this.fiberAnchor.position.set(-1.25, 0, -0.34);
    cradle.add(this.fiberAnchor);

    g.updateMatrixWorld(true);
    this.launchPos = new THREE.Vector3();
    this.muzzle.getWorldPosition(this.launchPos);
    this.launchDir = new THREE.Vector3(1, 0, 0).applyQuaternion(this.muzzle.getWorldQuaternion(new THREE.Quaternion())).normalize();
    this.fiberPos = new THREE.Vector3();
    this.fiberAnchor.getWorldPosition(this.fiberPos);

    this.muzzleGlow = new THREE.PointLight(0xffa050, 0, 14, 2);
    this.muzzleGlow.position.copy(this.launchPos);
    this.scene.add(this.muzzleGlow);
  }

  _buildMissile() {
    this.missile = createMissile({ detailed: true });
    this.missile.group.scale.setScalar(1.5);
    this.missile.group.visible = false;
    this.missile.setFins(0);
    this.scene.add(this.missile.group);
    this.missileTail = new THREE.Vector3();

    // flight path: pneumatic ejection, ballistic climb, cruise, dive
    const s = this.launchPos.clone();
    const d = this.launchDir.clone();
    const p = [
      s.clone().addScaledVector(d, -1.6),
      s.clone().addScaledVector(d, 0.8),
      s.clone().addScaledVector(d, 3.2).add(new THREE.Vector3(0, 0.6, 0)),
      s.clone().add(new THREE.Vector3(5.2, 8.2, 0.4)),
      s.clone().add(new THREE.Vector3(14.2, 18.2, 1.2)),
      new THREE.Vector3(34, 25, 1.0),
      new THREE.Vector3(62, 25, -2.5),
      new THREE.Vector3(92, 23, -8.5),
      new THREE.Vector3(110, 17, -12.5),
      new THREE.Vector3(116.5, 8, -13.8),
      new THREE.Vector3(118.6, 1.1, -14)
    ];
    this.path = new THREE.CatmullRomCurve3(p, false, 'catmullrom', 0.4);
    this.pathLen = this.path.getLength();
    this.impactPoint = p[p.length - 1].clone();
  }

  _buildMissile() {
    this.missile = createMissile({ detailed: true });
    this.missile.group.scale.setScalar(1.5);
    this.missile.group.visible = false;
    this.scene.add(this.missile.group);
    this.missileTail = new THREE.Vector3();

    // flight path
    const s = this.launchPos.clone();
    const p = [
      s.clone().addScaledVector(this.launchDir, -1.35),
      s.clone().addScaledVector(this.launchDir, 0.5),
      s.clone().add(new THREE.Vector3(2.4, 4.2, 0.2)),
      s.clone().add(new THREE.Vector3(6.5, 10, 0.6)),
      s.clone().add(new THREE.Vector3(15, 17, 1.2)),
      new THREE.Vector3(34, 22.5, 0.5),
      new THREE.Vector3(62, 24, -3),
      new THREE.Vector3(92, 23, -9),
      new THREE.Vector3(110, 17, -12.5),
      new THREE.Vector3(116.5, 8, -13.8),
      new THREE.Vector3(118.6, 1.1, -14)
    ];
    this.path = new THREE.CatmullRomCurve3(p, false, 'catmullrom', 0.35);
    this.pathLen = this.path.getLength();
    this.impactPoint = p[p.length - 1].clone();
  }

  _buildTargets() {
    this.targetRoot = new THREE.Group();
    this.scene.add(this.targetRoot);

    // --- main battle tank ---
    const tank = new THREE.Group();
    tank.position.set(118, 0.05, -14);
    tank.rotation.y = 0.18;
    tank.scale.setScalar(1.55);

    const camo = makeCamoTexture();
    camo.repeat.set(2.6, 2.6);
    const green = new THREE.MeshStandardMaterial({ map: camo, color: 0xb9b79c, roughness: 0.85, metalness: 0.15 });
    const darkGreen = new THREE.MeshStandardMaterial({ color: 0x2c3126, roughness: 0.8, metalness: 0.25 });
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1b1c19, roughness: 0.95, metalness: 0.2 });

    for (const z of [-1.35, 1.35]) {
      const tr = box(6.4, 0.95, 0.72, trackMat, 0, 0.5, z);
      tank.add(tr);
      for (let i = 0; i < 7; i++) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.76, 14), darkGreen);
        w.rotation.x = Math.PI / 2;
        w.position.set(-2.7 + i * 0.9, 0.5, z);
        tank.add(w);
      }
    }
    tank.add(box(5.9, 0.8, 2.2, green, 0, 1.05, 0));
    // glacis
    const glacis = box(1.5, 0.16, 2.3, green, -2.75, 1.35, 0);
    glacis.rotation.z = 0.5;
    tank.add(glacis);
    // turret
    const turretShape = new THREE.Shape();
    turretShape.moveTo(-1.5, 0);
    turretShape.lineTo(1.4, 0);
    turretShape.lineTo(1.0, 0.72);
    turretShape.lineTo(-1.15, 0.72);
    turretShape.closePath();
    const turretGeo = new THREE.ExtrudeGeometry(turretShape, { depth: 2.0, bevelEnabled: false });
    turretGeo.translate(0, 0, -1.0);
    const turret = new THREE.Mesh(turretGeo, green);
    turret.position.set(0.2, 1.45, 0);
    turret.castShadow = true;
    tank.add(turret);
    // gun
    const gun = cyl(0.12, 0.14, 4.6, darkGreen, 12);
    gun.rotation.z = Math.PI / 2;
    gun.position.set(-2.9, 1.75, 0);
    tank.add(gun);
    const muzzle = cyl(0.16, 0.16, 0.35, trackMat, 10);
    muzzle.rotation.z = Math.PI / 2;
    muzzle.position.set(-5.15, 1.75, 0);
    tank.add(muzzle);
    // optics, hatch, antenna
    tank.add(box(0.35, 0.22, 0.45, darkGreen, 0.35, 1.95, 0.65));
    tank.add(box(0.55, 0.12, 0.55, darkGreen, -0.3, 1.82, -0.5));
    const antenna = cyl(0.015, 0.01, 1.6, darkGreen, 6);
    antenna.position.set(0.9, 2.5, 0.7);
    tank.add(antenna);
    this.targetRoot.add(tank);
    this.tank = tank;

    // --- bunker ---
    const bunker = new THREE.Group();
    bunker.position.set(110, 0, 2);
    bunker.scale.setScalar(0.92);
    const cTex = makeConcreteTexture();
    cTex.repeat.set(2, 1.4);
    const concrete = new THREE.MeshStandardMaterial({ map: cTex, color: 0xbcb7a8, roughness: 0.95, metalness: 0.05 });
    const concreteDark = new THREE.MeshStandardMaterial({ map: cTex, color: 0x8f8b7d, roughness: 0.98, metalness: 0.04 });
    bunker.add(box(8, 3.6, 6, concrete, 0, 1.8, 0));
    const roof = box(8.8, 0.4, 6.8, concreteDark, 0, 3.72, 0);
    roof.rotation.z = 0.025;
    bunker.add(roof);
    bunker.add(box(3.2, 1.1, 2.2, concreteDark, -2.0, 4.2, -0.6));
    const slit = box(4.2, 0.5, 0.2, new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 1 }), 0, 2.3, 3.02);
    bunker.add(slit);
    const lip = box(4.8, 0.18, 0.5, concreteDark, 0, 2.66, 3.18);
    bunker.add(lip);
    const netMat = new THREE.MeshStandardMaterial({
      color: 0x3d442e, roughness: 1, transparent: true, opacity: 0.72, side: THREE.DoubleSide
    });
    const net = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 7.2, 1, 1), netMat);
    net.rotation.x = -Math.PI / 2 + 0.06;
    net.position.set(0, 4.35, 0);
    bunker.add(net);
    const bunkerMast = cyl(0.04, 0.05, 2.4, new THREE.MeshStandardMaterial({ color: 0x4a4a40, roughness: 0.6, metalness: 0.5 }), 6);
    bunkerMast.position.set(2.9, 4.8, 1.2);
    bunker.add(bunkerMast);
    for (let i = 0; i < 7; i++) {
      const bag = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({
        color: 0x7c7458, roughness: 1
      }));
      bag.scale.set(1.1, 0.6, 0.8);
      bag.position.set(-3.6 + i * 1.2, 0.3, 3.5);
      bunker.add(bag);
    }
    this.targetRoot.add(bunker);
    this.bunker = bunker;

    // --- helicopter ---
    const heli = new THREE.Group();
    heli.position.set(96, 19, 7);
    heli.scale.setScalar(1.3);
    heli.userData.baseY = 19;
    const hGreen = new THREE.MeshStandardMaterial({ color: 0x464c38, roughness: 0.65, metalness: 0.35 });
    const hDark = new THREE.MeshStandardMaterial({ color: 0x20241e, roughness: 0.6, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 16), hGreen);
    body.scale.set(2.6, 1.35, 1.35);
    body.castShadow = true;
    heli.add(body);
    const boom = cyl(0.16, 0.28, 4.4, hGreen, 10);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(3.4, 0.2, 0);
    heli.add(boom);
    const tailFin = box(0.9, 1.1, 0.1, hGreen, 5.6, 0.5, 0);
    heli.add(tailFin);
    const rotor = new THREE.Group();
    rotor.position.set(0, 1.15, 0);
    const mast = cyl(0.1, 0.1, 0.4, hDark, 8);
    rotor.add(mast);
    for (let i = 0; i < 4; i++) {
      const blade = box(4.6, 0.03, 0.22, hDark, 0, 0.28, 0);
      blade.rotation.y = (i * Math.PI) / 2;
      blade.position.x = Math.cos((i * Math.PI) / 2) * 2.2;
      blade.position.z = Math.sin((i * Math.PI) / 2) * 2.2;
      rotor.add(blade);
    }
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 40),
      new THREE.MeshBasicMaterial({ color: 0x9aa08a, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.3;
    rotor.add(disc);
    heli.add(rotor);
    this.heliRotor = rotor;
    // skids
    for (const z of [-0.7, 0.7]) {
      const skid = cyl(0.05, 0.05, 2.6, hDark, 8);
      skid.rotation.z = Math.PI / 2;
      skid.position.set(0, -1.1, z);
      heli.add(skid);
    }
    heli.add(box(0.9, 0.5, 1.3, hDark, 0.4, -0.8, 0));
    this.targetRoot.add(heli);
    this.heli = heli;

    // target rings
    this.rings = new THREE.Group();
    this.rings.visible = false;
    this.scene.add(this.rings);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf0a63c, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
      depthWrite: false
    });
    [[118, -14, 6.2], [110, 2, 6.4]].forEach(([x, z, r]) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.18, r, 72), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.2, z);
      this.rings.add(ring);
      for (let i = 0; i < 4; i++) {
        const tick = box(1.4, 0.02, 0.28, new THREE.MeshBasicMaterial({ color: 0xf0a63c, transparent: true, opacity: 0.65 }), x, 0.2, z);
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        tick.position.set(x + Math.cos(a) * (r + 0.9), 0.2, z + Math.sin(a) * (r + 0.9));
        tick.rotation.y = -a;
        this.rings.add(tick);
      }
    });
  }

  _buildConsole() {
    const g = new THREE.Group();
    g.position.set(2.2, 0, 10.4);
    g.lookAt(13, 2.2, 14);
    this.console = g;
    this.scene.add(g);

    const metal = new THREE.MeshStandardMaterial({ color: 0x4b4f45, roughness: 0.6, metalness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1e1a, roughness: 0.7, metalness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const leg = cyl(0.04, 0.04, 1.35, metal, 8);
      const a = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.45, 0.67, Math.sin(a) * 0.45);
      leg.rotation.z = Math.cos(a) * 0.18;
      leg.rotation.x = -Math.sin(a) * 0.18;
      g.add(leg);
    }
    g.add(box(0.95, 0.16, 0.65, metal, 0, 1.3, 0));
    const consoleBody = box(0.9, 0.5, 0.5, dark, 0, 1.5, 0.05);
    consoleBody.rotation.x = -0.22;
    g.add(consoleBody);
    // screen
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.47),
      new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false })
    );
    screen.position.set(0, 1.56, 0.335);
    screen.rotation.x = -0.22;
    g.add(screen);
    this.screenMesh = screen;
    // bezel
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.55, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x0a0c0b, roughness: 0.5, metalness: 0.4 })
    );
    bezel.position.set(0, 1.56, 0.3);
    bezel.rotation.x = -0.22;
    g.add(bezel);
    // keyboard
    const kb = box(0.72, 0.06, 0.3, dark, 0, 1.38, 0.52);
    kb.rotation.x = -0.12;
    g.add(kb);
    for (let i = 0; i < 18; i++) {
      const key = box(0.06, 0.02, 0.06, metal, -0.28 + (i % 6) * 0.11, 1.42, 0.43 + Math.floor(i / 6) * 0.08);
      key.rotation.x = -0.12;
      g.add(key);
    }
    // joystick
    const stick = cyl(0.025, 0.035, 0.28, metal, 8);
    stick.position.set(0.5, 1.47, 0.35);
    stick.rotation.x = -0.25;
    g.add(stick);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshStandardMaterial({
      color: 0x9c3b2c, roughness: 0.6
    }));
    knob.position.set(0.5, 1.63, 0.39);
    g.add(knob);

    const glow = new THREE.PointLight(0x7fd8c8, 1.6, 3.4, 2);
    glow.position.set(0, 1.6, 0.6);
    g.add(glow);
  }

  _buildJammer() {
    const g = new THREE.Group();
    g.position.set(46, 0, 26);
    g.visible = false;
    this.jammerStation = g;
    this.scene.add(g);

    const metal = new THREE.MeshStandardMaterial({ color: 0x3c4238, roughness: 0.6, metalness: 0.5 });
    const base = box(2.2, 0.7, 1.6, metal, 0, 0.35, 0);
    g.add(base);
    const mast = cyl(0.08, 0.1, 3.2, metal, 8);
    mast.position.set(0, 2.1, 0);
    g.add(mast);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      new THREE.MeshStandardMaterial({ color: 0x8a8f7c, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide })
    );
    dish.rotation.x = -1.1;
    dish.rotation.z = 0.3;
    dish.position.set(0, 3.7, 0.4);
    g.add(dish);
    for (let i = 0; i < 3; i++) {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff4433 })
      );
      lamp.position.set(-0.6 + i * 0.6, 0.8, 0.82);
      g.add(lamp);
    }

    this.jammerRings = new THREE.Group();
    this.jammerRings.visible = false;
    this.scene.add(this.jammerRings);
    this.jammerRingMeshes = [];
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.95, 1, 48),
        new THREE.MeshBasicMaterial({
          color: 0xff4a32, transparent: true, opacity: 0.7,
          side: THREE.DoubleSide, depthWrite: false
        })
      );
      this.jammerRings.add(ring);
      this.jammerRingMeshes.push(ring);
    }
  }

  _buildProps() {
    const rnd = mulberry32(424242);
    const rockGeo = new THREE.DodecahedronGeometry(0.7, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x726753, roughness: 0.95, metalness: 0.04 });
    const bushGeo = new THREE.IcosahedronGeometry(0.8, 0);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x494a30, roughness: 0.95, metalness: 0 });

    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 160);
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, 190);
    const dummy = new THREE.Object3D();
    let ri = 0, bi = 0;
    for (let i = 0; i < 900 && (ri < 160 || bi < 190); i++) {
      const a = rnd() * Math.PI * 2;
      const r = 22 + Math.pow(rnd(), 0.7) * 200;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(z) < 8 && x > 0 && x < 125) continue;
      if (Math.hypot(x - 7.5, z - 9.5) < 6) continue;
      if (Math.hypot(x - 118, z + 14) < 12) continue;
      if (Math.hypot(x - 104, z - 6) < 14) continue;
      const y = terrainHeight(x, z);
      const isRock = rnd() < 0.46;
      if (isRock && ri < 160) {
        dummy.position.set(x, y + 0.1, z);
        dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        const s = 0.4 + rnd() * 1.8;
        dummy.scale.set(s, s * (0.4 + rnd() * 0.5), s);
        dummy.updateMatrix();
        rocks.setMatrixAt(ri++, dummy.matrix);
      } else if (bi < 190) {
        dummy.position.set(x, y + 0.1, z);
        dummy.rotation.set(0, rnd() * 3, 0);
        const s = 0.4 + rnd() * 1.2;
        dummy.scale.set(s, s * (0.5 + rnd() * 0.6), s);
        dummy.updateMatrix();
        bushes.setMatrixAt(bi++, dummy.matrix);
      }
    }
    rocks.count = ri;
    bushes.count = bi;
    rocks.instanceMatrix.needsUpdate = true;
    bushes.instanceMatrix.needsUpdate = true;
    rocks.receiveShadow = true;
    bushes.receiveShadow = true;
    this.scene.add(rocks, bushes);

    // scrub trees give the terrain a sense of scale
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4d3c2a, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x47502f, roughness: 1 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x59613a, roughness: 1 });
    for (let i = 0; i < 15; i++) {
      let x, z, ok = false;
      for (let tries = 0; tries < 30 && !ok; tries++) {
        const a = rnd() * Math.PI * 2;
        const r = 34 + rnd() * 130;
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        ok = !(Math.abs(z) < 14 && x > -6 && x < 128)
          && Math.hypot(x - 7.2, z - 8.4) > 12
          && Math.hypot(x - 118, z + 14) > 16
          && Math.hypot(x - 107, z - 13) > 18;
      }
      if (!ok) continue;
      const y = terrainHeight(x, z);
      const tree = new THREE.Group();
      tree.position.set(x, y, z);
      const h = 2.3 + rnd() * 2.6;
      const trunk = cyl(0.14, 0.3, h, trunkMat, 6);
      trunk.position.y = h / 2;
      tree.add(trunk);
      for (let b = 0; b < 4; b++) {
        const br = cyl(0.04, 0.1, 1.1 + rnd() * 1.2, trunkMat, 5);
        const a = rnd() * Math.PI * 2;
        br.position.set(Math.cos(a) * 0.4, h * (0.5 + rnd() * 0.35), Math.sin(a) * 0.4);
        br.rotation.z = Math.cos(a) * 0.85;
        br.rotation.x = -Math.sin(a) * 0.85;
        tree.add(br);
      }
      for (let k = 0; k < 5; k++) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 + rnd() * 0.75, 0), k % 2 ? leafMat : leafMat2);
        const a = rnd() * Math.PI * 2;
        const rr = rnd() * 1.1;
        leaf.position.set(Math.cos(a) * rr, h + 0.2 + rnd() * 0.9, Math.sin(a) * rr);
        leaf.scale.set(1.25, 0.28 + rnd() * 0.2, 1.1);
        leaf.castShadow = true;
        tree.add(leaf);
      }
      this.scene.add(tree);
    }

    // dust motes
    const n = 300;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (rnd() - 0.5) * 80;
      arr[i * 3 + 1] = rnd() * 14;
      arr[i * 3 + 2] = (rnd() - 0.5) * 80;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.motes = new THREE.Points(dg, new THREE.PointsMaterial({
      map: makeRadialSprite('rgba(255,235,200,0.8)', 'rgba(255,235,200,0)'),
      size: 0.16, transparent: true, opacity: 0.35, depthWrite: false,
      color: 0xe8d0a8, blending: THREE.AdditiveBlending
    }));
    this.scene.add(this.motes);
  }

  _buildFiber() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
    this.fiberGroup = new THREE.Group();
    this.scene.add(this.fiberGroup);
    this.fiberMat = new THREE.MeshStandardMaterial({
      color: 0x2a8f88, emissive: 0x3fe6d4, emissiveIntensity: 0.95,
      roughness: 0.3, metalness: 0.1
    });
    this.fiberMesh = null;
    this.lastFiberU = -1;
  }

  _updateFiber(u) {
    if (!this.missileVisible) {
      if (this.fiberMesh) this.fiberMesh.visible = false;
      return;
    }
    if (Math.abs(u - this.lastFiberU) < 0.0025 && this.fiberMesh) {
      this.fiberMesh.visible = true;
      return;
    }
    this.lastFiberU = u;

    const pts = [];
    pts.push(this.fiberPos.clone());
    const mid = new THREE.Vector3();
    this.path.getPointAt(u, mid);
    const n = 44;
    for (let i = 0; i <= n; i++) {
      const uu = (i / n) * u;
      const p = this.path.getPointAt(uu, new THREE.Vector3());
      const sag = Math.sin((i / n) * Math.PI) * 0.35;
      p.y -= sag;
      if (i === 0) p.lerp(this.fiberPos, 0.65);
      pts.push(p);
    }
    // end exactly at the missile tail
    const tail = this.getMissileTail(new THREE.Vector3());
    pts[pts.length - 1].copy(tail);

    if (this.fiberMesh) {
      this.fiberMesh.geometry.dispose();
      this.fiberMesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 110, 0.009, 4, false);
    } else {
      this.fiberMesh = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 110, 0.009, 4, false),
        this.fiberMat
      );
      this.fiberMesh.frustumCulled = false;
      this.fiberGroup.add(this.fiberMesh);
    }
    this.fiberMesh.visible = true;
  }

  getMissileTail(out) {
    return out.set(0, 0, -0.72).applyMatrix4(this.missile.group.matrixWorld);
  }

  setMissileAt(u) {
    u = THREE.MathUtils.clamp(u, 0, 1);
    const pos = this.path.getPointAt(u, new THREE.Vector3());
    const tan = this.path.getTangentAt(u, new THREE.Vector3()).normalize();
    this.missile.group.position.copy(pos);
    this.missile.group.quaternion.setFromUnitVectors(Z_AXIS, tan);
    this.missile.group.visible = u > 0.0001;
    this.missileVisible = this.missile.group.visible;
    this.missile.group.updateMatrixWorld(true);
    this._updateFiber(u);
    this._fiberU = u;
  }

  setFiberVisible(v) {
    if (this.fiberMesh) this.fiberMesh.visible = v;
  }

  setMissileVisible(v) {
    this.missile.group.visible = v;
    this.missileVisible = v;
    if (!v && this.fiberMesh) this.fiberMesh.visible = false;
  }

  setJammer(on) {
    this.jammerOn = on;
    this.jammerStation.visible = on;
    this.jammerRings.visible = on;
  }

  setTargetRings(on) {
    this.rings.visible = on;
  }

  setPose(name, instant = false, duration = 1.4) {
    const p = this.poses[name];
    if (!p) return;
    this.directorActive = false;
    const w = window.innerWidth;
    const k = w > 1100 ? Math.max(0.8, Math.min(1, 1440 / w)) : 1;
    const pos = p.t.map((tv, i) => tv + (p.p[i] - tv) * k);
    this.flyTo(pos, p.t, instant ? 0 : duration);
  }

  flyTo(p, t, duration = 1.4) {
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

  setDirector(pos, target) {
    this.directorActive = true;
    this.camera.position.copy(pos);
    this.controls.target.copy(target);
    this.camera.lookAt(target);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    this.sky.position.copy(this.camera.position);

    if (this.heliRotor) this.heliRotor.rotation.y += dt * 7.5;
    if (this.heli) {
      this.heli.position.y = (this.heli.userData.baseY ?? 27) + Math.sin(t * 0.5) * 0.4;
      this.heli.rotation.z = Math.sin(t * 0.35) * 0.02;
    }
    if (this.motes) {
      const pos = this.motes.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * 0.16;
        if (y > 14) y = 0;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.2 + i) * dt * 0.1);
      }
      pos.needsUpdate = true;
    }

    if (this.jammerOn && this.missileVisible) {
      const mpos = this.missile.group.position;
      this.jammerRingMeshes.forEach((ring, i) => {
        const k = ((t * 0.9 + i / 3) % 1);
        ring.position.copy(mpos);
        ring.scale.setScalar(1 + k * 5);
        ring.material.opacity = 0.65 * (1 - k);
        ring.quaternion.copy(this.camera.quaternion);
      });
    }

    if (this.tween) {
      const tw = this.tween;
      tw.t += dt;
      const k = tw.t < 0.5 ? 4 * Math.pow(tw.t / tw.dur, 3) : 1 - Math.pow(-2 * tw.t / tw.dur + 2, 3) / 2;
      const kk = THREE.MathUtils.clamp(k, 0, 1);
      this.camera.position.lerpVectors(tw.p0, tw.p1, kk);
      this.controls.target.lerpVectors(tw.t0, tw.t1, kk);
      if (tw.t >= tw.dur) {
        this.tween = null;
        this.controls.enabled = true;
      }
    }
    if (!this.directorActive) this.controls.update();
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.75 ? 62 : aspect < 1.1 ? 50 : 42;
    this.camera.updateProjectionMatrix();
  }
}
