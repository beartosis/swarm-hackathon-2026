"""Attach an explicitly selected, hash-verified archive frame to a local replay record."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import tarfile


def attach(archive, packet, bundle_path, turn_id, output):
    archive, packet = Path(archive).resolve(), Path(packet).resolve()
    matches = [json.loads(line) for line in (packet / 'screenshots.jsonl').read_text(encoding='utf8').splitlines() if json.loads(line)['turn_id'] == turn_id]
    if len(matches) != 1 or not matches[0]['present']:
        raise ValueError('Exactly one present frozen screenshot is required')
    item = matches[0]
    source = (archive / item['tar_relative_path']).resolve()
    if not source.is_relative_to(archive):
        raise ValueError('Screenshot path outside archive')
    with source.open('rb') as file:
        if hashlib.file_digest(file, 'sha256').hexdigest() != item['tar_sha256']:
            raise ValueError('Screenshot tar changed')
    with tarfile.open(source, 'r') as tar:
        members = [member for member in tar if member.name == item['entry']]
        if len(members) != 1 or not members[0].isfile() or members[0].size > 4 * 1024 * 1024:
            raise ValueError('Ambiguous, non-file or oversized screenshot')
        data = tar.extractfile(members[0]).read()
    if not data.startswith(b'\x89PNG\r\n\x1a\n') or hashlib.sha256(data).hexdigest() != item['entry_sha256'] or len(data) != item['entry_bytes']:
        raise ValueError('Screenshot entry mismatch')
    bundle = json.loads(Path(bundle_path).read_text(encoding='utf8'))
    rows = [record for record in bundle['records'] if record['id'] == 'computer_use_turns:' + turn_id]
    if len(rows) != 1:
        raise ValueError('Screenshot must correspond to one existing cited action record')
    rows[0]['imageDataUrl'] = 'data:image/png;base64,' + base64.b64encode(data).decode('ascii')
    rows[0]['extractionConfig'].update(screenshotSourcePath=item['tar_relative_path'], screenshotEntry=item['entry'], screenshotTarSha256=item['tar_sha256'], screenshotEntrySha256=item['entry_sha256'])
    rows[0]['timeUncertainty'] = 'Archive frame associated with this turn; independent screenshot capture time is not provided.'
    with Path(output).open('x', encoding='utf8') as file:
        json.dump(bundle, file, indent=2)
    return {'turn_id': turn_id, 'entry_sha256': item['entry_sha256'], 'bytes': len(data), 'local_research_only': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', default='ai-village')
    parser.add_argument('--packet', required=True)
    parser.add_argument('--bundle', required=True)
    parser.add_argument('--turn', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    print(json.dumps(attach(args.archive, args.packet, args.bundle, args.turn, args.output)))
