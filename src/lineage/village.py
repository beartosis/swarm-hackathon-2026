"""Frozen, bounded AI Village retrieval and neutral original-record packets.

Stdlib only. Run as a file; archive records never enter process-wide lists.
Scores are retrieval hypotheses, never evidence judgments or producer counts.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import tarfile
import time
from zoneinfo import ZoneInfo


SCHEMA_VERSION = "buzzer-village-packet-1"
PT = ZoneInfo("America/Los_Angeles")
UTC = timezone.utc
READ_CUES = ("read", "used", "using", "adopted", "applied", "pulled", "merged", "based on", "thanks", "your")
WRITE_CUES = ("wrote", "created", "pushed", "uploaded", "committed", "published", "implemented", "fixed", "shared")
COORD_CUES = ("coordinate", "coordination", "together", "handoff", "shared", "merge", "review", "thanks", "your", "our", "team")
REF_PATTERN = r"https?://[^\s<>\"\)\]]+|\b[0-9a-fA-F]{7,40}\b|(?:\.?\.?/|/)[A-Za-z0-9_.@+-]+(?:/[A-Za-z0-9_.@+-]+)+|\b[A-Za-z0-9_.-]+\.(?:py|js|mjs|ts|tsx|json|md|csv|txt|html|css)\b"
REF_RE = re.compile(REF_PATTERN)


def utc_time(value):
    """Archive naive timestamps are explicitly interpreted as UTC."""
    if not value:
        return None
    try:
        result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return result.replace(tzinfo=UTC) if result.tzinfo is None else result.astimezone(UTC)
    except (ValueError, TypeError):
        return None


def iso(value):
    return value.astimezone(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z")


def bounds(start="2026-04-06", end="2026-04-13"):
    return tuple(datetime.fromisoformat(x).replace(tzinfo=PT).astimezone(UTC) for x in (start, end))


def hour_key(room, timestamp):
    return str(room) + "|" + iso(timestamp.replace(minute=0, second=0, microsecond=0))


def horizon(start, interval_start, interval_end):
    raw_start, raw_end = start - timedelta(minutes=30), start + timedelta(minutes=90)
    return {"start_utc": iso(max(raw_start, interval_start)), "end_utc_exclusive": iso(min(raw_end, interval_end)),
            "left_clipped": raw_start < interval_start, "right_clipped": raw_end > interval_end}


def sha_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def dump(path, value, exclusive=False):
    with Path(path).open("x" if exclusive else "w", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, indent=2, ensure_ascii=False, sort_keys=True)
        handle.write("\n")


def jsonl(handle, value):
    handle.write(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def iter_records(path):
    """Keep one raw gzip line and parsed row in memory; reject malformed rows."""
    with gzip.open(path, "rb") as handle:
        for line, raw in enumerate(handle, 1):
            try:
                row = json.loads(raw)
                if not isinstance(row, dict):
                    raise ValueError("record is not an object")
            except (ValueError, UnicodeDecodeError) as exc:
                raise ValueError(f"{path.name}:{line}: malformed record") from exc
            yield line, hashlib.sha256(raw).hexdigest(), row


def protocol():
    start, end = bounds()
    return {"schema_version": SCHEMA_VERSION, "start_utc": iso(start), "end_utc_exclusive": iso(end),
            "local_interval": "2026-04-06 inclusive through 2026-04-12 inclusive America/Los_Angeles",
            "eligibility": "room/UTC-clock-hour with >=2 distinct registry IDs on agent chat rows; hourly PT boundaries coincide during this interval",
            "context_minutes_before": 30, "context_minutes_after": 30, "slots_per_arm": 4,
            "seed": "buzzer-village-20261003-frozen-1", "reference_regex": REF_PATTERN,
            "read_cues": list(READ_CUES), "write_cues": list(WRITE_CUES), "coordination_cues": list(COORD_CUES),
            "cue_matching": "lowercase ASCII-word boundaries, multiword phrase literal; one count per row for each cue family",
            "scoring_dedup": "exact content SHA256 per registry speaker within anchor hour; earliest row wins",
            "candidate_formula": "8*cross_speaker_ref_uptake_pairs + 4*cross_speaker_ref_write_then_other_pairs + 2*three_speaker_refs + read_rows + write_rows",
            "pair_definition": "for each exact reference and strictly increasing timestamp pair of distinct registry speakers: uptake pair when later row has read cue; write-then-other pair when earlier row has write cue; summed over references",
            "baseline_formula": "3*cross_speaker_shared_refs + coordination_rows",
            "ranked_arm_eligibility": "eligible room-hour and score>0; unfilled slots remain null",
            "ranked_tie_break": "score descending, stable room|UTC-hour key ascending",
            "uniform_order": "SHA256(UTF8(seed + newline + stable unit key)) ascending; stable key secondary",
            "features": "anchor-hour chat content and registry-ID membership only; no context, names, summaries, future turns, vocabulary learning, or identity resolution",
            "packet_join": "all room chat within clipped horizon; all turns in horizon whose session registry ID appears in that context chat; original matching sessions; events with same room or those registry IDs; overlapping goal rows; Claude Code messages/sessions in horizon with those registry IDs",
            "time_policy": "created_at event time; archive naive timestamps interpreted UTC; null/malformed timestamps counted and excluded; equal timestamp pairs never establish order",
            "identity_policy": "registry membership is a label, not producer authentication; names are export-time retrospective labels; all producer attribution, boundaries, evaluation effects, intent, ownership, autonomy, human involvement and novelty remain unknown absent review",
            "review_budget": {"active_minutes_per_unique_packet_per_reviewer": 10},
            "prior_exposure": "known March31 a4beec2 report and previous archive-wide exploration disclosed in parent planning; reserved feasibility sample, not pristine unseen data",
            "calibration": "no calibration content used; March31 excluded from selections",
            "terms": "local restricted research outputs; AI Digest / AI Village attribution; no archive redistribution, re-identification or training"}


def freeze(archive, output):
    """Freeze protocol first, then input inventory/hashes, without parsing data."""
    freeze_started = time.monotonic()
    output.mkdir(parents=True, exist_ok=True)
    frozen = protocol()
    dump(output / "protocol.json", frozen, exclusive=True)
    names = ["manifest.json", "SCHEMA.md", "README.md", "CHANGELOG.md", "agents.jsonl.gz", "chat_rooms.jsonl.gz",
             "chat_messages.jsonl.gz", "computer_use_sessions.jsonl.gz", "computer_use_turns.jsonl.gz", "events.jsonl.gz",
             "agent_goals.jsonl.gz", "village_goals.jsonl.gz"]
    names += ["claude_code_messages.jsonl.gz", "claude_code_sessions.jsonl.gz"]
    for day in range(6, 13):
        names.append(f"images/computer-use-turns/2026-04-{day:02d}.tar")
    inputs = []
    for name in names:
        path = archive / name
        item = {"relative_path": name, "present": path.is_file()}
        if path.is_file():
            stat = path.stat()
            item.update(bytes=stat.st_size, mtime_ns=stat.st_mtime_ns, sha256=sha_file(path))
        inputs.append(item)
        print(f"frozen input {name}: {'present' if item['present'] else 'missing'}", flush=True)
    manifest = {"schema_version": SCHEMA_VERSION, "archive_root": str(archive.resolve()), "frozen_at_utc": iso(datetime.now(UTC)),
                "protocol_sha256": sha_file(output / "protocol.json"), "implementation_sha256": sha_file(Path(__file__)),
                "inputs": inputs, "status": "frozen-before-April-content-inspection", "freeze_hash_seconds": time.monotonic() - freeze_started}
    dump(output / "manifest.json", manifest, exclusive=True)
    return manifest


def validate_freeze(archive, output, rehash=False):
    manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
    if sha_file(output / "protocol.json") != manifest["protocol_sha256"]:
        raise ValueError("frozen protocol changed")
    if protocol() != json.loads((output / "protocol.json").read_text(encoding="utf-8")):
        raise ValueError("current protocol differs from frozen protocol")
    if sha_file(Path(__file__)) != manifest["implementation_sha256"]:
        raise ValueError("implementation differs from freeze; use an explicit new run/amendment")
    for item in manifest["inputs"]:
        path = archive / item["relative_path"]
        if path.is_file() != item["present"]:
            raise ValueError(f"input presence changed: {path}")
        if item["present"]:
            stat = path.stat()
            if (stat.st_size, stat.st_mtime_ns) != (item["bytes"], item["mtime_ns"]):
                raise ValueError(f"input metadata changed: {path}")
            if rehash and sha_file(path) != item["sha256"]:
                raise ValueError(f"input hash changed: {path}")
    return manifest


def cues(text, dictionary):
    return any(re.search(r"(?<!\w)" + re.escape(cue) + r"(?!\w)", text.lower()) for cue in dictionary)


def features(rows, registry):
    """Anchor-only deterministic retrieval features; no names are consumed."""
    refs = defaultdict(list)
    seen = set()
    count = Counter()
    for row in rows:
        speaker = row.get("agent_speaker_id")
        if row.get("speaker_type") != "agent" or speaker not in registry:
            continue
        content = row.get("content") or ""
        key = (speaker, hashlib.sha256(content.encode()).hexdigest())
        if key in seen:
            continue
        seen.add(key)
        stamp = utc_time(row.get("created_at"))
        read, write = cues(content, READ_CUES), cues(content, WRITE_CUES)
        count["read_rows"] += read
        count["write_rows"] += write
        count["coordination_rows"] += cues(content, COORD_CUES)
        for ref in set(match.group(0).rstrip(".,;:!?") for match in REF_RE.finditer(content)):
            refs[ref].append((stamp, speaker, read, write))
    for entries in refs.values():
        speakers = {entry[1] for entry in entries}
        count["cross_speaker_shared_refs"] += len(speakers) >= 2
        count["three_speaker_refs"] += len(speakers) >= 3
        ordered = sorted(entries)
        for index, earlier in enumerate(ordered):
            for later in ordered[index + 1:]:
                if earlier[0] < later[0] and earlier[1] != later[1]:
                    count["cross_speaker_ref_uptake_pairs"] += later[2]
                    count["cross_speaker_ref_write_then_other_pairs"] += earlier[3]
    fields = ("read_rows", "write_rows", "coordination_rows", "cross_speaker_shared_refs", "three_speaker_refs",
              "cross_speaker_ref_uptake_pairs", "cross_speaker_ref_write_then_other_pairs")
    result = {field: count[field] for field in fields}
    result["candidate_score"] = 8 * count["cross_speaker_ref_uptake_pairs"] + 4 * count["cross_speaker_ref_write_then_other_pairs"] + 2 * count["three_speaker_refs"] + count["read_rows"] + count["write_rows"]
    result["baseline_score"] = 3 * count["cross_speaker_shared_refs"] + count["coordination_rows"]
    return result


def select_units(units, seed, slots=4):
    arms = {"candidate": sorted((u for u in units if u["candidate_score"] > 0), key=lambda u: (-u["candidate_score"], u["unit_key"])),
            "baseline": sorted((u for u in units if u["baseline_score"] > 0), key=lambda u: (-u["baseline_score"], u["unit_key"])),
            "uniform": sorted(units, key=lambda u: (hashlib.sha256((seed + "\n" + u["unit_key"]).encode()).hexdigest(), u["unit_key"]))}
    selected, unique = [], {}
    for arm, ranking in arms.items():
        for index in range(slots):
            unit = ranking[index] if index < len(ranking) else None
            packet_id = "v-" + hashlib.sha256(unit["unit_key"].encode()).hexdigest()[:20] if unit else None
            selected.append({"arm": arm, "slot": index + 1, "unit_key": unit["unit_key"] if unit else None,
                             "packet_id": packet_id, "score": unit.get(arm + "_score") if unit and arm != "uniform" else None,
                             "empty_reason": "no remaining qualifying unit" if unit is None else None})
            if unit:
                unique[packet_id] = unit
    return selected, unique


def wrapper(row, source, line, raw_sha, manifest, agent_id=None):
    stamp = utc_time(row.get("created_at"))
    result = {"record_id": source.removesuffix(".jsonl.gz") + ":" + str(row.get("id") or line),
              "source": {"relative_path": source, "file_sha256": next(i["sha256"] for i in manifest["inputs"] if i["relative_path"] == source),
                         "line_1based": line, "raw_line_sha256": raw_sha, "event_time_utc": iso(stamp) if stamp else None,
                         "time_basis": "created_at; naive archive timestamps interpreted UTC", "local_original_only": True},
              "original": row}
    if agent_id:
        result["registry_agent_id"] = agent_id
    if source in ("agents.jsonl.gz", "chat_rooms.jsonl.gz"):
        result["historical_availability"] = "export-time retrospective registry metadata; not historical identity evidence"
    elif source == "computer_use_sessions.jsonl.gz":
        result["historical_availability"] = "created_at is session start; updated fields/session goal may be later metadata; never treat the full row as available at creation"
    return result


def run(archive, output):
    started = time.monotonic()
    manifest = validate_freeze(archive, output)
    if (output / "selections.json").exists():
        raise ValueError("run outputs already exist; preserve this run and use another output directory")
    frozen = json.loads((output / "protocol.json").read_text(encoding="utf-8"))
    start, end = utc_time(frozen["start_utc"]), utc_time(frozen["end_utc_exclusive"])
    registry = {}
    for line, raw_sha, row in iter_records(archive / "agents.jsonl.gz"):
        registry[row["id"]] = (line, raw_sha, row)
    db = sqlite3.connect(output / "working.sqlite3")
    db.executescript("PRAGMA journal_mode=OFF; PRAGMA temp_store=FILE; CREATE TABLE chat(unit_key TEXT, room TEXT, timestamp TEXT, speaker TEXT, original TEXT, line INTEGER, raw_sha TEXT); CREATE INDEX chat_unit ON chat(unit_key,timestamp,line); CREATE INDEX chat_time ON chat(timestamp,room); CREATE TABLE sessions(id TEXT PRIMARY KEY,agent TEXT,original TEXT,line INTEGER,raw_sha TEXT); CREATE TABLE screenshots(day TEXT,id TEXT,packet TEXT); CREATE INDEX screenshot_day ON screenshots(day,id);")
    counts = Counter()
    for name in ("claude_code_messages.jsonl.gz", "claude_code_sessions.jsonl.gz"):
        counts[name + "_interval_rows"] = 0
    for field in ("chat_missing_or_invalid_time", "interval_unknown_registry_chat_rows", "turn_missing_or_invalid_time", "horizon_turn_missing_session_foreign_key", "events_missing_or_invalid_time"):
        counts[field] = 0
    for line, raw_sha, row in iter_records(archive / "chat_messages.jsonl.gz"):
        counts["chat_rows_scanned"] += 1
        stamp = utc_time(row.get("created_at"))
        if stamp is None:
            counts["chat_missing_or_invalid_time"] += 1
            continue
        if start <= stamp < end:
            speaker = row.get("agent_speaker_id") if row.get("speaker_type") == "agent" else None
            if speaker and speaker not in registry:
                counts["interval_unknown_registry_chat_rows"] += 1
            db.execute("INSERT INTO chat VALUES (?,?,?,?,?,?,?)", (hour_key(row.get("room_id"), stamp), row.get("room_id"), iso(stamp), speaker, json.dumps(row, ensure_ascii=False), line, raw_sha))
            counts["interval_chat_rows"] += 1
    db.commit()
    units = []
    for key, room, stamp in db.execute("SELECT unit_key,room,MIN(timestamp) FROM chat GROUP BY unit_key ORDER BY unit_key"):
        speakers = {r[0] for r in db.execute("SELECT DISTINCT speaker FROM chat WHERE unit_key=?", (key,)) if r[0] in registry}
        if len(speakers) < 2:
            continue
        rows = (json.loads(r[0]) for r in db.execute("SELECT original FROM chat WHERE unit_key=? ORDER BY timestamp,line", (key,)))
        unit = {"unit_key": key, "room_id": room, "hour_start_utc": key.split("|", 1)[1], "registry_speaker_count": len(speakers),
                "chat_row_count": db.execute("SELECT COUNT(*) FROM chat WHERE unit_key=?", (key,)).fetchone()[0], **features(rows, registry)}
        units.append(unit)
    with (output / "eligible_units.jsonl").open("x", encoding="utf-8", newline="\n") as handle:
        for unit in units:
            jsonl(handle, unit)
    slots, unique = select_units(units, frozen["seed"], frozen["slots_per_arm"])
    selection = {"schema_version": SCHEMA_VERSION, "protocol_sha256": manifest["protocol_sha256"], "eligible_unit_denominator": len(units),
                 "intended_slot_denominator": len(slots), "filled_slot_count": sum(s["packet_id"] is not None for s in slots), "unique_packet_denominator": len(unique),
                 "slots": slots, "warning": "retrieval hypotheses; N<=12 overlapping/dependent windows; no precision, recall, prevalence or comparative benefit claim"}
    dump(output / "selections.json", selection, exclusive=True)
    del units
    retrieval_seconds = time.monotonic() - started
    print(f"eligible={selection['eligible_unit_denominator']} filled_slots={selection['filled_slot_count']} unique_packets={len(unique)}", flush=True)
    states = {}
    packet_root = output / "packets"
    packet_root.mkdir(exist_ok=True)
    for packet_id, unit in sorted(unique.items()):
        h = horizon(utc_time(unit["hour_start_utc"]), start, end)
        a, b = utc_time(h["start_utc"]), utc_time(h["end_utc_exclusive"])
        directory = packet_root / packet_id
        directory.mkdir()
        state = {"id": packet_id, "directory": directory, "room": unit["room_id"], "hour": unit["hour_start_utc"], "horizon": h, "a": a, "b": b,
                 "participants": set(), "sessions": set(), "counts": Counter(), "handle": (directory / "records.jsonl").open("x", encoding="utf-8", newline="\n")}
        for field in ("turn_rows", "agent_action_null_rows", "output_null_rows", "error_null_rows", "agent_messages_null_rows", "screenshot_redacted_flag_rows", "screenshots_present", "screenshots_absent", "all_agents_horizon_turn_missing_session", "claude_code_messages_rows", "claude_code_sessions_rows"):
            state["counts"][field] = 0
        states[packet_id] = state
        for original, line, raw_sha in db.execute("SELECT original,line,raw_sha FROM chat WHERE room=? AND timestamp>=? AND timestamp<? ORDER BY timestamp,line", (unit["room_id"], iso(a), iso(b))):
            row = json.loads(original)
            speaker = row.get("agent_speaker_id") if row.get("speaker_type") == "agent" else None
            if speaker in registry:
                state["participants"].add(speaker)
            jsonl(state["handle"], wrapper(row, "chat_messages.jsonl.gz", line, raw_sha, manifest, speaker))
            state["counts"]["chat_rows"] += 1
        for agent in sorted(state["participants"]):
            line, raw_sha, row = registry[agent]
            jsonl(state["handle"], wrapper(row, "agents.jsonl.gz", line, raw_sha, manifest, agent))
            state["counts"]["retrospective_registry_rows"] += 1
    for line, raw_sha, row in iter_records(archive / "computer_use_sessions.jsonl.gz"):
        counts["session_rows_scanned"] += 1
        db.execute("INSERT INTO sessions VALUES (?,?,?,?,?)", (row["id"], row.get("agent_id"), json.dumps(row, ensure_ascii=False), line, raw_sha))
    db.commit()
    for line, raw_sha, row in iter_records(archive / "computer_use_turns.jsonl.gz"):
        counts["turn_rows_scanned"] += 1
        stamp = utc_time(row.get("created_at"))
        if stamp is None:
            counts["turn_missing_or_invalid_time"] += 1
            continue
        matches = [s for s in states.values() if s["a"] <= stamp < s["b"]]
        if not matches:
            continue
        counts["turn_rows_in_any_selected_horizon"] += 1
        session = db.execute("SELECT agent,original,line,raw_sha FROM sessions WHERE id=?", (row.get("session_id"),)).fetchone()
        if session is None:
            counts["horizon_turn_missing_session_foreign_key"] += 1
            for state in matches:
                state["counts"]["all_agents_horizon_turn_missing_session"] += 1
            continue
        agent = session[0]
        for state in matches:
            state["counts"]["all_agents_horizon_turn_rows"] += 1
            if agent not in state["participants"]:
                continue
            record = wrapper(row, "computer_use_turns.jsonl.gz", line, raw_sha, manifest, agent)
            day = stamp.astimezone(PT).date().isoformat()
            record["screenshot_reference"] = {"relative_path": f"images/computer-use-turns/{day}.tar", "entry": str(row.get("id")) + ".png",
                                              "redacted_flag": row.get("screenshot_is_redacted"), "redaction_overruled": row.get("has_redaction_been_overruled"),
                                              "coverage_file": "screenshots.jsonl", "presence": "see separate verified tar index"}
            jsonl(state["handle"], record)
            state["counts"]["turn_rows"] += 1
            for field in ("agent_action", "output", "error", "agent_messages"):
                if row.get(field) is None:
                    state["counts"][field + "_null_rows"] += 1
            state["counts"]["screenshot_redacted_flag_rows"] += row.get("screenshot_is_redacted") is True
            state["sessions"].add(row["session_id"])
            db.execute("INSERT INTO screenshots VALUES (?,?,?)", (day, str(row.get("id")), state["id"]))
        if counts["turn_rows_scanned"] % 250000 == 0:
            db.commit()
            print(f"streamed turns: {counts['turn_rows_scanned']}", flush=True)
    db.commit()
    print(f"turn stream complete: {counts['turn_rows_scanned']}", flush=True)
    for state in states.values():
        for session_id in sorted(state["sessions"]):
            agent, original, line, raw_sha = db.execute("SELECT agent,original,line,raw_sha FROM sessions WHERE id=?", (session_id,)).fetchone()
            jsonl(state["handle"], wrapper(json.loads(original), "computer_use_sessions.jsonl.gz", line, raw_sha, manifest, agent))
            state["counts"]["joined_session_rows"] += 1
        state["counts"]["joined_registry_participants"] = len(state["participants"])
        state["counts"]["participants_with_no_joined_turns"] = len(state["participants"] - {r[0] for sid in state["sessions"] for r in db.execute("SELECT agent FROM sessions WHERE id=?", (sid,))})
    for line, raw_sha, row in iter_records(archive / "events.jsonl.gz"):
        counts["event_rows_scanned"] += 1
        stamp = utc_time(row.get("created_at"))
        if stamp is None:
            counts["events_missing_or_invalid_time"] += 1
            continue
        data = row.get("data") or {}
        agent = data.get("agentId") or data.get("speakerId")
        for state in states.values():
            if state["a"] <= stamp < state["b"] and (data.get("roomId") == state["room"] or agent in state["participants"]):
                jsonl(state["handle"], wrapper(row, "events.jsonl.gz", line, raw_sha, manifest, agent))
                state["counts"]["event_rows"] += 1
    for name in ("chat_rooms.jsonl.gz", "agent_goals.jsonl.gz", "village_goals.jsonl.gz"):
        if not (archive / name).is_file():
            counts[name + "_missing_file"] += 1
            continue
        for line, raw_sha, row in iter_records(archive / name):
            for state in states.values():
                if name == "chat_rooms.jsonl.gz":
                    include = row.get("id") == state["room"]
                else:
                    gs, ge = utc_time(row.get("start_time")), utc_time(row.get("end_time"))
                    include = (gs is None or gs < state["b"]) and (ge is None or ge > state["a"]) and (name == "village_goals.jsonl.gz" or row.get("agent_id") in state["participants"])
                if include:
                    record = wrapper(row, name, line, raw_sha, manifest, row.get("agent_id"))
                    if "goals" in name:
                        record["historical_availability"] = "interval fields are stated applicability, not proof of exact historical instructions; null bounds and later metadata remain unknown"
                    jsonl(state["handle"], record)
                    state["counts"][name.removesuffix(".jsonl.gz") + "_rows"] += 1
    # Do not infer execution coverage from the README's scaffold end date.
    # Check SDK-source original timestamps independently, retaining zero counts.
    for name in ("claude_code_messages.jsonl.gz", "claude_code_sessions.jsonl.gz"):
        if not (archive / name).is_file():
            counts[name + "_missing_file"] += 1
            continue
        for line, raw_sha, row in iter_records(archive / name):
            counts[name + "_rows_scanned"] += 1
            stamp = utc_time(row.get("created_at"))
            if stamp is None:
                counts[name + "_missing_or_invalid_time"] += 1
                continue
            if start <= stamp < end:
                counts[name + "_interval_rows"] += 1
            for state in states.values():
                if state["a"] <= stamp < state["b"] and row.get("agent_id") in state["participants"]:
                    jsonl(state["handle"], wrapper(row, name, line, raw_sha, manifest, row.get("agent_id")))
                    state["counts"][name.removesuffix(".jsonl.gz") + "_rows"] += 1
    screenshot_handles = {key: (state["directory"] / "screenshots.jsonl").open("x", encoding="utf-8", newline="\n") for key, state in states.items()}
    for day in range(6, 13):
        day_string = f"2026-04-{day:02d}"
        relative = f"images/computer-use-turns/{day_string}.tar"
        path = archive / relative
        wanted = {r[0] for r in db.execute("SELECT DISTINCT id FROM screenshots WHERE day=?", (day_string,))}
        found = set()
        if path.is_file() and wanted:
            with tarfile.open(path, "r|") as tar:
                for member in tar:
                    turn_id = Path(member.name).stem
                    if turn_id not in wanted or not member.isfile():
                        continue
                    digest = hashlib.sha256()
                    image = tar.extractfile(member)
                    for block in iter(lambda: image.read(1024 * 1024), b""):
                        digest.update(block)
                    found.add(turn_id)
                    for (packet_id,) in db.execute("SELECT packet FROM screenshots WHERE day=? AND id=?", (day_string, turn_id)):
                        jsonl(screenshot_handles[packet_id], {"turn_id": turn_id, "tar_relative_path": relative, "entry": member.name, "present": True,
                                                             "entry_bytes": member.size, "entry_sha256": digest.hexdigest(),
                                                             "tar_sha256": next(i["sha256"] for i in manifest["inputs"] if i["relative_path"] == relative), "local_only": True})
                        states[packet_id]["counts"]["screenshots_present"] += 1
        for missing in sorted(wanted - found):
            for (packet_id,) in db.execute("SELECT packet FROM screenshots WHERE day=? AND id=?", (day_string, missing)):
                jsonl(screenshot_handles[packet_id], {"turn_id": missing, "tar_relative_path": relative, "entry": missing + ".png", "present": False,
                                                     "reason": "tar file absent" if not path.is_file() else "entry absent; talk/bash-only or missing archive unknown"})
                states[packet_id]["counts"]["screenshots_absent"] += 1
    for packet_id, state in states.items():
        state["handle"].close()
        screenshot_handles[packet_id].close()
        source_counts, source_bytes = Counter(), Counter()
        with (state["directory"] / "records.jsonl").open("rb") as handle:
            for raw in handle:
                source_name = json.loads(raw)["source"]["relative_path"]
                source_counts[source_name] += 1
                source_bytes[source_name] += len(raw)
        packet = {"schema_version": SCHEMA_VERSION, "packet_id": packet_id, "source_attribution": "AI Digest / AI Village dataset, export 2026-09-20",
                  "anchor": {"room_id": state["room"], "hour_start_utc": state["hour"], "hour_end_utc_exclusive": iso(utc_time(state["hour"]) + timedelta(hours=1))},
                  "horizon": state["horizon"], "protocol_sha256": manifest["protocol_sha256"], "manifest_sha256": sha_file(output / "manifest.json"),
                  "records_file": "records.jsonl", "records_sha256": sha_file(state["directory"] / "records.jsonl"),
                  "screenshots_file": "screenshots.jsonl", "screenshots_sha256": sha_file(state["directory"] / "screenshots.jsonl"),
                  "coverage": dict(state["counts"]), "registry_agent_ids": sorted(state["participants"]),
                  "source_row_counts": dict(source_counts), "source_wrapper_bytes": dict(source_bytes),
                  "identity_limit": "registry labels and export-time names are not producing-agent authentication; no independently evidenced producer lower bound is asserted",
                  "join_limit": frozen["packet_join"], "source_limits": ["Exact original prompts/raw LLM-call logs not exported", "Agent memories, village-transcript rendering and publisher summaries not searched; no completeness claim", "Claude Code messages/sessions checked separately by original timestamp; SDK scaffold end date is not assumed coverage", "Null tool outputs do not prove no action or no use", "Missing screenshots and bounded horizon leave unknown/right-censored uptake", "Session updated fields and registry labels may be retrospective", "Chronological source records are not proof of causal transfer or evaluation effects"],
                  "review_budget": frozen["review_budget"], "restricted_local_research": True}
        dump(state["directory"] / "packet.json", packet, exclusive=True)
    costs = {"schema_version": SCHEMA_VERSION, "counts": dict(counts), "collection": {"archive_already_present": True, "network_requests": 0, "new_download_bytes": 0},
             "retrieval_seconds": retrieval_seconds, "extraction_join_seconds": time.monotonic() - started - retrieval_seconds,
             "freeze_hash_seconds": manifest["freeze_hash_seconds"],
             "input_compressed_bytes": sum(i.get("bytes", 0) for i in manifest["inputs"]), "scoring": "local deterministic CPU; zero model calls",
             "review": {"status": "not performed by ingestion module", "active_minutes_budget_per_packet_per_reviewer": 10,
                        "unique_packet_denominator": len(states)}, "memory_policy": "one gzip line/row, one anchor feature state, <=12 packet states; SQLite rows/indexes on disk; turn archive not materialized",
             "missingness_limit": "Global missing timestamps/foreign keys retained in counts; rows with unknown agent/session cannot be allocated to a room packet reliably"}
    dump(output / "costs.json", costs, exclusive=True)
    db.close()
    print(json.dumps({"status": "complete", "output": str(output.resolve()), "unique_packets": len(states), "costs": costs["retrieval_seconds"] + costs["extraction_join_seconds"]}), flush=True)
    return selection


def export_records(packet_path, destination, source=None, record_id=None, before=None):
    """Stream full wrappers to a local file; never silently truncate originals."""
    packet = json.loads(packet_path.read_text(encoding="utf-8"))
    path = packet_path.parent / packet["records_file"]
    if sha_file(path) != packet["records_sha256"]:
        raise ValueError("packet originals changed")
    count = 0
    with path.open("rb") as incoming, destination.open("xb") as outgoing:
        for raw in incoming:
            record = json.loads(raw)
            if source and record["source"]["relative_path"] != source:
                continue
            if record_id and record["record_id"] != record_id:
                continue
            if before:
                stamp = utc_time(record["source"]["event_time_utc"])
                if stamp is None or stamp >= utc_time(before) or "historical_availability" in record:
                    continue
            outgoing.write(raw)
            count += 1
    return {"exported_records": count, "bytes": destination.stat().st_size, "sha256": sha_file(destination),
            "path": str(destination.resolve()), "filter": {"source": source, "record_id": record_id, "before_utc_exclusive": before},
            "cutoff_limit": "--before excludes all retrospective metadata wrappers; it is a source filter, not a reconstructed historical prompt"}


def verify_packets(archive, output, manifest):
    """Verify full original rows against their frozen gzip line, using disk index."""
    index = sqlite3.connect("")  # SQLite-managed temporary on-disk database.
    index.execute("CREATE TABLE wanted(source TEXT,line INTEGER,raw_sha TEXT,original_sha TEXT,found INTEGER DEFAULT 0,PRIMARY KEY(source,line))")
    sources = set()
    packet_count, wrapper_count = 0, 0
    inputs = {item["relative_path"]: item for item in manifest["inputs"]}
    for packet_path in sorted((output / "packets").glob("*/packet.json")):
        packet_count += 1
        packet = json.loads(packet_path.read_text(encoding="utf-8"))
        for field in ("records", "screenshots"):
            if sha_file(packet_path.parent / packet[field + "_file"]) != packet[field + "_sha256"]:
                raise ValueError(f"packet digest mismatch: {packet_path}")
        with (packet_path.parent / packet["records_file"]).open("rb") as handle:
            for raw in handle:
                wrapper_count += 1
                record = json.loads(raw)
                source = record["source"]
                name, line = source["relative_path"], source["line_1based"]
                if source["file_sha256"] != inputs[name]["sha256"]:
                    raise ValueError(f"wrapper input digest mismatch: {record['record_id']}")
                original_sha = hashlib.sha256(json.dumps(record["original"], sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
                existing = index.execute("SELECT raw_sha,original_sha FROM wanted WHERE source=? AND line=?", (name, line)).fetchone()
                if existing and existing != (source["raw_line_sha256"], original_sha):
                    raise ValueError("inconsistent overlapping original wrappers")
                index.execute("INSERT OR IGNORE INTO wanted(source,line,raw_sha,original_sha) VALUES (?,?,?,?)", (name, line, source["raw_line_sha256"], original_sha))
                sources.add(name)
    index.commit()
    for name in sorted(sources):
        for line, raw_sha, row in iter_records(archive / name):
            expected = index.execute("SELECT raw_sha,original_sha FROM wanted WHERE source=? AND line=?", (name, line)).fetchone()
            if expected is None:
                continue
            original_sha = hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
            if expected != (raw_sha, original_sha):
                raise ValueError(f"original provenance mismatch: {name}:{line}")
            index.execute("UPDATE wanted SET found=1 WHERE source=? AND line=?", (name, line))
        index.commit()
        print(f"verified original lines: {name}", flush=True)
    missing = index.execute("SELECT COUNT(*) FROM wanted WHERE found=0").fetchone()[0]
    if missing:
        raise ValueError(f"{missing} original source lines missing")
    result = {"status": "verified", "packet_count": packet_count, "wrapper_count": wrapper_count,
              "distinct_original_lines": index.execute("SELECT COUNT(*) FROM wanted").fetchone()[0],
              "sources": sorted(sources), "original_raw_hash_and_parsed_payload_verified": True}
    index.close()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("freeze", "run", "verify", "records"))
    parser.add_argument("--archive", type=Path, default=Path("ai-village"))
    parser.add_argument("--output", type=Path, default=Path("output/lineage-build-20261003/village"))
    parser.add_argument("--packet", type=Path)
    parser.add_argument("--destination", type=Path)
    parser.add_argument("--source")
    parser.add_argument("--record-id")
    parser.add_argument("--before")
    args = parser.parse_args()
    if args.command == "freeze":
        freeze(args.archive, args.output)
    elif args.command == "run":
        run(args.archive, args.output)
    elif args.command == "records":
        if not args.packet or not args.destination:
            parser.error("records requires --packet and --destination")
        print(json.dumps(export_records(args.packet, args.destination, args.source, args.record_id, args.before)))
    else:
        started = time.monotonic()
        manifest = validate_freeze(args.archive, args.output, rehash=True)
        result = verify_packets(args.archive, args.output, manifest)
        result["verification_seconds"] = time.monotonic() - started
        dump(args.output / "verification.json", result)
        print(json.dumps(result))


if __name__ == "__main__":
    main()
