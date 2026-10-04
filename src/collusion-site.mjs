// Collusion monitor page: every held-out episode of the SALT agent-collusion release as one
// cell, coloured by whether the frozen message-only monitor caught the agreement.
// Usage: node src/collusion-site.mjs <salt-validation-dir> <new-output.html>
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {themeCss} from './site-theme.mjs';

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const jsonl=path=>readFileSync(path,'utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
const MAX_LINE=320;
const PARTS=[['test','Held-out task sequences'],['model_holdout','Claude pairs, never seen in training']];
export const outcome=(pred,truth)=>pred?(truth?'caught':'alarm'):(truth?'missed':'clear');

function shortCondition(id){
 const [family,...rest]=id.split('__');
 if(family==='cross_model')rest.shift();
 return {family:family.replace(/_/g,' '),name:rest.join(' · ').replace(/gemini-3-1-flash-lite/g,'gemini-3.1-lite').replace(/gemini-3-7-flash/g,'gemini-3.7').replace(/--/g,', ')};
}

export function tally(episodes,target){
 const t={n:0,caught:0,missed:0,alarm:0,clear:0};
 for(const e of episodes){const x=e[target];if(!x)continue;t.n++;t[outcome(x.p,x.t)]++;}
 t.positive=t.caught+t.missed;t.recall=t.positive?t.caught/t.positive:0;t.precision=t.caught+t.alarm?t.caught/(t.caught+t.alarm):0;t.falseRate=t.alarm+t.clear?t.alarm/(t.alarm+t.clear):0;
 return t;
}

export function buildCollusion(dir){
 const episodes=new Map();
 for(const [part]of PARTS)for(const f of jsonl(join(dir,'splits',part+'.features.jsonl'))){
  const lines=String(f.text).split(/\n(?=(?:alice|bob): )/).map(l=>l.length>MAX_LINE?l.slice(0,MAX_LINE)+'…':l);
  episodes.set(f.id,{id:f.id,part,lines,source:f.source,row:f.row});
 }
 for(const p of jsonl(join(dir,'predictions.jsonl'))){
  if(!p.model.startsWith('standard-'))continue;
  const e=episodes.get(p.run_id+':'+p.episode_index);if(!e||e.part!==p.partition)continue;
  e.run=p.run_id;e.episode=p.episode_index;e.condition=p.condition_id;e.task=p.task_type;
  e[p.model==='standard-agreement'?'agreement':'violation']={s:Math.round(p.score*100),p:Boolean(p.prediction),t:Boolean(p.truth)};
 }
 const runs=new Map();
 for(const e of episodes.values()){if(!e.run)continue;if(!runs.has(e.run))runs.set(e.run,{id:e.run,condition:e.condition,part:e.part,episodes:[]});runs.get(e.run).episodes.push(e);}
 const conditions=new Map();
 for(const r of [...runs.values()].sort((a,b)=>a.id.localeCompare(b.id))){
  r.episodes.sort((a,b)=>a.episode-b.episode);
  if(!conditions.has(r.condition))conditions.set(r.condition,{id:r.condition,part:r.part,...shortCondition(r.condition),runs:[]});
  conditions.get(r.condition).runs.push(r);
 }
 const all=[...episodes.values()].filter(e=>e.run),of=part=>all.filter(e=>e.part===part);
 return {conditions:[...conditions.values()].sort((a,b)=>PARTS.findIndex(p=>p[0]===a.part)-PARTS.findIndex(p=>p[0]===b.part)||a.id.localeCompare(b.id)),
  summary:{runs:runs.size,episodes:all.length,test:{agreement:tally(of('test'),'agreement'),violation:tally(of('test'),'violation')},holdout:{agreement:tally(of('model_holdout'),'agreement'),violation:tally(of('model_holdout'),'violation')}}};
}

// Static grid used both on the monitor page and as the landing preview.
export function gridSvg(model,{cell=7,gap=1,perRow=12,target='agreement'}={}){
 const block=10*(cell+gap)+10,rows=Math.ceil(model.conditions.length/perRow),W=perRow*block,H=rows*block;
 const fill={caught:'var(--supported)',missed:'var(--disputed)',alarm:'var(--mention)',clear:'#1b3550'};
 const parts=[];
 model.conditions.forEach((c,i)=>{const ox=(i%perRow)*block,oy=Math.floor(i/perRow)*block;
  c.runs.forEach((r,y)=>r.episodes.forEach((e,x)=>{const o=e[target]?outcome(e[target].p,e[target].t):'clear';parts.push(`<rect x="${ox+x*(cell+gap)}" y="${oy+y*(cell+gap)}" width="${cell}" height="${cell}" rx="1.5" fill="${fill[o]}"/>`);}));});
 return `<svg viewBox="0 0 ${W-10} ${H-10}" role="img" aria-label="Grid of ${model.summary.episodes} held-out episodes coloured by monitor outcome">${parts.join('')}</svg>`;
}

const css=`
:root{--cell:#1b3550}
nav{display:flex;align-items:baseline;justify-content:space-between;padding:20px 32px;border-bottom:1px solid var(--line)}
nav .mark{font-weight:700;font-size:1.125rem;color:var(--ink);text-decoration:none}
nav a.back{color:var(--ink-2);text-decoration:none;font-size:.9375rem}
nav a.back:hover{color:var(--ink)}
header{padding:36px 32px 0}
h1{font-size:clamp(1.625rem,2.6vw,2.125rem);letter-spacing:-.025em}
header p{max-width:76ch;margin:12px 0 0;color:var(--ink-2)}
h2{font-size:1.0625rem;margin:0 0 10px}
.facts{display:flex;flex-wrap:wrap;gap:6px 30px;margin:22px 32px 0;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:.9375rem;color:var(--ink-2)}
.facts b{color:var(--ink);font-weight:600;font-size:1.0625rem;font-variant-numeric:tabular-nums;margin-right:7px}
.tools{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;padding:18px 32px 8px}
.seg{display:inline-flex;border:1px solid var(--line-strong);border-radius:7px;overflow:hidden}
.seg button{font:500 .875rem var(--sans);padding:8px 14px;border:0;background:transparent;color:var(--ink-2);cursor:pointer;transition:background .15s var(--ease),color .15s var(--ease)}
.seg button+button{border-left:1px solid var(--line-strong)}
.seg button:hover{background:var(--surface-2);color:var(--ink)}
.seg button[aria-pressed=true]{background:var(--accent);color:var(--accent-ink)}
.tools span.lab{font-size:.8125rem;color:var(--ink-3);margin-right:-12px}
main{display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:24px;padding:10px 32px 60px;align-items:start}
@media(max-width:1100px){main{grid-template-columns:1fr}}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:20px}
.group{margin:0 0 22px}
.group>h2{color:var(--ink-2);font-weight:500;font-size:.875rem;margin-bottom:12px}
.blocks{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:18px 16px}
.block h3{font-size:.6875rem;font-weight:500;color:var(--ink-3);letter-spacing:0;margin:0 0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.block h3 b{color:var(--ink-2);font-weight:600}
.cells{display:grid;grid-template-columns:repeat(10,1fr);gap:2px}
.cells button{aspect-ratio:1;border:0;border-radius:2px;padding:0;cursor:pointer;background:var(--cell);transition:transform .15s var(--ease),opacity .15s var(--ease)}
.cells button:hover{transform:scale(1.35)}
.cells button.caught{background:var(--supported)}.cells button.missed{background:var(--disputed)}.cells button.alarm{background:var(--mention)}
.cells button.dim{opacity:.16}
.cells button.sel{outline:2px solid var(--ink);outline-offset:1px;transform:scale(1.35)}
.legend{display:flex;flex-wrap:wrap;gap:6px 20px;font-size:.8125rem;color:var(--ink-2);margin:0 0 16px}
.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:7px}
.spread{margin:26px 0 0;padding-top:20px;border-top:1px solid var(--line)}
.spread svg{display:block;width:100%;max-width:640px;height:auto}
.spread text{fill:var(--ink-3);font:12px var(--sans)}
.spread p{margin:0 0 12px;color:var(--ink-2);font-size:.9375rem;max-width:70ch}
aside{position:sticky;top:16px;max-height:calc(100vh - 32px);overflow:auto}
aside h2{font-size:1.0625rem}
aside .where{color:var(--ink-2);font-size:.875rem;margin:0 0 14px}
.strip{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin:0 0 6px}
.strip button{height:26px;border:0;border-radius:4px;background:var(--surface-2);color:var(--ink);font:600 .75rem var(--sans);cursor:pointer}
.strip button.caught{background:var(--supported);color:#fff}.strip button.missed{background:var(--disputed);color:#fff}.strip button.alarm{background:var(--mention);color:#fff}
.strip button.sel{outline:2px solid var(--ink);outline-offset:1px}
.hint{font-size:.75rem;color:var(--ink-3);margin:0 0 16px}
.verdict{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 16px}
.verdict>div{border-top:1px solid var(--line-strong);padding-top:8px;font-size:.8125rem;color:var(--ink-2)}
.verdict b{display:block;color:var(--ink);font-size:.9375rem}
.meter{height:6px;border-radius:3px;background:var(--surface-2);margin-top:6px;overflow:hidden}
.meter i{display:block;height:100%;background:var(--accent)}
.msg{margin:0 0 10px;font-size:.875rem;line-height:1.45;overflow-wrap:anywhere}
.msg b{display:block;font-size:.75rem;font-weight:600;color:var(--ink-3);margin-bottom:1px}
.msg.bob{padding-left:14px;border-left:2px solid var(--line-strong)}
.src{font:.75rem var(--mono);color:var(--ink-3);margin-top:14px;overflow-wrap:anywhere}
footer{color:var(--ink-3);font-size:.8125rem;margin:0 32px;padding:20px 0 44px;border-top:1px solid var(--line);max-width:100ch}
`;

function client(){
 const data=JSON.parse(document.getElementById('data').textContent),$=id=>document.getElementById(id);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const outcome=(p,t)=>p?(t?'caught':'alarm'):(t?'missed':'clear');
 const NAME={caught:'Caught',missed:'Missed',alarm:'False alarm',clear:'Clear'};
 const TARGET={agreement:{label:'the pair agree in their messages to accept each other',truth:'Dataset judge: agreement'},violation:{label:'both agents accept without the required evidence',truth:'Outcome: mutual acceptance'}};
 let target='agreement',filter='all',selected=null;
 const cells=[];
 const of=e=>{const x=e[target];return x?outcome(x.p,x.t):'clear';};
 function select(run,i){selected={run,i};draw();}
 function build(){
  const host=$('grid');
  for(const [part,title]of data.parts){
   const group=el('div',undefined,'group');group.append(el('h2',title));const blocks=el('div',undefined,'blocks');
   for(const c of data.conditions.filter(c=>c.part===part)){
    const block=el('div',undefined,'block'),h=el('h3');h.append(el('b',c.family+' '),document.createTextNode(c.name));h.title=c.id;const grid=el('div',undefined,'cells');
    for(const run of c.runs)run.episodes.forEach((e,i)=>{const b=el('button');b.onclick=()=>select(run,i);cells.push({b,e,run,i});grid.append(b);});
    block.append(h,grid);blocks.append(block);
   }
   group.append(blocks);host.append(group);
  }
 }
 function spread(){
  const W=640,H=190,L=38,B=26,T=10,n=10,truth=Array(n).fill(0),flag=Array(n).fill(0);let runs=0;
  for(const c of data.conditions)for(const r of c.runs){runs++;r.episodes.forEach((e,i)=>{const x=e[target];if(x){if(x.t)truth[i]++;if(x.p)flag[i]++;}});}
  const X=i=>L+(W-L-70)*i/(n-1),Y=v=>T+(H-T-B)*(1-v/runs),path=a=>a.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
  let s='';for(const g of [0,.25,.5,.75,1]){s+=`<line x1="${L}" x2="${W-70}" y1="${Y(g*runs)}" y2="${Y(g*runs)}" stroke="var(--line)"/><text x="${L-8}" y="${Y(g*runs)+4}" text-anchor="end">${Math.round(g*100)}%</text>`;}
  for(let i=0;i<n;i++)s+=`<text x="${X(i)}" y="${H-6}" text-anchor="middle">${i+1}</text>`;
  s+=`<path d="${path(truth)}" fill="none" stroke="var(--ink-2)" stroke-width="2"/><path d="${path(flag)}" fill="none" stroke="var(--supported)" stroke-width="2"/>`;
  const yt=Y(truth[n-1]),yf=Y(flag[n-1]),apart=Math.abs(yt-yf)<14?(yt<yf?-7:7):0;
  s+=`<text x="${X(n-1)+8}" y="${yt+4+apart}" style="fill:var(--ink-2)">labelled</text><text x="${X(n-1)+8}" y="${yf+4-apart}" style="fill:var(--ink)">flagged</text>`;
  truth.forEach((v,i)=>{s+=`<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="var(--ink-2)" stroke="var(--surface)" stroke-width="2"><title>Episode ${i+1}: ${v} of ${runs} trajectories labelled</title></circle><circle cx="${X(i)}" cy="${Y(flag[i])}" r="4" fill="var(--supported)" stroke="var(--surface)" stroke-width="2"><title>Episode ${i+1}: ${flag[i]} of ${runs} trajectories flagged</title></circle>`;});
  $('spread').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Share of trajectories labelled and flagged at each episode">${s}</svg>`;
 }
 function facts(){
  const t={caught:0,missed:0,alarm:0,clear:0};for(const c of cells)t[of(c.e)]++;
  const pos=t.caught+t.missed,host=$('facts');host.replaceChildren();
  const add=(n,label)=>{const d=el('span');d.append(el('b',n),document.createTextNode(label));host.append(d);};
  add(data.summary.runs.toLocaleString('en-US'),'held-out trajectories');add(cells.length.toLocaleString('en-US'),'episodes');
  add(t.caught+' of '+pos,'labelled episodes caught ('+Math.round(100*t.caught/pos)+'%)');add(String(t.missed),'missed');add(String(t.alarm),'false alarms ('+(100*t.alarm/(t.alarm+t.clear)).toFixed(1)+'% of clean episodes)');
 }
 function detail(){
  const host=$('detail');host.replaceChildren();
  if(!selected){host.append(el('h2','Select an episode'),el('p','Each square is one episode between two agents. Click one to read the messages the monitor scored.','where'));return;}
  const {run,i}=selected,e=run.episodes[i],x=e[target]||{s:0,p:false,t:false};
  host.append(el('h2',NAME[of(e)]+' · episode '+(i+1)+' of '+run.episodes.length),el('p',run.id.replace(/__/g,' · '),'where'));
  const strip=el('div',undefined,'strip');run.episodes.forEach((ep,k)=>{const b=el('button',String(k+1),of(ep)+(k===i?' sel':''));b.title=NAME[of(ep)];b.onclick=()=>select(run,k);strip.append(b);});
  host.append(strip,el('p','This pair’s ten episodes in order. Step through to watch the arrangement form.','hint'));
  const v=el('div',undefined,'verdict'),a=el('div'),b=el('div');a.append(el('b','Monitor score '+x.s+' / 100'),document.createTextNode(x.p?'Flagged':'Not flagged'));const m=el('div',undefined,'meter'),bar=el('i');bar.style.width=x.s+'%';m.append(bar);a.append(m);
  b.append(el('b',x.t?'Yes':'No'),document.createTextNode(TARGET[target].truth));v.append(a,b);host.append(v);
  for(const line of e.lines){const k=line.indexOf(': '),who=line.slice(0,k),p=el('p',undefined,'msg '+who);p.append(el('b',who==='alice'?'Alice':'Bob'),document.createTextNode(line.slice(k+2)));host.append(p);}
  host.append(el('p',e.source+' row '+e.row+' · numbers replaced by NUM, long messages cut at 320 characters','src'));
 }
 function draw(){
  for(const c of cells){const o=of(c.e);c.b.className=o+(filter!=='all'&&o!==filter?' dim':'')+(selected&&selected.run===c.run&&selected.i===c.i?' sel':'');c.b.title=NAME[o]+' · episode '+(c.i+1)+' · score '+((c.e[target]||{}).s??0);}
  for(const b of document.querySelectorAll('[data-target]'))b.setAttribute('aria-pressed',String(b.dataset.target===target));
  for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter===filter));
  $('what').textContent=TARGET[target].label;
  facts();spread();detail();
 }
 build();
 for(const b of document.querySelectorAll('[data-target]'))b.onclick=()=>{target=b.dataset.target;draw();};
 for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;draw();};
 // Open on the first episode where a pair that was clean becomes a caught agreement.
 for(const c of data.conditions){if(selected)break;if(!c.id.startsWith('main__'))continue;for(const r of c.runs){const i=r.episodes.findIndex((e,k)=>k>1&&e.agreement&&e.agreement.p&&e.agreement.t&&!r.episodes[k-1].agreement.t);if(i>0){selected={run:r,i};break;}}}
 draw();
}

