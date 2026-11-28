// Disposable real SillyTavern + extension build acceptance; never accepts a data directory.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { ensureSilentCommandExists } from './fix-st-terminal-flash.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const next = args[index + 1];
  assert(next !== undefined && !next.startsWith('--'), `Missing value for option ${name}`);
  return next;
}

const source = path.resolve(option('--host-source', path.join(root, 'test-results/roadmap-2026-11-04/runtime')));
const helper = path.resolve(option('--helper-source', path.join(root, 'test-results/roadmap-2026-11-04/runtime/public/scripts/extensions/third-party/JS-Slash-Runner')));
const mvu = path.resolve(option('--mvu-source', path.join(root, 'reference/MVU/MagVarUpdate-beta/artifact/bundle.js')));
// Default to in-repo st-distribution so local builds are tested without touching ../st-stage-ext; pass --release ../st-stage-ext for post-publish verification.
const release = path.resolve(option('--release', path.join(root, 'st-distribution')));
const output = path.resolve(option('--output', path.join(root, 'test-results/host-acceptance-' + new Date().toISOString().replace(/[:.]/g, '-'))));
assert(!existsSync(output), 'Choose a new evidence directory; existing evidence is never erased');
for (const file of [path.join(source, 'server.js'), path.join(source, 'node_modules'), path.join(helper, 'dist/index.js'), mvu, path.join(release, 'version.json')]) {
  assert(existsSync(file), `Missing program dependency: ${file}`);
}

await mkdir(output, { recursive: true });
const temporary = await mkdtemp(path.join(os.tmpdir(), 'st-stage-host-'));
const runtime = path.join(temporary, 'runtime'), data = path.join(temporary, 'data');
const extensions = path.join(runtime, 'public/scripts/extensions/third-party');
const mountPaths = [path.join(runtime, 'node_modules'), path.join(extensions, 'baigong-acceptance')];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

let reply = 'Synthetic acceptance reply.', sequence = 0;
const modelCalls = [];
let model, host, hostClosed, tests, logfile, stopped = false;

const manifest = {
  temporary,
  runtime,
  data,
  source,
  release,
  output,
  scope: 'Fresh synthetic data; real ST, helper and MVU; local controlled SSE model; emulated mobile.',
  version: JSON.parse(await readFile(path.join(release, 'version.json'), 'utf8')),
  hostVersion: JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8')).version,
};

function killProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32' && child.exitCode === null) {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.unref();
  } else {
    child.kill();
  }
}

