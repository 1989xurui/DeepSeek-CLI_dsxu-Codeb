# Changelog

## Unreleased - V20

Status: PARTIAL, not final release.

Added:
- GitHub open-source productization documentation entrypoints.
- DSXU install, configuration, doctor/health, tool surface, permission/security, contributing, and release runbook docs.
- README release status and V20 owner discipline.

Changed:
- README now states DSXU mainline entrypoints and release gates explicitly.
- Provider-migration fallback is documented as explicit boundary, not default runtime.

Known limits:
- Final V20 release still requires owner/Git signoff, deletion-state review, ACL residue closure, real-gap productization, six-stage tests, and clean export.
- `package.json` remains `private: true` until release gates allow publication.
