import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createApp } from '../server.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let server,mainWindow;
const smoke=process.argv.includes('--smoke-test');
if(smoke)app.setPath('userData',path.join(app.getPath('temp'),'resonance-bar-smoke-'+process.pid));
const lock=app.requestSingleInstanceLock();
if(!lock)app.quit();
else {
  app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
  app.whenReady().then(async()=>{
    try {
      server=await createApp({dataDir:path.join(app.getPath('userData'),'data'),seedPath:path.join(root,'seed.json')});
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
      const origin=`http://127.0.0.1:${server.address().port}`;
      mainWindow=new BrowserWindow({width:1320,height:900,minWidth:420,minHeight:650,show:!smoke,title:'共鸣调酒室',backgroundColor:'#0b151d',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
      Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'共鸣调酒室',submenu:[{label:'导入原网站的数据',click:()=>dialog.showMessageBox(mainWindow,{type:'info',message:'在原网站导出 JSON 备份，再在本应用左侧点击“导入 JSON 备份”。',detail:'桌面应用的数据独立保存在用户目录，不会覆盖旧网站文件。'})},{label:'打开应用数据文件夹',click:()=>shell.openPath(path.join(app.getPath('userData'),'data'))},{type:'separator'},{role:'reload',label:'刷新界面'},{role:'quit',label:'退出'}]},{label:'视图',submenu:[{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{role:'resetZoom',label:'重置缩放'}]}]));
      mainWindow.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))shell.openExternal(url);return {action:'deny'};});
      mainWindow.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin){event.preventDefault();if(url.startsWith('https://'))shell.openExternal(url);}});
      mainWindow.webContents.session.setPermissionRequestHandler((_contents,permission,callback)=>callback(permission==='clipboard-sanitized-write'));
      mainWindow.webContents.session.on('will-download',(_event,item)=>{
        item.setSaveDialogOptions({title:'保存备份 / 清单',defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))});
      });
      await mainWindow.loadURL(origin);
      if(smoke) {
        await new Promise(resolve=>setTimeout(resolve,1000));
        const result=await mainWindow.webContents.executeJavaScript(`(async()=>{const before=await(await fetch('/api/state')).json();const next=structuredClone(before);next.recipes[0].name='Desktop smoke saved';const written=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});const after=await(await fetch('/api/state')).json();return {title:document.title,cards:document.querySelectorAll('.recipe-card').length,hasNativeNode:typeof window.require !== 'undefined',saved:written.ok&&after.recipes[0].name==='Desktop smoke saved'};})()`);
        console.log('DESKTOP_SMOKE '+JSON.stringify(result));
        if(process.env.RESONANCE_SMOKE_REPORT)await writeFile(process.env.RESONANCE_SMOKE_REPORT,JSON.stringify(result,null,2));
        if(result.cards!==8 || result.hasNativeNode || !result.saved)app.exit(1);else app.quit();
      }
    } catch(error) {if(smoke)console.error(error);else dialog.showErrorBox('应用启动失败',error.message);app.exit(1);}
  });
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>server?.close());
}
