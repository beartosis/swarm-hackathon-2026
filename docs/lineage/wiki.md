# Frozen June 16 wiki contribution lineage

This is a known historical demonstration of the Maids task-sequence family, not discovery or evidence of generalization. It runs separately from the existing catalog and pipeline. `src/lineage/wiki.py` reads the locally supplied originals without changing them.

## Fixed scope and provenance

The reference entry identified `dse/DataUSAMaidsWageSequenceCollabOct21`. Its revision 2 explicitly names `DataUSAMaidsWageSequenceCollabSep21`. A metadata/link-only pass followed recursively explicit links matching `DataUSAMaidsWageSequenceCollab*` within the same wiki, confined to June 16, 2026 UTC. No additional eligible family links appeared. The scope was written before motif judgment and cannot be overwritten by `freeze`.

The frozen inventory is exactly those two pages and 26 revisions with source times in `[2026-06-16T00:00:00Z, 2026-06-17T00:00:00Z)`. The scope hash is `aaf45f4d8a459396eb5fb30e5cdf9ca51da4e836432a80cb396c43ac7e693c77`. An extraction pass subsequently streamed all pages, revisions and events, selecting two retrospective page records, all 26 frozen revisions and their 26 save events. Later deletion events are excluded.

Each original is identified by compressed input-file SHA256, original decompressed JSONL line and line hash. Revision citations additionally include the body/version hash, body line, exact quote, UTF-8 and UTF-16 offsets, source time, time grade and uncertainty. All four existing reference-line and body hashes are verified against the originals. Extraction refuses changed input bytes or a missing/changed frozen version. `scope.json` records the hashes, exact inventory, explicit link origins and extraction bounds.

The request-log time is evidence of the source-reported post time, with source uncertainty of one second. Task-clock narration, guessed intervals and the claimed clock conversion are separate assertions. `archived_at` is a later preservation time, sometimes June 26, and does not establish original publication at that time. Page-summary metadata is retrospective and cannot supply historical identities or end-state information.

## Evidence and limits

The first investigator assessment contains 11 explicitly cited **reported** acknowledgement, timing-comparison, named-variant-comparison, request-follow-through or relative-progress links. The selected three-signature fanout is provisional: OpenAIWatcherJul07's deadline-variant report in Sep21 revision 6 is explicitly compared by MaidsWatcherDec03 in revision 9 and OurMaidsCoordOct11 in revision 14. The gate evaluates reported comparison/coordination propagation, and independent review can reject whether these comparisons meet the uptake rubric. The initial investigator finding is not silently upgraded to observed answer transfer.

Contribution origin versions are exact, but the receiver's fetched revision is unknown. A later named comparison does not reveal whether the receiver read revision 6, an intervening snapshot, or another source. The gate requires three participating source signatures and two connected directed links sharing an origin version for fanout, or an exact intermediate version for a relay. Two signatures exchanging many messages do not pass.

There are 15 export labels. These are source signatures, not independently authenticated producing agents, separate operators or an evidenced swarm size. One record's label is `AgentResearcherXYZ` while its text signs `AgentResearcherOct06`; the assessment preserves this as a textual reported alias with exact citations, without creating another agent or authenticating a producer.

There are zero receiver-read records and zero observed external-action records in this packet. Saves support wiki writes, and some bodies report answers; they do not show external answer execution or evaluation scores. Benchmark permission boundaries, evaluation effects, common ownership, autonomy and human involvement remain unknown. Intent is limited to reported anticipatory sharing; forbidden coordination and evaluator manipulation are unestablished. The independently evidenced producer lower bound remains null/unknown.

There are no identical complete revision bodies. The same timing paragraph appears as a fresh addition in Oct21 revision 4 and is copied into Sep21 revision 3; its second appearance is flagged by exact segment hash and is not an independent contribution. Other inherited page text is not repeatedly treated as a new write. Explicit evidence-limit examples preserve repeated signatures, common-source reuse, simultaneous first versions, ordinary collaboration and chronology-incompatible transfer. A matching `22140` answer between the early series and the final Jul17 report remains an abstained chain: public DataUSA data and independent work are alternatives, and source attribution/read/external execution are absent. Later prompt uptake remains bounded/right-censored.

## Artifacts and replay

All run artifacts reside in `output/lineage-build-20261003/wiki/`:

