/* ============================================================
   Apple 1 / 6502 — Lessons
   ============================================================
   Same structure as the Z80 tutorial: ten progressive lessons
   that take a learner from "what is a register" to writing
   small programs on the Apple 1. Each lesson has:
     - a title and concept line
     - HTML body explaining the idea
     - a starter program loaded into the editor
     - a check() function the UI calls to grade the user's code
   ============================================================ */

'use strict';

const LESSONS = [
  {
    id: 'l1',
    title: 'Lesson 1 — Your first instructions: LDA and STA',
    concept: 'the accumulator, A, and memory',
    body: `
<p>The <b>MOS 6502</b> (1975) powered the Apple II, the NES, the Atari 2600,
the Commodore 64, and the BBC Micro. Wozniak's <b>Apple 1</b> (1976) was
one of its first commercial successes.</p>
<p>The 6502 has three 8-bit registers: <b>A</b> (the accumulator, used for
most arithmetic and memory loads), <b>X</b>, and <b>Y</b> (index registers).
Everything else goes through memory.</p>
<p>Two fundamental instructions:</p>
<pre>LDA #$05     ; load the value 5 into A
STA $40      ; store A into memory at $0040</pre>
<p>The <code>#</code> means "immediate" — the value is the operand. Without
the <code>#</code> the assembler would treat <code>05</code> as the address
<code>$0005</code>.</p>
<p><b>Task:</b> Load <code>5</code> into A, then store A into memory
location <code>$40</code>, then load <code>9</code> into A and store
it at <code>$41</code>.</p>`,
    starter: `; Lesson 1 — first loads and stores
        ORG $300

        LDA #$05
        STA $40
        LDA #$09
        STA $41

DONE:   JMP DONE       ; halt by infinite loop
`,
    hints: [
      '`LDA #$05` puts 5 in A. `LDA #$09` puts 9 in A.',
      '`STA $40` and `STA $41` write A to those addresses.',
      'A `JMP DONE` infinite loop is the Apple 1 way of saying "halt".',
    ],
    check: (cpu) => {
      const ok = cpu.mem[0x40] === 5 && cpu.mem[0x41] === 9 && cpu.A === 9;
      return { ok, message: ok ? '$40=5, $41=9, A=9 ✓' : `state: $40=${cpu.mem[0x40]}, $41=${cpu.mem[0x41]}, A=${cpu.A}` };
    }
  },

  {
    id: 'l2',
    title: 'Lesson 2 — Arithmetic: ADC and SBC',
    concept: 'the carry flag and A as a math register',
    body: `
<p>The 6502 has only one general-purpose arithmetic register: A. To add
to A, you use <code>ADC</code> (add with carry). To subtract, you use
<code>SBC</code> (subtract with carry). Both <i>include</i> the carry
flag — that's why there's a special <code>SEC</code> instruction to set
the carry first.</p>
<p>The 6502 flags: <b>N</b> (negative), <b>V</b> (overflow), <b>Z</b>
(zero), <b>C</b> (carry). After an ADC, Z is set when the result is 0,
C is set on unsigned overflow, V on signed overflow, N when bit 7 is set.</p>
<p><b>Task:</b> Compute <code>3 + 4 - 2 = 5</code> using A. Start by
making sure the carry is clear before the SBC (CLC).</p>`,
    starter: `; Lesson 2 — ADC, SBC, and the carry flag
        ORG $300

        CLC
        LDA #$03
        ADC #$04
        SEC
        SBC #$02

DONE:   JMP DONE
`,
    hints: [
      '`CLC` clears the carry so SBC works correctly. (SBC does A = A - M - !C.)',
      '`ADC #$04` adds 4 to A. `SBC #$02` subtracts 2.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 5;
      return { ok, message: ok ? 'A=5 ✓' : `A=${cpu.A}, expected 5` };
    }
  },

  {
    id: 'l3',
    title: 'Lesson 3 — Loops with X and Y',
    concept: 'indexed registers as counters',
    body: `
<p>The 6502 doesn't have a single "decrement and branch" instruction.
To make a loop, you load a counter into <b>X</b> or <b>Y</b>, do work
inside the loop, decrement with <code>DEX</code>/<code>DEY</code>,
and branch back with <code>BNE</code> (branch if not equal — i.e. not
zero) until the counter reaches zero.</p>
<pre>        LDX #$05     ; counter = 5
LOOP:   ...          ; some code
        DEX          ; X = X - 1
        BNE LOOP     ; branch while X != 0
</pre>
<p><b>Task:</b> Use a loop to add 1 to A ten times. End with A = 10.</p>`,
    starter: `; Lesson 3 — loop with X as a counter
        ORG $300

        LDA #$00
        LDX #$0A     ; 10 iterations
LOOP:   CLC
        ADC #$01
        DEX
        BNE LOOP

DONE:   JMP DONE
`,
    hints: [
      '`LDX #$0A` sets X=10. Each DEX makes X one smaller.',
      '`BNE LOOP` branches back as long as X is not zero.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 10;
      return { ok, message: ok ? 'A=10 ✓' : `A=${cpu.A}, expected 10` };
    }
  },

  {
    id: 'l4',
    title: 'Lesson 4 — Conditional branches: BEQ and BNE',
    concept: 'decision-making with the Z flag',
    body: `
<p>Branches on the 6502 inspect the flags:</p>
<pre>BEQ target   ; branch if Z=1 (result was zero / equal)
BNE target   ; branch if Z=0
BCC target   ; branch if C=0 (no carry / unsigned less)
BCS target   ; branch if C=1
BMI target   ; branch if N=1 (minus / negative)
BPL target   ; branch if N=0
</pre>
<p>After <code>CMP x</code>, Z is set if A == x, and C is set if
A &gt;= x (unsigned).</p>
<p><b>Task:</b> If A is 7, set A to 1. Otherwise set A to 0. Use
<code>CMP #$07</code> and <code>BEQ</code>.</p>`,
    starter: `; Lesson 4 — conditional branch
        ORG $300

        LDA #$07
        CMP #$07
        BEQ EQUAL
        LDA #$00
        JMP DONE
EQUAL:  LDA #$01
DONE:   JMP DONE
`,
    hints: [
      'CMP sets Z when A==operand. BEQ jumps if Z=1.',
      'Without the `JMP DONE` after the false branch, the program would fall through into EQUAL.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 1;
      return { ok, message: ok ? 'A=1 ✓ (branch taken)' : `A=${cpu.A}, expected 1` };
    }
  },

  {
    id: 'l5',
    title: 'Lesson 5 — Output to the Apple 1 screen',
    concept: 'memory-mapped I/O at $D010',
    body: `
<p>The Apple 1 was a "dumb terminal" computer: any character you write
to address <code>$D010</code> appears on the screen. The character
must be in standard ASCII (no high bit).</p>
<p>To output a character, put it in A and <code>STA $D010</code>.</p>
<p><b>Task:</b> Print <code>"Hi"</code> followed by a newline (ASCII 13
— the Apple 1 used CR only, not LF+CR).</p>`,
    starter: `; Lesson 5 — print "Hi" to the Apple 1 screen
        ORG $300

        LDA #'H'         ; ASCII 0x48
        STA $D010
        LDA #'i'         ; ASCII 0x69
        STA $D010
        LDA #$0D         ; carriage return
        STA $D010

DONE:   JMP DONE
`,
    hints: [
      '`LDA #\'H\'` is the same as `LDA #$48`.',
      'Each `STA $D010` shows up in the Apple 1 screen on the right.',
    ],
    check: (cpu, sim) => {
      const ok = sim.screen.includes('Hi');
      return { ok, message: ok ? `Screen shows "Hi" ✓` : `Screen: "${sim.screen}"` };
    }
  },

  {
    id: 'l6',
    title: 'Lesson 6 — Indexed addressing: ,X and ,Y',
    concept: 'walking through memory with X or Y',
    body: `
<p>To access an array, load the base address into <b>X</b> or <b>Y</b>
(useful only for the second in indexed addressing, but more often you
use a <b>zero page pointer</b> plus indexed addressing, like
<code>LDA $40,X</code>). The simpler form: <code>STX</code>/<code>LDX</code>
on the zero page gives you a small indexable buffer.</p>
<p>For walking memory you'll most often use <code>LDA $nn,X</code> or
<code>LDA $nn,Y</code>, where <code>nn</code> is the base address in the
zero page.</p>
<p><b>Task:</b> Fill addresses <code>$40..$49</code> with the values
0..9. Use X as the index, and <code>LDA #$00</code> + <code>CLC</code>/<code>ADC #$01</code>
to compute the byte to store.</p>`,
    starter: `; Lesson 6 — fill memory $40..$49 with 0..9
        ORG $300

        LDA #$00
        LDX #$00       ; index
LOOP:   STA $40,X
        CLC
        ADC #$01
        INX
        CPX #$0A
        BNE LOOP

DONE:   JMP DONE
`,
    hints: [
      '`STA $40,X` writes A to address $40+X.',
      'After each store, INX and CPX #$0A: BNE back to LOOP until X=10.',
    ],
    check: (cpu) => {
      let ok = true;
      for (let i = 0; i < 10; i++) if (cpu.mem[0x40 + i] !== i) { ok = false; break; }
      return { ok, message: ok ? '$40..$49 = 0..9 ✓' : 'Some bytes wrong — see Memory panel' };
    }
  },

  {
    id: 'l7',
    title: 'Lesson 7 — Subroutines with JSR and RTS',
    concept: 'reusable code and the stack',
    body: `
<p>A subroutine is called with <code>JSR label</code> and ends with
<code>RTS</code>. <code>JSR</code> pushes the return address minus 1
onto the stack, and <code>RTS</code> pulls it and adds 1.</p>
<p>The 6502 stack is hard-wired to page 1 (addresses <code>$0100</code>
to <code>$01FF</code>), with the stack pointer (<b>SP</b>) starting at
<code>$FD</code> and growing downward.</p>
<p><b>Task:</b> Define a subroutine <code>DOUB</code> that doubles the
value in A (i.e. A = A * 2). Call it so A ends up being 12.</p>`,
    starter: `; Lesson 7 — subroutines
        ORG $300

        LDA #$06
        JSR DOUB       ; A should become 12
        JMP DONE

DOUB:   ASL A          ; A = A << 1 = A * 2
        RTS

DONE:   JMP DONE
`,
    hints: [
      '`ASL A` shifts A left by one bit — that doubles it (and sets C with the bit that fell off).',
      'RTS pulls the return address off the stack and jumps back to right after JSR.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 12;
      return { ok, message: ok ? 'A=12 ✓' : `A=${cpu.A}, expected 12` };
    }
  },

  {
    id: 'l8',
    title: 'Lesson 8 — Decimal mode (BCD)',
    concept: 'SED + ADC for BCD arithmetic',
    body: `
<p>The 6502 has a hardware <b>decimal mode</b>: when <code>SED</code>
sets the D flag, subsequent <code>ADC</code> and <code>SBC</code>
instructions do <b>binary-coded decimal</b> arithmetic. Each byte is
treated as two 4-bit decimal digits (the high nibble is "tens", the
low nibble is "ones").</p>
<p>This is great for things like clocks, scores, and money.</p>
<p><b>Task:</b> Compute <code>5 + 7 = 12</code> in BCD: set decimal
mode, load 5, add 7, then <code>CLD</code> (so future code is binary)
and check A is <code>$12</code>.</p>`,
    starter: `; Lesson 8 — BCD via decimal mode
        ORG $300

        SED
        CLC
        LDA #$05
        ADC #$07
        CLD

DONE:   JMP DONE
`,
    hints: [
      'In BCD, $09 + $01 = $10, not $0A. ADC handles this when D=1.',
      'Always CLD afterwards so your next binary code is safe.',
    ],
    check: (cpu) => {
      const ok = cpu.A === 0x12;
      return { ok, message: ok ? 'A=$12 (BCD 12) ✓' : `A=$${cpu.A.toString(16).padStart(2,'0')}, expected $12` };
    }
  },

  {
    id: 'l9',
    title: 'Lesson 9 — Indirect indexed: ($nn),Y',
    concept: 'pointer tables and reading bytes by index',
    body: `
<p>The 6502 has two powerful indirect modes:</p>
<pre>LDA ($40),Y    ; read byte at address stored at $40, plus Y
LDA ($40,X)    ; read byte at address stored at $40+X
</pre>
<p>The first, <code>($nn),Y</code>, is the "classic" 6502 way to read
a byte from a pointer table. You store a 16-bit pointer at
<code>$nn/$nn+1</code> in the zero page, then <code>LDA ($nn),Y</code>
reads the byte at <code>(pointer + Y)</code>. This is how
AppleSoft BASIC does string indexing.</p>
<p><b>Task:</b> Set the pointer at <code>$40/$41</code> to <code>$50</code>
(so <code>$40 = $50</code>, <code>$41 = $00</code>). Put the value
<code>33</code> at <code>$53</code> (i.e. <code>$50 + 3</code>). Then
read it with <code>LDA ($40),Y</code> where Y = 3.</p>`,
    starter: `; Lesson 9 — indirect indexed addressing
        ORG $300

        ; pointer at $40/$41 points to $50
        LDA #$50
        STA $40
        LDA #$00
        STA $41

        ; put 33 at $50+3 = $53
        LDA #$21        ; 33 = 0x21
        STA $53

        ; now read it
        LDY #$03
        LDA ($40),Y     ; A should be 33

DONE:   JMP DONE
`,
    hints: [
      '`LDA ($40),Y` means: read 16-bit pointer from $40, add Y, then read that address.',
      'Y=3, pointer=$50, so this reads $53.',
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
<p>Combine what you know: a <code>DB</code> directive stores bytes
somewhere in memory (the Apple 1 user-RAM is <code>$0300..$0FFF</code>),
a pointer walks the memory, <code>LDA ($nn),Y</code> reads each byte,
and <code>STA $D010</code> prints it. Stop when you see a zero byte.</p>
<p><b>Task:</b> Print the string <code>"APPLE!"</code> followed by a
CR. Store the string in memory after your code, walk it with a
zero-page pointer, and end on a zero byte.</p>`,
    starter: `; Lesson 10 — print "APPLE!"
        ORG $300

        ; zero-page pointer at $40/$41
        LDA #<STR
        STA $40
        LDA #>STR
        STA $41

        ; Y is the index
        LDY #$00
LOOP:   LDA ($40),Y
        CMP #$00
        BEQ DONE
        STA $D010
        INY
        JMP LOOP

DONE:   JMP DONE

        ; "<" and ">" give the low and high byte of STR's address
STR:    DB "APPLE!", $0D, $00
`,
    hints: [
      '`<STR` and `>STR` are the standard 6502 assembler way to say "low byte of STR\'s address" and "high byte".',
      'Stop when you see a zero byte — your DB line has one at the end.',
    ],
    check: (cpu, sim) => {
      const ok = sim.screen.includes('APPLE!');
      return { ok, message: ok ? `Screen shows "APPLE!" ✓` : `Screen: "${sim.screen}"` };
    }
  }
];

if (typeof window !== 'undefined') window.LESSONS = LESSONS;
