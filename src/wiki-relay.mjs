// Relay view of a full wiki revision export: which label built on which label's text, page by page.
// A hand-off is observed, not reported: a revision keeps lines first written on that page by a
// different label and adds lines of its own.
// Usage: node src/wiki-relay.mjs <revisions.jsonl> <new-output.html>
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {themeCss} from './site-theme.mjs';
import {largestComponent} from './lineage/constellation.mjs';

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const EXCERPT=160,MIN_LINE=24,MAX_HOPS_PER_PAGE=40;
const meaningful=line=>line.length>=MIN_LINE;

export function buildRelay(rows){
 const byPage=new Map();
 for(const r of rows){if(!byPage.has(r.page_id))byPage.set(r.page_id,[]);byPage.get(r.page_id).push(r);}
 const pages=[],pair=new Map(),labels=new Set(),days=new Map();let hops=0;
 for(const r of rows){if(r.label)labels.add(r.label);const d=String(r.time).slice(0,10);days.set(d,(days.get(d)||0)+1);}
 for(const [id,revs]of byPage){
  revs.sort((a,b)=>Number(a.seq)-Number(b.seq));
  const origin=new Map(),seen=new Set(),list=[],who=new Set();
  for(const r of revs){
   const lines=[...new Set(String(r.body||'').split('\n').map(l=>l.trim()).filter(meaningful))],label=r.label||'';
   const fresh=lines.filter(l=>!origin.has(l)),kept=new Map();
   if(label)for(const l of lines){const o=origin.get(l);if(o&&o.label!==label){const k=kept.get(o.label)||{n:0,rev:o.rev,line:l};k.n++;kept.set(o.label,k);}}
   if(label&&fresh.length)for(const [from,k]of kept){const n=k.n;
    const key=from+'>'+label;if(seen.has(key))continue;seen.add(key);
    list.push({from,to:label,time:r.time,rev:r.rev_id,fromRev:k.rev,keptLine:k.line.slice(0,EXCERPT),kept:n,added:fresh.length,summary:r.change_summary&&r.change_summary!=='None'&&r.change_summary!=='*'?String(r.change_summary).slice(0,80):'',excerpt:fresh[0].slice(0,EXCERPT)});
    pair.set(key,(pair.get(key)||0)+1);who.add(from);who.add(label);hops++;
   }
   if(label)for(const l of fresh)origin.set(l,{label,rev:r.rev_id});
  }
  if(list.length)pages.push({all:list,id,revisions:revs.length,labels:who.size,hops:list.slice(0,MAX_HOPS_PER_PAGE),more:Math.max(0,list.length-MAX_HOPS_PER_PAGE),total:list.length,first:list[0].time});
 }
 pages.sort((a,b)=>b.labels-a.labels||b.total-a.total||a.id.localeCompare(b.id));
 const degree=new Map();for(const [k,n]of pair){const [a,b]=k.split('>');degree.set(a,(degree.get(a)||0)+n);degree.set(b,(degree.get(b)||0)+n);}
 const linked=new Set(degree.keys());
 return {pages,pair:[...pair.entries()],top:[...degree.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]),days:[...days.entries()].sort(),
  stats:{revisions:rows.length,pages:byPage.size,labels:labels.size,hops,linkedLabels:linked.size,sharedPages:pages.length,start:rows.map(r=>r.time).sort()[0],end:rows.map(r=>r.time).sort().at(-1)}};
}

