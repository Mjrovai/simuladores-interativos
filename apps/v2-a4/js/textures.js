import * as THREE from 'three';

let seed = 0x9e3779b9;
export function setSeed(value = 0x9e3779b9) {
  seed = value >>> 0;
}
export function rand() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0xffffffff;
}
const range = (a, b) => a + (b - a) * rand();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

function canvas(size, h = size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  return [c, c.getContext('2d')];
}

function makeCanvasTexture(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = aniso;
  tex.needsUpdate = true;
  return tex;
}

function blobPath(ctx, cx, cy, radius, points, ragged) {
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const r = radius * (1 - ragged + rand() * ragged * 2);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * range(0.65, 1.25);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Camuflagem irregular inspirada nos padrões de campo da A4/V-2.
export function makeCamo() {
  setSeed(0xa4a4a4);
  const W = 1024;
  const [c, ctx] = canvas(W);
  ctx.fillStyle = '#71684f';
  ctx.fillRect(0, 0, W, W);

  const palette = ['#4b503a', '#3b4230', '#5c4a35', '#706147', '#30382b', '#85734f'];
  const drawWrapped = (fn) => {
    for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]) {
      ctx.save(); ctx.translate(ox, oy); fn(); ctx.restore();
    }
  };

  // Grandes manchas de camuflagem, desenhadas com cópias em wrap para reducir emendas.
  const blobs = Array.from({ length: 46 }, () => ({
    cx: rand() * W,
    cy: rand() * W,
    rad: range(45, 165),
    points: Math.floor(range(16, 28)),
    ragged: range(0.20, 0.34),
    col: pick(palette),
    alpha: range(0.88, 1),
  }));
  for (const b of blobs) {
    for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = b.col;
      ctx.globalAlpha = b.alpha;
      blobPath(ctx, b.cx, b.cy, b.rad, b.points, b.ragged);
      ctx.fill();
      ctx.restore();
    }
  }

  // Bordas pulverizadas / manchas pequenas.
  ctx.globalAlpha = 1;
  for (let i = 0; i < 950; i++) {
    const x = rand() * W;
    const y = rand() * W;
    const r = Math.pow(rand(), 2.6) * 7 + 0.5;
    const col = rand() > 0.45 ? pick(palette) : '#3e4438';
    ctx.fillStyle = col;
    ctx.globalAlpha = range(0.08, 0.38);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Riscos, poeira e escorridos verticais.
  ctx.globalAlpha = 1;
  for (let i = 0; i < 120; i++) {
    const x = rand() * W;
    const y = rand() * W;
    const len = range(18, 190);
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(28,26,20,.16)' : 'rgba(208,193,162,.07)';
    ctx.lineWidth = range(0.4, 2.0);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + range(-5, 5), y + len * 0.4, x + range(-8, 8), y + len * 0.8, x + range(-6, 6), y + len);
    ctx.stroke();
  }

  // Granulação fina.
  const img = ctx.getImageData(0, 0, W, W);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 22;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // Rugosidade: variação sutil com brilho em áreas de desgaste.
  const [rc, rctx] = canvas(512);
  rctx.fillStyle = '#b4b4b4';
  rctx.fillRect(0, 0, 512, 512);
  const rimg = rctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < rimg.data.length; i += 4) {
    const n = 145 + (rand() - 0.5) * 70;
    rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = n;
  }
  rctx.putImageData(rimg, 0, 0);
  for (let i = 0; i < 80; i++) {
    rctx.fillStyle = `rgba(70,70,70,${range(0.05, 0.22)})`;
    rctx.beginPath();
    rctx.ellipse(rand() * 512, rand() * 512, range(4, 40), range(2, 16), rand() * Math.PI, 0, Math.PI * 2);
    rctx.fill();
  }

  // Relevo: ruído suave + riscos.
  const [bc, bctx] = canvas(512);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);
  const bimg = bctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < bimg.data.length; i += 4) {
    const n = 128 + (rand() - 0.5) * 38;
    bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = n;
  }
  bctx.putImageData(bimg, 0, 0);
  for (let i = 0; i < 130; i++) {
    bctx.strokeStyle = `rgba(40,40,40,${range(0.08, 0.35)})`;
    bctx.lineWidth = range(0.4, 1.6);
    bctx.beginPath();
    const x = rand() * 512, y = rand() * 512;
    bctx.moveTo(x, y); bctx.lineTo(x + range(-8, 8), y + range(10, 90)); bctx.stroke();
  }

  const map = makeCanvasTexture(c, { repeat: [1, 2.65], aniso: 8 });
  map.wrapS = THREE.MirroredRepeatWrapping;
  map.wrapT = THREE.MirroredRepeatWrapping;
  return {
    map,
    roughnessMap: makeCanvasTexture(rc, { srgb: false, repeat: [2.1, 5.3], aniso: 4 }),
    bumpMap: makeCanvasTexture(bc, { srgb: false, repeat: [2.1, 5.3], aniso: 4 }),
  };
}

