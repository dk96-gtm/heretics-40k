const test = require('node:test');
const assert = require('node:assert');
const { loadAI } = require('./_load-ai');
const NPCAI = loadAI();

test('ai-core: loads and exposes NPCAI', () => {
  assert.ok(NPCAI && typeof NPCAI === 'object');
  assert.ok(Array.isArray(NPCAI.PHASES) && NPCAI.PHASES.length === 8);
});

test('ai-core: stampAt maps elapsed real time to day/phase (block_minutes=60)', () => {
  const B = 60, E = 0;
  assert.deepEqual(NPCAI.stampAt(E, 0, B), { day: 1, phase: 'Early Morning', blockIndex: 0, phaseIndex: 0 });
  // 30 min = one phase -> Morning
  assert.equal(NPCAI.stampAt(E, 30 * 60000, B).phase, 'Morning');
  // 4h = 8 phases = exactly one day -> Day 2, Early Morning
  assert.deepEqual(NPCAI.stampAt(E, 4 * 60 * 60000, B), { day: 2, phase: 'Early Morning', blockIndex: 0, phaseIndex: 0 });
});

test('ai-core: elapsed counts phases/blocks/days between two instants', () => {
  const B = 60;
  const r = NPCAI.elapsed(0, 4 * 60 * 60000 + 30 * 60000, B); // one day + one phase
  assert.deepEqual(r, { phases: 9, blocks: 4, days: 1 });
});

test('ai-core: instantiate uses authored value; records spawn + empty drift', () => {
  const seed = { ferocity: { value: 88, plasticity: 12, floor: 72, ceiling: 100 } };
  const b = NPCAI.instantiate(seed, () => 0);
  assert.equal(b.ferocity.value, 88);
  assert.equal(b.ferocity.spawn, 88);
  assert.deepEqual(b.ferocity.drift, []);
});

test('ai-core: instantiate rolls a distribution seed within floor/ceiling', () => {
  const seed = { cunning: { base: 30, spread: 10, plasticity: 20, floor: 10, ceiling: 70 } };
  const hi = NPCAI.instantiate(seed, () => 1).cunning.value;   // +spread
  const lo = NPCAI.instantiate(seed, () => -1).cunning.value;  // -spread
  assert.equal(hi, 40);
  assert.equal(lo, 20);
});

test('ai-core: driftClamp respects plasticity window and floor/ceiling', () => {
  const b = NPCAI.instantiate({ honor: { value: 40, plasticity: 12, floor: 10, ceiling: 100 } }, () => 0);
  assert.equal(NPCAI.driftClamp(b, 'honor', 6, 'shown mercy', 1), 6);   // 40 -> 46
  assert.equal(b.honor.value, 46);
  assert.equal(NPCAI.driftClamp(b, 'honor', 50, 'huge', 2), 6);         // capped at spawn+plasticity=52
  assert.equal(b.honor.value, 52);
  assert.equal(b.honor.drift.length, 2);
});

test('ai-core: worldScope keeps only horizon-relevant public forces + local history', () => {
  const world = {
    met: ['vess'],
    forces: { vigilus: [['The Rotward', 'plague host', 'Ashravine']], kraith: [['Hive Fleet', 'tyranids', 'Drift']] },
    history: { 'vigilus/carrion': ['A broker deal soured.'], 'kraith/drift': ['Something woke.'] }
  };
  const horizon = { sectors: ['vigilus'], factions: ['Drukhari'], themes: ['trade'] };
  const r = NPCAI.worldScope(world, horizon, 'vigilus/carrion');
  assert.deepEqual(r.knownForces, [['The Rotward', 'plague host', 'Ashravine']]); // vigilus only, not kraith
  assert.deepEqual(r.locationHistory, ['A broker deal soured.']);                  // here only
});

