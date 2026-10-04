// Reconcile two blind reviews of swarm-watch link hypotheses.
// Usage: node src/village-review-reconcile.mjs <review-dir>
// A verdict that cites the later message counts only if its quote is an exact
// substring of that message as shown to the reviewer. Reconciliation keeps the
// weaker reading: a link is supported only when both reviewers report use.
import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const VERDICTS=['no-link','mention-only','reported-use'];
const normalize=text=>String(text).replace(/\s+/g,' ').trim();

export function checkReview(review,laterText){
 if(!review||!VERDICTS.includes(review.verdict))return {verdict:null,problem:'missing or invalid verdict'};
 const out={verdict:review.verdict,claimed:review.verdict,addressed:review.addressed===true,artifact:review.artifact||null,specific:review.specific_content===true,confidence:review.confidence||null,note:review.note||null,quote:review.quote||null,quoteVerified:null};
 if(review.verdict==='no-link')return out;
 // Whitespace-normalised containment: reviewers copy from JSON where newlines are escaped.
 out.quoteVerified=Boolean(review.quote)&&normalize(laterText).includes(normalize(review.quote));
 if(!out.quoteVerified){out.verdict='no-link';out.problem='quote not found in the later message; verdict not counted';}
 return out;
}

export function reconcilePair(a,b){
 if(!a.verdict||!b.verdict)return 'unreviewed';
 const low=Math.min(VERDICTS.indexOf(a.verdict),VERDICTS.indexOf(b.verdict)),high=Math.max(VERDICTS.indexOf(a.verdict),VERDICTS.indexOf(b.verdict));
 if(high===0)return 'rejected';
 if(low===0)return 'disputed';
 return low===2?'supported':'mention';
}

export function kappa(pairs){
 const n=pairs.length;if(!n)return null;
 const agree=pairs.filter(([x,y])=>x===y).length/n;
 const expected=VERDICTS.reduce((sum,v)=>sum+(pairs.filter(p=>p[0]===v).length/n)*(pairs.filter(p=>p[1]===v).length/n),0);
 return expected===1?1:(agree-expected)/(1-expected);
}

export function reconcile(key,messages,reviews,maxText=6000){
 const text=new Map(messages.map(m=>[m.id,String(m.text).slice(0,maxText)])),links={},raw=[];
 for(const k of key){
  const later=text.get(k.pair[1])||'',a=checkReview(reviews.A.get(k.itemId),later),b=checkReview(reviews.B.get(k.itemId),later);
  const status=reconcilePair(a,b);
  links[k.pair.join('>')]={itemId:k.itemId,kind:k.kind,candidates:k.candidates,refs:k.refs,status,A:a,B:b};
  if(a.claimed&&b.claimed)raw.push([a.claimed,b.claimed,k.kind]);
 }
 const tally=kind=>{const rows=Object.values(links).filter(l=>l.kind===kind),count=s=>rows.filter(l=>l.status===s).length;return {total:rows.length,supported:count('supported'),mention:count('mention'),disputed:count('disputed'),rejected:count('rejected'),unreviewed:count('unreviewed')};};
 const all=Object.values(links),quoteChecks=all.flatMap(l=>[l.A,l.B]).filter(r=>r.quoteVerified!==null&&r.quoteVerified!==undefined);
 return {schemaVersion:1,rule:'supported = both reviewers reported-use with verified quotes; mention = both at least mention-only; disputed = one reviewer no-link; rejected = both no-link',
  summary:{detector:tally('detector-link'),control:tally('unlinked-control'),
   agreement:{items:raw.length,exact:raw.filter(([x,y])=>x===y).length,kappa:kappa(raw)},
   quotes:{checked:quoteChecks.length,verified:quoteChecks.filter(r=>r.quoteVerified).length,failed:quoteChecks.filter(r=>!r.quoteVerified).length}},links};
}

function main(){
 const dir=process.argv[2];
 if(!dir||!existsSync(join(dir,'key','key.json'))){console.error('Usage: node src/village-review-reconcile.mjs <review-dir>');process.exit(2);}
 const {key}=JSON.parse(readFileSync(join(dir,'key','key.json'),'utf8')),messages=JSON.parse(readFileSync(join(dir,'key','messages.json'),'utf8'));
 const reviews={A:new Map(),B:new Map()},files=[],problems=[];
 for(const name of readdirSync(join(dir,'reviews')).sort()){
  const match=/^packet-(\d+)-reviewer-([AB])\.json$/.exec(name);if(!match)continue;
  try{const body=JSON.parse(readFileSync(join(dir,'reviews',name),'utf8'));for(const item of body.items||[])reviews[match[2]].set(item.itemId,item);files.push({name,items:(body.items||[]).length});}
  catch(error){problems.push({name,error:error.message});}
 }
 const result={...reconcile(key,messages,reviews),reviewFiles:files,problems,reconciledAt:new Date().toISOString()};
 const target=join(dir,'reconciliation.json');
 if(existsSync(target)){console.error('Refusing to overwrite '+target);process.exit(2);}
 writeFileSync(target,JSON.stringify(result,null,1));
 console.log(JSON.stringify({...result.summary,files:files.length,problems}));
}

if(process.argv[1]&&process.argv[1].endsWith('village-review-reconcile.mjs'))main();
