# Swarm watch: inexpensive automated candidate retrieval

North star: discover and substantiate multi-agent coordination in unfamiliar public populations. Local archive scans are calibration, not discoveries. Shared ownership and initial human goals are compatible with swarms. Distinct handles do not establish distinct producing agents.

## Run locally

No additional libraries, GPU, model API or credentials are required.

```powershell
node --max-old-space-size=768 src/swarm-watch-cli.mjs --village --out output/swarm-watch-NEW-RUN --window-days 7 --min-actors 10 --top 20
node src/swarm-watch-cli.mjs --serve --out output/swarm-watch-NEW-RUN --port 4186
```

For wild-source records, use Buzzer's JSONL observation format and omit `--village`:

```powershell
node src/swarm-watch-cli.mjs --input my-public-observations.jsonl --out output/swarm-watch-WILD-RUN
```

Each observation needs `id`, `source`, `actor`, `artifact` (thread/workspace scope), `text` and a timestamp with a zone in `time`. Preserve stable actor IDs; keep adapters separate from inference. Optional `metadata.replyToId` supplies a captured parent record ID; `metadata.speakerType: "user"` identifies human context. Reports and quoted observations are skipped. Generic actor identities remain unresolved unless an adapter supplies a documented `metadata.agentIdentityBasis`.

Run directories must be new. Inputs and any Village agent registry are hashed before and after scanning. Source record provenance stores physical JSONL line numbers and SHA-256 of `JSON.stringify(parsedRecord)`; this is a parsed-record digest, not an original-line byte digest. The input-file hash binds the original compressed or plain bytes. Runs fail if an input changes or a window exceeds its record budget. Partitions remain local for inspection.

## What the prototype does

It streams the input twice: first to inventory actor names and coverage, then to extract compact features into daily disk partitions. Export order is irrelevant: bounded windows are sorted chronologically. A seven-day window advances one day at a time; individual transfer hypotheses must be at most 48 hours apart. A maximum 100,000 records/window stops the scan instead of silently truncating it.

An interaction network uses captured cross-actor reply routes, or addressed uptake claims sharing an exact specific URL/path with an earlier message from the named actor. Ambiguous display names, self-replies, identical replay text, quoted lines and code fences cannot create addressed uptake edges. Humans remain context and do not form agent-network bridges. Accounts are scoped to each source/workspace for graph construction.

Shared-artifact activity is queued separately and never merges interaction components. A common URL alone is not communication evidence. Paths are workspace-local; unrelated rooms/repositories are not merged. Sensitive query URLs, generic homepages and common search URLs are excluded. Matching is lexical and unvalidated. Edges are hypotheses; model review must examine surrounding text and distinguish claims from action evidence.

The ranking favors interaction networks, then actor-label count and bounded edge count. It is not a probability model. Overlapping windows with the same actor set/scope compete for one queue position. This also means distinct episodes with exactly the same actor set can be collapsed; a future episode index must retain them independently.

## Outputs and model roles

- `index.html`: expandable network diagrams, observed identities, excerpts and limitations, with a lead-type filter.
- `scan.json`: configuration, coverage, timings, sampled RSS, input provenance, graph edges and selected records.
- `review-queue.jsonl`: bounded model handoff records with evidence-line pointers and hashes. Excerpts are a triage packet, not complete context; all evidence lines remain listed.
- `partitions/`: compact local features. Raw inputs remain the original evidence.

No model or external collection calls are made by this prototype. Proposed model workflow:

1. Luna proposes sources/searches and triages packets under fixed token and request budgets. Deterministic collectors execute only configured reads and preserve successes, failures and pagination.
2. Sol analyzes shortlisted episodes, retrieves complete original context using the line pointers, verifies producing identities and the bridges that increase network size, and records human involvement separately.
3. An independent reviewer evaluates a frozen neutral packet before seeing the investigator verdict. Only reviewed findings enter the accepted catalog.
4. Cache decisions by input/evidence hash and detector version. Reanalyze changed evidence; unchanged material should consume no new model budget. This cache/controller is a next implementation step, not present functionality.

## Wild-discovery experiment

Use a fixed-budget unfamiliar-source pilot, comparing this graph retrieval with the pairwise baseline and uniformly selected context units. Use local calibration with hidden model labels/internal traces only to test transferable signals. Record supported network yield per total collection/review effort, supported producing-agent lower bounds, false graph mergers and unresolved attribution. A 10-agent milestone is a chosen practical goal, not a universal swarm definition.

Do not interpret a large component or a high score as a confirmed swarm. This version does not inspect task-state transitions without messages, infer semantic artifact transformations, establish runtime success, or resolve multiple agents behind one account. It has no automatic scheduling, unattended web exploration, incremental ingestion or model dispatch. Its practical contribution is a complete local scan and evidence-linked shortlist at low cost.

## Initial measured calibration

The first run on October 3, 2026 scanned all 183,485 local Village messages in 16.7 seconds. Sampled process RSS peaked around 103 MB; the largest seven-day window contained 5,838 records. It retained eight interaction-network hypotheses with 10–12 publisher-labelled identities. These are unreviewed known-population examples, not authenticated swarm sizes or wild discoveries. The full repository suite passed 138 tests after the initial implementation.