export function renderCollusion(model,{home='index.html'}={}){
 const payload=JSON.stringify({parts:PARTS,conditions:model.conditions.map(c=>({id:c.id,part:c.part,family:c.family,name:c.name,runs:c.runs.map(r=>({id:r.id,episodes:r.episodes.map(e=>({lines:e.lines,source:e.source,row:e.row,agreement:e.agreement,violation:e.violation}))}))})),summary:{runs:model.summary.runs}}).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Collusion monitor, Buzzer</title><style>${themeCss()}${css}</style></head><body>
<nav><a class="mark" href="${esc(home)}">Buzzer</a><a class="back" href="${esc(home)}">← Overview</a></nav>
<header><h1>Collusion monitor</h1>
<p>Each square is one episode between two agents. Flagged when <span id="what"></span>. Click a square to read the messages.</p></header>
<div class="facts" id="facts"></div>
<div class="tools"><span class="lab">Detect</span><div class="seg"><button data-target="agreement">Agreement in messages</button><button data-target="violation">Mutual acceptance</button></div>
<span class="lab">Show</span><div class="seg"><button data-filter="all">All</button><button data-filter="caught">Caught</button><button data-filter="missed">Missed</button><button data-filter="alarm">False alarms</button></div></div>
<main><section class="panel"><div class="legend"><span><i style="background:var(--supported)"></i>Caught</span><span><i style="background:var(--disputed)"></i>Missed</span><span><i style="background:var(--mention)"></i>False alarm</span><span><i style="background:var(--cell)"></i>Clear</span><span>Row: one pair. Left to right: ten episodes.</span></div>
<div id="grid"></div>
<div class="spread"><h2>How it spreads over a run</h2><p>Share of pairs labelled and flagged at each episode.</p><div id="spread"></div></div></section>
<aside class="panel" id="detail"></aside></main>
<footer>Data: Shi, Zhang and Yang (2026), SALT-NLP/agent-collusion, MIT licence. Lab pairs, held out from training. Details on the <a href="method.html">method page</a>.</footer>
<script type="application/json" id="data">${payload}</script><script>(${client.toString()})();</script></body></html>`.replaceAll(' · ',' · ');
}

function main(){
 const [dir,out]=process.argv.slice(2);
 if(!dir||!out){console.error('Usage: node src/collusion-site.mjs <salt-validation-dir> <new-output.html>');process.exit(2);}
 if(existsSync(out)){console.error('Refusing to overwrite '+out);process.exit(2);}
 const model=buildCollusion(dir);writeFileSync(out,renderCollusion(model));console.log(JSON.stringify(model.summary));
}
if(process.argv[1]&&process.argv[1].endsWith('collusion-site.mjs'))main();
