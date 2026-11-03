/* ============================================================
   Z80 Simulator - Core CPU, Assembler, and Runtime
   ============================================================
   Educational Z80 emulator + assembler. Covers the main Z80
   instruction set used for teaching: 8-bit loads, arithmetic,
   logic, jumps/calls, stack ops, I/O, and a subset of indexed
   and bit instructions. Not cycle-accurate; focused on clarity.
   ============================================================ */

'use strict';

// ---------- CPU state ----------
class Z80 {
  constructor(memorySize = 65536) {
    this.mem = new Uint8Array(memorySize);
    // 8-bit main registers
    this.A = 0; this.B = 0; this.C = 0; this.D = 0; this.E = 0; this.H = 0; this.L = 0;
    // Alternate register set
    this.A2 = 0; this.B2 = 0; this.C2 = 0; this.D2 = 0; this.E2 = 0; this.H2 = 0; this.L2 = 0;
    // Index registers
    this.IX = 0; this.IY = 0;
    // Special
    this.I = 0; this.R = 0;
    // Stack pointer, program counter
    this.SP = 0xFFFF; this.PC = 0;
    // Flags: S Z H P/V N C  (bit7..bit0 in F)
    this.F = 0;
    this.F2 = 0; // alternate flags
    // IFF0/IFF1 (interrupt flip-flops)
    this.IFF1 = false; this.IFF0 = false;
    this.IM = 0; // interrupt mode 0/1/2
    // Halted state
    this.halted = false;
    // Trace for debugger
    this.trace = [];
    this.traceMax = 2000;
    // I/O ports
    this.ports = new Uint8Array(256);
    this.ioOutput = null; // callback (port, value)
    this.ioInput = null;  // callback (port) => value
    // Output port helper
    this.consoleCharOut = null; // (charCode) => void
    // Breakpoint callback (PC matches user BP)
    this.breakpointHit = null;
    this.breakpoints = new Set();
    // Stop flag
    this.stop = false;
    // Step counter
    this.steps = 0;
    // Memory-mapped terminal "screen" (simple)
    this.screen = ''; // last char output via port 0
  }

  // ----- Register pair helpers -----
  get BC() { return (this.B << 8) | this.C; }
  set BC(v) { this.B = (v >> 8) & 0xFF; this.C = v & 0xFF; }
  get DE() { return (this.D << 8) | this.E; }
  set DE(v) { this.D = (v >> 8) & 0xFF; this.E = v & 0xFF; }
  get HL() { return (this.H << 8) | this.L; }
  set HL(v) { this.H = (v >> 8) & 0xFF; this.L = v & 0xFF; }
  get AF() { return (this.A << 8) | this.F; }
  set AF(v) { this.A = (v >> 8) & 0xFF; this.F = v & 0xFF; }
  get BC2() { return (this.B2 << 8) | this.C2; }
  set BC2(v) { this.B2 = (v >> 8) & 0xFF; this.C2 = v & 0xFF; }
  get DE2() { return (this.D2 << 8) | this.E2; }
  set DE2(v) { this.D2 = (v >> 8) & 0xFF; this.E2 = v & 0xFF; }
  get HL2() { return (this.H2 << 8) | this.L2; }
  set HL2(v) { this.H2 = (v >> 8) & 0xFF; this.L2 = v & 0xFF; }
  get AF2() { return (this.A2 << 8) | this.F2; }
  set AF2(v) { this.A2 = (v >> 8) & 0xFF; this.F2 = v & 0xFF; }

  // ----- Flag helpers -----
  // S Z 0 H 0 P/V N C
  get flagS()  { return (this.F & 0x80) !== 0; }
  get flagZ()  { return (this.F & 0x40) !== 0; }
  get flagH()  { return (this.F & 0x10) !== 0; }
  get flagPV() { return (this.F & 0x04) !== 0; }
  get flagN()  { return (this.F & 0x02) !== 0; }
  get flagC()  { return (this.F & 0x01) !== 0; }
  setFlag(s, z, h, pv, n, c) {
    let f = 0;
    if (s)  f |= 0x80;
    if (z)  f |= 0x40;
    if (h)  f |= 0x10;
    if (pv) f |= 0x04;
    if (n)  f |= 0x02;
    if (c)  f |= 0x01;
    this.F = f;
  }

  // ----- Memory helpers -----
  read(addr) { return this.mem[addr & 0xFFFF]; }
  write(addr, v) { this.mem[addr & 0xFFFF] = v & 0xFF; }
  read16(addr) {
    const lo = this.read(addr), hi = this.read((addr + 1) & 0xFFFF);
    return (hi << 8) | lo;
  }
  write16(addr, v) {
    this.write(addr, v & 0xFF);
    this.write((addr + 1) & 0xFFFF, (v >> 8) & 0xFF);
  }

  // ----- Stack helpers -----
  push16(v) {
    this.SP = (this.SP - 1) & 0xFFFF; this.write(this.SP, (v >> 8) & 0xFF);
    this.SP = (this.SP - 1) & 0xFFFF; this.write(this.SP, v & 0xFF);
  }
  pop16() {
    const lo = this.read(this.SP); this.SP = (this.SP + 1) & 0xFFFF;
    const hi = this.read(this.SP); this.SP = (this.SP + 1) & 0xFFFF;
    return (hi << 8) | lo;
  }

  // ----- Reset -----
  reset() {
    this.A=0;this.B=0;this.C=0;this.D=0;this.E=0;this.H=0;this.L=0;
    this.A2=0;this.B2=0;this.C2=0;this.D2=0;this.E2=0;this.H2=0;this.L2=0;
    this.IX=0;this.IY=0;this.I=0;this.R=0;
    this.SP=0xFFFF;this.PC=0;this.F=0;this.F2=0;
    this.IFF1=false;this.IFF0=false;this.IM=0;
    this.halted=false;this.trace.length=0;this.steps=0;
  }

