import base64
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('screenshot_attach',Path(__file__).resolve().parents[2]/'src/lineage/screenshot.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ScreenshotTests(unittest.TestCase):
    def test_exact_frame_is_bound_to_existing_record(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            data=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=')
            tarpath=root/'frames.tar'
            with tarfile.open(tarpath,'w') as tar:
                member=tarfile.TarInfo('fixture.png');member.size=len(data);tar.addfile(member,io.BytesIO(data))
            info={'turn_id':'fixture','tar_relative_path':'frames.tar','entry':'fixture.png','present':True,'entry_bytes':len(data),'entry_sha256':hashlib.sha256(data).hexdigest(),'tar_sha256':hashlib.sha256(tarpath.read_bytes()).hexdigest()}
            (root/'screenshots.jsonl').write_text(json.dumps(info)+'\n',encoding='utf8')
            bundle=root/'bundle.json';bundle.write_text(json.dumps({'records':[{'id':'computer_use_turns:fixture','extractionConfig':{}}]}),encoding='utf8')
            output=root/'attached.json';module.attach(root,root,bundle,'fixture',output)
            result=json.loads(output.read_text())
            self.assertEqual(base64.b64decode(result['records'][0]['imageDataUrl'].split(',')[1]),data)
            tarpath.write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError,'tar changed'):
                module.attach(root,root,bundle,'fixture',root/'bad.json')


if __name__=='__main__':unittest.main()
