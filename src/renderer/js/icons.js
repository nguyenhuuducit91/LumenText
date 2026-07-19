'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Inline-SVG file/folder icons in the spirit of VSCode's Material / Seti icon
// themes: each file type gets a distinct, colour-coded glyph (a rounded tile
// with a language monogram, or a dedicated glyph for images/archives). No
// external icon font — everything is self-contained and theme-independent.
// ===========================================================================
LUM.icons = (function () {
  // extension -> tile colour
  const COLOR = {
    js: '#e5c07b', mjs: '#e5c07b', cjs: '#e5c07b', jsx: '#61dafb',
    ts: '#3178c6', tsx: '#61dafb',
    json: '#e5c07b', jsonc: '#e5c07b', json5: '#e5c07b',
    md: '#519aba', markdown: '#519aba', mdx: '#519aba',
    html: '#e34c26', htm: '#e34c26', xml: '#e37933', xhtml: '#e34c26',
    css: '#519aba', scss: '#c678dd', sass: '#c678dd', less: '#2a6db5',
    py: '#4b8bbe', pyc: '#4b8bbe', pyw: '#4b8bbe',
    rs: '#dea584',
    go: '#00add8',
    c: '#599eff', h: '#a074c4', cpp: '#659ad2', cc: '#659ad2', hpp: '#a074c4', cxx: '#659ad2', hxx: '#a074c4',
    java: '#e76f00', class: '#e76f00', kt: '#a97bff', kts: '#a97bff',
    rb: '#cc342d', php: '#8892bf', swift: '#f05138',
    sh: '#89e051', bash: '#89e051', zsh: '#89e051', fish: '#89e051',
    yml: '#cb171e', yaml: '#cb171e', toml: '#9c4221', ini: '#6d8086', conf: '#6d8086', cfg: '#6d8086', env: '#e5c07b',
    sql: '#cbb171', graphql: '#e10098', gql: '#e10098', proto: '#61afef',
    lua: '#4f7dc0', vim: '#019833', r: '#276dc3', dart: '#00b4ab', scala: '#de3423',
    ex: '#a274a6', exs: '#a274a6', erl: '#a90533', clj: '#63b132',
    vue: '#41b883', svelte: '#ff3e00', astro: '#ff5d01',
    png: '#a074c4', jpg: '#a074c4', jpeg: '#a074c4', gif: '#a074c4', webp: '#a074c4', bmp: '#a074c4', ico: '#a074c4', svg: '#ffb13b',
    pdf: '#e5252a', doc: '#2b579a', docx: '#2b579a', xls: '#217346', xlsx: '#217346', ppt: '#d24726', pptx: '#d24726',
    zip: '#afb42b', tar: '#afb42b', gz: '#afb42b', rar: '#afb42b', '7z': '#afb42b',
    txt: '#8a919c', log: '#8a919c', csv: '#217346',
    lock: '#8a919c'
  };
  // extension -> monogram shown on the tile (defaults to the ext, upper-cased)
  const LABEL = {
    js: 'JS', mjs: 'JS', cjs: 'JS', jsx: 'JSX',
    ts: 'TS', tsx: 'TSX',
    json: '{}', jsonc: '{}', json5: '{}',
    md: 'M↓', markdown: 'M↓', mdx: 'M↓',
    html: '<>', htm: '<>', xhtml: '<>', xml: 'XML',
    css: '#', scss: '#', sass: '#', less: '#',
    py: 'PY', pyc: 'PY', pyw: 'PY',
    rs: 'RS', go: 'GO',
    c: 'C', h: 'H', cpp: 'C++', cc: 'C++', hpp: 'H', cxx: 'C++', hxx: 'H',
    java: 'JV', class: 'JV', kt: 'KT', kts: 'KT',
    rb: 'RB', php: 'PHP', swift: 'SW',
    sh: '$_', bash: '$_', zsh: '$_', fish: '$_',
    yml: 'YML', yaml: 'YML', toml: 'TML', ini: 'INI', conf: 'CFG', cfg: 'CFG', env: 'ENV',
    sql: 'SQL', graphql: 'GQL', gql: 'GQL', proto: 'PB',
    lua: 'LUA', vim: 'VIM', r: 'R', dart: 'DT', scala: 'SCL',
    ex: 'EX', exs: 'EX', erl: 'ERL', clj: 'CLJ',
    vue: 'V', svelte: 'SV', astro: 'A',
    txt: 'TXT', log: 'LOG', csv: 'CSV', lock: '',
    doc: 'W', docx: 'W', xls: 'X', xlsx: 'X', ppt: 'P', pptx: 'P'
  };
  // special whole-filename matches (checked before extension)
  const SPECIAL = {
    'package.json': { c: '#8bc34a', l: 'npm' },
    'package-lock.json': { c: '#8a919c', l: 'npm' },
    'tsconfig.json': { c: '#3178c6', l: 'TS' },
    'dockerfile': { c: '#2496ed', l: 'DKR' },
    '.dockerignore': { c: '#2496ed', l: 'DKR' },
    'makefile': { c: '#6d8086', l: 'MK' },
    'cmakelists.txt': { c: '#6d8086', l: 'CM' },
    '.gitignore': { c: '#f14e32', l: 'GIT' },
    '.gitattributes': { c: '#f14e32', l: 'GIT' },
    '.gitmodules': { c: '#f14e32', l: 'GIT' },
    'license': { c: '#e5c07b', l: 'LIC' },
    'license.md': { c: '#e5c07b', l: 'LIC' },
    '.editorconfig': { c: '#6d8086', l: 'EC' },
    '.npmrc': { c: '#cb3837', l: 'npm' },
    '.env': { c: '#e5c07b', l: 'ENV' },
    '.eslintrc': { c: '#4b32c3', l: 'ES' },
    '.prettierrc': { c: '#56b3b4', l: 'PR' }
  };
  const IMAGE = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg', 'avif', 'tiff']);
  const ARCHIVE = new Set(['zip', 'tar', 'gz', 'rar', '7z', 'tgz', 'bz2', 'xz']);

  function extOf(name) {
    const lower = name.toLowerCase();
    const dot = lower.lastIndexOf('.');
    return dot > 0 ? lower.slice(dot + 1) : '';
  }
  function colorFor(name) {
    const lower = name.toLowerCase();
    if (SPECIAL[lower]) return SPECIAL[lower].c;
    return COLOR[extOf(name)] || '#8a919c';
  }

  function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // Rounded colour tile with a monogram — the workhorse glyph for code files.
  function tile(color, label) {
    const txt = escAttr(label || '');
    const n = [...txt].length;
    const fs = n <= 1 ? 8.5 : n === 2 ? 7 : 5.4;
    const dark = '#1c2128';
    return (
      `<svg class="ic" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">` +
      `<rect x="1.5" y="2" width="13" height="12" rx="2.6" fill="${color}"/>` +
      (txt ? `<text x="8" y="8" dy="0.36em" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="${fs}" font-weight="700" fill="${dark}">${txt}</text>` : '') +
      `</svg>`
    );
  }

  // Picture glyph (frame + mountains + sun) for image assets.
  function imageGlyph(color) {
    return (
      `<svg class="ic" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">` +
      `<rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="${color}" stroke-width="1.3"/>` +
      `<circle cx="5.2" cy="6" r="1.3" fill="${color}"/>` +
      `<path fill="${color}" d="M3 12.5l3.2-3.6 2.1 2.2 2.4-2.9 2.3 4.3H3Z"/>` +
      `</svg>`
    );
  }

  // Archive glyph (a zipped box).
  function archiveGlyph(color) {
    return (
      `<svg class="ic" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">` +
      `<rect x="2.5" y="1.5" width="11" height="13" rx="1.6" fill="${color}"/>` +
      `<rect x="7.2" y="1.5" width="1.6" height="9" fill="#1c2128" fill-opacity="0.55"/>` +
      `<rect x="6.6" y="9.5" width="2.8" height="3.4" rx="0.6" fill="#1c2128" fill-opacity="0.7"/>` +
      `</svg>`
    );
  }

  function fileSVG(name) {
    const lower = name.toLowerCase();
    const sp = SPECIAL[lower];
    if (sp) return tile(sp.c, sp.l);
    const ext = extOf(name);
    if (IMAGE.has(ext)) return imageGlyph(COLOR[ext] || '#a074c4');
    if (ARCHIVE.has(ext)) return archiveGlyph(COLOR[ext] || '#afb42b');
    const color = COLOR[ext] || '#8a919c';
    const label = (ext in LABEL) ? LABEL[ext] : (ext ? ext.toUpperCase().slice(0, 3) : '');
    return tile(color, label);
  }

  function folderSVG(open) {
    const c = open ? '#5c9fd6' : '#7aa2c4';
    return (
      `<svg class="ic" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">` +
      `<path fill="${c}" d="M1.5 3.25C1.5 2.56 2.06 2 2.75 2h3.09c.4 0 .78.19 1.02.51l.78 1.04c.05.06.12.1.2.1H13.25c.69 0 1.25.56 1.25 1.25v7.35c0 .69-.56 1.25-1.25 1.25H2.75c-.69 0-1.25-.56-1.25-1.25V3.25Z"/>` +
      (open
        ? `<path fill="#1c2128" fill-opacity="0.16" d="M1.5 6h13v6.5c0 .69-.56 1.25-1.25 1.25H2.75c-.69 0-1.25-.56-1.25-1.25V6Z"/>`
        : `<path fill="#ffffff" fill-opacity="0.12" d="M1.5 5.9h13v.9h-13z"/>`) +
      `</svg>`
    );
  }

  return {
    file: fileSVG,
    folder: folderSVG,
    colorFor,
    extOf
  };
})();
