// Standalone constellation page for a lineage replay, a swarm scan, or a reviewed scan.
// Usage: node src/lineage/constellation.mjs <replay.json|scan.json> <new-output.html> [scan-candidate-id]
// Lanes are agent labels, stars are recorded events, curves are links between
// two specific records. Labels are not authenticated agents.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {themeCss} from '../site-theme.mjs';

const EXCERPT=240;
// One visual vocabulary for every source. The three hues pass the dataviz palette
// validator on the dark surface; rejected links are neutral grey context, and every
// kind also differs by dash pattern.
// `tier` orders how much the evidence supports.
export const KINDS={
 'reported-uptake':{label:'uptake reported in the receiver’s text',color:'#199e70',dash:'',width:3,tier:'supported'},
 'contribution-to-uptake':{label:'contribution-to-uptake, observed',color:'#199e70',dash:'',width:3,tier:'supported'},
 'mention':{label:'acknowledged, no use stated',color:'#3987e5',dash:'7 5',width:2,tier:'open'},
 'disputed':{label:'reviewers disagree',color:'#c98500',dash:'6 6',width:2,tier:'open'},
 'unresolved-candidate':{label:'candidate link, unresolved after review',color:'#c98500',dash:'6 6',width:2,tier:'open'},
 'unreviewed-claim':{label:'retrieval hypothesis, not reviewed',color:'#c98500',dash:'6 6',width:2,tier:'open'},
 'rejected':{label:'rejected by both reviewers',color:'#6f8598',dash:'2 6',width:1.5,tier:'rejected'}
};
const kindOf=kind=>KINDS[kind]?kind:'unresolved-candidate';
const WIKI_VOCAB={lanes:'signatures',stars:'revisions',star:'Revision',solid:'with reported uptake',
 intro:'One lane per signature, one star per revision, one curve per reviewed link. Click any of them for the evidence.',
 help:'A star is one archived revision. A dashed amber curve is a candidate link that review left unresolved. A solid green curve has reported uptake in the receiver’s own text. Neither kind establishes a read, an action or intent.',
 source:'Source: collusion.wiki public export.'};
const SCAN_VOCAB={lanes:'agent labels',stars:'messages',star:'Message',solid:'reviewed and supported',
 intro:'One lane per agent, one star per message, one curve per candidate link. None is reviewed yet.',
 help:'A star is one chat message. A dashed amber curve is an unreviewed retrieval hypothesis: the later message names the earlier author and repeats an exact artifact reference. It reports use; it does not establish that a transfer or an action happened.',
 source:'Source: AI Digest, AI Village dataset (2026), https://theaidigest.org/village. Known-population calibration, not a wild-swarm discovery.'};
const REVIEW_VOCAB={...SCAN_VOCAB,solid:'supported by both reviewers',
 intro:'One lane per agent, one star per message, one curve per confirmed hand-off. Click a curve for the evidence.',
 help:'Click a curve to see both reviewers’ verdicts and their verified quotes. Green: both report use. Blue: acknowledged only. Amber: reviewers disagree. Grey: both rejected the detector’s link.'};
const tierCount=(edges,tier)=>edges.filter(e=>KINDS[kindOf(e.kind)].tier===tier).length;

export function buildConstellation(replay){
 const order=[...replay.records].sort((a,b)=>Date.parse(a.eventTime)-Date.parse(b.eventTime)||a.id.localeCompare(b.id));
 const lanes=[],laneOf=new Map(),basis=new Map();
 const lane=label=>{if(!lanes.includes(label))lanes.push(label);return label;};
 const present=new Set(order.map(r=>r.id));
 const assign=(recordId,label,why)=>{if(present.has(recordId)&&label&&!laneOf.has(recordId)){laneOf.set(recordId,lane(label));basis.set(recordId,why);}};
 for(const entity of replay.entities||[])if(entity.kind==='source-signature')for(const id of entity.evidenceIds||[])assign(id,entity.label,'first appearance of this signature');
 const edges=(replay.edges||[]).map(edge=>{
  const from=edge.contributionOriginVersion||edge.producerRecordId||edge.evidenceIds?.[0],to=edge.consumerReportVersion||edge.consumerRecordId||edge.evidenceIds?.at(-1);
  const producer=edge.producerSignature||String(edge.from||'').replace(/^signature:/,''),consumer=edge.consumerSignature||String(edge.to||'').replace(/^signature:/,'');
  assign(from,producer,'named as producer in a reviewed link');assign(to,consumer,'named as consumer in a reviewed link');
  return {id:edge.id,from,to,producer,consumer,kind:kindOf(edge.kind),label:edge.label,evidenceType:edge.evidenceType||null,summary:edge.summary||null,availableAt:edge.availableAt,
   dimensions:Object.fromEntries(Object.entries(edge.dimensions||{}).map(([name,d])=>[name,{status:d.status,value:d.value}])),
   missing:(edge.missingLinks||[]).map(m=>m.description),
   quotes:(edge.citations||[]).filter(c=>c.quote).map(c=>({recordId:c.recordId,quote:c.quote,line:c.decompressedJsonlLine??null,bodyLine:c.bodyLine??null}))};
 });
 const unattributed='No signature in reviewed links';
 const records=order.map((r,i)=>({id:r.id,order:i,time:r.eventTime,lane:laneOf.get(r.id)||lane(unattributed),laneBasis:basis.get(r.id)||'not attributed by any reviewed link',
  text:String(r.text||'').slice(0,EXCERPT),truncated:String(r.text||'').length>EXCERPT,sha256:r.sha256||null,line:r.citation?.decompressedJsonlLine??r.line??null,sourceUrl:r.sourceUrl||null}));
 if(lanes.includes(unattributed)){lanes.splice(lanes.indexOf(unattributed),1);lanes.push(unattributed);}
 const known=new Set(records.map(r=>r.id)),drawn=edges.filter(e=>known.has(e.from)&&known.has(e.to));
 const stats=[{n:lanes.filter(l=>l!==unattributed).length,label:'signatures'},{n:records.length,label:'revisions'},{n:tierCount(drawn,'open'),label:'links left unresolved',tone:'warn'},
  {n:tierCount(drawn,'supported'),label:'with reported uptake',tone:'good'},{n:drawn.filter(e=>e.dimensions.read?.status==='observed').length,label:'with an observed read'}];
 return {title:replay.title,scope:replay.scope,cutoffPolicy:replay.cutoffPolicy||null,vocab:replay.scope?.synthetic?{...WIKI_VOCAB,source:'Synthetic fixture, not a research finding.'}:WIKI_VOCAB,
  lanes,records,edges:drawn,stats,droppedEdges:edges.filter(e=>!known.has(e.from)||!known.has(e.to)).map(e=>e.id)};
}

