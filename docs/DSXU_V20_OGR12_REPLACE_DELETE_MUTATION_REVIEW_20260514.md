# DSXU V20 OGR-12 Replace/Delete Mutation Review - 2026-05-14

## Decision

OGR-12 no-import shared utilities are not accepted as shared runtime or generic support. This file is regenerated after correcting TypeScript `.js` specifier resolution to `.ts/.tsx` source files and after removing the single duplicate desktop deep-link helper from source.

Total candidates: 1

| Packet | Count |
|---|---:|
| OGR12-delete-duplicate-desktop-deeplink-helper | 1 |

## Rule

No file in this list may be kept only because it sits under `utils` or `services`. Keep requires import/use evidence and a named owner. Delete/move requires owner/Git review; no stage, commit, reset, clean, or export was performed here.

Evidence files:

- docs/generated/DSXU_V20_OGR12_REPLACE_DELETE_MUTATION_REVIEW_20260514.csv
- docs/generated/DSXU_V20_OGR12_REPLACE_DELETE_MUTATION_REVIEW_SUMMARY_20260514.json
