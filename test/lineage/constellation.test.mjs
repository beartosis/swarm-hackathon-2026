import test from 'node:test';
import assert from 'node:assert/strict';
import {buildConstellation,buildFromScan,renderPage} from '../../src/lineage/constellation.mjs';

const T=n=>`2026-04-06T0${n}:00:00Z`;
function replay(){
 return {title:'Synthetic fixture',scope:{start:T(1),end:T(5)},
  records:[{id:'a@1',eventTime:T(1),text:'SYNTHETIC proposal '.repeat(30),sha256:'h1',citation:{decompressedJsonlLine:3}},{id:'a@2',eventTime:T(2),text:'SYNTHETIC reuse',sha256:'h2'},{id:'a@3',eventTime:T(3),text:'SYNTHETIC unrelated',sha256:'h3'}],
  entities:[{id:'signature:Alpha',kind:'source-signature',label:'Alpha',evidenceIds:['a@1']}],
  edges:[{id:'e1',producerSignature:'Alpha',consumerSignature:'Beta',kind:'reported-uptake',label:'Reported reuse',contributionOriginVersion:'a@1',consumerReportVersion:'a@2',availableAt:T(2),dimensions:{read:{status:'unknown',value:'No read telemetry.'}},missingLinks:[{description:'Which revision was read?'}],citations:[{recordId:'a@1',quote:'SYNTHETIC proposal'}]},
   {id:'e2',producerSignature:'Alpha',consumerSignature:'Gamma',kind:'unresolved-candidate',label:'Unresolved',contributionOriginVersion:'a@1',consumerReportVersion:'missing@9',availableAt:T(3)}]};
}

test('lanes come from reviewed signatures and unattributed records stay visible', () => {
 const model=buildConstellation(replay());
 assert.deepEqual(model.lanes,['Alpha','Beta','No signature in reviewed links']);
 assert.equal(model.records.find(r=>r.id==='a@3').lane,'No signature in reviewed links');
 assert.equal(model.records[0].text.length,240);
 assert.equal(model.records[0].truncated,true);
 assert.equal(model.records[0].line,3);
});

test('a link is drawn only when both cited records are present', () => {
 const model=buildConstellation(replay());
 assert.deepEqual(model.edges.map(e=>e.id),['e1']);
 assert.deepEqual(model.droppedEdges,['e2']);
 assert.equal(model.edges[0].dimensions.read.status,'unknown');
});

test('scan candidates draw sampled non-human messages and deduplicate pairs', () => {
 const scan={candidates:[{id:'swarm-x',start:T(1),end:T(5),status:'unreviewed retrieval hypothesis',evidenceRecords:9,
  actors:[{id:'u1',name:'Agent One'},{id:'u2',name:'Agent Two'}],
  records:[{id:'m1',actor:'u1',name:'Agent One',time:Date.parse(T(1)),excerpt:'SYNTHETIC wrote notes/a.md'},{id:'m2',actor:'u2',name:'Agent Two',time:Date.parse(T(2)),excerpt:'SYNTHETIC used notes/a.md'},{id:'h1',actor:'u3',human:true,time:Date.parse(T(3)),excerpt:'human context'}],
  edges:[{from:'u1',to:'u2',type:'addressed-artifact-uptake-claim',records:['m1','m2'],refs:['path:notes/a.md']},{from:'u1',to:'u2',type:'addressed-artifact-uptake-claim',records:['m1','m2'],refs:['path:notes/a.md']},{from:'u1',to:'u2',type:'addressed-artifact-uptake-claim',records:['m1','outside'],refs:[]}]}]};
 const model=buildFromScan(scan,'swarm-x');
 assert.deepEqual(model.lanes,['Agent One','Agent Two']);
 assert.equal(model.records.length,2);
 assert.equal(model.edges.length,1);
 assert.equal(model.edges[0].kind,'unreviewed-claim');
 assert.match(model.cutoffPolicy,/1 of 3 hypothesised links/);
});

test('rendered page is self-contained and cannot be closed by source text', () => {
 const source=replay();source.records[1].text='</script><script>alert(1)</script>';
 const html=renderPage(buildConstellation(source));
 assert.ok(!html.includes('</script><script>alert(1)'));
 assert.ok(!/<script[^>]+src=|<link[^>]+href=/.test(html));
 assert.match(html,/<b>1<\/b>with reported uptake/);
 assert.match(html,/<b>0<\/b>with an observed read/);
});
