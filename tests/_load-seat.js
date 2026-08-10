const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSeat() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<seat-core>\*\/([\s\S]*?)\/\*<\/seat-core>\*\//);
  if (!m) throw new Error('seat-core region not found in index.html');
  const SEAT = vm.runInThisContext('(function(){' + m[1] + '\n;return SEAT;})()');
  if (!SEAT) throw new Error('seat-core did not define SEAT');
  return SEAT;
}

module.exports = { loadSeat };