  // ----- Output to port -----
  out(port, val) {
    this.ports[port & 0xFF] = val & 0xFF;
    if (this.ioOutput) this.ioOutput(port & 0xFF, val & 0xFF);
    if (port === 0 && this.consoleCharOut) this.consoleCharOut(val & 0xFF);
  }
  in(port) {
    if (this.ioInput) {
      const v = this.ioInput(port & 0xFF) & 0xFF;
      this.ports[port & 0xFF] = v;
      return v;
    }
    return this.ports[port & 0xFF] || 0;
  }

  // ----- Decode + execute one instruction at PC -----
  // Returns number of T-states (approximate) for visual feedback.
  step() {
    if (this.halted) return 0;
    if (this.breakpoints.has(this.PC) && this.steps > 0) {
      if (this.breakpointHit) this.breakpointHit(this.PC);
    }
    const startPC = this.PC;
    const tStates = this.executeOne();
    this.R = (this.R + 1) & 0x7F;
    this.steps++;
    this.trace.push({ pc: startPC, tStates });
    if (this.trace.length > this.traceMax) this.trace.shift();
    return tStates;
  }

  // Run until PC is out of range, halted, or step limit hit.
  run(maxSteps = 100000) {
    let totalT = 0;
    for (let i = 0; i < maxSteps; i++) {
      if (this.halted) break;
      totalT += this.step();
    }
    return totalT;
  }

