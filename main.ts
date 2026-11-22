// Tiny stack VM for make.fun's tiny-stack-vm-01-run-20261122 bounty.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const STACK_MAX = 256, CALLS_MAX = 64, MEM_WORDS = 256;
const STEP_LIMIT = 1_000_000, OUTPUT_MAX = 65_536;
const T_UNDER = 2, T_OVER = 3, T_DIV0 = 4, T_BADOP = 5, T_MEM = 6,
  T_CALL = 7, T_RET = 8, T_PC = 9, T_STEPS = 10, T_OUT = 11;

const OPS = new Map([
  [0x00, ['HALT', 0, 0, 0]], [0x01, ['PUSH8', 1, 0, 1]], [0x02, ['PUSH32', 4, 0, 1]],
  [0x03, ['POP', 0, 1, 0]], [0x04, ['DUP', 0, 1, 2]], [0x05, ['SWAP', 0, 2, 2]],
  [0x06, ['OVER', 0, 2, 3]], [0x07, ['ROT', 0, 3, 3]],
  [0x10, ['ADD', 0, 2, 1]], [0x11, ['SUB', 0, 2, 1]], [0x12, ['MUL', 0, 2, 1]],
  [0x13, ['DIV', 0, 2, 1]], [0x14, ['MOD', 0, 2, 1]], [0x15, ['DIVU', 0, 2, 1]],
  [0x16, ['MODU', 0, 2, 1]], [0x17, ['NEG', 0, 1, 1]], [0x18, ['AND', 0, 2, 1]],
  [0x19, ['OR', 0, 2, 1]], [0x1a, ['XOR', 0, 2, 1]], [0x1b, ['NOT', 0, 1, 1]],
  [0x1c, ['SHL', 0, 2, 1]], [0x1d, ['SHR', 0, 2, 1]], [0x1e, ['SHRU', 0, 2, 1]],
  [0x20, ['EQ', 0, 2, 1]], [0x21, ['LT', 0, 2, 1]], [0x22, ['LTU', 0, 2, 1]],
  [0x30, ['JMP', 2, 0, 0]], [0x31, ['JZ', 2, 1, 0]], [0x32, ['JNZ', 2, 1, 0]],
  [0x33, ['CALL', 2, 0, 0]], [0x34, ['RET', 0, 0, 0]],
  [0x40, ['LOAD', 0, 1, 1]], [0x41, ['STORE', 0, 2, 0]],
  [0x50, ['PRINT', 0, 1, 0]], [0x51, ['PUTC', 0, 1, 0]],
  [0x52, ['IN', 0, 0, 1]], [0x53, ['EXIT', 0, 1, 0]],
]);

function binop(name, a, b) {
  switch (name) {
    case 'ADD': return (a + b) | 0;
    case 'SUB': return (a - b) | 0;
    case 'MUL': return Math.imul(a, b);
    case 'DIV':
      if (b === 0) return T_DIV0;
      return (a === -2147483648 && b === -1) ? a : (a / b) | 0;
    case 'MOD':
      if (b === 0) return T_DIV0;
      return b === -1 ? 0 : (a % b) | 0;
    case 'DIVU':
      if (b === 0) return T_DIV0;
      return Math.floor((a >>> 0) / (b >>> 0)) | 0;
    case 'MODU':
      if (b === 0) return T_DIV0;
      return ((a >>> 0) % (b >>> 0)) | 0;
    case 'AND': return a & b;
    case 'OR': return a | b;
    case 'XOR': return a ^ b;
    case 'SHL': return a << (b & 31);
    case 'SHR': return a >> (b & 31);
    case 'SHRU': return (a >>> (b & 31)) | 0;
    case 'EQ': return a === b ? 1 : 0;
    case 'LT': return a < b ? 1 : 0;
    case 'LTU': return (a >>> 0) < (b >>> 0) ? 1 : 0;
  }
}
const BINARY = new Set(['ADD','SUB','MUL','DIV','MOD','DIVU','MODU','AND','OR','XOR',
  'SHL','SHR','SHRU','EQ','LT','LTU']);

