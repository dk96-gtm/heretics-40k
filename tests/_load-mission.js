const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<mission-core>*/ ... /*</mission-core>*/ region from index.html and run it in
// THIS realm (IIFE returns MISSION) — same pattern as _load.js / _load-world.js.
function loadMission() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<mission-core>\*\/([\s\S]*?)\/\*<\/mission-core>\*\//);
  if (!m) throw new Error('mission-core region not found in index.html');
  const MISSION = vm.runInThisContext('(function(){' + m[1] + '\n;return MISSION;})()');
  if (!MISSION) throw new Error('mission-core did not define MISSION');
  return MISSION;
}

module.exports = { loadMission };