const UNREVIEWED_DIMENSIONS={write:{status:'observed',value:'Both messages are preserved in the archive.'},read:{status:'unknown',value:'No read telemetry was joined for this pair.'},use:{status:'unknown',value:'Lexical match only; not reviewed.'},producer:{status:'unknown',value:'Publisher label, not an authenticated producing agent.'}};

// One retained candidate from a swarm-watch scan.json. Only sampled records are
// drawn; edges whose records fall outside the sample are counted, not drawn.
export function buildFromScan(scan,candidateId){
 const c=scan.candidates.find(x=>x.id===candidateId)||scan.candidates[0];
 const order=[...c.records].filter(r=>!r.human).sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
 const known=new Set(order.map(r=>r.id)),names=new Map(c.actors.map(a=>[a.id,a.name]));
 const lanes=[];for(const r of order){const n=r.name||names.get(r.actor)||r.actor;if(!lanes.includes(n))lanes.push(n);}
 const records=order.map((r,i)=>({id:r.id,order:i,time:new Date(r.time).toISOString(),lane:r.name||names.get(r.actor)||r.actor,laneBasis:r.identity||'publisher label',
  text:String(r.excerpt||'').slice(0,EXCERPT),truncated:String(r.excerpt||'').length>EXCERPT,sha256:r.recordSha256||null,line:r.line??null,sourceUrl:r.sourceUrl||null}));
 const byId=new Map(records.map(r=>[r.id,r])),seen=new Set();
 const all=c.edges.map((e,i)=>({id:c.id+'-e'+i,from:e.records[0],to:e.records[1],producer:names.get(e.from)||e.from,consumer:names.get(e.to)||e.to,kind:'unreviewed-claim',label:'Unreviewed artifact-uptake claim',evidenceType:e.type,
  summary:'Shared exact reference: '+(e.refs||[]).join(', '),availableAt:known.has(e.records[1])?byId.get(e.records[1]).time:null,dimensions:UNREVIEWED_DIMENSIONS,
  missing:['Did the later author actually open the referenced artifact?','Did an attributable action follow?','Independent review of the surrounding context.'],quotes:[]}));
 const drawn=all.filter(e=>known.has(e.from)&&known.has(e.to)&&!seen.has(e.from+'>'+e.to)&&seen.add(e.from+'>'+e.to));
 return {title:'AI Village · '+c.start.slice(0,10)+' to '+c.end.slice(0,10)+' · retrieval candidate',scope:{start:c.start,end:c.end},vocab:SCAN_VOCAB,
  cutoffPolicy:'Candidate '+c.id+'. Drawn from '+records.length+' sampled messages of '+c.evidenceRecords+' evidence records; '+drawn.length+' of '+c.edges.length+' hypothesised links have both ends in the sample. Status: '+c.status+'.',
  lanes,records,edges:drawn,droppedEdges:[],
  stats:[{n:lanes.length,label:'agent labels'},{n:records.length,label:'messages'},{n:drawn.length,label:'unreviewed uptake claims',tone:'warn'},{n:0,label:'reviewed and supported',tone:'good'},{n:0,label:'with an observed read'}]};
}

const top=(counts,n=3)=>[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,n);
const bump=(map,key,by=1)=>map.set(key,(map.get(key)||0)+by);
// Largest set of lanes joined by supported links, ignoring direction.
export function largestComponent(lanes,edges){
 const parent=new Map(lanes.map(l=>[l,l])),find=x=>{while(parent.get(x)!==x)x=parent.get(x);return x;};
 for(const e of edges)parent.set(find(e.producer),find(e.consumer));
 const groups=new Map();for(const l of lanes){const root=find(l);groups.set(root,[...(groups.get(root)||[]),l]);}
 return [...groups.values()].sort((a,b)=>b.length-a.length)[0]||[];
}

