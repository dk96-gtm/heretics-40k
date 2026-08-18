const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCadenceRegion() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<cadence-core>\*\/([\s\S]*?)\/\*<\/cadence-core>\*\//);
  if (!m) throw new Error('cadence-core region not found in index.html');
  const result = vm.runInThisContext('(function(){' + m[1] + '\n;return {CAD:CAD,CHRON:CHRON};})()');
  if (!result || !result.CAD) throw new Error('cadence-core did not define CAD');
  if (!result.CHRON) throw new Error('cadence-core did not define CHRON');
  return result;
}

function loadCadence() {
  return loadCadenceRegion().CAD;
}

function loadChron() {
  return loadCadenceRegion().CHRON;
}

module.exports = { loadCadence, loadChron };