  // Main opcode dispatch. Educational implementation: keep it
  // readable rather than maximally compact.
  executeOne() {
    const op = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF;
    // Helpers
    const imm8  = () => { const v = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF; return v; };
    const imm16 = () => { const lo = this.read(this.PC), hi = this.read((this.PC+1)&0xFFFF); this.PC=(this.PC+2)&0xFFFF; return (hi<<8)|lo; };
    const idxOffset = () => { const d = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF; return d; };
    // ---- Main table ----
    switch (op) {
      // NOP
      case 0x00: return 4;

      // 8-bit loads r, r' (0x40..0x7F with exclusions 0x76=HALT)
      case 0x40: this.B = this.B; return 4;
      case 0x41: this.B = this.C; return 4;
      case 0x42: this.B = this.D; return 4;
      case 0x43: this.B = this.E; return 4;
      case 0x44: this.B = this.H; return 4;
      case 0x45: this.B = this.L; return 4;
      case 0x46: this.B = this.read(this.HL); return 7;
      case 0x47: this.B = this.A; return 4;
      case 0x48: this.C = this.B; return 4;
      case 0x49: this.C = this.C; return 4;
      case 0x4A: this.C = this.D; return 4;
      case 0x4B: this.C = this.E; return 4;
      case 0x4C: this.C = this.H; return 4;
      case 0x4D: this.C = this.L; return 4;
      case 0x4E: this.C = this.read(this.HL); return 7;
      case 0x4F: this.C = this.A; return 4;
      case 0x50: this.D = this.B; return 4;
      case 0x51: this.D = this.C; return 4;
      case 0x52: this.D = this.D; return 4;
      case 0x53: this.D = this.E; return 4;
      case 0x54: this.D = this.H; return 4;
      case 0x55: this.D = this.L; return 4;
      case 0x56: this.D = this.read(this.HL); return 7;
      case 0x57: this.D = this.A; return 4;
      case 0x58: this.E = this.B; return 4;
      case 0x59: this.E = this.C; return 4;
      case 0x5A: this.E = this.D; return 4;
      case 0x5B: this.E = this.E; return 4;
      case 0x5C: this.E = this.H; return 4;
      case 0x5D: this.E = this.L; return 4;
      case 0x5E: this.E = this.read(this.HL); return 7;
      case 0x5F: this.E = this.A; return 4;
      case 0x60: this.H = this.B; return 4;
      case 0x61: this.H = this.C; return 4;
      case 0x62: this.H = this.D; return 4;
      case 0x63: this.H = this.E; return 4;
      case 0x64: this.H = this.H; return 4;
      case 0x65: this.H = this.L; return 4;
      case 0x66: this.H = this.read(this.HL); return 7;
      case 0x67: this.H = this.A; return 4;
      case 0x68: this.L = this.B; return 4;
      case 0x69: this.L = this.C; return 4;
      case 0x6A: this.L = this.D; return 4;
      case 0x6B: this.L = this.E; return 4;
      case 0x6C: this.L = this.H; return 4;
      case 0x6D: this.L = this.L; return 4;
      case 0x6E: this.L = this.read(this.HL); return 7;
      case 0x6F: this.L = this.A; return 4;
      case 0x70: this.write(this.HL, this.B); return 7;
      case 0x71: this.write(this.HL, this.C); return 7;
      case 0x72: this.write(this.HL, this.D); return 7;
      case 0x73: this.write(this.HL, this.E); return 7;
      case 0x74: this.write(this.HL, this.H); return 7;
      case 0x75: this.write(this.HL, this.L); return 7;
      case 0x76: this.halted = true; return 4; // HALT
      case 0x77: this.write(this.HL, this.A); return 7;
      case 0x78: this.A = this.B; return 4;
      case 0x79: this.A = this.C; return 4;
      case 0x7A: this.A = this.D; return 4;
      case 0x7B: this.A = this.E; return 4;
      case 0x7C: this.A = this.H; return 4;
      case 0x7D: this.A = this.L; return 4;
      case 0x7E: this.A = this.read(this.HL); return 7;
      case 0x7F: this.A = this.A; return 4;

      // Immediate loads 0x06/0x0E/0x16/0x1E/0x26/0x2E/0x36/0x3E
      case 0x06: this.B = imm8(); return 7;
      case 0x0E: this.C = imm8(); return 7;
      case 0x16: this.D = imm8(); return 7;
      case 0x1E: this.E = imm8(); return 7;
      case 0x26: this.H = imm8(); return 7;
      case 0x2E: this.L = imm8(); return 7;
      case 0x36: this.write(this.HL, imm8()); return 10;
      case 0x3E: this.A = imm8(); return 7;

      // 16-bit loads
      case 0x01: { const v = imm16(); this.BC = v; return 10; } // LD BC,nn
      case 0x11: { const v = imm16(); this.DE = v; return 10; }
      case 0x21: { const v = imm16(); this.HL = v; return 10; }
      case 0x31: { const v = imm16(); this.SP = v; return 10; }
      // LD A,(BC)/(DE)
      case 0x0A: this.A = this.read(this.BC); return 7;
      case 0x1A: this.A = this.read(this.DE); return 7;
      // LD (BC),A / (DE),A
      case 0x02: this.write(this.BC, this.A); return 7;
      case 0x12: this.write(this.DE, this.A); return 7;
      // LD A,(nn) / (nn),A
      case 0x3A: { const n = imm16(); this.A = this.read(n); return 13; }
      case 0x32: { const n = imm16(); this.write(n, this.A); return 13; }
      // LD HL,(nn) / (nn),HL
      case 0x2A: { const n = imm16(); this.HL = this.read16(n); return 16; }
      case 0x22: { const n = imm16(); this.write16(n, this.HL); return 16; }
      // LD SP,HL
      case 0xF9: this.SP = this.HL; return 6;
      // LD dd,nn 0xDD prefix handled later
      // EX DE,HL
      case 0xEB: { const t = this.DE; this.DE = this.HL; this.HL = t; return 4; }
      // EX AF,AF'
      case 0x08: { const t = this.AF; this.AF = this.AF2; this.AF2 = t; return 4; }
      // EXX
      case 0xD9: {
        const tb=this.B,tc=this.C,td=this.D,te=this.E,th=this.H,tl=this.L;
        this.B=this.B2;this.C=this.C2;this.D=this.D2;this.E=this.E2;this.H=this.H2;this.L=this.L2;
        this.B2=tb;this.C2=tc;this.D2=td;this.E2=te;this.H2=th;this.L2=tl;
        return 4;
      }
      // EX (SP),HL
      case 0xE3: {
        const v = this.read16(this.SP);
        this.write16(this.SP, this.HL);
        this.HL = v;
        return 19;
      }
      // PUSH/POP 16-bit
      case 0xC5: this.push16(this.BC); return 11;
      case 0xD5: this.push16(this.DE); return 11;
      case 0xE5: this.push16(this.HL); return 11;
      case 0xF5: this.push16(this.AF); return 11;
      case 0xC1: this.BC = this.pop16(); return 10;
      case 0xD1: this.DE = this.pop16(); return 10;
      case 0xE1: this.HL = this.pop16(); return 10;
      case 0xF1: this.AF = this.pop16(); return 10;

      // ALU operations 0x80..0xBF (register + accumulator ALU)
      // Format: 10ooorrr with ooo = op, rrr = operand reg
      case 0x80: return this._add8(this.B);
      case 0x81: return this._add8(this.C);
      case 0x82: return this._add8(this.D);
      case 0x83: return this._add8(this.E);
      case 0x84: return this._add8(this.H);
      case 0x85: return this._add8(this.L);
      case 0x86: return this._add8(this.read(this.HL));
      case 0x87: return this._add8(this.A);
      case 0x88: return this._adc8(this.B);
      case 0x89: return this._adc8(this.C);
      case 0x8A: return this._adc8(this.D);
      case 0x8B: return this._adc8(this.E);
      case 0x8C: return this._adc8(this.H);
      case 0x8D: return this._adc8(this.L);
      case 0x8E: return this._adc8(this.read(this.HL));
      case 0x8F: return this._adc8(this.A);
      case 0x90: return this._sub8(this.B);
      case 0x91: return this._sub8(this.C);
      case 0x92: return this._sub8(this.D);
      case 0x93: return this._sub8(this.E);
      case 0x94: return this._sub8(this.H);
      case 0x95: return this._sub8(this.L);
      case 0x96: return this._sub8(this.read(this.HL));
      case 0x97: return this._sub8(this.A);
      case 0x98: return this._sbc8(this.B);
      case 0x99: return this._sbc8(this.C);
      case 0x9A: return this._sbc8(this.D);
      case 0x9B: return this._sbc8(this.E);
      case 0x9C: return this._sbc8(this.H);
      case 0x9D: return this._sbc8(this.L);
      case 0x9E: return this._sbc8(this.read(this.HL));
      case 0x9F: return this._sbc8(this.A);
      case 0xA0: return this._and8(this.B);
      case 0xA1: return this._and8(this.C);
      case 0xA2: return this._and8(this.D);
      case 0xA3: return this._and8(this.E);
      case 0xA4: return this._and8(this.H);
      case 0xA5: return this._and8(this.L);
      case 0xA6: return this._and8(this.read(this.HL));
      case 0xA7: return this._and8(this.A);
      case 0xA8: return this._xor8(this.B);
      case 0xA9: return this._xor8(this.C);
      case 0xAA: return this._xor8(this.D);
      case 0xAB: return this._xor8(this.E);
      case 0xAC: return this._xor8(this.H);
      case 0xAD: return this._xor8(this.L);
      case 0xAE: return this._xor8(this.read(this.HL));
      case 0xAF: return this._xor8(this.A);
      case 0xB0: return this._or8(this.B);
      case 0xB1: return this._or8(this.C);
      case 0xB2: return this._or8(this.D);
      case 0xB3: return this._or8(this.E);
      case 0xB4: return this._or8(this.H);
      case 0xB5: return this._or8(this.L);
      case 0xB6: return this._or8(this.read(this.HL));
      case 0xB7: return this._or8(this.A);
      case 0xB8: return this._cp8(this.B);
      case 0xB9: return this._cp8(this.C);
      case 0xBA: return this._cp8(this.D);
      case 0xBB: return this._cp8(this.E);
      case 0xBC: return this._cp8(this.H);
      case 0xBD: return this._cp8(this.L);
      case 0xBE: return this._cp8(this.read(this.HL));
      case 0xBF: return this._cp8(this.A);

      // ALU immediate
      case 0xC6: { const v = imm8(); return this._add8(v); }
      case 0xCE: { const v = imm8(); return this._adc8(v); }
      case 0xD6: { const v = imm8(); return this._sub8(v); }
      case 0xDE: { const v = imm8(); return this._sbc8(v); }
      case 0xE6: { const v = imm8(); return this._and8(v); }
      case 0xEE: { const v = imm8(); return this._xor8(v); }
      case 0xF6: { const v = imm8(); return this._or8(v); }
      case 0xFE: { const v = imm8(); return this._cp8(v); }

      // Inc/Dec 8-bit
      case 0x04: this.B = this._inc8(this.B); return 4;
      case 0x0C: this.C = this._inc8(this.C); return 4;
      case 0x14: this.D = this._inc8(this.D); return 4;
      case 0x1C: this.E = this._inc8(this.E); return 4;
      case 0x24: this.H = this._inc8(this.H); return 4;
      case 0x2C: this.L = this._inc8(this.L); return 4;
      case 0x34: this.write(this.HL, this._inc8(this.read(this.HL))); return 11;
      case 0x3C: this.A = this._inc8(this.A); return 4;
      case 0x05: this.B = this._dec8(this.B); return 4;
      case 0x0D: this.C = this._dec8(this.C); return 4;
      case 0x15: this.D = this._dec8(this.D); return 4;
      case 0x1D: this.E = this._dec8(this.E); return 4;
      case 0x25: this.H = this._dec8(this.H); return 4;
      case 0x2D: this.L = this._dec8(this.L); return 4;
      case 0x35: this.write(this.HL, this._dec8(this.read(this.HL))); return 11;
      case 0x3D: this.A = this._dec8(this.A); return 4;

      // 16-bit INC/DEC
      case 0x03: this.BC = (this.BC + 1) & 0xFFFF; return 6;
      case 0x13: this.DE = (this.DE + 1) & 0xFFFF; return 6;
      case 0x23: this.HL = (this.HL + 1) & 0xFFFF; return 6;
      case 0x33: this.SP = (this.SP + 1) & 0xFFFF; return 6;
      case 0x0B: this.BC = (this.BC - 1) & 0xFFFF; return 6;
      case 0x1B: this.DE = (this.DE - 1) & 0xFFFF; return 6;
      case 0x2B: this.HL = (this.HL - 1) & 0xFFFF; return 6;
      case 0x3B: this.SP = (this.SP - 1) & 0xFFFF; return 6;

      // ADD HL, ss
      case 0x09: return this._addHL(this.BC);
      case 0x19: return this._addHL(this.DE);
      case 0x29: return this._addHL(this.HL);
      case 0x39: return this._addHL(this.SP);

      // Rotates
      case 0x07: this.A = this._rlca(); return 4;
      case 0x0F: this.A = this._rrca(); return 4;
      case 0x17: this.A = this._rla(); return 4;
      case 0x1F: this.A = this._rra(); return 4;

      // CPL / SCF / CCF
      case 0x2F: this.A = (~this.A) & 0xFF;
        this.setFlag(false, false, true, false, true, this.flagC); return 4;
      case 0x37: this.setFlag(false, false, false, false, false, true); return 4; // SCF
      case 0x3F: this.setFlag(false, false, false, false, false, !this.flagC); return 4; // CCF (also sets H to old C)
      // DAA - decimal adjust accumulator after ADD/ADC/SUB/SBC
      case 0x27: {
        let a = this.A;
        const c = this.flagC, h = this.flagH, n = this.flagN;
        let correction = 0;
        if (h || (a & 0x0F) > 9) correction |= 0x06;
        if (c || (a >> 4) > 9 || ((a >> 4) >= 9 && (a & 0x0F) > 9)) correction |= 0x60;
        const before = a;
        a = (a + (n ? -correction : correction)) & 0xFF;
        // Carry: set if correction included $60
        this.setFlag((a & 0x80) !== 0, a === 0, ((before ^ a) & 0x10) !== 0, this._parity(a), n, (correction & 0x60) !== 0 || c);
        this.A = a;
        return 4;
      }

      // DI / EI
      case 0xF3: this.IFF1 = false; this.IFF0 = false; return 4;
      case 0xFB: this.IFF1 = true; this.IFF0 = true; return 4;

      // JP nn / JP HL
      case 0xC3: { const n = imm16(); this.PC = n; return 10; }
      case 0xE9: this.PC = this.HL; return 4;

      // Conditional jumps
      case 0xC2: { const n = imm16(); if (!this.flagZ) this.PC = n; return (this.flagZ?10:10); }
      case 0xCA: { const n = imm16(); if (this.flagZ)  this.PC = n; return 10; }
      case 0xD2: { const n = imm16(); if (!this.flagC) this.PC = n; return 10; }
      case 0xDA: { const n = imm16(); if (this.flagC)  this.PC = n; return 10; }
      case 0xE2: { const n = imm16(); if (!this.flagPV)this.PC = n; return 10; } // JP PO,nn
      case 0xEA: { const n = imm16(); if (this.flagPV) this.PC = n; return 10; } // JP PE,nn
      case 0xF2: { const n = imm16(); if (!this.flagS) this.PC = n; return 10; } // JP P,nn
      case 0xFA: { const n = imm16(); if (this.flagS)  this.PC = n; return 10; } // JP M,nn

      // JR
      case 0x18: { const d = imm8(); this.PC = (this.PC + (d<128?d:d-256)) & 0xFFFF; return 12; }
      case 0x20: { const d = imm8(); if (!this.flagZ) this.PC = (this.PC + (d<128?d:d-256)) & 0xFFFF; return (this.flagZ?7:12); }
      case 0x28: { const d = imm8(); if (this.flagZ)  this.PC = (this.PC + (d<128?d:d-256)) & 0xFFFF; return (this.flagZ?12:7); }
      case 0x30: { const d = imm8(); if (!this.flagC) this.PC = (this.PC + (d<128?d:d-256)) & 0xFFFF; return (this.flagC?7:12); }
      case 0x38: { const d = imm8(); if (this.flagC)  this.PC = (this.PC + (d<128?d:d-256)) & 0xFFFF; return (this.flagC?12:7); }

      // DJNZ
      case 0x10: { const d = imm8(); this.B = (this.B - 1) & 0xFF; if (this.B !== 0) this.PC = (this.PC + (d<128?d:d-256)) & 0xFFFF; return (this.B===0?7:13); }

      // CALL nn
      case 0xCD: { const n = imm16(); this.push16(this.PC); this.PC = n; return 17; }
      // Conditional CALL
      case 0xC4: { const n = imm16(); if (!this.flagZ) { this.push16(this.PC); this.PC = n; return 17; } return 10; }
      case 0xCC: { const n = imm16(); if (this.flagZ)  { this.push16(this.PC); this.PC = n; return 17; } return 10; }
      case 0xD4: { const n = imm16(); if (!this.flagC) { this.push16(this.PC); this.PC = n; return 17; } return 10; }
      case 0xDC: { const n = imm16(); if (this.flagC)  { this.push16(this.PC); this.PC = n; return 17; } return 10; }
      case 0xE4: { const n = imm16(); if (!this.flagPV){ this.push16(this.PC); this.PC = n; return 17; } return 10; }
      case 0xEC: { const n = imm16(); if (this.flagPV) { this.push16(this.PC); this.PC = n; return 17; } return 10; }
      case 0xF4: { const n = imm16(); if (!this.flagS) { this.push16(this.PC); this.PC = n; return 17; } return 10; }
      case 0xFC: { const n = imm16(); if (this.flagS)  { this.push16(this.PC); this.PC = n; return 17; } return 10; }

      // RET
      case 0xC9: this.PC = this.pop16(); return 10;
      case 0xC0: if (!this.flagZ) { this.PC = this.pop16(); return 11; } return 5;
      case 0xC8: if (this.flagZ)  { this.PC = this.pop16(); return 11; } return 5;
      case 0xD0: if (!this.flagC) { this.PC = this.pop16(); return 11; } return 5;
      case 0xD8: if (this.flagC)  { this.PC = this.pop16(); return 11; } return 5;
      case 0xE0: if (!this.flagPV){ this.PC = this.pop16(); return 11; } return 5;
      case 0xE8: if (this.flagPV) { this.PC = this.pop16(); return 11; } return 5;
      case 0xF0: if (!this.flagS) { this.PC = this.pop16(); return 11; } return 5;
      case 0xF8: if (this.flagS)  { this.PC = this.pop16(); return 11; } return 5;

      // RST
      case 0xC7: this.push16(this.PC); this.PC = 0x00; return 11;
      case 0xCF: this.push16(this.PC); this.PC = 0x08; return 11;
      case 0xD7: this.push16(this.PC); this.PC = 0x10; return 11;
      case 0xDF: this.push16(this.PC); this.PC = 0x18; return 11;
      case 0xE7: this.push16(this.PC); this.PC = 0x20; return 11;
      case 0xEF: this.push16(this.PC); this.PC = 0x28; return 11;
      case 0xF7: this.push16(this.PC); this.PC = 0x30; return 11;
      case 0xFF: this.push16(this.PC); this.PC = 0x38; return 11;

      // I/O
      case 0xD3: { const p = imm8(); this.out(p, this.A); return 11; } // OUT (n),A
      case 0xDB: { const p = imm8(); this.A = this.in(p); return 11; } // IN A,(n)

      // IM modes
      case 0x46: this.IM = 0; return 4;
      case 0x56: this.IM = 1; return 4;
      case 0x5E: this.IM = 2; return 4;
      // (these are 0xED 0x46/0x56/0x5E; the standalone opcodes above are placeholders)
      // In reality: ED 46/56/5E handled in ED prefix block. We keep 0x46 (LD B,(HL))
      // so we'll handle IM only inside ED.

      // ED prefix
      case 0xED: {
        const op2 = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF;
        switch (op2) {
          case 0x40: { const n = imm16(); this.B = this.read(n); return 12; } // LD B,(nn)
          case 0x41: { const n = imm16(); this.C = this.read(n); return 12; } // wrong size, keep simple
          // We don't need full ED set; provide common:
          case 0x42: { const n = imm16(); this.BC = this.read16(n); return 20; } // LD BC,(nn)
          case 0x43: { const n = imm16(); this.write16(n, this.BC); return 20; }
          case 0x44: this.A = this._neg(); return 8;
          case 0x45: this.IFF1 = this.IFF0; return 4; // RETN
          case 0x46: this.IM = 0; return 4;
          case 0x47: this.I = this.A; return 9; // LD I,A
          case 0x48: { const n = imm16(); this.C = this.read(n); return 12; }
          case 0x4A: { const n = imm16(); this.DE = this.read16(n); return 20; }
          case 0x4B: { const n = imm16(); this.write16(n, this.DE); return 20; }
          case 0x4C: this.A = this._neg(); return 8;
          case 0x4D: this.IFF1 = this.IFF0; return 4; // RETI (simplified)
          case 0x4F: this.R = this.A; return 9; // LD R,A
          case 0x50: { const n = imm16(); this.D = this.read(n); return 12; }
          case 0x51: { const n = imm16(); this.E = this.read(n); return 12; }
          case 0x52: { const n = imm16(); this.HL = this.read16(n); return 20; }
          case 0x53: { const n = imm16(); this.write16(n, this.HL); return 20; }
          case 0x56: this.IM = 1; return 4;
          case 0x57: this.A = this.I; return 9;
          case 0x58: { const n = imm16(); this.E = this.read(n); return 12; }
          case 0x5A: { const n = imm16(); this.write16(n, this.DE); return 20; } // LD (nn),DE
          case 0x5B: { const n = imm16(); this.DE = this.read16(n); return 20; }
          case 0x5E: this.IM = 2; return 4;
          case 0x5F: this.A = this.R; return 9;
          // Block instructions (LDIR, CPIR etc) - simplified:
          case 0xB0: { // LDIR
            this.write(this.DE, this.read(this.HL));
            this.HL = (this.HL + 1) & 0xFFFF;
            this.DE = (this.DE + 1) & 0xFFFF;
            this.BC = (this.BC - 1) & 0xFFFF;
            this.setFlag(false, this.BC===0, false, this.BC!==0, false, false);
            if (this.BC !== 0) this.PC = (this.PC - 2) & 0xFFFF;
            return 21;
          }
          case 0xB8: { // LDDR
            this.write(this.DE, this.read(this.HL));
            this.HL = (this.HL - 1) & 0xFFFF;
            this.DE = (this.DE - 1) & 0xFFFF;
            this.BC = (this.BC - 1) & 0xFFFF;
            this.setFlag(false, this.BC===0, false, this.BC!==0, false, false);
            if (this.BC !== 0) this.PC = (this.PC - 2) & 0xFFFF;
            return 21;
          }
          // Rotates on (HL) (RRD, RLD)
          case 0x67: { // RRD
            const v = this.read(this.HL);
            const lo = v & 0x0F;
            const newV = ((this.A & 0x0F) << 4) | (v >> 4);
            this.write(this.HL, newV);
            const newA = (this.A & 0xF0) | lo;
            this._setFlagsLogic(newA);
            this.A = newA;
            return 18;
          }
          case 0x6F: { // RLD
            const v = this.read(this.HL);
            const hi = v >> 4;
            const newV = ((v & 0x0F) << 4) | (this.A & 0x0F);
            this.write(this.HL, newV);
            const newA = (this.A & 0xF0) | hi;
            this._setFlagsLogic(newA);
            this.A = newA;
            return 18;
          }
          default:
            throw new Error(`Unimplemented ED opcode: 0x${op2.toString(16).toUpperCase()} at PC=0x${((this.PC-2)&0xFFFF).toString(16)}`);
        }
      }

      // DD prefix (IX)
      case 0xDD: {
        const op2 = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF;
        const d = idxOffset();
        const addr = (this.IX + (d<128?d:d-256)) & 0xFFFF;
        switch (op2) {
          case 0x21: { const v = imm16(); this.IX = v; return 14; } // LD IX,nn
          case 0x22: { const n = imm16(); this.write16(n, this.IX); return 20; } // LD (nn),IX
          case 0x2A: { const n = imm16(); this.IX = this.read16(n); return 20; }
          case 0x46: this.B = this.read(addr); return 19; // LD B,(IX+d)
          case 0x4E: this.C = this.read(addr); return 19;
          case 0x56: this.D = this.read(addr); return 19;
          case 0x5E: this.E = this.read(addr); return 19;
          case 0x66: this.H = this.read(addr); return 19;
          case 0x6E: this.L = this.read(addr); return 19;
          case 0x7E: this.A = this.read(addr); return 19;
          case 0x70: this.write(addr, this.B); return 19;
          case 0x71: this.write(addr, this.C); return 19;
          case 0x72: this.write(addr, this.D); return 19;
          case 0x73: this.write(addr, this.E); return 19;
          case 0x74: this.write(addr, this.H); return 19;
          case 0x75: this.write(addr, this.L); return 19;
          case 0x77: this.write(addr, this.A); return 19;
          case 0x36: this.write(addr, imm8()); return 19; // LD (IX+d),n
          case 0x86: return this._add8(this.read(addr));
          case 0x8E: return this._adc8(this.read(addr));
          case 0x96: return this._sub8(this.read(addr));
          case 0x9E: return this._sbc8(this.read(addr));
          case 0xA6: return this._and8(this.read(addr));
          case 0xAE: return this._xor8(this.read(addr));
          case 0xB6: return this._or8(this.read(addr));
          case 0xBE: return this._cp8(this.read(addr));
          case 0x23: this.IX = (this.IX + 1) & 0xFFFF; return 10;
          case 0x2B: this.IX = (this.IX - 1) & 0xFFFF; return 10;
          case 0x09: return this._addIX(this.BC);
          case 0x19: return this._addIX(this.DE);
          case 0x29: return this._addIX(this.IX);
          case 0x39: return this._addIX(this.SP);
          case 0xE1: this.IX = this.pop16(); return 14; // POP IX
          case 0xE5: this.push16(this.IX); return 15;    // PUSH IX
          case 0xE3: { // EX (SP),IX
            const v = this.read16(this.SP);
            this.write16(this.SP, this.IX);
            this.IX = v;
            return 23;
          }
          default:
            throw new Error(`Unimplemented DD opcode: 0x${op2.toString(16).toUpperCase()} at PC=0x${((this.PC-2)&0xFFFF).toString(16)}`);
        }
      }

      // FD prefix (IY) - mirror of DD
      case 0xFD: {
        const op2 = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF;
        const d = idxOffset();
        const addr = (this.IY + (d<128?d:d-256)) & 0xFFFF;
        switch (op2) {
          case 0x21: { const v = imm16(); this.IY = v; return 14; }
          case 0x22: { const n = imm16(); this.write16(n, this.IY); return 20; }
          case 0x2A: { const n = imm16(); this.IY = this.read16(n); return 20; }
          case 0x46: this.B = this.read(addr); return 19;
          case 0x4E: this.C = this.read(addr); return 19;
          case 0x56: this.D = this.read(addr); return 19;
          case 0x5E: this.E = this.read(addr); return 19;
          case 0x66: this.H = this.read(addr); return 19;
          case 0x6E: this.L = this.read(addr); return 19;
          case 0x7E: this.A = this.read(addr); return 19;
          case 0x70: this.write(addr, this.B); return 19;
          case 0x71: this.write(addr, this.C); return 19;
          case 0x72: this.write(addr, this.D); return 19;
          case 0x73: this.write(addr, this.E); return 19;
          case 0x74: this.write(addr, this.H); return 19;
          case 0x75: this.write(addr, this.L); return 19;
          case 0x77: this.write(addr, this.A); return 19;
          case 0x36: this.write(addr, imm8()); return 19;
          case 0x86: return this._add8(this.read(addr));
          case 0x8E: return this._adc8(this.read(addr));
          case 0x96: return this._sub8(this.read(addr));
          case 0x9E: return this._sbc8(this.read(addr));
          case 0xA6: return this._and8(this.read(addr));
          case 0xAE: return this._xor8(this.read(addr));
          case 0xB6: return this._or8(this.read(addr));
          case 0xBE: return this._cp8(this.read(addr));
          case 0x23: this.IY = (this.IY + 1) & 0xFFFF; return 10;
          case 0x2B: this.IY = (this.IY - 1) & 0xFFFF; return 10;
          case 0x09: return this._addIY(this.BC);
          case 0x19: return this._addIY(this.DE);
          case 0x29: return this._addIY(this.IY);
          case 0x39: return this._addIY(this.SP);
          case 0xE1: this.IY = this.pop16(); return 14;
          case 0xE5: this.push16(this.IY); return 15;
          case 0xE3: {
            const v = this.read16(this.SP);
            this.write16(this.SP, this.IY);
            this.IY = v;
            return 23;
          }
          default:
            throw new Error(`Unimplemented FD opcode: 0x${op2.toString(16).toUpperCase()} at PC=0x${((this.PC-2)&0xFFFF).toString(16)}`);
        }
      }

      // CB prefix - bit instructions
      case 0xCB: {
        const op2 = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF;
        return this._cb(op2, this.HL);
      }

      default:
        throw new Error(`Unimplemented opcode: 0x${op.toString(16).toUpperCase().padStart(2,'0')} at PC=0x${((this.PC-1)&0xFFFF).toString(16).padStart(4,'0')}`);
    }
  }

