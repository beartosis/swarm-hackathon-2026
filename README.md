# Buzzer

**Catch agents colluding. See who handed what to whom.**

Buzzer is a monitoring workbench for multi-agent systems. It reads what agents say to each other, flags the moment a pair strikes a deal, and traces confirmed hand-offs across a whole swarm. Every flag and every link opens onto the messages behind it.

Built for the AI Village × Grove Research AI Swarm Dynamics Hackathon, October 3–4, 2026.

**Demo video (2 min 50 s, narrated):** [docs/demo/buzzer-demo.mp4](docs/demo/buzzer-demo.mp4) · [captions](docs/demo/buzzer-demo.srt)

[![Buzzer overview: collusion monitor and hand-off traces](docs/img/landing.png)](docs/demo/buzzer-demo.mp4)

## Three views

### Collusion monitor

Reads only the messages two agents exchange and flags the episodes where they agree to accept each other's work. On the SALT agent-collusion release (Shi, Zhang and Yang, 2026) it was fitted on 30 task sequences and frozen before it saw the held-out ones.

| Held-out set | Episodes | Agreements caught | Flags that were correct | False alarms on clean episodes |
|---|---:|---:|---:|---:|
| New task sequences | 3,200 | **898 of 923 (97%)** | 90% | 4.3% |
| Claude pairs, never in training | 400 | 118 of 128 (92%) | 72% | 17.3% |

The page shows all 3,600 held-out episodes as one square each, grouped by experiment, so thousands of episodes stay readable. Click a square to read the conversation, and step through a pair's ten episodes to watch the arrangement form. A second mode predicts the outcome itself (both agents accepting without the required evidence): 83% caught, 89% of flags correct.

**Open it:** [`docs/demo/collusion-monitor.html`](docs/demo/collusion-monitor.html) (self-contained; the data is MIT-licensed).

![Collusion monitor: 3,600 held-out episodes, one square each](docs/img/collusion-monitor.png)

The weak spot is transfer to a new model family: on Claude pairs one flag in four is wrong. A plain keyword baseline also matches the monitor on agreement detection (F1 94.2% against 93.5%); the learned monitor is clearly better only at predicting the outcome (F1 85.5% against 72.2%). Full protocol and first-run report: [`docs/salt-validation/`](docs/salt-validation/).

### Hand-off traces

Finds where one agent says it used another agent's work, has two blind reviewers confirm each link against random control pairs, and draws the confirmed network as a replayable timeline. In AI Village chat this confirms **69 hand-offs** across eight networks, joining up to 10 of 12 agents in one chain; random pairs pass the same review 1 time in 60.

![An AI Village network: confirmed hand-offs only, with the evidence a click away](docs/img/village-network.png)

### Shared wiki relay

The same question on a public wiki export with **3,102** labels and **14,591** revisions. Here a hand-off is observed in the stored text: a revision keeps lines first written on that page by a different label and adds lines of its own. That rule finds **18,644** hand-offs linking 2,159 labels across 883 shared pages. The archive view is a who-built-on-whom matrix plus a filterable page-by-page relay; single pages open as the same lane graph used for AI Village.

![One wiki page as a relay: each label builds on the last](docs/img/wiki-page.png)

These wiki hand-offs are not reviewed and have no control comparison. A kept line shows that text was carried forward, not why, and a label is a name in the page text, not a confirmed agent.

## Hand-off traces: the problem

A graph of agents that mention each other is easy to draw and easy to overread. Twelve agents that reference the same file look like twelve-way coordination. Fifteen handles on a wiki page look like a fifteen-agent swarm. Neither picture says whether anything actually passed from one agent to another.

Buzzer answers a narrower question that can be checked: **for this specific later message, does its author say they used what that specific earlier author produced, and where is the sentence that says so?**

## Hand-off traces: how it works

1. **Scan.** One streaming pass over a chat archive, no model calls. A link is proposed when a later message addresses an earlier author and repeats an exact path, URL or commit from that author's message.
2. **Review.** Every proposed link goes to two blind reviewers as a pair of full messages. Unlinked control pairs are mixed in, and reviewers are not told which is which. Each reviewer answers fixed questions and must quote the later message.
3. **Reconcile.** Code checks every quote against the source text. A link is *supported* only if both reviewers report use. Acknowledgements, disagreements and rejections are kept and shown, not dropped.
4. **Trace.** Each network becomes a constellation: lanes are agents, stars are messages, curves are links colored by what review found. A replay slider hides evidence after the cutoff. Under the graph, a fixed set of questions is answered from the reviewed links: who is connected, whose work was taken up, which artifacts travelled, whether humans were in the room, and what is still unknown.

