"""Build the offline Android app using Google's aapt2/D8/apksigner and JDK 17."""
from pathlib import Path
import os,json,shutil,subprocess,zipfile,secrets,hashlib
ROOT=Path(__file__).resolve().parent.parent
CACHE=Path(os.environ['LOCALAPPDATA'])/'ResonanceBarBuild'/'tools'
config=json.loads((CACHE/'toolchain.json').read_text())
JAVA=Path(config['java']); TOOLS=Path(config['buildTools']); PLATFORM=Path(config['platform'])
env={**os.environ,'JAVA_HOME':str(JAVA.parent),'PATH':str(JAVA)+os.pathsep+os.environ['PATH']}
build=ROOT/'android'/'build';build.mkdir(exist_ok=True)
assets=build/'assets';(assets/'public').mkdir(parents=True,exist_ok=True)
for file in (ROOT/'public').iterdir():
    if file.is_file():shutil.copy2(file,assets/'public'/file.name)
shutil.copy2(ROOT/'seed.json',assets/'seed.json')
classes=build/'classes';classes.mkdir(exist_ok=True)
dex=build/'dex';dex.mkdir(exist_ok=True)
out=ROOT/'release'/'android';out.mkdir(parents=True,exist_ok=True)
def run(args):
    print('Running '+Path(str(args[0])).name,flush=True)
    subprocess.run([str(a) for a in args],env=env,check=True,cwd=ROOT)
run([JAVA/'javac.exe','-encoding','UTF-8','--release','8','-classpath',PLATFORM,'-d',classes,*list((ROOT/'android'/'src').rglob('*.java'))])
run([JAVA/'java.exe','-cp',TOOLS/'lib'/'d8.jar','com.android.tools.r8.D8','--min-api','26','--lib',PLATFORM,'--output',dex,*classes.rglob('*.class')])
run([TOOLS/'aapt2.exe','compile','--dir',ROOT/'android'/'res','-o',build/'resources.zip'])
run([TOOLS/'aapt2.exe','link','-I',PLATFORM,'--manifest',ROOT/'android'/'AndroidManifest.xml','--min-sdk-version','26','--target-sdk-version','35','-A',assets,'-o',build/'resources.apk',build/'resources.zip'])
with zipfile.ZipFile(build/'resources.apk') as resources, zipfile.ZipFile(build/'unsigned.apk','w',compression=zipfile.ZIP_DEFLATED) as apk:
    for item in resources.infolist(): apk.writestr(item.filename,resources.read(item),compress_type=item.compress_type)
    apk.write(dex/'classes.dex','classes.dex')
run([TOOLS/'zipalign.exe','-f','4',build/'unsigned.apk',build/'aligned.apk'])
signing=CACHE.parent/'signing';signing.mkdir(exist_ok=True)
key=signing/'resonancebar-release.jks';password=signing/'resonancebar.pass'
if not key.exists():
    if not password.exists():password.write_text(secrets.token_urlsafe(40),encoding='ascii')
    run([JAVA/'keytool.exe','-genkeypair','-keystore',key,'-storetype','PKCS12','-storepass:file',password,'-keypass:file',password,'-alias','resonancebar','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Resonance Bar, O=Resonance Bar, C=CN'])
version=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
apk=out/f'ResonanceBar-{version}-Android.apk'
run([JAVA/'java.exe','-jar',TOOLS/'lib'/'apksigner.jar','sign','--ks',key,'--ks-key-alias','resonancebar','--ks-pass','file:'+str(password),'--out',apk,build/'aligned.apk'])
run([JAVA/'java.exe','-jar',TOOLS/'lib'/'apksigner.jar','verify','--verbose','--print-certs',apk])
run([TOOLS/'aapt2.exe','dump','badging',apk])
print('APK: '+str(apk),flush=True)
print('SHA256: '+hashlib.sha256(apk.read_bytes()).hexdigest(),flush=True)
