// Apple 1 / 6502 smoke tests
'use strict';
global.window = {};
require('./a1-cpu.js');
require('./a1-asm.js');
require('./a1-woz.js');
require('./a1-lessons.js');
const Cpu6502 = global.window.Cpu6502;
const Asm6502 = global.window.Asm6502;
const LESSONS = global.window.LESSONS;

function runProgram(src, org = 0x300, maxSteps = 100000) {
  const cpu = new Cpu6502();
  const asm = new Asm6502();
  const res = asm.assemble(src, org);
  if (!res.ok) {
    process.stderr.write('Assembly failed:\n');
    res.errors.forEach(e => process.stderr.write('  line ' + e.line + ': ' + e.msg + ' :: ' + e.source + '\n'));
    return null;
  }
  let addr = res.org;
  for (const item of res.listings) for (const b of item.bytes) cpu.write(addr++, b);
  cpu.PC = res.org; cpu.SP = 0xFD;
  let screen = '';
  cpu.ioOutput = (a, v) => { if (a === 0xD010) screen += String.fromCharCode(v & 0x7F); };
  try { cpu.run(maxSteps); } catch (e) { process.stderr.write('Runtime: ' + e.message + '\n'); }
  return { cpu, screen, output: res.output };
}

const TESTS = [
  {
    name: 'L1: LDA #5; STA $40',
    src: `LDA #$05\nSTA $40\nLDA #$09\nSTA $41\nDONE: JMP DONE`,
    check: ({cpu}) => cpu.mem[0x40] === 5 && cpu.mem[0x41] === 9 && cpu.A === 9
  },
  {
    name: 'L2: arithmetic',
    src: `CLC\nLDA #$03\nADC #$04\nSEC\nSBC #$02\nDONE: JMP DONE`,
    check: ({cpu}) => cpu.A === 5
  },
  {
    name: 'L3: loop',
    src: `LDA #$00\nLDX #$0A\nLOOP: CLC\nADC #$01\nDEX\nBNE LOOP\nDONE: JMP DONE`,
    check: ({cpu}) => cpu.A === 10
  },
  {
    name: 'L4: branch',
    src: `LDA #$07\nCMP #$07\nBEQ E\nLDA #$00\nJMP D\nE: LDA #$01\nD: JMP D`,
    check: ({cpu}) => cpu.A === 1
  },
  {
    name: 'L5: print "Hi"',
    src: `LDA #'H'\nSTA $D010\nLDA #'i'\nSTA $D010\nDONE: JMP DONE`,
    check: ({screen}) => screen.includes('Hi')
  },
  {
    name: 'L6: fill 0..9',
    src: `LDA #$00\nLDX #$00\nLOOP: STA $40,X\nCLC\nADC #$01\nINX\nCPX #$0A\nBNE LOOP\nDONE: JMP DONE`,
    check: ({cpu}) => { for (let i=0;i<10;i++) if (cpu.mem[0x40+i] !== i) return false; return true; }
  },
  {
    name: 'L7: subroutine',
    src: `LDA #$06\nJSR DOUB\nJMP D\nDOUB: ASL A\nRTS\nD: JMP D`,
    check: ({cpu}) => cpu.A === 12
  },
  {
    name: 'L8: BCD',
    src: `SED\nCLC\nLDA #$05\nADC #$07\nCLD\nDONE: JMP DONE`,
    check: ({cpu}) => cpu.A === 0x12
  },
  {
    name: 'L9: indirect indexed',
    src: `LDA #$50\nSTA $40\nLDA #$00\nSTA $41\nLDA #$21\nSTA $53\nLDY #$03\nLDA ($40),Y\nDONE: JMP DONE`,
    check: ({cpu}) => cpu.A === 33
  },
  {
    name: 'L10: print string',
    src: `LDA #<STR\nSTA $40\nLDA #>STR\nSTA $41\nLDY #$00\nLOOP: LDA ($40),Y\nCMP #$00\nBEQ DONE\nSTA $D010\nINY\nJMP LOOP\nDONE: JMP DONE\nSTR: DB "HI!", 0`,
    check: ({screen}) => screen.includes('HI!')
  }
];

let pass = 0, fail = 0;
for (const t of TESTS) {
  process.stdout.write(t.name + ' ... ');
  const r = runProgram(t.src);
  if (!r) { fail++; continue; }
  let ok = false;
  try { ok = t.check(r); } catch (e) { process.stdout.write('check err: ' + e.message + '\n'); fail++; continue; }
  if (ok) { pass++; process.stdout.write('OK\n'); }
  else { fail++; process.stdout.write('FAIL A=' + r.cpu.A + ' screen="' + r.screen + '"\n'); }
}
process.stdout.write('\n' + pass + ' passed, ' + fail + ' failed.\n');
process.exit(fail > 0 ? 1 : 0);
