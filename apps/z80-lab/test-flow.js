// Full lesson check using check() function
global.window = {};
require('./z80.js');
require('./z80-asm.js');
require('./z80-tutorial.js');
const Z80 = global.window.Z80;
const Assembler = global.window.Assembler;
const TUTORIAL = global.window.TUTORIAL;

let pass = 0, fail = 0;
for (const lesson of TUTORIAL) {
  const asm = new Assembler();
  const r = asm.assemble(lesson.starter, 0x8000);
  if (!r.ok) {
    console.log(`${lesson.id}: assembly failed`);
    r.errors.forEach(e => console.log('  ' + e.line + ': ' + e.msg));
    fail++;
    continue;
  }
  const cpu = new Z80();
  let addr = r.org;
  for (const item of r.listings) for (const b of item.bytes) cpu.write(addr++, b);
  cpu.PC = r.org; cpu.SP = 0xFFFE;
  // Mimic state.console
  const sim = { console: '' };
  cpu.consoleCharOut = (c) => { sim.console += String.fromCharCode(c); };
  try { cpu.run(200000); } catch (e) { console.log(`${lesson.id}: runtime: ` + e.message); fail++; continue; }
  const res = lesson.check(cpu, sim);
  console.log(`${lesson.id}: ${res.ok ? 'OK' : 'FAIL'}  (${res.message})`);
  if (res.ok) pass++; else fail++;
}
console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