test('ai-core: buildBundle assembles layered system + user, excludes unpassed data', () => {
  const ctx = {
    ai: { directives: 'Stay in character.' },
    npc: { name: 'Vess', persona: { voice: 'Silken and transactional.', prime_drive: 'profit in flesh', lens: 'all are clients' } },
    behavior: { cunning: { value: 88 }, ferocity: { value: 30 }, pragmatism: { value: 90 }, honor: { value: 35 }, supremacism: { value: 80 } },
    memory: { recentJournal: [{ t: 1, text: 'A deal soured.' }], longTermMemory: [{ t: 0, summary: 'Betrayed at Kraith.' }], dossier: { standing: -10, facts: [], goals: [], grudges: ['owes me'] } },
    thread: { about: 'passage rights', posts: [{ who: 'Kane', body: 'I need passage.' }] },
    place: { locName: 'Carrion Market', phase: 'Dead of Night', planetEffect: 'toxic rain' },
    scoped: { knownForces: [['The Rotward', 'plague host', 'Ashravine']], locationHistory: ['A broker deal soured.'] },
    commanderName: 'Kane',
    mode: 'social'
  };
  const b = NPCAI.buildBundle(ctx);
  assert.match(b.system, /Silken and transactional/);
  assert.match(b.system, /cunning 88/);
  assert.match(b.system, /Betrayed at Kraith/);              // long-term memory carried
  assert.match(b.user, /passage rights/);                     // scene
  assert.match(b.user, /Dead of Night/);                      // place/phase
  assert.match(b.user, /The Rotward/);                        // scoped world
  assert.doesNotMatch(b.user, /roster|localStorage|secret/i); // nothing leaked
});

test('ai-core: validateReply accepts a good social reply, rejects malformed', () => {
  const good = { post: 'Passage costs, client.', combatPicks: null,
    dossierDelta: { newJournalEntry: 'Kane asked passage.', promoteToLongTerm: null,
      commanderUpdates: { standing: -2, addFacts: [], addGoals: [], addGrudges: [] }, axisShift: null } };
  assert.deepEqual(NPCAI.validateReply(good, 'social'), { ok: true, reason: '' });
  assert.equal(NPCAI.validateReply({ post: '' , dossierDelta: good.dossierDelta }, 'social').ok, false);
  assert.equal(NPCAI.validateReply({ post: 'x' }, 'social').ok, false); // no dossierDelta
  assert.equal(NPCAI.validateReply({ post: 'x', combatPicks: null, dossierDelta: good.dossierDelta }, 'combat').ok, false); // combat needs array picks
});

test('ai-core: applyDelta writes journal (capped), long-term, standing, axisShift', () => {
  const st = {
    behavior: NPCAI.instantiate({ honor: { value: 40, plasticity: 20, floor: 0, ceiling: 100 } }, () => 0),
    recentJournal: [], longTermMemory: [], commanders: {}, position: 'vigilus/carrion', retired: false
  };
  const delta = { newJournalEntry: 'Kane pressed hard.', promoteToLongTerm: 'Kane demands passage — remember.',
    commanderUpdates: { standing: -6, addFacts: ['wants passage'], addGoals: [], addGrudges: ['pushy'] },
    axisShift: { axis: 'honor', delta: 5, reason: 'held to a bargain' } };
  NPCAI.applyDelta(st, 'kane', delta, 10, { journalCap: 2 });
  assert.equal(st.recentJournal[0].text, 'Kane pressed hard.');
  assert.equal(st.longTermMemory[0].summary, 'Kane demands passage — remember.');
  assert.equal(st.commanders.kane.standing, -6);
  assert.deepEqual(st.commanders.kane.grudges, ['pushy']);
  assert.equal(st.behavior.honor.value, 45); // drifted within plasticity
  // journal cap: two more entries keep only the newest 2
  NPCAI.applyDelta(st, 'kane', { newJournalEntry: 'B', commanderUpdates: { standing: 0 } }, 11, { journalCap: 2 });
  NPCAI.applyDelta(st, 'kane', { newJournalEntry: 'C', commanderUpdates: { standing: 0 } }, 12, { journalCap: 2 });
  assert.deepEqual(st.recentJournal.map(x => x.text), ['C', 'B']);
});

test('ai-core: retire flips the mind off', () => {
  const st = { behavior: {}, recentJournal: [], longTermMemory: [], commanders: {}, retired: false };
  NPCAI.retire(st, 9, 'annihilated at Kraith');
  assert.equal(st.retired, true);
  assert.equal(st.longTermMemory[0].summary, 'annihilated at Kraith');
});
