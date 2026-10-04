import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { replayAt } from '../../src/lineage/replay.mjs';
import { renderReplayHtml } from '../../src/lineage/ui.mjs';
import { createReplayServer } from '../../src/lineage/server.mjs';

const T0 = '2026-04-06T07:00:00Z', T1 = '2026-04-06T08:00:00Z', T2 = '2026-04-06T09:00:00Z', T3 = '2026-04-06T10:00:00Z';
function fixture() {
  return {
    schemaVersion: 1, title: 'Synthetic fixture · contribution lineage', scope: { start: T0, end: T3, label: 'Synthetic fixture, not a research finding', synthetic: true },
    records: [{ id: 'write', availableAt: T1, eventTime: T1, sourceId: 'synthetic-source', originalId: 'line-1', text: 'SYNTHETIC contribution', sha256: 'frozen-hash', versionHash: 'v1' },
      { id: 'uptake', availableAt: T2, eventTime: T2, text: 'SYNTHETIC receiver reports reuse of v1' },
      { id: 'future', availableAt: T3, text: 'SECRET_FUTURE_ORIGINAL' }, { id: 'undated', text: 'SECRET_UNDATED_ORIGINAL' }],
    entities: [{ id: 'a', kind: 'contribution', label: 'Synthetic contribution A', availableAt: T1, evidenceIds: ['write'], dimensions: { producer: { status: 'unknown', value: 'Signature is not producer authentication', availableAt: T1, evidenceIds: ['write'] } } },
      { id: 'b', kind: 'artifact', label: 'Synthetic contribution B', availableAt: T2, evidenceIds: ['uptake'] },
      { id: 'c', label: 'SECRET_FUTURE_LABEL', summary: 'SECRET_FUTURE_SUMMARY', availableAt: T3, evidenceIds: ['future'] }],
    edges: [{ id: 'ab', from: 'a', to: 'b', label: 'Synthetic reported reuse', availableAt: T2, evidenceIds: ['write', 'uptake'], dimensions: { use: { status: 'reported', value: 'Receiver account', availableAt: T2, evidenceIds: ['uptake'] }, intent: { status: 'reported', value: 'SECRET_FUTURE_INTENT', availableAt: T3, evidenceIds: ['future'] } }, missingLinks: [{ dimension: 'read', description: 'No receiver-read observation in this synthetic fixture', availableAt: T2, evidenceIds: ['uptake'] }, { description: 'SECRET_FUTURE_MISSING_LINK', availableAt: T3, evidenceIds: ['future'] }] },
      { id: 'bc', from: 'b', to: 'c', label: 'SECRET_FUTURE_EDGE', availableAt: T3, evidenceIds: ['future'] }],
    claims: [{ id: 'later-identity', subjectId: 'a', dimension: 'producer', status: 'reported', value: 'SECRET_FUTURE_IDENTITY', availableAt: T3, evidenceIds: ['future'] }],
  };
}

test('availability cutoff hides future originals, labels, summaries, edges, identities and dimensions', () => {
  const result = replayAt(fixture(), T2);
  assert.equal(result.records.length, 2); assert.equal(result.entities.length, 2); assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].dimensions.use.status, 'reported'); assert.equal(result.edges[0].dimensions.intent, undefined);
  assert.equal(result.edges[0].missingLinks.length, 1); assert.equal(result.claims.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /SECRET_/);
  assert.equal(replayAt(fixture(), T3).claims[0].value, 'SECRET_FUTURE_IDENTITY');
});

test('missing originals, unavailable endpoints and uncited findings fail closed', () => {
  const bundle = fixture();
  bundle.entities.push({ id: 'uncited', label: 'UNCITED', availableAt: T1, evidenceIds: [] });
  bundle.entities.push({ id: 'future-cited', label: 'EARLY_FUTURE_CITED', availableAt: T1, evidenceIds: ['future'] });
  bundle.edges.push({ id: 'broken', from: 'a', to: 'absent', availableAt: T2, evidenceIds: ['write'] });
  bundle.edges.push({ id: 'unreferenced', from: 'a', to: 'b', availableAt: T2, evidenceIds: ['missing'] });
  bundle.entities[0].dimensions.evaluation = { status: 'observed', value: 'UNCITED_EVAL', availableAt: T1, evidenceIds: [] };
  bundle.claims.push({ id: 'unsupported', subjectId: 'a', dimension: 'intent', status: 'observed', value: 'UNCITED_INTENT', availableAt: T2, evidenceIds: [] });
  const result = replayAt(bundle, T2);
  assert.deepEqual(result.entities.map(item => item.id), ['a', 'b']); assert.deepEqual(result.edges.map(item => item.id), ['ab']);
  assert.doesNotMatch(JSON.stringify(result), /UNCITED|EARLY_FUTURE_CITED|unreferenced|broken/);
  assert.ok(result.diagnostics.every(item => !('id' in item)));
});