function run(program, input) {
  const n = program.length;
  const D = new Int32Array(STACK_MAX);
  let sp = 0;
  const C = new Int32Array(CALLS_MAX);
  let csp = 0;
  const M = new Int32Array(MEM_WORDS);
  const out = new Uint8Array(OUTPUT_MAX);
  let olen = 0, inPos = 0, pc = 0, steps = 0;
  const stop = (exit) => ({ stdout: out.slice(0, olen), exit });
  for (;;) {
    if (steps === STEP_LIMIT) return stop(T_STEPS);
    if (pc < 0 || pc >= n) return stop(T_PC);
    const op = OPS.get(program[pc]);
    if (op === undefined) return stop(T_BADOP);
    const [name, imm, pops, pushes] = op;
    if (pc + imm >= n) return stop(T_PC);
    const next = pc + 1 + imm;
    if (sp < pops) return stop(T_UNDER);
    if (sp - pops + pushes > STACK_MAX) return stop(T_OVER);
    steps++;
    pc = next;
    if (BINARY.has(name)) {
      if ((name === 'DIV' || name === 'MOD' || name === 'DIVU' || name === 'MODU') && D[sp - 1] === 0) {
        return stop(T_DIV0);
      }
      const r = binop(name, D[sp - 2], D[sp - 1]);
      sp -= 2;
      D[sp++] = r;
      continue;
    }
    switch (name) {
      case 'HALT': return stop(0);
      case 'PUSH8': D[sp++] = (program[next - 1] << 24) >> 24; break;
      case 'PUSH32':
        D[sp++] = program[next - 4] | (program[next - 3] << 8)
          | (program[next - 2] << 16) | (program[next - 1] << 24);
        break;
      case 'POP': sp--; break;
      case 'DUP': D[sp] = D[sp - 1]; sp++; break;
      case 'SWAP': { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 'OVER': D[sp] = D[sp - 2]; sp++; break;
      case 'ROT': { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 'NEG': D[sp - 1] = -D[sp - 1] | 0; break;
      case 'NOT': D[sp - 1] = ~D[sp - 1]; break;
      case 'JMP':
      case 'JZ':
      case 'JNZ': {
        let take = true;
        if (name !== 'JMP') take = D[--sp] === 0 ? name === 'JZ' : name === 'JNZ';
        if (take) {
          const rel = ((program[next - 2] | (program[next - 1] << 8)) << 16) >> 16;
          pc = next + rel;
        }
        break;
      }
      case 'CALL':
        if (csp === CALLS_MAX) return stop(T_CALL);
        C[csp++] = next;
        pc = program[next - 2] | (program[next - 1] << 8);
        break;
      case 'RET':
        if (csp === 0) return stop(T_RET);
        pc = C[--csp];
        break;
      case 'LOAD': {
        const addr = D[sp - 1];
        if (addr < 0 || addr >= MEM_WORDS) return stop(T_MEM);
        D[sp - 1] = M[addr];
        break;
      }
      case 'STORE': {
        const addr = D[sp - 1];
        if (addr < 0 || addr >= MEM_WORDS) return stop(T_MEM);
        M[addr] = D[sp - 2];
        sp -= 2;
        break;
      }
      case 'PRINT': {
        const s = String(D[sp - 1]);
        if (olen + s.length > OUTPUT_MAX) return stop(T_OUT);
        sp--;
        for (let i = 0; i < s.length; i++) out[olen++] = s.charCodeAt(i);
        break;
      }
      case 'PUTC':
        if (olen + 1 > OUTPUT_MAX) return stop(T_OUT);
        out[olen++] = D[--sp] & 255;
        break;
      case 'IN': D[sp++] = inPos < input.length ? input[inPos++] : -1; break;
      case 'EXIT': return stop(D[--sp] & 255);
    }
  }
}

for (const id of readdirSync(IN).sort()) {
  const dir = join(IN, id);
  const res = run(readFileSync(join(dir, 'program.bin')), readFileSync(join(dir, 'input.bin')));
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), res.stdout);
  writeFileSync(join(OUT, id, 'exit.txt'), `${res.exit}\n`);
}
