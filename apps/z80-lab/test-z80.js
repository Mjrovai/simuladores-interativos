// Quick smoke test: load z80.js + z80-asm.js, run lesson programs.
'use strict';
// Provide a window global since scripts are not modules
global.window = {};
require('./z80.js');
require('./z80-asm.js');

const Z80 = global.window.Z80;
const Assembler = global.window.Assembler;

function runProgram(src, maxSteps = 50000) {
  const cpu = new Z80();
  const asm = new Assembler();
  const res = asm.assemble(src, 0x8000);
  if (!res.ok) {
    process.stderr.write('Assembly failed:\n');
    res.errors.forEach(e => process.stderr.write(`  line ${e.line}: ${e.msg} :: ${e.source}\n`));
    return null;
  }
  let addr = res.org;
  for (const item of res.listings) for (const b of item.bytes) cpu.write(addr++, b);
  cpu.PC = res.org;
  cpu.SP = 0xFFFE;
  let outText = '';
  cpu.consoleCharOut = (c) => { outText += String.fromCharCode(c); };
  try {
    cpu.run(maxSteps);
  } catch (e) {
    process.stderr.write('Runtime error: ' + e.message + '\n');
  }
  return { cpu, outText, listings: res.listings, output: res.output };
}

const TESTS = [
  {
    name: 'Lesson 1: LD A,5; LD B,A; LD (HL),A',
    src: `ORG $8000
LD A, 5
LD B, A
LD HL, $9000
LD (HL), A
HALT
`,
    check: ({cpu}) => cpu.A === 5 && cpu.B === 5 && cpu.read(0x9000) === 5
  },
  {
    name: 'Lesson 2: arithmetic',
    src: `ORG $8000
LD A, 3
ADD A, 4
SUB 2
HALT
`,
    check: ({cpu}) => cpu.A === 5
  },
  {
    name: 'Lesson 3: DJNZ',
    src: `ORG $8000
LD A, 0
LD B, 10
LOOP: INC A
DJNZ LOOP
HALT
`,
    check: ({cpu}) => cpu.A === 10
  },
  {
    name: 'Lesson 4: conditional jump',
    src: `ORG $8000
LD A, 7
CP 7
JR Z, EQUAL
LD A, 0
JR DONE
EQUAL: LD A, 1
DONE: HALT
`,
    check: ({cpu}) => cpu.A === 1
  },
  {
    name: 'Lesson 5: print "Hi"',
    src: `ORG $8000
LD A, 'H'
OUT (0), A
LD A, 'i'
OUT (0), A
HALT
`,
    check: ({outText}) => outText.includes('Hi')
  },
  {
    name: 'Lesson 6: fill 0..9',
    src: `ORG $8000
LD HL, $9000
LD B, 10
LD A, 0
LOOP: LD (HL), A
INC A
INC HL
DJNZ LOOP
HALT
`,
    check: ({cpu}) => { for (let i=0;i<10;i++) if (cpu.read(0x9000+i) !== i) return false; return true; }
  },
  {
    name: 'Lesson 7: subroutine',
    src: `ORG $8000
LD A, 6
CALL DOU
HALT
DOU: ADD A, A
RET
`,
    check: ({cpu}) => cpu.A === 12
  },
  {
    name: 'Lesson 8: BCD DAA',
    src: `ORG $8000
LD A, $05
ADD A, $07
DAA
HALT
`,
    check: ({cpu}) => cpu.A === 0x12
  },
  {
    name: 'Lesson 9: IX indexed',
    src: `ORG $8000
LD HL, $9000
LD (HL), 11
INC HL
LD (HL), 22
INC HL
LD (HL), 33
LD IX, $9000
LD A, (IX+2)
HALT
`,
    check: ({cpu}) => cpu.A === 33
  },
  {
    name: 'Lesson 10: string print',
    src: `ORG $8000
LD HL, MSG
LOOP: LD A, (HL)
CP 0
JR Z, DONE
OUT (0), A
INC HL
JR LOOP
DONE: HALT
ORG $9000
MSG: DB "Z80!", 10, 0
`,
    check: ({outText}) => outText.includes('Z80!')
  },
  {
    name: 'LDIR block copy',
    src: `ORG $8000
LD HL, $9000
LD (HL), $AA
INC HL
LD (HL), $BB
INC HL
LD (HL), $CC
LD HL, $9000
LD DE, $A000
LD BC, 3
LDIR
HALT
`,
    check: ({cpu}) => cpu.read(0xA000)===0xAA && cpu.read(0xA001)===0xBB && cpu.read(0xA002)===0xCC
  }
];

let pass = 0, fail = 0;
for (const t of TESTS) {
  process.stdout.write(`${t.name} ... `);
  const r = runProgram(t.src);
  if (!r) { fail++; process.stdout.write('FAIL (assembly)\n'); continue; }
  let ok = false;
  try { ok = t.check(r); } catch (e) { process.stdout.write('check error: ' + e.message + '\n'); fail++; continue; }
  if (ok) { pass++; process.stdout.write('OK\n'); }
  else { fail++; process.stdout.write('FAIL ' + JSON.stringify(r.cpu?{A:r.cpu.A,B:r.cpu.B,F:r.cpu.F}:null) + ` console="${r.outText}"\n`); }
}
process.stdout.write(`\n${pass} passed, ${fail} failed.\n`);
process.exit(fail > 0 ? 1 : 0);
