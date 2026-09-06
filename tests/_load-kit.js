const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<kit-core>*/ ... /*</kit-core>*/ region from index.html and run it in
// THIS realm (IIFE returns KIT) — same pattern as _load-cadence.js / _load-agency.js.
function loadKit() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<kit-core>\*\/([\s\S]*?)\/\*<\/kit-core>\*\//);
  if (!m) throw new Error('kit-core region not found in index.html');
  const KIT = vm.runInThisContext('(function(){' + m[1] + '\n;return KIT;})()');
  if (!KIT) throw new Error('kit-core did not define KIT');
  return KIT;
}

module.exports = { loadKit };
