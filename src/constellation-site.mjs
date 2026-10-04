// Build the Buzzer case site: one landing page plus a constellation per case.
// Usage: node src/constellation-site.mjs <scan.json> <review-dir> <wiki-replay.json> <new-output-dir> [trace-join.json] [salt-validation-dir] [wiki-revisions.jsonl]
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildConstellation,buildFromReview,renderPage} from './lineage/constellation.mjs';
import {themeCss} from './site-theme.mjs';
import {buildPageCase,buildRelay,pickCases,renderRelay} from './wiki-relay.mjs';
import {buildCollusion,gridSvg,renderCollusion} from './collusion-site.mjs';

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(n,d)=>d?Math.round(100*n/d):0;
const int=n=>Number(n).toLocaleString('en-US');
const SEGMENTS=[['supported','Reported use, both reviewers'],['mention','Acknowledged only'],['disputed','Reviewers disagree'],['rejected','No link, both reviewers']];

// Horizontal part-to-whole bar: 2px surface gaps, direct labels on segments wide
// enough to hold them, native hover title on every segment.
function bar(tally,label){
 const W=920,H=40;let x=0;const parts=[];
 for(const [key,name]of SEGMENTS){
  const n=tally[key];if(!n)continue;const w=Math.max(4,W*n/tally.total);
  parts.push(`<g class="segment"><title>${esc(name)}: ${n} of ${tally.total} (${pct(n,tally.total)}%)</title><rect x="${x.toFixed(1)}" y="0" width="${Math.max(2,w-2).toFixed(1)}" height="${H}" rx="4" fill="var(--${key})"/>${w>52?`<text x="${(x+10).toFixed(1)}" y="26">${n}</text>`:''}</g>`);x+=w;
 }
 return `<figure class="bar"><figcaption><span>${esc(label)}</span><span class="num">${tally.total} pairs</span></figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}: ${SEGMENTS.map(([k,n])=>n+' '+tally[k]).join(', ')}">${parts.join('')}</svg></figure>`;
}

function mini(counts,total){
 let x=0;const W=220;return `<svg class="mini" viewBox="0 0 ${W} 8" preserveAspectRatio="none" role="img" aria-label="${SEGMENTS.map(([k,n])=>n+' '+(counts[k]||0)).join(', ')}">`+SEGMENTS.map(([key])=>{const n=counts[key]||0;if(!n)return '';const w=W*n/total,r=`<rect x="${x.toFixed(1)}" width="${Math.max(1,w-2).toFixed(1)}" height="8" rx="2" fill="var(--${key})"/>`;x+=w;return r;}).join('')+'</svg>';
}

