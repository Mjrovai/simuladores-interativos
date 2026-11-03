import { mulberry32 } from './world.js';

/**
 * Simulated TV seeker feed for the operator console.
 * Purely illustrative: a 1980s CCD image, not a real recording.
 */
export class SeekerFeed {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.time = 0;
    this.noise = this._makeNoise();
    this.scan = this._makeScanlines();
    this.frame = 0;
    this.last = null;
  }

  _makeNoise() {
    const tiles = [];
    const rnd = mulberry32(99);
    for (let k = 0; k < 3; k++) {
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const x = c.getContext('2d');
      const img = x.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 90 + rnd() * 150;
        img.data[i] = v * 0.92;
        img.data[i + 1] = v;
        img.data[i + 2] = v * 0.88;
        img.data[i + 3] = 26 + rnd() * 45;
      }
      x.putImageData(img, 0, 0);
      tiles.push(c);
    }
    return tiles;
  }

  _makeScanlines() {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.16)';
    x.fillRect(0, 0, 4, 1);
    return c;
  }

  /**
   * state: { rangeKm, altM, speed, fiberM, lock, link, phase, u, aim, pitch }
   */
  draw(state, dt = 0.033) {
    this.time += dt;
    const x = this.ctx;
    const W = this.w, H = this.h;
    this.frame++;

    if (state.impacted) {
      this._drawLost(x, W, H);
      return;
    }

    x.save();
    const jitterX = (Math.random() - 0.5) * 1.1;
    const jitterY = (Math.random() - 0.5) * 1.1;
    x.translate(jitterX, jitterY);

    const pitch = state.pitch ?? 0;
    const horizon = H * 0.42 + pitch * H * 0.16;

    // sky
    const sky = x.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#7f8a80');
    sky.addColorStop(1, '#c3c8b2');
    x.fillStyle = sky;
    x.fillRect(-4, -4, W + 8, horizon + 4);

    // ground
    const gr = x.createLinearGradient(0, horizon, 0, H);
    gr.addColorStop(0, '#8e8a6e');
    gr.addColorStop(0.18, '#63614a');
    gr.addColorStop(1, '#313427');
    x.fillStyle = gr;
    x.fillRect(-4, horizon, W + 8, H - horizon + 4);

    // horizon haze
    const haze = x.createLinearGradient(0, horizon - 22, 0, horizon + 26);
    haze.addColorStop(0, 'rgba(215,218,198,0)');
    haze.addColorStop(0.5, 'rgba(215,218,198,0.55)');
    haze.addColorStop(1, 'rgba(215,218,198,0)');
    x.fillStyle = haze;
    x.fillRect(0, horizon - 22, W, 48);

    this._drawTerrain(x, horizon, state);
    this._drawTarget(x, horizon, state);
    this._drawHud(x, state, horizon);

    // scanlines + noise + vignette
    const pat = x.createPattern(this.scan, 'repeat');
    x.fillStyle = pat;
    x.fillRect(0, 0, W, H);

    const noise = this.noise[this.frame % 3];
    x.globalAlpha = state.link === false ? 0.85 : 0.16;
    const ox = Math.floor(Math.random() * 120) - 80;
    const oy = Math.floor(Math.random() * 120) - 80;
    for (let nx = ox; nx < W; nx += 160) {
      for (let ny = oy; ny < H; ny += 160) x.drawImage(noise, nx, ny);
    }
    x.globalAlpha = 1;

    const vig = x.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = vig;
    x.fillRect(0, 0, W, H);

    x.restore();

    if (state.link === false) {
      x.fillStyle = 'rgba(20,10,5,0.35)';
      x.fillRect(0, 0, W, H);
      x.font = '600 22px "IBM Plex Mono", monospace';
      x.fillStyle = '#e8b25a';
      x.textAlign = 'center';
      x.fillText('SEM ENLACE', W / 2, H / 2 - 6);
      x.font = '500 12px "IBM Plex Mono", monospace';
      x.fillStyle = 'rgba(232,178,90,0.75)';
      x.fillText('VERIFIQUE A FIBRA ÓPTICA', W / 2, H / 2 + 18);
      x.textAlign = 'left';
    }
  }

  _drawLost(x, W, H) {
    x.fillStyle = '#161a16';
    x.fillRect(0, 0, W, H);
    const noise = this.noise[this.frame % 3];
    x.globalAlpha = 0.75;
    const ox = Math.floor(Math.random() * 120) - 80;
    const oy = Math.floor(Math.random() * 120) - 80;
    for (let nx = ox; nx < W; nx += 160) {
      for (let ny = oy; ny < H; ny += 160) x.drawImage(noise, nx, ny);
    }
    x.globalAlpha = 1;
    x.fillStyle = 'rgba(240,166,60,0.9)';
    x.font = '600 20px "IBM Plex Mono", monospace';
    x.textAlign = 'center';
    x.fillText('SINAL PERDIDO', W / 2, H / 2 - 4);
    x.font = '500 10px "IBM Plex Mono", monospace';
    x.fillStyle = 'rgba(240,166,60,0.65)';
    x.fillText('IMPACTO CONFIRMADO', W / 2, H / 2 + 18);
    x.textAlign = 'left';
    const pat = x.createPattern(this.scan, 'repeat');
    x.fillStyle = pat;
    x.fillRect(0, 0, W, H);
  }

  _drawTerrain(x, horizon, state) {
    const W = this.w, H = this.h;
    const scroll = (state.u ?? 0) * 6.0;
    const rnd = mulberry32(1234);
    x.save();
    x.beginPath();
    x.rect(0, horizon + 1, W, H - horizon);
    x.clip();

    // perspective furrows
    for (let i = 0; i < 26; i++) {
      const yy = horizon + Math.pow(i / 26, 1.7) * (H - horizon);
      const alpha = 0.05 + (i / 26) * 0.16;
      x.strokeStyle = `rgba(58,58,42,${alpha})`;
      x.lineWidth = 1 + (i / 26) * 2;
      x.beginPath();
      x.moveTo(-20, yy + 18);
      x.lineTo(W + 20, yy + 18);
      x.stroke();
    }

    // grass tufts moving toward the viewer
    for (let i = 0; i < 420; i++) {
      const seed = rnd();
      const px = (seed * 1.7 + 0.11) % 1 * W;
      const depth = ((rnd() + scroll * (0.12 + seed * 0.2)) % 1);
      const yy = horizon + Math.pow(depth, 1.8) * (H - horizon);
      const len = 2 + Math.pow(depth, 2) * 16;
      x.strokeStyle = `rgba(36,40,28,${0.16 + depth * 0.34})`;
      x.lineWidth = 0.8 + depth * 1.4;
      x.beginPath();
      x.moveTo(px, yy);
      x.lineTo(px + (seed - 0.5) * 6, yy - len);
      x.stroke();
    }

    // dust streaks
    x.globalAlpha = 0.18;
    for (let i = 0; i < 18; i++) {
      const px = ((i * 0.173 + scroll * 0.05) % 1) * W;
      const yy = horizon + ((i * 0.31) % 1) * (H - horizon);
      const g = x.createRadialGradient(px, yy, 0, px, yy, 40);
      g.addColorStop(0, 'rgba(200,190,160,0.5)');
      g.addColorStop(1, 'rgba(200,190,160,0)');
      x.fillStyle = g;
      x.fillRect(px - 40, yy - 40, 80, 80);
    }
    x.globalAlpha = 1;
    x.restore();
  }

  _drawTarget(x, horizon, state) {
    if (state.targetVisible === false) return;
    const range = Math.max(0.35, state.rangeKm ?? 12);
    const size = Math.min(160, 15 / Math.pow(range, 0.9) * 12);
    const px = this.w / 2 + (state.aim ?? 0) * 46;
    const py = horizon + 26 + size * 0.55;
    const s = Math.max(4, size);

    // shadow
    x.save();
    x.globalAlpha = 0.35;
    x.fillStyle = '#24281f';
    x.beginPath();
    x.ellipse(px + s * 0.12, py + s * 0.2, s * 0.72, s * 0.22, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();

    x.save();
    x.translate(px, py);
    x.scale(s / 40, s / 40);
    x.translate(-20, -14);

    // tracks
    x.fillStyle = '#2b2e26';
    x.fillRect(2, 10, 40, 15);
    x.fillStyle = '#3b3f33';
    x.fillRect(4, 12, 36, 11);
    x.fillStyle = '#22251e';
    for (let i = 0; i < 5; i++) x.fillRect(5 + i * 7, 13, 4, 9);

    // hull
    const hull = x.createLinearGradient(0, 6, 0, 22);
    hull.addColorStop(0, '#555c46');
    hull.addColorStop(1, '#2f3429');
    x.fillStyle = hull;
    x.beginPath();
    x.moveTo(4, 8);
    x.lineTo(42, 8);
    x.lineTo(46, 17);
    x.lineTo(2, 17);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(18,20,15,0.8)';
    x.lineWidth = 1;
    x.stroke();

    // turret
    x.fillStyle = '#5f6650';
    x.beginPath();
    x.ellipse(25, 8, 12, 6, 0, 0, Math.PI * 2);
    x.fill();
    x.stroke();

    // gun
    x.fillStyle = '#4a5040';
    x.fillRect(4, 6, 22, 2.4);
    x.fillStyle = '#2c3026';
    x.fillRect(2, 5.4, 4, 3.4);

    // detail
    x.fillStyle = 'rgba(20,22,17,0.55)';
    x.fillRect(33, 10, 5, 3);
    x.restore();
  }

  _drawHud(x, state, horizon) {
    const W = this.w, H = this.h;
    const lock = !!state.lock;
    const col = lock ? '#ffd27a' : '#d7e0c8';

    x.save();
    x.strokeStyle = 'rgba(235,240,220,0.72)';
    x.fillStyle = 'rgba(235,240,220,0.72)';
    x.lineWidth = 1.2;

    // center reticle
    const cx = W / 2, cy = H / 2;
    x.beginPath();
    x.moveTo(cx - 26, cy); x.lineTo(cx - 9, cy);
    x.moveTo(cx + 9, cy); x.lineTo(cx + 26, cy);
    x.moveTo(cx, cy - 26); x.lineTo(cx, cy - 9);
    x.moveTo(cx, cy + 9); x.lineTo(cx, cy + 26);
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, 1.6, 0, Math.PI * 2);
    x.fill();

    // corner brackets
    const m = 22, l = 18;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([bx, by, sx, sy]) => {
      x.beginPath();
      x.moveTo(bx, by + sy * l); x.lineTo(bx, by); x.lineTo(bx + sx * l, by);
      x.stroke();
    });

    // tracking box
    if (lock) {
      const range = Math.max(0.35, state.rangeKm ?? 12);
      const size = Math.min(160, 15 / Math.pow(range, 0.9) * 12);
      const s = Math.max(10, size);
      const px = W / 2 + (state.aim ?? 0) * 46;
      const py = horizon + 26 + s * 0.55;
      const bw = Math.max(24, s * 1.15), bh = Math.max(16, s * 0.8);
      x.strokeStyle = col;
      x.lineWidth = 1.4;
      x.strokeRect(px - bw / 2, py - bh / 2, bw, bh);
      x.fillStyle = col;
      x.font = '500 10px "IBM Plex Mono", monospace';
      x.fillText('TRAVADO', px - bw / 2, py - bh / 2 - 6);
      x.fillText('ALVO', px + bw / 2 - 30, py + bh / 2 + 12);
    }

    // top data
    x.fillStyle = 'rgba(235,240,220,0.86)';
    x.font = '500 12px "IBM Plex Mono", monospace';
    x.fillText('TV · CANAL 1', 40, 40);
    x.fillStyle = lock ? col : 'rgba(235,240,220,0.7)';
    x.fillText(`RNG ${(state.rangeKm ?? 0).toFixed(2)} km`, 40, 58);
    x.fillText(`ALT ${Math.round(state.altM ?? 0)} m`, 40, 74);
    x.fillStyle = 'rgba(240,245,225,0.82)';
    x.fillText(`VEL ${Math.round(state.speed ?? 0)} m/s`, 40, 90);

    // fiber
    x.textAlign = 'right';
    x.fillStyle = 'rgba(240,245,225,0.82)';
    x.fillText(`FIB ${Math.round(state.fiberM ?? 0)} m`, W - 40, 40);
    const bars = Math.max(1, Math.round(4 - (state.rangeKm ?? 12) / 5));
    for (let i = 0; i < 4; i++) {
      x.fillStyle = i < bars ? 'rgba(180,230,160,0.85)' : 'rgba(120,130,110,0.35)';
      x.fillRect(W - 40 - (4 - i) * 9, 54, 6, 10);
    }

    // heading tape
    x.textAlign = 'center';
    x.fillStyle = 'rgba(235,240,220,0.55)';
    x.fillText('N   030   060   E   120   150', W / 2, 30);
    x.strokeStyle = 'rgba(235,240,220,0.4)';
    x.beginPath();
    x.moveTo(W / 2 - 60, 36); x.lineTo(W / 2 + 60, 36);
    x.stroke();
    x.beginPath();
    x.moveTo(W / 2, 33); x.lineTo(W / 2 - 4, 39); x.lineTo(W / 2 + 4, 39);
    x.closePath();
    x.fill();

    // control law
    x.textAlign = 'right';
    x.fillStyle = state.controlYaw ? 'rgba(180,230,160,0.85)' : 'rgba(235,240,220,0.6)';
    x.fillText(state.manual ? 'GUIAMENTO MANUAL' : (state.controlYaw ? 'YAW: OPERADOR' : 'YAW: AUTO'), W - 40, 88);
    x.fillStyle = 'rgba(235,240,220,0.55)';
    x.fillText('PITCH/ROLL: AUTO', W - 40, 104);

    // REC
    if (this.frame % 60 < 42) {
      x.fillStyle = '#ff7a55';
      x.beginPath();
      x.arc(W - 54, H - 30, 4, 0, Math.PI * 2);
      x.fill();
    }
    x.textAlign = 'right';
    x.fillStyle = 'rgba(235,240,220,0.75)';
    x.fillText('REC', W - 44, H - 26);

    x.textAlign = 'left';
    x.fillStyle = 'rgba(235,240,220,0.55)';
    x.fillText(state.phase ?? 'CRUZEIRO', 40, H - 26);
    x.restore();
  }
}
