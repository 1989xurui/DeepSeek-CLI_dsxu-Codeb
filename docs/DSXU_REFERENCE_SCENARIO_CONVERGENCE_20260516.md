# DSXU Reference Scenario Convergence - 2026-05-16

This report merges the V26 174 scenario pool, the 1000 generated reference scenario backlog, and the 67/82 capability acceptance audit into eight executable packets.

Summary: sourceRows=1174, rowsFrom174=174, rowsFrom1000=1000, P0=257, P1=451, P2=466.

| packet | status | rows 174 | rows 1000 | P0 | P1 | P2 | capability gaps | next action |
|---|---|---:|---:|---:|---:|---:|---|---|
| EP-01 Source Truth + Cache | accepted-core | 61 | 150 | 72 | 94 | 45 | none | Code-mode source capsule and bounded Read fallback are accepted; rerun during final six-stage verification and continue with EP-02 visible-state evidence. |
| EP-02 Visible State + Tool/Permission | accepted-core | 14 | 189 | 83 | 81 | 39 | none | Visible-state projection contract is accepted for Tool/Permission/Agent/MCP/Skill evidence; rerun during final UI/TUI parity and continue EP-05 DeepSeek cost-quality gate. |
| EP-03 Terminal Live Acceptance | accepted-core | 15 | 151 | 62 | 72 | 32 | B12:TerminalBench Subset Adapter [adapted/subset+tested]; B13:Internal Terminal-10/30 Runner [adapted/subset+tested] | EP-03 live evidence is closed; keep B12/B13 as boundary-only claims and rerun during final six-stage verification. |
| EP-04 Agent/MCP/Skill Boundary | accepted-core | 12 | 100 | 0 | 48 | 64 | PZ07:Multi-Agent Swarm/Coordinator [adapted/subset+tested] | Agent/MCP/Skill boundary board is accepted; continue EP-08 external benchmark/adapter proof and keep final six-stage verification pending. |
| EP-05 DeepSeek Cost Quality | accepted-core | 28 | 100 | 26 | 57 | 45 | M07:FIM local completion [adapted/subset+tested]; A14:Pro Reviewer [adapted/subset+tested] | Cost-quality board is accepted for Flash-first cost and evidenced Pro admission; continue EP-04 Agent/MCP/Skill Boundary while public 90 and high-cache ROI claims remain guarded. |
| EP-06 Release Claim + Open Source | ready-for-execution | 21 | 155 | 3 | 49 | 124 | none | Rebuild GitHub launch pack only from strict public claims and real charts. |
| EP-07 Workspace/Owner/Git Hygiene | needs-owner-review | 13 | 50 | 6 | 25 | 32 | none | Use owner/Git packets for dirty attribution and replace/delete candidates; do not auto clean. |
| EP-08 External Benchmark/Adapter Proof | needs-live-evidence | 10 | 105 | 5 | 25 | 85 | A16:Internal Code-10/30 Runner [adapted/subset+tested]; A17:SWE Smoke Runner [adapted/subset+tested]; PZ03:BrowserExecutor [adapted/subset+tested] | Adapter/browser/provider proof is guarded; import real target manifest before external comparison, public 90, or clean export claims. |

Owner coverage:

| packet | files existing | files missing | tests existing | tests missing |
|---|---:|---:|---:|---:|
| EP-01 | 5 | 0 | 5 | 0 |
| EP-02 | 5 | 0 | 4 | 0 |
| EP-03 | 5 | 0 | 4 | 0 |
| EP-04 | 6 | 0 | 6 | 0 |
| EP-05 | 5 | 0 | 4 | 0 |
| EP-06 | 4 | 0 | 3 | 0 |
| EP-07 | 3 | 0 | 2 | 0 |
| EP-08 | 6 | 0 | 5 | 0 |
