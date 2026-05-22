# DSXU V8 Tool Window AB Report

- suite: final-reality-run
- resultLevel: mock
- publicClaimAllowed: false
- generatedAt: 2026-05-19T23:15:49.452Z

## Selection

| profile | selectedWindow | reason |
|---|---:|---|
| single_file_edit | 12 | selected by pass@1=1, verified=1, cost=0.00404 |
| debug | 16 | selected by pass@1=1, verified=1, cost=0.00472 |
| multi_file_refactor | 20 | selected by pass@1=1, verified=1, cost=0.0054 |
| long_task | 24 | selected by pass@1=1, verified=1, cost=0.00608 |
| benchmark | 20 | selected by pass@1=1, verified=1, cost=0.0054 |
| review | 12 | selected by pass@1=1, verified=1, cost=0.00404 |

## Results

| profile | window | pass@1 | verified | cost | latencyMs | starvation | misuse | invalid | falsePass | guards |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| single_file_edit | 8 | 1 | 1 | 0.00352 | 1292 | 1 | 0 | 0 | 0 |  |
| single_file_edit | 12 | 1 | 1 | 0.00404 | 1356 | 0 | 0 | 0 | 0 |  |
| single_file_edit | 16 | 1 | 1 | 0.00488 | 1596 | 0 | 0 | 0 | 0 |  |
| single_file_edit | 20 | 0 | 0 | 0 | 1836 | 0 | 1 | 0 | 0 | visible tool view exceeds V8 single_file_edit max of 16 |
| single_file_edit | 24 | 0 | 0 | 0 | 2076 | 0 | 1 | 1 | 0 | visible tool view exceeds V8 single_file_edit max of 16 |
| single_file_edit | 27 | 0 | 0 | 0 | 2256 | 0 | 1 | 1 | 0 | visible tool view exceeds V8 single_file_edit max of 16 |
| debug | 8 | 0 | 0 | 0 | 1380 | 1 | 0 | 0 | 0 | visible tool view is below V8 debug minimum of 12 |
| debug | 12 | 1 | 1 | 0.0042 | 1444 | 1 | 0 | 0 | 0 |  |
| debug | 16 | 1 | 1 | 0.00472 | 1508 | 0 | 0 | 0 | 0 |  |
| debug | 20 | 1 | 1 | 0.00556 | 1748 | 0 | 0 | 0 | 0 |  |
| debug | 24 | 1 | 1 | 0.0064 | 1988 | 0 | 0 | 0 | 0 |  |
| debug | 27 | 0 | 0 | 0 | 2168 | 0 | 1 | 0 | 0 | visible tool view exceeds V8 debug max of 24 |
| multi_file_refactor | 8 | 0 | 0 | 0 | 1468 | 1 | 0 | 0 | 0 | visible tool view is below V8 multi_file_refactor minimum of 16 |
| multi_file_refactor | 12 | 0 | 0 | 0 | 1532 | 1 | 0 | 0 | 0 | visible tool view is below V8 multi_file_refactor minimum of 16 |
| multi_file_refactor | 16 | 1 | 1 | 0.00488 | 1596 | 1 | 0 | 0 | 0 |  |
| multi_file_refactor | 20 | 1 | 1 | 0.0054 | 1660 | 0 | 0 | 0 | 0 |  |
| multi_file_refactor | 24 | 1 | 1 | 0.00624 | 1900 | 0 | 0 | 0 | 0 |  |
| multi_file_refactor | 27 | 0 | 0 | 0 | 2080 | 0 | 1 | 0 | 0 | visible tool view exceeds V8 multi_file_refactor max of 24 |
| long_task | 8 | 0 | 0 | 0 | 1556 | 1 | 0 | 0 | 0 | visible tool view is below V8 long_task minimum of 16 |
| long_task | 12 | 0 | 0 | 0 | 1620 | 1 | 0 | 0 | 0 | visible tool view is below V8 long_task minimum of 16 |
| long_task | 16 | 1 | 1 | 0.00504 | 1684 | 1 | 0 | 0 | 0 |  |
| long_task | 20 | 1 | 1 | 0.00556 | 1748 | 1 | 0 | 0 | 0 |  |
| long_task | 24 | 1 | 1 | 0.00608 | 1812 | 0 | 0 | 0 | 0 |  |
| long_task | 27 | 1 | 1 | 0.00671 | 1992 | 0 | 0 | 0 | 0 |  |
| benchmark | 8 | 0 | 0 | 0 | 1468 | 1 | 0 | 0 | 0 | visible tool view is below V8 benchmark minimum of 16 |
| benchmark | 12 | 0 | 0 | 0 | 1532 | 1 | 0 | 0 | 0 | visible tool view is below V8 benchmark minimum of 16 |
| benchmark | 16 | 1 | 1 | 0.00488 | 1596 | 1 | 0 | 0 | 0 |  |
| benchmark | 20 | 1 | 1 | 0.0054 | 1660 | 0 | 0 | 0 | 0 |  |
| benchmark | 24 | 1 | 1 | 0.00624 | 1900 | 0 | 0 | 0 | 0 |  |
| benchmark | 27 | 0 | 0 | 0 | 2080 | 0 | 1 | 0 | 0 | visible tool view exceeds V8 benchmark max of 24 |
| review | 8 | 1 | 1 | 0.00352 | 1292 | 1 | 0 | 0 | 0 |  |
| review | 12 | 1 | 1 | 0.00404 | 1356 | 0 | 0 | 0 | 0 |  |
| review | 16 | 1 | 1 | 0.00488 | 1596 | 0 | 0 | 0 | 0 |  |
| review | 20 | 0 | 0 | 0 | 1836 | 0 | 1 | 0 | 0 | visible tool view exceeds V8 review max of 16 |
| review | 24 | 0 | 0 | 0 | 2076 | 0 | 1 | 1 | 0 | visible tool view exceeds V8 review max of 16 |
| review | 27 | 0 | 0 | 0 | 2256 | 0 | 1 | 1 | 0 | visible tool view exceeds V8 review max of 16 |

## Blocked Claims

- mock tool-window AB output is internal evidence only
- Do not publish pass@1, verified completion, or selected windows as public benchmark claims without real_benchmark paired raw evidence
