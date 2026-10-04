# Frozen AI Village retrieval and neutral packets

`src/lineage/village.py` implements the April 6–12, 2026 PT feasibility audit in
the agreed planning document. It uses Python's standard library, streaming gzip,
SQLite disk indexes, and streaming tar access. This produces retrieval hypotheses
and original-record packets. It does not adjudicate transfer, producer identity,
misalignment, intent, evaluation effects, or causal influence.

## Commands

Run from the repository root with Python 3.9+ and an available
`America/Los_Angeles` timezone database. On this workstation the bundled Python is
`python`.

```powershell
& 'python' src/lineage/village.py freeze --archive ai-village --output output/lineage-build-20261003/village
& 'python' src/lineage/village.py run --archive ai-village --output output/lineage-build-20261003/village
& 'python' src/lineage/village.py verify --archive ai-village --output output/lineage-build-20261003/village
& 'python' -m unittest discover -s test/lineage -p test_village.py
```

Freeze refuses to overwrite its protocol or manifest. The protocol is written
before any archive row is parsed, then all used compressed sources and relevant
screenshot tar files are SHA256-hashed. Missing files are recorded. The module
hash is frozen too. Run refuses changed code, configuration or input metadata,
and refuses a completed selection output. Preserve a failed run; use a new output
directory and explicitly record an amendment if an implementation change is
needed. An unknown or interrupted run is not silently repeated in-place.

`verify` rehashes the full frozen inventory, verifies packet hashes, then streams
the sources to compare each included original's raw-line hash and complete parsed
payload against its stated source line. It uses a temporary SQLite index and
writes `verification.json`. Verification checks provenance, not evidence claims.

## Fixed retrieval rules

The UTC interval is `[2026-04-06T07:00:00Z, 2026-04-13T07:00:00Z)`, the seven
complete local dates in America/Los_Angeles. Naive archive timestamps mean UTC,
per the source schema. Timestamp strings use fixed microsecond precision for
reliable disk sorting. Registry membership comes from exported `agents.id`;
names, participation flags and later metadata are never ranking features.

An eligible unit is a room/clock-hour with at least two distinct registry IDs on
agent chat rows. Enumerate every eligible unit, including zero-feature ones.
Within the anchor hour, deduplicate exact message bodies per speaker, retaining
the earliest. References are exact, case-preserving full URLs, commit hex strings
of 7–40 characters, explicit paths, or a fixed list of file extensions. The full
regex and fixed word/phrase dictionaries are in `protocol.json`. No archive
vocabulary is learned. References shared by distinct registry IDs are still
hypotheses, not observed transfer.

For each exact reference, count strictly ordered message pairs between distinct
registry IDs. A later read/use cue contributes an uptake-retrieval pair; an earlier
write cue contributes a write-then-other pair. Equal-time pairs contribute neither.

- Candidate score: `8 * uptake_pairs + 4 * write_then_other_pairs + 2 * refs_with_three_speakers + read_rows + write_rows`.
- Baseline score: `3 * refs_with_multiple_speakers + coordination_rows`.
- Each ranked arm selects four positive-score eligible units, sorting score
  descending and stable `room_id|UTC-hour` key ascending for ties.
- Uniform selects four eligible units by ascending
  `SHA256(seed + "\n" + stable_key)`, then stable key.
- Seed: `buzzer-village-20261003-frozen-1`.

All twelve intended slots are retained even when empty. Overlaps share one opaque
packet ID. No handpicked replacement fills an empty arm. Context, sessions, turns,
summaries, identity resolution and later records never enter scoring. The March31
known case is outside the interval and no calibration rows are read by this module.

## Outputs and schema

- `protocol.json`: immutable exact rules and limits; includes ten active review
  minutes per unique packet per reviewer.
- `manifest.json`: frozen configuration and code hashes, local archive root,
  input sizes/mtime/hash/presence, freeze time and hash cost.
- `eligible_units.jsonl`: all eligible units, anchor features and retrieval scores.
- `selections.json`: all arm slots, overlaps, empty reasons, intended/filled slot
  counts and unique packet denominator. Keep this away from the blind reviewer.
