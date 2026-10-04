/** Pure, conservative projection of a frozen evidence bundle at an availability cutoff. */
const DIMENSIONS = new Set(['write', 'read', 'use', 'action', 'producer', 'permission', 'evaluation', 'intent', 'ownership', 'autonomy', 'humanInvolvement', 'novelty']);
const STATUSES = new Set(['observed', 'reported', 'unknown']);
const CITATION_FIELDS = ['path', 'sourceUrl', 'decompressedJsonlLine', 'rawLineSha256', 'rawLineHashScope', 'compressedFileSha256', 'recordId', 'versionSha256', 'jsonPointer', 'bodyLine', 'quote', 'quoteUtf16Offset', 'quoteUtf8Offset', 'versionTime', 'timeGrade', 'uncertaintySeconds'];
const EXTRACTION_FIELDS = ['path', 'sourcePath', 'fileSha256', 'compressedFileSha256', 'rawLineSha256', 'decompressedJsonlLine', 'versionSha256', 'bodySha256', 'hashScope', 'textScope', 'contentPolicy', 'codePath', 'codeSha256', 'configSha256', 'contextStart', 'contextEnd', 'screenshotSourcePath', 'screenshotEntry', 'screenshotTarSha256', 'screenshotEntrySha256'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
function validImageDataUrl(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 32) return false;
  const match = value.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length % 4 !== 0) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[2]) return false;
  if (match[1] === 'png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
}
const parseTime = value => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
// Date.parse truncates ISO fractional seconds after milliseconds. Never round a
// source into an earlier replay cutoff; preserve exact fractions for citation order.
const timeParts = value => {
  const parsed = parseTime(value);
  const ms = Math.floor(parsed);
  const fraction = typeof value === 'string' ? (value.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/i)?.[1] || '').slice(3).replace(/0+$/, '') : (parsed - ms).toFixed(12).slice(2).replace(/0+$/, '');
  return { ms, fraction };
};
const sourceTime = value => { const { ms, fraction } = timeParts(value); return ms + (fraction ? 1 : 0); };
const compareTimes = (a, b) => {
  const left = timeParts(a), right = timeParts(b);
  if (left.ms !== right.ms) return left.ms - right.ms;
  const digits = Math.max(left.fraction.length, right.fraction.length);
  return left.fraction.padEnd(digits, '0').localeCompare(right.fraction.padEnd(digits, '0'));
};
const unique = values => [...new Set(values)];
const strings = values => Array.isArray(values) ? unique(values.filter(value => typeof value === 'string')) : [];
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));

