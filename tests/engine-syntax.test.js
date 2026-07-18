// Headless boot-proxy: compile index.html's inline <script> without executing
// it (vm.Script parses but does not run, so DOM/global references are fine).
// Catches any syntax break in the engine without needing a browser.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('index.html has exactly one inline script block', () => {
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  assert.strictEqual(blocks.length, 1, 'expected a single inline <script>');
});

test('the engine script parses (no syntax error)', () => {
  const m = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(m, 'inline script found');
  assert.doesNotThrow(() => new vm.Script(m[1]), 'engine script must compile');
});
