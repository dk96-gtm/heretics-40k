const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<agency-core>*/ ... /*</agency-core>*/ region from index.html and run it in
// THIS realm (IIFE returns ULT) — same pattern as _load.js / _load-world.js.
function loadAgency() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<agency-core>\*\/([\s\S]*?)\/\*<\/agency-core>\*\//);
  if (!m) throw new Error('agency-core region not found in index.html');
  const ULT = vm.runInThisContext('(function(){' + m[1] + '\n;return ULT;})()');
  if (!ULT) throw new Error('agency-core did not define ULT');
  return ULT;
}

module.exports = { loadAgency };