const css=`
.wrap{max-width:1080px;margin:0 auto;padding:0 28px}
nav{display:flex;align-items:baseline;justify-content:space-between;padding:22px 0;border-bottom:1px solid var(--line)}
nav .mark{font-weight:700;font-size:1.125rem;letter-spacing:-.01em;color:var(--ink);text-decoration:none}
nav ul{display:flex;gap:26px;list-style:none;margin:0;padding:0;font-size:.9375rem}
nav ul a{color:var(--ink-2);text-decoration:none;transition:color .15s var(--ease)}
nav ul a:hover{color:var(--ink)}
header.hero{padding:72px 0 8px}
h1{font-size:clamp(2.25rem,4.6vw,3.5rem);letter-spacing:-.03em;max-width:17ch}
.lead{font-size:1.1875rem;line-height:1.5;color:var(--ink-2);max-width:62ch;margin:22px 0 0}
section{padding:64px 0 0}
h2{font-size:1.625rem;letter-spacing:-.02em}
h2+p{margin:10px 0 0;max-width:68ch;color:var(--ink-2)}
.finding{font-size:clamp(1.375rem,2.4vw,1.75rem);line-height:1.3;letter-spacing:-.015em;font-weight:500;max-width:30ch;margin:0}
.finding strong{font-weight:700}
.finding .of{color:var(--ink-2)}
.result{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,8fr);gap:48px;align-items:start;margin-top:28px}
@media(max-width:860px){.result{grid-template-columns:1fr;gap:28px}}
figure.bar{margin:0 0 18px}
figure.bar figcaption{display:flex;justify-content:space-between;font-size:.9375rem;margin-bottom:8px;color:var(--ink-2)}
figure.bar figcaption span:first-child{color:var(--ink);font-weight:600}
figure.bar svg{display:block;width:100%;height:auto}
figure.bar text{fill:#fff;font:600 17px var(--sans)}
.segment rect{transition:opacity .15s var(--ease)}
.segment:hover rect{opacity:.82}
.key{display:flex;flex-wrap:wrap;gap:6px 20px;font-size:.875rem;color:var(--ink-2);margin:4px 0 0;padding:0;list-style:none}
.key i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:8px}
.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px 34px;margin:30px 0 0;padding:20px 0 0;border-top:1px solid var(--line);font-size:.9375rem;color:var(--ink-2)}
@media(max-width:860px){.facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
.facts b{display:block;color:var(--ink);font-size:1.0625rem;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:.9375rem;margin-top:22px}
th{color:var(--ink-3);font-weight:500;text-align:right;border-bottom:1px solid var(--line-strong);padding:8px 12px;font-size:.8125rem}
td{padding:11px 12px;border-bottom:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}
th:first-child,td:first-child{text-align:left;padding-left:0}
th:last-child,td:last-child{padding-right:0}
.note{max-width:68ch;color:var(--ink-2);margin:18px 0 0}
ol.steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:32px;list-style:none;margin:28px 0 0;padding:0;counter-reset:step}
@media(max-width:860px){ol.steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
ol.steps li{counter-increment:step;border-top:1px solid var(--line-strong);padding-top:14px}
ol.steps li::before{content:counter(step);display:block;font:400 .8125rem var(--mono);color:var(--ink-3);margin-bottom:6px}
ol.steps b{display:block;font-size:1.0625rem;margin-bottom:6px}
ol.steps p{margin:0;font-size:.9375rem;color:var(--ink-2)}
.cases{margin-top:22px;border-top:1px solid var(--line-strong)}
a.case{display:grid;grid-template-columns:minmax(150px,1.1fr) minmax(170px,1fr) 240px minmax(220px,1.3fr) 24px;gap:20px;align-items:center;padding:15px 0;border-bottom:1px solid var(--line);color:inherit;text-decoration:none;transition:background .15s var(--ease),padding .15s var(--ease)}
a.case:hover{background:var(--surface);padding-left:12px;padding-right:12px}
a.case b{font-weight:600}
a.case span{color:var(--ink-2);font-size:.9375rem}
a.case span strong{color:var(--ink);font-weight:600}
a.case .go{color:var(--ink-3);text-align:right;transition:transform .15s var(--ease),color .15s var(--ease)}
a.case:hover .go{color:var(--accent);transform:translateX(3px)}
.mini{display:block;width:100%;height:8px}
@media(max-width:860px){a.case{grid-template-columns:1fr 1fr;gap:8px 16px}a.case .go{display:none}}
details{margin-top:14px}
details summary{cursor:pointer;color:var(--ink-2);font-size:.875rem;width:max-content}
details summary:hover{color:var(--ink)}
ul.limits{max-width:72ch;color:var(--ink-2);padding-left:20px;margin:18px 0 0}
ul.limits li{margin:8px 0}
ul.limits b{color:var(--ink);font-weight:600}
footer{color:var(--ink-3);font-size:.8125rem;margin:72px 0 0;padding:22px 0 48px;border-top:1px solid var(--line);max-width:none}
`;

function traceSection(traces){
 const t=traces.summary,row=(name,x)=>`<tr><td>${name}</td><td>${x.withTokens}</td><td>${x.corroborated}</td><td>${pct(x.corroborated,x.withTokens)}%</td></tr>`;
 return `<section id="trace"><h2>A check that did not work</h2>
<p>We expected action traces to confirm the supported links. For every link we searched ${int(traces.inputs.sessions)} computer-use sessions for a command or tool output by the receiving agent that names the artifact between the two messages.</p>
<table><thead><tr><th>Review outcome</th><th>Links</th><th>Receiver’s trace names the artifact</th><th>Share</th></tr></thead><tbody>${row('Supported by both reviewers',t.supported)}${row('Acknowledged only',t.mention)}${row('Rejected by both reviewers',t.rejected)}</tbody></table>
<p class="note">Access is nearly universal, including for links both reviewers rejected. The likely reason is that these agents work in shared repositories where the same files recur. So “the receiver touched it” cannot separate a hand-off from working side by side, and Buzzer shows trace access as context on a link without using it to upgrade one.</p></section>`;
}