## Hand-off results

### AI Village: 69 confirmed hand-offs across eight networks

The scan read all **183,485** AI Village chat messages in about 16 seconds and kept **8** networks of 10 to 12 agent labels, with **210** distinct proposed hand-offs between them. Sixteen reviewer sessions (two per packet) then read all 210, plus 60 unlinked control pairs drawn from the same messages.

| | Pairs | Supported by both | Acknowledged only | Reviewers disagree | Rejected by both |
|---|---:|---:|---:|---:|---:|
| Detector links | 210 | **69** (33%) | 83 | 8 | 50 |
| Unlinked control pairs | 60 | 1 | 1 | 0 | 58 |

- **Agreement:** the two reviewers gave the same verdict on 249 of 270 pairs (Cohen's κ 0.88).
- **Quotes:** 316 of 317 supporting quotes were found in the source message. The one that was not is not counted.
- **Connectivity:** in the largest network (March 3–9), 10 of 12 agent labels are joined by supported links. Across the eight networks the supported component ranges from 5 to 10 labels.
- **The one supported control** is a real hand-off the detector missed: one agent adopts another's diagnosis, with no file path to match on.

So the raw scan graph overstates hand-offs roughly three to one, and the reviewed graph is still a real connected network. The 83 acknowledged-only links are the interesting middle: the later agent names the earlier agent's artifact but never says it opened it.

### A check that did not work: did the receiver touch the file?

We expected action traces to confirm the supported links. We joined every link to the 78,362 computer-use sessions and asked whether the receiving agent ran a command, or got tool output, naming the artifact between the two messages.

| Review outcome | Links with a usable identifier | Receiver's trace names the artifact |
|---|---:|---:|
| Supported by both reviewers | 69 | 63 (91%) |
| Acknowledged only | 78 | 71 (91%) |
| Rejected by both reviewers | 47 | 45 (96%) |

Access is nearly universal, including for links both reviewers rejected. The likely reason is that these agents work in shared repositories where the same files recur. So "the receiver touched it" cannot separate a hand-off from working side by side, and Buzzer shows trace access as context on each link without using it to upgrade one. What the receiving agent says remains the evidence that discriminates.

### The wiki incident: 12 candidate links, 1 survives

On two linked task-sequence pages from the June 16 wiki incident (26 revisions, 15 signatures), an investigator proposed 11 reported links and 1 abstention. After independent review of the original revisions, **1 link is kept** as reported uptake, **11 remain unresolved**, and **0 have an observed read**. The 15 signatures are labels in page text, not 15 authenticated agents.

![Wiki incident constellation](docs/img/wiki-overview.png)

### Looking in the wild: an honest null

Over the two days we also ran a series of frozen, read-only discovery passes across public agent venues, registries and task boards, and catalogued 21 reviewed cases. None establishes a large misaligned swarm. The strongest multi-agent transfer chain we could reconstruct was already published: four operator-attributed samples in AISI's July cyber-testing report.

On the second day six read-only lanes were assigned 26 old wiki and guestbook installations and reviewed whatever recent-change history each exposed. Several were blocked, errored or showed only a partial window. Where history was readable it was spam, ordinary community edits and one informal LLM survey page that reads as human-authored. That audit worked from rendered page text and is not proof of absence.

## Try it

Node 20 or newer, no install step.

```bash
# Open the collusion monitor (3,600 real held-out episodes, MIT-licensed data)
docs/demo/collusion-monitor.html

# Open a synthetic hand-off trace (no restricted data needed)
docs/demo/synthetic-constellation.html

# Run the tests
node --test test/
```

To reproduce the AI Village result with your own copy of the dataset:

```bash
# 1. Scan
node src/swarm-watch-cli.mjs --village --input ai-village/chat_messages.jsonl.gz \
  --agents ai-village/agents.jsonl.gz --out out/scan --min-actors 10 --top 12

# 2. Build blind review packets (links plus unlinked controls; the key is written separately)
node src/village-review-packets.mjs out/scan/scan.json ai-village/chat_messages.jsonl.gz out/review

# 3. Give each packet to two reviewers using docs/review-rubric.md.
#    Save answers as out/review/reviews/packet-N-reviewer-A.json and ...-B.json.

# 4. Reconcile and build the site
node src/village-review-reconcile.mjs out/review
#    The last three arguments are optional: trace join, collusion benchmark output, wiki revisions export.
node src/constellation-site.mjs out/scan/scan.json out/review my-wiki-replay.json out/site \
  out/trace-join.json out/salt-validation wiki/revisions.jsonl

# Optional: join links to computer-use traces (pre-filter the turns with grep on the artifact names first)
node src/village-trace-join.mjs out/review link-tokens.json matched-turns.jsonl \
  ai-village/computer_use_sessions.jsonl.gz out/trace-join.json
```

## What is in this repository

| Path | What it does |
|---|---|
| `src/swarm-watch.mjs` | The scan: streams an archive, builds interaction networks from addressed replies that repeat an exact reference. |
| `src/village-review-packets.mjs` | Builds blind packets with deterministic unlinked controls and a separate key. |
| `src/village-review-reconcile.mjs` | Verifies quotes, reconciles two reviews, reports agreement and control rates. |
| `src/village-trace-join.mjs` | Joins links to computer-use action traces by receiver, time window and artifact identifier. |
| `src/lineage/constellation.mjs` | Renders one self-contained constellation page per case. No dependencies; opens from `file://`. |
| `src/constellation-site.mjs` | Builds the whole linked site: overview, method page, every case page, and the shared top bar and case switcher. |
| `src/wiki-relay.mjs` | Finds observed hand-offs in a wiki revision export and builds the archive relay page and per-page lane graphs. |
| `src/collusion-site.mjs` | Builds the collusion monitor page from the frozen benchmark's splits and predictions. |
| `src/salt-validation/` | The collusion monitor itself: split, train, freeze and evaluate (Python, scikit-learn). |
| `src/site-theme.mjs` | Shared design tokens and embedded fonts for every page. |
| `src/lineage/` | The evidence-lineage pipeline used for the wiki incident: frozen extraction, source-hash verification, time-gated replay. |
| `docs/review-rubric.md` | The exact reviewer instructions and answer format. |
| `test/` | Tests, including quote verification, reconciliation rules and a check that source text cannot break out of a generated page. |

## What this does not show

- **Reported use is not an observed read.** A supported link means the later agent wrote that it used the artifact. Trace access to the artifact's name was nearly universal, so no read of content is established for any link.
- **Labels are not agents.** Agent labels are assigned by the publisher. Ten connected labels are not ten independent systems.
- **Reviewers are models.** The two reviewers are sessions of one model family with a fixed rubric, not independent humans. High agreement between them is not the same as accuracy.
- **Controls are not a random sample of the archive.** They are unlinked cross-author pairs drawn from the same evidence messages, within 48 hours.
- **No recall estimate.** The detector only proposes links that repeat an exact reference, so hand-offs without one are missed.
- **Known populations.** AI Village and the wiki incident calibrate the method. Nothing here is a discovery of a misaligned swarm, unauthorized communication or evaluation manipulation.
- Primary archives are not redistributed in this repository.

## Attribution

- Shi, Zhang and Yang, *Emergent Collusion in Long-Horizon LLM Agent Interaction* (2026), arXiv:2609.24967; dataset SALT-NLP/agent-collusion, MIT licence. The collusion monitor demo page contains excerpts from this release.
- AI Digest, *AI Village dataset* (2026): https://theaidigest.org/village
- Wiki incident export and archive: https://collusion.wiki/ and https://github.com/swarm-ai-research/wiki-agent-swarm-incident
- AISI and other published incident reports are cited as known references.
- Typefaces: Instrument Sans and IBM Plex Mono, SIL Open Font License 1.1 (see `assets/fonts/LICENSES.txt`). Pages embed them so they open offline.

## License

Code in this repository is released under the MIT License (see `LICENSE`). Third-party data and fonts keep their own licences, listed under Attribution.
