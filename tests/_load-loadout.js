const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<loadout-core>*/ ... /*</loadout-core>*/ region from index.html and
// run it in THIS realm (IIFE returns LOADOUT) — same pattern as _load.js for thread-core.
function loadLoadout() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<loadout-core>\*\/([\s\S]*?)\/\*<\/loadout-core>\*\//);
  if (!m) throw new Error('loadout-core region not found in index.html');
  const LOADOUT = vm.runInThisContext('(function(){' + m[1] + '\n;return LOADOUT;})()');
  if (!LOADOUT) throw new Error('loadout-core did not define LOADOUT');
  return LOADOUT;
}

module.exports = { loadLoadout };
