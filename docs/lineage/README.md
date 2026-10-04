# Buzzer evidence lineage

Replay versioned contributions and inspect whether a later participant reports or demonstrates uptake. The viewer keeps original evidence, unknowns, and disagreement visible. It does not classify generic collaboration as misalignment or count source signatures as authenticated agents.

## Local completed research demo

From the Buzzer workspace, run:

```powershell
node src/lineage/demo.mjs output/lineage-build-20261003
```

Open `http://127.0.0.1:4316`. The two local viewers use ports 4317 and 4318. Start at the earliest cutoff and advance time; select a link to see its dimensions, exact quotes, original body, and source hashes. Rewind removes future originals and derived evidence. The server enforces the same cutoff on direct record requests. The source archive remains local; there is no general filesystem download route.

`output/lineage-build-20261003/REPORT.txt` contains the final audit results, costs, source coverage, disagreements, and limitations. The local primary packets must not be redistributed. The code-only package excludes them.

## Public code-only smoke demo

Node 20 or newer is sufficient for a constructed example:

```powershell
node src/lineage/example.mjs output/my-new-synthetic-demo
```

Open `http://127.0.0.1:4416`. Both cards deliberately load the same **synthetic fixture**, not historical data. It demonstrates reported use and an unresolved matching result without distributing primary archives. Existing output directories are refused.

## Reproduce the archive extraction

Python 3.11+ is required for extraction and source verification. Python's IANA timezone database must include `America/Los_Angeles` (the bundled workspace runtime does). On Windows with a separate Python installation, install its `tzdata` package if the operating system has no timezone database. No model or network request is needed by these extractors.

Use a fresh output directory for a new run. Obtain the source archives under their research terms and preserve their bytes. Wiki inputs are `pages.jsonl.gz`, `revisions.jsonl.gz`, `events.jsonl.gz`, and the original known-reference entry file. Village inputs live in `ai-village/`; see its dataset schema and terms.

```powershell
python src/lineage/village.py freeze --archive ai-village --output output/MY-RUN/village
python src/lineage/village.py run --archive ai-village --output output/MY-RUN/village
python src/lineage/village.py verify --archive ai-village --output output/MY-RUN/village
python src/lineage/wiki.py freeze --root . --out output/MY-RUN/wiki
python src/lineage/wiki.py extract --root . --out output/MY-RUN/wiki
python src/lineage/verify.py --wiki output/MY-RUN/wiki/neutral-packet.json --village output/MY-RUN/village --output output/MY-RUN/original-verification.json
```

The wiki module implements this specific known-reference calibration. It is not a general discovery algorithm. Village freezes configuration and implementation before selection; changes require an explicit new run or documented amendment. Chat is used for retrieval, session/turn originals for adjudication. Mirrored chat/events and overlapping packets are not independent contributions.

Research review is an explicit stage. Investigators freeze judgments before independent reviewers receive neutral originals; reviewers must not see method ranks, arm memberships, or initial judgments. Each Village packet has a ten-active-minute cap. Preserve unread records, failed joins, screenshot absence, cap hits, and source-specific uncertainty. Same-model separate sessions supply procedural independence only. The local review artifacts and reconciliation bind the final demo; automated extraction alone cannot produce accepted scientific claims.

## Components and checks

- `village.py`: frozen eligibility, deterministic retrieval/baseline/uniform sampling, bounded originals and screenshot inventory.
- `wiki.py`: explicit page-family freeze, revision-aware additions and citations, copied-text handling.
- `verify.py`: independent compressed-file, raw-line, and complete parsed-original verification.
- `replay.mjs` / `ui.mjs`: conservative cutoff projection and responsive inspector.
- `assemble.mjs` / `village-replay.mjs`: local original-body adapters. Retrieval scores never become accepted edges.
- `reconcile-wiki.mjs`: preserved independent-review disagreement and final conservative wiki disposition.
- `server.mjs` / `demo.mjs`: read-only loopback server and local demo entry.
- `screenshot.py`: optional exact-frame attachment, verified against frozen tar/member hashes. Source terms still apply.
- `package.py`: allowlisted code/docs/tests archive, excluding research packets and primary archives.

```powershell
$tests = (Get-ChildItem test/lineage/*.test.mjs).FullName
node --test $tests
python -m unittest discover -s test/lineage -p "test_*.py"
python src/lineage/package.py output/buzzer-lineage-code.zip
```

Some artifact checks run only when the local frozen research outputs exist. Synthetic tests remain clearly separate from historical findings. See `replay.md`, `village.md`, and `wiki.md` for schemas and scope details.

Attribution: AI Digest, *AI Village dataset*, 2026, https://theaidigest.org/village. Known wiki incident archive: https://github.com/swarm-ai-research/wiki-agent-swarm-incident and https://collusion.wiki/. Follow the source terms, including restrictions on training, re-identification, publication notification, and primary-export redistribution.

