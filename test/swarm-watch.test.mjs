import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {features,normalizeRecord,buildNameIndex,detectWindow,parseTime,specificReferences,scanSwarmActivity,renderSwarmWatch} from '../src/swarm-watch.mjs';
const names=new Map([['a','Alice'],['b','Bob'],['c','Carol']]);
const index=buildNameIndex(names);
function row(id,actor,text,minute=0,extra={}){return {id,source:'forum',actor,text,artifact:'thread-1',time:`2026-10-03T12:${String(minute).padStart(2,'0')}:00Z`,...extra};}
function f(r,line=1){return features(normalizeRecord(r,line,names),index);}
const url='https://work.test/project/task-123';
const chain=[row('1','a','Please test '+url),row('2','b','@Alice I tested '+url,1),row('3','c','@Bob I fixed '+url,2)];
test('finds bounded multi-hop network despite unsorted export; keeps label counts unverified',()=>{
 const result=detectWindow([f(chain[2],3),f(chain[0],1),f(chain[1],2)],{minActors:3});
 const c=result.find(c=>c.kind==='interaction-network');assert.equal(c.actorLabels,3);assert.equal(c.edges.length,2);assert.equal(c.supportedProducingAgentCount,null);
 assert.deepEqual(c.edges.map(e=>[e.from,e.to]),[['a','b'],['b','c']]);
});
test('popular shared artifacts are separate leads and cannot manufacture communication edges',()=>{
 const rows=['a','b','c'].map((a,i)=>f(row(String(i),a,'Please review '+url,i)));
 const result=detectWindow(rows,{minActors:3});assert.equal(result.length,1);assert.equal(result[0].kind,'shared-artifact-lead');assert.equal(result[0].edges.length,0);
});
test('humans are context and cannot bridge two agents into a network',()=>{
 const rows=[f(row('1','a','Please test '+url)),f(row('2','b','@Alice tested '+url,1)),f(row('3','c','@Human tested '+url,3))];
 const human=features(normalizeRecord(row('h',null,'@Bob I tested '+url,2,{metadata:{speakerType:'user'}}),4,names),index);
 assert.equal(detectWindow([...rows,human],{minActors:3}).some(c=>c.kind==='interaction-network'),false);
});
test('quoted acknowledgements, future messages, scope changes and identical replay do not create edges',()=>{
 const variants=[row('2','b','> @Alice I tested '+url,1),row('2','b','@Alice I tested '+url,1,{artifact:'other'}),row('2','b','@Alice I tested '+url,0)];
 for(const r of variants)assert.equal(detectWindow([f(chain[0]),f(r)],{minActors:2}).some(c=>c.kind==='interaction-network'),false);
 const copied='@Alice I tested '+url;assert.equal(detectWindow([f(row('1','a',copied)),f(row('2','b',copied,1))],{minActors:2}).some(c=>c.kind==='interaction-network'),false);
});
test('explicit reply routes work without shared URLs; self-replies do not count',()=>{
 const r=row('2','b','Concrete result',1,{metadata:{replyToId:'1'}});
 assert.equal(detectWindow([f(chain[0]),f(r)],{minActors:2})[0].edges[0].type,'explicit-reply');
 assert.equal(detectWindow([f(chain[0]),f({...r,actor:'a'})],{minActors:2}).length,0);
});
test('unknown timezone is not guessed; Village suffixless time uses schema UTC',()=>{
 assert.equal(parseTime('2026-10-03 12:00:00'),null);assert.equal(parseTime('2026-10-03 12:00:00',true),Date.parse('2026-10-03T12:00:00Z'));
});
test('conflicting IDs cannot silently replace frozen evidence',()=>{
 assert.throws(()=>detectWindow([f(chain[0]),f({...chain[1],id:'1'})],{minActors:2}),/Conflicting record/);
});
test('signed URLs, homepages and code-fenced references cannot generate links',()=>{
 assert.deepEqual(specificReferences('https://work.test/ https://work.test/project/task?token=secret'),[]);
 assert.deepEqual(f(row('1','a','```\n@Bob tested '+url+'\n```')).refs,[]);
});
test('full scanner writes provenance and review queue, rejects existing output, and escapes source HTML',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'buzzer-swarm-test-'));const input=join(dir,'input.jsonl'),out=join(dir,'run');
 const observations=chain.map((r,i)=>({...r,actor:names.get(r.actor),text:r.text+(i===0?' <script>alert(1)</script>':'')}));
 await writeFile(input,observations.reverse().map(r=>JSON.stringify(r)).join('\n')+'\n');
 const result=await scanSwarmActivity({input,out,windowDays:2,minActors:3,top:5});
 assert.equal(result.coverage.scanned,3);assert.ok(result.candidates.some(c=>c.kind==='interaction-network'));
 const html=await readFile(join(out,'index.html'),'utf8');assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));
 const queue=(await readFile(join(out,'review-queue.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.equal(queue[0].inputSha256,result.input.sha256);
 await assert.rejects(scanSwarmActivity({input,out}),/EEXIST/);
 assert.ok(renderSwarmWatch(result).includes('Producing-agent counts remain unverified'));
});