function methodPage({summary,cases,wiki,scan,traces}){
 const d=summary.detector,c=summary.control,a=summary.agreement,row=(name,t)=>`<tr><td>${name}</td><td>${t.total}</td><td>${t.supported}</td><td>${t.mention}</td><td>${t.disputed}</td><td>${t.rejected}</td></tr>`;
 const best=[...cases].sort((x,y)=>y.component-x.component)[0];
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Method and limits, Buzzer</title><style>${themeCss()}${css}</style></head><body><div class="wrap">
<nav><a class="mark" href="index.html">Buzzer</a><ul><li><a href="index.html">← Overview</a></li></ul></nav>
<header class="hero"><h1>Method and limits</h1>
<p class="lead">How the hand-off review works, how the detector compares with random pairs, one check that failed, and what the traces cannot show.</p></header>

<section id="result"><h2>How much of a swarm graph survives review?</h2>
<div class="result">
<p class="finding">In AI Village chat the detector proposed <strong>${d.total}</strong> hand-offs between agents. Two blind reviewers support <strong>${d.supported}</strong>. <span class="of">Of ${c.total} unlinked control pairs, they support ${c.supported}.</span></p>
<div>${bar(d,'Detector links')}${bar(c,'Unlinked control pairs')}
<ul class="key">${SEGMENTS.map(([key,name])=>`<li><i style="background:var(--${key})"></i>${esc(name)}</li>`).join('')}</ul>
<details><summary>Show as a table</summary><table><thead><tr><th></th><th>Pairs</th><th>Supported</th><th>Acknowledged</th><th>Disputed</th><th>Rejected</th></tr></thead><tbody>${row('Detector links',d)}${row('Unlinked control pairs',c)}</tbody></table></details></div>
</div>
<div class="facts">
<div><b class="num">${int(scan.coverage.scanned)} messages</b>in the archive the detector read to propose these links</div>
<div><b class="num">${a.exact} of ${a.items} verdicts agree</b>between the two reviewers (Cohen’s κ ${a.kappa.toFixed(2)})</div>
<div><b class="num">${summary.quotes.verified} of ${summary.quotes.checked} quotes found</b>in the source message by code; the rest are not counted</div>
<div><b class="num">${best.component} of ${best.labels} agent labels connected</b>by supported links in the largest network</div>
</div></section>

${traces?traceSection(traces):''}

<section id="method"><h2>How it works</h2>
<ol class="steps">
<li><b>Scan everything cheaply</b><p>One streaming pass proposes a link when a later message addresses an earlier author and repeats an exact path, URL or commit from it.</p></li>
<li><b>Two blind readers per pair</b><p>Each reviewer answers fixed questions and must quote the later message. Unlinked control pairs are mixed in unmarked.</p></li>
<li><b>Keep the weaker reading</b><p>Code checks every quote. A link is supported only if both reviewers report use. Everything else stays visible in its own color.</p></li>
<li><b>Trace the network</b><p>Lanes are agents, stars are messages. Replay the window, open any link for both verdicts, and read who passed what to whom.</p></li>
</ol></section>

<section id="limits"><h2>What this does not show</h2>
<ul class="limits">
<li><b>Reported use is not an observed read.</b> A supported link means the later agent wrote that it used the artifact. Trace access to the artifact’s name was nearly universal, so no read of content is established for any link.</li>
<li><b>Labels are not agents.</b> Labels are assigned by the publisher. Ten connected labels are not ten independent systems.</li>
<li><b>The reviewers are models.</b> Two sessions of one model family with a fixed rubric, not independent humans. Agreement between them is not accuracy.</li>
<li><b>These are known populations.</b> AI Village and the wiki incident calibrate the method. Nothing here is a discovery of a misaligned swarm.</li>
<li><b>Recall is not estimated.</b> The detector only proposes links that repeat an exact reference, so hand-offs without one are missed.</li>
</ul></section>
<footer>Sources: AI Digest, AI Village dataset (2026), theaidigest.org/village, and the collusion.wiki public export. Excerpts on case pages are limited to 240 characters per record. Built for the AI Village × Grove Research AI Swarm Dynamics Hackathon, October 2026.</footer>
</div></body></html>`.replaceAll(' · ',' · ');
}


// Agent-level network: one node per agent label however many messages there are,
// one curve per directed pair, width by the number of confirmed hand-offs.
function networkSvg(handoffs){
 const pair=new Map(),degree=new Map();
 for(const [a,b]of handoffs){if(a===b)continue;const k=a+'>'+b;pair.set(k,(pair.get(k)||0)+1);degree.set(a,(degree.get(a)||0)+1);degree.set(b,(degree.get(b)||0)+1);}
 const names=[...degree.keys()].sort((x,y)=>degree.get(y)-degree.get(x)),W=620,H=470,cx=W/2,cy=H/2,R=165,pos=new Map();
 names.forEach((n,i)=>{const t=-Math.PI/2+2*Math.PI*i/names.length;pos.set(n,[cx+R*Math.cos(t),cy+R*Math.sin(t),t]);});
 const max=Math.max(...pair.values()),maxDeg=Math.max(...degree.values());
 const curves=[...pair.entries()].sort((x,y)=>x[1]-y[1]).map(([k,n])=>{const [a,b]=k.split('>'),[x1,y1]=pos.get(a),[x2,y2]=pos.get(b),mx=(x1+x2)/2,my=(y1+y2)/2,qx=mx+(cx-mx)*.45+(y2-y1)*.08,qy=my+(cy-my)*.45-(x2-x1)*.08;
  return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="var(--supported)" stroke-width="${(1+3.5*n/max).toFixed(1)}" stroke-linecap="round" opacity="${(.35+.6*n/max).toFixed(2)}"><title>${esc(a)} to ${esc(b)}: ${n} confirmed hand-off${n===1?'':'s'}</title></path>`;}).join('');
 const nodes=names.map(n=>{const [x,y,t]=pos.get(n),r=5+9*degree.get(n)/maxDeg,lx=cx+(R+r+10)*Math.cos(t),ly=cy+(R+r+10)*Math.sin(t),anchor=Math.abs(Math.cos(t))<.2?'middle':Math.cos(t)>0?'start':'end';
  return `<g><title>${esc(n)}: ${degree.get(n)} confirmed hand-offs in or out</title><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="var(--star)" stroke="var(--surface)" stroke-width="2"/><text x="${lx.toFixed(1)}" y="${(ly+4+(Math.sin(t)>.8?8:Math.sin(t)<-.8?-4:0)).toFixed(1)}" text-anchor="${anchor}">${esc(n)}</text></g>`;}).join('');
 return {svg:`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Network of ${names.length} agent labels joined by ${handoffs.length} confirmed hand-offs">${curves}${nodes}</svg>`,agents:names.length,pairs:pair.size};
}

