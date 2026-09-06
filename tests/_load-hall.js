const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHall() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<hall-core>\*\/([\s\S]*?)\/\*<\/hall-core>\*\//);
  if (!m) throw new Error('hall-core region not found in index.html');
  const result = vm.runInThisContext('(function(){' + m[1] + '\n;return HALL;})()');
  if (!result || !result.patronsAt) throw new Error('hall-core did not define HALL');
  return result;
}
module.exports = { loadHall };
