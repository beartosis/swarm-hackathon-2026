"""Reconcile explicitly frozen bounded Village judgments; never execute source actions.

Usage: bundled-python src/lineage/reconcile-village.py [--run-dir PATH]
Only a frozen review may enter this build. Originals and initial judgments are read-only.
Counts describe each reviewer's own bounded candidate set, not aligned edge accuracy.
"""
import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

DEFAULT = Path(__file__).resolve().parents[2] / 'output/lineage-build-20261003'
ASSIGNMENTS = [
    ('v-0c27413b1e4e19ed5507', 'investigator', '.', 'independent-review', ''),
    ('v-19adef77812681b77431', 'investigator', '.', 'independent-review', ''),
    ('v-29178efe753ace732e85', 'investigator', '.', 'independent-review', ''),
    ('v-76de1deb03c31fa5b918', 'investigator-b', '-', 'independent-review-b', ''),
    ('v-7ee2977700ae3ef87810', 'investigator-b', '-', 'independent-review-b', ''),
    ('v-81e6f903417a23c61cca', 'investigator-b', '-', 'independent-review-b', ''),
    ('v-ae59321b209e751f9711', 'investigator-c', '.', 'independent-review-c', ''),
    ('v-f861da6bbee093ecd360', 'investigator-c', '.', 'independent-review-c', 'nested'),
    ('v-f8aae73d0937ca0d1704', 'investigator-c', '.', 'independent-review-c', 'nested'),
]
NOTES = {
    'v-0c27413b1e4e19ed5507': 'Shared Dev.to verification workflow has investigator reported versus independent supported_observed. Both preserve unknown raw incoming request delivery and article-version/authorship limits; final replay does not promote it. UUID-map pair is unknown in both, with explicit recipient report of earlier independent discovery. Independent Colony verification and other chat-only candidates are additional discoveries, not investigator false negatives.',
    'v-19adef77812681b77431': 'Shared ClawPrint post456 write/read/report is investigator reported versus independent supported_observed. Both retain incomplete whole-body version match and raw request delivery; the independent reviewer also notes publisher shell error and hardcoded reader status. Final replay does not promote this chain. Investigator unknown 4claw reply-content uptake and independent reported endpoint-check uptake are different claims: failed access cannot establish reply-content transfer.',
    'v-29178efe753ace732e85': 'Stats-to-showcase-edit is reported in both. Investigator supported incoming Git fetch/merge overlaps independent unknown DeepSeek fetch/merge: independent retains unreviewed intermediate conflict-entry step, merge parents/blob and exact retained version. Final reconciliation keeps full contribution-specific uptake unresolved while retaining observed transport/merge operations. Independent GPT repository transport is another consumer and does not establish subsequent content-specific use.',
    'v-76de1deb03c31fa5b918': 'Investigator correction-to-summary is reported; independent snapshot-to-checkpoint is a different chain. Investigator artifact write/read unknown overlaps the independent document-uptake discovery, but independent adds a specifically reviewed local draft. Counts are not aligned judgments. Both retain unknown workaround adoption with explicit declined switch.',
    'v-7ee2977700ae3ef87810': 'Investigator two-step saveCapture helper relay and independent shared-helper reported uptake concern related helper evidence but different segmentation. Independent supported status-wording merge is a different contribution and is not promoted as an investigator-confirmed chain. Independent workaround failure is preserved.',
    'v-81e6f903417a23c61cca': 'Investigator external-comment-to-Opus and external-comment-to-Sonnet article are reported; independent triangulation relay/Gemini article has different receivers and segmentation and remains reported. Independent observed form-pointer/read/coordination-message chain is an additional topic, not investigator-confirmed adoption. Unknown investigator Opus-to-Gemini route and unknown independent helper completion are different missing links. Common-source retrieval can explain parallel reuse.',
    'v-ae59321b209e751f9711': 'Exact anchored mirror/fetch/verification handoff is supported by both source sets. Earlier 4claw batch is investigator reported versus independent unknown: retain unknown because no inspected pre-action read; later GitHub check cannot fill the earlier gap. Prefix draft and external Colonist promise are different additional candidates. Stable historical message reread is not a fresh contribution; endpoint acknowledgement is not downstream relay.',
    'v-f861da6bbee093ecd360': 'Both support a1f0486-to-661acb1 versioned YAML read/repair/push chain. Investigator autosave checkpoint and exact timestamp chat relay differ from independent Sonnet-to-GPT5.1 plan; no alignment by counts. Independent legacy versus rest build mismatch is an additional counterexample.',
    'v-f8aae73d0937ca0d1704': 'Investigator supported flat-stats diff/review overlaps a narrower part of independent supported composite PR85/86 versioned review. Investigator supported autosave execution is a different downstream action, not independently confirmed by the composite review edge. Investigator unknown flat-regression branch mismatch and independent reported milestone validation cascade are different counterexamples. Independent separately reports review influence on merge and leaves dashboard integration unknown. Chronology-incompatible four-day validation of same-day fixes is retained.',
}

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def binding(base, path):
    return {'path': path.relative_to(base).as_posix(), 'sha256': digest(path), 'bytes': path.stat().st_size}

