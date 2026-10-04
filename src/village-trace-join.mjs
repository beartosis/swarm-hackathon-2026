// Join reviewed links to computer-use action traces.
// Usage: node src/village-trace-join.mjs <review-dir> <link-tokens.json> <matched-turns.jsonl> <computer_use_sessions.jsonl.gz> <new-output.json>
// A link has trace access when the receiving agent ran an action, or got tool output,
// that contains the artifact's identifier after the earlier message and no later than
// the receiver's own report. The model's private reasoning is not counted. On AI
// Village this did not separate supported from rejected links, so it is context only.
import {createReadStream,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const SNIPPET=160;
const lines=stream=>createInterface({input:stream,crlfDelay:Infinity});
const utc=text=>Date.parse(String(text).replace(' ','T')+'Z');

// Which executed/observed fields of a turn contain the token. `agent_messages`
// (raw model response, including thinking) is deliberately excluded.
export function hitsInTurn(turn,token){
 const hits=[],fields=[['action',turn.agent_action?JSON.stringify(turn.agent_action):''],['output',turn.output||''],['error',turn.error||'']];
 for(const [field,text]of fields){const at=text.indexOf(token);if(at>=0)hits.push({field,snippet:text.slice(Math.max(0,at-60),at+token.length+60).replace(/\s+/g,' ').slice(0,SNIPPET)});}
 return hits;
}

export function joinLinks(links,tokens,messages,turns){
 const byMessage=new Map(messages.map(m=>[m.id,m])),out={};
 for(const [key,list]of Object.entries(tokens)){
  if(!links[key])continue;
  const [from,to]=key.split('>'),a=byMessage.get(from),b=byMessage.get(to);if(!a||!b)continue;
  const found=[];
  for(const turn of turns){
   if(turn.agent!==b.actor||turn.time<=a.time||turn.time>b.time)continue;
   for(const token of list)for(const hit of hitsInTurn(turn.row,token))found.push({turnId:turn.row.id,sessionId:turn.row.session_id,time:new Date(turn.time).toISOString(),token,field:hit.field,snippet:hit.snippet,lineSha256:turn.sha});
  }
  found.sort((x,y)=>x.time.localeCompare(y.time));
  out[key]={tokens:list,turns:new Set(found.map(f=>f.turnId)).size,first:found[0]||null,fields:[...new Set(found.map(f=>f.field))].sort(),evidence:found.slice(0,5)};
 }
 return out;
}

async function main(){
 const [reviewDir,tokenPath,matchPath,sessionPath,output]=process.argv.slice(2);
 if(!output){console.error('Usage: node src/village-trace-join.mjs <review-dir> <link-tokens.json> <matched-turns.jsonl> <computer_use_sessions.jsonl.gz> <new-output.json>');process.exit(2);}
 if(existsSync(output)){console.error('Refusing to overwrite '+output);process.exit(2);}
 const review=JSON.parse(readFileSync(join(reviewDir,'reconciliation.json'),'utf8')),messages=JSON.parse(readFileSync(join(reviewDir,'key','messages.json'),'utf8')),tokens=JSON.parse(readFileSync(tokenPath,'utf8'));
 const agentOf=new Map();
 for await(const line of lines(createReadStream(sessionPath).pipe(createGunzip()))){if(!line)continue;const row=JSON.parse(line);agentOf.set(row.id,row.agent_id);}
 const turns=[];let bad=0,total=0;
 for await(const line of lines(createReadStream(matchPath))){
  if(!line)continue;total++;
  try{const row=JSON.parse(line),agent=agentOf.get(row.session_id);if(!agent)continue;turns.push({row,agent,time:utc(row.created_at),sha:createHash('sha256').update(line).digest('hex')});}catch{bad++;}
 }
 const joined=joinLinks(review.links,tokens,messages,turns),rows=Object.entries(joined);
 const tally=status=>{const of=rows.filter(([key])=>review.links[key].status===status);return {withTokens:of.length,corroborated:of.filter(([,v])=>v.turns>0).length};};
 const result={schemaVersion:1,rule:'receiver action/output/error contains the artifact identifier after the earlier message and no later than the receiver report; model reasoning excluded',
  inputs:{matchedTurns:total,unparsed:bad,turnsWithKnownSession:turns.length,sessions:agentOf.size},summary:{supported:tally('supported'),mention:tally('mention'),disputed:tally('disputed'),rejected:tally('rejected')},links:joined};
 writeFileSync(output,JSON.stringify(result,null,1));
 console.log(JSON.stringify({inputs:result.inputs,summary:result.summary}));
}

if(process.argv[1]&&process.argv[1].endsWith('village-trace-join.mjs'))main().catch(error=>{console.error(error.message);process.exit(1);});
