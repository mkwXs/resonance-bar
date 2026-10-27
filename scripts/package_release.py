from pathlib import Path
import hashlib,subprocess,zipfile,json
root=Path(__file__).resolve().parent.parent
version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
output=root/'release';output.mkdir(exist_ok=True)
files=subprocess.check_output(['git','-c','safe.directory='+root.as_posix(),'ls-files','-z'],cwd=root).decode().split('\0')
source=output/f'ResonanceBar-{version}-Source.zip'
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        if name and (root/name).is_file():archive.write(root/name,name)
artifacts=[output/'windows'/f'ResonanceBar-{version}-Windows-x64.exe',output/'android'/f'ResonanceBar-{version}-Android.apk',source]
lines=[]
for artifact in artifacts:
    digest=hashlib.sha256(artifact.read_bytes()).hexdigest();lines.append(digest+'  '+artifact.name)
    print(artifact.name,artifact.stat().st_size,'bytes')
(output/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n',encoding='ascii')