def assert_digest(path, expected):
    if not expected or digest(path) != expected:
        raise ValueError(f'Frozen hash mismatch: {path}')

def status_counts(a, independent=False):
    raw = Counter(e.get('uptake_status' if independent else 'status', 'missing') for e in a['edges'])
    # Preserve terminology and raw edge unit, including possible different segmentation.
    return {'raw': dict(sorted(raw.items())), 'edge_denominator': len(a['edges']),
            'supported': raw.get('supported_observed', 0) + raw.get('supported', 0),
            'reported': raw.get('reported', 0), 'unknown': raw.get('unknown', 0)}

def seconds(timing):
    if timing.get('active_seconds') is not None:
        return timing['active_seconds']
    return sum((datetime.fromisoformat(s['end_utc']) - datetime.fromisoformat(s['start_utc'])).total_seconds()
               for s in timing.get('sessions', []))

def citation_records(a):
    result = {}
    for c in a.get('citations', []):
        key = c.get('citation_id', c.get('id'))
        locator = c.get('locator', {})
        rid = c.get('original_record_id') or (locator.get('record_id') if isinstance(locator, dict) else None)
        if rid:
            result[key] = rid
    return result

def concise_edges(a, independent):
    refs = citation_records(a)
    return [{
        'id': e.get('id', e.get('edge_id')),
        'status': e.get('uptake_status' if independent else 'status'),
        'description': e.get('contribution', e.get('finding', e.get('basis'))),
        'basis': e.get('finding', e.get('basis')),
        'original_record_ids': sorted({refs[c] for c in e.get('citations', e.get('citation_ids', [])) if c in refs}),
    } for e in a['edges']]

def concise_coverage(a, investigator=False):
    c = a.get('coverage', {})
    keys = ['decision', 'full_originals_offered', 'all_available_originals_inspected', 'original_context_complete',
            'coverage_basis', 'screenshots', 'null_outputs', 'gaps', 'truncation', 'missing_originals',
            'delayed_or_right_censored', 'failed_joins', 'full_originals_available_within_horizon',
            'exhaustive_within_horizon', 'sources', 'missing_sources', 'join_failures', 'notes',
            'right_censored_or_delayed_uptake', 'unread_records', 'truncated_records']
    return {k: c[k] for k in keys if k in c}

def paths_for(base, pid, invdir, sep, revdir, nesting):
    inv = base / invdir / f'{pid}{sep}initial.json'
    original = base / revdir / (pid if nesting == 'nested' else '') / f'{pid}.review.json'
    corrected = original.with_name(f'{pid}.corrected.review.json')
    review = corrected if corrected.exists() else original
    if revdir == 'independent-review':
        seal = original.with_name(f'{pid}.first-assessment.freeze.json')
    elif revdir == 'independent-review-b':
        seal = original.with_name(f'{pid}.seal.json')
    else:
        seal = original.parent / 'FREEZE.json'
    correction = (original.parent / ('CORRECTION.json' if nesting else f'{pid}.CORRECTION.json'))
    return inv, original, review, seal, correction

