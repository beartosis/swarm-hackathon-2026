import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function enrichWiki(bundle, neutral) {
  const originals = new Map(neutral.records.map(row => [row.citation.recordId, row]));
  return {...bundle, records: bundle.records.map(record => {
    const source = originals.get(record.id);
    if (!source || typeof source.original.body !== 'string') throw new Error(`Missing original revision body: ${record.id}`);
    const bodyHash = createHash('sha256').update(source.original.body).digest('hex');
    if (bodyHash !== record.versionHash || source.citation.rawLineSha256 !== record.sha256) throw new Error(`Original hash mismatch: ${record.id}`);
    return {...record, text: source.original.body, localUrl: '/api/record/' + encodeURIComponent(record.id),
      sourceUrl: 'https://collusion.wiki/explorer', line: source.citation.decompressedJsonlLine,
      revisionId: record.id, evidenceType: 'Original revision body; retrospective interpretation is labelled separately',
      extractionConfig: {sourcePath: source.citation.path, compressedFileSha256: source.citation.compressedFileSha256,
        rawLineSha256: source.citation.rawLineSha256, bodySha256: bodyHash,
        hashScope: 'UTF-8 original body; line hash excludes terminator',
        contentPolicy: 'Full original body, local research only. Export-time page metadata excluded from historical replay.'}};
  })};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [bundlePath, neutralPath, output] = process.argv.slice(2);
  if (!output) throw new Error('Usage: assemble.mjs BUNDLE NEUTRAL_PACKET OUTPUT');
  const [bundle, neutral] = await Promise.all([bundlePath, neutralPath].map(async path => JSON.parse(await readFile(path, 'utf8'))));
  const result = enrichWiki(bundle, neutral);
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({output, records: result.records.length, edges: result.edges.length}));
}