export function makeGrimeBand() {
  setSeed(0x6a11);
  const W = 512, H = 1024;
  const [c, ctx] = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, 'rgba(17,15,11,.72)');
  g.addColorStop(0.28, 'rgba(20,18,13,.42)');
  g.addColorStop(0.62, 'rgba(22,20,15,.16)');
  g.addColorStop(1, 'rgba(22,20,15,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    const x = rand() * W;
    const y = H * range(0.15, 1);
    const len = range(30, 260);
    const alpha = range(0.015, 0.08);
    ctx.strokeStyle = `rgba(12,11,9,${alpha})`;
    ctx.lineWidth = range(1, 8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + range(-10, 10), y - len);
    ctx.stroke();
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(40,34,24,${range(0.02, 0.09)})`;
    ctx.beginPath();
    ctx.ellipse(rand() * W, H * range(0.5, 1), range(3, 28), range(2, 12), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return makeCanvasTexture(c, { srgb: true, repeat: [2, 1], aniso: 4 });
}

export function makeConcrete() {
  setSeed(0xc0c0c0);
  const W = 1024;
  const [c, ctx] = canvas(W);
  ctx.fillStyle = '#4b4a46';
  ctx.fillRect(0, 0, W, W);
  for (let i = 0; i < 5400; i++) {
    const g = Math.floor(range(35, 105));
    ctx.fillStyle = `rgba(${g},${g},${g - 2},${range(0.08, 0.34)})`;
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * W, Math.pow(rand(), 2) * 12 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 28; i++) {
    ctx.strokeStyle = `rgba(20,20,19,${range(0.20, 0.55)})`;
    ctx.lineWidth = range(0.6, 2.4);
    ctx.beginPath();
    let x = rand() * W, y = rand() * W;
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += range(-70, 70); y += range(-70, 70);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Manchas de umidade.
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = `rgba(24,26,25,${range(0.04, 0.12)})`;
    ctx.beginPath();
    ctx.ellipse(rand() * W, rand() * W, range(40, 190), range(20, 80), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return makeCanvasTexture(c, { repeat: [2.5, 2.5], aniso: 8 });
}

export function makeMetalBrush() {
  setSeed(0x51ee7);
  const W = 512;
  const [c, ctx] = canvas(W);
  ctx.fillStyle = '#8f9294';
  ctx.fillRect(0, 0, W, W);
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(range(90, 205));
    ctx.strokeStyle = `rgba(${v},${v},${v},${range(0.03, 0.18)})`;
    ctx.lineWidth = range(0.3, 1.3);
    const x = rand() * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + range(-6, 6), W);
    ctx.stroke();
  }
  return makeCanvasTexture(c, { srgb: false, repeat: [2, 6], aniso: 4 });
}

export function makeRadialTexture(inner = 'rgba(0,0,0,.92)', outer = 'rgba(0,0,0,0)') {
  const [c, ctx] = canvas(256);
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 126);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return makeCanvasTexture(c, { srgb: true });
}

export function makeGlowTexture() {
  const [c, ctx] = canvas(256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,236,200,.75)');
  g.addColorStop(0.5, 'rgba(255,170,80,.18)');
  g.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return makeCanvasTexture(c, { srgb: true });
}

export function makeTextDecal(text, {
  width = 1024, height = 256, font = '700 150px "Helvetica Neue", Helvetica, Arial, sans-serif',
  color = 'rgba(238,232,214,.94)', sub = null, spacing = 0,
} = {}) {
  const [c, ctx] = canvas(width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = font;
  if (spacing) {
    // Espaçamento manual para lettering técnico.
    const chars = [...text];
    const widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
    const total = widths.reduce((a, b) => a + b, 0) - spacing;
    let x = width / 2 - total / 2;
    for (let i = 0; i < chars.length; i++) {
      ctx.lineWidth = 11;
      ctx.strokeStyle = 'rgba(14,16,14,.48)';
      ctx.strokeText(chars[i], x + widths[i] / 2, sub ? height * 0.40 : height / 2);
      ctx.fillText(chars[i], x + widths[i] / 2, sub ? height * 0.40 : height / 2);
      x += widths[i];
    }
  } else {
    ctx.lineWidth = 11;
    ctx.strokeStyle = 'rgba(14,16,14,.48)';
    ctx.strokeText(text, width / 2, sub ? height * 0.40 : height / 2);
    ctx.fillText(text, width / 2, sub ? height * 0.40 : height / 2);
  }
  if (sub) {
    ctx.font = '500 44px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(238,232,214,.72)';
    ctx.fillText(sub, width / 2, height * 0.76);
  }
  return makeCanvasTexture(c, { srgb: true, repeat: null, aniso: 8 });
}

export function makeStencil(text, color = 'rgba(30,32,30,.78)') {
  const [c, ctx] = canvas(512, 128);
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = '700 58px "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  return makeCanvasTexture(c, { srgb: true, repeat: null, aniso: 8 });
}

export function makeHeatTint() {
  const [c, ctx] = canvas(16, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.00, '#77746e');
  g.addColorStop(0.24, '#8a8072');
  g.addColorStop(0.42, '#b4a477');
  g.addColorStop(0.55, '#7f8790');
  g.addColorStop(0.68, '#5e6570');
  g.addColorStop(0.78, '#7c5d52');
  g.addColorStop(0.88, '#4d4a4a');
  g.addColorStop(1.00, '#2b2a28');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(20,20,22,${range(0.02, 0.14)})`;
    ctx.fillRect(0, rand() * 512, 16, range(1, 6));
  }
  return makeCanvasTexture(c, { srgb: true, repeat: [1, 1], aniso: 4 });
}