// A scan candidate with every evidence message and the reconciled blind review.
// `messages` are full archive rows for the candidate's evidence lines; `review`
// is the output of village-review-reconcile.mjs.
export function buildFromReview(scan,candidateId,messages,review,traces=null){
 const c=scan.candidates.find(x=>x.id===candidateId)||scan.candidates[0];
 const names=new Map(c.actors.map(a=>[a.id,a.name])),byMessage=new Map(messages.map(m=>[m.id,m]));
 const ids=[...new Set(c.edges.flatMap(e=>e.records))].filter(id=>byMessage.has(id)).sort((a,b)=>byMessage.get(a).time-byMessage.get(b).time||a.localeCompare(b));
 const nameOf=m=>names.get(m.actor)||m.name||m.actor,lanes=[];
 for(const id of ids){const n=nameOf(byMessage.get(id));if(!lanes.includes(n))lanes.push(n);}
 const records=ids.map((id,i)=>{const m=byMessage.get(id);return {id,order:i,time:new Date(m.time).toISOString(),lane:nameOf(m),laneBasis:'publisher-labelled agent',text:String(m.text).slice(0,EXCERPT),truncated:String(m.text).length>EXCERPT,sha256:m.lineSha256||null,line:m.line??null,sourceUrl:'https://theaidigest.org/village'};});
 const time=new Map(records.map(r=>[r.id,r.time])),seen=new Set(),edges=[];
 const KIND={supported:'reported-uptake',mention:'mention',disputed:'disputed',rejected:'rejected',unreviewed:'unreviewed-claim'};
 const LABEL={supported:'Reported use, both reviewers',mention:'Acknowledged, no use stated',disputed:'Reviewers disagree',rejected:'Rejected by both reviewers',unreviewed:'Not reviewed'};
 const USE={supported:['reported','Both reviewers: the later author states they used the earlier author’s artifact.'],mention:['unknown','Both reviewers see a reference; at least one sees no stated use.'],disputed:['unknown','One reviewer sees a link, the other sees none.'],rejected:['unknown','Both reviewers: the later message does not take up the earlier author’s work.'],unreviewed:['unknown','Lexical match only; not reviewed.']};
 c.edges.forEach((e,i)=>{
  const key=e.records.join('>');if(seen.has(key)||!time.has(e.records[0])||!time.has(e.records[1]))return;seen.add(key);
  const trace=traces?.links?.[key]?.turns>0?traces.links[key]:null,rej=traces?.summary?.rejected,baseline=rej&&rej.withTokens?Math.round(100*rej.corroborated/rej.withTokens)+'%':'most';
  const r=review.links[key],status=r?.status||'unreviewed',view=x=>x&&x.claimed?{verdict:x.claimed,counted:x.verdict,artifact:x.artifact,quote:x.quote,quoteVerified:x.quoteVerified,specific:x.specific,confidence:x.confidence,note:x.note}:null;
  edges.push({id:c.id+'-e'+i,from:e.records[0],to:e.records[1],producer:names.get(e.from)||e.from,consumer:names.get(e.to)||e.to,kind:KIND[status],label:LABEL[status],evidenceType:'detector: '+e.type,trace:trace?{turns:trace.turns,fields:trace.fields,evidence:trace.evidence.slice(0,3).map(t=>({time:t.time,field:t.field,token:t.token,snippet:t.snippet,turnId:t.turnId}))}:null,
   summary:'Detector matched: '+(e.refs||[]).join(', '),availableAt:time.get(e.records[1]),refs:e.refs||[],artifact:r?.A?.artifact||r?.B?.artifact||(e.refs||[])[0]||null,
   dimensions:{write:{status:'observed',value:'Both messages are preserved in the archive.'},read:trace?{status:'accessed',value:'The receiver\u2019s computer-use trace names this artifact in '+trace.turns+' turn'+(trace.turns===1?'':'s')+' between the two messages ('+trace.fields.join(', ')+'). Weak evidence: '+baseline+' of links that both reviewers rejected show the same.'}:{status:'unknown',value:traces?'No receiver action between the two messages references the artifact.':'No read telemetry was joined for this pair.'},use:{status:USE[status][0],value:USE[status][1]},action:{status:'unknown',value:'Whether the receiver\u2019s later work depended on the artifact is not assessed.'},producer:{status:'unknown',value:'Publisher label, not an authenticated producing agent.'}},
   review:r?{A:view(r.A),B:view(r.B)}:null,
   missing:[trace?'Content-level check: did the receiver read the artifact\u2019s content, or only touch a file with this name?':'Read evidence: no receiver action references the artifact between the two messages.','Did the receiver\u2019s later output depend on it?','Reviewers are two sessions of one model family, not independent humans.'],quotes:[]});
 });
 const supported=edges.filter(e=>KINDS[e.kind].tier==='supported'),touched=k=>edges.filter(e=>e.kind===k&&e.trace).length,producers=new Map(),consumers=new Map(),reach=new Map(),directed=new Set();
 for(const e of supported){bump(producers,e.producer);bump(consumers,e.consumer);directed.add(e.producer+'>'+e.consumer);if(e.artifact)reach.set(e.artifact,new Set([...(reach.get(e.artifact)||[]),e.consumer]));}
 const reciprocal=[...directed].filter(d=>{const [a,b]=d.split('>');return a<b&&directed.has(b+'>'+a);}).length;
 const component=largestComponent(lanes,supported),list=rows=>rows.length?rows.map(([n,k])=>n+' ('+k+')').join(', '):'none';
 const furthest=[...reach.entries()].map(([a,s])=>[a,s.size]).sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0])).slice(0,3);
 const count=k=>edges.filter(e=>e.kind===k).length;
 const questions=[
  {q:'How many agents took part?',a:lanes.length+' publisher-assigned labels wrote the '+records.length+' messages in this evidence. A label is not an authenticated producing agent.'},
  {q:'How much of the detector’s network survives review?',a:supported.length+' of '+edges.length+' proposed links are supported by both reviewers. '+count('mention')+' are acknowledgements only, '+count('disputed')+' are disputed and '+count('rejected')+' are rejected.'},
  {q:'How many agents are actually connected?',a:component.length>1?component.length+' of '+lanes.length+' labels are joined by supported links: '+component.join(', ')+'.':'No two labels are joined by a supported link.'},
  {q:'Did the receiver actually touch the artifact?',a:traces?'In '+touched('reported-uptake')+' of '+supported.length+' supported links the receiver\u2019s own computer-use trace names the artifact between the two messages. But so does the trace for '+touched('rejected')+' of '+edges.filter(e=>e.kind==='rejected').length+' rejected links, so access alone does not show a hand-off.':'Action traces were not joined.'},
  {q:'Whose work was taken up most?',a:list(top(producers))},
  {q:'Who took up others’ work most?',a:list(top(consumers))},
  {q:'Which artifacts reached the most agents?',a:furthest.length?furthest.map(([a,k])=>a+' ('+k+')').join(', '):'none'},
  {q:'Is uptake reciprocal?',a:reciprocal+' pair'+(reciprocal===1?'':'s')+' of labels have supported links in both directions.'},
  {q:'Were humans in the room?',a:c.humanMessagesInScopeInterval+' human messages fall inside this window. That is context, not evidence that humans relayed anything.'},
  {q:'What does this not show?',a:'Whether the receiver read the artifact\u2019s content or relied on it. Reported use is what the later author wrote, checked by two model reviewers of one family. Trace access is context, not confirmation.'}];
 const transfers=supported.map(e=>({traced:Boolean(e.trace),edgeId:e.id,artifact:e.artifact,producer:e.producer,consumer:e.consumer,time:e.availableAt})).sort((a,b)=>a.time.localeCompare(b.time));
 const day=iso=>new Date(iso).toLocaleDateString('en-US',{month:'long',day:'numeric',timeZone:'UTC'});
 return {title:'AI Village, '+day(c.start)+' to '+day(c.end)+', '+c.start.slice(0,4),scope:{start:c.start,end:c.end},vocab:REVIEW_VOCAB,
  cutoffPolicy:'Candidate '+c.id+': all '+records.length+' evidence messages and '+edges.length+' detector links, each reviewed blind by two reviewers.',
  lanes,records,edges,droppedEdges:[],summary:{transfers,questions,component},
  stats:[{n:lanes.length,label:'agent labels'},{n:records.length,label:'messages'},{n:edges.length,label:'links proposed by detector'},{n:supported.length,label:'supported by both reviewers',tone:'good'},{n:count('mention')+count('disputed'),label:'acknowledged or disputed',tone:'warn'},{n:count('rejected'),label:'rejected'},{n:component.length>1?component.length:0,label:'labels connected by supported links',tone:'good'}]};
}

