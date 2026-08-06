const fs = require('node:fs');
const path = require('path');
const vm = require('node:vm');

// Extracts the two marked glue regions from index.html and evals them against the real
// THREAD — same technique as tests/_load.js. Extended export list for T-CMB-2/3; names
// that don't exist yet (bfCondItemsOf, weaponCondEffects land in later tasks) resolve null.
function loadCondGlue(THREAD) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const parse = html.match(/\/\*<item-parse-glue>\*\/([\s\S]*?)\/\*<\/item-parse-glue>\*\//);
  const glue = html.match(/\/\*<cond-staging-glue>\*\/([\s\S]*?)\/\*<\/cond-staging-glue>\*\//);
  if (!parse) throw new Error('item-parse-glue region not found in index.html');
  if (!glue) throw new Error('cond-staging-glue region not found in index.html');
  const names = ['condTagsOf', 'condEffectsFor', 'livingAllies', 'cleanseReach',
    'condIsHostile', 'parseItem', 'bfCondItemsOf', 'weaponCondEffects'];
  const ret = names.map(n => n + ':(typeof ' + n + '==="undefined"?null:' + n + ')').join(',');
  const src = '(function(THREAD){' + parse[1] + '\n' + glue[1] + '\n;return {' + ret + '};})';
  return vm.runInThisContext(src)(THREAD);
}
module.exports = { loadCondGlue };
