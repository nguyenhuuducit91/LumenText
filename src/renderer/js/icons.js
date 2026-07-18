'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Lightweight inline-SVG file/folder icons, coloured by file type.
// No external icon font — everything is self-contained and theme-independent.
// ===========================================================================
LUM.icons = (function () {
  // extension -> colour
  const COLOR = {
    js: '#e5c07b', mjs: '#e5c07b', cjs: '#e5c07b', jsx: '#e5c07b',
    ts: '#61afef', tsx: '#61afef',
    json: '#e5c07b', jsonc: '#e5c07b',
    md: '#56b6c2', markdown: '#56b6c2',
    html: '#e06c75', htm: '#e06c75', xml: '#e06c75',
    css: '#61afef', scss: '#c678dd', sass: '#c678dd', less: '#61afef',
    py: '#98c379',
    rs: '#d19a66',
    go: '#56b6c2',
    c: '#61afef', h: '#61afef', cpp: '#61afef', cc: '#61afef', hpp: '#61afef', cxx: '#61afef',
    java: '#e06c75', kt: '#c678dd',
    rb: '#e06c75', php: '#c678dd', swift: '#e06c75',
    sh: '#98c379', bash: '#98c379', zsh: '#98c379', fish: '#98c379',
    yml: '#e5c07b', yaml: '#e5c07b', toml: '#e5c07b', ini: '#e5c07b', conf: '#e5c07b', env: '#e5c07b',
    lock: '#6b727d',
    sql: '#56b6c2', graphql: '#e06c75', proto: '#61afef',
    lua: '#61afef', vim: '#98c379',
    png: '#c678dd', jpg: '#c678dd', jpeg: '#c678dd', gif: '#c678dd', svg: '#c678dd', webp: '#c678dd', ico: '#c678dd',
    pdf: '#e06c75', zip: '#d19a66', tar: '#d19a66', gz: '#d19a66',
    txt: '#828a99', log: '#6b727d'
  };
  const SPECIAL = {
    'package.json': '#98c379',
    'package-lock.json': '#6b727d',
    'tsconfig.json': '#61afef',
    'dockerfile': '#61afef',
    'makefile': '#d19a66',
    'cmakelists.txt': '#98c379',
    '.gitignore': '#e06c75',
    '.gitattributes': '#e06c75',
    'license': '#e5c07b',
    'readme.md': '#56b6c2'
  };

  function extOf(name) {
    const lower = name.toLowerCase();
    const dot = lower.lastIndexOf('.');
    return dot > 0 ? lower.slice(dot + 1) : '';
  }
  function colorFor(name) {
    const lower = name.toLowerCase();
    if (SPECIAL[lower]) return SPECIAL[lower];
    return COLOR[extOf(name)] || '#828a99';
  }

  function fileSVG(name) {
    const c = colorFor(name);
    return (
      `<svg class="ic" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">` +
      `<path fill="${c}" d="M3 1.75C3 .78 3.78 0 4.75 0H9l4 4v10.25c0 .97-.78 1.75-1.75 1.75h-6.5C3.78 16 3 15.22 3 14.25V1.75Z"/>` +
      `<path fill="#ffffff" fill-opacity="0.28" d="M9 0l4 4H9.75A.75.75 0 0 1 9 3.25V0Z"/>` +
      `</svg>`
    );
  }

  function folderSVG(open) {
    const c = open ? '#7cb0e0' : '#5f8bbd';
    return (
      `<svg class="ic" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">` +
      `<path fill="${c}" d="M1.5 3.25C1.5 2.56 2.06 2 2.75 2h3.09c.4 0 .78.19 1.02.51l.78 1.04c.05.06.12.1.2.1H13.25c.69 0 1.25.56 1.25 1.25v7.35c0 .69-.56 1.25-1.25 1.25H2.75c-.69 0-1.25-.56-1.25-1.25V3.25Z"/>` +
      (open ? `<path fill="#000000" fill-opacity="0.12" d="M1.5 6h13v6.5c0 .69-.56 1.25-1.25 1.25H2.75c-.69 0-1.25-.56-1.25-1.25V6Z"/>` : '') +
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