const stop = () => {
  stopped = true;
  killProcessTree(tests);
  host?.kill();
  model?.closeAllConnections?.();
  model?.close?.();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  await mkdir(runtime);
  await mkdir(data);
  const thirdParty = path.join(source, 'public/scripts/extensions/third-party');
  for (const entry of ['default', 'public', 'src', 'server.js', 'plugins.js', 'webpack.config.js', 'package.json']) {
    await cp(path.join(source, entry), path.join(runtime, entry), {
      recursive: true,
      filter: file => file !== thirdParty && file !== path.join(source, 'public/mvu-acceptance') && !file.endsWith('.before-terminal-flash'),
    });
  }
  await symlink(await realpath(path.join(source, 'node_modules')), mountPaths[0], 'junction');
  await mkdir(extensions, { recursive: true });
  await symlink(release, mountPaths[1], 'junction');
  await cp(helper, path.join(extensions, 'JS-Slash-Runner'), { recursive: true });
  await mkdir(path.join(runtime, 'public/mvu-acceptance'));
  await cp(mvu, path.join(runtime, 'public/mvu-acceptance/bundle.js'));
  const mvuLicense = path.resolve(path.dirname(mvu), '../LICENSE');
  if (existsSync(mvuLicense)) await cp(mvuLicense, path.join(runtime, 'public/mvu-acceptance/LICENSE'));

  manifest.nodeVersion = process.version;
  manifest.helperVersion = JSON.parse(await readFile(path.join(helper, 'manifest.json'), 'utf8')).version;
  manifest.helperSha256 = sha256(await readFile(path.join(helper, 'dist/index.js')));
  manifest.mvuSha256 = sha256(await readFile(mvu));
  manifest.bundleSha256 = sha256(await readFile(path.join(release, 'bundle.js')));
  manifest.mountRealpath = await realpath(mountPaths[1]);
  assert.equal(manifest.mountRealpath, await realpath(release));
  manifest.terminalPatch = ensureSilentCommandExists(runtime);

  const config = path.join(temporary, 'config.yaml');
  const defaultConfig = await readFile(path.join(runtime, 'default/config.yaml'), 'utf8');
  // A real junction must never let the host's update manager rewrite the mounted extension directory.
  assert(defaultConfig.includes('  autoUpdate: true'));
  await writeFile(config, defaultConfig.replace('  autoUpdate: true', '  autoUpdate: false').replace('    autoDownload: true', '    autoDownload: false'));

  model = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    if (req.url === '/control' && req.method === 'POST') { reply = JSON.parse(body).reply; res.end('{}'); return; }
    if (req.url === '/evidence') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(modelCalls)); return; }
    if (req.url.endsWith('/models')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'host-acceptance', object: 'model' }] })); return; }
    if (!req.url.endsWith('/chat/completions')) { res.writeHead(404); res.end(); return; }
    const request = JSON.parse(body);
    const call = { sequence: ++sequence, stream: request.stream, model: request.model, messageCount: request.messages?.length, chunks: 0, complete: false };
    modelCalls.push(call);
    if (!request.stream) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: reply }, finish_reason: 'stop' }] })); call.complete = true; return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const content = reply;
    for (let offset = 0; offset < content.length && !res.destroyed; offset += 12) {
      res.write(`data: ${JSON.stringify({ id: 'synthetic-' + sequence, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: content.slice(offset, offset + 12) }, finish_reason: null }] })}\n\n`);
      call.chunks++; await delay(80);
    }
    res.end('data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'); call.complete = true;
  });

  const modelPort = await listen(model);
  const reservation = http.createServer();
  const hostPort = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  manifest.url = `http://127.0.0.1:${hostPort}`;
  manifest.modelUrl = `http://127.0.0.1:${modelPort}/v1`;
  logfile = createWriteStream(path.join(output, 'host.log'));
  host = spawn(process.execPath, ['--preserve-symlinks', 'server.js', '--port', String(hostPort), '--dataRoot', data, '--configPath', config, '--browserLaunchEnabled', 'false'], { cwd: runtime, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  hostClosed = new Promise(resolve => host.once('close', resolve));
  host.stdout.pipe(logfile);
  host.stderr.pipe(logfile);
  await writeFile(path.join(output, 'environment.json'), JSON.stringify(manifest, null, 2));
  console.log(`Isolated host: ${manifest.url}\nMounted release: ${release}\nEvidence: ${output}\nTemporary data: ${temporary}`);

  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (stopped) throw new Error('Interrupted during host startup');
    if (host.exitCode !== null || host.signalCode !== null) throw new Error(`Host exited (${host.exitCode ?? host.signalCode}); see host.log`);
    try { ready = (await fetch(manifest.url, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Startup polling; failures are reported on timeout. */ }
    if (ready) break;
    await delay(500);
  }
  assert(ready, 'Host startup timed out; see host.log');
  const projectOption = option('--project', '');
  const grepOption = option('--grep', '');
  tests = spawn(process.execPath, [
    path.join(root, 'node_modules/@playwright/test/cli.js'),
    'test',
    '--config',
    'playwright.host.config.mjs',
    ...(projectOption ? ['--project', projectOption] : []),
    ...(grepOption ? ['--grep', grepOption] : []),
  ], { cwd: root, windowsHide: true, stdio: 'inherit', env: { ...process.env, ST_HOST_ENV: path.join(output, 'environment.json') } });
  const code = await new Promise((resolve, reject) => { tests.once('error', reject); tests.once('exit', resolve); });
  manifest.status = code === 0 ? 'passed' : 'failed';
  process.exitCode = code === 0 ? 0 : 1;
} catch (error) {
  manifest.status = 'failed';
  manifest.error = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  stop();
  if (hostClosed) await hostClosed;
  if (logfile) await new Promise(resolve => logfile.end(resolve));
  await writeFile(path.join(output, 'model-requests.json'), JSON.stringify(modelCalls, null, 2));
  manifest.finishedAt = new Date().toISOString();
  manifest.tempRetained = true;
  manifest.junctionsDetached = true;

  // Always detach NTFS junctions in finally (even on failure or --keep-temp) so %TEMP% never
  // retains live reparse points into shared node_modules or the mounted extension directory.
  assert.equal(path.dirname(await realpath(temporary)), await realpath(os.tmpdir()));
  assert(path.basename(temporary).startsWith('st-stage-host-'));
  for (const mount of mountPaths) {
    try {
      const stat = await lstat(mount);
      assert(stat.isSymbolicLink(), `Expected symbolic link/junction at ${mount}`);
      await unlink(mount);
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        manifest.junctionsDetached = false;
        console.warn('[test:host] Failed to detach junction:', mount, err);
      }
    }
  }

  if (manifest.status === 'passed' && !args.includes('--keep-temp') && manifest.junctionsDetached) {
    await rm(temporary, { recursive: true, maxRetries: 3, retryDelay: 200 });
    manifest.tempRetained = false;
  }
  await writeFile(path.join(output, 'environment.json'), JSON.stringify(manifest, null, 2));
}
