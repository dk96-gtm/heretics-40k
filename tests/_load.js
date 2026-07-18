const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<thread-core>*/ ... /*</thread-core>*/ region from index.html and
// run it in THIS realm (wrapped IIFE returns THREAD) so objects the core creates
// share the test realm's Array/Object prototypes — deepStrictEqual works and nothing
// leaks to globalThis.
function loadThread() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<thread-core>\*\/([\s\S]*?)\/\*<\/thread-core>\*\//);
  if (!m) throw new Error('thread-core region not found in index.html');
  const THREAD = vm.runInThisContext('(function(){' + m[1] + '\n;return THREAD;})()');
  if (!THREAD) throw new Error('thread-core did not define THREAD');
  return THREAD;
}

module.exports = { loadThread };