const css=`
nav{display:flex;align-items:baseline;justify-content:space-between;padding:20px 32px;border-bottom:1px solid var(--line)}
nav .mark{font-weight:700;font-size:1.125rem;color:var(--ink);text-decoration:none}
nav a.back{color:var(--ink-2);text-decoration:none;font-size:.9375rem}
header{padding:36px 32px 0}
h1{font-size:clamp(1.625rem,2.6vw,2.125rem);letter-spacing:-.025em}
header p{max-width:76ch;margin:12px 0 0;color:var(--ink-2)}
h2{font-size:1.0625rem;margin:0 0 12px}
.facts{display:flex;flex-wrap:wrap;gap:6px 30px;margin:22px 32px 0;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:.9375rem;color:var(--ink-2)}
.facts b{color:var(--ink);font-weight:600;font-size:1.0625rem;font-variant-numeric:tabular-nums;margin-right:7px}
main{display:grid;grid-template-columns:minmax(0,560px) minmax(0,1fr);gap:24px;padding:22px 32px 60px;align-items:start}
@media(max-width:1150px){main{grid-template-columns:1fr}}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:20px}
.left{position:sticky;top:16px;display:grid;gap:24px}
@media(max-width:1150px){.left{position:static}}
.matrix svg,.days svg{display:block;width:100%;height:auto}
.matrix text,.days text{fill:var(--ink-3);font:10px var(--sans)}
.matrix rect.cell{cursor:pointer;transition:opacity .15s var(--ease)}
.matrix rect.cell:hover{stroke:var(--ink);stroke-width:1}
.hint{font-size:.8125rem;color:var(--ink-3);margin:10px 0 0}
.tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 14px}
.tools input{flex:1;min-width:200px;font:inherit;font-size:.9375rem;padding:8px 12px;border-radius:6px;border:1px solid var(--line-strong);background:var(--canvas);color:var(--ink)}
.tools button{font:500 .875rem var(--sans);padding:8px 14px;border-radius:6px;border:1px solid var(--line-strong);background:transparent;color:var(--ink);cursor:pointer}
.tools button:hover{background:var(--surface-2)}
.tools span{font-size:.8125rem;color:var(--ink-3)}
.relay{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,9fr);gap:18px;padding:14px 0;border-top:1px solid var(--line)}
@media(max-width:800px){.relay{grid-template-columns:1fr;gap:6px}}
.relay .what code{display:block;overflow-wrap:anywhere;font-size:.8125rem;color:var(--ink)}
.relay .what span{font-size:.8125rem;color:var(--ink-3)}
.hop{display:grid;grid-template-columns:92px minmax(0,1fr);gap:2px 12px;padding:5px 0;font-size:.9375rem}
.hop time{color:var(--ink-3);font-size:.8125rem;font-variant-numeric:tabular-nums;padding-top:2px}
.hop b{font-weight:600}
.hop small{color:var(--ink-3);font-size:.8125rem;margin-left:8px}
.hop q{grid-column:2;color:var(--ink-2);font-size:.8125rem;font-family:var(--mono);border-left:2px solid var(--supported);padding-left:10px;quotes:none;overflow-wrap:anywhere}
.more{color:var(--ink-3);font-size:.8125rem;padding:4px 0 0 104px}
footer{color:var(--ink-3);font-size:.8125rem;margin:0 32px;padding:20px 0 44px;border-top:1px solid var(--line)}
`;

function client(){
 const data=JSON.parse(document.getElementById('data').textContent),$=id=>document.getElementById(id);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const PAGE=30;let query='',pairFilter=null,shown=PAGE;
 function matrix(){
  const N=Math.min(24,data.top.length),names=data.top.slice(0,N),idx=new Map(names.map((n,i)=>[n,i])),count=new Map(data.pair),L=130,T=120,C=16,W=L+N*C+90,H=T+N*C+6;
  let max=1;for(const [k,n]of data.pair){const [a,b]=k.split('>');if(idx.has(a)&&idx.has(b))max=Math.max(max,n);}
  let s='';names.forEach((n,i)=>{const short=n.length>20?n.slice(0,19)+'…':n;s+=`<text x="${L-6}" y="${T+i*C+11}" text-anchor="end">${short.replace(/[&<>]/g,'')}</text><text transform="translate(${L+i*C+11} ${T-6}) rotate(-55)">${short.replace(/[&<>]/g,'')}</text>`;});
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const k=names[y]+'>'+names[x],n=count.get(k)||0;s+=`<rect class="${n?'cell':''}" data-k="${n?encodeURIComponent(k):''}" x="${L+x*C}" y="${T+y*C}" width="${C-2}" height="${C-2}" rx="2" fill="${n?'var(--supported)':'#1b3550'}" opacity="${n?(.3+.7*n/max).toFixed(2):.5}">${n?`<title>${names[x].replace(/[&<>]/g,'')} built on ${names[y].replace(/[&<>]/g,'')} on ${n} page${n===1?'':'s'}</title>`:''}</rect>`;}
  $('matrix').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Matrix of the ${N} most connected labels">${s}</svg>`;
  for(const r of $('matrix').querySelectorAll('rect.cell'))r.onclick=()=>{pairFilter=decodeURIComponent(r.dataset.k);shown=PAGE;list();};
 }
 function daily(){
  const W=520,H=110,B=18,max=Math.max(...data.days.map(d=>d[1])),w=(W-4)/data.days.length;let s='';
  data.days.forEach(([d,n],i)=>{const h=Math.max(1,(H-B-6)*n/max);s+=`<rect x="${(2+i*w).toFixed(1)}" y="${(H-B-h).toFixed(1)}" width="${Math.max(1,w-1.5).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="var(--accent)" opacity=".8"><title>${d}: ${n} revisions</title></rect>`;});
  s+=`<text x="2" y="${H-4}">${data.days[0][0]}</text><text x="${W-2}" y="${H-4}" text-anchor="end">${data.days.at(-1)[0]}</text>`;
  $('days').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revisions per day">${s}</svg>`;
 }
 function list(){
  const host=$('list');host.replaceChildren();const q=query.toLowerCase();
  const [pa,pb]=pairFilter?pairFilter.split('>'):[];
  const match=p=>(!pairFilter||p.hops.some(h=>h.from===pa&&h.to===pb))&&(!q||p.id.toLowerCase().includes(q)||p.hops.some(h=>h.from.toLowerCase().includes(q)||h.to.toLowerCase().includes(q)));
  const pages=data.pages.filter(match);
  $('count').textContent=pages.length.toLocaleString('en-US')+' pages'+(pairFilter?' where '+pb+' built on '+pa:'');
  $('clear').hidden=!pairFilter&&!query;
  for(const p of pages.slice(0,shown)){
   const card=el('div',undefined,'relay'),what=el('div',undefined,'what'),hops=el('div');what.append(el('code',p.id),el('span',p.labels+' labels · '+p.revisions+' revisions'));
   for(const h of p.hops){if(pairFilter&&!(h.from===pa&&h.to===pb))continue;const row=el('div',undefined,'hop'),who=el('span');who.append(el('b',h.from),document.createTextNode(' → '),el('b',h.to),el('small','kept '+h.kept+', added '+h.added+(h.summary?' · “'+h.summary+'”':'')));row.append(el('time',h.time.slice(5,16).replace('T',' ')),who,el('q',h.excerpt));hops.append(row);}
   if(p.more&&!pairFilter)hops.append(el('div','+ '+p.more+' more hand-offs on this page','more'));
   card.append(what,hops);host.append(card);
  }
  if(pages.length>shown){const b=el('button','Show '+Math.min(PAGE,pages.length-shown)+' more pages');b.onclick=()=>{shown+=PAGE;list();};const t=el('div',undefined,'tools');t.style.marginTop='16px';t.append(b);host.append(t);}
 }
 $('q').oninput=ev=>{query=ev.target.value.trim();shown=PAGE;list();};
 $('clear').onclick=()=>{pairFilter=null;query='';$('q').value='';shown=PAGE;list();};
 matrix();daily();list();
}

