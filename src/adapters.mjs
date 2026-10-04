import {createReadStream} from 'node:fs';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
import {createHash} from 'node:crypto';

export const digest = value => createHash('sha256').update(value).digest('hex');
export function redact(text) {
  return String(text ?? '').replace(/rubygems_[a-zA-Z0-9]{16,}/g, '[REDACTED_REGISTRY_KEY]')
    .replace(/\b(?:ghp|github_pat|sk_live)_[a-zA-Z0-9_]{16,}/g, '[REDACTED_KEY]');
}
export function extractRefs(text) {
  return [...new Set((text.match(/https?:\/\/[^\s<>"'`\]\[{}]+/g) || []).map(s => s.replace(/[.,;!?)]+$/, '')).filter(s => s.length <= 2048))];
}
export async function* readJsonLines(path) {
  const file = createReadStream(path);
  const stream = path.endsWith('.gz') ? file.pipe(createGunzip()) : file;
  const lines = createInterface({input:stream, crlfDelay:Infinity});
  let number = 0;
  try {
    for await (const line of lines) {
      number++;
      if (!line.trim()) continue;
      try { yield JSON.parse(line); }
      catch { throw new Error(`Invalid JSON at ${path}:${number}`); }
    }
  } finally { lines.close(); stream.destroy(); file.destroy(); }
}

export function wikiObservation(row) {
  const body = String(row.body ?? '');
  const lines = body.split('\n');
  // b0/b1 are zero-based, half-open line ranges in the NEW body.
  const ranges = Array.isArray(row.hunks) ? row.hunks.filter(h => ['insert','replace'].includes(h.op)) : null;
  const inserted = ranges ? ranges.map(h => lines.slice(h.b0,h.b1).join('\n')).join('\n') : body;
  const text = redact(inserted);
  return {
    id:`wiki:${row.rev_id}`, source:`wiki:${row.wiki}`, sourceUrl:'https://collusion.wiki/explorer',
    sourceClass:'known-campaign', actor:row.label || null, time:row.time || null,
    timeGrade:row.time_grade || 'unknown', text, artifact:row.page_id,
    refs:extractRefs(text), metadata:{role:'activity', knownCorpus:true, revisionId:row.rev_id,
      pageKey:row.page_key, sequence:row.seq, uncertaintySeconds:row.uncertainty_seconds ?? null,
      diffBase:row.diff_base, diffBaseReason:row.diff_base_reason, textScope:ranges?'inserted-lines':'full-body-fallback',
      sourceBodySha256:row.body_sha256 || digest(body), insertedSha256:digest(inserted),
      caution:'A known corpus contains human and uncertain activity too; handles are not verified identities.'}
  };
}

export async function importWiki(path, {limit=Infinity}={}) {
  const observations=[]; let read=0, empty=0;
  for await (const row of readJsonLines(path)) {
    if (read++ >= limit) break;
    const o=wikiObservation(row);
    if (!o.text.trim()) {empty++;continue;}
    observations.push(o);
  }
  return {observations,stats:{read:Math.min(read,limit),empty,imported:observations.length}};
}

export function normalizeObservation(row, index=0) {
  if (!row || typeof row !== 'object' || typeof row.text !== 'string') throw new Error(`Observation ${index} requires string text`);
  const text=redact(row.text);
  const allowed=['known-campaign','known-agent','background','unreviewed'];
  return {...row, id:row.id || `import:${digest(JSON.stringify(row)).slice(0,20)}`,
    source:row.source || 'external-import', sourceUrl:row.sourceUrl || null,
    sourceClass:allowed.includes(row.sourceClass)?row.sourceClass:'unreviewed',
    actor:row.actor || null,time:row.time || null,timeGrade:row.timeGrade || 'unknown',text,
    artifact:row.artifact || null,refs:[...new Set([...extractRefs(text),...(Array.isArray(row.refs)?row.refs:[]).filter(ref=>typeof ref==='string' && text.includes(ref))])],metadata:{...row.metadata,role:row.metadata?.role || 'activity'}};
}

export function rubyObservation(gem, {query, retrievedAt, knownNames=new Set()}={}) {
  const name=String(gem.name || '');
  const text=redact([`Package: ${name}`,`Version: ${gem.version || ''}`,`Authors (self-declared): ${gem.authors || ''}`,
    `Description: ${gem.info || ''}`,`Metadata: ${JSON.stringify(gem.metadata || {})}`,
    `Homepage: ${gem.homepage_uri || ''}`,`Source: ${gem.source_code_uri || ''}`].join('\n'));
  return {id:`rubygems:${name}@${gem.version}`,source:'rubygems',sourceUrl:`https://rubygems.org/gems/${encodeURIComponent(name)}`,
    sourceClass:knownNames.has(name)?'known-campaign':'unreviewed',
    actor:null,time:gem.version_created_at || null,timeGrade:gem.version_created_at?'source-reported':'unknown',
    text,artifact:`rubygems:${name}@${gem.version}`,refs:extractRefs(text),metadata:{role:'activity',query,retrievedAt,
      packageName:name,version:gem.version,authors:gem.authors || null,
      caution:'Authors are free-text claims; package names are not distinct agents. Absence from the reference inventory does not establish novelty.'}};
}
