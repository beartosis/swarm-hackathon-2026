"""Verify neutral packet originals against frozen source files, independently of extractors."""
import argparse
from collections import defaultdict
import gzip
import hashlib
import json
from pathlib import Path
import time


def sha_file(path):
    with Path(path).open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest()


def verify(root, wiki=None, village=None):
    root = Path(root).resolve()
    expected = defaultdict(dict)
    file_hashes = defaultdict(set)
    packet_hashes = {}
    references = 0

    def add(path, line, digest, file_digest, original, includes_terminator=False):
        nonlocal references
        source = (root / path).resolve()
        if not source.is_relative_to(root) or not isinstance(line, int) or line < 1:
            raise ValueError('Invalid source location')
        entry = {'sha256': digest, 'original': original, 'includes_terminator': includes_terminator}
        if line in expected[source] and expected[source][line] != entry:
            raise ValueError(f'Conflicting source reference {path}:{line}')
        expected[source][line] = entry
        file_hashes[source].add(file_digest)
        references += 1

    if wiki:
        packet_path = Path(wiki)
        packet_hashes[str(packet_path)] = sha_file(packet_path)
        for record in json.loads(packet_path.read_text(encoding='utf8'))['records']:
            citation = record['citation']
            add(citation['path'], citation['decompressedJsonlLine'], citation['rawLineSha256'], citation['compressedFileSha256'], record['original'])
    if village:
        for packet_path in sorted(Path(village).glob('packets/*/packet.json')):
            packet = json.loads(packet_path.read_text(encoding='utf8'))
            records = packet_path.parent / packet['records_file']
            packet_hashes[str(packet_path)] = sha_file(packet_path)
            actual = sha_file(records)
            if actual != packet['records_sha256']:
                raise ValueError(f'Packet records changed: {records}')
            packet_hashes[str(records)] = actual
            with records.open(encoding='utf8') as file:
                for line in file:
                    record = json.loads(line)
                    source = record['source']
                    add('ai-village/' + source['relative_path'], source['line_1based'], source['raw_line_sha256'], source['file_sha256'], record['original'], True)
    if not references:
        raise ValueError('No references to verify')
    start = time.perf_counter()
    checks = []
    for source, lines in sorted(expected.items()):
        actual_hash = sha_file(source)
        if file_hashes[source] != {actual_hash}:
            raise ValueError(f'Source file hash mismatch: {source}')
        remaining = set(lines)
        with gzip.open(source, 'rb') as file:
            for number, raw in enumerate(file, 1):
                if number not in remaining:
                    continue
                # Wiki hashes omit terminators; Village hashes retain original bytes.
                if not lines[number]['includes_terminator']:
                    raw = raw.rstrip(b'\r\n')
                if hashlib.sha256(raw).hexdigest() != lines[number]['sha256']:
                    raise ValueError(f'Raw line hash mismatch: {source}:{number}')
                if json.loads(raw) != lines[number]['original']:
                    raise ValueError(f'Original content mismatch: {source}:{number}')
                remaining.remove(number)
                if not remaining:
                    break
        if remaining:
            raise ValueError(f'Missing original source lines: {source}')
        checks.append({'path': str(source.relative_to(root)), 'sha256': actual_hash, 'unique_original_lines': len(lines), 'valid': True})
    return {'format': 'buzzer-original-verification-v1', 'valid': True, 'references': references,
            'unique_originals': sum(len(lines) for lines in expected.values()), 'files': checks,
            'packet_hashes': packet_hashes, 'wall_seconds': time.perf_counter() - start,
            'scope': 'Frozen file hashes, raw source lines and complete parsed original equality only; no source authenticity or semantic verdict.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='.')
    parser.add_argument('--wiki')
    parser.add_argument('--village')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = verify(args.root, args.wiki, args.village)
    with Path(args.output).open('x', encoding='utf8') as file:
        json.dump(result, file, indent=2)
    print(json.dumps({'valid': result['valid'], 'unique_originals': result['unique_originals'], 'wall_seconds': result['wall_seconds']}))
