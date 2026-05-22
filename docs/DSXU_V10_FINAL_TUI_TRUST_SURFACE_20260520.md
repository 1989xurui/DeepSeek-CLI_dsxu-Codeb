# DSXU V10 Final TUI Trust Surface Evidence

Status: PASS_V10_FINAL_TUI_TRUST_SURFACE

Public claim allowed: false

| check | status | elapsedMs |
|---|---|---:|
| compact-trust-evidence-line-scroll-resize | PASS | 1801 |
| terminal-reliability-pack | PASS | 31194 |
| streaming-and-model-driven-health | PASS | 1964 |
| real-pty-long-content-resize-tail | PASS | 23518 |
| real-pty-permission-review-resize | PASS | 23642 |
| real-pty-middle-scrollback-resize | PASS | 23668 |

Blockers: none

Coverage:
- compact trust status lines
- final usage/evidence line suppression
- scroll resize anchoring
- terminal reliability pack
- streaming UI health and auth/progress states
- real PTY long-content resize sticky tail
- real PTY permission review visibility after resize
- real PTY middle scrollback resize anchoring

Rule: This is focused TUI trust evidence. It does not replace final six-stage acceptance or live provider benchmark evidence.
