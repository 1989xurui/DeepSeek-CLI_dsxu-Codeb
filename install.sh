#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
DSXU Code installer

Usage:
  bash ./install.sh [options]

Options:
  --help, -h                 Show this help.
  --no-dependencies          Skip bun install.
  --no-desktop-shortcut      Skip desktop launcher creation.
  --no-path-shim             Skip ~/.local/bin/dsxu-code creation.

Windows users should prefer:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
EOF
  exit 0
fi

case "$(uname -s 2>/dev/null || true)" in
  Linux*|Darwin*)
    exec bash "$ROOT_DIR/scripts/install.sh" "$@"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    echo "[DSXU] Git Bash/MSYS detected on Windows."
    echo "[DSXU] Use the Windows installer for desktop shortcuts and UTF-8 launcher:"
    echo "       powershell -NoProfile -ExecutionPolicy Bypass -File ./install.ps1"
    exit 0
    ;;
  *)
    echo "[DSXU] Unsupported shell platform. Try one of:"
    echo "       powershell -NoProfile -ExecutionPolicy Bypass -File ./install.ps1"
    echo "       bash ./scripts/install.sh"
    exit 1
    ;;
esac
