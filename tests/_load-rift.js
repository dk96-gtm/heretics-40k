const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<rift-core>*/ … /*</rift-core>*/ region from index.html and run it
// in THIS realm (wrapped IIFE returns RIFT). Same pattern as _load.js (thread-core).
function loadRift() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<rift-core>\*\/([\s\S]*?)\/\*<\/rift-core>\*\//);
  if (!m) throw new Error('rift-core region not found in index.html');
  const RIFT = vm.runInThisContext('(function(){' + m[1] + '\n;return RIFT;})()');
  if (!RIFT) throw new Error('rift-core did not define RIFT');
  return RIFT;
}

module.exports = { loadRift };
