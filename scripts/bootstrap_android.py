"""Download a portable build toolchain from Microsoft and Google; no system install."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request, os, zipfile, json, hashlib, xml.etree.ElementTree as ET

CACHE = Path(os.environ['LOCALAPPDATA']) / 'ResonanceBarBuild' / 'tools'
CACHE.mkdir(parents=True, exist_ok=True)

def download(url, file, expected=None):
    if not file.exists():
        print('Downloading ' + file.name, flush=True)
        request = urllib.request.Request(url, headers={'User-Agent':'ResonanceBarBuild/1.1'})
        with urllib.request.urlopen(request, timeout=90) as response, open(str(file)+'.part','wb') as out:
            while chunk := response.read(1024*1024): out.write(chunk)
        Path(str(file)+'.part').replace(file)
    if expected and hashlib.sha1(file.read_bytes()).hexdigest() != expected:
        raise RuntimeError('SHA-1 mismatch: '+str(file))
    return file

def package(name, url, folder, expected=None):
    archive=download(url,CACHE/name,expected)
    destination=CACHE/folder
    if not (destination/'.complete').exists():
        destination.mkdir(exist_ok=True)
        with zipfile.ZipFile(archive) as z: z.extractall(destination)
        (destination/'.complete').write_text('ok')
    print('Ready: '+folder, flush=True)
    return destination

if __name__=='__main__':
    xml=urllib.request.urlopen('https://dl.google.com/android/repository/repository2-1.xml',timeout=60).read()
    repository=ET.fromstring(xml)
    archives={}
    for item in repository.findall('remotePackage'):
        key=item.get('path')
        if key not in ['platforms;android-35','build-tools;35.0.0']: continue
        for archive in item.findall('./archives/archive'):
            if archive.findtext('host-os') not in [None,'windows']: continue
            filename=archive.findtext('./complete/url')
            if key=='platforms;android-35' and filename!='platform-35_r02.zip': continue
            archives[key]=(filename,archive.findtext('./complete/checksum'))
    with ThreadPoolExecutor(max_workers=3) as pool:
        jobs=[pool.submit(package,'microsoft-jdk-17.zip','https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip','jdk')]
        for key,(name,checksum) in archives.items():
            jobs.append(pool.submit(package,name,'https://dl.google.com/android/repository/'+name,'platform' if key.startswith('platforms') else 'build-tools',checksum))
        for job in jobs: job.result()
    config={'java':str(next((CACHE/'jdk').rglob('javac.exe')).parent),'platform':str(next((CACHE/'platform').rglob('android.jar'))),'buildTools':str(next((CACHE/'build-tools').rglob('aapt2.exe')).parent)}
    (CACHE/'toolchain.json').write_text(json.dumps(config,indent=2))
    print('Android toolchain ready.',flush=True)
