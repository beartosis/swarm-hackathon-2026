import { replayAt } from './replay.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function renderReplayHtml(bundle, options = {}) {
  const cutoff = options.cutoff || bundle.scope?.start || '1970-01-01T00:00:00Z';
  const snapshot = replayAt(bundle, cutoff);
  const config = { snapshot, apiUrl: options.apiUrl ?? null };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escape(snapshot.title)} · Buzzer</title>
<style>
:root{--bg:#14191b;--panel:#1b2225;--panel2:#202a2e;--ink:#ece9dc;--muted:#a2afb2;--line:#364246;--accent:#d4df9a;--blue:#94cbd9;--amber:#e5ba77;--mono:ui-monospace,SFMono-Regular,Consolas,monospace;--sans:Inter,Segoe UI,Arial,sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 var(--sans)}button,input{font:inherit}button,a,input{outline-offset:4px}button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--accent)}button{cursor:pointer}a{color:var(--blue);text-underline-offset:3px}button{background:transparent;color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:8px 13px}button:hover{border-color:var(--accent);background:#d4df9a0c}button[aria-pressed=true]{background:var(--accent);color:#18211b;border-color:var(--accent)}button:disabled{opacity:.45;cursor:default}.skip{position:absolute;left:12px;top:-80px;background:var(--ink);color:var(--bg);padding:12px;z-index:10}.skip:focus{top:8px}.shell{max-width:1660px;margin:auto;padding:0 34px 28px}.brandbar{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);height:76px;gap:16px}.brand{display:flex;align-items:center;gap:11px;letter-spacing:2px;font-size:18px;font-weight:650}.mark{width:27px;height:27px;border:1px solid var(--accent);border-radius:50%;display:grid;place-items:center;color:var(--accent);font-size:14px}.eyebrow{font:10px var(--mono);letter-spacing:1.7px;color:var(--muted);text-transform:uppercase}.tag{border:1px solid var(--line);padding:5px 9px;border-radius:4px;font:10px var(--mono);letter-spacing:.5px;color:var(--muted)}.hero{display:flex;justify-content:space-between;gap:30px;align-items:flex-end;padding:33px 0 25px}.hero h1{font-weight:450;letter-spacing:-1.2px;font-size:clamp(27px,3vw,40px);line-height:1.2;margin:9px 0 12px}.hero p{margin:0;color:var(--muted);max-width:750px}.hero .scope{color:var(--accent);text-align:right;font:11px/1.8 var(--mono);min-width:210px}.control{border:1px solid var(--line);background:var(--panel);border-radius:9px;padding:20px 23px;margin-bottom:22px}.controltop{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:18px}.cutoff{font:15px var(--mono);color:var(--accent);display:block;margin-top:4px}.controls{display:flex;align-items:center;gap:10px}.play{background:var(--accent);color:#172019;border-color:var(--accent);min-width:102px}.sliderline{display:flex;align-items:center;gap:18px}.sliderline input{flex:1;accent-color:var(--accent);cursor:pointer}.clocklabel{font:10px var(--mono);color:var(--muted);min-width:76px}.clocklabel:last-child{text-align:right}.disclaimer{color:var(--muted);font-size:11px;margin-top:13px;display:flex;justify-content:space-between;gap:20px}.stats{display:grid;grid-template-columns:repeat(4,1fr);margin-bottom:24px;border:1px solid var(--line);border-radius:8px;overflow:hidden}.stat{padding:16px 22px;border-right:1px solid var(--line);background:var(--panel)}.stat:last-child{border:0}.stat strong{font:28px var(--mono);font-weight:400;display:block;margin-bottom:2px}.stat span{color:var(--muted);font-size:11px}.workspace{display:grid;grid-template-columns:230px minmax(350px,1fr) 350px;gap:20px;align-items:start}.sectiontitle{margin:0 0 14px;font:11px var(--mono);text-transform:uppercase;letter-spacing:1.2px}.subtle{color:var(--muted)}.sources{border-top:1px solid var(--line);padding-top:20px}.timeline{max-height:730px;overflow:auto;padding:0 7px 0 0}.sourceitem{display:block;width:100%;text-align:left;position:relative;border:0;border-left:1px solid var(--line);border-radius:0;margin-left:5px;padding:8px 0 20px 18px}.sourceitem:before{content:'';position:absolute;width:7px;height:7px;border-radius:50%;background:var(--blue);left:-4px;top:15px}.sourceitem time{font:10px var(--mono);color:var(--muted);display:block;margin-bottom:6px}.sourceitem .recordname{font-size:12px;line-height:1.5;display:block;overflow-wrap:anywhere}.sourceitem .originalid{display:block;font:10px var(--mono);color:var(--muted);margin-top:5px;overflow-wrap:anywhere}.board{border:1px solid var(--line);background:var(--panel);border-radius:9px;overflow:hidden}.boardhead{padding:18px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:15px}.boardhead h2{margin:0;font-weight:500;font-size:15px}.filters{display:flex;gap:5px;flex-wrap:wrap}.filters button{font-size:10px;padding:5px 8px}.graph{padding:22px;background-image:radial-gradient(#8a999922 1px,transparent 1px);background-size:19px 19px;min-height:205px}.graphcaption{font:10px var(--mono);text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:16px}.nodes{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.node{text-align:left;border:1px solid #52615b;background:#222c2c;padding:15px;border-radius:7px;box-shadow:0 5px 18px #0002;width:100%;min-height:120px}.node.selected{border:1px solid var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.node small{font:9px var(--mono);letter-spacing:1px;color:var(--accent);text-transform:uppercase}.node strong{display:block;font-size:13px;font-weight:500;margin:9px 0;overflow-wrap:anywhere}.node .foot{font:10px var(--mono);color:var(--muted)}.edgearea{padding:20px;border-top:1px solid var(--line)}.edge{width:100%;text-align:left;padding:14px 15px;background:#172024;margin:0 0 10px}.edge.selected{border-color:var(--accent)}.edgepath{display:flex;gap:10px;align-items:center;font-size:12px;overflow-wrap:anywhere}.arrow{color:var(--accent);font-size:20px}.edgebottom{margin-top:9px;display:flex;gap:10px;align-items:center;font-size:10px;color:var(--muted)}.pill{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);font:9px var(--mono);padding:3px 7px;border-radius:20px;white-space:nowrap}.pill:before{content:'';height:4px;width:4px;background:currentColor;border-radius:50%}.observed{color:var(--accent)}.reported{color:var(--blue)}.unknown{color:var(--amber)}.empty{padding:23px 12px;color:var(--muted);text-align:center;font-size:12px}.detail{background:#edeadc;color:#253133;border-radius:9px;overflow:hidden;min-height:475px}.detailtop{padding:20px 22px;border-bottom:1px solid #c8cebd}.detailtop .eyebrow{color:#66716a}.detailtop h2{font-weight:500;font-size:19px;line-height:1.35;margin:10px 0 5px;overflow-wrap:anywhere}.detailbody{padding:18px 22px}.detail a{color:#286776}.detail .muted{color:#68736e}.detail .pill{border-color:#c4cdb9}.detail .observed{color:#536128}.detail .reported{color:#256779}.detail .unknown{color:#846126}.dimensions{margin:0}.dimrow{padding:8px 0;border-bottom:1px solid #d3d8c9;display:flex;align-items:center;justify-content:space-between;gap:10px}.dimrow dt{font-size:11px}.dimrow dd{margin:0}.claimtext{font-size:11px;color:#566360;margin:5px 0 11px}.detail h3{font:10px var(--mono);text-transform:uppercase;letter-spacing:1px;margin:22px 0 10px}.citation{padding:12px;border:1px solid #c4cdb9;border-radius:5px;margin-bottom:10px;font-size:11px}.citation strong{display:block;margin-bottom:7px;overflow-wrap:anywhere}.citation .hash{font:9px/1.7 var(--mono);overflow-wrap:anywhere;color:#6a756a}.citation pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:280px;overflow:auto;font:10px/1.65 var(--mono);margin:10px 0 0}.citation details>summary{cursor:pointer;color:#336878;margin-top:8px}.citationlinks{display:flex;gap:12px;margin-top:8px}.missing{border-left:2px solid #b28b49;padding-left:10px;font-size:11px;color:#6b664e}.footer{margin-top:27px;padding-top:15px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:20px;font:10px/1.7 var(--mono);color:var(--muted)}#notice{color:var(--amber);font-size:12px;margin:10px 0}#notice:empty{display:none}.synthetic{color:var(--amber);font-size:11px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:1250px){.workspace{grid-template-columns:185px minmax(300px,1fr)}.detail{grid-column:2}.sources{grid-row:span 2}}@media(max-width:760px){.shell{padding:0 17px 24px}.brandbar{height:65px}.brandbar>.eyebrow{display:none}.hero{display:block;padding-top:25px}.hero .scope{text-align:left;margin-top:17px}.stats{grid-template-columns:1fr 1fr}.stat:nth-child(2){border-right:0}.stat:nth-child(-n+2){border-bottom:1px solid var(--line)}.workspace{display:flex;flex-direction:column}.sources,.board,.detail{width:100%}.sources{order:2}.timeline{max-height:260px}.detail{order:1}.boardhead{align-items:flex-start;flex-direction:column}.controltop{align-items:flex-start}.controls{flex-wrap:wrap;justify-content:flex-end}.control{padding:16px}.clocklabel{min-width:53px}.cutoff{font-size:12px}.disclaimer{display:block}.footer{display:block}.sourceitem{padding-bottom:12px}.nodes{grid-template-columns:1fr 1fr}.node{padding:12px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
.graph{max-height:360px;overflow:auto}.edgearea{max-height:650px;overflow:auto}.detail{position:sticky;top:18px;max-height:calc(100vh - 36px);overflow:auto}.scope{white-space:pre-line}.original-screenshot{display:block;max-width:100%;height:auto;margin:12px 0;border:1px solid #c4cdb9;border-radius:4px}@media(max-width:1250px){.detail{position:static;max-height:none}}@media(max-width:760px){.graph{max-height:400px}.edgearea{max-height:480px}.disclaimer span{display:block;margin-top:4px}}
</style></head><body>
<a class="skip" href="#workspace">Skip to evidence</a><div class="shell"><header class="brandbar"><div class="brand"><span class="mark" aria-hidden="true">↗</span>BUZZER <span class="tag">RESEARCH / LINEAGE</span></div><div class="eyebrow">Frozen evidence. Bounded conclusions.</div></header>
<section class="hero"><div><div class="eyebrow">Archive reconstruction</div><h1>${escape(snapshot.title)}</h1><p>Trace contributions through original evidence, attributed uptake, and subsequent action. Each link keeps its limits visible.</p></div><div class="scope" id="scope"></div></section>
<section class="control" aria-label="Replay controls"><div class="controltop"><div><label class="eyebrow" for="cutoff">Evidence available by</label><output class="cutoff" id="cutoff-label" for="cutoff"></output></div><div class="controls"><button id="reset" aria-label="Return to the beginning">↤ Start</button><button class="play" id="play" aria-pressed="false">▶ Play replay</button></div></div><div class="sliderline"><span class="clocklabel" id="start-label"></span><input id="cutoff" type="range" min="0" max="1000" value="0" aria-label="Evidence availability cutoff"><span class="clocklabel" id="end-label"></span></div><div class="disclaimer"><span>Only originals and interpretations available at this cutoff are shown.</span><span id="mode-label">Local evidence review</span></div><div id="notice" role="status" aria-live="polite"></div></section>
<section class="stats" aria-label="Currently visible documentary counts"><div class="stat"><strong id="record-count">0</strong><span>Visible originals</span></div><div class="stat"><strong id="entity-count">0</strong><span>Evidence nodes</span></div><div class="stat"><strong id="edge-count">0</strong><span>Cited relationship links</span></div><div class="stat"><strong id="unknown-count">0</strong><span>Links with incomplete dimensions</span></div></section>
<main class="workspace" id="workspace"><aside class="sources"><h2 class="sectiontitle">Originals over time</h2><div id="timeline" class="timeline"></div></aside><section class="board" aria-label="Contribution lineage"><div class="boardhead"><h2>Contribution lineage</h2><div class="filters" role="group" aria-label="Filter relationship evidence"><button data-filter="all" aria-pressed="true">All</button><button data-filter="observed" aria-pressed="false">Observed</button><button data-filter="reported" aria-pressed="false">Reported</button><button data-filter="unknown" aria-pressed="false">Unknown</button></div></div><div class="graph"><div class="graphcaption">Source signatures, contributions & artifacts</div><div id="nodes" class="nodes"></div></div><div class="edgearea"><h3 class="sectiontitle">Contribution → uptake evidence</h3><div id="edges"></div></div></section><aside class="detail" aria-label="Selected evidence detail"><div class="detailtop"><div class="eyebrow">Evidence inspector</div><h2 id="detail-title">Select a contribution or link</h2><div id="detail-kind" class="muted"></div></div><div id="detail-body" class="detailbody"></div></aside></main>
<footer class="footer"><span>Observed · original-supported &nbsp; / &nbsp; Reported · attributed account &nbsp; / &nbsp; Unknown · abstention</span><span>Documentary links do not establish causality, misalignment, or swarm size.</span></footer></div>
<script id="replay-data" type="application/json">${json(config)}</script><script>${replayClient.toString()}; replayClient();</script></body></html>`;
}

function replayClient() {
  const { snapshot: initial, apiUrl } = JSON.parse(document.getElementById('replay-data').textContent);
  let state = initial, selected = null, filter = 'all', timer = null, request = 0;
  const get = id => document.getElementById(id);
  const dimensionNames = { write: 'Contribution / write', read: 'Receiver read', use: 'Receiver use', action: 'Subsequent action', producer: 'Producing-agent attribution', permission: 'Information permission', evaluation: 'Evaluation effect', intent: 'Intent', ownership: 'Common ownership', autonomy: 'Autonomy', humanInvolvement: 'Human involvement', novelty: 'Novelty' };
  const time = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;
  const start = time(initial.scope.start), end = time(initial.scope.end);
  const replayable = Boolean(apiUrl) && Number.isFinite(start) && Number.isFinite(end) && end > start;
  const fmt = value => Number.isFinite(time(value)) ? new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC') : 'Time unknown';
  const shortTime = value => Number.isFinite(time(value)) ? new Date(value).toISOString().slice(5, 16).replace('T', ' ') : 'Undated';
  function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function badge(status) { const safe = ['observed', 'reported', 'unknown'].includes(status) ? status : 'unknown'; return el('span', 'pill ' + safe, safe); }
  function newestFirst(a, b) {
    const ms = time(b.availableAt) - time(a.availableAt); if (ms) return ms;
    const fraction = value => (String(value).match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/i)?.[1] || '').slice(3);
    const left = fraction(a.availableAt), right = fraction(b.availableAt), length = Math.max(left.length, right.length);
    return right.padEnd(length, '0').localeCompare(left.padEnd(length, '0'));
  }
  function dimension(item, key) { return state.claims.filter(claim => claim.subjectId === item.id && claim.dimension === key).sort(newestFirst)[0] || item.dimensions?.[key] || null; }
  function edgeStatus(edge) { return ['observed', 'reported', 'unknown'].includes(edge.status) ? edge.status : (dimension(edge, 'use')?.status || dimension(edge, 'read')?.status || 'unknown'); }
  function safeLink(url, record) {
    if (typeof url !== 'string') return null;
    try {
      if (record) { if (!/^\/api\/record\/[^?#]+(?:\?[^#]*)?$/.test(url)) return null; const parsed = new URL(url, location.origin); parsed.searchParams.set('cutoff', state.cutoff); return parsed.pathname + parsed.search; }
      const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null;
    } catch { return null; }
  }
  function citation(record) {
    const card = el('div', 'citation');
    card.append(el('strong', null, record.title || record.originalId || record.id));
    card.append(el('div', 'muted', (record.sourceId || 'Original source') + ' · available ' + fmt(record.availableAt)));
    if (record.eventTime) card.append(el('div', 'muted', 'Event time: ' + fmt(record.eventTime)));
    if (record.timeUncertainty) card.append(el('div', 'muted', 'Timestamp uncertainty: ' + record.timeUncertainty));
    const provenance = el('div', 'hash');
    for (const key of ['originalId', 'line', 'revisionId', 'sha256', 'versionHash']) if (record[key] !== undefined) provenance.append(el('div', null, key + ': ' + record[key]));
    card.append(provenance);
    const links = el('div', 'citationlinks');
    for (const [label, url, local] of [['Raw local record', record.localUrl, true], ['Source explorer ↗', record.sourceUrl, false]]) {
      const href = safeLink(url, local); if (!href) continue; const link = el('a', null, label); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
    }
    card.append(links);
    if (record.imageDataUrl) { const image = el('img', 'original-screenshot'); image.src = record.imageDataUrl; image.alt = 'Original archived screenshot'; image.loading = 'lazy'; card.append(image); }
    if (record.text !== undefined) { const details = el('details'); details.append(el('summary', null, 'Read bounded original text')); details.append(el('pre', null, record.text)); card.append(details); }
    if (record.context !== undefined) { const details = el('details'); details.append(el('summary', null, 'Original context')); details.append(el('pre', null, typeof record.context === 'string' ? record.context : JSON.stringify(record.context, null, 2))); card.append(details); }
    if (record.extractionConfig !== undefined) { const details = el('details'); details.append(el('summary', null, 'Extraction provenance')); details.append(el('pre', null, typeof record.extractionConfig === 'string' ? record.extractionConfig : JSON.stringify(record.extractionConfig, null, 2))); card.append(details); }
    if (record.citation) { const details = el('details'); details.append(el('summary', null, 'Frozen file citation')); details.append(el('pre', null, JSON.stringify(record.citation, null, 2))); card.append(details); }
    return card;
  }
  function inspect(item, kind) {
    selected = { id: item.id, kind };
    get('detail-title').textContent = item.label || item.title || item.originalId || item.id;
    get('detail-kind').textContent = kind === 'record' ? 'Original record · source provenance' : (item.kind || kind) + ' · available ' + fmt(item.availableAt);
    const body = get('detail-body'); body.replaceChildren();
    if (item.synthetic) body.append(el('p', 'synthetic', 'Synthetic fixture — not a research finding.'));
    if (kind === 'record') { body.append(citation(item)); markSelected(); return; }
    if (item.summary) body.append(el('p', 'claimtext', item.summary));
    body.append(el('h3', null, 'Separate evidence dimensions'));
    const list = el('dl', 'dimensions');
    for (const [key, name] of Object.entries(dimensionNames)) {
      const finding = dimension(item, key), row = el('div', 'dimrow'), dd = el('dd');
      row.append(el('dt', null, name)); dd.append(badge(finding?.status)); row.append(dd); list.append(row);
      if (finding?.value || finding?.explanation) list.append(el('p', 'claimtext', [finding.value, finding.explanation].filter(Boolean).join(' · ')));
    }
    body.append(list);
    body.append(el('h3', null, 'Missing links & limits'));
    if (item.missingLinks?.length) for (const missing of item.missingLinks) body.append(el('p', 'missing', missing.description || dimensionNames[missing.dimension] || 'Unresolved evidence link'));
    else body.append(el('p', 'missing', 'Absent dimensions remain unknown. A documentary relationship does not establish a complete transfer chain.'));
    body.append(el('h3', null, 'Cited originals'));
    for (const quoted of item.citations || []) {
      const quote = el('div', 'citation'); quote.append(el('strong', null, quoted.recordId)); quote.append(el('blockquote', 'claimtext', quoted.quote));
      quote.append(el('div', 'hash', 'Body line ' + (quoted.bodyLine ?? 'unknown') + ' · UTF-16 offset ' + (quoted.quoteUtf16Offset ?? 'unknown') + ' · UTF-8 offset ' + (quoted.quoteUtf8Offset ?? 'unknown')));
      body.append(quote);
    }
    const ids = new Set(item.evidenceIds || []);
    for (const key of Object.keys(dimensionNames)) for (const id of dimension(item, key)?.evidenceIds || []) ids.add(id);
    for (const missing of item.missingLinks || []) for (const id of missing.evidenceIds || []) ids.add(id);
    for (const id of ids) { const record = state.records.find(record => record.id === id); if (record) body.append(citation(record)); }
    markSelected();
  }
  function markSelected() { document.querySelectorAll('[data-item]').forEach(node => node.classList.toggle('selected', node.dataset.item === selected?.id)); }
  function draw() {
    get('cutoff-label').textContent = fmt(state.cutoff);
    get('cutoff').setAttribute('aria-valuetext', fmt(state.cutoff));
    get('record-count').textContent = state.records.length;
    get('entity-count').textContent = state.entities.length;
    get('edge-count').textContent = state.edges.length;
    get('unknown-count').textContent = state.edges.filter(edge => ['read', 'use', 'action', 'producer', 'permission', 'evaluation', 'intent'].some(key => !dimension(edge, key) || dimension(edge, key).status === 'unknown')).length;
    const timeline = get('timeline'); timeline.replaceChildren();
    for (const record of state.records) { const button = el('button', 'sourceitem'); button.append(el('time', null, shortTime(record.availableAt))); button.append(el('span', 'recordname', record.title || record.sourceId || 'Original record')); button.append(el('span', 'originalid', record.originalId || record.id)); button.addEventListener('click', () => inspect(record, 'record')); timeline.append(button); }
    if (!state.records.length) timeline.append(el('p', 'empty', 'No dated originals available at this cutoff.'));
    const nodes = get('nodes'); nodes.replaceChildren();
    for (const entity of state.entities) { const node = el('button', 'node'); node.dataset.item = entity.id; node.append(el('small', null, entity.kind || 'Contribution')); node.append(el('strong', null, entity.label || entity.id)); node.append(el('span', 'foot', entity.evidenceIds.length + ' cited original' + (entity.evidenceIds.length === 1 ? '' : 's'))); node.addEventListener('click', () => inspect(entity, 'entity')); nodes.append(node); }
    if (!state.entities.length) nodes.append(el('p', 'empty', 'No cited contribution nodes yet. Advance the availability cutoff to inspect the frozen slice.'));
    const edges = get('edges'); edges.replaceChildren();
    const visibleEdges = state.edges.filter(edge => filter === 'all' || edgeStatus(edge) === filter);
    for (const edge of visibleEdges) {
      const button = el('button', 'edge'); button.dataset.item = edge.id; const path = el('div', 'edgepath');
      path.append(el('span', null, state.entities.find(entity => entity.id === edge.from)?.label || edge.from)); path.append(el('span', 'arrow', '→')); path.append(el('span', null, state.entities.find(entity => entity.id === edge.to)?.label || edge.to)); button.append(path);
      const bottom = el('div', 'edgebottom'); bottom.append(badge(edgeStatus(edge))); bottom.append(el('span', null, edge.label || edge.kind || 'Cited relationship')); button.append(bottom); button.addEventListener('click', () => inspect(edge, 'edge')); edges.append(button);
    }
    if (!visibleEdges.length) edges.append(el('p', 'empty', filter === 'all' ? 'No cited relationship links at this cutoff. Unsupported links are omitted.' : 'No links with this evidence status at this cutoff.'));
    if (selected) { const collection = selected.kind === 'record' ? state.records : selected.kind === 'edge' ? state.edges : state.entities; const item = collection.find(item => item.id === selected.id); if (item) inspect(item, selected.kind); else { selected = null; get('detail-title').textContent = 'Select a contribution or link'; get('detail-kind').textContent = ''; get('detail-body').replaceChildren(el('p', 'muted', 'The earlier cutoff hides this evidence. Select a visible item to inspect its originals.')); } }
    else get('detail-body').replaceChildren(el('p', 'muted', 'Choose a contribution, relationship, or timeline record. Source citations, separate evidence dimensions, and unresolved links appear here.'));
    markSelected();
  }
  function stop() { clearInterval(timer); timer = null; get('play').textContent = '▶ Play replay'; get('play').setAttribute('aria-pressed', 'false'); }
  async function load(value) {
    const version = ++request;
    const cutoff = new Date(start + (end - start) * value / 1000).toISOString();
    // Rewind must clear future content synchronously, before a network response arrives.
    if (time(cutoff) < time(state.cutoff)) { state = { ...state, cutoff, records: [], entities: [], edges: [], claims: [], diagnostics: [] }; draw(); }
    get('cutoff-label').textContent = fmt(cutoff);
    try { const url = new URL(apiUrl, location.href); url.searchParams.set('cutoff', cutoff); const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error('Replay request failed (' + response.status + ')'); const next = await response.json(); if (version !== request) return; state = next; get('notice').textContent = ''; draw(); }
    catch { if (version !== request) return; stop(); get('notice').textContent = 'Unable to load this cutoff. Move the slider to retry; unavailable evidence stays hidden.'; get('cutoff-label').textContent = fmt(state.cutoff); get('cutoff').value = Math.round((time(state.cutoff) - start) / (end - start) * 1000); }
  }
  get('scope').textContent = (initial.scope.label || 'Frozen archive slice') + '\n' + (initial.scope.timezone || 'UTC');
  get('start-label').textContent = shortTime(initial.scope.start); get('end-label').textContent = shortTime(initial.scope.end);
  get('cutoff').value = replayable ? Math.max(0, Math.min(1000, Math.round((time(initial.cutoff) - start) / (end - start) * 1000))) : 0;
  get('cutoff').disabled = !replayable; get('play').disabled = !replayable; get('reset').disabled = !replayable;
  get('mode-label').textContent = replayable ? 'Local replay · server gates original access' : 'Static snapshot · cutoff fixed';
  get('cutoff').addEventListener('input', () => { stop(); if (replayable) load(Number(get('cutoff').value)); });
  get('reset').addEventListener('click', () => { stop(); get('cutoff').value = 0; load(0); });
  get('play').addEventListener('click', () => { if (timer) { stop(); return; } get('play').textContent = 'Ⅱ Pause replay'; get('play').setAttribute('aria-pressed', 'true'); timer = setInterval(() => { const value = Math.min(1000, Number(get('cutoff').value) + 10); get('cutoff').value = value; load(value); if (value >= 1000) stop(); }, 850); });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(other => other.setAttribute('aria-pressed', String(other === button))); draw(); }));
  draw();
}
