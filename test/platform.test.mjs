import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('Android adapter uses offline native storage and system export without HTTP',async()=>{
  let data=JSON.parse(await readFile(new URL('../seed.json',import.meta.url),'utf8')),exported;
  globalThis.window={ResonanceNative:{readState:()=>JSON.stringify(data),writeState:text=>{data=JSON.parse(text);data.revision++;return JSON.stringify(data);},exportFile:(name,text,type)=>{exported={name,text,type};return '';}}};
  try {
    const {isAndroid,loadState,writeState,nativeExport}=await import('../public/platform.js?test-native');
    assert.equal(isAndroid,true);assert.equal((await loadState()).recipes.length,8);
    const next=await loadState();next.recipes[0].name='手机离线保存';await writeState(next);
    assert.equal((await loadState()).recipes[0].name,'手机离线保存');
    assert.equal(nativeExport('backup.json',JSON.stringify(data),'application/json'),true);assert.equal(exported.name,'backup.json');
    window.ResonanceNative.writeState=()=>JSON.stringify({error:'保存空间不足'});await assert.rejects(writeState(data),/保存空间不足/);
  } finally {delete globalThis.window;}
});
