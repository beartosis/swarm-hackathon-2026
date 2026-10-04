"""Meaningful provenance, fixed scope, copying, motif and cutoff checks."""
import gzip
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("wiki_lineage", ROOT / "src/lineage/wiki.py")
wiki = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wiki)


class ScopeTests(unittest.TestCase):
    def test_scope_links_and_times_and_immutability(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data/catalog").mkdir(parents=True)
            out = root / "out"
            oct_name = wiki.ROOT_PAGE.split("/")[1]
            sep_name = "DataUSAMaidsWageSequenceCollabSep21"
            rows = []
            for name, text, clock in [(oct_name, "See " + sep_name, "2026-06-16T09:00:00Z"),
                                      (sep_name, "Actual linked context", "2026-06-16T09:01:00Z"),
                                      ("DataUSAMaidsWageSequenceCollabUnlinked", "Generic same family", "2026-06-16T09:02:00Z"),
                                      (sep_name, "See DataUSAMaidsWageSequenceCollabFuture", "2026-06-17T01:00:00Z")]:
                rows.append({"name": name, "wiki": "dse", "page_id": "dse/" + name, "rev_id": "dse~" + name + "@" + str(len(rows)),
                             "body": text, "body_sha256": wiki.sha(text.encode()), "time": clock})
            for name, items in [("revisions.jsonl.gz", rows), ("pages.jsonl.gz", []), ("events.jsonl.gz", [])]:
                with gzip.open(root / name, "wb") as stream:
                    for row in items:
                        stream.write(json.dumps(row).encode() + b"\n")
            (root / "data/catalog/reference-entries.json").write_text(json.dumps({"entries": [{"evidence": []}]}))
            wiki.freeze(root, out)
            frozen = json.loads((out / "scope.json").read_text())
            self.assertEqual(frozen["pages"], sorted([wiki.ROOT_PAGE, "dse/" + sep_name]))
            self.assertEqual(len(frozen["versions"]), 2)
            before = (out / "scope.json").read_bytes()
            with self.assertRaisesRegex(ValueError, "already frozen"):
                wiki.freeze(root, out)
            self.assertEqual(before, (out / "scope.json").read_bytes())

    def test_inherited_quote_is_not_new_contribution(self):
        row = {"body": "original\nnew"}
        selected = {"x": (row, {"addedSegments": [{"text": "new"}], "citation": {}})}
        with self.assertRaisesRegex(ValueError, "inherited/copy"):
            wiki.body_citation(selected, "x", "original")

    def test_copied_added_segment_is_not_fresh(self):
        selected = {"x": ({"body": "copied"}, {"addedSegments": [{"text": "copied", "bodyLine": 1, "copiedFromRecord": "earlier"}], "citation": {}})}
        with self.assertRaisesRegex(ValueError, "inherited/copy"):
            wiki.body_citation(selected, "x", "copied")

    def test_fresh_quote_offsets_ignore_inherited_occurrence(self):
        body = "same quote\nInherited 🚀 context\nsame quote"
        selected = {"x": ({"body": body, "body_sha256": wiki.sha(body.encode()), "time": "2026-06-16T01:00:00Z"},
                           {"addedSegments": [{"text": "same quote", "bodyLine": 3, "copiedFromRecord": None}], "citation": {}})}
        citation = wiki.body_citation(selected, "x", "same quote")
        prefix = "same quote\nInherited 🚀 context\n"
        self.assertEqual(citation["bodyLine"], 3)
        self.assertEqual(citation["quoteUtf16Offset"], len(prefix.encode("utf-16-le")) // 2)
        self.assertEqual(citation["quoteUtf8Offset"], len(prefix.encode()))

    def test_motif_requires_shared_contribution_and_three_signatures(self):
        def edge(eid, sender, receiver, origin, report):
            return {"id": eid, "from": sender, "to": receiver, "kind": "reported-uptake", "contributionOriginVersion": origin,
                    "consumerReportVersion": report, "citations": ["test"]}
        a = edge("1", "A", "B", "origin", "B1")
        self.assertFalse(wiki.motif_gate([a, edge("2", "B", "A", "B1", "A2")])["passed"])
        self.assertFalse(wiki.motif_gate([a, edge("2", "A", "C", "different", "C1")])["passed"])
        self.assertFalse(wiki.motif_gate([a, edge("2", "B", "C", "unrelated", "C1")])["passed"])
        self.assertTrue(wiki.motif_gate([a, edge("2", "A", "C", "origin", "C1")])["passed"])
        self.assertTrue(wiki.motif_gate([a, edge("2", "B", "C", "B1", "C1")])["passed"])


class FrozenArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out = ROOT / "output/lineage-build-20261003/wiki"
        if not (cls.out / "neutral-packet.json").exists():
            raise unittest.SkipTest("Local frozen restricted packet not supplied")
        cls.packet = json.loads((cls.out / "neutral-packet.json").read_text(encoding="utf-8"))
        cls.assessment = json.loads((cls.out / "assessment.json").read_text(encoding="utf-8"))
        cls.bundle = json.loads((cls.out / "replay-bundle.json").read_text(encoding="utf-8"))
        cls.originals = {r["original"].get("rev_id", ""): r["original"] for r in cls.packet["records"]}

    def test_frozen_bytes_and_body_hashes(self):
        freeze = json.loads((self.out / "investigator-freeze.json").read_text())
        for name, digest in freeze["files"].items():
            self.assertEqual(wiki.file_sha(self.out / name), digest)
        for rid, row in self.originals.items():
            if rid:
                self.assertEqual(wiki.sha(row["body"].encode()), row["body_sha256"])

    def test_extract_refuses_frozen_initial_directory(self):
        with self.assertRaisesRegex(ValueError, "artifacts are frozen"):
            wiki.extract(ROOT, self.out)

    def test_exact_quotes_lines_offsets_and_cutoff(self):
        records = {r["id"]: r for r in self.bundle["records"]}
        entities = {e["id"]: e for e in self.bundle["entities"]}
        for edge in self.assessment["investigatorEdges"]:
            self.assertEqual(edge["availableAt"], max(c["versionTime"] for c in edge["citations"]))
            self.assertIsNone(edge["fetchedReadVersion"])
            self.assertLessEqual(entities[edge["from"]]["availableAt"], edge["availableAt"])
            self.assertLessEqual(entities[edge["to"]]["availableAt"], edge["availableAt"])
            for citation in edge["citations"]:
                rid = citation["recordId"]
                row = self.originals[rid]
                prefix = row["body"][:row["body"].index(citation["quote"])]
                self.assertEqual(len(prefix.encode("utf-16-le")) // 2, citation["quoteUtf16Offset"])
                self.assertEqual(len(prefix.encode()), citation["quoteUtf8Offset"])
                self.assertEqual(prefix.count("\n") + 1, citation["bodyLine"])
                self.assertEqual(row["body_sha256"], citation["versionSha256"])
                self.assertLessEqual(records[rid]["availableAt"], edge["availableAt"])
        first = self.assessment["investigatorEdges"][0]
        before = "2026-06-16T09:35:00Z"
        self.assertGreater(first["availableAt"], before)
        self.assertFalse(any(e["availableAt"] <= before for e in self.bundle["edges"]))

    def test_copy_and_neutrality_and_signature_limits(self):
        source = [json.loads(line) for line in (self.out / "source-records.jsonl").read_text(encoding="utf-8").splitlines()]
        copies = [s for r in source for s in r.get("addedSegments", []) if s["copiedFromRecord"]]
        self.assertEqual(len(copies), 1)
        self.assertEqual(copies[0]["copiedFromRecord"], "dse~DataUSAMaidsWageSequenceCollabOct21@4")
        self.assertNotIn("gate", self.packet)
        self.assertNotIn("investigatorEdges", self.packet)
        self.assertEqual(self.assessment["counts"]["sourceSignatures"], 15)
        self.assertIsNone(self.assessment["dimensions"]["independentlyEvidencedProducerLowerBound"])
        self.assertTrue(any(e["kind"] == "abstained" for e in self.bundle["edges"]))

    def test_future_emission_has_replay_compatible_schema(self):
        source = [json.loads(line) for line in (self.out / "source-records.jsonl").read_text(encoding="utf-8").splitlines()]
        selected = {r["id"]: (self.originals[r["id"]], r) for r in source if r["kind"] == "revisions"}
        assessed_at = "2026-10-04T04:00:00Z"
        edges = wiki.build_edges(selected, assessed_at)
        bundle = wiki.replay_bundle(selected, edges, self.assessment, assessed_at)
        entities = {entity["id"] for entity in bundle["entities"]}
        for record in bundle["records"]:
            self.assertEqual(record["text"], selected[record["id"]][0]["body"])
            self.assertEqual(record["line"], record["citation"]["decompressedJsonlLine"])
            self.assertEqual(record["extractionConfig"]["fileSha256"], record["citation"]["compressedFileSha256"])
            self.assertTrue(record["localUrl"].startswith("/api/record/"))
            self.assertEqual(record["sourceUrl"], "https://collusion.wiki/explorer")
        for edge in bundle["edges"]:
            for finding in edge["dimensions"].values():
                self.assertIn(finding["status"], ("observed", "reported", "unknown"))
                self.assertTrue(finding["evidenceIds"])
            for missing in edge["missingLinks"]:
                self.assertIsInstance(missing, dict)
                self.assertTrue(missing["evidenceIds"])
                self.assertEqual(missing["availableAt"], edge["availableAt"])
        for claim in bundle["claims"]:
            self.assertIn(claim["subjectId"], entities)
            self.assertEqual(claim["status"], "unknown")
            self.assertTrue(claim["evidenceIds"])


if __name__ == "__main__":
    unittest.main()
