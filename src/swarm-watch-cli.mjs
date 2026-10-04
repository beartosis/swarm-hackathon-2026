import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {scanSwarmActivity} from './swarm-watch.mjs';
const args=process.argv.slice(2);
const option=(key,fallback)=>{const i=args.indexOf(key);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing value for '+key);return args[i+1];};
async function main(){
 if(args.includes('--serve')){
  const out=resolve(option('--out','output/swarm-watch-village-20261003')),port=Number(option('--port','4186'));
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
  const routes=new Map([['/','index.html'],['/scan.json','scan.json'],['/review-queue.jsonl','review-queue.jsonl']]);
  const server=createServer(async(req,res)=>{if(req.method!=='GET'||!routes.has(req.url)){res.writeHead(404);res.end();return;}
   try{const filename=routes.get(req.url);const body=await readFile(resolve(out,filename));res.writeHead(200,{'Content-Type':filename.endsWith('.html')?'text/html; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);}
   catch{res.writeHead(404);res.end('Missing report');}});
  server.on('error',e=>{console.error(e.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('Swarm watch: http://127.0.0.1:'+port));return;
 }
 if(args.includes('--help')){console.log('node src/swarm-watch-cli.mjs --input records.jsonl[.gz] --out NEW_DIRECTORY [--village --agents ai-village/agents.jsonl.gz] [--window-days 7] [--min-actors 10] [--top 20]\nGeneric input: Buzzer observations with stable id, source, actor, artifact (scope), text and zoned time. Optional metadata.speakerType=user and metadata.replyToId. Run directories must be new. No network or model calls.');return;}
 const village=args.includes('--village');
 const out=option('--out','output/swarm-watch-'+Date.now());
 const r=await scanSwarmActivity({input:option('--input',village?'ai-village/chat_messages.jsonl.gz':undefined)||(()=>{throw Error('--input required');})(),
  out,village,agentsPath:option('--agents',village?'ai-village/agents.jsonl.gz':undefined),
  windowDays:Number(option('--window-days','7')),minActors:Number(option('--min-actors','10')),top:Number(option('--top','20')),
  maxWindowRecords:Number(option('--max-window-records','100000'))});
 console.log(JSON.stringify({coverage:r.coverage,performance:r.performance,report:resolve(out,'index.html'),
  candidates:r.candidates.map(c=>({id:c.id,kind:c.kind,actorLabels:c.actorLabels,edges:c.edges.length,start:c.start}))},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