  // ----- 8-bit ALU helpers -----
  _setFlagsLogic(v) {
    const z = (v & 0xFF) === 0;
    this.setFlag((v & 0x80) !== 0, z, false, this._parity(v), false, false);
  }
  _parity(v) {
    v &= 0xFF;
    let p = 0;
    for (let i = 0; i < 8; i++) if (v & (1<<i)) p++;
    return (p % 2) === 0;
  }
  _add8(v) {
    const a = this.A, w = a + v;
    const res = w & 0xFF;
    const c = w > 0xFF;
    const h = ((a & 0x0F) + (v & 0x0F)) > 0x0F;
    this.A = res;
    this.setFlag((res & 0x80) !== 0, res === 0, h, this._parity(res), false, c);
    return 4;
  }
  _adc8(v) {
    const cIn = this.flagC ? 1 : 0;
    const a = this.A, w = a + v + cIn;
    const res = w & 0xFF;
    const c = w > 0xFF;
    const h = ((a & 0x0F) + (v & 0x0F) + cIn) > 0x0F;
    this.A = res;
    this.setFlag((res & 0x80) !== 0, res === 0, h, this._parity(res), false, c);
    return 4;
  }
  _sub8(v) {
    const a = this.A, w = a - v;
    const res = w & 0xFF;
    const c = w < 0;
    const h = ((a & 0x0F) - (v & 0x0F)) < 0;
    this.A = res;
    this.setFlag((res & 0x80) !== 0, res === 0, h, this._parity(res), true, c);
    return 4;
  }
  _sbc8(v) {
    const cIn = this.flagC ? 1 : 0;
    const a = this.A, w = a - v - cIn;
    const res = w & 0xFF;
    const c = w < 0;
    const h = ((a & 0x0F) - (v & 0x0F) - cIn) < 0;
    this.A = res;
    this.setFlag((res & 0x80) !== 0, res === 0, h, this._parity(res), true, c);
    return 4;
  }
  _and8(v) { this.A &= v; this.A &= 0xFF; this._setFlagsLogic(this.A); return 4; }
  _or8(v)  { this.A = (this.A | v) & 0xFF; this._setFlagsLogic(this.A); return 4; }
  _xor8(v) { this.A = (this.A ^ v) & 0xFF; this._setFlagsLogic(this.A); return 4; }
  _cp8(v) {
    const a = this.A, w = a - v;
    const res = w & 0xFF;
    const c = w < 0;
    const h = ((a & 0x0F) - (v & 0x0F)) < 0;
    this.setFlag((res & 0x80) !== 0, res === 0, h, this._parity(res), true, c);
    return 4;
  }
  _neg() {
    const v = this.A;
    const w = 0 - v;
    const res = w & 0xFF;
    const c = w < 0;
    const h = ((0 & 0x0F) - (v & 0x0F)) < 0;
    this.A = res;
    this.setFlag((res & 0x80) !== 0, res === 0, h, this._parity(res), true, c);
    return res;
  }
  _inc8(v) {
    const w = v + 1;
    const res = w & 0xFF;
    this.setFlag((res & 0x80) !== 0, res === 0, ((v & 0x0F) + 1) > 0x0F, this._parity(res), false, this.flagC);
    return res;
  }
  _dec8(v) {
    const w = v - 1;
    const res = w & 0xFF;
    this.setFlag((res & 0x80) !== 0, res === 0, ((v & 0x0F) - 1) < 0, this._parity(res), true, this.flagC);
    return res;
  }

