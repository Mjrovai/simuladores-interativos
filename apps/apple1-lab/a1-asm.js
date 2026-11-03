/* ============================================================
   6502 Assembler (Apple 1 / Woz-friendly)
   ============================================================
   Two-pass assembler for the MOS 6502. Supports the documented
   6502 instruction set plus standard assembler directives:
     ORG, EQU, DB/.BYTE, DW/.WORD, DS, END
   Numbers: 42 decimal, $2A hex, 0x2A hex, %00101010 binary,
   'A' character literal. Labels end with ':'.
   ============================================================ */

'use strict';

class Asm6502 {
  constructor() { this.reset(); }
  reset(org = 0) {
    this.labels = {};
    this.equs = {};
    this.org = org;
    this.output = [];
    this.errors = [];
    this.listings = [];
  }

  assemble(source, org = 0) {
    this.reset(org);
    const lines = this._preprocess(source);
    let pc = org;
    for (const item of lines) {
      try {
        if (item.label) {
          this.labels[item.label] = pc & 0xFFFF;
          this.equs[item.label] = pc & 0xFFFF;
        }
        if (item.instruction) {
          const size = this._estimate(item);
          pc = (pc + size) & 0xFFFF;
        } else if (item.directive) {
          this._evalDir1(item);
        }
      } catch (e) { this._err(item, e.message); }
    }
    if (this.errors.length) {
      return { ok: false, errors: this.errors, listings: [], output: [] };
    }
    // Pass 2: emit bytes
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
          bytes = this._evalDir2(item) || [];
        }
      } catch (e) { this._err(item, e.message); continue; }
      for (const b of bytes) this.output.push(b & 0xFF);
      this.listings.push({
        addr: startAddr, line: item.lineNo, source: item.raw,
        bytes: bytes.map(b => b & 0xFF)
      });
      pc = (pc + bytes.length) & 0xFFFF;
    }
    return { ok: this.errors.length === 0, errors: this.errors, listings: this.listings, output: this.output, org };
  }

  _preprocess(source) {
    const items = [];
    const lines = source.split(/\r?\n/);
    lines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      let line = raw.replace(/[;].*$/, '').replace(/\/\/.*$/, '').trim();
      if (!line) return;
      let label = null;
      const lm = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      if (lm) { label = lm[1]; line = lm[2].trim(); }
      if (!line) { items.push({ lineNo, raw, label }); return; }
      const DIRS = new Set(['ORG','EQU','DB','DW','BYTE','WORD','DS','END','INCLUDE','DEFb','DEFw','DEFB','DEFM','DEFW']);
      const tm = line.match(/^([A-Za-z_.]+)\b\s*(.*)$/);
      const op = tm[1].toUpperCase();
      const rest = tm[2].trim();
      if (DIRS.has(op)) { items.push({ lineNo, raw, label, directive: op, args: rest }); return; }
      // Split on top-level commas only (respect parens and quotes).
      const parts = this._splitArgs(rest).map(s => s.trim()).filter(s => s.length > 0);
      items.push({ lineNo, raw, label, instruction: op, args: parts });
    });
    return items;
  }

  // ----- Number / expression helpers -----
  _parseNumber(tok) {
    tok = tok.trim();
    if (tok === '') throw new Error('expected number');
    const cm = tok.match(/^'(.)'$/);
    if (cm) return cm[1].charCodeAt(0) & 0xFF;
    if (tok.startsWith('$')) return parseInt(tok.slice(1), 16) & 0xFFFF;
    if (tok.startsWith('0x') || tok.startsWith('0X')) return parseInt(tok.slice(2), 16) & 0xFFFF;
    if (tok.startsWith('%')) return parseInt(tok.slice(1), 2) & 0xFFFF;
    if (tok.startsWith('"') && tok.endsWith('"') && tok.length >= 2) {
      return tok.charCodeAt(1) & 0xFF; // first char only
    }
    if (/^-?\d+$/.test(tok)) return parseInt(tok, 10) & 0xFFFF;
    return this._evalExpr(tok);
  }
  _evalExpr(expr) {
    // First, handle the 6502-style "low/high byte of label" by
    // rewriting `<LABEL` and `>LABEL` into equivalent expressions.
    // This must happen before label substitution, so the value
    // produced by the substitution can be wrapped.
    let s = expr
      .replace(/\$[0-9a-fA-F]+/g, (m) => '0x' + m.slice(1))
      .replace(/%[01]+/g,        (m) => '0b' + m.slice(1))
      .replace(/<([A-Za-z_][A-Za-z0-9_]*)/g, '(($1)&0xFF)')
      .replace(/>([A-Za-z_][A-Za-z0-9_]*)/g, '(($1)>>8)');
    // Now substitute labels (skip those inside 0x... literals)
    const norm = s.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (m, off) => {
      const before = s[off - 1];
      if (before === '0') return m; // part of 0x... number
      if (m in this.equs) return this.equs[m].toString();
      throw new Error(`Unknown label: ${m}`);
    });
    const v = Function('"use strict";return (' + norm + ')')();
    return v & 0xFFFF;
  }

  // ----- Operand classification -----
  // Returns { mode, value } where mode is one of:
  //   A (accumulator), #imm, zp, zpx, zpy, abs, absx, absy, ind, izx, izy, rel
  _classifyOperand(tok) {
    if (!tok) return null;
    tok = tok.trim();
    if (tok === 'A') return { mode: 'A' };
    if (tok.startsWith('#')) {
      const v = this._parseNumber(tok.slice(1));
      return { mode: '#imm', value: v & 0xFF };
    }
    // ($zp),Y — indirect indexed (must come BEFORE the abs,Y pattern
    // which would otherwise eat the closing paren)
    const my = tok.match(/^\(([^\)]+)\)\s*,\s*Y$/i);
    if (my) {
      const v = this._parseNumber(my[1]);
      return { mode: 'izy', value: v & 0xFF };
    }
    // ($zp,X) — pre-indexed indirect
    const mx = tok.match(/^\(([^\)]+)\s*,\s*X\)$/i);
    if (mx) {
      const v = this._parseNumber(mx[1]);
      return { mode: 'izx', value: v & 0xFF };
    }
    // (zp), (zp,X) - matches the form where the parens are at the end
    const m1 = tok.match(/^\(([^\)]+)\)$/);
    if (m1) {
      const inner = m1[1].trim();
      // (zp,X) or (zp, X)
      const m2 = inner.match(/^([^,]+)\s*,\s*X$/i);
      if (m2) {
        const v = this._parseNumber(m2[1]);
        return { mode: 'izx', value: v & 0xFF };
      }
      // (zp),Y
      const m3 = inner.match(/^([^,]+)\s*,\s*Y$/i);
      if (m3) {
        const v = this._parseNumber(m3[1]);
        return { mode: 'izy', value: v & 0xFF };
      }
      // Indirect JMP: ($nnnn)
      const v = this._parseNumber(inner);
      return { mode: 'ind', value: v & 0xFFFF };
    }
    // abs,X / abs,Y  (or zp,X / zp,Y if value < $100)
    const m4 = tok.match(/^([^,]+)\s*,\s*X$/i);
    if (m4) {
      const v = this._parseNumber(m4[1]);
      if (v < 0x100) return { mode: 'zpx', value: v & 0xFF };
      return { mode: 'absx', value: v & 0xFFFF };
    }
    const m5 = tok.match(/^([^,]+)\s*,\s*Y$/i);
    if (m5) {
      const v = this._parseNumber(m5[1]);
      if (v < 0x100) return { mode: 'zpy', value: v & 0xFF };
      return { mode: 'absy', value: v & 0xFFFF };
    }
    // plain number / label
    const v = this._parseNumber(tok);
    if (v < 0x100) return { mode: 'zp', value: v };
    return { mode: 'abs', value: v };
  }

  // ----- Addressing mode size in bytes -----
  _sizeOfOperand(c) {
    if (!c) return 0;
    switch (c.mode) {
      case 'A': return 0;
      case '#imm': return 1;
      case 'zp': return 1;
      case 'zpx': case 'zpy': return 1;
      case 'abs': return 2;
      case 'absx': case 'absy': return 2;
      case 'ind': return 2;
      case 'izx': case 'izy': return 1;
    }
    return 0;
  }

  // ----- Estimate instruction size without encoding -----
  _estimate(item) {
    const op = item.instruction;
    const ops = item.args;
    if (op === 'BRK' || op === 'RTI' || op === 'RTS' || op === 'NOP') return 1;
    if (op === 'JMP') {
      // JMP $nnnn or JMP ($nnnn)
      if (ops[0] && ops[0].startsWith('(')) return 3;
      return 3;
    }
    if (op === 'JSR') return 3;
    if (op === 'PHP' || op === 'PLP' || op === 'PHA' || op === 'PLA' ||
        op === 'RTI' || op === 'RTS' || op === 'TAX' || op === 'TXA' ||
        op === 'TAY' || op === 'TYA' || op === 'TSX' || op === 'TXS' ||
        op === 'INX' || op === 'INY' || op === 'DEX' || op === 'DEY' ||
        op === 'CLC' || op === 'SEC' || op === 'CLI' || op === 'SEI' ||
        op === 'CLV' || op === 'CLD' || op === 'SED') return 1;
    // Branch ops: 2 bytes
    if (['BPL','BMI','BVC','BVS','BCC','BCS','BNE','BEQ'].includes(op)) return 2;
    // Quick text-based size guess for pass 1, avoiding label resolution.
    const t = (ops[0] || '').trim();
    if (!t) return 1;
    if (t === 'A') return 1; // ASL A etc.
    if (t.startsWith('#')) return 2; // immediate = 2 bytes
    if (t.startsWith('(')) {
      // (zp) = 2; (zp,X) = 2; (zp),Y = 2; ($nnnn) = 3 (indirect JMP)
      if (t.includes(',')) return 2;
      // ($nnnn) - 3 bytes for JMP
      if (op === 'JMP') return 3;
      return 2;
    }
    if (t.includes(',')) {
      // abs,X or abs,Y = 3 bytes; but if the base is a small
      // immediate number (< $100), the assembler will emit the
      // zp form (2 bytes). Try to detect that.
      const baseMatch = t.match(/^([^,]+)/);
      if (baseMatch) {
        const base = baseMatch[1].trim();
        if (/^\$?[0-9a-fA-F]+$|^%[01]+$|^0x[0-9a-fA-F]+$|^\d+$/.test(base)) {
          let v = 0;
          if (base.startsWith('$')) v = parseInt(base.slice(1), 16);
          else if (base.startsWith('0x')) v = parseInt(base.slice(2), 16);
          else if (base.startsWith('%')) v = parseInt(base.slice(1), 2);
          else v = parseInt(base, 10);
          if (v < 0x100) return 2; // zp,x or zp,y
        }
      }
      return 3; // abs,X or abs,Y
    }
    // Plain number/label - 2 bytes for zp, 3 for abs. Try to detect
    // small numeric literals; default to 3 for labels (worst case).
    if (/^\$?[0-9a-fA-F]+$|^%[01]+$|^0x[0-9a-fA-F]+$|^\d+$/.test(t)) {
      let v = 0;
      if (t.startsWith('$')) v = parseInt(t.slice(1), 16);
      else if (t.startsWith('0x')) v = parseInt(t.slice(2), 16);
      else if (t.startsWith('%')) v = parseInt(t.slice(1), 2);
      else v = parseInt(t, 10);
      if (v < 0x100) return 2;
    }
    return 3;
  }

  _evalDir1(item) {
    if (item.directive === 'EQU') {
      if (!item.label) throw new Error('EQU requires label');
      const v = this._parseNumber(item.args);
      this.labels[item.label] = v & 0xFFFF;
      this.equs[item.label] = v & 0xFFFF;
    } else if (item.directive === 'ORG') {
      const v = this._parseNumber(item.args);
      this.org = v & 0xFFFF;
    }
  }
  _evalDir2(item) {
    if (item.directive === 'DB' || item.directive === '.BYTE' || item.directive === 'DEFB') {
      // DB args can be a comma-separated list of bytes and strings.
      // Split on commas (at top level), but keep quoted strings intact.
      const toks = this._splitDbArgs(item.args);
      const bytes = [];
      for (const t of toks) {
        if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
          for (let i = 1; i < t.length - 1; i++) bytes.push(t.charCodeAt(i) & 0xFF);
        } else {
          bytes.push(this._parseNumber(t) & 0xFF);
        }
      }
      return bytes;
    } else if (item.directive === 'DW' || item.directive === '.WORD' || item.directive === 'DEFW') {
      const toks = this._splitArgs(item.args);
      const bytes = [];
      for (const t of toks) {
        const v = this._parseNumber(t);
        bytes.push(v & 0xFF);
        bytes.push((v >> 8) & 0xFF);
      }
      return bytes;
    } else if (item.directive === 'DS') {
      const n = this._parseNumber(item.args) & 0xFFFF;
      return new Array(n).fill(0);
    }
    return [];
  }
  _splitArgs(s) {
    // 6502 instructions take at most one operand; any commas are
    // part of the addressing mode (`$40,X`, `($40),Y`). Split on
    // whitespace only.
    return s.split(/\s+/).filter(x => x.length > 0);
  }
  // Split a directive argument list (DB / DW) on commas, respecting
  // quoted strings.
  _splitDbArgs(s) {
    const out = []; let cur = ''; let inStr = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') { inStr = !inStr; cur += ch; continue; }
      if (ch === ',' && !inStr) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim().length) out.push(cur.trim());
    return out;
  }
  _err(item, msg) { this.errors.push({ line: item.lineNo, source: item.raw, msg }); }

  // ----- Encode an instruction to bytes -----
  _encode(item, pc) {
    const op = item.instruction;
    const ops = item.args;
    // Helpers
    const c0 = ops[0] ? this._classifyOperand(ops[0]) : null;
    const emit = (...b) => b;

    switch (op) {
      // Loads
      case 'LDA': {
        switch (c0.mode) {
          case '#imm': return [0xA9, c0.value];
          case 'zp':   return [0xA5, c0.value];
          case 'zpx':  return [0xB5, c0.value];
          case 'abs':  return [0xAD, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0xBD, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absy': return [0xB9, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'izx':  return [0xA1, c0.value];
          case 'izy':  return [0xB1, c0.value];
        } throw new Error('LDA: bad operand');
      }
      case 'LDX': {
        switch (c0.mode) {
          case '#imm': return [0xA2, c0.value];
          case 'zp':   return [0xA6, c0.value];
          case 'zpy':  return [0xB6, c0.value];
          case 'abs':  return [0xAE, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absy': return [0xBE, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('LDX: bad operand');
      }
      case 'LDY': {
        switch (c0.mode) {
          case '#imm': return [0xA0, c0.value];
          case 'zp':   return [0xA4, c0.value];
          case 'zpx':  return [0xB4, c0.value];
          case 'abs':  return [0xAC, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0xBC, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('LDY: bad operand');
      }

      // Stores
      case 'STA': {
        switch (c0.mode) {
          case 'zp':   return [0x85, c0.value];
          case 'zpx':  return [0x95, c0.value];
          case 'abs':  return [0x8D, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0x9D, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absy': return [0x99, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'izx':  return [0x81, c0.value];
          case 'izy':  return [0x91, c0.value];
        } throw new Error('STA: bad operand');
      }
      case 'STX': {
        switch (c0.mode) {
          case 'zp':   return [0x86, c0.value];
          case 'zpy':  return [0x96, c0.value];
          case 'abs':  return [0x8E, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('STX: bad operand');
      }
      case 'STY': {
        switch (c0.mode) {
          case 'zp':   return [0x84, c0.value];
          case 'zpx':  return [0x94, c0.value];
          case 'abs':  return [0x8C, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('STY: bad operand');
      }

      // Transfers
      case 'TAX': return [0xAA];
      case 'TXA': return [0x8A];
      case 'TAY': return [0xA8];
      case 'TYA': return [0x98];
      case 'TSX': return [0xBA];
      case 'TXS': return [0x9A];

      // Stack
      case 'PHA': return [0x48];
      case 'PLA': return [0x68];
      case 'PHP': return [0x08];
      case 'PLP': return [0x28];
      case 'RTI': return [0x40];
      case 'RTS': return [0x60];

      // Jumps
      case 'JMP': {
        if (c0.mode === 'ind') return [0x6C, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        return [0x4C, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
      }
      case 'JSR': {
        return [0x20, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
      }
      case 'BRK': return [0x00];

      // Arithmetic
      case 'ADC': {
        switch (c0.mode) {
          case '#imm': return [0x69, c0.value];
          case 'zp':   return [0x65, c0.value];
          case 'zpx':  return [0x75, c0.value];
          case 'abs':  return [0x6D, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0x7D, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absy': return [0x79, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'izx':  return [0x61, c0.value];
          case 'izy':  return [0x71, c0.value];
        } throw new Error('ADC: bad operand');
      }
      case 'SBC': {
        switch (c0.mode) {
          case '#imm': return [0xE9, c0.value];
          case 'zp':   return [0xE5, c0.value];
          case 'zpx':  return [0xF5, c0.value];
          case 'abs':  return [0xED, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0xFD, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absy': return [0xF9, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'izx':  return [0xE1, c0.value];
          case 'izy':  return [0xF1, c0.value];
        } throw new Error('SBC: bad operand');
      }

      // Logic
      case 'AND': {
        switch (c0.mode) {
          case '#imm': return [0x29, c0.value];
          case 'zp':   return [0x25, c0.value];
          case 'zpx':  return [0x35, c0.value];
          case 'abs':  return [0x2D, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0x3D, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absy': return [0x39, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'izx':  return [0x21, c0.value];
          case 'izy':  return [0x31, c0.value];
        } throw new Error('AND: bad operand');
      }
      case 'ORA': {
        switch (c0.mode) {
          case '#imm': return [0x09, c0.value];
          case 'zp':   return [0x05, c0.value];
          case 'zpx':  return [0x15, c0.value];
          case 'abs':  return [0x0D, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0x1D, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absy': return [0x19, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'izx':  return [0x01, c0.value];
          case 'izy':  return [0x11, c0.value];
        } throw new Error('ORA: bad operand');
      }
      case 'EOR': {
        switch (c0.mode) {
          case '#imm': return [0x49, c0.value];
          case 'zp':   return [0x45, c0.value];
          case 'zpx':  return [0x55, c0.value];
          case 'abs':  return [0x4D, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0x5D, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absy': return [0x59, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'izx':  return [0x41, c0.value];
          case 'izy':  return [0x51, c0.value];
        } throw new Error('EOR: bad operand');
      }
      case 'BIT': {
        switch (c0.mode) {
          case 'zp':  return [0x24, c0.value];
          case 'abs': return [0x2C, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('BIT: bad operand');
      }

      // Compare
      case 'CMP': {
        switch (c0.mode) {
          case '#imm': return [0xC9, c0.value];
          case 'zp':   return [0xC5, c0.value];
          case 'zpx':  return [0xD5, c0.value];
          case 'abs':  return [0xCD, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0xDD, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absy': return [0xD9, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'izx':  return [0xC1, c0.value];
          case 'izy':  return [0xD1, c0.value];
        } throw new Error('CMP: bad operand');
      }
      case 'CPX': {
        switch (c0.mode) {
          case '#imm': return [0xE0, c0.value];
          case 'zp':   return [0xE4, c0.value];
          case 'abs':  return [0xEC, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('CPX: bad operand');
      }
      case 'CPY': {
        switch (c0.mode) {
          case '#imm': return [0xC0, c0.value];
          case 'zp':   return [0xC4, c0.value];
          case 'abs':  return [0xCC, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('CPY: bad operand');
      }

      // INC / DEC
      case 'INC': {
        switch (c0.mode) {
          case 'zp':   return [0xE6, c0.value];
          case 'zpx':  return [0xF6, c0.value];
          case 'abs':  return [0xEE, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0xFE, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('INC: bad operand');
      }
      case 'DEC': {
        switch (c0.mode) {
          case 'zp':   return [0xC6, c0.value];
          case 'zpx':  return [0xD6, c0.value];
          case 'abs':  return [0xCE, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0xDE, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('DEC: bad operand');
      }
      case 'INX': return [0xE8];
      case 'INY': return [0xC8];
      case 'DEX': return [0xCA];
      case 'DEY': return [0x88];

      // Shifts / rotates
      case 'ASL': {
        if (c0.mode === 'A') return [0x0A];
        switch (c0.mode) {
          case 'zp':   return [0x06, c0.value];
          case 'zpx':  return [0x16, c0.value];
          case 'abs':  return [0x0E, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0x1E, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('ASL: bad operand');
      }
      case 'LSR': {
        if (c0.mode === 'A') return [0x4A];
        switch (c0.mode) {
          case 'zp':   return [0x46, c0.value];
          case 'zpx':  return [0x56, c0.value];
          case 'abs':  return [0x4E, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0x5E, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('LSR: bad operand');
      }
      case 'ROL': {
        if (c0.mode === 'A') return [0x2A];
        switch (c0.mode) {
          case 'zp':   return [0x26, c0.value];
          case 'zpx':  return [0x36, c0.value];
          case 'abs':  return [0x2E, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0x3E, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('ROL: bad operand');
      }
      case 'ROR': {
        if (c0.mode === 'A') return [0x6A];
        switch (c0.mode) {
          case 'zp':   return [0x66, c0.value];
          case 'zpx':  return [0x76, c0.value];
          case 'abs':  return [0x6E, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
          case 'absx': return [0x7E, c0.value & 0xFF, (c0.value >> 8) & 0xFF];
        } throw new Error('ROR: bad operand');
      }

      // Branches
      case 'BPL': case 'BMI': case 'BVC': case 'BVS':
      case 'BCC': case 'BCS': case 'BNE': case 'BEQ': {
        const target = this._parseNumber(ops[0]);
        const disp = (target - (pc + 2)) & 0xFF;
        const opc = { BPL:0x10, BMI:0x30, BVC:0x50, BVS:0x70,
                      BCC:0x90, BCS:0xB0, BNE:0xD0, BEQ:0xF0 }[op];
        return [opc, disp];
      }

      // Flag ops
      case 'CLC': return [0x18];
      case 'SEC': return [0x38];
      case 'CLI': return [0x58];
      case 'SEI': return [0x78];
      case 'CLV': return [0xB8];
      case 'CLD': return [0xD8];
      case 'SED': return [0xF8];

      // Misc
      case 'NOP': return [0xEA];
    }
    throw new Error(`Unknown instruction: ${op}`);
  }
}

if (typeof window !== 'undefined') window.Asm6502 = Asm6502;
