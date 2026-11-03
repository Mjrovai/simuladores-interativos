# Z80 Lab — Learn Z80 Assembly

A self-contained, single-page **Z80 simulator and tutorial**. No build step,
no network — open `z80.html` and start writing Z80 assembly.

    open z80-lab/z80.html        # or drag-and-drop into your browser

The package includes:

| File | Purpose |
|---|---|
| `z80-lab/z80.html` | The app: editor, debugger, lesson browser, memory view, console |
| `z80-lab/z80.js` | Z80 CPU core (registers, flags, memory, instruction execution) |
| `z80-lab/z80-asm.js` | Two-pass assembler: text mnemonics → bytes |
| `z80-lab/z80-tutorial.js` | 10 progressive lessons with auto-grading checks |
| `z80-lab/test-z80.js` / `z80-lab/test-flow.js` | Node smoke tests |

Run the tests from inside the folder:

    cd z80-lab && node test-z80.js && node test-flow.js

## What you can do

- **Edit** Z80 assembly in a syntax-highlighted editor with line numbers
- **Assemble** with a click (Ctrl+B). Errors show up inline.
- **Step** through a program one instruction at a time (F8)
- **Run** at adjustable speed (F5), with breakpoints and stop on HALT
- **Inspect** all registers and the seven flags in real time
- **Watch** memory with PC, SP, HL, IX, IY highlighted
- **Print** characters to the on-screen console via `OUT (0), A`
- **Learn** through 10 guided lessons with auto-checking
- **Browse** 4 example programs (Hello world, nested DJNZ, BCD, LDIR copy)

## Lessons (auto-graded)

1. Your first instructions: `LD` — load values into A, B and memory
2. Arithmetic: `ADD` and `SUB` — meet the flags
3. Loops with `DJNZ` — repeat code using B as a counter
4. Conditional jumps — `JR Z` / `JR NZ` and `CP`
5. Output to the "console" port — `OUT (0), A`
6. Memory and HL as a pointer — fill an array
7. Subroutines with `CALL` and `RET` — the stack
8. 16-bit add and BCD — `DAA`
9. Indexed addressing — `LD A, (IX+2)`
10. Capstone: print a string

Each lesson shows the concept, gives a starter program, and provides hints.
Click **Check ✓** to run the program and auto-grade it.

## Supported instructions (subset of the full Z80)

- 8-bit loads: `LD r, r'`, `LD r, n`, `LD r, (HL)`, `LD (HL), r`, `LD A, (BC)`, `LD A, (DE)`, `LD A, (nn)`, `LD (nn), A`
- 16-bit loads: `LD dd, nn` (BC, DE, HL, SP, IX, IY), `LD HL, (nn)`, `LD BC/DE, (nn)`, `LD SP, HL`
- Indexed: `LD r, (IX+d)`, `LD (IX+d), r`, `LD (IX+d), n` (also IY)
- Stack: `PUSH/POP BC, DE, HL, AF, IX, IY`
- Arithmetic: `ADD A, r/n/(HL)/(IX+d)`, `ADC`, `SUB`, `SBC`, `AND`, `OR`, `XOR`, `CP`
- 16-bit: `ADD HL, ss`, `ADD IX/IY, pp`, `INC/DEC ss`, `INC/DEC r`, `INC/DEC (HL)`, `INC/DEC (IX+d)`
- Rotates: `RLCA`, `RRCA`, `RLA`, `RRA` (accumulator); `RLC/RRC/RL/RR/SLA/SRA/SRL/SLL` (any reg or indexed)
- Bit: `BIT b, r`, `SET b, r`, `RES b, r` (including indexed)
- Jumps: `JP nn`, `JP HL/IX/IY`, `JP cc, nn`, `JR e`, `JR cc, e`, `DJNZ e`
- Calls: `CALL nn`, `CALL cc, nn`, `RET`, `RET cc`, `RST p`
- I/O: `OUT (n), A`, `IN A, (n)`
- Misc: `EX AF, AF'`, `EX DE, HL`, `EX (SP), HL/IX/IY`, `EXX`, `DAA`, `CPL`, `SCF`, `CCF`, `NEG`, `NOP`, `HALT`, `DI`, `EI`, `IM 0/1/2`
- Block: `LDIR`, `LDDR`, `RLD`, `RRD`
- Data: `ORG`, `EQU`, `DB` / `DEFB` / `DEFM`, `DW` / `DEFW`, `DS`

## Number formats accepted by the assembler

| Form | Example | Meaning |
|---|---|---|
| decimal | `42` | 42 |
| hex (Zilog) | `$2A` | 42 |
| hex (C) | `0x2A` | 42 |
| binary | `%00101010` | 42 |
| char literal | `'A'` | 65 (ASCII) |
| expression | `START + 1` | label math |

## Tested with

- All 10 lesson check functions pass (see `test-flow.js`)
- Extended smoke tests cover ADD HL, BIT, RLC, RST, PUSH/POP, EXX, NEG, EX DE,HL, IN/OUT
- Headless Chrome render verified (page contains the lesson content)

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Tab` | Insert 4 spaces in editor |
| `Ctrl+B` / `Cmd+B` | Assemble program |
| `F5` | Run / Stop |
| `F8` | Step one instruction |
| `Click listing address` | Toggle breakpoint at that address |
| `Shift+Click listing address` | Jump PC to that address |

## Implementation notes

- The CPU core is **cycle-approximate, not cycle-accurate**: it returns
  Z80 T-state counts for each instruction but timing is otherwise symbolic.
- The assembler does a true two-pass build: pass 1 collects labels and
  estimates instruction sizes; pass 2 emits bytes. Forward references work.
- The simulator visualizes the stack pointer (SP) in green, the program
  counter (PC) in orange, and the indirect registers (HL/IX/IY) in blue
  inside the memory view.
- Output port 0 streams to a console panel on the right.
- "Follow PC" mode auto-scrolls the memory view to wherever the CPU is
  currently executing.
- Progress is local to your browser (in-memory only); no server needed.

## Limitations (intentional, for a teaching tool)

- No cycle-accurate timing or interrupt handling model.
- No undocumented/rarely-used instructions beyond the bit tricks (`SLL`).
- No macro facility, no include paths, no listing-to-file export.
- Memory model is flat 64 KiB; no MMU, no paging.
- The "screen" is just port 0 → text; there's no pixel framebuffer.
