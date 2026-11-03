# Apple 1 Lab — Learn 6502 Assembly

A self-contained simulator and tutorial for the **Apple 1** — Steve Wozniak's
1976 single-board computer built around the **MOS 6502** CPU. Includes
the original Woz Monitor, a 6502 assembler, a debugger, and ten
progressive lessons.

    open apple1-lab/a1.html        # or drag-and-drop into your browser

## Files

| File | Purpose |
|---|---|
| `apple1-lab/a1.html` | The app: editor, registers, memory, screen, debugger, lesson browser |
| `apple1-lab/a1-cpu.js` | 6502 CPU core (registers, flags, all 13 addressing modes, ~150 instructions) |
| `apple1-lab/a1-asm.js` | Two-pass assembler |
| `apple1-lab/a1-woz.js` | Woz Monitor ROM (256 bytes at $FF00) + I/O hooks for $D010/$D011 |
| `apple1-lab/a1-lessons.js` | 10 progressive lessons with auto-grading checks |
| `apple1-lab/test-a1.js` / `test-lessons.js` | Node smoke + lesson tests |

Run the tests from inside the folder:

    cd apple1-lab && node test-a1.js && node test-lessons.js

## The Apple 1, in 30 seconds

- 1 MHz MOS 6502 CPU
- 4 KB of RAM ($0000..$0FFF), 4 KB of ROM ($E000..$FFFF on the real
  Apple 1; this simulator loads the Woz Monitor at $FF00..$FFFF)
- A "dumb terminal" interface: writing a byte to `$D010` shows it on
  the screen, reading `$D011` returns the next key press
- Programs are entered by hand using the Woz Monitor commands and
  start with `ORG $300` (which is what the Woz Monitor's `0R` runs
  by default after reset on the real machine)
- No video chip, no sound, no interrupts — just CPU, RAM, and a
  character stream

## Lessons (auto-graded)

1. `LDA` and `STA` — load and store
2. `ADC` and `SBC` — arithmetic on the accumulator
3. `LDX` + `DEX` + `BNE` — loops with X as a counter
4. `CMP` + `BEQ` — conditional branches
5. `STA $D010` — output to the Apple 1 screen
6. `STA $40,X` — indexed addressing, filling memory
7. `JSR` / `RTS` — subroutines
8. `SED` + `ADC` — decimal mode (BCD)
9. `LDA ($40),Y` — indirect indexed addressing
10. Capstone: print `"APPLE!"` using a string pointer

Each lesson has a starter program, a concept explanation, hints, and
a `check()` function the UI runs to grade your code.

## Supported instructions (full 6502 + common aliases)

- **Loads:** `LDA`, `LDX`, `LDY` (immediate, zero-page, zero-page,X/Y,
  absolute, absolute,X/Y, (zp,X), (zp),Y)
- **Stores:** `STA`, `STX`, `STY` (all 7 addressing modes)
- **Arithmetic:** `ADC`, `SBC` (binary + decimal mode), `INC`/`DEC` (mem + regs)
- **Logic:** `AND`, `ORA`, `EOR` (all 7 modes)
- **Compare:** `CMP`, `CPX`, `CPY`
- **Bit test:** `BIT` (zp + abs)
- **Shifts/rotates:** `ASL`, `LSR`, `ROL`, `ROR` (A + memory)
- **Branches:** `BPL`/`BCC`/`BNE`/etc. (8 condition codes)
- **Jumps:** `JMP` (abs + indirect), `JSR`/`RTS`
- **Stack:** `PHA`/`PLA`, `PHP`/`PLP`, `TSX`/`TXS`, `RTI`
- **Transfers:** `TAX`/`TXA`/`TAY`/`TYA`
- **Flag ops:** `CLC`/`SEC`/`CLD`/`SED`/`CLI`/`SEI`/`CLV`
- **Interrupts:** `BRK` (pushes P with B=1, vectors via $FFFE)
- **Aliases/undocumented:** 0xF3 = SBC (zp),Y; 0xEB = SBC #imm

## Number formats

| Form | Example | Meaning |
|---|---|---|
| decimal | `42` | 42 |
| hex (Woz) | `$2A` | 42 |
| hex (C) | `0x2A` | 42 |
| binary | `%00101010` | 42 |
| char literal | `'A'` | 65 (ASCII) |
| low byte | `<LABEL` | `LABEL & 0xFF` |
| high byte | `>LABEL` | `LABEL >> 8` |

## The Woz Monitor

The original Apple 1's 256-byte ROM was the **Woz Monitor**, a tiny
shell that gives you three commands:

| Command | Meaning |
|---|---|
| `0: 12 34 56` | deposit bytes 12 34 56 starting at address 0 |
| `0. 12 34 56` | examine memory starting at 0 (read those bytes) |
| `0R` | run program at address 0 (sets PC there, exits monitor) |

The original ROM is loaded at `$FF00..$FFFF` in the simulator. The
real ROM uses several undocumented 6502 opcodes (SLO, etc.) for
compactness; for clarity, the simulator runs a JavaScript
re-implementation of the same monitor logic when you click
**Woz Monitor (ROM)** in the Examples list. The screen panel on the
right accepts typed characters; press <kbd>Enter</kbd> to send a
line + CR to the monitor.

## Apple 1 I/O

- **$D010 write** — appends the byte to the on-screen panel
- **$D011 read** — pops a character from the keyboard queue
  (set up via the right-side input box; the original Apple 1 used
  the high bit set with no key, cleared with a key press)

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Tab` | Indent in editor |
| `Ctrl+B` | Assemble |
| `F5` | Run / stop |
| `F8` | Step one instruction |
| Click listing address | Toggle breakpoint |
| Shift+click listing address | Jump PC |

## Implementation notes

- 6502 cycle counts are reported but not used for timing.
- The page-boundary bug on indirect JMP is faithfully reproduced.
- The cross-page read bug on 16-bit pointer reads is also reproduced
  (so `LDA ($FF),Y` reads `$FF` and `$00` instead of `$FF` and `$100`).
- The "always-1" bit 5 and the B flag are visible in the flag panel.
- Decimal mode is correctly implemented for both ADC and SBC.
- Woz Monitor is a JS re-implementation; the original 256-byte ROM
  bytes are still in memory for inspection, just not executed.
- The "halt" pattern in lessons is `DONE: JMP DONE`. The run timer
  detects this (5 consecutive identical PCs) and stops automatically.

## Tested with

- 10 smoke tests (`test-a1.js`) all pass
- 10 lesson auto-checks (`test-lessons.js`) all pass
- Headless Chrome renders the UI successfully (1400x900)
