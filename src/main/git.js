'use strict';

const { execFile } = require('child_process');
const path = require('path');

// ===========================================================================
// Thin wrapper around the `git` CLI (no heavy native dependency). Every call is
// scoped to a repo root and fails soft (returns null / empty) outside a repo.
// ===========================================================================
const MAX = 64 * 1024 * 1024;

function run(cwd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, maxBuffer: MAX, encoding: opts.encoding || 'utf8', windowsHide: true },
      (err, stdout) => resolve(err ? null : stdout));
  });
}

// Repository root for a directory, or null if not inside a git work tree.
async function root(dir) {
  const out = await run(dir, ['rev-parse', '--show-toplevel']);
  return out ? out.trim() : null;
}

// Current branch name (or short SHA when detached).
async function branch(repo) {
  const b = await run(repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (b && b.trim() && b.trim() !== 'HEAD') return { name: b.trim(), detached: false };
  const sha = await run(repo, ['rev-parse', '--short', 'HEAD']);
  return { name: sha ? sha.trim() : '(no commits)', detached: true };
}

// Working-tree status: { branch, detached, files: { absPath: 'XY' } }.
async function status(repo) {
  const br = await branch(repo);
  const out = await run(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const files = {};
  if (out) {
    const toks = out.split('\0');
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (!t || t.length < 4) continue;
      const code = t.slice(0, 2);
      const rel = t.slice(3);
      // renamed/copied entries carry the original path in the next token
      if (code[0] === 'R' || code[0] === 'C') i++;
      files[path.join(repo, rel)] = code;
    }
  }
  return { branch: br.name, detached: br.detached, files };
}

// Contents of a file at HEAD (for gutter diff). null if the file is new.
async function headFile(repo, absPath) {
  let rel = path.relative(repo, absPath);
  if (rel.startsWith('..')) return null;
  rel = rel.split(path.sep).join('/');
  return run(repo, ['show', 'HEAD:' + rel]); // null on error (untracked / new)
}

module.exports = { root, status, branch, headFile };
