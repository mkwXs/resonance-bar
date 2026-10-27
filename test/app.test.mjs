import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, cost, shopping, filterRecipes } from '../public/core.js';
import { createStore } from '../store.mjs';
import { createApp } from '../server.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const seedPath = path.join(root,'seed.json');
const seed = JSON.parse(await readFile(seedPath,'utf8'));
test('preview images survive disk save and JSON backup; unsafe or oversized images are rejected',async()=>{
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGYQAAAAASUVORK5CYII=';
  const next=structuredClone(seed);next.recipes[0].previewImage=image;
  validate(next);validate(JSON.parse(JSON.stringify(next)));
  const dir=await mkdtemp(path.join(tmpdir(),'resonance-image-'));
  try {
    const store=await createStore(dir,seedPath);await store.save(next,0);
    const restarted=await createStore(dir,seedPath);assert.equal(restarted.get().recipes[0].previewImage,image);
    const removed=restarted.get();removed.recipes[0].previewImage='';await restarted.save(removed,1);
    assert.equal((await createStore(dir,seedPath)).get().recipes[0].previewImage,'');
  } finally {await rm(dir,{recursive:true,force:true});}
  for(const value of ['https://example.com/image.png','data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,'+'A'.repeat(700000),null]) {
    next.recipes[0].previewImage=value;assert.throws(()=>validate(next),/预览图/);
  }
});
test('eight source recipes and corrected aggregation; optional amounts excluded by default',()=>{
  validate(seed); assert.equal(seed.recipes.length,8);
  const totals = Object.fromEntries(shopping(seed).map(r=>[r.name,r.ml]));
  assert.deepEqual(totals,{'伏特加':105,'无糖苏打水':940,'无糖乌龙茶':190,'草莓糖浆':10,'蓝柑橘糖浆':12,'柠檬汁':76,'白朗姆酒':65,'金酒':100,'蝶豆花茶':150,'红石榴糖浆':8});
  assert.ok(seed.recipes.find(r=>r.character==='爱弥斯').steps.some(s=>s.includes('苏打水 120')));
  assert.ok(seed.recipes.find(r=>r.character==='心').steps.some(s=>s.includes('苏打水 70')));
});
test('servings aggregate and whole packages round up independently',()=>{
  const x=structuredClone(seed);x.recipes.forEach(r=>r.servings=0);x.recipes[0].servings=10;
  const vodka=shopping(x).find(r=>r.name==='伏特加');assert.equal(vodka.ml,350);assert.equal(vodka.packs,2);assert.equal(vodka.purchase,64);assert.equal(vodka.consumed,44.8);
  assert.equal(filterRecipes(seed.recipes,'茶','金酒').length,3);
  assert.equal(filterRecipes(seed.recipes,'绯雪衔珠','全部')[0].character,'心');
});
test('invalid backups, duplicate IDs, negative amounts and absent prices',()=>{
  assert.throws(()=>validate({recipes:[]}));
  const x=structuredClone(seed);x.recipes[0].ingredients[0].ml=-1;assert.throws(()=>validate(x));
  x.recipes[0].ingredients[0].ml=35;x.recipes.push(x.recipes[0]);assert.throws(()=>validate(x));
  const r=structuredClone(seed.recipes[0]);r.ingredients.push({name:'新原料',ml:20,note:''});assert.deepEqual(cost(r,seed.prices).missing,['新原料']);
});
test('atomic persistence, automatic backup, restart, and stale revision protection',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'resonance-store-'));
  try {
    const a=await createStore(dir,seedPath);const next=a.get();next.recipes[0].name='保存后保留';await a.save(next,0);
    const b=await createStore(dir,seedPath);assert.equal(b.get().recipes[0].name,'保存后保留');assert.equal(b.get().revision,1);
    assert.equal((await readdir(path.join(dir,'backups'))).length,1);
    await assert.rejects(a.save(next,0),/其他窗口/);assert.equal(a.get().revision,1);
    const bad=a.get();bad.recipes[0].ingredients[0].ml=-20;await assert.rejects(a.save(bad,1));assert.equal(a.get().revision,1);
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('HTTP serves app, accepts edits, rejects cross-origin writes, bad JSON, and private file access',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'resonance-api-'));const server=await createApp({dataDir:dir});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
  try {
    const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),/共鸣调酒室/);
    assert.equal((await fetch(url+'/seed.json')).status,404);assert.equal((await fetch(url+'/data/recipes.json')).status,404);
    const current=await (await fetch(url+'/api/state')).json();current.recipes[0].name='HTTP 保存';
    const put=(body,origin)=>fetch(url+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body});
    assert.equal((await put(JSON.stringify(current),'https://example.com')).status,403);
    assert.equal((await put('{')).status,400);
    assert.equal((await put(JSON.stringify(current),url)).status,200);
    assert.equal((await (await fetch(url+'/api/state')).json()).recipes[0].name,'HTTP 保存');
    assert.equal((await put(JSON.stringify(current))).status,409);
  } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