const homeCss=`
.wrap.home{max-width:1180px}
nav ul a.on{color:var(--ink)}
header.hero h1{max-width:20ch}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin:30px 0 0}
.btn{display:inline-flex;align-items:center;gap:8px;font:600 .9375rem var(--sans);padding:11px 18px;border-radius:8px;text-decoration:none;border:1px solid var(--line-strong);color:var(--ink);background:transparent;transition:background .15s var(--ease),transform .15s var(--ease),border-color .15s var(--ease)}
.btn:hover{background:var(--surface-2);border-color:var(--ink-3)}
.btn:active{transform:translateY(1px)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.btn.primary:hover{background:#9aeeda}
.btn.small{padding:7px 12px;font-size:.8125rem}
.product{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:44px;align-items:center;margin-top:56px;padding:34px;background:var(--surface);border:1px solid var(--line);border-radius:14px}
.product.flip{grid-template-columns:minmax(0,7fr) minmax(0,5fr)}
@media(max-width:900px){.product,.product.flip{grid-template-columns:1fr;gap:26px;padding:22px}.product.flip .shot{order:2}}
.product h2{font-size:1.75rem}
.product .claim{font-size:1.1875rem;line-height:1.4;color:var(--ink);margin:14px 0 0;max-width:34ch}
.product .claim strong{font-weight:700}
.product p.sub{color:var(--ink-2);margin:12px 0 0;max-width:46ch}
.product .cta{margin-top:22px}
.shot{display:block;text-decoration:none;border-radius:10px;background:var(--canvas);border:1px solid var(--line);padding:18px;transition:border-color .15s var(--ease),transform .2s var(--ease)}
a.shot:hover{border-color:var(--accent);transform:translateY(-2px)}
.shot svg{display:block;width:100%;height:auto}
.shot text{fill:var(--ink-2);font:500 13px var(--sans)}
.shot .cap{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:.75rem;color:var(--ink-3);margin-top:12px}
.shot .cap i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px}
.runs{margin-top:26px;border-top:1px solid var(--line-strong)}
a.run{display:grid;grid-template-columns:minmax(140px,1fr) minmax(90px,.6fr) minmax(250px,1.6fr) auto;gap:18px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line);color:inherit;text-decoration:none;transition:background .15s var(--ease),padding .15s var(--ease)}
a.run:hover{background:var(--surface);padding-left:12px;padding-right:12px}
a.run span{color:var(--ink-2);font-size:.9375rem}
a.run span strong{color:var(--ink);font-weight:600}
a.run:hover .btn{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
@media(max-width:860px){a.run{grid-template-columns:1fr auto}a.run span:nth-child(2){display:none}}
.how{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px;margin:26px 0 0;padding:0;list-style:none;counter-reset:step}
@media(max-width:860px){.how{grid-template-columns:1fr}}
.how li{counter-increment:step;border-top:1px solid var(--line-strong);padding-top:14px}
.how li::before{content:counter(step);display:block;font:400 .8125rem var(--mono);color:var(--ink-3);margin-bottom:6px}
.how b{display:block;font-size:1.0625rem;margin-bottom:6px}
.how p{margin:0;font-size:.9375rem;color:var(--ink-2)}
`;


