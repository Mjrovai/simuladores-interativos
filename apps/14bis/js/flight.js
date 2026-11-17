// ============================================================
// 14-BIS · Flight model — real-time approximation tuned to the
// historical machine and to the 2011 JATM CFD study.
// Pure module (no DOM / three) so it can be exercised in Node.
//
// Axes (aircraft convention): X span (right +), Y up, Z nose +.
// theta = pitch (nose up +), phi = roll (right wing down +),
// psi = yaw (nose right +).
//
// Aero basis: CLalpha = 4.85 /rad, drag polar
// CD = 0.089 - 0.206 CL + 0.252 CL^2 (clean CFD, JATM 2011).
// The clean polar is augmented with substantial parasite drag
// (struts, wires, curtains, pilot, basket, gear) — the reason
// the real 50 hp machine was so marginal.
// ============================================================
import { GEO } from './data.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const PHYS = {
  m: 290,                 // kg gross with pilot (Opdycke 290 kg; ~300 with fuel)
  g: 9.81,
  rho: 1.225,
  S: 52,                  // wing area m^2
  Sc: 8,                  // canard area m^2
  b: GEO.span,
  CL0: 0.18,              // rigging incidence ~2 deg
  CLa: 4.85,              // /rad  (JATM CFD)
  CLmax: 1.25,
  aStall: 11.5 * D2R,
  CD0: 0.14,              // clean CFD 0.089 + structure/pilot/gear interference
  k: 0.252,               // induced factor (JATM CFD)
  CLa_c: 3.0,             // canard lift slope /rad (box-kite + endplates: less effective than clean wing)
  elevMax: 12 * D2R,
  rudMax: 12 * D2R,
  ailMax: 20 * D2R,
  A_ail: 0.75,            // one octagonal aileron area m^2
  CLa_ail: 4.5,
  ailArm: 2.5 * GEO.cellWidth + GEO.centerGap / 2,   // 4.9 m
  canardArm: GEO.cgX - GEO.canard.x,                 // 6.3 m
  wingArm: (GEO.wingLE + GEO.chord * 0.38) - GEO.cgX, // AC ~0.95 m aft of CG
  P: 37000,               // Antoinette 8V, W
  rpmMax: 1500,
  rpmIdle: 300,
  Tstatic: 1350,          // N, paddle prop static thrust cap
  etaProp: 0.55,          // peak paddle-prop efficiency
  Ipitch: 1600, Iroll: 1300, Iyaw: 1900,
  Clb: -0.075,            // dihedral roll stability /rad (10 deg dihedral)
  Cnb: 0.045,             // weathercock (curtains) /rad
  Clp: -0.35, Cnr: -0.14,
  muRoll: 0.07,           // grass rolling resistance
  wheelR: 0.35,           // bicycle-wheel radius m
  wheelDrop: GEO.boomY,                       // 1.4 m below CG
  skidDrop: GEO.boomY + 0.35,                 // 1.75 m below CG
  skidZ: GEO.cgX - GEO.skidX - 0.15,          // ~6.45 m fwd of CG
  wheelZ: GEO.cgX - GEO.wheelX,               // -0.1 m
};

// rest pitch: wheels + nose skid both on the ground
const THETA_REST = Math.atan2(
  PHYS.skidDrop - PHYS.wheelDrop,
  PHYS.skidZ - PHYS.wheelZ
);
const groundHeight = (theta) => Math.max(
  PHYS.wheelDrop * Math.cos(theta) - PHYS.wheelZ * Math.sin(theta),
  PHYS.skidDrop * Math.cos(theta) - PHYS.skidZ * Math.sin(theta)
);

function wingCL(a) {
  if (a <= PHYS.aStall) return clamp(PHYS.CL0 + PHYS.CLa * a, -0.8, PHYS.CLmax);
  // post-stall decay (flat-plate behaviour)
  const t = clamp((a - PHYS.aStall) / (22 * D2R), 0, 1);
  return PHYS.CLmax - t * (PHYS.CLmax - 0.70);
}

export class FlightModel {
  constructor() { this.reset(); }

