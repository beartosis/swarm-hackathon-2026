# Evidence lineage replay

`replayAt(bundle, cutoff)` is a pure conservative projection. `renderReplayHtml(bundle, { apiUrl: '/api/replay', cutoff })` returns a dependency-free dashboard. Serve it locally alongside an endpoint that returns the projection, and a record endpoint that independently applies the same cutoff. HTML contains only the initial snapshot: subsequent originals are fetched when the reviewer advances time. A static export supports its initial cutoff only; embedding the full archive would violate the replay contract.

The version 1 bundle has static scope metadata and four evidence-bearing collections:

```js
{
  schemaVersion: 1,
  title: 'AI Village · bounded archive review', // scope, never a future outcome
  scope: { start: '2026-04-06T07:00:00Z', end: '2026-04-13T07:00:00Z',
    label: 'April 6–12, 2026', timezone: 'America/Los_Angeles' },
  records: [{ id: 'original-1', availableAt: '2026-04-06T08:00:00Z',
    eventTime: '2026-04-06T08:00:00Z', sourceId: 'archive source',
    originalId: 'revision or line ID', text: 'Original bounded evidence',
    sha256: 'frozen file hash', versionHash: 'version hash',
    sourceUrl: 'https://original-source.example/record',
    localUrl: '/api/record/original-1', evidenceType: 'original' }],
  entities: [{ id: 'contribution-1', kind: 'contribution',
    label: 'A source-attributed contribution', availableAt: '2026-04-06T08:00:00Z',
    evidenceIds: ['original-1'], dimensions: {
      producer: { status: 'unknown', value: 'Registry signature only',
        availableAt: '2026-04-06T08:00:00Z', evidenceIds: ['original-1'] }
    } }],
  edges: [], claims: []
}
```

Every entity, edge, dimension, missing-link explanation and claim requires a valid `availableAt` and nonempty `evidenceIds`. Availability cannot precede any cited original. Unavailable or missing citations fail closed; an edge also requires both endpoints to be visible. Missing timestamps do not enter the replay. Duplicate IDs among currently available items are ambiguous and are omitted. Future duplicates do not alter earlier snapshots. Unknown extra metadata is dropped rather than copied into the browser.

Source availability with submillisecond precision rounds upward to the next millisecond; requested cutoffs round downward. This deliberately permits a delay below one millisecond rather than leaking an original through JavaScript timestamp truncation. Citation chronology compares the original fractional digits exactly, so two sources within the same millisecond cannot be reversed by rounding.

Entities have `id`, `kind`, `label`, optional `summary`, `availableAt`, `evidenceIds`, optional `versionHash`, `dimensions`, and `missingLinks`. Edges add `from`, `to`, `kind`, optional `status`, `label`, and `summary`. The root `availableAt` applies to every root label and summary; a later producer attribution or interpretation must be a separately timed claim, never a retroactive rewrite. Claims have `id`, `subjectId` (entity or edge), `dimension`, `status`, `value`, optional `explanation`, `availableAt`, `evidenceIds`. Missing links have `dimension`, `description`, `availableAt`, and `evidenceIds`; plain undated strings are omitted.

Dimensions are `write`, `read`, `use`, `action`, `producer`, `permission`, `evaluation`, `intent`, `ownership`, `autonomy`, `humanInvolvement`, and `novelty`. Status is `observed`, `reported`, or `unknown`. Absent dimensions display a generic unknown label without asserting specific missing evidence. These dimensions remain separate: a reported uptake edge is not producer authentication, permission violation, evaluation impact, intent, or causality. Source signatures must not be rendered as counts of independently evidenced agents.

Records preserve original identifiers, file/version hashes, source and local links, event time, availability time, uncertainty, and extraction configuration when supplied. The renderer escapes untrusted text and permits HTTP(S) source links and local `/api/record/` links only. Raw local links carry the active cutoff. Do not put unrestricted archive download URLs in `localUrl`; serve only the approved bounded originals and enforce source terms separately.

Optional record `citation` preserves the frozen file path, compressed and decompressed-line hashes, decompressed JSONL line, source URL, record/version identifiers and hash scope. Optional edge `citations` adds literal `quote`, `bodyLine`, `quoteUtf16Offset`, `quoteUtf8Offset`, `jsonPointer`, `versionTime`, timestamp grade and uncertainty. A quoted citation must reference a visible original in the relationship's `evidenceIds`, its quote must occur in the original, supplied version hashes must match, and supplied UTF-16/UTF-8 positions must match the exact original text. The inspector renders these quotes with their locations alongside full cited originals. Invalid quote metadata is omitted; this mechanical validation is not semantic adjudication of the relationship.

`extractionConfig` is allowlisted frozen provenance only: file/code/config hashes, path, context bounds, hash/text scopes and content policy. Record-level `edgeQuotes` and arbitrary nested metadata are omitted, because later relationship selection must not appear in an earlier original's provenance. Quote selection belongs to the independently gated edge. Collection/export metadata is not a historical interpretation.

Optional original screenshot `imageDataUrl` accepts canonical nonempty base64 PNG/JPEG only, validates the corresponding file signature, and caps decoded content at 4 MiB. SVG and remote URLs are rejected. Pixels share the original record's availability gate: future screenshots are absent from the initial HTML and from earlier API snapshots. Selecting a cited screenshot displays its original pixels alongside hashes and citations in the inspector.

The dashboard shows originals, contributions, and cited links currently visible. Its counts are documentary counts, never swarm size or scientific-success metrics. No asserted edge without original citations is displayed. Diagnostics use generic reasons without rejected IDs or text. The title and scope are trusted static inputs and must not encode end-state findings. Synthetic fixtures are explicitly labelled; no synthetic finding is shipped as archive evidence.