export function replayAt(bundle, cutoff) {
  const time = Math.floor(parseTime(cutoff));
  if (!Number.isFinite(time)) throw new TypeError('Replay cutoff must be a valid timestamp.');
  const diagnostics = [];
  const available = value => Number.isFinite(sourceTime(value?.availableAt)) && sourceTime(value.availableAt) <= time;
  const duplicateIds = items => {
    const counts = new Map();
    for (const item of items) if (typeof item?.id === 'string') counts.set(item.id, (counts.get(item.id) || 0) + 1);
    return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id));
  };
  const recordInput = Array.isArray(bundle?.records) ? bundle.records : [];
  const duplicateRecords = duplicateIds(recordInput.filter(available));
  const records = recordInput.filter(record => available(record) && typeof record.id === 'string' && !duplicateRecords.has(record.id))
    .map(record => {
      const projected = pick(record, ['id', 'availableAt', 'eventTime', 'timeUncertainty', 'sourceId', 'originalId', 'sourceUrl', 'localUrl', 'title', 'text', 'sha256', 'versionHash', 'line', 'revisionId', 'evidenceType', 'synthetic', 'context', 'textScope']);
      if (record.citation && typeof record.citation === 'object') projected.citation = pick(record.citation, CITATION_FIELDS.filter(field => !['quote', 'bodyLine', 'quoteUtf16Offset', 'quoteUtf8Offset'].includes(field)));
      if (record.extractionConfig && typeof record.extractionConfig === 'object') projected.extractionConfig = pick(record.extractionConfig, EXTRACTION_FIELDS);
      if (validImageDataUrl(record.imageDataUrl)) projected.imageDataUrl = record.imageDataUrl;
      return projected;
    });
  records.sort((a, b) => compareTimes(a.availableAt, b.availableAt) || a.id.localeCompare(b.id));
  const recordMap = new Map(records.map(record => [record.id, record]));
  const cited = item => {
    const refs = strings(item.evidenceIds);
    return refs.length > 0 && refs.every(id => recordMap.has(id)) && refs.every(id => compareTimes(recordMap.get(id).availableAt, item.availableAt) <= 0);
  };
  const dimensions = (input, parent) => {
    const output = {};
    for (const [dimension, value] of Object.entries(input || {})) {
      if (!DIMENSIONS.has(dimension) || !value || !STATUSES.has(value.status) || !available(value)) continue;
      const refs = strings(value.evidenceIds);
      // Unknown is an abstention; a specific explanation still needs contextual evidence.
      if (!cited(value) || !refs.every(id => parent.evidenceIds.includes(id) || recordMap.has(id))) continue;
      output[dimension] = { ...pick(value, ['status', 'value', 'availableAt', 'explanation']), evidenceIds: refs };
    }
    return output;
  };
  const project = (items, kind) => {
    const input = Array.isArray(items) ? items : [];
    const duplicates = duplicateIds(input.filter(available));
    const result = [];
    for (const item of input) {
      if (!available(item) || typeof item.id !== 'string') continue;
      if (duplicates.has(item.id) || !cited(item)) {
        diagnostics.push({ kind, reason: duplicates.has(item.id) ? 'ambiguous-id' : 'missing-or-unavailable-citation' });
        continue;
      }
      const projected = { ...pick(item, kind === 'entity' ? ['id', 'kind', 'label', 'summary', 'availableAt', 'versionHash', 'synthetic'] : ['id', 'from', 'to', 'kind', 'label', 'summary', 'availableAt', 'status', 'synthetic']), evidenceIds: strings(item.evidenceIds) };
      projected.dimensions = dimensions(item.dimensions, projected);
      projected.citations = (Array.isArray(item.citations) ? item.citations : []).filter(citation => {
        const record = recordMap.get(citation?.recordId);
        if (!record || !projected.evidenceIds.includes(citation.recordId) || typeof citation.quote !== 'string' || !citation.quote || typeof record.text !== 'string' || !record.text.includes(citation.quote)) return false;
        if (citation.versionSha256 && record.versionHash && citation.versionSha256 !== record.versionHash) return false;
        if (citation.versionTime && (!Number.isFinite(parseTime(citation.versionTime)) || compareTimes(citation.versionTime, item.availableAt) > 0)) return false;
        if (citation.quoteUtf16Offset !== undefined) {
          if (!Number.isSafeInteger(citation.quoteUtf16Offset) || citation.quoteUtf16Offset < 0 || record.text.slice(citation.quoteUtf16Offset, citation.quoteUtf16Offset + citation.quote.length) !== citation.quote) return false;
          if (citation.quoteUtf8Offset !== undefined && new TextEncoder().encode(record.text.slice(0, citation.quoteUtf16Offset)).length !== citation.quoteUtf8Offset) return false;
        }
        return true;
      }).map(citation => pick(citation, CITATION_FIELDS));
      // Explanations are evidence-bearing metadata, not a place for future conclusions.
      projected.missingLinks = (Array.isArray(item.missingLinks) ? item.missingLinks : [])
        .filter(link => typeof link === 'object' && available(link) && cited(link))
        .map(link => ({ ...pick(link, ['dimension', 'description', 'availableAt']), evidenceIds: strings(link.evidenceIds) }));
      result.push(projected);
    }
    return result;
  };
  const entities = project(bundle?.entities, 'entity');
  const entityIds = new Set(entities.map(entity => entity.id));
  const edges = project(bundle?.edges, 'edge').filter(edge => {
    if (entityIds.has(edge.from) && entityIds.has(edge.to)) return true;
    diagnostics.push({ kind: 'edge', reason: 'missing-or-unavailable-endpoint' });
    return false;
  });
  const subjects = new Set([...entityIds, ...edges.map(edge => edge.id)]);
  const claimInput = Array.isArray(bundle?.claims) ? bundle.claims : [];
  const duplicateClaims = duplicateIds(claimInput.filter(available));
  const claims = claimInput.filter(claim => available(claim) && typeof claim.id === 'string' && !duplicateClaims.has(claim.id) && DIMENSIONS.has(claim.dimension) && STATUSES.has(claim.status) && subjects.has(claim.subjectId) && cited(claim))
    .map(claim => ({ ...pick(claim, ['id', 'subjectId', 'dimension', 'status', 'value', 'explanation', 'availableAt']), evidenceIds: strings(claim.evidenceIds) }));
  return {
    schemaVersion: 1,
    title: bundle?.title || 'Evidence lineage replay',
    scope: pick(bundle?.scope || {}, ['start', 'end', 'label', 'timezone', 'synthetic']),
    cutoff: new Date(time).toISOString(),
    records, entities, edges, claims, diagnostics,
  };
}

export { DIMENSIONS as REPLAY_DIMENSIONS };
