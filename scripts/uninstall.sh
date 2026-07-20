#!/usr/bin/env bash
# Uninstall Lumen Text from the current OS (Ubuntu/Debian).
#   - removes the "lumen-text" .deb package (NEVER touches "sublime-text", the real Sublime)
#   - refreshes desktop + icon caches so the launcher entry disappears
#   - with --purge, also deletes the user data (settings / session / recent projects)
#
# Usage:
#   sudo ./scripts/uninstall.sh            # remove the app, keep your settings
#   sudo ./scripts/uninstall.sh --purge    # also delete ~/.config/Lumen Text (settings + session)
#
# Needs root (dpkg/apt). Re-runs the sudo'd part automatically if not root.

set -euo pipefail

PKG="lumen-text"            # package name (package.json "name")
KEEP_PKG="sublime-text"     # the REAL Sublime Text — must stay installed

log()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

# Parse args.
PURGE=0
for a in "$@"; do
  case "$a" in
    --purge) PURGE=1 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) die "Unknown option: $a (use --purge or --help)" ;;
  esac
done

# Resolve the real user + home BEFORE elevating (root's $HOME is not the user's).
REAL_USER="${SUDO_USER:-$USER}"
REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"
[ -n "$REAL_HOME" ] || REAL_HOME="$HOME"

# Re-exec as root if needed, carrying the flags through.
if [ "$(id -u)" -ne 0 ]; then
  log "Elevating with sudo…"
  exec sudo -E PURGE="$PURGE" REAL_HOME="$REAL_HOME" REAL_USER="$REAL_USER" bash "$0" "$@"
fi
PURGE="${PURGE:-0}"

# 1) Remove the package (purge its config files too). Guard: never remove KEEP_PKG.
if dpkg -l "$PKG" 2>/dev/null | grep -q '^ii'; then
  log "Removing package: $PKG"
  apt-get remove -y --purge "$PKG" || dpkg -r "$PKG" || die "could not remove $PKG"
else
  log "$PKG is not installed — nothing to remove."
fi

# Safety assertion: the real Sublime must still be installed (if it ever was).
if dpkg -l "$KEEP_PKG" 2>/dev/null | grep -q '^ii'; then
  log "Confirmed: $KEEP_PKG (real Sublime Text) is still installed."
fi

# 2) Optionally delete user data (settings / session / recent projects).
if [ "$PURGE" -eq 1 ]; then
  log "Purging user data for: $REAL_USER ($REAL_HOME)"
  for d in "$REAL_HOME/.config/Lumen Text" "$REAL_HOME/.config/Lumen" "$REAL_HOME/.config/lumen"; do
    if [ -d "$d" ]; then
      rm -rf "$d" && echo "  deleted $d"
    fi
  done
else
  log "Keeping user data (~/.config/Lumen Text). Re-run with --purge to remove it."
fi

# 3) Refresh desktop + icon caches so the launcher entry disappears.
log "Refreshing desktop & icon caches…"
update-desktop-database /usr/share/applications 2>/dev/null || warn "update-desktop-database skipped"
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t /usr/share/icons/hicolor 2>/dev/null || warn "gtk-update-icon-cache skipped"
fi
command -v xdg-desktop-menu >/dev/null 2>&1 && xdg-desktop-menu forceupdate 2>/dev/null || true

# 4) Verify removal.
echo
log "Verification:"
if dpkg -l "$PKG" 2>/dev/null | grep -q '^ii'; then
  warn "  $PKG still appears installed"
else
  echo "  package: removed ✓"
fi
command -v "$PKG" >/dev/null 2>&1 && warn "  binary '$PKG' still in PATH" || echo "  binary : gone ✓"
ls /usr/share/applications/*[Ll]umen*.desktop >/dev/null 2>&1 \
  && warn "  a lumen .desktop entry still exists" || echo "  desktop: gone ✓"

echo
log "Done. If you also installed the AppImage, it's a standalone file — just delete it:"
echo "     rm -f dist/LumenText-*.AppImage    # or wherever you kept it"
log "Log out/in (or restart the shell) if the app menu still shows a cached 'Lumen Text' icon."
