const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCadence() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<cadence-core>\*\/([\s\S]*?)\/\*<\/cadence-core>\*\//);
  if (!m) throw new Error('cadence-core region not found in index.html');
  const CAD = vm.runInThisContext('(function(){' + m[1] + '\n;return CAD;})()');
  if (!CAD) throw new Error('cadence-core did not define CAD');
  return CAD;
}

module.exports = { loadCadence };
