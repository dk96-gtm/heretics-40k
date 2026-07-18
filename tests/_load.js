const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<thread-core>*/ ... /*</thread-core>*/ region from index.html
// and evaluate it in a sandbox, returning the THREAD global it defines.
function loadThread() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<thread-core>\*\/([\s\S]*?)\/\*<\/thread-core>\*\//);
  if (!m) throw new Error('thread-core region not found in index.html');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(m[1] + '\n;this.THREAD = THREAD;', sandbox);
  if (!sandbox.THREAD) throw new Error('thread-core did not define THREAD');
  return sandbox.THREAD;
}

module.exports = { loadThread };
