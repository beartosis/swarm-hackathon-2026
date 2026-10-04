"""Create an allowlisted code-only handoff; never include primary archives or local evidence."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile


def package(root, destination):
    root, destination = Path(root).resolve(), Path(destination).resolve()
    candidates = []
    for directory in ('src/lineage', 'test/lineage', 'docs/lineage'):
        for file in (root / directory).rglob('*'):
            if file.is_file() and not file.is_symlink() and '__pycache__' not in file.parts and file.suffix in ('.py', '.mjs', '.md', '.txt'):
                candidates.append(file)
    if not candidates:
        raise ValueError('No lineage code found')
    manifest = {'format': 'buzzer-code-only-v1', 'files': [], 'scope': 'Code, tests and documentation only. Primary archives and local research packets excluded.'}
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(candidates):
            data = file.read_bytes()
            name = file.relative_to(root).as_posix()
            archive.writestr(name, data)
            manifest['files'].append({'path': name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
        archive.writestr('CODE-MANIFEST.json', json.dumps(manifest, indent=2) + '\n')
    return {**manifest, 'archive': str(destination), 'archive_sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination')
    parser.add_argument('--root', default='.')
    args = parser.parse_args()
    print(json.dumps(package(args.root, args.destination), indent=2))
