#!/usr/bin/env bash
# Reinstall Lumen Text on the current OS (Ubuntu/Debian).
#   - removes the OLD package "sublime-text-plus" (NEVER touches "sublime-text", the real Sublime)
#   - installs the freshly built Lumen Text .deb from dist/
#   - refreshes desktop + icon caches so the app menu shows the new name/icon
#
# Usage:  sudo ./scripts/reinstall.sh
# Needs root (dpkg/apt). Re-runs the sudo'd part automatically if not root.

set -euo pipefail

OLD_PKG="sublime-text-plus"     # our previous package — safe to remove
NEW_PKG="lumen-text"            # new package name (package.json "name")
KEEP_PKG="sublime-text"         # the REAL Sublime Text — must stay installed

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_DIR/dist"

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

# Locate the newest LumenText*.deb
DEB="$(ls -t "$DIST_DIR"/LumenText-*.deb 2>/dev/null | head -1 || true)"
[ -n "$DEB" ] || die "No LumenText-*.deb found in $DIST_DIR. Run: npm run dist:deb"

# Re-exec as root if needed (keeps the resolved $DEB path)
if [ "$(id -u)" -ne 0 ]; then
  log "Elevating with sudo…"
  exec sudo -E DEB="$DEB" bash "$0" "$@"
fi
DEB="${DEB:-$DEB}"

log "Package to install : $DEB"
log "Removing old pkg   : $OLD_PKG (keeping $KEEP_PKG)"

# 1) Remove the old package if present (purge config too). Guard: never remove KEEP_PKG.
if dpkg -l "$OLD_PKG" 2>/dev/null | grep -q '^ii'; then
  apt-get remove -y --purge "$OLD_PKG" || dpkg -r "$OLD_PKG" || warn "could not remove $OLD_PKG"
else
  log "$OLD_PKG not installed — nothing to remove."
fi

# Safety assertion: the real Sublime must still be installed.
if dpkg -l "$KEEP_PKG" 2>/dev/null | grep -q '^ii'; then
  log "Confirmed: $KEEP_PKG (real Sublime Text) is still installed."
else
  warn "$KEEP_PKG is not installed (was it ever?) — continuing."
fi

# 2) Install the new .deb, then fix any missing dependencies.
log "Installing $NEW_PKG…"
dpkg -i "$DEB" || { log "Resolving dependencies…"; apt-get install -f -y; }

# 3) Refresh desktop + icon caches so the launcher shows the new name/icon.
log "Refreshing desktop & icon caches…"
update-desktop-database /usr/share/applications 2>/dev/null || warn "update-desktop-database skipped"
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor 2>/dev/null || warn "gtk-update-icon-cache skipped"
fi
command -v xdg-desktop-menu >/dev/null 2>&1 && xdg-desktop-menu forceupdate 2>/dev/null || true

# 4) Verify.
echo
log "Verification:"
dpkg -l "$NEW_PKG" 2>/dev/null | grep '^ii' || warn "$NEW_PKG not showing as installed"
BIN="$(command -v "$NEW_PKG" || true)"
[ -n "$BIN" ] && echo "  binary : $BIN" || warn "  binary '$NEW_PKG' not found in PATH"
DESKTOP="$(ls /usr/share/applications/*[Ll]umen*.desktop 2>/dev/null | head -1 || true)"
[ -n "$DESKTOP" ] && echo "  desktop: $DESKTOP" || warn "  no lumen .desktop entry found"
ICON="$(ls /usr/share/icons/hicolor/512x512/apps/*[Ll]umen* 2>/dev/null | head -1 || true)"
[ -n "$ICON" ] && echo "  icon   : $ICON" || warn "  no hicolor 512 icon found (may use a different path)"

echo
log "Done. Launch with:  $NEW_PKG   (or find 'Lumen Text' in the app menu; log out/in if the icon is cached)."
