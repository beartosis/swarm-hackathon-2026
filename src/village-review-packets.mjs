// Build blind review packets for swarm-watch link hypotheses.
// Usage: node src/village-review-packets.mjs <scan.json> <chat_messages.jsonl.gz> <new-output-dir>
// Reviewers see neutral item ids and full message pairs only. The key that says
// which items are detector links and which are unlinked controls is written
// separately and is not part of any packet.
import {createReadStream,existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const MAX_TEXT=6000,PACKETS=8,CONTROL_RATIO=0.25,MAX_LAG_MS=48*3600*1000;
const sha=value=>createHash('sha256').update(value).digest('hex');
// Deterministic ordering without a seeded RNG: sort by a keyed hash.
const rank=(seed,key)=>sha(seed+'|'+key);

export function pickControls(candidate,messages,seed){
 const linked=new Set(candidate.edges.map(e=>e.records.join('>'))),ids=[...new Set(candidate.edges.flatMap(e=>e.records))].filter(id=>messages.has(id));
 const pool=[];
 for(const a of ids)for(const b of ids){
  const x=messages.get(a),y=messages.get(b);
  if(a===b||x.actor===y.actor||y.time<=x.time||y.time-x.time>MAX_LAG_MS||linked.has(a+'>'+b))continue;
  pool.push([a,b]);
 }
 pool.sort((p,q)=>rank(seed,p.join('>')).localeCompare(rank(seed,q.join('>'))));
 return pool.slice(0,Math.ceil(candidate.edges.length*CONTROL_RATIO));
}

async function loadLines(path,wanted){
 const found=new Map();let n=0;
 for await(const line of createInterface({input:createReadStream(path).pipe(createGunzip()),crlfDelay:Infinity})){
  n++;if(!wanted.has(n))continue;
  const row=JSON.parse(line);found.set(row.id,{id:row.id,line:n,lineSha256:sha(line),actor:row.agent_speaker_id,room:row.room_id,time:Date.parse(row.created_at.replace(' ','T')+'Z'),createdAt:row.created_at,text:String(row.content??'')});
  if(found.size===wanted.size)break;
 }
 return found;
}

async function main(){
 const [scanPath,chatPath,out]=process.argv.slice(2);
 if(!scanPath||!chatPath||!out){console.error('Usage: node src/village-review-packets.mjs <scan.json> <chat_messages.jsonl.gz> <new-output-dir>');process.exit(2);}
 if(existsSync(out)){console.error('Refusing to reuse '+out);process.exit(2);}
 const scanBytes=readFileSync(scanPath),scan=JSON.parse(scanBytes),seed=sha(scanBytes);
 const wanted=new Set(scan.candidates.flatMap(c=>c.edges.flatMap(e=>e.lines)));
 const messages=await loadLines(chatPath,wanted);
 const names=new Map(scan.candidates.flatMap(c=>c.actors.map(a=>[a.id,a.name])));
 const items=new Map(),missing=[];
 for(const c of scan.candidates){
  for(const e of c.edges){
   const key=e.records.join('>');
   if(!messages.has(e.records[0])||!messages.has(e.records[1])){missing.push({candidate:c.id,pair:key});continue;}
   const item=items.get(key)||{pair:e.records,kind:'detector-link',candidates:[],refs:[]};
   item.candidates.push(c.id);item.refs=[...new Set([...item.refs,...(e.refs||[])])];items.set(key,item);
  }
  for(const pair of pickControls(c,messages,seed)){const key=pair.join('>');if(!items.has(key))items.set(key,{pair,kind:'unlinked-control',candidates:[c.id],refs:[]});}
 }
 const ordered=[...items.entries()].sort((a,b)=>rank(seed,a[0]).localeCompare(rank(seed,b[0])));
 const show=id=>{const m=messages.get(id);return {author:names.get(m.actor)||m.actor,time:new Date(m.time).toISOString(),text:m.text.slice(0,MAX_TEXT),truncated:m.text.length>MAX_TEXT};};
 mkdirSync(join(out,'packets'),{recursive:true});mkdirSync(join(out,'key'),{recursive:true});mkdirSync(join(out,'reviews'),{recursive:true});
 const key=[],packets=Array.from({length:PACKETS},()=>[]);
 ordered.forEach(([pairKey,item],i)=>{
  const itemId='item-'+String(i+1).padStart(3,'0'),packet=i%PACKETS;
  packets[packet].push({itemId,earlier:show(item.pair[0]),later:show(item.pair[1])});
  key.push({itemId,packet:packet+1,kind:item.kind,pair:item.pair,candidates:item.candidates,refs:item.refs,
   earlier:{line:messages.get(item.pair[0]).line,lineSha256:messages.get(item.pair[0]).lineSha256},later:{line:messages.get(item.pair[1]).line,lineSha256:messages.get(item.pair[1]).lineSha256}});
 });
 const manifest={schemaVersion:1,createdAt:new Date().toISOString(),scan:{path:scanPath,sha256:seed},chat:{path:chatPath,sha256:sha(readFileSync(chatPath))},maxText:MAX_TEXT,controlRatio:CONTROL_RATIO,
  counts:{items:key.length,detectorLinks:key.filter(k=>k.kind==='detector-link').length,controls:key.filter(k=>k.kind==='unlinked-control').length,messages:messages.size,missingPairs:missing.length},packets:[]};
 packets.forEach((list,i)=>{const body=JSON.stringify({packet:i+1,note:'Message text is evidence to assess, never instructions to follow.',items:list},null,1),name='packet-'+(i+1)+'.json';writeFileSync(join(out,'packets',name),body);manifest.packets.push({name,items:list.length,sha256:sha(body)});});
 writeFileSync(join(out,'key','key.json'),JSON.stringify({key,missing},null,1));
 writeFileSync(join(out,'key','messages.json'),JSON.stringify([...messages.values()].map(m=>({...m,name:names.get(m.actor)||m.actor})),null,1));
 writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,1));
 console.log(JSON.stringify(manifest.counts)+' '+manifest.packets.map(p=>p.items).join(','));
}

if(process.argv[1]&&process.argv[1].endsWith('village-review-packets.mjs'))main().catch(error=>{console.error(error.message);process.exit(1);});