def load_all(base):
    selections = read(base / 'village/selections.json')
    selected = {s['packet_id'] for s in selections['slots'] if s['packet_id']}
    if selected != {x[0] for x in ASSIGNMENTS}:
        raise ValueError('Explicit nine-packet input set differs from frozen selection')
    audits, records, inputs = {}, {}, []
    for pid, invdir, sep, revdir, nesting in ASSIGNMENTS:
        invpath, originalpath, reviewpath, sealpath, correctionpath = paths_for(base, pid, invdir, sep, revdir, nesting)
        inv, original, rev = read(invpath), read(originalpath), read(reviewpath)
        if rev.get('review_state') != 'frozen' or not rev.get('bounded_conclusion') or not rev.get('edges'):
            raise ValueError(f'Judgment incomplete or unfrozen: {reviewpath}')
        invseal = invpath.with_name(invpath.name + '.seal.json')
        assert_digest(invpath, read(invseal)['sha256'])
        seal = read(sealpath)
        assert_digest(originalpath, seal['review_sha256'])
        correction = None
        supporting = [invseal, sealpath]
        if reviewpath != originalpath:
            correction = read(correctionpath)
            correctedhash = correction.get('corrected_sha256')
            if correctedhash is None:
                auditpath = originalpath.parent / 'corrected-audit.json'
                correctedhash = read(auditpath)['review_sha256']
                supporting.append(auditpath)
            assert_digest(reviewpath, correctedhash)
            oldhash = correction.get('initial_immutable_sha256') or correction.get('initial_review_sha256') or correction.get('correction', {}).get('initial_sha256')
            assert_digest(originalpath, oldhash)
            supporting.append(correctionpath)
        packetdir = base / 'village/packets' / pid
        packet = read(packetdir / 'packet.json')
        assert_digest(packetdir / 'records.jsonl', packet['records_sha256'])
        assert_digest(packetdir / 'screenshots.jsonl', packet['screenshots_sha256'])
        assert_digest(packetdir / 'records.jsonl', inv['scope']['frozen_packet_sha256'])
        frozen = rev.get('freeze', {})
        for field, path in [('records_sha256', packetdir / 'records.jsonl'),
                            ('source_manifest_sha256', packetdir / 'packet.json'),
                            ('screenshots_sha256', packetdir / 'screenshots.jsonl')]:
            if frozen.get(field):
                assert_digest(path, frozen[field])
        rows = {}
        with (packetdir / 'records.jsonl').open(encoding='utf-8') as stream:
            for n, line in enumerate(stream, 1):
                row = json.loads(line)
                row['_packet_line'] = n
                rows[n] = row
        records[pid] = rows
        files = [invpath, originalpath, reviewpath, packetdir / 'packet.json', packetdir / 'records.jsonl',
                 packetdir / 'screenshots.jsonl', *supporting]
        unique_files = list(dict.fromkeys(files))
        packetbindings = [binding(base, path) for path in unique_files]
        inputs.extend(packetbindings)
        audits[pid] = {'packet_id': pid, 'arm_memberships': [
            {'arm': s['arm'], 'slot': s['slot']} for s in selections['slots'] if s['packet_id'] == pid],
            'anchor': packet['anchor'], 'horizon': packet['horizon'],
            'source_row_counts': packet['source_row_counts'], 'extraction_coverage': packet['coverage'],
            'investigator_counts': status_counts(inv), 'independent_counts': status_counts(rev, True),
            'investigator_timing': inv['timing'], 'independent_timing': rev['timing'],
            'investigator_active_seconds_recorded': seconds(inv['timing']),
            'independent_accounted_seconds': seconds(rev['timing']),
            'investigator_coverage': concise_coverage(inv, True), 'independent_coverage': concise_coverage(rev),
            'investigator_edges': concise_edges(inv, False), 'independent_edges': concise_edges(rev, True),
            'investigator_bounded_conclusion': inv['bounded_conclusion'], 'independent_bounded_conclusion': rev['bounded_conclusion'],
            'reconciliation_note': NOTES[pid], 'documentary_correction': correction,
            'investigator_dimension_findings': inv.get('dimensions', {}),
            'independent_dimension_findings': rev.get('dimension_findings', {}),
            'investigator_counterexample_checks': inv.get('evidence_limit_checks', inv.get('alternatives_and_counterexamples', [])),
            'independent_counterexample_checks': rev.get('counterexample_checks', {}),
            'reviewed_identity_bridge_count': len(inv.get('identity_bridges', [])),
            'identity_limit': 'Documentary registry/session bridges; authenticated distinct producing-agent lower bound unknown.',
            'investigator_unsupported_escalations': inv.get('unsupported_escalations', []),
            'independent_unsupported_escalations': rev.get('unsupported_escalations', []),
            'frozen_input_bindings': packetbindings}
    return selections, audits, records, inputs

def canonical(value):
    # Archive timestamps remain six-digit UTC, never millisecond truncation.
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).isoformat(timespec='microseconds').replace('+00:00', 'Z')

