import {createReadStream} from 'node:fs';
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

function utc(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.replace(' ', 'T');
  return /Z$|[+-]\d\d:\d\d$/.test(normalized) ? normalized : normalized + 'Z';
}
function canonicalTime(value) {
  const normalized=utc(value);
  if(!normalized || !Number.isFinite(Date.parse(normalized))) return null;
  // Preserve archive microseconds; all archive source times are UTC.
  const match=normalized.match(/^(.*T\d\d:\d\d:\d\d)(?:\.(\d+))?Z$/);
  return match ? match[1]+'.'+(match[2]||'').padEnd(6,'0')+'Z' : new Date(normalized).toISOString();
}
const latest=(values)=>values.map(canonicalTime).filter(Boolean).sort().at(-1) || null;

export async function buildVillageReplay(packetDirectory, decisions = []) {
  const rows = new Map(), packets=[];
  const wanted = new Set(decisions.flatMap(edge=>[...(edge.evidenceIds || []),...Object.values(edge.dimensions||{}).flatMap(value=>value.evidenceIds||[])]));
  for (const entry of (await readdir(packetDirectory,{withFileTypes:true})).filter(item=>item.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) {
    const directory=join(packetDirectory,entry.name);
    const packet=JSON.parse(await readFile(join(directory,'packet.json'),'utf8'));
    packets.push(packet.packet_id);
    for await (const line of createInterface({input:createReadStream(join(directory,packet.records_file)),crlfDelay:Infinity})) {
      if(!line)continue;
      const row=JSON.parse(line), source=row.source.relative_path;
      if(source!=='chat_messages.jsonl.gz' && !wanted.has(row.record_id))continue;
      if(row.historical_availability)continue; // Export-time registry, goals and session metadata stay outside historical replay.
      const prior=rows.get(row.record_id);
      if(prior && prior.source.raw_line_sha256!==row.source.raw_line_sha256)throw Error('Conflicting original ID across packets');
      rows.set(row.record_id,row);
    }
  }
  const records=[...rows.values()].map(row=>{
    const original=row.original;
    const isChat=row.source.relative_path==='chat_messages.jsonl.gz';
    const eventTime=canonicalTime(row.source.event_time_utc);
    const availableAt=latest([eventTime,original.updated_at]);
    const field=value=>typeof value==='string'?value:JSON.stringify(value??null,null,2);
    const actionText=field(original.agent_action?.command??original.agent_action);
    return {id:row.record_id,availableAt,eventTime,sourceId:'AI Digest / AI Village',originalId:original.id,
      title:(isChat?'Room message · ':'Action record · ')+String(original.id).slice(0,8),
      text:isChat?String(original.content||''):[
        'ARCHIVED ACTION FIELD',actionText,'ARCHIVED TOOL OUTPUT FIELD',field(original.output),
        'ARCHIVED ERROR FIELD',field(original.error),'MODEL RESPONSE (self-report, not the original input)',field(original.agent_messages),
        'SYSTEM NOTE FIELD',field(original.system)].join('\n\n'),
      sha256:row.source.raw_line_sha256,line:row.source.line_1based,localUrl:'/api/record/'+encodeURIComponent(row.record_id),
      evidenceType:isChat?'Original chat; self-reports are not execution proof':'Original action/output fields; no source commands executed',
      extractionConfig:{sourcePath:'ai-village/'+row.source.relative_path,compressedFileSha256:row.source.file_sha256,
        rawLineSha256:row.source.raw_line_sha256,hashScope:'Exact UTF-8 JSONL line including terminator',
        representation:isChat?'Original content field':'Readable source-field sections; raw source-row hash binds complete original JSON in the neutral packet',
        availability:'Conservative maximum of created_at and updated_at; registry names/session goals excluded',
        sourceAttribution:'AI Digest, AI Village dataset, export September 20, 2026',
        registryAgentId:row.registry_agent_id||null,identityLimit:'Publisher registry ID only; distinct producing agent unknown'}};
  });
  const map=new Map(records.map(row=>[row.id,row]));
  const entities=[],edges=[];
  const nodeIds=new Set();
  const addNode=(recordId)=>{
    if(nodeIds.has(recordId))return;
    const record=map.get(recordId);if(!record)throw Error('Missing cited original '+recordId);
    nodeIds.add(recordId);
    // Node labels come only from their own original, never a later edge's interpretation.
    entities.push({id:'record:'+recordId,kind:'source-record',label:record.title,summary:record.text.slice(0,160),availableAt:record.availableAt,evidenceIds:[recordId],
      dimensions:{producer:{status:'unknown',value:'Registry attribution does not authenticate a distinct producing agent.',availableAt:record.availableAt,evidenceIds:[recordId]}}});
  };
  for(const decision of decisions){
    if(!Array.isArray(decision.evidenceIds)||decision.evidenceIds.length<2||decision.evidenceIds.some(id=>!map.has(id)))throw Error('Decision lacks available originals');
    addNode(decision.producerRecordId,decision.producerLabel||'Contribution record');
    addNode(decision.consumerRecordId,decision.consumerLabel||'Later record');
    const availableAt=latest([decision.availableAt,...decision.evidenceIds.map(id=>map.get(id).availableAt)]);
    edges.push({...decision,id:decision.id,from:'record:'+decision.producerRecordId,to:'record:'+decision.consumerRecordId,
      availableAt,dimensions:Object.fromEntries(Object.entries(decision.dimensions||{}).map(([key,value])=>{
        const evidenceIds=value.evidenceIds||decision.evidenceIds;
        return [key,{...value,availableAt:latest([availableAt,value.availableAt,...evidenceIds.map(id=>map.get(id)?.availableAt)]),evidenceIds}];
      }))});
  }
  // Unadjudicated original examples remain source records, never inferred interaction edges.
  if(!entities.length)for(const record of records.filter(row=>row.availableAt).sort((a,b)=>a.availableAt.localeCompare(b.availableAt)).slice(0,12))addNode(record.id,'Unadjudicated source message');
  return {schemaVersion:1,title:'AI Village · April 6–12 bounded evidence audit',scope:{start:'2026-04-06T07:00:00Z',end:'2026-04-13T07:00:00Z',label:'Nine frozen review packets',timezone:'America/Los_Angeles'},records,entities,edges,claims:[],
    buildMetadata:{packetIds:packets,sourceRecords:records.length,interpretation:'Only explicitly reconciled review edges are rendered. No retrieval score becomes evidence.'}};
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [packets,decisionsPath,output]=process.argv.slice(2);
  if(!output)throw Error('Usage: village-replay.mjs PACKET_DIRECTORY DECISIONS.json OUTPUT.json');
  const decisions=JSON.parse(await readFile(decisionsPath,'utf8'));
  const bundle=await buildVillageReplay(packets,decisions.edges||decisions);
  await writeFile(output,JSON.stringify(bundle,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({records:bundle.records.length,edges:bundle.edges.length,output}));
}