const css=`
nav{display:flex;align-items:baseline;gap:22px;padding:18px 32px;border-bottom:1px solid var(--line);font-size:.9375rem}
nav .mark{font-weight:700;font-size:1.125rem;letter-spacing:-.01em;color:var(--ink);text-decoration:none}
nav a.back{color:var(--ink-2);text-decoration:none;transition:color .15s var(--ease)}
nav a.back:hover{color:var(--ink)}
header{padding:36px 32px 0}
h1{font-size:clamp(1.625rem,2.6vw,2.125rem);letter-spacing:-.025em}
header p{max-width:78ch;margin:12px 0 0;color:var(--ink-2)}
h2{font-size:1.0625rem;margin:0 0 10px}
h3{font-size:.8125rem;font-weight:500;color:var(--ink-3);letter-spacing:0;margin:0 0 8px}
.facts{display:flex;flex-wrap:wrap;gap:6px 30px;margin:22px 32px 0;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:.9375rem;color:var(--ink-2)}
.facts b{color:var(--ink);font-weight:600;font-size:1.0625rem;font-variant-numeric:tabular-nums;margin-right:7px}
.tools{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:18px 32px 8px}
.tools button,.tools select{font:500 .875rem var(--sans);padding:8px 14px;border-radius:6px;border:1px solid var(--line-strong);background:transparent;color:var(--ink);cursor:pointer;transition:background .15s var(--ease),border-color .15s var(--ease),transform .15s var(--ease)}
.tools button:hover,.tools select:hover{background:var(--surface-2)}
.tools button:active{transform:scale(.97)}
.tools button#play{background:var(--accent);border-color:var(--accent);color:var(--accent-ink);font-weight:600;min-width:132px}
.tools button#play:hover{background:#9be9d5}
.tools button[aria-pressed=true]{background:var(--surface-2);border-color:var(--ink-2)}
.tools select{appearance:none;padding-right:30px;background-image:linear-gradient(45deg,transparent 50%,var(--ink-2) 50%),linear-gradient(135deg,var(--ink-2) 50%,transparent 50%);background-position:calc(100% - 16px) 50%,calc(100% - 11px) 50%;background-size:5px 5px;background-repeat:no-repeat}
.tools select option{background:var(--surface);color:var(--ink)}
.tools input[type=range]{flex:1;min-width:220px;accent-color:var(--accent)}
.tools label{display:flex;align-items:center;gap:7px;color:var(--ink-2);font-size:.875rem;cursor:pointer}
.tools input[type=checkbox]{accent-color:var(--accent);width:15px;height:15px}
#cut-label{padding:0 32px;margin:0 0 12px;font-size:.875rem;color:var(--ink-3);font-variant-numeric:tabular-nums}
main{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:20px;padding:0 32px 8px}
@media(max-width:1100px){main{grid-template-columns:1fr}}
.canvas{overflow:auto;border-radius:8px;border:1px solid var(--line);background:var(--surface)}
svg.sky{display:block;width:100%;min-width:860px}
.grid{stroke:var(--line);stroke-dasharray:2 7}
.orbit{stroke:var(--line-strong);stroke-dasharray:1 7}
.axis{fill:var(--ink-3);font:400 11px var(--mono)}
.lane{fill:var(--ink);font:500 13px var(--sans)}
.lane.unattributed{fill:var(--ink-3);font-style:italic}
.edge{fill:none;cursor:pointer;transition:opacity .2s var(--ease)}
.hit{fill:none;stroke:transparent;stroke-width:14;cursor:pointer}
.star{cursor:pointer}
.star .halo{fill:var(--star);opacity:.14;transition:opacity .15s var(--ease)}
.star .core{fill:var(--star);stroke:var(--surface);stroke-width:1.5}
.star:hover .halo{opacity:.4}
.star.dimmed{opacity:.18}
.star.selected .halo{opacity:.5}
.star.connected .core{fill:#fff3de}
.star:focus{outline:none}.star:focus-visible .halo{opacity:.6}
aside{border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:20px;align-self:start;position:sticky;top:14px;max-height:calc(100vh - 28px);overflow:auto;scrollbar-color:var(--line-strong) var(--surface)}
aside>p{margin:0 0 10px}
pre{white-space:pre-wrap;word-break:break-word;border-left:2px solid var(--line-strong);padding:2px 0 2px 12px;font:400 .8125rem/1.55 var(--mono);margin:10px 0;color:var(--ink)}
dl{display:grid;grid-template-columns:78px 1fr;gap:9px 12px;margin:16px 0 0;padding-top:16px;border-top:1px solid var(--line);font-size:.9375rem}
dt{color:var(--ink-3)}dd{margin:0;color:var(--ink-2)}
dd b{color:var(--ink);font-weight:600;margin-right:6px}
.state{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;background:var(--disputed)}
.state.observed,.state.reported{background:var(--supported)}
.state.accessed{background:var(--mention)}
.verdict{display:inline-block;padding:2px 9px;border-radius:4px;font:500 .8125rem var(--sans);margin-right:8px;background:var(--surface-2);color:var(--ink)}
.verdict.reported-use{background:var(--supported);color:#fff}
.verdict.mention-only{background:var(--mention);color:#fff}
.reviewer{padding:14px 0 4px;border-top:1px solid var(--line);margin-top:14px;font-size:.9375rem}
.reviewer p{margin:6px 0;color:var(--ink-2)}
.check{color:var(--ink-2);font-size:.8125rem}
aside h2+ul,aside ul{margin:6px 0 0;padding-left:18px;color:var(--ink-2);font-size:.9375rem}
aside li{margin:5px 0}
aside h2.sub{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}
.legend{display:flex;flex-wrap:wrap;gap:8px 22px;padding:12px 2px;font-size:.8125rem;color:var(--ink-2)}
.legend svg{width:40px;height:10px;display:inline-block;vertical-align:middle;margin-right:8px}
code{font:400 .8125rem var(--mono);word-break:break-all}
.findings{padding:36px 0 0}
.relay{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,9fr);gap:18px;padding:14px 0;border-top:1px solid var(--line)}
@media(max-width:800px){.relay{grid-template-columns:1fr;gap:6px}}
.relay .what code{display:block;overflow-wrap:anywhere;font-size:.8125rem;color:var(--ink)}
.relay .what span{font-size:.8125rem;color:var(--ink-3)}
.hop{display:grid;grid-template-columns:92px minmax(0,1fr);gap:3px 12px;width:100%;text-align:left;background:none;border:0;color:var(--ink);font:inherit;font-size:.9375rem;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .15s var(--ease)}
.hop:hover{background:var(--surface)}
.hop time{color:var(--ink-3);font-size:.8125rem;font-variant-numeric:tabular-nums;padding-top:2px}
.hop b{font-weight:600}
.hop q{grid-column:2;color:var(--ink-2);font-size:.875rem;border-left:2px solid var(--supported);padding-left:10px;quotes:none;overflow-wrap:anywhere}
.findings details{margin-top:28px;border-top:1px solid var(--line);padding-top:14px}
.findings summary{cursor:pointer;color:var(--ink-2);font-weight:600}
.findings summary:hover{color:var(--ink)}
.findings h2{font-size:1.375rem;letter-spacing:-.02em;margin-bottom:6px}
.qa{margin:0;padding:14px 0;border-top:1px solid var(--line)}
.qa b{display:block;font-weight:600;margin-bottom:2px}
.qa span{color:var(--ink-2);font-size:.9375rem}
table{border-collapse:collapse;width:100%;font-size:.875rem}
th{color:var(--ink-3);font-weight:500;text-align:left;border-bottom:1px solid var(--line-strong);padding:8px 10px 8px 0;font-size:.8125rem;position:sticky;top:0;background:var(--canvas)}
td{padding:9px 10px 9px 0;border-bottom:1px solid var(--line);vertical-align:top;font-variant-numeric:tabular-nums}
tbody tr{cursor:pointer;transition:background .15s var(--ease)}
tbody tr:hover{background:var(--surface)}
.scroll{max-height:560px;overflow:auto;margin-top:12px}
footer{margin:56px 32px 0;padding:20px 0 44px;border-top:1px solid var(--line);font-size:.8125rem;color:var(--ink-3);max-width:none}
`;

