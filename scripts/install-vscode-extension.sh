#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT_DIR/integrations/vscode"

if [ ! -f "$SOURCE/package.json" ]; then
  echo "[DSXU] VS Code extension source not found: $SOURCE" >&2
  exit 1
fi

EXTENSIONS_ROOT="${VSCODE_EXTENSIONS:-$HOME/.vscode/extensions}"
TARGET="$EXTENSIONS_ROOT/dsxu-code.dsxu-code-0.1.0"
OBSOLETE="$EXTENSIONS_ROOT/.obsolete"

mkdir -p "$EXTENSIONS_ROOT"
rm -rf "$TARGET"
mkdir -p "$TARGET"

cp "$SOURCE/package.json" "$TARGET/package.json"
cp "$SOURCE/extension.js" "$TARGET/extension.js"
cp "$SOURCE/README.md" "$TARGET/README.md"
cp "$SOURCE/CHANGELOG.md" "$TARGET/CHANGELOG.md"
cp "$SOURCE/.vscodeignore" "$TARGET/.vscodeignore"

if [ -f "$OBSOLETE" ]; then
  python3 - "$OBSOLETE" <<'PY' || true
import json
import sys
path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if "dsxu-code.dsxu-code-0.1.0" in data:
        del data["dsxu-code.dsxu-code-0.1.0"]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
        print("[DSXU] Removed stale VS Code obsolete marker: dsxu-code.dsxu-code-0.1.0")
except Exception as exc:
    print(f"[DSXU] Could not update VS Code obsolete marker: {exc}")
PY
fi

echo "[DSXU] VS Code extension installed to: $TARGET"
echo "[DSXU] Reload VS Code, then run: DSXU Code: Open"
echo "[DSXU] If your DSXU checkout is not the opened workspace, set dsxuCode.repoPath."
