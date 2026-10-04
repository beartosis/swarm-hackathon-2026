import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {enrichWiki} from '../../src/lineage/assemble.mjs';

test('local assembly restores full body only after checking source hashes', () => {
  const body = 'Synthetic original. '.repeat(40), hash = createHash('sha256').update(body).digest('hex');
  const bundle = {records: [{id:'revision-1',text:body.slice(0,220),versionHash:hash,sha256:'rawhash'}]};
  const neutral = {records:[{citation:{recordId:'revision-1',rawLineSha256:'rawhash',decompressedJsonlLine:7,path:'revisions.jsonl.gz'},original:{body,archived_at:'future export metadata'}}]};
  const result = enrichWiki(bundle,neutral);
  assert.equal(result.records[0].text,body);
  assert.equal(result.records[0].line,7);
  assert.ok(!JSON.stringify(result).includes('future export metadata'));
  assert.equal(bundle.records[0].text.length,220);
  neutral.records[0].original.body += 'changed';
  assert.throws(()=>enrichWiki(bundle,neutral),/hash mismatch/);
});