  reset() {
    const P = PHYS;
    this.pos = { x: 0, y: groundHeight(THETA_REST), z: 0 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.theta = THETA_REST; this.phi = 0; this.psi = 0;
    this.p = 0; this.q = 0; this.r = 0;
    this.rpm = 0; this.throttle = 0; this.engineOn = false;
    this.elev = 0; this.rud = 0; this.ail = 0;      // smoothed inputs -1..1
    this.onGround = true; this.crashed = false;
    this.airborneOnce = false;
    this.flightTime = 0; this.flightDist = 0; this.maxAlt = 0;
    this.groundRun = 0; this.totalTime = 0;
    this.liftoff = null; this.lastFlight = null;
    this.alpha = 0; this.beta = 0; this.Vair = 0; this.stalled = false;
    this.propAngle = 0; this.wheelAngle = 0;
    this.config = this.config || 'nov';
    this.events = [];   // consumed by app: 'liftoff','touchdown','crash','stall'
  }

  setConfig(c) { this.config = c; }

  get altitude() { return Math.max(0, this.pos.y - groundHeight(this.theta)); }
  get speedKmh() { return Math.hypot(this.vel.x, this.vel.z) * 3.6; }

  startEngine() { if (!this.crashed) this.engineOn = true; }
  stopEngine() { this.engineOn = false; }

  // inputs: {elev, rud, ail, throttle} in -1..1 / 0..1 ; wind: headwind m/s (+Z flight)
  step(inp, dt, wind = 0) {
    const P = PHYS;
    const sub = 1 / 240;
    let remaining = dt;
    while (remaining > 1e-6) {
      const h = Math.min(sub, remaining);
      remaining -= h;
      this._substep(inp, h, wind);
    }
  }

  _substep(inp, dt, wind) {
    const P = PHYS;
    if (this.crashed) {
      this.rpm = Math.max(0, this.rpm - 400 * dt);
      this.propAngle += this.rpm / 60 * 2 * Math.PI * dt * 0.2;
      return;
    }
    this.totalTime += dt;

    // --- smooth control inputs (cables are not instant) ---
    const rate = 3.2;
    this.elev += clamp(inp.elev - this.elev, -rate * dt, rate * dt);
    this.rud += clamp(inp.rud - this.rud, -rate * dt, rate * dt);
    this.ail += clamp(inp.ail - this.ail, -rate * dt, rate * dt);
    this.throttle += clamp(inp.throttle - this.throttle, -1.4 * dt, 1.4 * dt);

    // --- engine ---
    const rpmTarget = this.engineOn ? P.rpmIdle + (P.rpmMax - P.rpmIdle) * this.throttle : 0;
    const tau = rpmTarget > this.rpm ? 1.35 : 2.4;
    this.rpm += (rpmTarget - this.rpm) * Math.min(1, dt / tau);
    this.propAngle += this.rpm / 60 * 2 * Math.PI * dt;

    // --- air velocity in body axes ---
    const va = { x: this.vel.x, y: this.vel.y, z: this.vel.z + wind };
    const cpsi = Math.cos(this.psi), spsi = Math.sin(this.psi);
    const x1 = va.x * cpsi - va.z * spsi;
    const z1 = va.x * spsi + va.z * cpsi;
    const ct = Math.cos(this.theta), st = Math.sin(this.theta);
    const y2 = va.y * ct - z1 * st;
    const z2 = va.y * st + z1 * ct;
    const cp = Math.cos(this.phi), sp = Math.sin(this.phi);
    const vb = { x: x1 * cp - y2 * sp, y: x1 * sp + y2 * cp, z: z2 };
    const V = Math.max(0.01, Math.hypot(va.x, va.y, va.z));
    this.Vair = V;
    this.alpha = Math.atan2(-vb.y, Math.max(0.5, vb.z));
    this.beta = Math.atan2(vb.x, Math.max(0.5, vb.z));
    const qbar = 0.5 * P.rho * V * V;

    // --- control deflections ---
    const de = this.elev * P.elevMax;          // canard pitch (LE up +)
    const dr = -this.rud * P.rudMax;           // canard yaw (LE left for right turn)
    const da = this.ail * P.ailMax;            // aileron differential

    // --- lift & drag ---
    const CLw = wingCL(this.alpha);
    this.stalled = this.alpha > P.aStall && !this.onGround;
    const ac = clamp(this.alpha + de, -16 * D2R, 16 * D2R);
    const CLc = clamp(P.CLa_c * ac, -1.1, 1.1);
    // ground effect (JATM: flew mostly in ground effect)
    const hAGL = this.altitude;
    const ge = (16 * hAGL / P.b) ** 2 / (1 + (16 * hAGL / P.b) ** 2);
    const liftBonus = 1 + 0.08 * Math.exp(-hAGL / 2.5);
    const Lw = qbar * P.S * CLw * liftBonus;
    const Lc = qbar * P.Sc * CLc;
    const CDw = P.CD0 + P.k * ge * CLw * CLw;
    let Dw = qbar * P.S * CDw;
    const Dc = qbar * P.Sc * (0.09 + 0.25 * CLc * CLc);
    // aileron drag (Nov config only)
    const hasAil = this.config === 'nov';
    const ailDrag = hasAil ? 2 * qbar * P.A_ail * 1.15 * Math.sin(da) * Math.sin(da) : 0;
    Dw += ailDrag;

    // --- thrust (paddle prop: strong static thrust, power-limited at speed) ---
    const Tavail = Math.min(P.Tstatic, P.P * P.etaProp / (V + 3.0));
    const T = Tavail * Math.pow(this.rpm / P.rpmMax, 1.6);

    // --- side force (canard yaw + curtains) ---
    const Fx_c = Lc * Math.sin(-dr);           // push nose toward commanded turn
    const Fx_side = qbar * 6.0 * 0.8 * this.beta;

    // --- body forces -> world ---
    const Fb = {
      x: Fx_c + Fx_side,
      y: Lw + Lc * Math.cos(de),
      z: T - Dw - Dc,
    };
    // roll Rz(-phi)
    let fx = Fb.x * cp + Fb.y * sp;
    let fy = -Fb.x * sp + Fb.y * cp;
    let fz = Fb.z;
    // pitch Rx(-theta)
    const fy2 = fy * ct + fz * st;
    const fz2 = -fy * st + fz * ct;
    // yaw Ry(psi)
    const Fw = {
      x: fx * cpsi + fz2 * spsi,
      y: fy2,
      z: -fx * spsi + fz2 * cpsi,
    };
    Fw.y -= P.m * P.g;

    // --- moments (aircraft convention) ---
    let Frr = 0;
    const dampQ = qbar * (P.Sc * P.CLa_c * P.canardArm ** 2 + P.S * P.CLa * P.wingArm ** 2) / Math.max(V, 2) + 160;
    const Mpitch = Lc * P.canardArm - Lw * P.wingArm;
    const dampP = qbar * P.S * P.b * P.b / (2 * Math.max(V, 2)) * (-P.Clp) + 90;
    const dLail = hasAil ? qbar * P.A_ail * P.CLa_ail * da : 0;
    const Mroll = qbar * P.S * P.b * P.Clb * this.beta + 2 * dLail * P.ailArm;
    const dampR = qbar * P.S * P.b * P.b / (2 * Math.max(V, 2)) * (-P.Cnr)
      + qbar * P.Sc * P.CLa_c * P.canardArm ** 2 / Math.max(V, 2) * 0.5 + 130;
    const adverseYaw = hasAil ? -qbar * P.A_ail * 0.3 * 4 * Math.max(0, CLw) * P.CLa_ail * da * P.ailArm : 0;
    const Myaw = Fx_c * P.canardArm + qbar * P.S * P.b * P.Cnb * this.beta + adverseYaw;

    // --- integrate angular rates (implicit damping: stable) ---
    const integ = (rate, M, I, damp) => (rate + M / I * dt) / (1 + damp / I * dt);

    if (this.onGround) {
      // rotation about the wheel axle; skid holds the nose at rest angle
      const Mg = Lc * (P.canardArm - P.wheelZ) - Lw * (P.wingArm + P.wheelZ)
        - P.m * P.g * (-P.wheelZ) * Math.cos(this.theta);
      const Ig = P.Ipitch + 200;
      this.q = integ(this.q, Mg, Ig, dampQ + 400);
      this.theta += this.q * dt;
      if (this.theta <= THETA_REST) {
        this.theta = THETA_REST;
        if (this.q < 0) this.q = 0;
      }
      this.theta = Math.min(this.theta, 9.5 * D2R);
      // liftoff (rotated, or natural at high speed)
      if (Lw + Lc > P.m * P.g * (this.theta > THETA_REST + 1.2 * D2R ? 1.0 : 1.08) && V > 6) {
        this.onGround = false;
        this.vel.y = Math.max(this.vel.y, 0.25);
        this.liftoff = { x: this.pos.x, z: this.pos.z };
        this.flightTime = 0; this.flightDist = 0; this.maxAlt = 0;
        this.airborneOnce = true;
        this.events.push('liftoff');
      }
      // wheels keep her straight-ish; roll constrained by track
      this.p = integ(this.p, Mroll * 0.15, P.Iroll, dampP + 2500);
      this.phi = clamp(this.phi + this.p * dt, -4 * D2R, 4 * D2R);
      this.r = integ(this.r, Myaw, P.Iyaw + 400, dampR + 900);
      this.psi += this.r * dt;
      // ground rolling resistance (applied as a force below)
      const N = Math.max(0, P.m * P.g - (Lw + Lc));
      const brake = clamp(inp.brake || 0, 0, 1);
      Frr = (P.muRoll + brake * 0.55) * N;
      // lateral scrub (wheels resist sideslip)
      const lat = this.vel.x * Math.cos(this.psi) - this.vel.z * Math.sin(this.psi);
      const scrub = clamp(lat * 6 * dt, -Math.abs(lat), Math.abs(lat));
      this.vel.x -= scrub * Math.cos(this.psi);
      this.vel.z += scrub * Math.sin(this.psi);
      this.pos.y = groundHeight(this.theta);
      this.vel.y = 0;
      this.groundRun = Math.hypot(this.pos.x, this.pos.z);
    } else {
      this.q = integ(this.q, Mpitch, P.Ipitch, dampQ);
      this.p = integ(this.p, Mroll, P.Iroll, dampP);
      this.r = integ(this.r, Myaw, P.Iyaw, dampR);
      this.theta = clamp(this.theta + this.q * dt, -25 * D2R, 30 * D2R);
      this.phi += this.p * dt;
      this.psi += this.r * dt;
      this.flightTime += dt;
      if (this.liftoff) {
        this.flightDist = Math.hypot(this.pos.x - this.liftoff.x, this.pos.z - this.liftoff.z);
      }
      this.maxAlt = Math.max(this.maxAlt, this.altitude);
      // wingtip / prop strike
      if (this.altitude < 1.2 && Math.abs(this.phi) > 26 * D2R) {
        this._crash('Wingtip strike — the cells crumple into the grass.');
      }
    }

    // --- linear motion ---
    if (this.onGround) {
      const vG = Math.hypot(this.vel.x, this.vel.z);
      if (vG > 0.01) {
        Fw.x -= Frr * this.vel.x / vG;
        Fw.z -= Frr * this.vel.z / vG;
      }
    }
    this.vel.x += Fw.x / P.m * dt;
    this.vel.y += Fw.y / P.m * dt;
    this.vel.z += Fw.z / P.m * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;
    if (this.onGround) {
      const vG = Math.hypot(this.vel.x, this.vel.z);
      this.wheelAngle += vG / P.wheelR * dt;
      if (vG < 0.02 && T < Frr) { this.vel.x = 0; this.vel.z = 0; }
    }

    // --- ground contact ---
    if (!this.onGround) {
      const hMin = groundHeight(this.theta);
      if (this.pos.y <= hMin && this.vel.y <= 0) {
        const sink = -this.vel.y;
        const hard = sink > 3.2 || Math.abs(this.phi) > 13 * D2R || this.theta > 20 * D2R || this.theta < -6 * D2R;
        this.pos.y = hMin;
        this.onGround = true;
        this.vel.y = 0;
        this.p *= 0.2; this.q *= 0.2; this.r *= 0.3;
        this.lastFlight = {
          dist: this.flightDist, time: this.flightTime,
          maxAlt: this.maxAlt, speed: this.speedKmh,
        };
        if (hard) {
          this._crash(sink > 3.2
            ? 'Hard landing — the propeller splinters, as on 13 September 1906.'
            : 'Uneven touchdown — the wheel axles bend, as on 12 November.');
        } else {
          this.events.push('touchdown');
        }
      }
    }
    if (this.stalled && this.altitude < 1.5 && !this.onGround) {
      // mush into the ground
      this.vel.y -= 2.5 * dt;
    }
  }

  _crash(msg) {
    if (this.crashed) return;
    this.crashed = true;
    this.crashMsg = msg;
    this.engineOn = false;
    this.events.push('crash');
  }

  takeEvents() { const e = this.events; this.events = []; return e; }
}

export { THETA_REST, groundHeight };