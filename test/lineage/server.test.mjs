import test from 'node:test';
import assert from 'node:assert/strict';
import {createReplayServer} from '../../src/lineage/server.mjs';

test('local replay gates direct original access and rejects unbounded requests', async () => {
  const bundle = {schemaVersion: 1, title: 'Synthetic server test', scope: {start: '2026-04-06T07:00:00Z', end: '2026-04-06T09:00:00Z'},
    records: [{id: 'later', availableAt: '2026-04-06T08:00:00Z', text: 'future secret fixture'}], entities: [], edges: [], claims: []};
  const server = createReplayServer(bundle, {render: () => '<html>synthetic fixture</html>'});
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/api/replay')).status, 400);
    assert.equal((await fetch(base + '/api/replay?cutoff=2027-01-01')).status, 400);
    assert.equal((await fetch(base + '/api/record/later?cutoff=2026-04-06T07:30:00Z')).status, 404);
    assert.equal((await fetch(base + '/api/record/later?cutoff=2026-04-06T08:30:00Z')).status, 200);
    assert.equal((await fetch(base + '/api/record/..%2F..%2FAGENTS.md?cutoff=2026-04-06T08:30:00Z')).status, 404);
    assert.equal((await fetch(base + '/api/replay?cutoff=2026-04-06T08:30:00Z', {method:'POST'})).status, 405);
    const early = await (await fetch(base + '/api/replay?cutoff=2026-04-06T07:30:00Z')).text();
    assert.ok(!early.includes('future secret fixture'));
  } finally { await new Promise(done => server.close(done)); }
});
