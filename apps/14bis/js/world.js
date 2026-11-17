// ============================================================
// 14-BIS · Bagatelle environment — autumn 1906
// Grass polo field, tree lines, the château, spectators,
// distance markers, Henry Farman's car, airship No. 14.
// ============================================================
import * as THREE from 'three';

function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function grassTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#77875a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4200; i++) {
      const shade = Math.random();
      g.fillStyle = shade < 0.5
        ? `rgba(${90 + Math.random() * 40 | 0},${105 + Math.random() * 40 | 0},60,0.25)`
        : `rgba(${140 + Math.random() * 40 | 0},${140 + Math.random() * 30 | 0},85,0.14)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 1 + Math.random() * 2);
    }
    // faint mowing bands
    for (let y = 0; y < h; y += 64) {
      g.fillStyle = 'rgba(255,255,240,0.035)';
      g.fillRect(0, y, w, 32);
    }
  }, 90);
}

// Physical sign board mounted on a post — clearly scenery, not a UI button.
function signBoard(text, { w = 1.3, fg = '#2a241a', bg = '#efe6cf', size = 90 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `bold ${size}px Georgia, serif`;
  const tw = g.measureText(text).width;
  const padX = size * 0.42, padY = size * 0.34;
  c.width = Math.ceil(tw + padX * 2); c.height = Math.ceil(size * 1.25 + padY * 2);
  const g2 = c.getContext('2d');
  g2.fillStyle = bg; g2.fillRect(0, 0, c.width, c.height);
  g2.strokeStyle = '#6b5a3e'; g2.lineWidth = size * 0.09;
  g2.strokeRect(g2.lineWidth / 2, g2.lineWidth / 2, c.width - g2.lineWidth, c.height - g2.lineWidth);
  g2.font = `bold ${size}px Georgia, serif`;
  g2.fillStyle = fg; g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w * c.height / c.width),
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide })
  );
  mesh.rotation.y = Math.PI / 2;   // face +X, toward the flight line
  mesh.castShadow = true;
  return mesh;
}

export function buildWorld(scene) {
  const world = new THREE.Group();
  scene.add(world);

  // ----- ground -----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: grassTexture(), color: 0xb9bf9a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  world.add(ground);

  // ----- distance markers along the flight line (x = -13): post + sign board -----
  const markerMat = new THREE.MeshStandardMaterial({ color: 0x8a7355, roughness: 0.9 });
  const special = { 100: '#8a6d1a', 220: '#8a6d1a' };
  const postGeo = new THREE.CylinderGeometry(0.05, 0.075, 1.35, 6);
  for (const d of [25, 50, 75, 100, 150, 200, 220, 250, 300]) {
    const post = new THREE.Mesh(postGeo, markerMat);
    post.position.set(-13, 0.675, d);
    post.castShadow = true;
    world.add(post);
    const board = signBoard(`${d} m`, { w: special[d] ? 1.5 : 1.2, fg: special[d] ?? '#2a241a' });
    board.position.set(-13, 1.62, d);
    world.add(board);
  }
  // ----- START sign: same post support as the distance markers -----
  const startPost = new THREE.Mesh(postGeo, markerMat);
  startPost.position.set(-13, 0.675, 0);
  startPost.castShadow = true;
  world.add(startPost);
  const startBoard = signBoard('START', { w: 1.7 });
  startBoard.position.set(-13, 1.66, 0);
  world.add(startBoard);
  // painted start line across the course
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 0.55),
    new THREE.MeshBasicMaterial({ color: 0xf3ecd8, transparent: true, opacity: 0.8, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
  stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 0.05, 0); stripe.renderOrder = 1;
  world.add(stripe);

  // ----- autumn tree lines (instanced) -----
  const N = 150;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 3.4, 6);
  const canopyGeo = new THREE.IcosahedronGeometry(2.6, 1);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4a33, roughness: 1 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, N);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const palette = [0x9a8f3c, 0xb08a3a, 0x8f7a30, 0xa66a2c, 0x77713a, 0x99632e];
  let placed = 0;
  while (placed < N) {
    const a = Math.random() * Math.PI * 2;
    const r = 170 + Math.random() * 230;
    const x = Math.cos(a) * r, z = Math.sin(a) * r + 120;
    if (Math.abs(x) < 40 && z > -60 && z < 360) continue;   // keep the field clear
    const s = 0.8 + Math.random() * 1.5;
    dummy.position.set(x, 1.7 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = (3.4 + 1.6) * s;
    dummy.scale.set(s * (0.9 + Math.random() * 0.5), s * (0.8 + Math.random() * 0.6), s * (0.9 + Math.random() * 0.5));
    dummy.updateMatrix();
    canopies.setMatrixAt(placed, dummy.matrix);
    col.setHex(palette[Math.random() * palette.length | 0]);
    canopies.setColorAt(placed, col);
    placed++;
  }
  world.add(trunks, canopies);

  // ----- Château de Bagatelle (stylised neoclassical) -----
  const chateau = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.9 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.8 });
  const main = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 12), white);
  main.position.y = 4.5;
  chateau.add(main);
  const mainRoof = new THREE.Mesh(new THREE.BoxGeometry(27, 2.4, 13), roof);
  mainRoof.position.y = 10.1;
  chateau.add(mainRoof);
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(12, 6.5, 9), white);
    wing.position.set(sx * 19, 3.25, 2);
    chateau.add(wing);
    const wr = new THREE.Mesh(new THREE.BoxGeometry(13, 1.8, 10), roof);
    wr.position.set(sx * 19, 7.3, 2);
    chateau.add(wr);
  }
  // columns
  for (let i = -3; i <= 3; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 7, 8), white);
    c.position.set(i * 3, 3.5, 6.4);
    chateau.add(c);
  }
  chateau.position.set(-235, 0, 250);
  chateau.rotation.y = Math.PI / 5;
  world.add(chateau);

  // ----- spectators along the field (instanced figures) -----
  const NS = 90;
  const bodyGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.15, 7);
  const headGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xd9b08c, roughness: 1 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, NS);
  const heads = new THREE.InstancedMesh(headGeo, headMat, NS);
  const coats = [0x2c2a26, 0x3a3630, 0x25282e, 0x40342a, 0x33302b, 0x1f2226];
  for (let i = 0; i < NS; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (11 + Math.random() * 7);
    const z = -15 + Math.random() * 330;
    dummy.position.set(x, 0.58, z);
    dummy.scale.setScalar(0.9 + Math.random() * 0.25);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 1.32;
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    col.setHex(coats[Math.random() * coats.length | 0]);
    bodies.setColorAt(i, col);
  }
  world.add(bodies, heads);

  // ----- Henry Farman's 1906 automobile (follows the Nov 12 record run) -----
  const car = new THREE.Group();
  const carBody = new THREE.MeshStandardMaterial({ color: 0x2a3226, roughness: 0.6, metalness: 0.2 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a55c, roughness: 0.35, metalness: 0.7 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 3.2), carBody);
  chassis.position.y = 0.75;
  car.add(chassis);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.1), carBody);
  hood.position.set(0, 1.15, 1.0);
  car.add(hood);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.9), new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.9 }));
  seat.position.set(0, 1.2, -0.5);
  car.add(seat);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 14), new THREE.MeshStandardMaterial({ color: 0x22201c, roughness: 0.9 }));
    wh.rotation.z = Math.PI / 2;
    wh.position.set(sx * 0.8, 0.42, sz * 1.05);
    car.add(wh);
  }
  for (const sx of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), brass);
    lamp.position.set(sx * 0.55, 1.25, 1.62);
    car.add(lamp);
  }
  const driver = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x3a342c, roughness: 1 }));
  driver.position.set(0.3, 1.7, -0.5);
  car.add(driver);
  const dHead = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), headMat);
  dHead.position.set(0.3, 2.15, -0.5);
  car.add(dHead);
  car.position.set(14, 0, -8);
  car.visible = false;
  world.add(car);

  // ----- airship No. 14 in the distance (the 14-bis was towed beneath it) -----
  const airship = new THREE.Group();
  const envelope = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8cfb2, roughness: 0.8 })
  );
  envelope.scale.set(4.5, 13, 4.5);
  envelope.rotation.x = Math.PI / 2;
  airship.add(envelope);
  const gondola = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 6), new THREE.MeshStandardMaterial({ color: 0x8a6f48, roughness: 0.9 }));
  gondola.position.y = -5;
  airship.add(gondola);
  airship.position.set(150, 105, 480);
  world.add(airship);

  // ----- the zip-line test pylons (July–Aug 1906 trials) -----
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x7a6a4e, roughness: 0.9 });
  const mkPylon = (h, x, z) => {
    const p = new THREE.Group();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, h, 6), pylonMat);
      leg.position.set(sx * 0.7, h / 2, sz * 0.7);
      leg.rotation.z = sx * 0.06; leg.rotation.x = -sz * 0.06;
      p.add(leg);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 1.8), pylonMat);
    top.position.y = h;
    p.add(top);
    p.position.set(x, 0, z);
    return p;
  };
  const p1 = mkPylon(13.5, 42, -45);
  const p2 = mkPylon(7, 42, 15);
  world.add(p1, p2);
  const cablePts = [new THREE.Vector3(42, 13.4, -45), new THREE.Vector3(42, 7, 15)];
  const cable = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(cablePts),
    new THREE.LineBasicMaterial({ color: 0x4a443c })
  );
  world.add(cable);

  // ----- sky & light: overcast autumn afternoon -----
  const skyGeo = new THREE.SphereGeometry(700, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x9fb2bd) },
      mid: { value: new THREE.Color(0xd6d8d2) },
      bot: { value: new THREE.Color(0xe8e4d8) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.65)) : mix(mid, bot, pow(-h, 0.5));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  scene.fog = new THREE.Fog(0xdcdcd4, 180, 640);

  const hemi = new THREE.HemisphereLight(0xdfe3e0, 0x6a745a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.35);
  sun.position.set(60, 80, -40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  const carTarget = new THREE.Vector3();
  return {
    group: world, sun, car, airship,
    update(dt, t, aircraftPos, mission) {
      // sun shadow frustum follows the aircraft
      sun.position.set(aircraftPos.x + 60, 80, aircraftPos.z - 40);
      sun.target.position.copy(aircraftPos);
      // airship drifts
      airship.position.x = 150 + Math.sin(t * 0.02) * 30;
      airship.position.z = 480 + Math.cos(t * 0.015) * 20;
      // Farman's car follows the record run
      if (mission === 'nov12') {
        car.visible = true;
        carTarget.set(aircraftPos.x + 12, 0, aircraftPos.z - 4);
        car.position.lerp(carTarget, Math.min(1, dt * 1.6));
        const dz = aircraftPos.z - car.position.z;
        car.rotation.y = Math.atan2(aircraftPos.x + 12 - car.position.x, Math.max(2, dz)) * 0.3;
      } else {
        car.visible = false;
      }
    },
  };
}