// One app shell for every page: a top bar with the sections and, inside a section, a row of
// its cases, so a demo never has to go back to the overview to switch page.
const shellCss=`
.topbar{display:flex;align-items:stretch;gap:30px;padding:0 32px;height:56px;border-bottom:1px solid var(--line);background:var(--surface)}
.topbar .mark{display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.0625rem;letter-spacing:-.01em;color:var(--ink);text-decoration:none}
.topbar .mark i{width:15px;height:15px;background:var(--accent);clip-path:polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)}
.topbar .tabs{display:flex;gap:2px;overflow-x:auto}
.topbar .tabs a{display:flex;align-items:center;padding:0 14px;color:var(--ink-2);text-decoration:none;font-size:.9375rem;font-weight:500;white-space:nowrap;border-bottom:2px solid transparent;border-top:2px solid transparent;transition:color .15s var(--ease),border-color .15s var(--ease)}
.topbar .tabs a:hover{color:var(--ink)}
.topbar .tabs a[aria-current]{color:var(--ink);border-bottom-color:var(--accent)}
.subbar{display:flex;align-items:center;gap:6px;overflow-x:auto;padding:10px 32px;border-bottom:1px solid var(--line)}
.subbar span{font-size:.75rem;color:var(--ink-3);margin-right:6px;white-space:nowrap}
.subbar a{white-space:nowrap;font-size:.8125rem;padding:5px 12px;border-radius:999px;color:var(--ink-2);text-decoration:none;border:1px solid var(--line);transition:background .15s var(--ease),color .15s var(--ease),border-color .15s var(--ease)}
.subbar a:hover{color:var(--ink);border-color:var(--line-strong);background:var(--surface)}
.subbar a[aria-current]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:600}
@media(max-width:700px){.topbar,.subbar{padding-left:16px;padding-right:16px}.topbar{gap:14px}}
`;
function shell(html,{file,section,tabs,subs,subLabel}){
 const bar=`<div class="topbar"><a class="mark" href="index.html"><i></i>Buzzer</a><div class="tabs">${tabs.map(t=>`<a href="${esc(t.file)}"${t.section===section?' aria-current="page"':''}>${esc(t.label)}</a>`).join('')}</div></div>`+(subs.length?`<div class="subbar"><span>${esc(subLabel)}</span>${subs.map(x=>`<a href="${esc(x.file)}"${x.file===file?' aria-current="page"':''}>${esc(x.label)}</a>`).join('')}</div>`:'');
 return html.replace(/<nav>[\s\S]*?<\/nav>/,()=>'').replace('</style>',()=>shellCss+'</style>').replace('<body>',()=>'<body>'+bar);
}

