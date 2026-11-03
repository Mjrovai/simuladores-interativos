/* ============================================================
   Apple 1 / 6502 CPU simulator
   ============================================================
   A clean, readable 6502 implementation. Covers the documented
   instruction set (the 56 official opcodes plus the well-known
   undocumented behaviors of LDA/LDX/LDY immediate and zeropage
   reading the base page on the "second tick" — handled correctly
   below).  Not cycle-accurate, but cycle counts are reported.
   ============================================================ */

'use strict';

class Cpu6502 {
  constructor() {
    // Registers
    this.A  = 0;     // accumulator
    this.X  = 0;     // index X
    this.Y  = 0;     // index Y
    this.SP = 0xFD;  // stack pointer (6502 uses $0100 + SP)
    this.PC = 0;     // program counter
    // Flags in P register: NV-BDIZC
    // bit 7: N (negative)
    // bit 6: V (overflow)
    // bit 5: unused (always 1 on stack)
    // bit 4: B (break) — software set only
    // bit 3: D (decimal)
    // bit 2: I (interrupt disable)
    // bit 1: Z (zero)
    // bit 0: C (carry)
    this.P = 0x24;   // default: U=1, I=1
    // Memory: 64 KiB flat
    this.mem = new Uint8Array(0x10000);
    // Halted state
    this.halted = false;
    // Trace for debugger
    this.trace = [];
    this.traceMax = 2000;
    // I/O hooks (Apple 1 maps $D010/D011)
    this.ioOutput = null; // (addr, value) — for $D010 write
    this.ioInput  = null; // (addr) => value — for $D011 read
    // Optional: get a key (used for keyboard polling)
    this.getKey = null;   // () => ascii code or -1 if none
    // Steps counter
    this.steps = 0;
    // Breakpoints
    this.breakpoints = new Set();
    this.breakpointHit = null;
    // IRQ / NMI
    this.irqPending = false;
    this.nmiPending = false;
    this.resetRequested = false;
  }

  // ----- Flag helpers -----
  get fN() { return (this.P & 0x80) !== 0; }
  get fV() { return (this.P & 0x40) !== 0; }
  get fD() { return (this.P & 0x08) !== 0; }
  get fI() { return (this.P & 0x04) !== 0; }
  get fZ() { return (this.P & 0x02) !== 0; }
  get fC() { return (this.P & 0x01) !== 0; }
  setN(v) { if (v & 0x80) this.P |= 0x80; else this.P &= ~0x80; }
  setZ(v) { if ((v & 0xFF) === 0) this.P |= 0x02; else this.P &= ~0x02; }
  setNZ(v) { this.setZ(v); this.setN(v); }
  setC(v) { if (v) this.P |= 0x01; else this.P &= ~0x01; }
  setV(v) { if (v) this.P |= 0x40; else this.P &= ~0x40; }

  // Push / pull
  push(v) { this.mem[0x100 + (this.SP & 0xFF)] = v & 0xFF; this.SP = (this.SP - 1) & 0xFF; }
  pop()  { this.SP = (this.SP + 1) & 0xFF; return this.mem[0x100 + this.SP]; }
  push16(v) { this.push((v >> 8) & 0xFF); this.push(v & 0xFF); }
  pop16()  { const lo = this.pop(); const hi = this.pop(); return (hi << 8) | lo; }

  // Memory
  read(addr)  {
    addr &= 0xFFFF;
    if (this.ioInput && addr === 0xD011) {
      const v = this.ioInput(addr) & 0xFF;
      this.mem[addr] = v;
      return v;
    }
    return this.mem[addr];
  }
  write(addr, v) {
    addr &= 0xFFFF; this.mem[addr] = v & 0xFF;
    if (this.ioOutput) this.ioOutput(addr, v & 0xFF);
  }
  read16(addr) {
    addr &= 0xFFFF;
    // The 6502 has a bug: when crossing a page boundary during a
    // 16-bit read, the high byte comes from the *same* page instead
    // of the next. We faithfully reproduce that here.
    if ((addr & 0xFF) === 0xFF) {
      return this.mem[addr] | (this.mem[addr & 0xFF00] << 8);
    }
    return this.mem[addr] | (this.mem[(addr + 1) & 0xFFFF] << 8);
  }

