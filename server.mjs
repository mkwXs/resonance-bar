import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createStore } from './store.mjs';
import { MAX_BACKUP_BYTES } from './public/core.js';
export async function createApp({dataDir, seedPath} = {}) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const store = await createStore(dataDir || path.join(root,'data'),seedPath || path.join(root,'seed.json'));
  const server = http.createServer(async (req,res) => {
    const headers = { 'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" };
    const send = (code,body,type='application/json; charset=utf-8') => {res.writeHead(code,{...headers,'Content-Type':type}); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));};
    try {
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return send(403,{error:'仅允许本机访问'});
      const url = new URL(req.url,'http://' + req.headers.host);
      if (url.pathname === '/api/state') {
        if (req.method === 'GET') return send(200,store.get());
        if (req.method !== 'PUT') return send(405,{error:'不支持的操作'});
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403,{error:'拒绝跨站写入'});
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'需要 JSON 数据'});
        const chunks = []; let bytes = 0;
        for await (const chunk of req) { bytes += chunk.length; if (bytes > MAX_BACKUP_BYTES) return send(413,{error:'包含图片的完整备份不能超过 25 MB，请减少图片或配方数量'}); chunks.push(chunk); }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        return send(200,await store.save(input,input.revision));
      }
      const files = {'/':'index.html','/index.html':'index.html','/app.js':'app.js','/core.js':'core.js','/platform.js':'platform.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg'};
      if (req.method !== 'GET' || !files[url.pathname]) return send(404,{error:'页面不存在'});
      const name = files[url.pathname], ext = path.extname(name);
      send(200,await readFile(path.join(root,'public',name)),{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}[ext]);
    } catch (e) { send(e.status || 400,{error:e.message}); }
  });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  const server = await createApp();
  server.on('error',e => { console.error(e.code === 'EADDRINUSE' ? `端口 ${port} 已占用。可在 PowerShell 中设置 $env:PORT=4174 后重新运行。` : e.message); process.exitCode=1; });
  server.listen(port,'127.0.0.1',() => console.log(`鸣潮 · 共鸣调酒室  http://127.0.0.1:${port}\n配方保存于 ${path.join(path.dirname(fileURLToPath(import.meta.url)),'data')}\n按 Ctrl+C 停止服务。`));
}