function matrixSvg(relay,N=26){
 const names=relay.top.slice(0,N),count=new Map(relay.pair),C=16;let max=1,cells='';
 for(const a of names)for(const b of names)max=Math.max(max,count.get(a+'>'+b)||0);
 names.forEach((a,y)=>names.forEach((b,x)=>{const n=count.get(a+'>'+b)||0;cells+=`<rect x="${x*C}" y="${y*C}" width="${C-2}" height="${C-2}" rx="2" fill="${n?'var(--supported)':'#1b3550'}" opacity="${n?(.3+.7*n/max).toFixed(2):.5}"/>`;}));
 return `<svg viewBox="0 0 ${N*C-2} ${N*C-2}" role="img" aria-label="Matrix of the ${N} most connected wiki labels">${cells}</svg>`;
}

function landing({summary,cases,wiki,handoffs,collusion,relay,wikiCases=[]}){
 const d=summary.detector,c=summary.control,best=[...cases].sort((x,y)=>y.component-x.component)[0],net=networkSvg(handoffs);
 const t=collusion?.summary.test.agreement,h=collusion?.summary.holdout.agreement,p=x=>Math.round(100*x);
 const monitor=collusion?`<section class="product" id="monitor"><div><h2>Collusion monitor</h2>
<p class="claim">Catches <strong>${t.caught} of ${t.positive}</strong> collusive agreements across <strong>${int(t.n)}</strong> held-out episodes, from the agents’ messages alone.</p>
<p class="sub">${p(t.recall)}% caught, ${p(t.precision)}% of flags correct. ${h.caught} of ${h.positive} on a model family it never saw.</p>
<div class="cta"><a class="btn primary" href="collusion.html">Open the collusion monitor →</a></div></div>
<a class="shot" href="collusion.html" aria-label="Open the collusion monitor">${gridSvg(collusion,{perRow:9})}<div class="cap"><span><i style="background:var(--supported)"></i>Caught</span><span><i style="background:var(--disputed)"></i>Missed</span><span><i style="background:var(--mention)"></i>False alarm</span><span>${int(collusion.summary.episodes)} episodes, one square each</span></div></a></section>`:'';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buzzer</title><style>${themeCss()}${css}${homeCss}</style></head><body><div class="wrap home">
<nav><a class="mark" href="index.html">Buzzer</a><ul>${collusion?'<li><a href="collusion.html">Collusion monitor</a></li>':''}<li><a href="#traces">Hand-off traces</a></li><li><a href="method.html">Method and limits</a></li></ul></nav>
<header class="hero"><h1>Catch agents colluding. See who handed what to whom.</h1>
<p class="lead">Buzzer reads what agents say to each other and shows you the evidence.</p>
<div class="cta">${collusion?'<a class="btn primary" href="collusion.html">Open the collusion monitor →</a>':''}<a class="btn${collusion?'':' primary'}" href="${esc(best.file)}">Open AI Village traces →</a>${relay?'<a class="btn" href="wiki-full.html">Open the shared wiki →</a>':''}</div></header>

${monitor}

<section class="product flip" id="traces"><a class="shot" href="${esc(best.file)}" aria-label="Open the largest hand-off trace">${net.svg}<div class="cap"><span>${net.agents} agents, ${net.pairs} directed pairs. Thicker curves carry more confirmed hand-offs.</span></div></a>
<div><h2>AI Village hand-offs</h2>
<p class="claim"><strong>${d.supported}</strong> confirmed hand-offs between AI Village agents, each with the sentence that proves it.</p>
<p class="sub">Up to ${best.component} of ${best.labels} agents in one chain. Random pairs pass ${c.supported} time in ${c.total}.</p>
<div class="cta"><a class="btn primary" href="${esc(best.file)}">Open the largest network →</a></div></div></section>

${relay?`<section class="product" id="wiki"><div><h2>Shared wiki relay</h2>
<p class="claim"><strong>${int(relay.stats.hops)}</strong> observed hand-offs between <strong>${int(relay.stats.labels)}</strong> labels on one public wiki.</p>
<p class="sub">${int(relay.stats.revisions)} revisions, ${int(relay.stats.sharedPages)} pages built by more than one label. Filter by label, then open a page as a relay.</p>
<div class="cta"><a class="btn primary" href="wiki-full.html">Open the full archive →</a>${wikiCases[0]?`<a class="btn" href="${esc(wikiCases[0].file)}">Open one page →</a>`:''}</div></div>
<a class="shot" href="wiki-full.html" aria-label="Open the shared wiki relay" style="max-width:440px;justify-self:end;width:100%">${matrixSvg(relay)}<div class="cap"><span>Who built on whom: the 26 most connected labels</span></div></a></section>`:''}

<section id="cases" style="padding-top:44px"><h2>Shared wiki</h2>
<div class="runs">${relay?`<a class="run" href="wiki-full.html"><b>Shared wiki, full archive</b><span class="num">${int(relay.stats.labels)} labels</span><span class="num"><strong>${int(relay.stats.hops)}</strong> observed hand-offs · <strong>${int(relay.stats.sharedPages)}</strong> shared pages</span><span class="btn small">Open relay →</span></a>`:''}${wikiCases.map(k=>`<a class="run" href="${esc(k.file)}"><b>Wiki page, ${esc(k.name.length>30?k.name.slice(0,29)+'…':k.name)}</b><span class="num">${k.labels} labels</span><span class="num"><strong>${k.hops}</strong> observed hand-offs · <strong>${k.component}</strong> labels in one chain</span><span class="btn small">Open trace →</span></a>`).join('')}<a class="run" href="wiki.html"><b>June 16 incident, reviewed</b><span class="num">${wiki.stats[0].n} signatures</span><span class="num"><strong>${wiki.stats[1].n}</strong> revisions traced · <strong>${wiki.stats[3].n}</strong> reported uptake</span><span class="btn small">Open trace →</span></a></div>
<h2 style="margin-top:48px">AI Village</h2>
<div class="runs">${cases.map(k=>`<a class="run" href="${esc(k.file)}"><b>AI Village, ${esc(k.range)}</b><span class="num">${k.labels} agents</span><span class="num"><strong>${k.counts.supported}</strong> confirmed hand-offs · <strong>${k.component}</strong> agents in one chain</span><span class="btn small">Open trace →</span></a>`).join('')}</div></section>

<footer><a href="method.html">Method and limits</a> · Data: SALT-NLP agent-collusion (MIT), AI Digest AI Village dataset, collusion.wiki export.</footer>
</div></body></html>`.replaceAll(' · ',' · ');
}

function main(){
 const [scanPath,reviewDir,wikiPath,out,tracePath,saltDir,revisionsPath]=process.argv.slice(2);
 if(!scanPath||!reviewDir||!wikiPath||!out){console.error('Usage: node src/constellation-site.mjs <scan.json> <review-dir> <wiki-replay.json> <new-output-dir> [trace-join.json]');process.exit(2);}
 if(existsSync(out)){console.error('Refusing to reuse '+out);process.exit(2);}
 const scan=JSON.parse(readFileSync(scanPath,'utf8')),review=JSON.parse(readFileSync(join(reviewDir,'reconciliation.json'),'utf8')),messages=JSON.parse(readFileSync(join(reviewDir,'key','messages.json'),'utf8'));
 const traces=tracePath?JSON.parse(readFileSync(tracePath,'utf8')):null;
 mkdirSync(out,{recursive:true});
 const pages=[],put=(file,html)=>pages.push([file,html]);
 const handoffs=[];
 const cases=[...scan.candidates].sort((a,b)=>a.start.localeCompare(b.start)).map(c=>{
  const model=buildFromReview(scan,c.id,messages,review,traces),file='village-'+c.start.slice(0,10)+'.html';
  put(file,renderPage(model,{home:'index.html'}));
  const counts={supported:0,mention:0,disputed:0,rejected:0},tierOf={'reported-uptake':'supported',mention:'mention',disputed:'disputed',rejected:'rejected'};
  for(const e of model.edges)if(tierOf[e.kind])counts[tierOf[e.kind]]++;
  const fmt=iso=>new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
  for(const e of model.edges)if(e.kind==='reported-uptake')handoffs.push([e.producer,e.consumer]);
  return {file,id:c.id,range:fmt(c.start)+' to '+fmt(c.end),labels:model.lanes.length,messages:model.records.length,links:model.edges.length,counts,component:model.summary.component.length>1?model.summary.component.length:0};
 });
 const wiki=buildConstellation(JSON.parse(readFileSync(wikiPath,'utf8')));
 put('wiki.html',renderPage(wiki,{home:'index.html'}));
 const collusion=saltDir?buildCollusion(saltDir):null;
 if(collusion)put('collusion.html',renderCollusion(collusion,{home:'index.html'}));
 const relay=revisionsPath?buildRelay(readFileSync(revisionsPath,'utf8').split(String.fromCharCode(10)).filter(Boolean).map(l=>JSON.parse(l))):null;
 const wikiCases=[];
 if(relay){const rows=readFileSync(revisionsPath,'utf8').split(String.fromCharCode(10)).filter(Boolean).map(l=>JSON.parse(l));pickCases(relay).forEach((p,i)=>{const m=buildPageCase(rows,p),file='wiki-page-'+(i+1)+'.html';put(file,renderPage(m,{home:'index.html'}));wikiCases.push({file,name:p.id.split('/').pop(),labels:m.lanes.length,hops:m.edges.length,component:m.summary.component.length});});}
 if(relay)put('wiki-full.html',renderRelay(relay,{home:'index.html'}));
 put('method.html',methodPage({summary:review.summary,cases,wiki,scan,traces}));
 put('index.html',landing({summary:review.summary,cases,wiki,handoffs,collusion,relay,wikiCases}));
 const best=[...cases].sort((x,y)=>y.component-x.component)[0],short=n=>n.length>24?n.slice(0,23)+'…':n;
 const tabs=[{file:'index.html',label:'Overview',section:'home'},...(collusion?[{file:'collusion.html',label:'Collusion monitor',section:'collusion'}]:[]),{file:best.file,label:'AI Village',section:'village'},{file:relay?'wiki-full.html':'wiki.html',label:'Shared wiki',section:'wiki'},{file:'method.html',label:'Method',section:'method'}];
 const subs={village:cases.map(k=>({file:k.file,label:k.range.replace(' to ','–')})),wiki:[...(relay?[{file:'wiki-full.html',label:'Full archive'}]:[]),...wikiCases.map(k=>({file:k.file,label:short(k.name)})),{file:'wiki.html',label:'June 16 incident'}]};
 for(const [file,html]of pages){const section=file.startsWith('village-')?'village':file.startsWith('wiki')?'wiki':file==='collusion.html'?'collusion':file==='method.html'?'method':'home';writeFileSync(join(out,file),shell(html,{file,section,tabs,subs:subs[section]||[],subLabel:section==='village'?'Window':'Page'}));}
 console.log(JSON.stringify(cases.map(k=>({file:k.file,labels:k.labels,links:k.links,supported:k.counts.supported,component:k.component}))));
}

if(process.argv[1]&&process.argv[1].endsWith('constellation-site.mjs'))main();