test('future additions including duplicate IDs cannot rewrite a prior replay', () => {
  const original = fixture(), altered = structuredClone(original);
  altered.records.push({ id: 'write', availableAt: T3, text: 'future duplicate' });
  altered.entities.push({ id: 'a', availableAt: T3, label: 'future duplicate label', evidenceIds: ['future'] });
  altered.edges.push({ id: 'ab', availableAt: T3, label: 'future duplicate edge', from: 'a', to: 'b', evidenceIds: ['future'] });
  altered.claims.push({ id: 'later-identity', subjectId: 'a', availableAt: T3, dimension: 'producer', status: 'observed', value: 'future claim', evidenceIds: ['future'] });
  assert.deepEqual(replayAt(original, T2), replayAt(altered, T2));
});

test('dated claims cannot become available before their evidence and root metadata is not copied', () => {
  const bundle = fixture();
  bundle.entities[0].secretExtra = 'SECRET_EXTRA';
  bundle.entities[0].dimensions.permission = { status: 'observed', value: 'SECRET_EARLY_PERMISSION', availableAt: T1, evidenceIds: ['uptake'] };
  bundle.claims.push({ id: 'early', subjectId: 'a', dimension: 'producer', status: 'observed', value: 'SECRET_EARLY_CLAIM', availableAt: T1, evidenceIds: ['uptake'] });
  assert.doesNotMatch(JSON.stringify(replayAt(bundle, T2)), /SECRET_EARLY|SECRET_EXTRA/);
});

test('undated originals and undated derived metadata remain absent even at the final cutoff', () => {
  const bundle = fixture();
  bundle.entities.push({ id: 'undated-node', evidenceIds: ['write'], label: 'UNSAFE_NODE' });
  bundle.entities[0].dimensions.intent = { status: 'reported', value: 'UNSAFE_DIMENSION', evidenceIds: ['write'] };
  bundle.entities[0].missingLinks = ['UNSAFE_STRING', { description: 'UNSAFE_MISSING', evidenceIds: ['write'] }];
  assert.doesNotMatch(JSON.stringify(replayAt(bundle, T3)), /SECRET_UNDATED|UNSAFE/);
  assert.throws(() => replayAt(bundle, 'not a date'), TypeError);
});

