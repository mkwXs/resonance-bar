import { readFile, mkdir, writeFile, rename, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { validate } from './public/core.js';
export async function createStore(dir, seedPath) {
  await mkdir(dir,{recursive:true});
  const file = path.join(dir,'recipes.json');
  let state;
  try { state = validate(JSON.parse(await readFile(file,'utf8'))); }
  catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`数据文件无法读取，已保留原文件，请从备份恢复：${e.message}`);
    state = validate(JSON.parse(await readFile(seedPath,'utf8'))); state.revision = 0;
    await writeFile(file,JSON.stringify(state,null,2),{flag:'wx'});
  }
  let queue = Promise.resolve();
  return {
    get: () => structuredClone(state),
    save(next, revision) {
      const task = queue.then(async () => {
        if (revision !== state.revision) { const e = new Error('数据已在其他窗口更新。请先复制未保存的修改，再刷新页面读取最新数据。'); e.status = 409; throw e; }
        validate(next);
        const updated = {...structuredClone(next), revision:state.revision + 1};
        await mkdir(path.join(dir,'backups'),{recursive:true});
        await copyFile(file,path.join(dir,'backups',`recipes-r${state.revision}-${Date.now()}.json`));
        const temp = path.join(dir,`recipes-${process.pid}.tmp`);
        await writeFile(temp,JSON.stringify(updated,null,2));
        await rename(temp,file); state = updated;
        return structuredClone(state);
      });
      queue = task.catch(()=>{}); return task;
    }
  };
}
