const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function loadDoor() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<door-core>\*\/([\s\S]*?)\/\*<\/door-core>\*\//);
  if (!m) throw new Error('door-core region not found in index.html');
  const DOOR = vm.runInThisContext('(function(){' + m[1] + '\n;return DOOR;})()');
  if (!DOOR) throw new Error('door-core did not define DOOR');
  return DOOR;
}
module.exports = { loadDoor };
