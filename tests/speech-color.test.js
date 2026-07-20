const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
// eval just the helper region so we can unit-test it without a DOM
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m = html.match(/\/\*<speech-core>\*\/([\s\S]*?)\/\*<\/speech-core>\*\//);
if(!m) throw new Error('speech-core region not found');
const ctx = {}; vm.runInNewContext(m[1]+'\n;this.SPEECH_PALETTE=SPEECH_PALETTE;this.pickSpeechColor=pickSpeechColor;', ctx);
const { SPEECH_PALETTE, pickSpeechColor } = ctx;

test('owned model gets a stable palette colour by roster index', () => {
  const roster = [{n:'Castellan Thorne'},{n:'Scout 1'}];
  const c0 = pickSpeechColor('Castellan Thorne', roster, SPEECH_PALETTE);
  assert.strictEqual(c0, SPEECH_PALETTE[0]);
  assert.strictEqual(roster[0].speechColor, SPEECH_PALETTE[0], 'cached on the model');
  // resolves by short name too, and stays stable
  assert.strictEqual(pickSpeechColor('Castellan Thorne', roster, SPEECH_PALETTE), c0);
});

test('an explicit speechColor overrides the default', () => {
  const roster = [{n:'Kane', speechColor:'#123456'}];
  assert.strictEqual(pickSpeechColor('Kane', roster, SPEECH_PALETTE), '#123456');
});

test('non-roster speaker (NPC) is deterministic by name', () => {
  const a = pickSpeechColor('Brood-Tyrant Sskarith', [], SPEECH_PALETTE);
  const b = pickSpeechColor('Brood-Tyrant Sskarith', [], SPEECH_PALETTE);
  assert.strictEqual(a, b);
  assert.ok(SPEECH_PALETTE.indexOf(a) >= 0);
});
