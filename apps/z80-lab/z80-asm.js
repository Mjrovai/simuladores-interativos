/* ============================================================
   Z80 Assembler - text mnemonics to bytes
   ============================================================
   A small, friendly Z80 assembler. Two-pass: first collect
   label addresses, then emit machine code. Supports comments
   (after ';'), labels (identifier followed by ':'), the usual
   numeric formats (decimal, 0x hex, $ hex, % binary, 'c'
   for ASCII char), and EQU/DB/DW for data declarations.
   ============================================================ */

'use strict';

class Assembler {
  constructor() {
    this.labels = {};
    this.equs = {};
    this.org = 0x0000;
    this.output = []; // array of bytes
    this.errors = [];
    this.listings = []; // {addr, line, bytes, source}
  }

  reset(org = 0x0000) {
    this.labels = {};
    this.equs = {};
    this.org = org;
    this.output = [];
    this.errors = [];
    this.listings = [];
  }

  // Public: assemble source into bytes, given a starting ORG
  assemble(source, org = 0x0000) {
    this.reset(org);
    // First pass: collect labels, EQUs and ORG; count sizes without
    // actually encoding. Sizes are fixed for most Z80 instructions,
    // so we can compute them without resolving label targets.
    const lines = this._preprocess(source);
    let pc = org;
    for (const item of lines) {
      try {
        if (item.label) {
          this.labels[item.label] = pc;
          this.equs[item.label] = pc;
        }
        if (item.instruction) {
          const size = this._estimate(item);
          pc = (pc + size) & 0xFFFF;
        } else if (item.directive) {
          this._evalDirectivePass1(item, () => pc);
        }
      } catch (e) {
        this._err(item, e.message);
      }
    }
    if (this.errors.length) return { ok: false, errors: this.errors, listings: this.listings, output: this.output };

    // Second pass: emit bytes
    pc = org;
    this.output = [];
    this.listings = [];
    for (const item of lines) {
      const startAddr = pc;
      let bytes = [];
      try {
        if (item.instruction) {
          bytes = this._encode(item, pc);
        } else if (item.directive) {
          bytes = this._evalDirectivePass2(item, () => pc) || [];
        }
      } catch (e) {
        this._err(item, e.message);
        continue;
      }
      for (const b of bytes) this.output.push(b & 0xFF);
      this.listings.push({
        addr: startAddr,
        line: item.lineNo,
        source: item.raw,
        bytes: bytes.map(b => b & 0xFF),
      });
      pc = (pc + bytes.length) & 0xFFFF;
    }

    return { ok: this.errors.length === 0, errors: this.errors, listings: this.listings, output: this.output, org };
  }