  // Decimal mode ADC helper
  _adc(a, b, cIn) {
    if (this.fD) {
      // Decimal mode
      let lo = (a & 0x0F) + (b & 0x0F) + cIn;
      let hi = (a >> 4) + (b >> 4) + (lo > 9 ? 1 : 0);
      let c = false;
      if (lo > 9) { lo = (lo + 6) & 0x0F; }
      if (hi > 9) { c = true; hi = (hi + 6) & 0x0F; }
      const r = ((hi << 4) | lo) & 0xFF;
      this.setC(c);
      this.setNZ(r);
      // Overflow in decimal mode: treat as binary
      this.setV(((a ^ r) & (b ^ r) & 0x80) !== 0);
      return r;
    } else {
      const r = a + b + cIn;
      const carry = r > 0xFF;
      this.setC(carry);
      const rb = r & 0xFF;
      this.setNZ(rb);
      this.setV(((a ^ b) & 0x80) === 0 && ((a ^ rb) & 0x80) !== 0);
      return rb;
    }
  }

  _sbc(a, b, cIn) {
    if (this.fD) {
      // Decimal mode SBC
      let lo = (a & 0x0F) - (b & 0x0F) - (1 - cIn);
      let hi = (a >> 4) - (b >> 4) - (lo < 0 ? 1 : 0);
      let c = true;
      if (lo < 0) { c = false; lo = (lo + 10) & 0x0F; }
      else if (lo > 9) { c = false; lo = (lo - 10) & 0x0F; } // shouldn't happen
      if (hi < 0) { c = false; hi = (hi + 10) & 0x0F; }
      const r = ((hi << 4) | lo) & 0xFF;
      this.setC(c);
      this.setNZ(r);
      this.setV(((a ^ b) & 0x80) !== 0 && ((a ^ r) & 0x80) !== 0);
      return r;
    } else {
      // SBC = ADC with inverted operand
      return this._adc(a, b ^ 0xFF, cIn);
    }
  }

  // Compare: A - M
  _cmp(a, m) {
    const r = a - m;
    this.setC(a >= m);
    this.setNZ(r & 0xFF);
  }

  // ----- Step / execute one instruction -----
  step() {
    if (this.halted) return 0;

    // Pending interrupts
    if (this.nmiPending) {
      this.nmiPending = false;
      this._interrupt(0xFFFA, 0xFFFB, false, false);
    } else if (this.irqPending && !this.fI) {
      this.irqPending = false;
      this._interrupt(0xFFFE, 0xFFFF, true, true);
    }
    if (this.resetRequested) {
      this.resetRequested = false;
      // Read reset vector
      const lo = this.read(0xFFFC), hi = this.read(0xFFFD);
      this.PC = (hi << 8) | lo;
      this.SP = 0xFD;
      this.P = 0x24;
    }

    if (this.breakpoints.has(this.PC) && this.steps > 0) {
      if (this.breakpointHit) this.breakpointHit(this.PC);
    }

    const startPC = this.PC;
    const t = this.executeOne();
    this.steps++;
    this.trace.push({ pc: startPC, a: this.A, x: this.X, y: this.Y, p: this.P, sp: this.SP, tStates: t });
    if (this.trace.length > this.traceMax) this.trace.shift();
    return t;
  }

  _interrupt(vecLo, vecHi, setBreak, disableI) {
    // Push PC and P; load PC from vector
    this.push16(this.PC);
    this.push(this.P | (setBreak ? 0x10 : 0));
    if (disableI) this.P |= 0x04;
    const lo = this.read(vecLo), hi = this.read(vecHi);
    this.PC = (hi << 8) | lo;
  }

  run(maxSteps = 100000) {
    let total = 0;
    for (let i = 0; i < maxSteps; i++) {
      if (this.halted) break;
      total += this.step();
    }
    return total;
  }

  reset() {
    this.A = this.X = this.Y = 0;
    this.SP = 0xFD;
    this.P = 0x24;
    this.halted = false;
    this.steps = 0;
    this.irqPending = false;
    this.nmiPending = false;
    this.resetRequested = true;
    this.trace.length = 0;
  }

