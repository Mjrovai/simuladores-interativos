/* ============================================================
   Z80 Tutorial - Lessons and Challenges
   ============================================================
   A progressive curriculum that takes a learner from "what
   is a register" to writing small programs (countdown,
   string output, BCD, indexed access). Each lesson has:
     - a short narrative
     - a starter program (loaded into the editor)
     - one or more concepts to teach
     - a check function that runs against the user's code
   ============================================================ */

'use strict';

const TUTORIAL = [
  {
    id: 'l1',
    title: 'Lesson 1 — Your first instructions: LD',
    concept: '8-bit loads & registers',
    body: `
<p>The <b>Z80</b> is an 8-bit processor from Zilog (1976). It powered the
ZX Spectrum, MSX, Game Boy, TI calculators, and the CP/M operating system.</p>
<p>It has seven main 8-bit registers you can use freely:
<b>A, B, C, D, E, H, L</b>. "A" is the <i>accumulator</i> — the main
register for arithmetic, logic, and I/O.</p>
<p>The <code>LD</code> instruction copies a value into a register or
memory cell:</p>
<pre>LD A, 42     ; copy 42 into A
LD B, A      ; copy A into B
LD (HL), A   ; copy A into the memory location HL points to</pre>
<p>Numbers can be written as <code>42</code> (decimal),
<code>$2A</code> (hex), <code>0x2A</code> (hex), or <code>%00101010</code>
(binary). Anything after <code>;</code> is a comment.</p>
<p><b>Task:</b> Copy the value <code>5</code> into register <code>A</code>,
then copy <code>A</code> into <code>B</code>, and copy <code>A</code> into
memory address <code>$8000</code>.</p>`,
    starter: `; Lesson 1 — load a value into A, B, and memory
        ORG $8000

        LD A, 5
        LD B, A
        LD HL, $9000
        LD (HL), A
        HALT
`,
    hints: [
      'Use `LD A, 5` to put 5 in A.',
      'Then `LD B, A` puts A into B.',
      'To write A to memory, first point HL at the address with `LD HL, $9000`, then `LD (HL), A`.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 5 && cpu.B === 5 && cpu.read(0x9000) === 5;
      return { ok, message: ok ? 'A=5, B=5, mem[$9000]=5 ✓' : `A=${cpu.A}, B=${cpu.B}, [9000]=${cpu.read(0x9000)}` };
    }
  },

  {
    id: 'l2',
    title: 'Lesson 2 — Arithmetic: ADD and SUB',
    concept: 'flags, accumulator arithmetic',
    body: `
<p>Arithmetic is done with the accumulator. <code>ADD A, n</code> adds
<code>n</code> to A and stores the result back in A. <code>SUB n</code>
subtracts. <code>INC r</code> adds one. <code>DEC r</code> subtracts one.</p>
<p>Every arithmetic op also sets the <b>flags</b> in register F:</p>
<ul>
  <li><b>Z</b> — set when the result is zero</li>
  <li><b>C</b> — set when the operation produced a carry/borrow</li>
  <li><b>S</b> — set when the result's high bit is set (negative-looking)</li>
  <li><b>P/V</b> — parity / overflow (set when the result has even parity)</li>
</ul>
<p><b>Task:</b> Compute <code>3 + 4 - 2</code> using ADD and SUB, leaving
the result in A.</p>`,
    starter: `; Lesson 2 — arithmetic on the accumulator
        ORG $8000
        LD A, 3
        ADD A, 4
        SUB 2
        HALT
`,
    hints: [
      '`LD A, 3` then `ADD A, 4` then `SUB 2`.',
      'Run the program and watch the Z flag — it stays 0 because 5 ≠ 0.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 5;
      return { ok, message: ok ? 'A=5 ✓' : `A=${cpu.A}, expected 5` };
    }
  },

  {
    id: 'l3',
    title: 'Lesson 3 — Loops with DJNZ',
    concept: 'control flow & the B register as a counter',
    body: `
<p>To repeat code, the Z80 has <code>JR</code> (jump relative) and
<code>JP</code> (jump absolute). <code>DJNZ label</code> is a handy
shortcut: it decrements B and jumps to the label <i>unless</i> B
became zero. It is two bytes — perfect for tight loops.</p>
<pre>        LD B, 5     ; loop counter
LOOP:   ...         ; some code
        DJNZ LOOP   ; B := B-1, jump if B != 0
</pre>
<p><b>Task:</b> Set A to 0, then add 1 to A ten times using DJNZ.</p>`,
    starter: `; Lesson 3 — DJNZ loop, count to 10
        ORG $8000
        LD A, 0
        LD B, 10
LOOP:   INC A
        DJNZ LOOP
        HALT
`,
    hints: [
      'The loop runs while B is not zero, so B=10 means 10 iterations.',
      'INC A inside the loop adds 1 each time. After 10 iterations A=10.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 10;
      return { ok, message: ok ? 'A=10 ✓' : `A=${cpu.A}, expected 10` };
    }
  },

  {
    id: 'l4',
    title: 'Lesson 4 — Conditional jumps and the flags',
    concept: 'decision-making with JR Z / JR NZ',
    body: `
<p>You can branch on the flags. Useful forms:</p>
<pre>JR Z, target    ; jump if Z flag is set
JR NZ, target   ; jump if Z flag is clear
JR C, target    ; jump if carry
JR NC, target   ; jump if no carry</pre>
<p>After a <code>CP x</code> (compare A with x), the Z flag tells you
whether A equals x, and C tells you whether A &lt; x (unsigned).</p>
<p><b>Task:</b> Given A=7, if A is equal to 7, set A to 1, otherwise set
A to 0. (Hint: use CP and JR Z.)</p>`,
    starter: `; Lesson 4 — conditional branch
        ORG $8000
        LD A, 7
        CP 7
        JR Z, EQUAL
        LD A, 0
        JR DONE
EQUAL:  LD A, 1
DONE:   HALT
`,
    hints: [
      'CP sets Z when A==operand. JR Z jumps if Z is set.',
      'Without the second JR the program would fall through and overwrite A.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 1;
      return { ok, message: ok ? 'A=1 ✓ (branch taken)' : `A=${cpu.A}, expected 1` };
    }
  },

  {
    id: 'l5',
    title: 'Lesson 5 — Output to the "console" port',
    concept: 'I/O with OUT',
    body: `
<p>Z80 programs talk to the outside world through <b>I/O ports</b>.
<code>OUT (port), A</code> writes A to a port. In this simulator,
writing to port <code>0</code> prints the character whose ASCII
code is in A. Writing to port <code>1</code> appends to a "memory
log" you can read on the right.</p>
<p><b>Task:</b> Print the character <code>'H'</code>, then <code>'i'</code>,
then a newline (ASCII 10).</p>`,
    starter: `; Lesson 5 — print "Hi"
        ORG $8000
        LD A, 'H'
        OUT (0), A
        LD A, 'i'
        OUT (0), A
        LD A, 10
        OUT (0), A
        HALT
`,
    hints: [
      'A character literal is just its ASCII code: `\'H\'` is 0x48.',
      'Each `OUT (0), A` shows up in the Console panel on the right.',
    ],
    check: (cpu, sim) => {
      const ok = sim.console.includes('Hi');
      return { ok, message: ok ? `Console shows "Hi" ✓` : `Console: "${sim.console}"` };
    }
  },

  {
    id: 'l6',
    title: 'Lesson 6 — Memory and HL as a pointer',
    concept: 'indirect addressing & small loops',
    body: `
<p>HL is the most-used 16-bit register pair; it often serves as a
"pointer" into memory. To write to memory at the address in HL use
<code>LD (HL), n</code> or <code>LD (HL), A</code>. To read, use
<code>LD A, (HL)</code>. <code>INC HL</code> moves the pointer forward.</p>
<p><b>Task:</b> Fill memory from <code>$9000</code> to <code>$9009</code>
with the values 0..9 (i.e. memory[i] = i).</p>`,
    starter: `; Lesson 6 — fill memory 0..9
        ORG $8000
        LD HL, $9000
        LD B, 10
        LD A, 0
LOOP:   LD (HL), A
        INC A
        INC HL
        DJNZ LOOP
        HALT
`,
    hints: [
      'Use A as both the value and the implicit "next" index — INC A each step.',
      'Watch memory at $9000..$9009 in the Memory panel after the loop.',
    ],
    check: (cpu) => {
      let ok = true;
      for (let i = 0; i < 10; i++) if (cpu.read(0x9000 + i) !== i) { ok = false; break; }
      return { ok, message: ok ? 'Memory 0..9 stored correctly ✓' : 'Some bytes wrong — see Memory panel' };
    }
  },

  {
    id: 'l7',
    title: 'Lesson 7 — Subroutines with CALL and RET',
    concept: 'the stack & re-usable code',
    body: `
<p>A <b>subroutine</b> is a chunk of code you can call from anywhere
and return from. <code>CALL label</code> pushes the current PC
onto the stack and jumps to the label. <code>RET</code> pops the
return address off the stack and jumps back.</p>
<p>Anything you push with <code>PUSH</code> must be popped with
<code>POP</code> — or the stack drifts and bad things happen.</p>
<p><b>Task:</b> Define a subroutine <code>DOU</code> that doubles the
value in A. Call it from the main program so A ends up holding 12.</p>`,
    starter: `; Lesson 7 — subroutines
        ORG $8000
        LD A, 6
        CALL DOU       ; A should become 12
        HALT

DOU:    ADD A, A      ; A = A + A
        RET
`,
    hints: [
      'A subroutine ends with RET, not HALT.',
      'CALL saves PC on the stack. RET pops it and jumps back.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 12;
      return { ok, message: ok ? 'A=12 ✓' : `A=${cpu.A}, expected 12` };
    }
  },

  {
    id: 'l8',
    title: 'Lesson 8 — 16-bit add and BCD',
    concept: 'working above 8 bits; DAA',
    body: `
<p>To add 16-bit values, use <code>ADD HL, ss</code>. The result sits
in HL, with the carry going into the C flag. For example
<code>ADD HL, BC</code> does HL = HL + BC.</p>
<p>The Z80 also has the <b>DAA</b> instruction that adjusts A after an
ADD or SUB to make it a valid <i>binary-coded decimal</i> (BCD)
digit. Two BCD digits fit in one byte: high nibble = tens, low
nibble = ones.</p>
<p><b>Task:</b> Compute <code>5 + 7 = 12</code> in BCD: put 05 in A,
add 07, then run DAA, and check A is now $12.</p>`,
    starter: `; Lesson 8 — DAA / BCD
        ORG $8000
        LD A, $05
        ADD A, $07
        DAA           ; A should become $12
        HALT
`,
    hints: [
      'In BCD, $09 + $01 = $10 (sixteen decimal, but as BCD it means 1-0).',
      'DAA fixes the low/high nibble after binary arithmetic. Use it right after ADD or SUB.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 0x12;
      return { ok, message: ok ? 'A=$12 (BCD 12) ✓' : `A=$${cpu.A.toString(16).padStart(2,'0')}, expected $12` };
    }
  },

  {
    id: 'l9',
    title: 'Lesson 9 — Indexed addressing with IX',
    concept: 'tables & offsets',
    body: `
<p>Two 16-bit index registers, <b>IX</b> and <b>IY</b>, are useful for
accessing arrays: <code>LD A, (IX+0)</code> reads the first byte,
<code>(IX+1)</code> the next, and so on. They survive across many
instructions and can be moved with <code>LD IX, nn</code>.</p>
<p><b>Task:</b> Read the byte at <code>(IX+2)</code> and put it in A.</p>`,
    starter: `; Lesson 9 — indexed addressing
        ORG $8000
        LD HL, $9000
        LD (HL), 11   ; [9000] = 11
        INC HL
        LD (HL), 22   ; [9001] = 22
        INC HL
        LD (HL), 33   ; [9002] = 33

        LD IX, $9000
        LD A, (IX+2)  ; should be 33
        HALT
`,
    hints: [
      'IX+0 is the first element, IX+1 the second, IX+2 the third.',
      'The simulator highlights the byte at IX+offset in the Memory panel.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 33;
      return { ok, message: ok ? 'A=33 ✓' : `A=${cpu.A}, expected 33` };
    }
  },

  {
    id: 'l10',
    title: 'Lesson 10 — Capstone: print a string',
    concept: 'combining everything',
    body: `
<p>Combine what you know: a <b>DB</b> directive stores bytes, a
pointer walks the memory, <code>LD A,(HL)</code> reads each byte,
and <code>OUT (0),A</code> prints it. Stop when you see a zero byte
(standard "C-style" string terminator).</p>
<p><b>Task:</b> Print the string <code>"Z80!"</code> followed by a
newline. The string must be stored with a DB directive somewhere in
memory, and the program must walk it with a pointer until it hits
a zero byte.</p>`,
    starter: `; Lesson 10 — print a string
        ORG $8000
        LD HL, MSG
LOOP:   LD A, (HL)
        CP 0
        JR Z, DONE
        OUT (0), A
        INC HL
        JR LOOP
DONE:   HALT

        ORG $9000
MSG:    DB "Z80!", 10, 0
`,
    hints: [
      'A null-terminated string ends with a zero byte; CP 0 / JR Z handles that.',
      'DB stores ASCII bytes in memory; ORG $9000 puts them in a known place.',
    ],
    check: (cpu, sim) => {
      const ok = sim.console.includes('Z80!');
      return { ok, message: ok ? `Console shows "Z80!" ✓` : `Console: "${sim.console}"` };
    }
  }
];

if (typeof window !== 'undefined') window.TUTORIAL = TUTORIAL;
