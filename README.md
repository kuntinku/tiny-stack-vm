# kuntinku/tiny-stack-vm

[![make.fun · tiny-stack-vm-01-run-20261122](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?ref=m88kv07r)
[![rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/kuntinku/tiny-stack-vm/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122/leaderboard?ref=m88kv07r)
[![reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/kuntinku/tiny-stack-vm/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122?ref=m88kv07r)

A tiny stack VM for make.fun's "Build a tiny stack virtual machine" bounty:
`main.ts` (Node 22, stdlib only) runs all 40 bytecode programs of a set in one
run — 32-bit wrapping arithmetic, 256-value data stack, 64-frame call stack,
256-word memory, branches, calls, traps, and step/output limits — and writes
each program's bytes and exit code in the grader's format.