- `scope.json`: frozen page/version inventory and original input hashes.
- `source-records.jsonl`: auditable original-line metadata, version hashes, added segments and copy flags.
- `neutral-packet.json`: full original records with provenance for authorized **local** independent review; no investigator verdicts, arm membership or ranks.
- `assessment.json`: frozen initial investigator edges, dimensions, motif finding, identity bridge, counterexamples and missingness.
- `investigator-freeze.json`: hashes preserving the initial scope, neutral packet, assessment and replay bundle before review reconciliation.
- `replay-bundle.json`: root's agreed replay schema, brief added-text excerpts, signatures, cited reported edges and one abstained answer link.
- `artifact-hashes.json`: extraction artifact checksums; later documentation/test files are outside this extraction inventory.

The restricted primary bodies stay local; the public demo must not redistribute the neutral packet or primary exports. Replay excerpts are at most 240 characters per revision and full original citations remain pointers to the local source.

Replay is an explicitly retrospective reconstruction of what evidence was available. An interpretation edge becomes visible at the latest original citation time necessary to form it. `assessedAt` separately records the later investigator time. Endpoint signatures and all supporting originals must already be visible. Future revisions, future metadata and future-derived original content cannot enter a historical cutoff. Unknown/context assessments made from the whole packet remain available only at their later assessment time. Tests enforce the latest-cited-original time invariant and verify that no first-edge interpretation appears before its consumer report.

## Reproduction and cost

Use the bundled Python executable if `python` is absent from PATH. In a new output directory under the run, perform `freeze` before `extract`:

```powershell
& 'python' src/lineage/wiki.py freeze --out output/lineage-build-20261003/wiki/reproduce
& 'python' src/lineage/wiki.py extract --out output/lineage-build-20261003/wiki/reproduce
& 'python' -m unittest discover -s test/lineage -p test_wiki.py -v
```

Do not rerun extraction into the initial frozen directory after review begins. New runs intentionally have different run timestamps and measured costs; their original inventory/line/body/input hashes should match. Six tests pass, including fixture-based scope exclusion/immutability and negative motif cases, plus frozen original quote/hash/cutoff verification.

Extraction scanned 4,579 page rows, 14,591 revision rows and 19,913 event rows in approximately 0.23 seconds on this machine. The link/inventory freeze cost is recorded separately in the scope; investigator interpretation and independent review are additional work, not included in this CPU duration. Collection used already supplied originals, with no network requests, no remote deployment and no ComputeHelper job. Retrieval dates remain unknown; analysis does not invent them. The restricted packet is approximately a few hundred kilobytes, so local execution was suitable.

The completion claim is reproducible bounded evidence extraction and a reviewable lineage demo. Scientific success remains conditional on source-supported uptake/motif adjudication. Large misaligned swarm identification, unauthorized transfer, evaluation manipulation, causal effects and unfamiliar-source generalization are not established by this work.

## QA amendment after the initial freeze

The original artifact bytes remain unchanged. `output/lineage-build-20261003/wiki/qa-amendment.json` audits all 24 initial edge/identity-bridge citations and records two location corrections: `wiki-uptake-10`'s `Mar03` quote in Sep21 revision 19 belongs to fresh body line 54 rather than inherited line 37; the reported `AgentResearcherOct06` signature in Sep21 revision 13 belongs to fresh line 41 rather than inherited line 34. Their corrected offsets are preserved in that separate amendment. No originally asserted quote was accepted from a copied added segment in this historical edge/bridge audit. Source records, version hashes, signatures, times, counts and motif edges 4/6 are unchanged. This software audit does not replace independent semantic review.

The extractor now selects a noncopied added segment and uses its original body line to calculate quote offsets. It rejects copied-origin attribution. Future emitted local replay bundles contain full frozen body text, direct source/local URLs, decompressed line, revision ID and allowlisted extraction provenance, including compressed-file hash and exact edge-quote citations. These bundles are restricted local research material; the original excerpt bundle remains preserved separately. Write/action dimensions use `observed` only for archived wiki writes; external execution remains unknown. Missing links are cited objects with their own availability time. Retrospective context is explicit, and any dimension claims use supported replay names/statuses, a real artifact-family subject and original evidence IDs.

Ten wiki tests and all seven synthetic extraction QA checks pass after repair. Extraction now refuses any directory containing `investigator-freeze.json`, so a default rerun cannot overwrite the initial artifacts. A separate re-extraction at `wiki/qa-reextract/` reuses the exact frozen scope bytes, produces the corrected future schema and does not replace any initial artifact. Its projection through the current replay retains all 26 original records, 12 relationships (11 reported plus one abstained), write/read/action distinctions, timed missing links and direct provenance. The regression logs are `wiki-tests-after.txt`, `qa-extraction-after.txt` and `qa-schema-projection-after.txt`; the original failure logs remain in the separate QA directory. Node on this restricted Windows host requires `--preserve-symlinks --preserve-symlinks-main` for these module imports.
