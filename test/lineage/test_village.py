import gzip
import hashlib
import importlib.util
import json
import io
from pathlib import Path
import tarfile
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("village", Path(__file__).resolve().parents[2] / "src/lineage/village.py")
v = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(v)


def row(speaker, content, stamp="2026-04-06 07:10:00", room="room", rid="x"):
    return {"id": rid, "speaker_type": "agent", "agent_speaker_id": speaker, "content": content, "created_at": stamp, "room_id": room}


class VillageTests(unittest.TestCase):
    def test_timezone_interval_and_clip(self):
        start, end = v.bounds()
        self.assertEqual(v.iso(start), "2026-04-06T07:00:00.000000Z")
        self.assertEqual(v.iso(end), "2026-04-13T07:00:00.000000Z")
        self.assertEqual(v.utc_time("2026-04-06 07:00:00"), start)
        self.assertEqual(v.utc_time("2026-04-06T00:00:00-07:00"), start)
        first = v.horizon(start, start, end)
        last = v.horizon(end - v.timedelta(hours=1), start, end)
        self.assertTrue(first["left_clipped"])
        self.assertTrue(last["right_clipped"])
        self.assertEqual(last["end_utc_exclusive"], v.iso(end))
        self.assertLess(v.iso(start), v.iso(start + v.timedelta(microseconds=1)))

    def test_anchor_features_ref_pairs_and_same_speaker_echoes(self):
        original = row("a", "I pushed commit a4beec2", rid="1")
        echo = row("a", "I pushed commit a4beec2", "2026-04-06 07:20:00", rid="2")
        uptake = row("b", "I used your commit a4beec2", "2026-04-06 07:30:00", rid="3")
        result = v.features([original, echo, uptake], {"a", "b"})
        self.assertEqual(result["cross_speaker_ref_uptake_pairs"], 1)
        self.assertEqual(result["cross_speaker_ref_write_then_other_pairs"], 1)
        self.assertEqual(result["candidate_score"], 14)
        self.assertEqual(result["baseline_score"], 4)
        tied = v.features([original, row("b", "I used a4beec2")], {"a", "b"})
        self.assertEqual(tied["cross_speaker_ref_uptake_pairs"], 0)
        same = v.features([original, row("a", "I used a4beec2", "2026-04-06 07:30:00")], {"a"})
        self.assertEqual(same["cross_speaker_shared_refs"], 0)
        unknown = v.features([original, uptake], {"a"})
        self.assertEqual(unknown["cross_speaker_shared_refs"], 0)

    def test_selection_keeps_twelve_slots_and_overlap(self):
        units = [{"unit_key": "r|1", "candidate_score": 0, "baseline_score": 0},
                 {"unit_key": "r|2", "candidate_score": 2, "baseline_score": 3}]
        slots, unique = v.select_units(units, "fixed")
        self.assertEqual(len(slots), 12)
        self.assertEqual(len(unique), 2)
        self.assertEqual(sum(s["packet_id"] is not None for s in slots), 4)
        self.assertEqual(slots[0]["packet_id"], slots[4]["packet_id"])
        self.assertEqual(v.select_units(list(reversed(units)), "fixed"), (slots, unique))
        self.assertEqual(sum(s["packet_id"] is not None for s in v.select_units([], "fixed")[0]), 0)

    def test_raw_line_hash_and_malformed_rows(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "x.jsonl.gz"
            raw = b'{ "id": "r", "content": "unaltered" }\r\n'
            with gzip.open(path, "wb") as handle:
                handle.write(raw)
            line, digest, original = next(v.iter_records(path))
            self.assertEqual(line, 1)
            self.assertEqual(digest, hashlib.sha256(raw).hexdigest())
            self.assertEqual(original["content"], "unaltered")
            with gzip.open(path, "wb") as handle:
                handle.write(b'[]\n')
            with self.assertRaises(ValueError):
                list(v.iter_records(path))

    def test_verified_screenshot_entry_preserves_local_original(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive, output = Path(tmp) / "archive", Path(tmp) / "output"
            archive.mkdir()
            for name in ("manifest.json", "README.md", "SCHEMA.md", "CHANGELOG.md"):
                (archive / name).write_text("{}", encoding="utf-8")
            sources = {"agents": [{"id": "a"}, {"id": "b"}], "chat_rooms": [],
                       "chat_messages": [row("a", "hello", rid="1"), row("b", "hello", rid="2")],
                       "computer_use_sessions": [{"id": "s", "agent_id": "a"}],
                       "computer_use_turns": [{"id": "t", "session_id": "s", "created_at": "2026-04-06 07:15:00", "screenshot_is_redacted": True}],
                       "events": [], "agent_goals": [], "claude_code_messages": [], "claude_code_sessions": []}
            for name, records in sources.items():
                with gzip.open(archive / (name + ".jsonl.gz"), "wt", encoding="utf-8") as handle:
                    for record in records:
                        handle.write(json.dumps(record) + "\n")
            directory = archive / "images/computer-use-turns"
            directory.mkdir(parents=True)
            image_bytes = b"synthetic-redacted-image-placeholder"
            with tarfile.open(directory / "2026-04-06.tar", "w") as tar:
                member = tarfile.TarInfo("t.png")
                member.size = len(image_bytes)
                tar.addfile(member, io.BytesIO(image_bytes))
            v.freeze(archive, output)
            v.run(archive, output)
            packet_path = next((output / "packets").glob("*/packet.json"))
            packet = json.loads(packet_path.read_text())
            self.assertEqual(packet["coverage"]["screenshots_present"], 1)
            self.assertEqual(packet["coverage"]["screenshots_absent"], 0)
            self.assertEqual(packet["coverage"]["screenshot_redacted_flag_rows"], 1)
            screenshot = json.loads((packet_path.parent / "screenshots.jsonl").read_text())
            self.assertEqual(screenshot["entry_sha256"], hashlib.sha256(image_bytes).hexdigest())
            self.assertTrue(screenshot["local_only"])
            self.assertFalse((packet_path.parent / "t.png").exists())

    def test_end_to_end_neutral_packet_and_future_filter(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive, output = Path(tmp) / "archive", Path(tmp) / "output"
            archive.mkdir()
            for name in ("manifest.json", "README.md", "SCHEMA.md", "CHANGELOG.md"):
                (archive / name).write_text("{}", encoding="utf-8")
            source = {
                "agents": [{"id": "a", "name": "Export name A"}, {"id": "b", "name": "Export name B"}],
                "chat_rooms": [{"id": "room", "name": "Export room"}],
                "chat_messages": [row("a", "I pushed a4beec2", rid="1"), row("b", "I used your a4beec2", "2026-04-06 07:30:00", rid="2"),
                                  row("a", "outside interval", "2026-04-13 07:00:00", rid="3")],
                "computer_use_sessions": [{"id": "s", "agent_id": "b", "created_at": "2026-04-01 00:00:00", "updated_at": "2026-05-01 00:00:00", "session_goal": "future metadata"}],
                "computer_use_turns": [{"id": "t", "session_id": "s", "created_at": "2026-04-06 07:40:00", "agent_action": {"command": "example"}, "output": None, "agent_messages": {"full": "original"}},
                                       {"id": "u", "session_id": "missing", "created_at": "2026-04-06 07:41:00"},
                                       {"id": "z", "session_id": "s", "created_at": "2026-04-06 08:30:00"}],
                "events": [], "agent_goals": [], "claude_code_messages": [], "claude_code_sessions": []}
            for name, records in source.items():
                with gzip.open(archive / (name + ".jsonl.gz"), "wt", encoding="utf-8") as handle:
                    for record in records:
                        handle.write(json.dumps(record) + "\n")
            v.freeze(archive, output)
            selection = v.run(archive, output)
            self.assertEqual(selection["eligible_unit_denominator"], 1)
            packet_path = next((output / "packets").glob("*/packet.json"))
            packet = json.loads(packet_path.read_text())
            self.assertNotIn("candidate_score", packet)
            self.assertNotIn("slots", packet)
            self.assertEqual(packet["coverage"]["turn_rows"], 1)
            self.assertEqual(packet["coverage"]["output_null_rows"], 1)
            self.assertEqual(packet["coverage"]["all_agents_horizon_turn_missing_session"], 1)
            self.assertEqual(packet["coverage"]["screenshots_absent"], 1)
            originals = [json.loads(raw) for raw in (packet_path.parent / "records.jsonl").read_text().splitlines()]
            turn = next(r for r in originals if r["record_id"] == "computer_use_turns:t")
            self.assertEqual(turn["original"], source["computer_use_turns"][0])
            self.assertEqual(turn["registry_agent_id"], "b")
            session = next(r for r in originals if r["record_id"] == "computer_use_sessions:s")
            self.assertIn("later", session["historical_availability"])
            exported = Path(tmp) / "cutoff.jsonl"
            info = v.export_records(packet_path, exported, before="2026-04-06T07:35:00Z")
            self.assertEqual(info["exported_records"], 2)
            manifest = v.validate_freeze(archive, output, rehash=True)
            verified = v.verify_packets(archive, output, manifest)
            self.assertTrue(verified["original_raw_hash_and_parsed_payload_verified"])
            altered = next(r for r in originals if r["record_id"] == "computer_use_turns:t")
            altered["original"]["output"] = "fabricated"
            records_path = packet_path.parent / "records.jsonl"
            records_path.write_text("".join(json.dumps(r) + "\n" for r in originals), encoding="utf-8")
            packet["records_sha256"] = v.sha_file(records_path)
            v.dump(packet_path, packet)
            with self.assertRaisesRegex(ValueError, "original provenance mismatch"):
                v.verify_packets(archive, output, manifest)
            (output / "protocol.json").write_text("{}")
            with self.assertRaisesRegex(ValueError, "protocol changed"):
                v.validate_freeze(archive, output)


if __name__ == "__main__":
    unittest.main()