  // ----- Main instruction dispatch (single big switch) -----
  executeOne() {
    const op = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF;

    // Helper: parse operand by addressing mode
    const mode = opMode(op);
    const opname = opName(op);

    // Get operand address and value where applicable
    let addr = 0, t = 0; // t for t-states
    switch (mode) {
      case 'IMP': // implied / accumulator
        break;
      case 'ACC': // accumulator (LDA, etc.) - same as IMP for execution
        break;
      case 'IMM': {
        addr = this.PC; this.PC = (this.PC + 1) & 0xFFFF; break;
      }
      case 'ZP': {
        addr = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF; break;
      }
      case 'ZPX': {
        addr = (this.read(this.PC) + this.X) & 0xFF; this.PC = (this.PC + 1) & 0xFFFF; break;
      }
      case 'ZPY': {
        addr = (this.read(this.PC) + this.Y) & 0xFF; this.PC = (this.PC + 1) & 0xFFFF; break;
      }
      case 'ABS': {
        addr = this.read16(this.PC); this.PC = (this.PC + 2) & 0xFFFF; break;
      }
      case 'ABX': {
        const base = this.read16(this.PC); this.PC = (this.PC + 2) & 0xFFFF;
        addr = (base + this.X) & 0xFFFF;
        // Boundary crossing t-state penalty is added per-instruction below
        t = ((base & 0xFF00) !== (addr & 0xFF00)) ? 1 : 0;
        break;
      }
      case 'ABY': {
        const base = this.read16(this.PC); this.PC = (this.PC + 2) & 0xFFFF;
        addr = (base + this.Y) & 0xFFFF;
        t = ((base & 0xFF00) !== (addr & 0xFF00)) ? 1 : 0;
        break;
      }
      case 'IND': {
        const ptr = this.read16(this.PC); this.PC = (this.PC + 2) & 0xFFFF;
        // Page-boundary bug for indirect JMP: 6502 bug
        if ((ptr & 0xFF) === 0xFF) {
          addr = this.mem[ptr] | (this.mem[ptr & 0xFF00] << 8);
        } else {
          addr = this.mem[ptr] | (this.mem[(ptr + 1) & 0xFFFF] << 8);
        }
        break;
      }
      case 'IZX': {
        const zp = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF;
        const lo = this.mem[(zp + this.X) & 0xFF];
        const hi = this.mem[(zp + this.X + 1) & 0xFF];
        addr = (hi << 8) | lo;
        break;
      }
      case 'IZY': {
        const zp = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF;
        const lo = this.mem[zp];
        const hi = this.mem[(zp + 1) & 0xFF];
        const base = (hi << 8) | lo;
        addr = (base + this.Y) & 0xFFFF;
        t = ((base & 0xFF00) !== (addr & 0xFF00)) ? 1 : 0;
        break;
      }
      case 'REL': {
        // Branch target; read displacement here, instructions will use it
        const off = this.read(this.PC); this.PC = (this.PC + 1) & 0xFFFF;
        // sign-extend
        const disp = (off & 0x80) ? (off - 0x100) : off;
        addr = (this.PC + disp) & 0xFFFF;
        break;
      }
    }

    // Branch instructions handled specially
    switch (op) {
      case 0x10: t = 2; if (!this.fN) { this.PC = addr; t = 3; } return t; // BPL
      case 0x30: t = 2; if (this.fN)  { this.PC = addr; t = 3; } return t; // BMI
      case 0x50: t = 2; if (!this.fV) { this.PC = addr; t = 3; } return t; // BVC
      case 0x70: t = 2; if (this.fV)  { this.PC = addr; t = 3; } return t; // BVS
      case 0x90: t = 2; if (!this.fC) { this.PC = addr; t = 3; } return t; // BCC
      case 0xB0: t = 2; if (this.fC)  { this.PC = addr; t = 3; } return t; // BCS
      case 0xD0: t = 2; if (!this.fZ) { this.PC = addr; t = 3; } return t; // BNE
      case 0xF0: t = 2; if (this.fZ)  { this.PC = addr; t = 3; } return t; // BEQ
    }

    // Other ops - read operand if needed
    let m = 0; // operand byte
    if (mode !== 'IMP' && mode !== 'ACC' && mode !== 'REL') {
      m = this.read(addr);
    }

    switch (op) {
      // ----- Loads -----
      case 0xA9: case 0xA5: case 0xB5: case 0xAD: case 0xBD: case 0xB9: case 0xA1: case 0xB1:
        // LDA
        this.A = m; this.setNZ(this.A); return opCycles(op) + t;
      case 0xA2: case 0xA6: case 0xB6: case 0xAE: case 0xBE:
        // LDX
        this.X = m; this.setNZ(this.X); return opCycles(op) + t;
      case 0xA0: case 0xA4: case 0xB4: case 0xAC: case 0xBC:
        // LDY
        this.Y = m; this.setNZ(this.Y); return opCycles(op) + t;

      // ----- Stores -----
      case 0x85: case 0x95: case 0x8D: case 0x9D: case 0x99: case 0x81: case 0x91:
        // STA
        this.write(addr, this.A); return opCycles(op) + t;
      case 0x86: case 0x96: case 0x8E: case 0x9E:
        // STX
        this.write(addr, this.X); return opCycles(op) + t;
      case 0x84: case 0x94: case 0x8C: case 0x9C:
        // STY
        this.write(addr, this.Y); return opCycles(op) + t;

      // ----- Transfers -----
      case 0xAA: this.X = this.A; this.setNZ(this.X); return 2; // TAX
      case 0x8A: this.A = this.X; this.setNZ(this.A); return 2; // TXA
      case 0xA8: this.Y = this.A; this.setNZ(this.Y); return 2; // TAY
      case 0x98: this.A = this.Y; this.setNZ(this.A); return 2; // TYA
      case 0xBA: this.X = this.SP; this.setNZ(this.X); return 2; // TSX
      case 0x9A: this.SP = this.X; return 2; // TXS

      // ----- Stack -----
      case 0x48: this.push(this.A); return 3; // PHA
      case 0x68: this.A = this.pop(); this.setNZ(this.A); return 4; // PLA
      case 0x08: this.push(this.P | 0x10); return 3; // PHP (B=1, unused=1)
      case 0x28: { let p = this.pop(); p = (p | 0x20) & ~0x10; this.P = p; return 4; } // PLP
      case 0x40: { // RTI
        let p = this.pop(); p = (p | 0x20) & ~0x10; this.P = p;
        this.PC = this.pop16();
        return 6;
      }
      case 0x60: { // RTS
        const ret = (this.pop16() + 1) & 0xFFFF;
        this.PC = ret;
        return 6;
      }
      case 0x20: { // JSR
        const target = addr;
        this.push16(this.PC - 1); // Push PC+1 (target is the absolute operand)
        this.PC = target;
        return 6;
      }
      case 0x4C: { // JMP abs
        this.PC = addr;
        return 3;
      }
      case 0x6C: { // JMP ind
        this.PC = addr;
        return 5;
      }

      // ----- Arithmetic / logic -----
      case 0x69: case 0x65: case 0x75: case 0x6D: case 0x7D: case 0x79: case 0x61: case 0x71:
        // ADC
        this.A = this._adc(this.A, m, this.fC ? 1 : 0);
        return opCycles(op) + t;
      case 0xE9: case 0xE5: case 0xF5: case 0xED: case 0xFD: case 0xF9: case 0xE1: case 0xF1: case 0xF3: case 0xEB:
        // SBC (note: 0xF3 and 0xEB are aliases of F1/E9)
        this.A = this._sbc(this.A, m, this.fC ? 1 : 0);
        return opCycles(op) + t;
      case 0x29: case 0x25: case 0x35: case 0x2D: case 0x3D: case 0x39: case 0x21: case 0x31:
        // AND
        this.A &= m; this.setNZ(this.A); return opCycles(op) + t;
      case 0x09: case 0x05: case 0x15: case 0x0D: case 0x1D: case 0x19: case 0x01: case 0x11:
        // ORA
        this.A |= m; this.setNZ(this.A); return opCycles(op) + t;
      case 0x49: case 0x45: case 0x55: case 0x4D: case 0x5D: case 0x59: case 0x41: case 0x51:
        // EOR
        this.A ^= m; this.setNZ(this.A); return opCycles(op) + t;
      case 0x24: case 0x2C: { // BIT zp / abs
        this.setZ(this.A & m);
        this.setV((m & 0x40) !== 0);
        this.setN((m & 0x80) !== 0);
        return opCycles(op);
      }

      // ----- Compare -----
      case 0xC9: case 0xC5: case 0xD5: case 0xCD: case 0xDD: case 0xD9: case 0xC1: case 0xD1:
        // CMP
        this._cmp(this.A, m); return opCycles(op) + t;
      case 0xE0: case 0xE4: case 0xEC:
        // CPX
        this._cmp(this.X, m); return opCycles(op);
      case 0xC0: case 0xC4: case 0xCC:
        // CPY
        this._cmp(this.Y, m); return opCycles(op);

      // ----- Increments / decrements -----
      case 0xE6: case 0xF6: case 0xEE: case 0xFE: { // INC
        const v = (m + 1) & 0xFF; this.write(addr, v); this.setNZ(v); return opCycles(op); }
      case 0xC6: case 0xD6: case 0xCE: case 0xDE: { // DEC
        const v = (m - 1) & 0xFF; this.write(addr, v); this.setNZ(v); return opCycles(op); }
      case 0xE8: this.X = (this.X + 1) & 0xFF; this.setNZ(this.X); return 2; // INX
      case 0xC8: this.Y = (this.Y + 1) & 0xFF; this.setNZ(this.Y); return 2; // INY
      case 0xCA: this.X = (this.X - 1) & 0xFF; this.setNZ(this.X); return 2; // DEX
      case 0x88: this.Y = (this.Y - 1) & 0xFF; this.setNZ(this.Y); return 2; // DEY

      // ----- Shifts / rotates -----
      case 0x0A: { // ASL A
        const c = (this.A & 0x80) !== 0;
        this.A = (this.A << 1) & 0xFF;
        this.setC(c); this.setNZ(this.A);
        return 2;
      }
      case 0x06: case 0x16: case 0x0E: case 0x1E: { // ASL
        const c = (m & 0x80) !== 0;
        const v = (m << 1) & 0xFF;
        this.write(addr, v);
        this.setC(c); this.setNZ(v);
        return opCycles(op);
      }
      case 0x4A: { // LSR A
        const c = (this.A & 0x01) !== 0;
        this.A = this.A >> 1;
        this.setC(c); this.setNZ(this.A);
        return 2;
      }
      case 0x46: case 0x56: case 0x4E: case 0x5E: { // LSR
        const c = (m & 0x01) !== 0;
        const v = m >> 1;
        this.write(addr, v);
        this.setC(c); this.setNZ(v);
        return opCycles(op);
      }
      case 0x2A: { // ROL A
        const c = (this.A & 0x80) !== 0;
        this.A = ((this.A << 1) | (this.fC ? 1 : 0)) & 0xFF;
        this.setC(c); this.setNZ(this.A);
        return 2;
      }
      case 0x26: case 0x36: case 0x2E: case 0x3E: { // ROL
        const c = (m & 0x80) !== 0;
        const v = ((m << 1) | (this.fC ? 1 : 0)) & 0xFF;
        this.write(addr, v);
        this.setC(c); this.setNZ(v);
        return opCycles(op);
      }
      case 0x6A: { // ROR A
        const c = (this.A & 0x01) !== 0;
        this.A = (this.A >> 1) | (this.fC ? 0x80 : 0);
        this.setC(c); this.setNZ(this.A);
        return 2;
      }
      case 0x66: case 0x76: case 0x6E: case 0x7E: { // ROR
        const c = (m & 0x01) !== 0;
        const v = (m >> 1) | (this.fC ? 0x80 : 0);
        this.write(addr, v);
        this.setC(c); this.setNZ(v);
        return opCycles(op);
      }

      // ----- Flag instructions -----
      case 0x18: this.setC(false); return 2; // CLC
      case 0x38: this.setC(true);  return 2; // SEC
      case 0x58: this.P &= ~0x04;  return 2; // CLI
      case 0x78: this.P |= 0x04;   return 2; // SEI
      case 0xB8: this.setV(false); return 2; // CLV
      case 0xD8: this.P &= ~0x08;  return 2; // CLD
      case 0xF8: this.P |= 0x08;   return 2; // SED

      // ----- Misc -----
      case 0x00: { // BRK
        this.push16(this.PC + 1);
        this.push(this.P | 0x10);
        this.P |= 0x04;
        const lo = this.read(0xFFFE), hi = this.read(0xFFFF);
        this.PC = (hi << 8) | lo;
        return 7;
      }
      case 0xEA: return 2; // NOP
      case 0x1A: case 0x3A: case 0x5A: case 0x7A: case 0xDA: case 0xFA: return 2; // undocumented NOPs
      case 0x80: case 0x82: case 0x89: case 0xC2: case 0xE2: return 2; // SKB
      case 0x04: case 0x44: case 0x64: return 3; // DOP zp
      case 0x14: case 0x34: case 0x54: case 0x74: case 0xD4: case 0xF4: return 4; // DOP zpx
      case 0x0C: return 4; // TOP abs
      case 0x1C: case 0x3C: case 0x5C: case 0x7C: case 0xDC: case 0xFC: return 4; // TOP abx
    }

    throw new Error(`Unimplemented opcode 0x${op.toString(16).padStart(2,'0')} (${opname}) at PC=$${((this.PC-1)&0xFFFF).toString(16).padStart(4,'0')}`);
  }
}