// Runs in the browser. Kept dependency-free so the page works from file://.
function client(){
 const data=JSON.parse(document.getElementById('data').textContent),V=data.vocab,K=data.kinds;
 const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
 const svg=(tag,attrs={},text)=>{const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=String(text);return el;};
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
 const LEFT=250,RIGHT=40,TOP=40,ROW=44,WIDTH=Math.max(1180,LEFT+RIGHT+data.records.length*10),HEIGHT=TOP+data.lanes.length*ROW+50;
 const times=data.records.map(r=>Date.parse(r.time)),tMin=Math.min(...times),tMax=Math.max(...times);
 const tier=e=>K[e.kind].tier,hasRejected=data.edges.some(e=>tier(e)==='rejected');
 let basis='order',cutoff=data.records.length-1,selected=null,whole=false,showRejected=data.edges.filter(e=>tier(e)==='supported').length<3;
 const xOf=r=>LEFT+(WIDTH-LEFT-RIGHT)*(basis==='order'?r.order/Math.max(1,data.records.length-1):(Date.parse(r.time)-tMin)/Math.max(1,tMax-tMin));
 const yOf=r=>TOP+data.lanes.indexOf(r.lane)*ROW+ROW/2;
 const byId=new Map(data.records.map(r=>[r.id,r]));
 const clock=t=>tMax-tMin>864e5?new Date(t).toISOString().slice(5,16).replace('T',' '):new Date(t).toISOString().slice(11,19)+'Z';
 function neighborhood(visibleEdges){
  if(!selected)return {nodes:new Set(),edges:new Set()};
  if(selected.edge)return {nodes:new Set([selected.edge.from,selected.edge.to]),edges:new Set([selected.edge.id])};
  const nodes=new Set([selected.record.id]),edges=new Set();let changed=true;
  while(changed){changed=false;for(const e of visibleEdges)if((nodes.has(e.from)||nodes.has(e.to))&&!edges.has(e.id)){edges.add(e.id);nodes.add(e.from);nodes.add(e.to);changed=true;}if(!whole)break;}
  return {nodes,edges};
 }
 function draw(){
  const visible=data.records.filter(r=>r.order<=cutoff),shown=new Set(visible.map(r=>r.id)),cutTime=Date.parse(data.records[cutoff].time);
  const edges=data.edges.filter(e=>shown.has(e.from)&&shown.has(e.to)&&Date.parse(e.availableAt)<=cutTime&&(showRejected||tier(e)==='supported'||selected?.edge?.id===e.id));
  // Draw weakest first so supported links sit on top.
  edges.sort((a,b)=>['rejected','open','supported'].indexOf(tier(a))-['rejected','open','supported'].indexOf(tier(b)));
  const focus=neighborhood(edges),canvas=svg('svg',{viewBox:'0 0 '+WIDTH+' '+HEIGHT,class:'sky',role:'group','aria-label':'Contribution constellation'});
  const defs=svg('defs');for(const [kind,k]of Object.entries(K)){const m=svg('marker',{id:'arrow-'+kind,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});m.append(svg('path',{d:'M 0 0 L 10 5 L 0 10 z',fill:k.color}));defs.append(m);}canvas.append(defs);
  const T=basis==='order'?Math.min(5,Math.max(1,data.records.length-1)):5;for(let i=0;i<=T;i++){const x=LEFT+(WIDTH-LEFT-RIGHT)*i/T;canvas.append(svg('line',{x1:x,y1:TOP-10,x2:x,y2:HEIGHT-40,class:'grid'}));canvas.append(svg('text',{x,y:HEIGHT-18,'text-anchor':'middle',class:'axis'},basis==='order'?V.star.toLowerCase()+' '+(Math.round((data.records.length-1)*i/T)+1):clock(tMin+(tMax-tMin)*i/T)));}
  data.lanes.forEach((label,i)=>{const y=TOP+i*ROW+ROW/2;canvas.append(svg('line',{x1:LEFT-10,y1:y,x2:WIDTH-RIGHT+10,y2:y,class:'orbit'}));canvas.append(svg('text',{x:LEFT-22,y:y+4,'text-anchor':'end',class:'lane'+(label.startsWith('No signature')?' unattributed':'')},label));});
  for(const e of edges){const a=byId.get(e.from),b=byId.get(e.to),ax=xOf(a),ay=yOf(a),bx=xOf(b),by=yOf(b),bend=Math.max(30,Math.abs(bx-ax)*.45),d='M '+ax+' '+ay+' C '+(ax+bend)+' '+ay+' '+(bx-bend)+' '+by+' '+bx+' '+by,k=K[e.kind];
   const isFocus=focus.edges.has(e.id),dim=focus.edges.size&&!isFocus;
   const path=svg('path',{d,class:'edge'+(dim?' dimmed':''),stroke:k.color,'stroke-width':isFocus?k.width+1.5:k.width,opacity:dim?.1:(k.tier==='supported'||isFocus?.95:.7),'marker-end':'url(#arrow-'+e.kind+')'}),hit=svg('path',{d,class:'hit'});
   if(k.dash)path.setAttribute('stroke-dasharray',k.dash);
   hit.append(svg('title',{},e.label+': '+e.producer+' → '+e.consumer));hit.onclick=()=>{selected={edge:e};draw();};canvas.append(path,hit);}
  for(const r of visible){const x=xOf(r),y=yOf(r),isSel=selected?.record?.id===r.id,g=svg('g',{role:'button',tabindex:0,'aria-label':V.star+' '+(r.order+1)+' in lane '+r.lane,class:'star'+(isSel?' selected':focus.nodes.has(r.id)?' connected':focus.nodes.size?' dimmed':'')});
   g.append(svg('title',{},r.lane+' · '+r.time),svg('circle',{cx:x,cy:y,r:isSel?17:12,class:'halo'}),svg('circle',{cx:x,cy:y,r:6.5,class:'core'}));
   g.onclick=()=>{selected={record:r};draw();};g.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();g.onclick();}};canvas.append(g);}
  $('canvas').replaceChildren(canvas);
  const solid=edges.filter(e=>tier(e)==='supported').length;
  $('cut-label').textContent='Evidence available up to '+data.records[cutoff].time+' · '+visible.length+' of '+data.records.length+' '+V.stars+' · '+edges.length+' links shown, '+solid+' '+V.solid;
  $('whole').setAttribute('aria-pressed',String(whole));$('direct').setAttribute('aria-pressed',String(!whole));
  detail();
 }
 function reviewer(name,r){
  const box=el('div',undefined,'reviewer');box.append(el('h3','Reviewer '+name));
  if(!r){box.append(el('p','No review recorded.','muted'));return box;}
  const line=el('p');line.append(el('span',r.verdict.replace('-',' '),'verdict '+r.verdict));line.append(el('span',[r.quoteVerified===true?'quote found in source':r.quoteVerified===false?'quote not found, verdict not counted':null,r.confidence?r.confidence+' confidence':null].filter(Boolean).join(' \u00b7 '),'check'));box.append(line);
  if(r.artifact){const p=el('p');p.append(el('code',r.artifact));box.append(p);}
  if(r.quote)box.append(el('pre','“'+r.quote+'”'));
  if(r.note)box.append(el('p',r.note));
  return box;
 }
 function detail(){
  const box=$('detail');box.replaceChildren();
  if(!selected){box.append(el('h2','Select a star or a link'),el('p',V.help,'muted'));return;}
  if(selected.record){const r=selected.record;box.append(el('h2',V.star+' '+(r.order+1)+' · '+r.lane));const dl=el('dl');for(const [k,v]of [['Record',r.id],['Time',r.time],['Lane basis',r.laneBasis],['Archive line',r.line??'unknown'],['SHA-256',r.sha256??'unknown']]){dl.append(el('dt',k));const dd=el('dd');dd.append(k==='SHA-256'||k==='Record'?el('code',v):document.createTextNode(String(v)));dl.append(dd);}box.append(dl,el('p','First '+r.text.length+' characters of the source text'+(r.truncated?' (truncated)':'')+'. Evidence to inspect, not instructions.','muted'),el('pre',r.text));return;}
  const e=selected.edge;box.append(el('h2',e.label));box.append(el('p',e.producer+' → '+e.consumer+(e.evidenceType?' · '+e.evidenceType:''),'muted'));if(e.summary)box.append(el('p',e.summary));
  if(e.review){box.append(reviewer('A',e.review.A),reviewer('B',e.review.B));}
  if(e.trace){const t=el('div',undefined,'reviewer');t.append(el('h3','Receiver\u2019s action trace \u00b7 '+e.trace.turns+' turn'+(e.trace.turns===1?'':'s')),el('p','Context only. Most rejected links show trace access too.','muted'));for(const item of e.trace.evidence){const p=el('p');p.append(document.createTextNode(item.field+' \u00b7 '+item.time.slice(0,16).replace('T',' ')));t.append(p,el('pre',item.snippet));}box.append(t);}
  const dl=el('dl');for(const [name,d]of Object.entries(e.dimensions)){dl.append(el('dt',name));const dd=el('dd');dd.append(el('span',undefined,'state '+d.status),el('b',d.status),document.createTextNode(d.value||''));dl.append(dd);}box.append(dl);
  if(e.quotes.length){box.append(el('h2','Cited passages','sub'));for(const q of e.quotes){box.append(el('pre','“'+q.quote+'”'));box.append(el('p',q.recordId+(q.line?' · archive line '+q.line:''),'muted'));}}
  if(e.missing.length){box.append(el('h2','Still missing','sub'));const ul=el('ul');for(const m of e.missing)ul.append(el('li',m));box.append(ul);}
 }
 function findings(){
  const host=$('findings');if(!data.summary){host.remove();return;}
  // Relay view: one block per artifact that travelled, then who picked it up, in time order.
  const relay=el('div'),groups=new Map();relay.append(el('h2','What moved'));
  for(const t of data.summary.transfers){const k=t.artifact||'not identified';if(!groups.has(k))groups.set(k,[]);groups.get(k).push(t);}
  if(!groups.size)relay.append(el('p','No confirmed hand-off in this window.','muted'));
  for(const [artifact,hops]of groups){
   const card=el('div',undefined,'relay'),what=el('div',undefined,'what'),list=el('div');what.append(el('code',artifact),el('span',hops.length+' pick-up'+(hops.length===1?'':'s')));
   for(const t of hops){
    const e=data.edges.find(x=>x.id===t.edgeId),hop=el('button',undefined,'hop'),who=el('span');hop.type='button';
    who.append(el('b',t.producer),document.createTextNode(' \u2192 '),el('b',t.consumer));hop.append(el('time',t.time.slice(5,16).replace('T',' ')),who);
    const quote=e?.review?.A?.quote||e?.review?.B?.quote;if(quote)hop.append(el('q',quote.length>200?quote.slice(0,200)+'\u2026':quote));
    hop.onclick=()=>{selected={edge:e};cutoff=data.records.length-1;$('cutoff').value=cutoff;draw();$('canvas').scrollIntoView({behavior:'smooth',block:'center'});};list.append(hop);
   }
   card.append(what,list);relay.append(card);
  }
  const more=el('details'),sum=el('summary','Summary of this network');more.append(sum);
  for(const item of data.summary.questions){const q=el('p',undefined,'qa');q.append(el('b',item.q),el('span',item.a));more.append(q);}
  host.append(relay,more);
 }
 const legend=$('legend');for(const kind of Object.keys(K).filter(k=>data.edges.some(e=>e.kind===k))){const k=K[kind],item=el('span'),s=svg('svg',{viewBox:'0 0 44 12'}),p=svg('path',{d:'M2 6 H42',stroke:k.color,'stroke-width':k.width});if(k.dash)p.setAttribute('stroke-dasharray',k.dash);s.append(p);item.append(s,document.createTextNode(k.label));legend.append(item);}
 if(data.edges.some(e=>tier(e)!=='supported')){const label=el('label'),box=el('input');box.type='checkbox';box.id='rejected';box.checked=showRejected;box.onchange=()=>{showRejected=box.checked;draw();};label.append(box,document.createTextNode('Show unconfirmed links'));$('tools').append(label);}
 $('cutoff').max=data.records.length-1;$('cutoff').value=cutoff;$('cutoff').oninput=ev=>{cutoff=Number(ev.target.value);if(selected?.record&&selected.record.order>cutoff)selected=null;if(selected?.edge&&(byId.get(selected.edge.to).order>cutoff||byId.get(selected.edge.from).order>cutoff))selected=null;draw();};
 $('basis').onchange=ev=>{basis=ev.target.value;draw();};
 $('direct').onclick=()=>{whole=false;draw();};$('whole').onclick=()=>{whole=true;draw();};$('clear').onclick=()=>{selected=null;draw();};
 let timer=null;const step=Math.max(60,Math.min(450,Math.round(14000/data.records.length)));$('play').onclick=()=>{if(timer){clearInterval(timer);timer=null;$('play').textContent='Replay the window';return;}cutoff=0;selected=null;$('play').textContent='Pause';timer=setInterval(()=>{$('cutoff').value=cutoff;draw();if(cutoff>=data.records.length-1){clearInterval(timer);timer=null;$('play').textContent='Replay the window';}else cutoff++;},step);};
 // Deep link for screenshots and write-ups: #edge=<id> or #record=<order>.
 const hash=new URLSearchParams(location.hash.slice(1));if(hash.get('edge'))selected={edge:data.edges.find(e=>e.id===hash.get('edge'))};else if(hash.get('record'))selected={record:data.records[Number(hash.get('record'))-1]};if(selected&&!selected.edge&&!selected.record)selected=null;if(hash.get('whole'))whole=true;if(hash.get('rejected')&&$('rejected')){showRejected=true;$('rejected').checked=true;}
 findings();draw();
}