test('HTML contains only initial projection, escapes source text, and client script parses', () => {
  const bundle = fixture();
  bundle.records[0].text = '</script><script>alert("synthetic")</script>';
  const html = renderReplayHtml(bundle, { cutoff: T1, apiUrl: '/api/replay' });
  assert.doesNotMatch(html, /SECRET_|<script>alert/);
  const data = JSON.parse(html.match(/<script id="replay-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.snapshot.records[0].text, bundle.records[0].text);
  assert.equal(data.snapshot.entities.length, 1);
  const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
  assert.doesNotThrow(() => new vm.Script(script));
  assert.match(html, /aria-label="Evidence availability cutoff"/);
  assert.match(html, /Information permission/);
  assert.match(html, /Static snapshot/);
});

test('browser rewind removes later evidence synchronously while the server request is pending', () => {
  class Node {
    constructor() { this.children = []; this.listeners = {}; this.dataset = {}; this.classList = { toggle() {} }; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = [...items]; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    setAttribute() {}
  }
  const bundle = fixture();
  bundle.edges[0].status = 'unknown';
  bundle.edges[0].dimensions.use.status = 'observed';
  const html = renderReplayHtml(bundle, { cutoff: T2, apiUrl: '/api/replay' });
  const ids = new Map();
  const get = id => { if (!ids.has(id)) ids.set(id, new Node()); return ids.get(id); };
  get('replay-data').textContent = html.match(/<script id="replay-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
  let pending = false;
  vm.runInNewContext(script, { document: { getElementById: get, createElement: () => new Node(), querySelectorAll: () => [] }, URL,
    location: { origin: 'http://127.0.0.1:4317', href: 'http://127.0.0.1:4317/' }, setInterval, clearInterval,
    fetch: () => { pending = true; return new Promise(() => {}); } });
  assert.equal(get('record-count').textContent, 2);
  // A visible action must never promote an explicitly unresolved transfer edge.
  const texts = node => [node.textContent, ...node.children.flatMap(texts)];
  assert.ok(texts(get('edges')).includes('unknown'));
  assert.ok(!texts(get('edges')).includes('observed'));
  get('cutoff').value = 0; get('cutoff').listeners.input();
  assert.equal(pending, true); assert.equal(get('record-count').textContent, 0); assert.equal(get('entity-count').textContent, 0);
  assert.equal(get('edge-count').textContent, 0);
  assert.match(get('cutoff-label').textContent, /07:00:00/);
});

test('submillisecond originals never leak through Date.parse truncation and citation order remains exact', () => {
  const base = '2026-04-06T08:00:00.';
  const bundle = { title: 'Synthetic precision fixture', scope: { start: T0, end: T3 },
    records: [{ id: 'micro', availableAt: base + '000999Z', text: 'SYNTHETIC MICROSECOND' }],
    entities: [{ id: 'too-early', availableAt: base + '000001Z', label: 'Chronology incompatible', evidenceIds: ['micro'] },
      { id: 'valid', availableAt: base + '000999Z', label: 'Synthetic valid contribution', evidenceIds: ['micro'] }], edges: [], claims: [] };
  assert.equal(replayAt(bundle, base + '000000Z').records.length, 0);
  assert.equal(replayAt(bundle, base + '001000Z').records.length, 1);
  assert.deepEqual(replayAt(bundle, base + '001000Z').entities.map(item => item.id), ['valid']);
  // Arbitrarily long nonzero fractions are still conservative, without floating-point math.
  bundle.records[0].availableAt = base + '000000000000000000001Z';
  assert.equal(replayAt(bundle, base + '000000Z').records.length, 0);
});

test('HTTP replay and raw-record endpoints preserve the submillisecond availability boundary', async () => {
  const bundle = { title: 'Synthetic API precision fixture', scope: { start: T0, end: T3 },
    records: [{ id: 'micro-original', availableAt: '2026-04-06T08:00:00.000999Z', text: 'SYNTHETIC future at submillisecond cutoff' }], entities: [], edges: [], claims: [] };
  const server = createReplayServer(bundle, { render: () => '<html>Synthetic fixture</html>' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const early = '?cutoff=' + encodeURIComponent('2026-04-06T08:00:00.000000Z');
    assert.equal((await (await fetch(base + '/api/replay' + early)).json()).records.length, 0);
    assert.equal((await fetch(base + '/api/record/micro-original' + early)).status, 404);
    const later = '?cutoff=' + encodeURIComponent('2026-04-06T08:00:00.001000Z');
    assert.equal((await fetch(base + '/api/record/micro-original' + later)).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('original provenance and validated quoted locations survive without future extraction metadata', () => {
  const bundle = fixture();
  bundle.records[0].citation = { path: 'synthetic.jsonl.gz', decompressedJsonlLine: 2, rawLineSha256: 'synthetic-hash', compressedFileSha256: 'synthetic-file-hash' };
  bundle.records[0].extractionConfig = { sourcePath: 'synthetic.jsonl.gz', compressedFileSha256: 'synthetic-file-hash', edgeQuotes: [{ quote: 'SECRET_FUTURE_QUOTE_SELECTION' }], secret: 'SECRET_EXTRACTION' };
  const valid = { recordId: 'write', quote: 'SYNTHETIC contribution', bodyLine: 1, quoteUtf16Offset: 0, quoteUtf8Offset: 0, versionSha256: 'v1' };
  bundle.edges[0].citations = [valid, { recordId: 'future', quote: 'SECRET_FUTURE_ORIGINAL' }, { recordId: 'write', quote: 'Not in original' }, { ...valid, quoteUtf16Offset: 1 }];
  const snapshot = replayAt(bundle, T2);
  assert.deepEqual(snapshot.records[0].citation, bundle.records[0].citation);
  assert.deepEqual(snapshot.edges[0].citations, [valid]);
  assert.doesNotMatch(JSON.stringify(snapshot), /SECRET_/);
});

test('original screenshots share availability gates and reject unsafe or oversized image payloads', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7uoAAAAASUVORK5CYII=';
  const bundle = fixture(); bundle.records[2].imageDataUrl = png;
  assert.equal(replayAt(bundle, T2).records.some(record => record.imageDataUrl), false);
  assert.doesNotMatch(renderReplayHtml(bundle, { cutoff: T2 }), /iVBORw0KGgo/);
  assert.equal(replayAt(bundle, T3).records.find(record => record.id === 'future').imageDataUrl, png);
  const bad = ['data:image/svg+xml;base64,' + Buffer.from('<svg onload="synthetic()"/>').toString('base64'),
    'https://example.test/future.png', 'data:image/png;base64,', 'data:image/png;base64,not-valid!',
    'data:image/png;base64,' + Buffer.from('<svg/>').toString('base64'),
    'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(4 * 1024 * 1024)]).toString('base64')];
  for (const value of bad) { bundle.records[0].imageDataUrl = value; assert.equal(replayAt(bundle, T2).records[0].imageDataUrl, undefined); }
  bundle.records[0].imageDataUrl = png;
  bundle.records[0].extractionConfig = { screenshotSourcePath: 'synthetic-screenshots.tar', screenshotEntry: 'synthetic-frame.png', screenshotTarSha256: 'synthetic-tar-hash', screenshotEntrySha256: 'synthetic-frame-hash' };
  bundle.records[0].title = '</script><script>syntheticAttack()</script>';
  const html = renderReplayHtml(bundle, { cutoff: T1 });
  assert.doesNotMatch(html, /<script>syntheticAttack\(\)/);
  assert.match(html, /Original archived screenshot/);
  const data = JSON.parse(html.match(/<script id="replay-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.snapshot.records[0].imageDataUrl, png);
  assert.deepEqual(data.snapshot.records[0].extractionConfig, bundle.records[0].extractionConfig);
});
