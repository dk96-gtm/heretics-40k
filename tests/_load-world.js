const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<world-core>*/ ... /*</world-core>*/ region from index.html and run it in
// THIS realm (IIFE returns WORLD) — same pattern as _load.js / _load-loadout.js.
function loadWorld() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<world-core>\*\/([\s\S]*?)\/\*<\/world-core>\*\//);
  if (!m) throw new Error('world-core region not found in index.html');
  const WORLD = vm.runInThisContext('(function(){' + m[1] + '\n;return WORLD;})()');
  if (!WORLD) throw new Error('world-core did not define WORLD');
  return WORLD;
}

module.exports = { loadWorld };