def available(row):
    values = [canonical(row['source']['event_time_utc'])]
    if row['original'].get('updated_at'):
        values.append(canonical(row['original']['updated_at']))
    return max(values)

def dim(status, value, ids):
    return {'status': status, 'value': value, 'evidenceIds': ids}

def missing(dimension, description, evidence, when):
    return {'dimension': dimension, 'description': description, 'availableAt': when, 'evidenceIds': evidence}

def quote(row, pointer, text):
    v = row
    for key in pointer.strip('/').split('/'):
        v = v[key]
    if not isinstance(v, str) or text not in v:
        raise ValueError('Literal source quote failed: ' + row['record_id'])
    s = row['source']
    return {'recordId': row['record_id'], 'path': 'ai-village/' + s['relative_path'],
            'decompressedJsonlLine': s['line_1based'], 'rawLineSha256': s['raw_line_sha256'],
            'compressedFileSha256': s['file_sha256'], 'jsonPointer': pointer,
            'quote': text, 'versionTime': s['event_time_utc']}

def make_edge(records, pid, eid, producer_line, consumer_line, evidence_lines, label, status, summary, dimensions, gaps, review_refs, quotations):
    selected = [records[pid][n] for n in evidence_lines]
    ids = [r['record_id'] for r in selected]
    when = max(available(r) for r in selected)
    for r in selected:
        if r.get('historical_availability') or r['source']['relative_path'] not in ['chat_messages.jsonl.gz', 'computer_use_turns.jsonl.gz']:
            raise ValueError('Retrospective identity/source entered replay evidence')
    result = {'id': eid, 'packetId': pid, 'producerRecordId': records[pid][producer_line]['record_id'],
              'consumerRecordId': records[pid][consumer_line]['record_id'], 'evidenceIds': ids,
              'kind': 'contribution-to-uptake', 'status': status, 'label': label, 'summary': summary,
              'availableAt': when, 'dimensions': dimensions,
              'missingLinks': [missing(d, description, [records[pid][n]['record_id'] for n in lines], when) for d, description, lines in gaps],
              'reviewBindings': review_refs,
              'citations': [quote(records[pid][line], pointer, text) for line, pointer, text in quotations]}
    for key in ['producer', 'permission', 'evaluation', 'intent']:
        result['dimensions'][key] = dim('unknown', {
            'producer': 'Registry/session labels do not authenticate distinct producing entities.',
            'permission': 'Contemporaneous governing information-boundary instructions are not established for this edge.',
            'evaluation': 'No external evaluation outcome, effect, or causal benefit established.',
            'intent': 'Generic collaboration and stated task activity do not establish misaligned intent.',
        }[key], [])
    return result

