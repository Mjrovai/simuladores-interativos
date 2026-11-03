// Run all 10 Apple 1 lessons
global.window = {};
require('./a1-cpu.js');
require('./a1-asm.js');
require('./a1-woz.js');
require('./a1-lessons.js');
const Cpu6502 = global.window.Cpu6502;
const Asm6502 = global.window.Asm6502;
const LESSONS = global.window.LESSONS;
const loadWozMonitor = global.window.loadWozMonitor;
const installApple1IO = global.window.installApple1IO;

let pass = 0, fail = 0;
for (const lesson of LESSONS) {
  const asm = new Asm6502();
  const r = asm.assemble(lesson.starter, 0x300);
  if (!r.ok) {
    process.stdout.write(`${lesson.id}: assembly failed\n`);
    r.errors.forEach(e => process.stdout.write('  ' + e.line + ': ' + e.msg + '\n'));
    fail++;
    continue;
  }
  const cpu = new Cpu6502();
  loadWozMonitor(cpu);
  let addr = r.org;
  for (const item of r.listings) for (const b of item.bytes) cpu.write(addr++, b);
  cpu.PC = r.org; cpu.SP = 0xFD; cpu.P = 0x24;
  const sim = { screen: '' };
  installApple1IO(cpu,
    (c) => { sim.screen += String.fromCharCode(c & 0x7F); },
    () => -1
  );
  try { cpu.run(200000); } catch (e) {
    process.stdout.write(`${lesson.id}: runtime: ` + e.message + '\n');
    fail++;
    continue;
  }
  const res = lesson.check(cpu, sim);
  process.stdout.write(`${lesson.id}: ${res.ok ? 'OK' : 'FAIL'}  (${res.message})\n`);
  if (res.ok) pass++; else fail++;
}
process.stdout.write(`\n${pass} passed, ${fail} failed.\n`);
process.exit(fail > 0 ? 1 : 0);
