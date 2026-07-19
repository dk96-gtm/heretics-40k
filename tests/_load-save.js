const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<save-core>*/ … /*</save-core>*/ region from index.html and run it
// in THIS realm (mirrors tests/_load.js) so deepStrictEqual sees shared prototypes.
function loadSave() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<save-core>\*\/([\s\S]*?)\/\*<\/save-core>\*\//);
  if (!m) throw new Error('save-core region not found in index.html');
  const SAVE = vm.runInThisContext('(function(){' + m[1] + '\n;return SAVE;})()');
  if (!SAVE) throw new Error('save-core did not define SAVE');
  return SAVE;
}

module.exports = { loadSave };