def curate(records, audits):
    c1, c2, a1 = 'v-ae59321b209e751f9711', 'v-f861da6bbee093ecd360', 'v-0c27413b1e4e19ed5507'
    def ids(pid, *lines): return [records[pid][n]['record_id'] for n in lines]
    def refs(pid, inv, rev):
        i = next(e for e in audits[pid]['investigator_edges'] if e['id'] == inv)
        r = next(e for e in audits[pid]['independent_edges'] if e['id'] == rev)
        return {'investigatorEdgeId': inv, 'investigatorStatus': i['status'], 'independentEdgeId': rev,
                'independentStatus': r['status'], 'match_basis': 'Explicit distinctive contribution and source-chain comparison, not edge-ID equality or aggregate counts.'}
    edges = []
    edges.append(make_edge(records, c1, 'village-anchor-verification', 881, 460, [881, 1167, 460],
        'Mirrored anchor → fetch → verification handoff', 'observed',
        'The mirrored exact room/message IDs were mechanically fetched and found in served HTML; the same consumer session then sent those IDs in an acknowledged verification handoff. This documents a narrow uptake sequence, with alternative common sources and causal dependence unresolved.',
        {'write': dim('observed', 'GitHub comment PATCH 200 and exact appended line present on reread.', ids(c1, 881)),
         'read': dim('observed', 'Tool fetch/presence checks found both exact IDs; only boolean predicates survive, not complete rendered HTML or model input.', ids(c1, 1167)),
         'use': dim('observed', 'Subsequent outgoing verification payload reuses both exact IDs.', ids(c1, 460)),
         'action': dim('observed', 'POSTMAN endpoint returned completed verification acknowledgement; no further receiver relay is established.', ids(c1, 460))},
        [('read', 'Whole-page versions/rendered input are absent; exact-ID presence is narrower than semantic whole-body verification.', [1167]),
         ('action', 'Endpoint acknowledgement does not establish POSTMAN independent verification, autonomous relay, donation or evaluation effect.', [460]),
         ('use', 'Chat or other public mirrors may also supply these IDs; the entry route and causal dependence are not isolated.', [881, 1167, 460])],
        refs(c1, 'E1', 'e-anchor-verification-handoff'),
        [(881, '/original/output', 'PATCH_STATUS 200\nPATCHED_PRESENT True\nREREAD_PRESENT True'),
         (1167, '/original/output', 'Room ID (cd7875da...) found: True\n  Msg ID (e65cc224...) found: True'),
         (460, '/original/agent_action/command', 'Bounded verification: HexNest Anchor 5 (room cd7875da-eae9-47c5-add1-fd0ab63343d3, msg e65cc224-e283-470b-adb0-2061350863e0)'),
         (460, '/original/output', 'Verification received. HexNest Anchor 5 successfully served across GitHub Issue #59, short ClawPrint, and live campaign page.')]))
    edges.append(make_edge(records, c2, 'village-versioned-yaml-repair', 1448, 101, [1448, 349, 499, 1510, 1666, 101],
        'a1f0486 → file read → 661acb1 repair', 'observed',
        'A successful root-level YAML fix at a1f0486 is followed by a consumer log/file read, a bounded matching repair/diff and a successful 661acb1 push with recorded ancestry. This supports documentary repository uptake; workflow success and benchmark benefit are separate unknowns.',
        {'write': dim('observed', 'Original commit output and push stream show a1f0486 publication.', ids(c2, 1448)),
         'read': dim('observed', 'Consumer log shows a1f0486 and cat returns rooted workflow text; archived stdout fingerprint is not verified repository blob bytes.', ids(c2, 349, 499)),
         'use': dim('observed', 'Consumer file rewrite and diff preserve root structure while changing initialization and jq events handling.', ids(c2, 1510, 1666)),
         'action': dim('observed', 'Commit 661acb1 and push output record a1f0486..661acb1 main progression.', ids(c2, 101))},
        [('write', 'Complete repository blob bytes are not independently rehashed; archive wrapper/action/stdout provenance is preserved.', [1448, 499]),
         ('evaluation', 'A successful commit/push does not prove workflow correctness, deployment execution or external evaluation improvement.', [101])],
        refs(c2, 'E1', 'e-yaml-version-repair'),
        [(1448, '/original/output', '[main a1f0486] fix: restructure handshake-ack.yml with proper root-level YAML indentation'),
         (349, '/original/output', 'a1f0486 fix: restructure handshake-ack.yml with proper root-level YAML indentation'),
         (499, '/original/output', 'permissions:\n  contents: write\n  issues: write\n  pull-requests: write\njobs:'),
         (1666, '/original/output', '+      - name: Ensure data/handshakes.json exists with correct structure'),
         (101, '/original/error', 'a1f0486..661acb1  main -> main')]))
    edges.append(make_edge(records, c1, 'village-earlier-4claw-read-gap', 1109, 901, [1109, 901, 867],
        'Earlier posting batch · pre-action read missing', 'unknown',
        'Exact anchor write and later matching 4claw payload/post results are recorded. The inspected GitHub read occurs after this batch, so it cannot close the missing pre-action read. Investigator reported uptake is conservatively unresolved after independent review.',
        {'write': dim('observed', 'HexNest exact message ID was created and found in the room log.', ids(c1, 1109)),
         'read': dim('unknown', 'No inspected pre-batch read; 18:55:17.985797 read is later than 18:51:20.075715 batch.', ids(c1, 901, 867)),
         'use': dim('observed', 'Outgoing payload contains exact matching IDs, but its acquisition route remains unknown.', ids(c1, 901)),
         'action': dim('observed', 'Original script/output records twelve HTTP201 posts and three HTTP429 failures; destination content readback absent.', ids(c1, 901))},
        [('read', 'Missing consumer read before outgoing action; later read cannot fill chronology gap.', [901, 867]),
         ('action', 'Full destination response bodies/version readbacks absent; HTTP statuses do not establish further external propagation.', [901])],
        refs(c1, 'E2', 'e-anchor-to-earlier-4claw-batch'),
        [(1109, '/original/output', 'FOUND_MSG_ID e65cc224-e283-470b-adb0-2061350863e0 True'),
         (901, '/original/agent_action/command', '5. Room `cd7875da-eae9-47c5-add1-fd0ab63343d3` (Msg: `e65cc224-e283-470b-adb0-2061350863e0`)'),
         (901, '/original/output', 'Successfully posted to 12 active threads.'),
         (867, '/original/output', 'AI Girl HexNest anchor is VERIFIED PRESENT in served public GitHub HTML.')]))
    edges.append(make_edge(records, a1, 'village-uuid-common-source-counterexample', 42, 45, [42, 45],
        'UUID mapping · recipient reports prior discovery', 'unknown',
        'A mapping handoff is followed by thanks and posting self-report, but the recipient explicitly reports discovering the same UUIDs independently before the handoff. Matching values and acknowledgment cannot establish contribution-specific uptake.',
        {'write': dim('observed', 'Original chat publishes nine board UUIDs.', ids(a1, 42)),
         'read': dim('reported', 'Recipient thanks sender; exact delivered input/read record absent.', ids(a1, 45)),
         'use': dim('unknown', 'Recipient reports prior independent discovery, leaving mapping-specific uptake unresolved.', ids(a1, 45)),
         'action': dim('reported', 'Recipient chat reports posting; these cited originals do not themselves observe those posts.', ids(a1, 45))},
        [('use', 'No evidence isolates contribution from common API discovery; recipient explicitly reports a prior source.', [45]),
         ('action', 'Native posting/discovery turn is not part of this jointly reviewed pair; do not upgrade chat self-report to execution.', [45])],
        refs(a1, 'board-uuid-map-to-posting', 'v3'),
        [(42, '/original/content', 'Here is the mapping for the 9 boards you requested:'),
         (45, '/original/content', 'I actually discovered them all independently through the posts API right before you sent them')]))
    return edges

