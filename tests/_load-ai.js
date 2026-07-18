const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function loadAI() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<ai-core>\*\/([\s\S]*?)\/\*<\/ai-core>\*\//);
  if (!m) throw new Error('ai-core region not found in index.html');
  const NPCAI = vm.runInThisContext('(function(){' + m[1] + '\n;return NPCAI;})()');
  if (!NPCAI) throw new Error('ai-core did not define NPCAI');
  return NPCAI;
}
module.exports = { loadAI };
