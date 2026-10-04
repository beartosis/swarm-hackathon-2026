import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('lineage_verify', Path(__file__).resolve().parents[2] / 'src/lineage/verify.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class VerifyTests(unittest.TestCase):
    def test_original_equality_and_file_tamper(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = b'{"id":"synthetic","body":"example"}\n'
            archive = root / 'revisions.jsonl.gz'
            archive.write_bytes(gzip.compress(raw))
            packet = {'records': [{'citation': {'path': archive.name, 'decompressedJsonlLine': 1,
                'rawLineSha256': hashlib.sha256(raw.rstrip(b'\n')).hexdigest(),
                'compressedFileSha256': module.sha_file(archive)}, 'original': json.loads(raw)}]}
            path = root / 'neutral.json'
            path.write_text(json.dumps(packet), encoding='utf8')
            self.assertTrue(module.verify(root, wiki=path)['valid'])
            packet['records'][0]['original']['body'] = 'invented'
            path.write_text(json.dumps(packet), encoding='utf8')
            with self.assertRaisesRegex(ValueError, 'Original content mismatch'):
                module.verify(root, wiki=path)
            archive.write_bytes(gzip.compress(b'{}\n'))
            with self.assertRaisesRegex(ValueError, 'file hash mismatch'):
                module.verify(root, wiki=path)


if __name__ == '__main__':
    unittest.main()
