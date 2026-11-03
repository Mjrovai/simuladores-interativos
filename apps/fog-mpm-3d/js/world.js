import * as THREE from 'three';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const smoothstep = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x, y) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) {
    s += amp * noise2(x * f, y * f);
    f *= 2.03; amp *= 0.5;
  }
  return s;
}

export function makeGroundTexture(size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const rnd = mulberry32(20250817);
  x.fillStyle = '#8d7350';
  x.fillRect(0, 0, size, size);

  // broad tonal patches
  for (let i = 0; i < 90; i++) {
    const r = 30 + rnd() * 140;
    const gx = rnd() * size, gy = rnd() * size;
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    const tone = rnd();
    const col = tone < 0.4 ? 'rgba(106,92,64,0.20)'
      : tone < 0.7 ? 'rgba(158,131,91,0.18)'
        : 'rgba(78,82,48,0.16)';
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(gx - r, gy - r, r * 2, r * 2);
  }

  // grit
  for (let i = 0; i < 26000; i++) {
    const px = rnd() * size, py = rnd() * size;
    const s = rnd() * 1.9 + 0.3;
    const v = rnd();
    x.fillStyle = v < 0.45 ? `rgba(58,48,34,${0.05 + rnd() * 0.18})`
      : v < 0.8 ? `rgba(196,168,124,${0.05 + rnd() * 0.16})`
        : `rgba(120,110,62,${0.05 + rnd() * 0.2})`;
    x.fillRect(px, py, s, s);
  }

  // dry grass tufts
  for (let i = 0; i < 4200; i++) {
    const px = rnd() * size, py = rnd() * size;
    const h = 2 + rnd() * 7;
    const lean = (rnd() - 0.5) * 4;
    x.strokeStyle = rnd() < 0.5 ? 'rgba(104,100,52,0.5)' : 'rgba(126,116,66,0.4)';
    x.lineWidth = 0.7 + rnd() * 0.9;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + lean, py - h);
    x.stroke();
  }

  // small stones
  for (let i = 0; i < 900; i++) {
    const px = rnd() * size, py = rnd() * size;
    x.fillStyle = `rgba(150,140,120,${0.12 + rnd() * 0.25})`;
    x.beginPath();
    x.ellipse(px, py, 0.8 + rnd() * 2.2, 0.7 + rnd() * 1.6, rnd() * 3, 0, Math.PI * 2);
    x.fill();
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeCamoTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const rnd = mulberry32(77123);
  x.fillStyle = '#565b3e';
  x.fillRect(0, 0, size, size);
  const colors = ['#6a6a48', '#3f4531', '#7b6f4d', '#2f352a'];
  for (let i = 0; i < 46; i++) {
    x.fillStyle = colors[Math.floor(rnd() * colors.length)];
    x.globalAlpha = 0.85;
    x.beginPath();
    const cx = rnd() * size, cy = rnd() * size;
    const pts = 6 + Math.floor(rnd() * 5);
    for (let p = 0; p < pts; p++) {
      const a = (p / pts) * Math.PI * 2;
      const r = 20 + rnd() * 55;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.7;
      if (p === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
  }
  x.globalAlpha = 1;
  // dust wash
  for (let i = 0; i < 4000; i++) {
    x.fillStyle = `rgba(150,128,88,${rnd() * 0.09})`;
    x.fillRect(rnd() * size, rnd() * size, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function makeConcreteTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const rnd = mulberry32(881);
  x.fillStyle = '#8b8779';
  x.fillRect(0, 0, size, size);
  for (let i = 0; i < 14000; i++) {
    const v = 110 + rnd() * 70;
    x.fillStyle = `rgba(${v},${v - 4},${v - 12},${0.05 + rnd() * 0.18})`;
    x.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  for (let i = 0; i < 26; i++) {
    const gx = rnd() * size, gy = rnd() * size;
    const r = 20 + rnd() * 90;
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, `rgba(60,58,50,${0.05 + rnd() * 0.12})`);
    g.addColorStop(1, 'rgba(60,58,50,0)');
    x.fillStyle = g;
    x.fillRect(gx - r, gy - r, r * 2, r * 2);
  }
  // cracks
  for (let i = 0; i < 16; i++) {
    let px = rnd() * size, py = rnd() * size;
    x.strokeStyle = `rgba(38,37,32,${0.25 + rnd() * 0.3})`;
    x.lineWidth = 0.8 + rnd() * 1.4;
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 7; k++) {
      px += (rnd() - 0.5) * 40;
      py += (rnd() - 0.5) * 40;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeRadialSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSky({ top, bottom, glow, exponent = 0.65 }) {
  const geo = new THREE.SphereGeometry(900, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uBottom: { value: new THREE.Color(bottom) },
      uGlow: { value: new THREE.Color(glow) },
      uExp: { value: exponent }
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uGlow; uniform float uExp;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        float t = pow(h, uExp);
        vec3 c = mix(uBottom, uTop, t);
        float band = pow(1.0 - abs(vDir.y), 5.0);
        c += uGlow * band * 0.35;
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

export function disposeObject(obj) {
  obj.traverse(o => {
    if (o.isMesh) {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material?.dispose();
    }
  });
}