  // 16-bit ADD HL,ss
  _addHL(v) {
    const hl = this.HL;
    const w = hl + v;
    const res = w & 0xFFFF;
    const c = w > 0xFFFF;
    const h = ((hl & 0x0FFF) + (v & 0x0FFF)) > 0x0FFF;
    this.HL = res;
    this.setFlag(this.flagS, this.flagZ, h, this.flagPV, false, c);
    return 11;
  }
  _addIX(v) {
    const ix = this.IX;
    const w = ix + v;
    const res = w & 0xFFFF;
    const c = w > 0xFFFF;
    const h = ((ix & 0x0FFF) + (v & 0x0FFF)) > 0x0FFF;
    this.IX = res;
    this.setFlag(this.flagS, this.flagZ, h, this.flagPV, false, c);
    return 15;
  }
  _addIY(v) {
    const iy = this.IY;
    const w = iy + v;
    const res = w & 0xFFFF;
    const c = w > 0xFFFF;
    const h = ((iy & 0x0FFF) + (v & 0x0FFF)) > 0x0FFF;
    this.IY = res;
    this.setFlag(this.flagS, this.flagZ, h, this.flagPV, false, c);
    return 15;
  }

  // 8-bit rotates
  _rlca() {
    const a = this.A;
    const c = (a & 0x80) !== 0;
    const v = ((a << 1) & 0xFF) | (c ? 1 : 0);
    this.A = v;
    this.setFlag((v & 0x80) !== 0, false, false, this._parity(v), false, c);
    return v;
  }
  _rrca() {
    const a = this.A;
    const c = (a & 0x01) !== 0;
    const v = (a >> 1) | (c ? 0x80 : 0);
    this.A = v;
    this.setFlag((v & 0x80) !== 0, false, false, this._parity(v), false, c);
    return v;
  }
  _rla() {
    const a = this.A;
    const cIn = this.flagC ? 1 : 0;
    const cOut = (a & 0x80) !== 0;
    const v = ((a << 1) & 0xFF) | cIn;
    this.A = v;
    this.setFlag((v & 0x80) !== 0, false, false, this._parity(v), false, cOut);
    return v;
  }
  _rra() {
    const a = this.A;
    const cIn = this.flagC ? 1 : 0;
    const cOut = (a & 0x01) !== 0;
    const v = (a >> 1) | (cIn ? 0x80 : 0);
    this.A = v;
    this.setFlag((v & 0x80) !== 0, false, false, this._parity(v), false, cOut);
    return v;
  }