export function renderPage(model,options={}){
 const V=model.vocab,esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const payload=JSON.stringify({...model,kinds:KINDS}).replace(/</g,'\\u003c');
 const stats=model.stats.map(s=>`<span><b>${esc(s.n)}</b>${esc(s.label)}</span>`).join('');
 const home=options.home?`<a class="back" href="${esc(options.home)}">← All cases</a>`:'';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(model.title)}, Buzzer</title><style>${themeCss()}${css}</style></head><body>
<nav><a class="mark" href="${esc(options.home||'#')}">Buzzer</a>${home}</nav>
<header><h1>${esc(model.title)}</h1><p>${esc(V.intro)}</p></header>
<div class="facts">${stats}</div>
<div class="tools" id="tools"><button id="play">Replay the window</button><input id="cutoff" type="range" min="0" step="1" aria-label="Evidence cutoff"><select id="basis" aria-label="Horizontal axis"><option value="order">${esc(V.star)} order</option><option value="time">Clock time</option></select><button id="direct">Direct links</button><button id="whole">Whole chain</button><button id="clear">Clear selection</button></div>
<p id="cut-label"></p>
<main><section><div class="canvas" id="canvas"></div><div class="legend" id="legend"></div><div class="findings" id="findings"></div></section><aside id="detail"></aside></main>
<footer>${esc(model.cutoffPolicy||'')} ${esc(V.source)} Excerpts are limited to ${EXCERPT} characters per record.</footer>
<script type="application/json" id="data">${payload}</script><script>(${client.toString()})();</script></body></html>`.replaceAll(' · ',' · ');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output,candidate]=process.argv.slice(2);
 if(!input||!output){console.error('Usage: node src/lineage/constellation.mjs <replay.json|scan.json> <new-output.html> [scan-candidate-id]');process.exit(2);}
 if(existsSync(output)){console.error('Refusing to overwrite '+output);process.exit(2);}
 const source=JSON.parse(readFileSync(input,'utf8')),model=source.candidates?buildFromScan(source,candidate):buildConstellation(source);
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,renderPage(model));
 console.log(JSON.stringify({output,lanes:model.lanes.length,records:model.records.length,edges:model.edges.length,droppedEdges:model.droppedEdges}));
}