  // ----- Preprocess: tokenize, strip comments, recognize labels -----
  _preprocess(source) {
    const items = [];
    const rawLines = source.split(/\r?\n/);
    rawLines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      // Strip comment
      let line = raw.replace(/[;].*$/, '').trim();
      if (!line) return;
      // Label?
      let label = null;
      const labelMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      if (labelMatch) {
        label = labelMatch[1];
        line = labelMatch[2].trim();
      }
      if (!line) { items.push({ lineNo, raw, label }); return; }
      // Directive?
      const dirMatch = line.match(/^([A-Za-z_]+)\b\s*(.*)$/);
      const op = dirMatch[1].toUpperCase();
      const rest = dirMatch[2];
      const DIRS = new Set(['ORG','EQU','DB','DW','DS','END','INCLUDE','DEFB','DEFM','DEFW']);
      if (DIRS.has(op)) {
        items.push({ lineNo, raw, label, directive: op, args: rest });
        return;
      }
      // Instruction
      const parts = rest.split(/,|\s+/).filter(Boolean);
      items.push({ lineNo, raw, label, instruction: op, args: parts });
    });
    return items;
  }

  // Estimate instruction size WITHOUT actually encoding.
  // For most Z80 instructions the size depends only on the form
  // (number of operand bytes), not on the resolved operand value.
  _estimate(item) {
    const op = item.instruction;
    const a = (item.args[0] || '').trim();
    const b = (item.args[1] || '').trim();
    const r0 = this._parseReg8(a);
    const r1 = this._parseReg8(b);
    const p0 = this._parseReg16(a);
    const mA = this._parseMem(a);
    const mB = this._parseMem(b);
    const isIxA = mA && (mA.type === 'ix' || mA.type === 'iy');
    const isIxB = mB && (mB.type === 'ix' || mB.type === 'iy');

    // No-operand / fixed-size ops
    const oneByte = new Set(['NOP','HALT','DI','EI','RLCA','RRCA','RLA','RRA','CPL','SCF','CCF','DAA','NEG','EXX','LDIR','LDDR','RLD','RRD']);
    if (oneByte.has(op)) return 1;

    switch (op) {
      case 'LD': {
        if (a.toUpperCase()==='A' && (b.toUpperCase()==='(BC)' || b.toUpperCase()==='(DE)')) return 1;
        if (a.toUpperCase()==='(BC)' || a.toUpperCase()==='(DE)') return 1;
        if (r0 && r1) return 1;
        if (r0 && mB && mB.type==='hl') return 1;
        if (mA && mA.type==='hl' && r1) return 1;
        if (a.toUpperCase()==='A' && mB && mB.type==='hl') return 1;
        if (mA && mA.type==='hl' && b.toUpperCase()==='A') return 1;
        // LD r, n
        if (r0 && !mB) return 2;
        if (mA && mA.type==='hl' && !r1) return 2;
        // LD A,(nn) / (nn),A / LD HL,(nn) / (nn),HL
        if (a.toUpperCase()==='A' && mB && mB.type==='nn') return 3;
        if (mA && mA.type==='nn' && b.toUpperCase()==='A') return 3;
        if (a.toUpperCase()==='HL' && mB && mB.type==='nn') return 3;
        if (mA && mA.type==='nn' && b.toUpperCase()==='HL') return 3;
        // 16-bit immediate loads
        if (['BC','DE','HL','SP'].includes(a.toUpperCase()) && !mB) return 3;
        if (['IX','IY'].includes(a.toUpperCase()) && !mB) return 4;
        // ED: BC/DE,(nn) and (nn),BC/DE
        if (['BC','DE'].includes(a.toUpperCase()) && mB && mB.type==='nn') return 4;
        if (mA && mA.type==='nn' && ['BC','DE'].includes(b.toUpperCase())) return 4;
        // EX (SP),HL/IX/IY
        if (a.toUpperCase()==='(SP)' && ['HL','IX','IY'].includes(b.toUpperCase())) {
          return b.toUpperCase()==='HL' ? 1 : 2;
        }
        // LD SP,HL
        if (a.toUpperCase()==='SP' && b.toUpperCase()==='HL') return 1;
        // Indexed LD r, (IX+d); LD (IX+d), r; LD (IX+d), n
        if (r0 && isIxB) return 3;
        if (isIxA && r1) return 3;
        if (isIxA && !r1) return 4;
        // IX/IY,nn was covered
        // EX AF,AF' / EX DE,HL
        if (a.toUpperCase()==='AF' && b.toUpperCase()===`AF'`) return 1;
        if (a.toUpperCase()==='DE' && b.toUpperCase()==='HL') return 1;
        return 0;
      }
      case 'PUSH': case 'POP': {
        if (['BC','DE','HL','AF'].includes(a.toUpperCase())) return 1;
        if (['IX','IY'].includes(a.toUpperCase())) return 2;
        return 0;
      }
      case 'EX': {
        if (a.toUpperCase()==='(SP)' && b.toUpperCase()==='HL') return 1;
        if (a.toUpperCase()==='(SP)' && ['IX','IY'].includes(b.toUpperCase())) return 2;
        return 1;
      }
      case 'ADD': {
        if (a.toUpperCase()==='A') {
          if (r1) return 1;
          if (b.toUpperCase()==='(HL)') return 1;
          if (isIxB) return 3;
          return 2; // immediate
        }
        if (a.toUpperCase()==='HL') return 1;
        if (['IX','IY'].includes(a.toUpperCase())) return 2;
        return 0;
      }
      case 'ADC': case 'SBC': {
        if (a.toUpperCase()==='A') {
          if (r1) return 1;
          if (b.toUpperCase()==='(HL)') return 1;
          if (isIxB) return 3;
          return 2;
        }
        return 0;
      }
      case 'SUB': case 'AND': case 'OR': case 'XOR': case 'CP': {
        if (r0) return 1;
        if (a.toUpperCase()==='(HL)') return 1;
        if (isIxA) return 3;
        return 2; // immediate
      }
      case 'INC': case 'DEC': {
        if (r0) return 1;
        if (a.toUpperCase()==='(HL)') return 1;
        if (isIxA) return 3;
        if (['BC','DE','HL','SP'].includes(a.toUpperCase())) return 1;
        if (['IX','IY'].includes(a.toUpperCase())) return 2;
        return 0;
      }
      case 'JP': {
        if (a.toUpperCase()==='HL' || a.toUpperCase()==='IX' || a.toUpperCase()==='IY') {
          return a.toUpperCase()==='HL' ? 1 : 2;
        }
        // conditional JP nn
        if (this._parseCond(a)) return 3;
        // JP nn
        if (a) return 3;
        return 0;
      }
      case 'JR': {
        if (this._parseCond(a)) return 2;
        return 2;
      }
      case 'DJNZ': return 2;
      case 'CALL': {
        if (this._parseCond(a)) return 3;
        return 3;
      }
      case 'RET': {
        if (!a) return 1;
        if (this._parseCond(a)) return 1;
        return 0;
      }
      case 'RST': return 1;
      case 'OUT': case 'IN': return 2;
      case 'IM': return 2;
      case 'BIT': case 'RES': case 'SET': {
        if (r1) return 2;
        if (b.toUpperCase()==='(HL)') return 2;
        if (isIxB) return 4;
        return 0;
      }
      case 'RLC': case 'RRC': case 'RL': case 'RR':
      case 'SLA': case 'SRA': case 'SRL': case 'SLL': {
        if (r0) return 2;
        if (a.toUpperCase()==='(HL)') return 2;
        if (isIxA) return 4;
        return 0;
      }
      default:
        return 0;
    }
  }

  _err(item, msg) {
    this.errors.push({ line: item.lineNo, source: item.raw, msg });
  }

  // ----- Numeric / token helpers -----
  _parseNumber(tok) {
    if (tok === undefined || tok === null) throw new Error('expected number');
    tok = tok.trim();
    if (tok === '') throw new Error('expected number');
    // Character literal
    const cm = tok.match(/^'(.)'$/);
    if (cm) return cm[1].charCodeAt(0) & 0xFF;
    // Hex with $
    if (tok.startsWith('$')) return parseInt(tok.slice(1), 16);
    if (tok.startsWith('0x') || tok.startsWith('0X')) return parseInt(tok.slice(2), 16);
    if (tok.startsWith('%')) return parseInt(tok.slice(1), 2);
    if (/^-?\d+$/.test(tok)) return parseInt(tok, 10) & 0xFFFF;
    // Expression
    return this._evalExpr(tok);
  }

  // Very small expression evaluator: + - * / ( ) and labels
  _evalExpr(expr) {
    // First normalize $hex and %bin to 0x/0b
    const pre = expr
      .replace(/\$[0-9a-fA-F]+/g, (m) => '0x' + m.slice(1))
      .replace(/%[01]+/g,        (m) => '0b' + m.slice(1));
    // Replace labels with their numeric values, but skip
    // tokens that are part of 0x... or 0b... number literals.
    const norm = pre.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (m, off) => {
      const before = pre[off - 1];
      if (before === '0') return m;
      if (m in this.equs) return this.equs[m].toString();
      throw new Error(`Unknown label: ${m}`);
    });
    // Use Function for safe-ish eval (numbers only after replacement)
    // eslint-disable-next-line no-new-func
    const v = Function('"use strict";return (' + norm + ')')();
    return v & 0xFFFF;
  }

  // Convert $hex and 0xhex forms inside an arbitrary expression
  _normalizeNumberForms(expr) {
    // $1234 -> 0x1234
    return expr.replace(/\$[0-9a-fA-F]+/g, (m) => '0x' + m.slice(1));
  }

  // Argument parsers
  _parseReg8(t) {
    const r = t.toUpperCase();
    if (r === 'A'||r==='B'||r==='C'||r==='D'||r==='E'||r==='H'||r==='L') return r;
    return null;
  }
  _parseReg16(t) {
    const r = t.toUpperCase();
    if (r==='BC'||r==='DE'||r==='HL'||r==='SP'||r==='AF'||r==='IX'||r==='IY'||r==='IXH'||r==='IXL'||r==='IYH'||r==='IYL') return r;
    return null;
  }
  _parsePairSP(t) { const r=t.toUpperCase(); if (r==='BC'||r==='DE'||r==='HL'||r==='SP') return r; return null; }
  _parsePairAF(t) { const r=t.toUpperCase(); if (r==='BC'||r==='DE'||r==='HL'||r==='AF') return r; return null; }
  _parseCond(t) {
    const c = t.toUpperCase();
    if (c==='NZ'||c==='Z'||c==='NC'||c==='C'||c==='PO'||c==='PE'||c==='P'||c==='M') return c;
    return null;
  }

  // Parse (HL), (IX+d), (IX+d), (nn)
  _parseMem(arg) {
    if (!arg) return null;
    arg = arg.trim();
    const m1 = arg.match(/^\(HL\)$/i); if (m1) return { type: 'hl' };
    const m2 = arg.match(/^\(IX([+-])(\d+|0x[0-9a-fA-F]+|\$[0-9a-fA-F]+)\)$/i);
    if (m2) return { type: 'ix', sign: m2[1], disp: this._parseNumber(m2[2]) };
    const m3 = arg.match(/^\(IY([+-])(\d+|0x[0-9a-fA-F]+|\$[0-9a-fA-F]+)\)$/i);
    if (m3) return { type: 'iy', sign: m3[1], disp: this._parseNumber(m3[2]) };
    const m4 = arg.match(/^\((.+)\)$/);
    if (m4) return { type: 'nn', addr: this._evalExpr(m4[1]) };
    return null;
  }

  // ----- Directive handling -----
  _evalDirectivePass1(item, getPc) {
    if (item.directive === 'EQU') {
      if (!item.label) throw new Error('EQU requires a label');
      const v = this._evalExpr(item.args);
      this.equs[item.label] = v & 0xFFFF;
      this.labels[item.label] = v & 0xFFFF;
    } else if (item.directive === 'ORG') {
      const v = this._evalExpr(item.args);
      this.org = v & 0xFFFF;
    }
    // DB/DW handled in pass 2
  }
  _evalDirectivePass2(item, getPc) {
    if (item.directive === 'DB' || item.directive === 'DEFB' || item.directive === 'DEFM') {
      const toks = this._splitTopLevelCommas(item.args);
      const bytes = [];
      for (const tok of toks) {
        const t = tok.trim();
        if (t.startsWith('"') && t.endsWith('"')) {
          for (let i = 1; i < t.length - 1; i++) bytes.push(t.charCodeAt(i) & 0xFF);
        } else {
          bytes.push(this._parseNumber(t) & 0xFF);
        }
      }
      return bytes;
    } else if (item.directive === 'DW' || item.directive === 'DEFW') {
      const toks = this._splitTopLevelCommas(item.args);
      const bytes = [];
      for (const tok of toks) {
        const v = this._parseNumber(tok) & 0xFFFF;
        bytes.push(v & 0xFF);
        bytes.push((v >> 8) & 0xFF);
      }
      return bytes;
    } else if (item.directive === 'DS') {
      const n = this._parseNumber(item.args) & 0xFFFF;
      return new Array(n).fill(0);
    } else if (item.directive === 'END') {
      return [];
    } else if (item.directive === 'ORG' || item.directive === 'EQU' || item.directive === 'INCLUDE') {
      return [];
    }
    return [];
  }
  _splitTopLevelCommas(s) {
    const out = []; let cur = ''; let depth = 0;
    for (const ch of s) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  // ----- Encoding table (the big part) -----
  // Returns array of bytes for an instruction item.
  _encode(item, pc) {
    const op = item.instruction;
    const a = item.args;
    const A = (a[0]||'').trim();
    const B = (a[1]||'').trim();

    // Helpers for register indices used in 8-bit r, r' encoding
    const rIdx8 = (r) => ({B:0,C:1,D:2,E:3,H:4,L:5,HL:6,A:7})[r.toUpperCase()] ?? null;

    switch (op) {
      // ---- 8-bit loads r, r' (0x40..0x7F) ----
      case 'LD': {
        // Special cases first
        // LD A,(BC) / A,(DE) / (BC),A / (DE),A
        if (A.toUpperCase()==='A' && this._parseMem(B)?.type==='bc-style') {} // not used
        const mem1 = this._parseMem(B); // A, (something)
        const mem0 = this._parseMem(A); // (something), A or other
        if (A.toUpperCase() === 'A' && B.toUpperCase() === '(BC)') return [0x0A];
        if (A.toUpperCase() === 'A' && B.toUpperCase() === '(DE)') return [0x1A];
        if (A.toUpperCase() === '(BC)' && B.toUpperCase() === 'A') return [0x02];
        if (A.toUpperCase() === '(DE)' && B.toUpperCase() === 'A') return [0x12];
        if (A.toUpperCase() === 'A' && B.toUpperCase() === '(HL)') return [0x7E];
        if (A.toUpperCase() === '(HL)' && B.toUpperCase() === 'A') return [0x77];
        // LD r, (HL) / LD (HL), r
        const r0 = this._parseReg8(A);
        const r1 = this._parseReg8(B);
        const mA = this._parseMem(A);
        const mB = this._parseMem(B);
        if (r0 && r1) {
          // LD r, r'
          if (r0==='(HL)' || r1==='(HL)') throw new Error('use (HL) form');
          return [0x40 + (rIdx8(r0) << 3) + rIdx8(r1)];
        }
        if (r0 && mB && mB.type==='hl') {
          return [0x46 + (rIdx8(r0) << 3)];
        }
        if (mA && mA.type==='hl' && r1) {
          return [0x70 + rIdx8(r1)];
        }
        // LD r, n
        if (r0 && /^[\$%0-9A-Za-z_'+\-]+$/.test(B) && !mB) {
          return [0x06 + (rIdx8(r0) << 3), this._parseNumber(B) & 0xFF];
        }
        // LD (HL), n
        if (mA && mA.type==='hl' && !r1) {
          return [0x36, this._parseNumber(B) & 0xFF];
        }
        // LD A, (nn)
        if (A.toUpperCase()==='A' && mB && mB.type==='nn') return [0x3A, mB.addr & 0xFF, (mB.addr>>8)&0xFF];
        if (A.toUpperCase()==='(NN)' && mA && mA.type==='nn' && B.toUpperCase()==='A') return [0x32, mA.addr & 0xFF, (mA.addr>>8)&0xFF];
        // 16-bit loads LD dd, nn
        if (A.toUpperCase()==='BC' || A.toUpperCase()==='DE' || A.toUpperCase()==='HL' || A.toUpperCase()==='SP') {
          const r = A.toUpperCase();
          const v = this._parseNumber(B) & 0xFFFF;
          const dd = {BC:0,DE:1,HL:2,SP:3}[r];
          return [0x01 + (dd<<4), v & 0xFF, (v>>8)&0xFF];
        }
        if (A.toUpperCase()==='IX' || A.toUpperCase()==='IY') {
          const v = this._parseNumber(B) & 0xFFFF;
          const prefix = A.toUpperCase()==='IX' ? 0xDD : 0xFD;
          return [prefix, 0x21, v & 0xFF, (v>>8)&0xFF];
        }
        // LD HL, (nn) / LD (nn), HL
        if (A.toUpperCase()==='HL' && mB && mB.type==='nn') return [0x2A, mB.addr & 0xFF, (mB.addr>>8)&0xFF];
        if (mA && mA.type==='nn' && B.toUpperCase()==='HL') return [0x22, mA.addr & 0xFF, (mA.addr>>8)&0xFF];
        // LD BC/DE,(nn) and (nn),BC/DE
        if ((A.toUpperCase()==='BC' || A.toUpperCase()==='DE') && mB && mB.type==='nn') {
          return [0xED, A.toUpperCase()==='BC'?0x4B:0x5B, mB.addr & 0xFF, (mB.addr>>8)&0xFF];
        }
        if (mA && mA.type==='nn' && (B.toUpperCase()==='BC' || B.toUpperCase()==='DE')) {
          return [0xED, B.toUpperCase()==='BC'?0x43:0x53, mA.addr & 0xFF, (mA.addr>>8)&0xFF];
        }
        // LD SP, HL
        if (A.toUpperCase()==='SP' && B.toUpperCase()==='HL') return [0xF9];
        // Indexed loads
        if (r0 && mB && (mB.type==='ix' || mB.type==='iy')) {
          const prefix = mB.type==='ix' ? 0xDD : 0xFD;
          const d = mB.sign === '+' ? mB.disp : (-mB.disp) & 0xFF;
          return [prefix, 0x46 + (rIdx8(r0)<<3), d & 0xFF];
        }
        if (mA && (mA.type==='ix' || mA.type==='iy') && r1) {
          const prefix = mA.type==='ix' ? 0xDD : 0xFD;
          const d = mA.sign === '+' ? mA.disp : (-mA.disp) & 0xFF;
          return [prefix, 0x70 + rIdx8(r1), d & 0xFF];
        }
        if (mA && (mA.type==='ix' || mA.type==='iy') && !r1) {
          const prefix = mA.type==='ix' ? 0xDD : 0xFD;
          const d = mA.sign === '+' ? mA.disp : (-mA.disp) & 0xFF;
          return [prefix, 0x36, d & 0xFF, this._parseNumber(B) & 0xFF];
        }
        throw new Error('LD: cannot parse operands');
      }

      // ---- PUSH / POP ----
      case 'PUSH': {
        const r = A.toUpperCase();
        if (r==='BC') return [0xC5];
        if (r==='DE') return [0xD5];
        if (r==='HL') return [0xE5];
        if (r==='AF') return [0xF5];
        if (r==='IX') return [0xDD, 0xE5];
        if (r==='IY') return [0xFD, 0xE5];
        throw new Error('PUSH: bad operand');
      }
      case 'POP': {
        const r = A.toUpperCase();
        if (r==='BC') return [0xC1];
        if (r==='DE') return [0xD1];
        if (r==='HL') return [0xE1];
        if (r==='AF') return [0xF1];
        if (r==='IX') return [0xDD, 0xE1];
        if (r==='IY') return [0xFD, 0xE1];
        throw new Error('POP: bad operand');
      }

      // ---- EX / EXX ----
      case 'EX': {
        if (A.toUpperCase()==='DE' && B.toUpperCase()==='HL') return [0xEB];
        if (A.toUpperCase()==='AF' && B.toUpperCase()===`AF'`) return [0x08];
        if (A.toUpperCase()==='(SP)' && B.toUpperCase()==='HL') return [0xE3];
        if (A.toUpperCase()==='(SP)' && B.toUpperCase()==='IX') return [0xDD, 0xE3];
        if (A.toUpperCase()==='(SP)' && B.toUpperCase()==='IY') return [0xFD, 0xE3];
        throw new Error('EX: bad form');
      }
      case 'EXX': return [0xD9];

      // ---- ALU ops ----
      case 'ADD': {
        // ADD A, r / ADD A, n / ADD HL, ss / ADD IX, pp / ADD IY, rr
        if (A.toUpperCase()==='A') {
          const r = this._parseReg8(B);
          if (r) return [0x80 + rIdx8(r)];
          if (B.toUpperCase()==='(HL)') return [0x86];
          if (/^[\$%0-9A-Za-z_'+\-]+$/.test(B)) return [0xC6, this._parseNumber(B)&0xFF];
          const m = this._parseMem(B);
          if (m && (m.type==='ix' || m.type==='iy')) {
            const prefix = m.type==='ix'?0xDD:0xFD;
            const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
            return [prefix, 0x86, d & 0xFF];
          }
          throw new Error('ADD A: bad operand');
        }
        if (A.toUpperCase()==='HL') {
          const r = B.toUpperCase();
          const m = {BC:0x09,DE:0x19,HL:0x29,SP:0x39}[r];
          if (m===undefined) throw new Error('ADD HL: bad pair');
          return [m];
        }
        if (A.toUpperCase()==='IX') {
          const m = {BC:0xDD09,DE:0xDD19,IX:0xDD29,SP:0xDD39}[B.toUpperCase()];
          if (!m) throw new Error('ADD IX: bad pair');
          return [m>>8, m&0xFF];
        }
        if (A.toUpperCase()==='IY') {
          const m = {BC:0xFD09,DE:0xFD19,IY:0xFD29,SP:0xFD39}[B.toUpperCase()];
          if (!m) throw new Error('ADD IY: bad pair');
          return [m>>8, m&0xFF];
        }
        throw new Error('ADD: bad form');
      }
      case 'ADC': {
        if (A.toUpperCase()!=='A') throw new Error('ADC: must be ADC A,r');
        const r = this._parseReg8(B);
        if (r) return [0x88 + rIdx8(r)];
        if (B.toUpperCase()==='(HL)') return [0x8E];
        if (/^[\$%0-9A-Za-z_'+\-]+$/.test(B)) return [0xCE, this._parseNumber(B)&0xFF];
        const m = this._parseMem(B);
        if (m && (m.type==='ix'||m.type==='iy')) {
          const prefix = m.type==='ix'?0xDD:0xFD;
          const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
          return [prefix, 0x8E, d & 0xFF];
        }
        throw new Error('ADC: bad operand');
      }
      case 'SUB': {
        const r = this._parseReg8(A);
        if (r) return [0x90 + rIdx8(r)];
        if (A.toUpperCase()==='(HL)') return [0x96];
        if (/^[\$%0-9A-Za-z_'+\-]+$/.test(A)) return [0xD6, this._parseNumber(A)&0xFF];
        const m = this._parseMem(A);
        if (m && (m.type==='ix'||m.type==='iy')) {
          const prefix = m.type==='ix'?0xDD:0xFD;
          const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
          return [prefix, 0x96, d & 0xFF];
        }
        throw new Error('SUB: bad operand');
      }
      case 'SBC': {
        if (A.toUpperCase()!=='A') throw new Error('SBC: must be SBC A,r');
        const r = this._parseReg8(B);
        if (r) return [0x98 + rIdx8(r)];
        if (B.toUpperCase()==='(HL)') return [0x9E];
        if (/^[\$%0-9A-Za-z_'+\-]+$/.test(B)) return [0xDE, this._parseNumber(B)&0xFF];
        const m = this._parseMem(B);
        if (m && (m.type==='ix'||m.type==='iy')) {
          const prefix = m.type==='ix'?0xDD:0xFD;
          const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
          return [prefix, 0x9E, d & 0xFF];
        }
        throw new Error('SBC: bad operand');
      }
      case 'AND': {
        const r = this._parseReg8(A);
        if (r) return [0xA0 + rIdx8(r)];
        if (A.toUpperCase()==='(HL)') return [0xA6];
        if (/^[\$%0-9A-Za-z_'+\-]+$/.test(A)) return [0xE6, this._parseNumber(A)&0xFF];
        const m = this._parseMem(A);
        if (m && (m.type==='ix'||m.type==='iy')) {
          const prefix = m.type==='ix'?0xDD:0xFD;
          const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
          return [prefix, 0xA6, d & 0xFF];
        }
        throw new Error('AND: bad operand');
      }
      case 'OR': {
        const r = this._parseReg8(A);
        if (r) return [0xB0 + rIdx8(r)];
        if (A.toUpperCase()==='(HL)') return [0xB6];
        if (/^[\$%0-9A-Za-z_'+\-]+$/.test(A)) return [0xF6, this._parseNumber(A)&0xFF];
        const m = this._parseMem(A);
        if (m && (m.type==='ix'||m.type==='iy')) {
          const prefix = m.type==='ix'?0xDD:0xFD;
          const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
          return [prefix, 0xB6, d & 0xFF];
        }
        throw new Error('OR: bad operand');
      }
      case 'XOR': {
        const r = this._parseReg8(A);
        if (r) return [0xA8 + rIdx8(r)];
        if (A.toUpperCase()==='(HL)') return [0xAE];
        if (/^[\$%0-9A-Za-z_'+\-]+$/.test(A)) return [0xEE, this._parseNumber(A)&0xFF];
        const m = this._parseMem(A);
        if (m && (m.type==='ix'||m.type==='iy')) {
          const prefix = m.type==='ix'?0xDD:0xFD;
          const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
          return [prefix, 0xAE, d & 0xFF];
        }
        throw new Error('XOR: bad operand');
      }
      case 'CP': {
        const r = this._parseReg8(A);
        if (r) return [0xB8 + rIdx8(r)];
        if (A.toUpperCase()==='(HL)') return [0xBE];
        if (/^[\$%0-9A-Za-z_'+\-]+$/.test(A)) return [0xFE, this._parseNumber(A)&0xFF];
        const m = this._parseMem(A);
        if (m && (m.type==='ix'||m.type==='iy')) {
          const prefix = m.type==='ix'?0xDD:0xFD;
          const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
          return [prefix, 0xBE, d & 0xFF];
        }
        throw new Error('CP: bad operand');
      }
      case 'NEG': return [0xED, 0x44];

      // ---- INC / DEC 8-bit / 16-bit ----
      case 'INC': {
        const r = this._parseReg8(A);
        if (r) return [0x04 + (rIdx8(r) << 3)];
        if (A.toUpperCase()==='(HL)') return [0x34];
        const p = this._parseReg16(A);
        if (p==='BC') return [0x03];
        if (p==='DE') return [0x13];
        if (p==='HL') return [0x23];
        if (p==='SP') return [0x33];
        if (p==='IX') return [0xDD, 0x23];
        if (p==='IY') return [0xFD, 0x23];
        const m = this._parseMem(A);
        if (m && (m.type==='ix'||m.type==='iy')) {
          const prefix = m.type==='ix'?0xDD:0xFD;
          const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
          return [prefix, 0x34, d & 0xFF];
        }
        throw new Error('INC: bad operand');
      }
      case 'DEC': {
        const r = this._parseReg8(A);
        if (r) return [0x05 + (rIdx8(r) << 3)];
        if (A.toUpperCase()==='(HL)') return [0x35];
        const p = this._parseReg16(A);
        if (p==='BC') return [0x0B];
        if (p==='DE') return [0x1B];
        if (p==='HL') return [0x2B];
        if (p==='SP') return [0x3B];
        if (p==='IX') return [0xDD, 0x2B];
        if (p==='IY') return [0xFD, 0x2B];
        const m = this._parseMem(A);
        if (m && (m.type==='ix'||m.type==='iy')) {
          const prefix = m.type==='ix'?0xDD:0xFD;
          const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
          return [prefix, 0x35, d & 0xFF];
        }
        throw new Error('DEC: bad operand');
      }

      // ---- Rotates ----
      case 'RLCA': return [0x07];
      case 'RRCA': return [0x0F];
      case 'RLA':   return [0x17];
      case 'RRA':   return [0x1F];
      case 'CPL':   return [0x2F];
      case 'SCF':   return [0x37];
      case 'CCF':   return [0x3F];
      case 'DAA':   return [0x27];
      case 'NOP':   return [0x00];
      case 'HALT':  return [0x76];
      case 'DI':    return [0xF3];
      case 'EI':    return [0xFB];

      // ---- Jumps ----
      case 'JP': {
        const cond = this._parseCond(A);
        if (cond) {
          const t = B;
          const m = this._parseMem(t);
          let v;
          if (m && m.type==='nn') v = m.addr;
          else v = this._parseNumber(t);
          const cc = {NZ:0xC2,Z:0xCA,NC:0xD2,C:0xDA,PO:0xE2,PE:0xEA,P:0xF2,M:0xFA}[cond];
          return [cc, v & 0xFF, (v>>8)&0xFF];
        }
        // JP HL
        if (A.toUpperCase()==='HL') return [0xE9];
        if (A.toUpperCase()==='IX') return [0xDD, 0xE9];
        if (A.toUpperCase()==='IY') return [0xFD, 0xE9];
        // JP nn
        const m = this._parseMem(A);
        if (m && m.type==='nn') return [0xC3, m.addr & 0xFF, (m.addr>>8)&0xFF];
        const v = this._parseNumber(A);
        return [0xC3, v & 0xFF, (v>>8)&0xFF];
      }
      case 'JR': {
        const cond = this._parseCond(A);
        if (cond) {
          const target = this._parseNumber(B);
          // PC at this instruction + 2 (JR cc, e: opcode + cc + disp)
          const disp = (target - (pc + 2)) & 0xFF;
          const cc = {NZ:0x20,Z:0x28,NC:0x30,C:0x38}[cond];
          if (!cc) throw new Error('JR: bad cond');
          return [cc, disp];
        }
        const target = this._parseNumber(A);
        const disp = (target - (pc + 2)) & 0xFF;
        return [0x18, disp];
      }
      case 'DJNZ': {
        const target = this._parseNumber(A);
        const disp = (target - (pc + 2)) & 0xFF;
        return [0x10, disp];
      }

      // ---- CALL ----
      case 'CALL': {
        const cond = this._parseCond(A);
        if (cond) {
          const v = this._parseNumber(B);
          const cc = {NZ:0xC4,Z:0xCC,NC:0xD4,C:0xDC,PO:0xE4,PE:0xEC,P:0xF4,M:0xFC}[cond];
          return [cc, v & 0xFF, (v>>8)&0xFF];
        }
        const v = this._parseNumber(A);
        return [0xCD, v & 0xFF, (v>>8)&0xFF];
      }

      // ---- RET ----
      case 'RET': {
        if (!A) return [0xC9];
        const cond = this._parseCond(A);
        if (!cond) throw new Error('RET: bad cond');
        const cc = {NZ:0xC0,Z:0xC8,NC:0xD0,C:0xD8,PO:0xE0,PE:0xE8,P:0xF0,M:0xF8}[cond];
        return [cc];
      }

      // ---- RST ----
      case 'RST': {
        const v = this._parseNumber(A) & 0x38;
        return [0xC7 + v];
      }

      // ---- I/O ----
      case 'OUT': {
        // OUT (n), A
        if (B && B.toUpperCase()==='A') {
          const n = this._parseNumber(A);
          return [0xD3, n & 0xFF];
        }
        throw new Error('OUT: only OUT (n),A supported');
      }
      case 'IN': {
        if (A && A.toUpperCase()==='A') {
          const m = this._parseMem(B);
          if (m && m.type==='nn') return [0xDB, m.addr & 0xFF];
          const n = this._parseNumber(B);
          return [0xDB, n & 0xFF];
        }
        throw new Error('IN: only IN A,(n) supported');
      }

      // ---- Block instructions (LDIR, LDDR) ----
      case 'LDIR': return [0xED, 0xB0];
      case 'LDDR': return [0xED, 0xB8];
      case 'RLD':  return [0xED, 0x6F];
      case 'RRD':  return [0xED, 0x67];

      // ---- IM modes ----
      case 'IM': {
        const n = parseInt(A, 10);
        if (n === 0) return [0xED, 0x46];
        if (n === 1) return [0xED, 0x56];
        if (n === 2) return [0xED, 0x5E];
        throw new Error('IM: bad mode');
      }

      // ---- Bit instructions: BIT/SET/RES b, r ----
      case 'BIT': case 'SET': case 'RES': {
        const b = parseInt(A, 10);
        if (isNaN(b) || b<0 || b>7) throw new Error(`${op}: bit must be 0..7`);
        const r = this._parseReg8(B);
        const m = this._parseMem(B);
        const bb = {BIT:1,RES:2,SET:3}[op];
        if (r) {
          return [0xCB, (bb<<6) | (b<<3) | rIdx8(r)];
        }
        if (B.toUpperCase()==='(HL)') {
          return [0xCB, (bb<<6) | (b<<3) | 0x06];
        }
        if (m && (m.type==='ix'||m.type==='iy')) {
          const prefix = m.type==='ix'?0xDD:0xFD;
          const d = m.sign === '+' ? m.disp : (-m.disp) & 0xFF;
          return [prefix, 0xCB, d & 0xFF, (bb<<6) | (b<<3) | 0x06];
        }
        throw new Error(`${op}: bad operand`);
      }

      // ---- CB-prefix rotates on register ----
      case 'RLC': case 'RRC': case 'RL': case 'RR':
      case 'SLA': case 'SRA': case 'SRL': case 'SLL': {
        const m = {RLC:0,RRC:1,RL:2,RR:3,SLA:4,SRA:5,SLL:6,SRL:7}[op];
        const r = this._parseReg8(A);
        const mem = this._parseMem(A);
        if (r) return [0xCB, (m<<3) | rIdx8(r)];
        if (A.toUpperCase()==='(HL)') return [0xCB, (m<<3) | 0x06];
        if (mem && (mem.type==='ix'||mem.type==='iy')) {
          const prefix = mem.type==='ix'?0xDD:0xFD;
          const d = mem.sign === '+' ? mem.disp : (-mem.disp) & 0xFF;
          return [prefix, 0xCB, d & 0xFF, (m<<3) | 0x06];
        }
        throw new Error(`${op}: bad operand`);
      }

      default:
        throw new Error(`Unknown instruction: ${op}`);
    }
  }
}

if (typeof window !== 'undefined') window.Assembler = Assembler;
