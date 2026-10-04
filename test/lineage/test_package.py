import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('lineage_package', Path(__file__).resolve().parents[2] / 'src/lineage/package.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PackageTests(unittest.TestCase):
    def test_allowlist_excludes_research_and_caches(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('src/lineage/example.py', 'src/lineage/__pycache__/secret.py', 'output/packet.json', 'ai-village/source.gz'):
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('synthetic fixture', encoding='utf8')
            target = root / 'bundle.zip'
            module.package(root, target)
            with zipfile.ZipFile(target) as archive:
                self.assertEqual(set(archive.namelist()), {'src/lineage/example.py', 'CODE-MANIFEST.json'})
            with self.assertRaises(FileExistsError):
                module.package(root, target)


if __name__ == '__main__':
    unittest.main()