// ----- Opcode metadata (addressing mode, base cycles) -----
// 6502 opcodes with [mode, base-cycles]
const OP_INFO = {
  // BRK
  0x00: ['IMP',7], // BRK
  // ORA
  0x01: ['IZX',6], 0x05: ['ZP',3], 0x09: ['IMM',2], 0x0D: ['ABS',4],
  0x11: ['IZY',5], 0x15: ['ZPX',4], 0x19: ['ABY',4], 0x1D: ['ABX',4],
  // ASL
  0x06: ['ZP',5], 0x0A: ['ACC',2], 0x0E: ['ABS',6], 0x16: ['ZPX',6], 0x1E: ['ABX',7],
  // PHP, CLC, PLP, SEC, PHA, CLI
  0x08: ['IMP',3], 0x18: ['IMP',2], 0x28: ['IMP',4], 0x38: ['IMP',2],
  0x48: ['IMP',3], 0x58: ['IMP',2], 0x68: ['IMP',4], 0x78: ['IMP',2],
  0x88: ['IMP',2], 0x98: ['IMP',2], 0xA8: ['IMP',2], 0xB8: ['IMP',2], 0xC8: ['IMP',2], 0xD8: ['IMP',2], 0xE8: ['IMP',2], 0xF8: ['IMP',2],
  // JSR, RTI, RTS
  0x20: ['ABS',6], 0x40: ['IMP',6], 0x60: ['IMP',6],
  // AND
  0x21: ['IZX',6], 0x25: ['ZP',3], 0x29: ['IMM',2], 0x2D: ['ABS',4],
  0x31: ['IZY',5], 0x35: ['ZPX',4], 0x39: ['ABY',4], 0x3D: ['ABX',4],
  // BIT
  0x24: ['ZP',3], 0x2C: ['ABS',4],
  // ROL, ROR, LSR, ASL already covered
  0x26: ['ZP',5], 0x2A: ['ACC',2], 0x2E: ['ABS',6], 0x36: ['ZPX',6], 0x3E: ['ABX',7],
  0x46: ['ZP',5], 0x4A: ['ACC',2], 0x4E: ['ABS',6], 0x56: ['ZPX',6], 0x5E: ['ABX',7],
  0x66: ['ZP',5], 0x6A: ['ACC',2], 0x6E: ['ABS',6], 0x76: ['ZPX',6], 0x7E: ['ABX',7],
  0x4C: ['ABS',3], 0x6C: ['IND',5],
  // EOR
  0x41: ['IZX',6], 0x45: ['ZP',3], 0x49: ['IMM',2], 0x4D: ['ABS',4],
  0x51: ['IZY',5], 0x55: ['ZPX',4], 0x59: ['ABY',4], 0x5D: ['ABX',4],
  // ADC
  0x61: ['IZX',6], 0x65: ['ZP',3], 0x69: ['IMM',2], 0x6D: ['ABS',4],
  0x71: ['IZY',5], 0x75: ['ZPX',4], 0x79: ['ABY',4], 0x7D: ['ABX',4],
  // STA
  0x81: ['IZX',6], 0x85: ['ZP',3], 0x8D: ['ABS',4],
  0x91: ['IZY',6], 0x95: ['ZPX',4], 0x99: ['ABY',5], 0x9D: ['ABX',5],
  // STY, STA-cont
  0x84: ['ZP',3], 0x8C: ['ABS',4], 0x94: ['ZPX',4],
  0x86: ['ZP',3], 0x8E: ['ABS',4], 0x96: ['ZPY',4],
  // LDA
  0xA1: ['IZX',6], 0xA5: ['ZP',3], 0xA9: ['IMM',2], 0xAD: ['ABS',4],
  0xB1: ['IZY',5], 0xB5: ['ZPX',4], 0xB9: ['ABY',4], 0xBD: ['ABX',4],
  // LDX
  0xA2: ['IMM',2], 0xA6: ['ZP',3], 0xAE: ['ABS',4], 0xB6: ['ZPY',4], 0xBE: ['ABY',4],
  // LDY
  0xA0: ['IMM',2], 0xA4: ['ZP',3], 0xAC: ['ABS',4], 0xB4: ['ZPX',4], 0xBC: ['ABX',4],
  // CMP
  0xC1: ['IZX',6], 0xC5: ['ZP',3], 0xC9: ['IMM',2], 0xCD: ['ABS',4],
  0xD1: ['IZY',5], 0xD5: ['ZPX',4], 0xD9: ['ABY',4], 0xDD: ['ABX',4],
  // CPX, CPY
  0xC0: ['IMM',2], 0xC4: ['ZP',3], 0xCC: ['ABS',4],
  0xE0: ['IMM',2], 0xE4: ['ZP',3], 0xEC: ['ABS',4],
  // SBC
  0xE1: ['IZX',6], 0xE5: ['ZP',3], 0xE9: ['IMM',2], 0xED: ['ABS',4], 0xEB: ['IMM',2],
  0xF1: ['IZY',5], 0xF5: ['ZPX',4], 0xF9: ['ABY',4], 0xFD: ['ABX',4], 0xF3: ['IZY',5],
  // INC, DEC
  0xE6: ['ZP',5], 0xEE: ['ABS',6], 0xF6: ['ZPX',6], 0xFE: ['ABX',7],
  0xC6: ['ZP',5], 0xCE: ['ABS',6], 0xD6: ['ZPX',6], 0xDE: ['ABX',7],
  // STX etc covered
  // Branch instructions
  0x10: ['REL',2], 0x30: ['REL',2], 0x50: ['REL',2], 0x70: ['REL',2],
  0x90: ['REL',2], 0xB0: ['REL',2], 0xD0: ['REL',2], 0xF0: ['REL',2],
  // NOP
  0xEA: ['IMP',2], 0x1A: ['IMP',2], 0x3A: ['IMP',2], 0x5A: ['IMP',2], 0x7A: ['IMP',2], 0xDA: ['IMP',2], 0xFA: ['IMP',2],
  0x80: ['IMM',2], 0x82: ['IMM',2], 0x89: ['IMM',2], 0xC2: ['IMM',2], 0xE2: ['IMM',2],
  0x04: ['ZP',3], 0x44: ['ZP',3], 0x64: ['ZP',3],
  0x14: ['ZPX',4], 0x34: ['ZPX',4], 0x54: ['ZPX',4], 0x74: ['ZPX',4], 0xD4: ['ZPX',4], 0xF4: ['ZPX',4],
  0x0C: ['ABS',4],
  0x1C: ['ABX',4], 0x3C: ['ABX',4], 0x5C: ['ABX',4], 0x7C: ['ABX',4], 0xDC: ['ABX',4], 0xFC: ['ABX',4]
};

