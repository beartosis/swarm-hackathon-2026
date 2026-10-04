import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildVillageReplay} from '../../src/lineage/village-replay.mjs';
import {replayAt} from '../../src/lineage/replay.mjs';

test('Village adapter preserves full original text, hides retrospective rows and creates no automatic links',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'buzzer-village-view-'));
  try{
    const packet=join(dir,'packet');await mkdir(packet);
    await writeFile(join(packet,'packet.json'),JSON.stringify({packet_id:'synthetic',records_file:'records.jsonl'}));
    const rows=[{record_id:'chat_messages:one',source:{relative_path:'chat_messages.jsonl.gz',event_time_utc:'2026-04-06T08:00:00.000001Z',raw_line_sha256:'hash',line_1based:1},original:{id:'one',content:'synthetic source text'.repeat(80),updated_at:'2026-04-06 08:00:00.000999'}},
      {record_id:'agents:later-name',historical_availability:'retrospective',source:{relative_path:'agents.jsonl.gz'},original:{name:'future label'}}];
    await writeFile(join(packet,'records.jsonl'),rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
    const bundle=await buildVillageReplay(dir);
    assert.equal(bundle.records.length,1);assert.equal(bundle.edges.length,0);
    assert.equal(bundle.records[0].text,rows[0].original.content);
    assert.ok(!JSON.stringify(bundle).includes('future label'));
    assert.equal(replayAt(bundle,'2026-04-06T08:00:00.000000Z').records.length,0);
    assert.equal(replayAt(bundle,'2026-04-06T08:00:00.001Z').records.length,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('Village adapter preserves a later dimension timestamp',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'buzzer-village-dimension-'));
  try{
    const packet=join(dir,'packet');await mkdir(packet);
    await writeFile(join(packet,'packet.json'),JSON.stringify({packet_id:'synthetic',records_file:'records.jsonl'}));
    const rows=['a','b'].map((id,i)=>({record_id:'chat_messages:'+id,source:{relative_path:'chat_messages.jsonl.gz',event_time_utc:`2026-04-06T08:0${i}:00Z`,raw_line_sha256:'hash'+id,line_1based:i+1},original:{id,content:'synthetic '+id}}));
    await writeFile(join(packet,'records.jsonl'),rows.map(row=>JSON.stringify(row)).join('\n'));
    const bundle=await buildVillageReplay(dir,[{id:'edge',producerRecordId:rows[0].record_id,consumerRecordId:rows[1].record_id,
      evidenceIds:rows.map(row=>row.record_id),dimensions:{use:{status:'reported',value:'Later synthetic claim',availableAt:'2026-04-09T08:00:00Z'}}}]);
    assert.equal(replayAt(bundle,'2026-04-07T00:00:00Z').edges[0].dimensions.use,undefined);
    assert.equal(replayAt(bundle,'2026-04-10T00:00:00Z').edges[0].dimensions.use.value,'Later synthetic claim');
  }finally{await rm(dir,{recursive:true,force:true});}
});
