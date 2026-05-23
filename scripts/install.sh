#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

INSTALL_DEPENDENCIES=1
CREATE_DESKTOP_SHORTCUT=1
CREATE_PATH_SHIM=1
INSTALL_VSCODE_EXTENSION=0

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      cat <<'EOF'
DSXU Code Unix/WSL installer

Usage:
  bash ./scripts/install.sh [options]

Options:
  --help, -h                 Show this help.
  --no-dependencies          Skip bun install.
  --no-desktop-shortcut      Skip desktop launcher creation.
  --no-path-shim             Skip ~/.local/bin/dsxu-code creation.
  --install-vscode-extension Copy the DSXU VS Code adapter into ~/.vscode/extensions.
EOF
      exit 0
      ;;
    --no-dependencies)
      INSTALL_DEPENDENCIES=0
      ;;
    --no-desktop-shortcut)
      CREATE_DESKTOP_SHORTCUT=0
      ;;
    --no-path-shim)
      CREATE_PATH_SHIM=0
      ;;
    --install-vscode-extension)
      INSTALL_VSCODE_EXTENSION=1
      ;;
    *)
      echo "[DSXU] Unknown install option: $arg" >&2
      echo "[DSXU] Run: bash ./install.sh --help" >&2
      exit 2
      ;;
  esac
done

export PATH="$HOME/.bun/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
export LANG="${LANG:-C.UTF-8}"
export LC_ALL="${LC_ALL:-C.UTF-8}"
export PYTHONIOENCODING="${PYTHONIOENCODING:-utf-8}"
export TERM="${TERM:-xterm-256color}"
export COLORTERM="${COLORTERM:-truecolor}"
export FORCE_COLOR="${FORCE_COLOR:-1}"

if ! command -v bun >/dev/null 2>&1; then
  echo "[DSXU] Bun was not found. Install Bun first:" >&2
  echo "       curl -fsSL https://bun.sh/install | bash" >&2
  echo "       then open a new terminal and rerun scripts/install.sh" >&2
  exit 127
fi

if [ "$INSTALL_DEPENDENCIES" = "1" ]; then
  echo "[DSXU] Installing dependencies with Bun..."
  bun install --frozen-lockfile
else
  echo "[DSXU] Skipping dependency install (--no-dependencies)."
fi

if [ "$CREATE_PATH_SHIM" = "1" ]; then
  mkdir -p "$HOME/.local/bin"
  cat > "$HOME/.local/bin/dsxu-code" <<EOF
#!/usr/bin/env bash
exec "$ROOT_DIR/bin/dsxu-code" "\$@"
EOF
  chmod +x "$HOME/.local/bin/dsxu-code"
  echo "[DSXU] Command shim created: $HOME/.local/bin/dsxu-code"
else
  echo "[DSXU] Skipping path shim (--no-path-shim)."
fi

if [ "$CREATE_DESKTOP_SHORTCUT" != "1" ]; then
  echo "[DSXU] Skipping desktop shortcut (--no-desktop-shortcut)."
elif grep -qi microsoft /proc/version 2>/dev/null; then
  WIN_USER_DIR="$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r' || true)"
  if [ -n "$WIN_USER_DIR" ]; then
    WIN_DESKTOP="$(wslpath -u "$WIN_USER_DIR")/Desktop"
    if [ -d "$WIN_DESKTOP" ]; then
      CMD_PATH="$WIN_DESKTOP/DSXU Code WSL.cmd"
      WSL_REPO="$(wslpath -w "$ROOT_DIR")"
      {
        printf '@echo off\r\n'
        printf 'setlocal\r\n'
        printf 'chcp 65001 >nul\r\n'
        printf 'call "%s\\\\Start-DSXU-Code-WSL.cmd" %%*\r\n' "$WSL_REPO"
        printf 'exit /b %%ERRORLEVEL%%\r\n'
      } > "$CMD_PATH"
      echo "[DSXU] WSL desktop command created: $CMD_PATH"
      echo "[DSXU] Windows repo path: $WSL_REPO"
    fi
  fi
elif command -v xdg-user-dir >/dev/null 2>&1; then
  DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
  if [ -n "$DESKTOP_DIR" ] && [ -d "$DESKTOP_DIR" ]; then
    DESKTOP_FILE="$DESKTOP_DIR/dsxu-code.desktop"
    cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=DSXU Code
Comment=Launch DSXU Code
Exec=$ROOT_DIR/bin/dsxu-code
Terminal=true
Categories=Development;
EOF
    chmod +x "$DESKTOP_FILE"
    echo "[DSXU] Desktop launcher created: $DESKTOP_FILE"
  fi
fi

if [ "$INSTALL_VSCODE_EXTENSION" = "1" ]; then
  bash "$ROOT_DIR/scripts/install-vscode-extension.sh"
fi

echo
echo "[DSXU] Install complete."
echo "[DSXU] Ensure ~/.local/bin is on PATH, then run: dsxu-code"
echo "[DSXU] First launch without a key opens the DeepSeek key setup flow."