export function renderRelay(model,{home='index.html'}={}){
 const s=model.stats,int=n=>Number(n).toLocaleString('en-US'),day=iso=>new Date(iso).toLocaleDateString('en-US',{month:'long',day:'numeric',timeZone:'UTC'});
 const payload=JSON.stringify({pages:model.pages.map(({all,...p})=>({...p,hops:p.hops.map(({fromRev,keptLine,...h})=>h)})),pair:model.pair,top:model.top,days:model.days}).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shared wiki relay, Buzzer</title><style>${themeCss()}${css}</style></head><body>
<nav><a class="mark" href="${esc(home)}">Buzzer</a><a class="back" href="${esc(home)}">← Overview</a></nav>
<header><h1>Shared wiki, ${day(s.start)} to ${day(s.end)}, ${s.start.slice(0,4)}</h1>
<p>Each hand-off is a saved revision that keeps another label’s lines and adds its own.</p></header>
<div class="facts"><span><b>${int(s.revisions)}</b>revisions</span><span><b>${int(s.pages)}</b>pages</span><span><b>${int(s.labels)}</b>labels</span><span><b>${int(s.hops)}</b>hand-offs</span><span><b>${int(s.linkedLabels)}</b>labels linked</span><span><b>${int(s.sharedPages)}</b>pages built by more than one label</span></div>
<main><div class="left"><section class="panel matrix"><h2>Who built on whom</h2><div id="matrix"></div><p class="hint">Row: whose text. Column: who built on it. The ${Math.min(24,model.top.length)} most connected of ${int(s.linkedLabels)} linked labels. Click a cell.</p></section>
<section class="panel days"><h2>Revisions per day</h2><div id="days"></div></section></div>
<section class="panel"><h2>What moved, page by page</h2><div class="tools"><input id="q" type="search" placeholder="Filter by page or label" aria-label="Filter by page or label"><span id="count"></span><button id="clear" hidden>Clear filter</button></div><div id="list"></div></section></main>
<footer>Labels are names written in the page text, not authenticated agents. Excerpts are cut at ${EXCERPT} characters. Source: collusion.wiki public export.</footer>
<script type="application/json" id="data">${payload}</script><script>(${client.toString()})();</script></body></html>`.replaceAll(' · ',' · ');
}

// One page as a lane graph for the shared constellation renderer: lanes are labels that took
// part in a hand-off, stars are their revisions, curves run from the revision that first wrote
// a kept line to the revision that built on it.
const PAGE_VOCAB={lanes:'labels',stars:'revisions',star:'Revision',solid:'observed in the saved text',
 intro:'One lane per label, one star per revision, one curve per hand-off. Click a curve for the evidence.',
 help:'A green curve means the later revision keeps lines first written by the earlier label and adds its own. Click a curve to see the kept line and the added line.',
 source:'Source: collusion.wiki public export. Labels are names in the page text, not authenticated agents.'};
export function buildPageCase(rows,page){
 const involved=new Set(page.all.flatMap(h=>[h.from,h.to])),revs=rows.filter(r=>r.page_id===page.id&&involved.has(r.label)).sort((a,b)=>Number(a.seq)-Number(b.seq));
 const lanes=[];for(const r of revs)if(!lanes.includes(r.label))lanes.push(r.label);
 const records=revs.map((r,i)=>({id:r.rev_id,order:i,time:new Date(r.time).toISOString(),lane:r.label,laneBasis:'label in page text',text:String(r.body||'').slice(0,240),truncated:String(r.body||'').length>240,sha256:r.body_sha256||null,line:null,sourceUrl:'https://collusion.wiki/'}));
 const ids=new Set(records.map(r=>r.id)),time=new Map(records.map(r=>[r.id,r.time]));
 // A revision often keeps lines from every earlier label. Draw only the most recent source it
 // built on, so the graph reads as a relay and not as every pair.
 const order=new Map(records.map(r=>[r.id,r.order])),nearest=new Map();
 for(const h of page.all){if(!ids.has(h.fromRev)||!ids.has(h.rev))continue;const k=h.rev,best=nearest.get(k);if(!best||order.get(h.fromRev)>order.get(best.fromRev))nearest.set(k,h);}
 const edges=[...nearest.values()].map((h,i)=>({id:'w'+i,from:h.fromRev,to:h.rev,producer:h.from,consumer:h.to,kind:'contribution-to-uptake',label:'Text kept and built on',evidenceType:'observed in stored revisions',
  summary:'Kept '+h.kept+' line'+(h.kept===1?'':'s')+' first written by '+h.from+', added '+h.added+'.',availableAt:time.get(h.rev),refs:[],artifact:h.keptLine,
  dimensions:{write:{status:'observed',value:'Both revisions are stored in the export.'},read:{status:'observed',value:'The later revision contains the earlier label\u2019s line: '+h.keptLine},use:{status:'observed',value:'The later revision adds: '+h.excerpt},action:{status:'unknown',value:'What the label did with the page afterwards is not assessed.'},producer:{status:'unknown',value:'A label is a name in the page text, not an authenticated agent.'}},
  review:null,missing:['No reviewer has read this pair.','Whether the label is one agent or many.'],quotes:[],trace:null}));
 const component=largestComponent(lanes,edges),bump=(m,k)=>m.set(k,(m.get(k)||0)+1),made=new Map(),took=new Map();
 for(const e of edges){bump(made,e.producer);bump(took,e.consumer);}
 const top=m=>[...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,k])=>n+' ('+k+')').join(', ')||'none';
 const day=iso=>new Date(iso).toLocaleDateString('en-US',{month:'long',day:'numeric',timeZone:'UTC'});
 return {title:'Shared wiki, '+page.id.split('/').pop(),scope:{start:records[0].time,end:records.at(-1).time},vocab:PAGE_VOCAB,cutoffPolicy:'Page '+page.id+', '+day(records[0].time)+' to '+day(records.at(-1).time)+'.',lanes,records,edges,droppedEdges:[],
  summary:{component,transfers:edges.map(e=>({traced:false,edgeId:e.id,artifact:e.artifact,producer:e.producer,consumer:e.consumer,time:e.availableAt})).sort((a,b)=>a.time.localeCompare(b.time)),
   questions:[{q:'Whose text was built on most?',a:top(made)},{q:'Who built on others most?',a:top(took)},{q:'How many labels are connected?',a:component.length+' of '+lanes.length+' labels are joined by hand-offs.'},{q:'What does this not show?',a:'Intent, or whether a label is one agent. No reviewer has read these pairs.'}]},
  stats:[{n:lanes.length,label:'labels'},{n:records.length,label:'revisions'},{n:edges.length,label:'direct hand-offs observed',tone:'good'},{n:component.length,label:'labels in one chain',tone:'good'}]};
}
// Pages worth a lane graph: enough labels to be a group, few enough to read.
export function pickCases(model,{min=6,max=14,count=4}={}){
 return model.pages.filter(p=>p.labels>=min&&p.labels<=max).sort((a,b)=>b.total-a.total).slice(0,count);
}

function main(){
 const [input,out]=process.argv.slice(2);
 if(!input||!out){console.error('Usage: node src/wiki-relay.mjs <revisions.jsonl> <new-output.html>');process.exit(2);}
 if(existsSync(out)){console.error('Refusing to overwrite '+out);process.exit(2);}
 const rows=readFileSync(input,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
 const model=buildRelay(rows);writeFileSync(out,renderRelay(model));console.log(JSON.stringify(model.stats),JSON.stringify(model.pages.slice(0,5).map(p=>[p.id,p.labels,p.total])));
}
if(process.argv[1]&&process.argv[1].endsWith('wiki-relay.mjs'))main();
