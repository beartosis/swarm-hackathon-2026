import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {serve} from './server.mjs';

export async function startDemo(directory, port = 4316, {synthetic = false} = {}) {
  const root = resolve(directory);
  const wiki = await serve(join(root, 'wiki-replay-release.json'), port + 1);
  let village;
  try { village = await serve(join(root, 'village-replay-accepted.json'), port + 2); }
  catch (error) { await new Promise(done => wiki.close(done)); throw error; }
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Buzzer · evidence lineage</title>
  <style>body{margin:0;background:#122b2c;color:#f7f1df;font:18px/1.6 system-ui}main{max-width:1020px;margin:auto;padding:8vh 6vw}small{color:#81cab7;letter-spacing:.15em}h1{font-size:clamp(48px,8vw,88px);line-height:1.05;letter-spacing:-.06em;margin:24px 0}p{max-width:740px;color:#cbd2c8}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:20px;margin:44px 0}a.card{display:block;color:#172e2d;background:#f7f1df;padding:28px;border-radius:12px;text-decoration:none}a.card:hover{background:#d5f0db}a.card:focus-visible{outline:4px solid #81cab7;outline-offset:4px}h2{margin:0;font-size:25px}a.card p{color:#455c59;font-size:16px}a{color:#9be0c9}.note{font-size:15px;border-top:1px solid #40605c;padding-top:25px}</style>
  <main><small>BUZZER / ${synthetic?'SYNTHETIC SMOKE DEMO':'RESEARCH DEMO'}</small><h1>Follow the evidence.<br>See where it stops.</h1><p>${synthetic?'All records in this smoke demo are constructed fixtures. They demonstrate the interface and establish no historical research finding.':'Replay versioned contributions, inspect reported uptake, and distinguish it from observed action. Every accepted relationship links back to source records; unsupported conclusions remain unknown.'}</p>
  <div class="cards"><a class="card" href="http://127.0.0.1:${port + 1}"><h2>${synthetic?'Synthetic replay':'Wiki lineage'} →</h2><p>${synthetic?'Constructed proposal, reported use and unresolved matching result.':'A frozen June 16 page family. Explore the original revisions and reviewed reports of information reuse.'}</p></a><a class="card" href="http://127.0.0.1:${port + 2}"><h2>${synthetic?'Same synthetic fixture':'Village audit'} →</h2><p>${synthetic?'A second local endpoint showing the same clearly labelled example.':'April 6–12 room-hours. A bounded comparison of retrieval methods, with original chat and action evidence.'}</p></a></div>
  <p class="note">Retrospective calibration. Source signatures and registry labels are not authenticated agent counts. These cases do not establish large misaligned swarms, causal effects, or generalization.<br><a href="/report">Read findings, validation and limitations</a></p></main></html>`;
  const landing = createServer(async (req, res) => {
    if (!/^(127\.0\.0\.1|localhost)(?::\d+)?$/.test(req.headers.host || '')) {res.writeHead(403);res.end();return;}
    if (req.method !== 'GET') {res.writeHead(405);res.end();return;}
    if (req.url === '/') {res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);return;}
    if (req.url === '/report') {
      try {const report = await readFile(join(root,'REPORT.txt'));res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(report);}
      catch {res.writeHead(404);res.end('Research report not available');}
      return;
    }
    res.writeHead(404);res.end();
  });
  try {await new Promise((done,reject)=>{landing.once('error',reject);landing.listen(port,'127.0.0.1',done);});}
  catch(error){await Promise.all([wiki,village].map(server=>new Promise(done=>server.close(done))));throw error;}
  console.log(`Buzzer demo: http://127.0.0.1:${port}`);
  return {landing,wiki,village};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await startDemo(process.argv[2] || 'output/lineage-build-20261003', Number(process.argv[3] || 4316));
}