- `packets/<opaque-id>/packet.json`: neutral anchor/horizon, clipping, source row
  and byte counts, missingness, file hashes, registry labels and coverage limits.
  It has no retrieval arm, method score or evidence verdict.
- `packets/<opaque-id>/records.jsonl`: complete original JSON rows in wrappers.
  Each wrapper has stable `record_id`, original source file/hash, original
  1-based line, raw-line SHA256 including its newline, UTC event time and its
  interpretation. When a source proves an agent registry link, it is stored as
  `registry_agent_id`; this is not producer authentication.
- `packets/<opaque-id>/screenshots.jsonl`: verified tar entry presence, size and
  image-byte hash, or explicit absence. Raw screenshots remain in the archive.
  Redaction and override flags are preserved in the full turn original.
- `costs.json`: collection, freeze, retrieval and extraction/join cost separately;
  scan counts, SDK-source coverage, review budget/status and memory policy.
- `working.sqlite3`: local disk index, preserved for debugging/reproducibility.
- `verification.json`: verification outcome and cost.

The packets contain all room chat in `[hourStart−30m, hourEnd+30m)`, clipped to
the interval. Context speakers determine the registry IDs whose execution turns
are joined. Sessions are indexed independently of creation date, so long-lived
sessions can resolve turns inside the horizon. Full matching session originals
are retained with a warning that updated fields/session goals may be later
metadata. They are never assigned fictitious historical availability. Events with
the room or those registry IDs, overlapping agent/village goals, and corresponding
Claude Code source rows inside the horizon are retained too. The SDK sources are
checked independently by timestamp rather than assuming the README's scaffold
end date proves coverage.

Exact raw prompts/LLM-call logs were not exported. Agent memories, publisher
summaries and the rendered transcript are not searched. Missing session foreign
keys and malformed/null timestamps remain counted, with no fabricated identity
or room attribution. Null outputs do not prove no execution or no uptake.
Screenshots may be absent for ordinary talk/bash turns; absence alone does not
identify its cause. Export registry names are retrospective metadata, and registry
IDs are not independently authenticated producing-agent identities.

## Deterministic access for review and replay

Export complete wrappers for one source or record into a new local file:

```powershell
& 'python' src/lineage/village.py records --packet output/lineage-build-20261003/village/packets/OPAQUE_ID/packet.json --source chat_messages.jsonl.gz --destination output/lineage-build-20261003/village/chat-review.jsonl
& 'python' src/lineage/village.py records --packet output/lineage-build-20261003/village/packets/OPAQUE_ID/packet.json --record-id computer_use_turns:TURN_UUID --destination output/lineage-build-20261003/village/turn-review.jsonl
```

`--before UTC_TIMESTAMP` is an exclusive event-time source filter. It also excludes
all wrappers explicitly marked retrospective, including registry, session and
goal metadata. No originals are silently truncated. The exporter verifies the
packet originals' hash, refuses to overwrite a destination, and reports count,
size and hash. This is a conservative source filter, not a reconstruction of the
historical prompt or what an agent actually knew. A replay application must also
filter derived labels, identities, summaries and graph edges by its own evidence
availability contract.

## Research and disclosure limits

Keep archive rows, packets and screenshots local under the custom research terms;
do not redistribute primary archives in a public demo. Attribute AI Digest /
AI Village, 2026, https://theaidigest.org/village. No training or re-identification
is authorized. Existing exposure to incident writeups and prior archive exploration
is disclosed: the week is a reserved feasibility sample, not pristine unseen data.

Forty eligible units or twelve slots would not estimate the population of all
collaboration. Silent actors, delayed uptake and cross-room-only activity may be
missed. Packet overlap and dependence preclude an improvement claim from N≤12.
Independent documentary review, producer attribution, permission boundaries,
evaluation effects, ownership, autonomy, human involvement and intent are separate
work. Successful ingestion or verification supports none of those conclusions.
