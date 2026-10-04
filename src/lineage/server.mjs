import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {replayAt} from './replay.mjs';
import {renderReplayHtml} from './ui.mjs';

// Local research viewer. No general filesystem route and no source execution.
export function createReplayServer(bundle, {render = renderReplayHtml} = {}) {
  return createServer((req, res) => {
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    };
    const send = (status, type, body) => {
      res.writeHead(status, {...headers, 'Content-Type': type}); res.end(body);
    };
    const json = (status, value) => send(status, 'application/json; charset=utf-8', JSON.stringify(value));
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, {error: 'Read-only viewer'});
      // Do not accept a hostile DNS name resolving to localhost.
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(req.headers.host || '')) return json(403, {error: 'Loopback host required'});
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/') return send(200, 'text/html; charset=utf-8', render(bundle, {apiUrl: '/api/replay'}));
      if (url.pathname === '/api/health') return json(200, {ok: true, mode: 'local research replay'});
      if (url.pathname !== '/api/replay' && !url.pathname.startsWith('/api/record/')) return json(404, {error: 'Not found'});
      const cutoff = url.searchParams.get('cutoff');
      if (!cutoff || !Number.isFinite(Date.parse(cutoff))) return json(400, {error: 'Explicit valid cutoff required'});
      const at = Date.parse(cutoff);
      if (at < Date.parse(bundle.scope.start) || at > Date.parse(bundle.scope.end)) return json(400, {error: 'Cutoff outside frozen scope'});
      const snapshot = replayAt(bundle, cutoff);
      if (url.pathname === '/api/replay') return json(200, snapshot);
      const id = decodeURIComponent(url.pathname.slice('/api/record/'.length));
      const record = snapshot.records.find(row => row.id === id);
      return record ? json(200, record) : json(404, {error: 'Record unavailable at this cutoff'});
    } catch {
      return json(400, {error: 'Invalid replay request'});
    }
  });
}

export async function serve(bundlePath, port = 4317) {
  const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
  if (!bundle.scope || !Number.isFinite(Date.parse(bundle.scope.start)) || !Number.isFinite(Date.parse(bundle.scope.end))) throw new Error('Bundle has no valid frozen scope');
  const server = createReplayServer(bundle);
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  console.log(`Buzzer lineage replay: http://127.0.0.1:${server.address().port}`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) { console.error('Usage: node src/lineage/server.mjs BUNDLE.json [PORT]'); process.exitCode = 2; }
  else await serve(resolve(process.argv[2]), Number(process.argv[3] || 4317));
}
