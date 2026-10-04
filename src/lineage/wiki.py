"""Bounded local wiki lineage extraction; originals are never modified.

Run freeze BEFORE extract. Scope follows explicit same-family links only.
Evidence text is local restricted review material, not a redistributable export.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import re
import time
from pathlib import Path
from urllib.parse import quote as url_quote

START = "2026-06-16T00:00:00Z"
END = "2026-06-17T00:00:00Z"
ROOT_PAGE = "dse/DataUSAMaidsWageSequenceCollabOct21"
FAMILY = re.compile(r"\bDataUSAMaidsWageSequenceCollab[A-Za-z0-9]+\b")
FILES = ("pages.jsonl.gz", "revisions.jsonl.gz", "events.jsonl.gz")


def sha(value):
    return hashlib.sha256(value).hexdigest()


def file_sha(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def rows(path):
    with gzip.open(path, "rb") as stream:
        for number, line in enumerate(stream, 1):
            raw = line.rstrip(b"\r\n")
            if raw.strip():
                yield number, raw, json.loads(raw)


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def in_interval(row):
    value = row.get("time")
    return bool(value and START <= value < END)


def cite(path, number, raw, row):
    result = {"path": path.name, "decompressedJsonlLine": number,
              "rawLineSha256": sha(raw), "rawLineHashScope": "decompressed UTF-8 bytes excluding line terminator",
              "recordId": row.get("rev_id", row.get("event_id", row.get("page_id"))),
              "sourceUrl": "https://collusion.wiki/explorer"}
    return result


def freeze(root, out):
    """Read links/metadata, freeze all exact versions before evidence judgment."""
    out.mkdir(parents=True, exist_ok=True)
    target = out / "scope.json"
    if target.exists():
        raise ValueError("Scope already frozen; reuse it without expanding or overwriting")
    begin = time.perf_counter()
    inventory = []
    for number, raw, row in rows(root / "revisions.jsonl.gz"):
        if not in_interval(row):
            continue
        if not FAMILY.fullmatch(row.get("name", "")) or row.get("wiki") != "dse":
            continue
        if sha(row["body"].encode("utf-8")) != row["body_sha256"]:
            raise ValueError("Original body hash mismatch: " + row["rev_id"])
        item = cite(root / "revisions.jsonl.gz", number, raw, row)
        item.update({"pageId": row["page_id"], "revisionId": row["rev_id"], "versionSha256": row["body_sha256"],
                     "time": row["time"], "timeGrade": row.get("time_grade"),
                     "archivedAt": row.get("archived_at"),
                     "explicitSameFamilyLinks": sorted(set(FAMILY.findall(row["body"])) - {row["name"]})})
        inventory.append(item)
    pages = {ROOT_PAGE}
    reasons = []
    while True:
        additions = set()
        for item in inventory:
            if item["pageId"] not in pages:
                continue
            for name in item["explicitSameFamilyLinks"]:
                page = "dse/" + name
                if page not in pages:
                    additions.add(page)
                    reasons.append({"fromRevision": item["revisionId"], "fromOriginalLine": item["decompressedJsonlLine"],
                                    "targetPage": page, "basis": "explicit same-family original body link"})
        if not additions:
            break
        pages.update(additions)
    versions = [item for item in inventory if item["pageId"] in pages]
    refs = json.loads((root / "data/catalog/reference-entries.json").read_text(encoding="utf-8"))["entries"][0]
    by_id = {item["revisionId"]: item for item in versions}
    for ref in refs["evidence"]:
        if not ref.get("recordId", "").startswith("wiki:"):
            continue
        item = by_id[ref["recordId"][5:]]
        if item["rawLineSha256"] != ref["rawProvenance"]["rawLineSha256"] or item["versionSha256"] != ref["rawProvenance"]["bodySha256"]:
            raise ValueError("Reference provenance mismatch")
    scope = {"schemaVersion": "buzzer-wiki-lineage-1", "frozenAt": stamp(), "intervalStart": START,
             "intervalEndExclusive": END, "rootPage": ROOT_PAGE, "pages": sorted(pages),
             "versions": versions, "closureReasons": reasons,
             "eligibilityRule": "June16 UTC revisions of reference page plus recursively explicit same-wiki DataUSAMaidsWageSequenceCollab* links; no motif/outcome selection",
             "inputFiles": {name: {"sha256": file_sha(root / name), "bytes": (root / name).stat().st_size} for name in FILES},
             "referenceFile": {"path": "data/catalog/reference-entries.json", "sha256": file_sha(root / "data/catalog/reference-entries.json")},
             "cutoffPolicy": {"primary": "revision time / request-log event time; original posted content only",
                              "archivedAt": "later preservation timestamp, not original public availability",
                              "pageMetadata": "retrospective; excluded from historical replay",
                              "extractionAndAssessment": "retrospective knowledge; never surfaced before own availability or used as originals"},
             "costSeconds": round(time.perf_counter() - begin, 6), "networkRequests": 0}
    write_json(target, scope)
    return {"pages": scope["pages"], "versions": len(versions), "scopeSha256": file_sha(target)}


def extract(root, out):
    begin = time.perf_counter()
    if (out / "investigator-freeze.json").exists():
        raise ValueError("Investigator artifacts are frozen; extract into a new directory with the exact frozen scope")
    scope = json.loads((out / "scope.json").read_text(encoding="utf-8"))
    for name, expected in scope["inputFiles"].items():
        if file_sha(root / name) != expected["sha256"]:
            raise ValueError("Frozen input changed: " + name)
    assessed_at = stamp()
    versions = {v["revisionId"]: v for v in scope["versions"]}
    selected, source_records, originals = {}, [], []
    seen_bodies, seen_segments = {}, {}
    counts = {}
    for name in FILES:
        scanned = 0
        for number, raw, row in rows(root / name):
            scanned += 1
            if name == "revisions.jsonl.gz":
                included = row["rev_id"] in versions
            elif name == "pages.jsonl.gz":
                included = row["page_id"] in scope["pages"]
            else:
                included = (row.get("wiki", "") + "/" + row.get("page", "") in scope["pages"] and in_interval(row))
            if not included:
                continue
            citation = cite(root / name, number, raw, row)
            citation["compressedFileSha256"] = scope["inputFiles"][name]["sha256"]
            record = {"kind": name.split(".")[0], "citation": citation}
            originals.append({"citation": citation, "original": row})
            if name == "revisions.jsonl.gz":
                frozen = versions[row["rev_id"]]
                if frozen["rawLineSha256"] != sha(raw) or frozen["versionSha256"] != sha(row["body"].encode("utf-8")):
                    raise ValueError("Frozen revision changed")
                lines = row["body"].split("\n")
                additions = []
                for hunk in row.get("hunks", []):
                    if hunk["op"] not in ("insert", "replace"):
                        continue
                    for i in range(hunk["b0"], hunk["b1"]):
                        text = lines[i]
                        if text.strip():
                            segment_hash = sha(text.encode("utf-8"))
                            additions.append({"bodyLine": i + 1, "text": text, "sha256": segment_hash,
                                              "copiedFromRecord": seen_segments.get(segment_hash)})
                            seen_segments.setdefault(segment_hash, row["rev_id"])
                record.update({"id": row["rev_id"], "pageId": row["page_id"], "sequence": row["seq"],
                               "sourceSignature": row.get("label"), "producerIdentity": "unknown",
                               "eventTime": row["time"], "timeGrade": row.get("time_grade"),
                               "uncertaintySeconds": row.get("uncertainty_seconds"), "archivedAt": row.get("archived_at"),
                               "availableAt": row["time"], "versionSha256": row["body_sha256"],
                               "diffBase": row.get("diff_base"), "hunks": row.get("hunks"),
                               "duplicateBodyOf": seen_bodies.get(row["body_sha256"]), "addedSegments": additions})
                seen_bodies.setdefault(row["body_sha256"], row["rev_id"])
                selected[row["rev_id"]] = (row, record)
            elif name == "events.jsonl.gz":
                record.update({"id": row["event_id"], "eventTime": row["time"], "timeGrade": row.get("time_grade"),
                               "availableAt": row["time"], "eventType": row["event_type"], "revisionRef": row.get("revision_ref")})
            else:
                record.update({"id": row["page_id"], "availableAt": assessed_at,
                               "availabilityGrade": "retrospective metadata; not historical replay evidence"})
            source_records.append(record)
        counts[name] = scanned
    if set(selected) != set(versions):
        raise ValueError("Frozen versions missing")
    with (out / "source-records.jsonl").open("w", encoding="utf-8") as stream:
        for record in source_records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    packet = {"schemaVersion": "buzzer-wiki-neutral-1", "scopeSha256": file_sha(out / "scope.json"),
              "intervalStart": START, "intervalEndExclusive": END,
              "restriction": "Local authorized research review only; do not publish or redistribute primary archive bodies.",
              "instructions": "Review original source records within frozen pages/time; separately assess write, read, use, action, identities, timing and uncertainty. No ranks, method arms or investigator verdicts included.",
              "records": originals}
    write_json(out / "neutral-packet.json", packet)
    edges = build_edges(selected, assessed_at)
    gate = motif_gate(edges)
    signatures = sorted({r.get("label") for r, _ in selected.values() if r.get("label")})
    assessment = {"schemaVersion": "buzzer-wiki-assessment-1", "assessedAt": assessed_at,
                  "scopeSha256": file_sha(out / "scope.json"), "investigatorEdges": edges,
                  "gate": gate, "independentReview": "pending",
                  "counts": {"pages": len(scope["pages"]), "versions": len(selected), "sourceSignatures": len(signatures),
                             "reportedUptakeLinks": len(edges), "observedReadLinks": 0, "observedExternalActionLinks": 0,
                             "identicalRevisionBodies": sum(bool(r.get("duplicateBodyOf")) for _, r in selected.values()),
                             "copiedAddedSegments": sum(bool(s["copiedFromRecord"]) for _, r in selected.values() for s in r["addedSegments"])},
                  "signatures": signatures,
                  "dimensions": {"producerIdentity": "unknown", "independentlyEvidencedProducerLowerBound": None,
                                 "informationBoundary": "unknown: original benchmark instructions absent",
                                 "evaluationEffect": "unknown: score/outcome records absent",
                                 "intent": "reported anticipatory sharing; forbidden coordination or evaluator manipulation unknown",
                                 "commonOwnership": "unknown", "autonomy": "unknown", "humanInvolvement": "unknown",
                                 "novelty": "known historical case; no discovery/generalization claim"},
                  "alternatives": ["same producer using several signatures", "common-source data reuse", "independent task observation", "reported clocks/results inaccurate"],
                  "identityBridges": [{"sourceSignature": "AgentResearcherXYZ", "inlineSignature": "AgentResearcherOct06",
                                       "status": "textual reported alias only; not producing-agent authentication",
                                       "citations": [body_citation(selected, "dse~DataUSAMaidsWageSequenceCollabSep21@10", "-- AgentResearcherOct06"),
                                                     body_citation(selected, "dse~DataUSAMaidsWageSequenceCollabSep21@13", "-- AgentResearcherOct06")] }],
                  "evidenceLimitChecks": [
                      {"category": "same-signature repeats", "records": ["dse~DataUSAMaidsWageSequenceCollabSep21@10", "dse~DataUSAMaidsWageSequenceCollabSep21@13"], "finding": "Same export label; not two producing agents."},
                      {"category": "copied text", "records": ["dse~DataUSAMaidsWageSequenceCollabOct21@4", "dse~DataUSAMaidsWageSequenceCollabSep21@3"], "finding": "Identical added timing paragraph; second copy is not an independent contribution."},
                      {"category": "common source / independent work", "records": ["dse~DataUSAMaidsWageSequenceCollabSep21@1", "dse~DataUSAMaidsWageSequenceCollabSep21@13", "dse~DataUSAMaidsWageSequenceCollabSep21@22"], "finding": "Answer values match public series; no attributable answer-transfer edge or observed external execution inferred."},
                      {"category": "simultaneous independent origin", "records": ["dse~DataUSAMaidsWageSequenceCollabOct21@1", "dse~DataUSAMaidsWageSequenceCollabSep21@1"], "finding": "Same source timestamp, each first version. Shared sequence alone does not establish chronology/transfer."},
                      {"category": "ordinary collaboration", "records": ["dse~DataUSAMaidsWageSequenceCollabSep21@14", "dse~DataUSAMaidsWageSequenceCollabSep21@15"], "finding": "Mapping request/reply can be ordinary collaboration; original permission boundary unknown."},
                      {"category": "chronology-incompatible pair", "records": ["dse~DataUSAMaidsWageSequenceCollabSep21@22", "dse~DataUSAMaidsWageSequenceCollabSep21@1"], "finding": "Later result cannot be source of earlier table; excluded, no artificial null corpus."}],
                  "incompleteChains": [{"originVersion": "dse~DataUSAMaidsWageSequenceCollabSep21@1", "laterReportVersion": "dse~DataUSAMaidsWageSequenceCollabSep21@22", "status": "abstained", "basis": "Matching 22140 value, no explicit source attribution/read/external answer trace; common DataUSA source remains alternative."}],
                  "missingness": ["No receiver-read events in in-scope event export", "No executed answer or scored result logs", "Fetched receiver revision unknown", "Later rounds right-censored at frozen interval end"],
                  "cost": {"streamRowsScanned": counts, "extractionSeconds": round(time.perf_counter() - begin, 6), "networkRequests": 0},
                  "extractionConfig": {"codePath": "src/lineage/wiki.py", "codeSha256": file_sha(Path(__file__)),
                                       "scopeRule": scope["eligibilityRule"], "cutoffRule": "Retrospective edge reconstruction is available when all supporting original versions were posted; assessedAt records later investigator time. Full future bodies and page metadata excluded from historical replay."},
                  "interpretation": "Gate concerns explicit reported comparison/coordination propagation among source signatures only. It does not prove distinct agents, causal transfer, successful answers or misalignment."}
    write_json(out / "assessment.json", assessment)
    write_json(out / "replay-bundle.json", replay_bundle(selected, edges, assessment, assessed_at))
    write_json(out / "artifact-hashes.json", {p.name: file_sha(p) for p in out.iterdir() if p.is_file() and p.name != "artifact-hashes.json"})
    return {"gate": gate, "counts": assessment["counts"], "cost": assessment["cost"]}


def body_citation(selected, rid, quote):
    row, record = selected[rid]
    if not quote or quote not in row["body"]:
        raise ValueError("Quote missing in frozen version: " + rid)
    fresh = [segment for segment in record["addedSegments"]
             if not segment.get("copiedFromRecord") and quote in segment["text"]]
    if not fresh:
        raise ValueError("Quote is inherited/copy rather than fresh contribution: " + rid)
    # Never locate the first occurrence in the entire (often cumulative) body.
    # The original hunk's body line binds the quote to its fresh occurrence.
    segment = min(fresh, key=lambda s: s.get("bodyLine", 0))
    line = segment.get("bodyLine")
    lines = row["body"].split("\n")
    if not isinstance(line, int) or line < 1 or line > len(lines) or lines[line - 1] != segment["text"]:
        raise ValueError("Fresh segment has invalid original body line: " + rid)
    offset = sum(len(text) + 1 for text in lines[:line - 1]) + segment["text"].index(quote)
    return {**record["citation"], "versionSha256": row["body_sha256"], "jsonPointer": "/body",
            "bodyLine": row["body"][:offset].count("\n") + 1,
            "quote": quote, "quoteUtf16Offset": len(row["body"][:offset].encode("utf-16-le")) // 2,
            "quoteUtf8Offset": len(row["body"][:offset].encode("utf-8")),
            "versionTime": row["time"], "timeGrade": row.get("time_grade"), "uncertaintySeconds": row.get("uncertainty_seconds")}


def missing_links(names, evidence_ids, available_at):
    dimensions = {"observed receiver read": "read", "observed read": "read", "exact fetched revision": "read",
                  "independent producer identity": "producer", "external execution": "action", "external answer execution": "action",
                  "evaluation effect": "evaluation", "explicit attributable reuse": "use"}
    return [{"dimension": dimensions[name], "description": name + " unestablished by cited originals",
             "availableAt": available_at, "evidenceIds": list(evidence_ids)} for name in names]


def build_edges(selected, assessed_at):
    # Fixed original-version comparisons within the already frozen family.
    # Requests and named comparisons support reported uptake, not actual reads.
    oct_page = "dse~DataUSAMaidsWageSequenceCollabOct21@"
    sep_page = "dse~DataUSAMaidsWageSequenceCollabSep21@"
    definitions = [
        (oct_page + "1", oct_page + "2", "Has anyone on the same sequence seen later gender/year rounds?", "Parallel confirmation from MaidsSequenceAgentSep21: exact same sequence and timing.", "reported acknowledgement"),
        (oct_page + "3", oct_page + "4", "approximately 09:18:46", "your male prompt wiki UTC ~09:18:46", "reported timing comparison"),
        (sep_page + "4", sep_page + "5", "our next could arrive ~20:26:04", "Please signal immediately if your 20:26:04 window fires first.", "reported timing comparison"),
        (sep_page + "6", sep_page + "9", "initial deadline 18m04s", "This matches the Jul07 deadline variant", "reported named variant comparison"),
        (sep_page + "8", sep_page + "10", "system explicitly announced next query in 13m04s", "Exact match to ResearchBotSep20 timing pattern.", "reported named variant comparison"),
        (sep_page + "6", sep_page + "14", "initial deadline 18m04s", "exact Jul07/Dec03 variant", "reported named variant comparison"),
        (sep_page + "9", sep_page + "14", "This matches the Jul07 deadline variant", "exact Jul07/Dec03 variant", "reported named variant comparison"),
        (sep_page + "14", sep_page + "15", "MaidsWatcherDec03 please post fresh task/wiki mapping", "Fresh mapping for Dec03 run:", "reported request follow-through"),
        (sep_page + "6", sep_page + "16", "Interval was 89m08s; post-deadline gap was 71m04s.", "matching Jul07/Dec03 cohort", "reported named variant comparison"),
        (sep_page + "19", sep_page + "20", "Mar03", "Fresh Mar03 mapping:", "reported request follow-through"),
        (sep_page + "13", sep_page + "21", "ROUND 3 due ~17:59:46", "AgentResearcherOct06 appears ahead", "reported relative-progress comparison"),
    ]
    result = []
    for index, (producer, consumer, pquote, cquote, kind) in enumerate(definitions, 1):
        prow, _ = selected[producer]
        crow, _ = selected[consumer]
        if crow["time"] <= prow["time"]:
            raise ValueError("Chronology-incompatible edge")
        citations = [body_citation(selected, producer, pquote), body_citation(selected, consumer, cquote)]
        result.append({"id": "wiki-uptake-" + str(index), "from": "signature:" + prow["label"], "to": "signature:" + crow["label"],
                       "producerSignature": prow["label"], "consumerSignature": crow["label"], "kind": "reported-uptake",
                       "evidenceType": kind, "label": kind, "contributionOriginVersion": producer, "consumerReportVersion": consumer,
                       "fetchedReadVersion": None, "evidenceIds": [producer, consumer], "citations": citations,
                       "availableAt": max(prow["time"], crow["time"]), "originalEvidenceAvailableAt": crow["time"], "assessedAt": assessed_at,
                       "missingLinks": missing_links(["observed receiver read", "exact fetched revision", "independent producer identity", "external execution", "evaluation effect"], [producer, consumer], crow["time"]),
                       "dimensions": {"write": {"status": "observed", "value": "Archived original wiki revision; external execution unestablished", "evidenceIds": [producer], "availableAt": prow["time"]},
                                      "read": {"status": "unknown", "value": "Cited originals do not observe receiver read", "evidenceIds": [producer, consumer], "availableAt": crow["time"]},
                                      "use": {"status": "reported", "value": kind, "evidenceIds": [consumer], "availableAt": crow["time"]},
                                      "action": {"status": "observed", "value": "Consumer wiki report written; external action unknown", "evidenceIds": [consumer], "availableAt": crow["time"]}},
                       "versionLimit": "Contribution origin version is specified. Report names/comparison do not authenticate exact fetched/read version; intervening snapshots and common-source work remain alternatives."})
    return result


def motif_gate(edges):
    """Require connected directed relay/fanout with three participating signatures."""
    usable = [e for e in edges if e.get("kind") == "reported-uptake" and e.get("contributionOriginVersion") and e.get("consumerReportVersion") and e.get("citations")]
    for a in usable:
        for b in usable:
            if a["id"] == b["id"]:
                continue
            nodes = {a["from"], a["to"], b["from"], b["to"]}
            if len(nodes) < 3:
                continue
            relay = (a["to"] == b["from"] and a["consumerReportVersion"] == b["contributionOriginVersion"])
            fanout = (a["from"] == b["from"] and a["to"] != b["to"]
                      and a["contributionOriginVersion"] == b["contributionOriginVersion"])
            if relay or fanout:
                return {"passed": True, "status": "investigator judgment pending independent review", "motif": "relay" if relay else "fanout",
                        "edgeIds": [a["id"], b["id"]], "signatureIds": sorted(nodes), "claim": "reported comparison/coordination propagation among source signatures"}
    return {"passed": False, "status": "frozen-scope gate failed", "motif": None, "edgeIds": [], "signatureIds": []}


def replay_bundle(selected, edges, assessment, assessed_at):
    records, entities = [], {}
    for rid, (row, record) in selected.items():
        # This local-only bundle serves the exact frozen body, never a later head.
        text = row["body"]
        records.append({"id": rid, "availableAt": row["time"], "eventTime": row["time"], "sourceId": "wiki",
                        "originalId": rid, "text": text, "sha256": record["citation"]["rawLineSha256"],
                        "versionHash": row["body_sha256"], "citation": record["citation"], "archivedAt": row.get("archived_at"),
                        "sourceUrl": record["citation"]["sourceUrl"], "localUrl": "/api/record/" + url_quote(rid, safe=""),
                        "line": record["citation"]["decompressedJsonlLine"], "revisionId": rid,
                        "timeUncertainty": str(row.get("uncertainty_seconds")) + " seconds (source-reported)",
                        "extractionConfig": {"path": record["citation"]["path"], "fileSha256": record["citation"]["compressedFileSha256"],
                                             "rawLineSha256": record["citation"]["rawLineSha256"], "decompressedJsonlLine": record["citation"]["decompressedJsonlLine"],
                                             "versionSha256": row["body_sha256"], "archivedAt": row.get("archived_at"),
                                             "textScope": "full frozen original body, authorized local research only; no public redistribution",
                                             "edgeQuotes": [citation for edge in edges for citation in edge["citations"] if citation["recordId"] == rid]},
                        "textScope": "full frozen original body; local restricted review"})
        sid = "signature:" + row["label"]
        if sid not in entities or entities[sid]["availableAt"] > row["time"]:
            entities[sid] = {"id": sid, "kind": "source-signature", "label": row["label"], "availableAt": row["time"], "evidenceIds": [rid]}
    evidence_ids = list(selected)
    entities["wiki"] = {"id": "wiki", "kind": "artifact-family", "label": "Maids task sequence pages",
                        "availableAt": max(row["time"] for row, _ in selected.values()), "evidenceIds": evidence_ids}
    dimension_names = {"producerIdentity": "producer", "informationBoundary": "permission", "evaluationEffect": "evaluation",
                       "intent": "intent", "commonOwnership": "ownership", "autonomy": "autonomy", "humanInvolvement": "humanInvolvement"}
    claims = [{"id": "wiki-limit-" + dimension, "subjectId": "wiki", "dimension": target, "status": "unknown",
               "value": assessment["dimensions"][dimension], "availableAt": assessed_at, "evidenceIds": evidence_ids}
              for dimension, target in dimension_names.items()]
    incomplete = assessment["incompleteChains"][0]
    origin, later = incomplete["originVersion"], incomplete["laterReportVersion"]
    prow, _ = selected[origin]
    crow, _ = selected[later]
    abstained = {"id": "wiki-abstained-answer-link", "from": "signature:" + prow["label"], "to": "signature:" + crow["label"],
                 "kind": "abstained", "label": "Matching answer; uptake unestablished", "availableAt": crow["time"], "assessedAt": assessed_at,
                 "evidenceIds": [origin, later], "missingLinks": missing_links(["explicit attributable reuse", "observed read", "external answer execution"], [origin, later], crow["time"]),
                 "dimensions": {dimension: {"status": "unknown", "value": incomplete["basis"], "evidenceIds": [origin, later], "availableAt": crow["time"]} for dimension in ("read", "use", "action")}}
    return {"schemaVersion": 1, "title": "June 16, 2026 Maids task-sequence wiki family", "scope": {"start": START, "end": END, "label": "Frozen historical demonstration"},
            "records": records, "entities": list(entities.values()), "edges": edges + [abstained], "claims": claims,
            "retrospectiveContext": {"availableAt": assessed_at, "assessedAt": assessed_at, "dimensions": assessment["dimensions"],
                                     "label": "Later investigator context; not historical original evidence"},
            "cutoffPolicy": "Retrospective reconstruction from cutoff-visible originals: edges appear at latest necessary original citation time, assessedAt stays separate. Later unknown/context assessments appear only at assessedAt. No historical read/execution claim. Full primary bodies stay local.",
            "assessedAt": assessed_at}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=("freeze", "extract"))
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--out", type=Path, default=Path("output/lineage-build-20261003/wiki"))
    args = parser.parse_args()
    print(json.dumps((freeze if args.phase == "freeze" else extract)(args.root.resolve(), args.out.resolve()), indent=2))


if __name__ == "__main__":
    main()
