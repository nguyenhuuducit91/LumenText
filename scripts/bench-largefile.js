'use strict';

// Benchmark the large-file engine on a real multi-GB file.
//   node scripts/bench-largefile.js [sizeMB] [filePath]
// Reports index throughput and random line-read latency.

const fs = require('fs');
const path = require('path');
const lf = require('../src/main/largefile.js');

const sizeMB = parseInt(process.argv[2] || '2048', 10);
const file = process.argv[3] || path.join(__dirname, '..', '.bench', 'bigfile.txt');

function hrms() {
  return Number(process.hrtime.bigint() / 1000n) / 1000; // ms with µs precision
}

function generate(target, bytes) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target) && fs.statSync(target).size >= bytes) {
    console.log(`Reusing existing ${target} (${(fs.statSync(target).size / 1e9).toFixed(2)} GB)`);
    return;
  }
  console.log(`Generating ${(bytes / 1e9).toFixed(2)} GB test file at ${target} ...`);
  const fd = fs.openSync(target, 'w');
  const CHUNK = 4 * 1024 * 1024;
  let buf = '';
  let written = 0;
  let lineNo = 0;
  const t0 = hrms();
  while (written < bytes) {
    buf = '';
    while (buf.length < CHUNK) {
      buf += `line ${lineNo}: the quick brown fox jumps over the lazy dog — café 中文 😀 ${'x'.repeat(lineNo % 40)}\n`;
      lineNo++;
    }
    const b = Buffer.from(buf, 'utf8');
    fs.writeSync(fd, b);
    written += b.length;
  }
  fs.closeSync(fd);
  console.log(`  wrote ${lineNo} lines in ${((hrms() - t0) / 1000).toFixed(1)}s`);
}

(async () => {
  const bytes = sizeMB * 1024 * 1024;
  generate(file, bytes);

  const s = lf.open(file);
  console.log(`\nFile: ${(s.size / 1e9).toFixed(3)} GB`);

  // --- index build ---
  const t0 = hrms();
  let lastPct = -1;
  await s.buildIndex((p) => {
    const pct = Math.floor((p.bytes / p.size) * 100);
    if (pct !== lastPct && pct % 20 === 0) {
      process.stdout.write(`  indexing ${pct}%\r`);
      lastPct = pct;
    }
  });
  const idxMs = hrms() - t0;
  const gbps = s.size / 1e9 / (idxMs / 1000);
  console.log(
    `\nIndex built:   ${idxMs.toFixed(0)} ms   ` +
      `(${gbps.toFixed(2)} GB/s)   lines=${s.lineCount.toLocaleString()}   ` +
      `checkpoints=${s.checkpoints.length.toLocaleString()}   ` +
      `index RAM≈${(s.checkpoints.length * 8 / 1e6).toFixed(1)} MB`
  );

  // --- random line reads ---
  const READS = 500;
  const PAGE = 60; // lines per fetch (a screenful)
  const lat = [];
  // deterministic pseudo-random (no Math.random dependency on seed) for repeatability
  let seed = 123456789;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < READS; i++) {
    const start = Math.floor(rnd() * Math.max(1, s.lineCount - PAGE));
    const t = hrms();
    const lines = s.readLines(start, PAGE);
    lat.push(hrms() - t);
    if (lines.length !== Math.min(PAGE, s.lineCount)) {
      throw new Error(`short read at ${start}: got ${lines.length}`);
    }
  }
  lat.sort((a, b) => a - b);
  const avg = lat.reduce((a, b) => a + b, 0) / lat.length;
  console.log(
    `Random reads:  ${READS} × ${PAGE} lines   ` +
      `avg=${avg.toFixed(2)}ms  p50=${lat[Math.floor(READS * 0.5)].toFixed(2)}ms  ` +
      `p99=${lat[Math.floor(READS * 0.99)].toFixed(2)}ms  max=${lat[READS - 1].toFixed(2)}ms`
  );

  lf.close(s.id);
  console.log('\nOK — engine handled the file without loading it into memory.');
})();