def build(base):
    selections, audits, records, inputs = load_all(base)
    edges = curate(records, audits)
    for name in ['village/selections.json', 'village/protocol.json', 'village/manifest.json', 'village/costs.json']:
        inputs.append(binding(base, base / name))
    inputs = sorted({b['path']: b for b in inputs}.values(), key=lambda b: b['path'])
    costs = read(base / 'village/costs.json')
    invcounts = Counter(); revcounts = Counter()
    for row in audits.values():
        invcounts.update(row['investigator_counts']['raw']); revcounts.update(row['independent_counts']['raw'])
    summary = {'schema_version': 'buzzer-village-reconciliation-1',
        'scope': 'April 6–12 2026 America/Los_Angeles; nine bounded retrospective packets from 40 eligible room-hours',
        'denominators': {k: selections[k] for k in ['eligible_unit_denominator', 'filled_slot_count', 'intended_slot_denominator', 'unique_packet_denominator']},
        'slots': selections['slots'], 'empty_slots': [s for s in selections['slots'] if not s['packet_id']],
        'overlapping_arm_packets': [p for p in audits if len(audits[p]['arm_memberships']) > 1],
        'all_nine_judgments_frozen': True, 'review_procedure': 'Neutral originals before arm/rank/investigator verdict; fresh same-model agents provide procedural independence, not model replication or human review.',
        'counts_not_aligned_accuracy': True,
        'investigator_raw_edge_counts': dict(sorted(invcounts.items())), 'independent_raw_edge_counts': dict(sorted(revcounts.items())),
        'costs': {'collection': costs['collection'], 'retrieval_seconds': costs['retrieval_seconds'],
                  'extraction_join_seconds': costs['extraction_join_seconds'], 'freeze_hash_seconds': costs['freeze_hash_seconds'],
                  'investigator_active_seconds_recorded': sum(a['investigator_active_seconds_recorded'] for a in audits.values()),
                  'independent_accounted_seconds': sum(a['independent_accounted_seconds'] for a in audits.values()),
                  'timing_limits': 'Review intervals include tool/recording latency; heterogeneous conservative accounting, not CPU or measured human effort. Pre-timer estimates and recording corrections remain per-packet separate. No saved-time claim.'},
        'cap_deviations': [{'packet_id': p, 'timing': a['independent_timing']} for p,a in audits.items() if a['independent_timing'].get('cap_hit')],
        'curated_replay_edge_counts': dict(Counter(e['status'] for e in edges)),
        'selection_limit': 'Two strongest mutually supported source chains plus two unresolved/counterexample chains; this is a curated demo, not all reviewed graph edges.',
        'producer_lower_bound': None,
        'limits': ['Nine overlapping/dependent packets cannot establish retrieval improvement, precision, recall or prevalence.',
                   'Incomplete review, null outputs, absent screenshots and bounded horizons preserve unknown/right-censored findings.',
                   'Registry/session/signature labels are not authenticated distinct producing entities.',
                   'Common ownership, autonomy, human involvement, novelty, permissions, evaluation effects and intent remain separate unknowns unless documentary reports say otherwise.',
                   'Observed read followed by distinctive action supports documentary uptake; causality, large misaligned swarms and unfamiliar-source generalization are not established.'],
        'frozen_input_bindings': inputs,
        'packet_table': [{k: a[k] for k in ['packet_id', 'arm_memberships', 'source_row_counts', 'extraction_coverage',
            'investigator_counts', 'independent_counts', 'investigator_active_seconds_recorded', 'independent_accounted_seconds',
            'reconciliation_note', 'documentary_correction']} for a in audits.values()]}
    reconciliation = {**summary, 'packets': list(audits.values()),
        'curated_comparisons': [{'edge_id': e['id'], 'status': e['status'], **e['reviewBindings']} for e in edges]}
    decisions = {'schema_version': 'buzzer-village-decisions-1', 'edges': edges,
                 'selection_basis': summary['selection_limit'], 'frozen_input_bindings': inputs,
                 'implementation_sha256': digest(Path(__file__))}
    notes = [summary['scope'],
             'All 12 slots are filled: candidate4, baseline4, uniform4. Nine unique packets; three candidate/baseline overlaps.',
             'S/R/U are raw documentary supported/reported/unknown counts within each reviewer candidate set. Edge segmentation and inspected topics differ; these are not aligned accuracy, recall or prevalence.',
             'Packet | memberships | chat/turns; screenshots present/absent; null outputs | investigator S/R/U | independent S/R/U | investigator seconds / independent accounted seconds']
    for pid, a in audits.items():
        c = a['extraction_coverage']; i = a['investigator_counts']; r = a['independent_counts']
        arms = ','.join(f"{m['arm']}:{m['slot']}" for m in a['arm_memberships'])
        notes.append(f"{pid} | {arms} | {c['chat_rows']}/{c['turn_rows']}; {c['screenshots_present']}/{c['screenshots_absent']}; {c['output_null_rows']} | {i['supported']}/{i['reported']}/{i['unknown']} | {r['supported']}/{r['reported']}/{r['unknown']} | {a['investigator_active_seconds_recorded']:.3f}/{a['independent_accounted_seconds']:.3f}")
        notes.append('  ' + a['reconciliation_note'])
    notes.extend(['', 'First independent A packet timer is 735.765525 seconds, exceeding 600 by 135.765525. Reviewer reports initial semantic judgments materialized at 586.277756 seconds, with no subsequent evidence inspection. The actual overrun remains a protocol deviation; semantic-freeze claim does not make the timer compliant.',
                  'Corrections are separate hash-bound documentary files; initial judgments remain preserved. Full per-packet source/cost/coverage/timing details and failure checks are in village-reconciliation.json.',
                  'Collection was local frozen archive access, zero new network requests/downloads. Retrieval and extraction costs are separate from review; no human time saving is established.',
                  'Demo claims use original chat/action/output fields only. No source action was executed. Exact source timestamps/microseconds and compressed/raw-line hashes are retained.',
                  'No independently authenticated producer lower bound, causal transfer effect, unauthorized information boundary, evaluation manipulation, large misaligned swarm or generalization claim is made.'])
    outputs = {'village-decisions.json': decisions, 'village-reconciliation.json': reconciliation,
               'village-audit-summary.json': summary}
    for name, data in outputs.items():
        (base / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (base / 'village-reconciliation-notes.txt').write_text('\n'.join(notes) + '\n', encoding='utf-8')
    print(json.dumps({'packets': len(audits), 'replay_edges': len(edges), 'investigator_counts': dict(invcounts), 'independent_counts': dict(revcounts), 'outputs': list(outputs)}, sort_keys=True))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path, default=DEFAULT)
    build(parser.parse_args().run_dir.resolve())
