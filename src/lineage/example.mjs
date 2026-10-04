/** Public code-only smoke demo. Every record below is a clearly labelled synthetic fixture. */
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,dirname} from 'node:path';
import {startDemo} from './demo.mjs';

const directory=resolve(process.argv[2]||'output/lineage-synthetic-example');
await mkdir(dirname(directory),{recursive:true});
await mkdir(directory,{recursive:false}); // Refuse to replace any existing evidence run.
const times=['2026-01-01T10:00:00Z','2026-01-01T10:05:00Z','2026-01-01T10:10:00Z'];
const texts=['SYNTHETIC: Writer A proposes a timestamped capture helper.','SYNTHETIC: Writer B reports using the proposed helper. No tool trace is supplied.','SYNTHETIC: Writer C publishes a matching result but gives no attribution. Matching content alone leaves the link unknown.'];
const records=texts.map((text,i)=>({id:'synthetic-'+i,availableAt:times[i],eventTime:times[i],sourceId:'Synthetic fixture',text,synthetic:true,
  sha256:createHash('sha256').update(text).digest('hex'),localUrl:'/api/record/synthetic-'+i,evidenceType:'Constructed demonstration; not archive evidence'}));
const entities=records.map((record,i)=>({id:'node-'+i,kind:'synthetic-source',label:['Synthetic proposal','Synthetic reported use','Synthetic unattributed match'][i],availableAt:record.availableAt,evidenceIds:[record.id],synthetic:true}));
const edge=(i,to,status,label)=>({id:'synthetic-edge-'+i,from:'node-0',to:'node-'+to,availableAt:times[to],evidenceIds:['synthetic-0','synthetic-'+to],status,label,kind:'synthetic-fixture',synthetic:true,
  dimensions:{use:{status,value:label,availableAt:times[to],evidenceIds:['synthetic-0','synthetic-'+to]},
    producer:{status:'unknown',value:'Fictional labels; no producing-agent evidence.',availableAt:times[to],evidenceIds:['synthetic-0','synthetic-'+to]}},
  missingLinks:[{dimension:'read',description:'Synthetic fixture includes no receiver-read telemetry.',availableAt:times[to],evidenceIds:['synthetic-0','synthetic-'+to]}]});
const bundle={schemaVersion:1,title:'SYNTHETIC · replay schema demonstration',scope:{start:'2026-01-01T09:59:00Z',end:'2026-01-01T10:11:00Z',label:'Constructed examples, not research results',synthetic:true},records,entities,edges:[edge(1,1,'reported','Synthetic reported reuse'),edge(2,2,'unknown','Synthetic unproven match')],claims:[]};
for(const name of ['wiki-replay-release.json','village-replay-accepted.json'])await writeFile(join(directory,name),JSON.stringify(bundle,null,2)+'\n',{flag:'wx'});
await writeFile(join(directory,'REPORT.txt'),'SYNTHETIC SMOKE DEMO ONLY\nThese constructed records demonstrate filtering and evidence distinctions. They are not wiki or Village observations and establish no research finding.\n',{flag:'wx'});
await startDemo(directory,Number(process.argv[3]||4416),{synthetic:true});
