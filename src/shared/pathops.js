'use strict';
// ===========================================================================
// Pure path/name helpers for the sidebar file operations (Phase 8).
// Kept free of DOM / Electron so they can be unit-tested with plain node.
// Exposed both as a CommonJS module (tests) and on window.LUM (renderer).
// ===========================================================================

// Split a filename into { stem, ext } where ext keeps its leading dot.
// A leading dot (dotfiles like ".gitignore") is treated as part of the stem,
// matching how editors let you rename ".gitignore" without eating the name.
function splitName(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { stem: name, ext: '' };
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

// Produce a name not present in `siblings` by appending " copy"/" copy N"
// before the extension (VSCode-style duplicate). `siblings` is any iterable
// of existing names in the target directory.
function dedupeName(siblings, name) {
  const set = siblings instanceof Set ? siblings : new Set(siblings);
  if (!set.has(name)) return name;
  const { stem, ext } = splitName(name);
  // If the stem already ends in " copy" / " copy N", bump the number instead
  // of appending "copy copy".
  const m = stem.match(/^(.*?) copy(?: (\d+))?$/);
  const baseStem = m ? m[1] : stem;
  let n = m && m[2] ? parseInt(m[2], 10) + 1 : 2;
  let candidate = `${baseStem} copy${ext}`;
  if (!set.has(candidate) && !m) return candidate;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    candidate = `${baseStem} copy ${n}${ext}`;
    if (!set.has(candidate)) return candidate;
    n++;
  }
}

// Validate a proposed file/folder name. Returns an error string, or null if ok.
// `siblings` = existing names in the same directory; `original` = the name being
// renamed (so renaming to the same name is not a collision).
function validateName(name, siblings, original) {
  const trimmed = name.trim();
  if (!trimmed) return 'Name cannot be empty';
  if (trimmed === '.' || trimmed === '..') return 'Invalid name';
  // Forbid path separators and characters illegal on common filesystems.
  if (/[\/\\]/.test(trimmed)) return 'Name cannot contain slashes';
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f<>:"|?*]/.test(trimmed)) return 'Name contains illegal characters';
  if (original != null && trimmed === original) return null;
  const set = siblings instanceof Set ? siblings : new Set(siblings || []);
  if (set.has(trimmed)) return `"${trimmed}" already exists`;
  return null;
}

const api = { splitName, dedupeName, validateName };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.LUM = window.LUM || {};
  window.LUM.pathops = api;
}