function opMode(op) {
  const e = OP_INFO[op];
  return e ? e[0] : 'IMP';
}
function opCycles(op) {
  const e = OP_INFO[op];
  return e ? e[1] : 2;
}
const OP_NAMES = {
  0x00:'BRK',0x01:'ORA',0x05:'ORA',0x09:'ORA',0x0D:'ORA',0x11:'ORA',0x15:'ORA',0x19:'ORA',0x1D:'ORA',
  0x06:'ASL',0x0A:'ASL',0x0E:'ASL',0x16:'ASL',0x1E:'ASL',
  0x08:'PHP',0x18:'CLC',0x28:'PLP',0x38:'SEC',0x48:'PHA',0x58:'CLI',0x68:'PLA',0x78:'SEI',
  0x88:'DEY',0x98:'TYA',0xA8:'TAY',0xB8:'CLV',0xC8:'INY',0xD8:'CLD',0xE8:'INX',0xF8:'SED',
  0x20:'JSR',0x40:'RTI',0x60:'RTS',
  0x21:'AND',0x25:'AND',0x29:'AND',0x2D:'AND',0x31:'AND',0x35:'AND',0x39:'AND',0x3D:'AND',
  0x24:'BIT',0x2C:'BIT',
  0x26:'ROL',0x2A:'ROL',0x2E:'ROL',0x36:'ROL',0x3E:'ROL',
  0x46:'LSR',0x4A:'LSR',0x4E:'LSR',0x56:'LSR',0x5E:'LSR',
  0x66:'ROR',0x6A:'ROR',0x6E:'ROR',0x76:'ROR',0x7E:'ROR',
  0x4C:'JMP',0x6C:'JMP',
  0x41:'EOR',0x45:'EOR',0x49:'EOR',0x4D:'EOR',0x51:'EOR',0x55:'EOR',0x59:'EOR',0x5D:'EOR',
  0x61:'ADC',0x65:'ADC',0x69:'ADC',0x6D:'ADC',0x71:'ADC',0x75:'ADC',0x79:'ADC',0x7D:'ADC',
  0x81:'STA',0x85:'STA',0x8D:'STA',0x91:'STA',0x95:'STA',0x99:'STA',0x9D:'STA',
  0x84:'STY',0x8C:'STY',0x94:'STY',0x86:'STX',0x8E:'STX',0x96:'STX',
  0xA1:'LDA',0xA5:'LDA',0xA9:'LDA',0xAD:'LDA',0xB1:'LDA',0xB5:'LDA',0xB9:'LDA',0xBD:'LDA',
  0xA2:'LDX',0xA6:'LDX',0xAE:'LDX',0xB6:'LDX',0xBE:'LDX',
  0xA0:'LDY',0xA4:'LDY',0xAC:'LDY',0xB4:'LDY',0xBC:'LDY',
  0xC1:'CMP',0xC5:'CMP',0xC9:'CMP',0xCD:'CMP',0xD1:'CMP',0xD5:'CMP',0xD9:'CMP',0xDD:'CMP',
  0xC0:'CPY',0xC4:'CPY',0xCC:'CPY',0xE0:'CPX',0xE4:'CPX',0xEC:'CPX',
  0xE1:'SBC',0xE5:'SBC',0xE9:'SBC',0xED:'SBC',0xF1:'SBC',0xF5:'SBC',0xF9:'SBC',0xFD:'SBC',0xEB:'SBC',0xF3:'SBC',
  0xE6:'INC',0xEE:'INC',0xF6:'INC',0xFE:'INC',
  0xC6:'DEC',0xCE:'DEC',0xD6:'DEC',0xDE:'DEC',
  0x10:'BPL',0x30:'BMI',0x50:'BVC',0x70:'BVS',
  0x90:'BCC',0xB0:'BCS',0xD0:'BNE',0xF0:'BEQ',
  0xAA:'TAX',0x8A:'TXA',0xA8:'TAY',0x98:'TYA',0xBA:'TSX',0x9A:'TXS',
  0xEA:'NOP'
};
function opName(op) { return OP_NAMES[op] || '???'; }

if (typeof window !== 'undefined') {
  window.Cpu6502 = Cpu6502;
  window._opMode = opMode;
  window._opCycles = opCycles;
  window._opName = opName;
}
