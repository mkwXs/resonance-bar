import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

const root = path.dirname(fileURLToPath(import.meta.url));
const url = 'http://127.0.0.1:4173';
async function status() {
  try {
    const response = await fetch(url + '/api/state', { signal: AbortSignal.timeout(800) });
    if (!response.ok) return 'occupied';
    const data = await response.json();
    return data.schemaVersion === 1 && Array.isArray(data.recipes) ? 'ready' : 'occupied';
  } catch (error) {
    return error.cause?.code === 'ECONNREFUSED' ? 'offline' : 'unknown';
  }
}
try {
  let current = await status();
  if (current === 'occupied' || current === 'unknown') throw new Error('Port 4173 is occupied or unavailable. See README.md.');
  if (current === 'offline') {
    mkdirSync(path.join(root, 'data'), { recursive: true });
    const log = openSync(path.join(root, 'data', 'server.log'), 'a');
    try {
      const child = spawn(process.execPath, [path.join(root, 'server.mjs')], {
        cwd: root, detached: true, windowsHide: true,
        stdio: ['ignore', log, log], env: { ...process.env, PORT: '4173' },
      });
      child.on('error', error => console.error(error.message));
      child.unref();
    } finally { closeSync(log); }
    for (let i = 0; i < 30; i++) {
      await setTimeout(200); current = await status();
      if (current === 'ready') break;
    }
    if (current !== 'ready') throw new Error('Startup failed. Check data/server.log.');
  }
  console.log('Resonance Bar is running: ' + url);
  if (!process.argv.includes('--no-browser')) {
    const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { detached: true, windowsHide: true, stdio: 'ignore' });
    browser.on('error', () => console.log('Open this URL in your browser: ' + url));
    browser.unref();
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