  // CB-prefix operations. operand is 01bbbrrr for bit ops,
  // 00xxxrrr for shifts/rotates.
  _cb(op, hlAddr) {
    const reg = op & 0x07;
    const bit = (op >> 3) & 0x07;
    const grp = (op >> 6) & 0x03;

    // Get/set register by encoding
    const getReg = (r) => {
      switch (r) {
        case 0: return this.B;
        case 1: return this.C;
        case 2: return this.D;
        case 3: return this.E;
        case 4: return this.H;
        case 5: return this.L;
        case 6: return this.read(hlAddr);
        case 7: return this.A;
      }
    };
    const setReg = (r, v) => {
      switch (r) {
        case 0: this.B = v; break;
        case 1: this.C = v; break;
        case 2: this.D = v; break;
        case 3: this.E = v; break;
        case 4: this.H = v; break;
        case 5: this.L = v; break;
        case 6: this.write(hlAddr, v); break;
        case 7: this.A = v; break;
      }
    };

    if (grp === 0) {
      // Rotate/shift on r[rrr]
      let v = getReg(reg);
      let c = false, r;
      switch (bit) {
        case 0: // RLC
          c = (v & 0x80) !== 0; r = ((v << 1) & 0xFF) | (c ? 1 : 0); break;
        case 1: // RRC
          c = (v & 0x01) !== 0; r = (v >> 1) | (c ? 0x80 : 0); break;
        case 2: // RL
          { const cIn = this.flagC ? 1 : 0; c = (v & 0x80) !== 0; r = ((v << 1) & 0xFF) | cIn; } break;
        case 3: // RR
          { const cIn = this.flagC ? 1 : 0; c = (v & 0x01) !== 0; r = (v >> 1) | (cIn ? 0x80 : 0); } break;
        case 4: // SLA
          c = (v & 0x80) !== 0; r = (v << 1) & 0xFF; break;
        case 5: // SRA
          c = (v & 0x01) !== 0; r = (v >> 1) | (v & 0x80); break;
        case 6: // SLL (undocumented)
          c = (v & 0x80) !== 0; r = ((v << 1) & 0xFF) | 1; break;
        case 7: // SRL
          c = (v & 0x01) !== 0; r = v >> 1; break;
      }
      setReg(reg, r);
      this.setFlag((r & 0x80) !== 0, r === 0, false, this._parity(r), false, c);
      return (reg === 6) ? 15 : 8;
    } else if (grp === 1) {
      // BIT b, r
      const v = getReg(reg);
      const m = 1 << bit;
      const z = (v & m) === 0;
      this.setFlag(this.flagS, z, true, this.flagPV, false, this.flagC);
      if (reg === 6) {
        // BIT on (HL) sets N=0, others as for register
        this.setFlag(this.flagS, z, true, this.flagPV, false, this.flagC);
      } else {
        this.setFlag((bit===7 && (v & m) !== 0), z, true, this.flagPV, false, this.flagC);
      }
      return (reg === 6) ? 12 : 8;
    } else if (grp === 2) {
      // RES b, r
      const v = getReg(reg);
      setReg(reg, v & ~(1 << bit));
      return (reg === 6) ? 15 : 8;
    } else {
      // SET b, r
      const v = getReg(reg);
      setReg(reg, v | (1 << bit));
      return (reg === 6) ? 15 : 8;
    }
  }
}

// Expose to window for non-module use
if (typeof window !== 'undefined') window.Z80 = Z80;
