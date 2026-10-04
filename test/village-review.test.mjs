import test from 'node:test';
import assert from 'node:assert/strict';
import {checkReview,reconcilePair,reconcile,kappa} from '../src/village-review-reconcile.mjs';
import {pickControls} from '../src/village-review-packets.mjs';
import {buildFromReview,largestComponent,renderPage} from '../src/lineage/constellation.mjs';

const later='SYNTHETIC: I read notes/a.md from Agent One and\nmerged its table into my draft.';

test('a cited verdict counts only when its quote is in the later message', () => {
 const good=checkReview({verdict:'reported-use',quote:'I read notes/a.md from Agent One and merged its table',artifact:'notes/a.md'},later);
 assert.equal(good.verdict,'reported-use');assert.equal(good.quoteVerified,true);
 const bad=checkReview({verdict:'reported-use',quote:'I carefully studied notes/a.md'},later);
 assert.equal(bad.claimed,'reported-use');assert.equal(bad.verdict,'no-link');assert.equal(bad.quoteVerified,false);
 assert.equal(checkReview({verdict:'no-link',quote:null},later).quoteVerified,null);
 assert.equal(checkReview({verdict:'maybe'},later).verdict,null);
});

test('reconciliation keeps the weaker reading', () => {
 const v=verdict=>({verdict});
 assert.equal(reconcilePair(v('reported-use'),v('reported-use')),'supported');
 assert.equal(reconcilePair(v('reported-use'),v('mention-only')),'mention');
 assert.equal(reconcilePair(v('reported-use'),v('no-link')),'disputed');
 assert.equal(reconcilePair(v('no-link'),v('no-link')),'rejected');
 assert.equal(reconcilePair(v(null),v('no-link')),'unreviewed');
});

test('kappa is 1 for identical ratings and 0 for chance-level ratings', () => {
 assert.equal(kappa([['no-link','no-link'],['reported-use','reported-use']]),1);
 assert.equal(kappa([['no-link','no-link'],['no-link','reported-use'],['reported-use','no-link'],['reported-use','reported-use']]),0);
 assert.equal(kappa([]),null);
});

function fixture(){
 const T=h=>Date.parse(`2026-01-01T0${h}:00:00Z`);
 const messages=[{id:'m1',actor:'u1',time:T(1),text:'SYNTHETIC: wrote notes/a.md',line:1,lineSha256:'h1'},{id:'m2',actor:'u2',time:T(2),text:later,line:2,lineSha256:'h2'},{id:'m3',actor:'u3',time:T(3),text:'SYNTHETIC: unrelated status about notes/a.md',line:3,lineSha256:'h3'}];
 const scan={candidates:[{id:'swarm-x',start:'2026-01-01T01:00:00Z',end:'2026-01-01T03:00:00Z',humanMessagesInScopeInterval:2,actors:[{id:'u1',name:'Agent One'},{id:'u2',name:'Agent Two'},{id:'u3',name:'Agent Three'}],
  edges:[{from:'u1',to:'u2',type:'addressed-artifact-uptake-claim',records:['m1','m2'],lines:[1,2],refs:['path:notes/a.md']},{from:'u1',to:'u3',type:'addressed-artifact-uptake-claim',records:['m1','m3'],lines:[1,3],refs:['path:notes/a.md']}]}]};
 const key=[{itemId:'item-001',kind:'detector-link',pair:['m1','m2'],candidates:['swarm-x'],refs:['path:notes/a.md']},{itemId:'item-002',kind:'detector-link',pair:['m1','m3'],candidates:['swarm-x'],refs:[]},{itemId:'item-003',kind:'unlinked-control',pair:['m2','m3'],candidates:['swarm-x'],refs:[]}];
 const use={verdict:'reported-use',quote:'merged its table into my draft',artifact:'notes/a.md'},none={verdict:'no-link',quote:null};
 const reviews={A:new Map([['item-001',use],['item-002',none],['item-003',none]]),B:new Map([['item-001',use],['item-002',none],['item-003',none]])};
 return {messages,scan,key,reviews};
}

test('reconcile tallies detector links and controls separately', () => {
 const {messages,key,reviews}=fixture(),result=reconcile(key,messages,reviews);
 assert.deepEqual(result.summary.detector,{total:2,supported:1,mention:0,disputed:0,rejected:1,unreviewed:0});
 assert.equal(result.summary.control.rejected,1);
 assert.equal(result.summary.agreement.exact,3);
 assert.deepEqual(result.summary.quotes,{checked:2,verified:2,failed:0});
});

test('controls are unlinked cross-author pairs in time order', () => {
 const {messages,scan}=fixture(),byId=new Map(messages.map(m=>[m.id,m]));
 const controls=pickControls({edges:[...scan.candidates[0].edges,...scan.candidates[0].edges,...scan.candidates[0].edges,...scan.candidates[0].edges]},byId,'seed');
 assert.deepEqual(controls,[['m2','m3']]);
});

test('reviewed page draws supported links, answers the standard questions and counts connected labels', () => {
 const {messages,scan,key,reviews}=fixture(),model=buildFromReview(scan,'swarm-x',messages,reconcile(key,messages,reviews));
 assert.deepEqual(model.edges.map(e=>e.kind),['reported-uptake','rejected']);
 assert.deepEqual(model.summary.component,['Agent One','Agent Two']);
 assert.equal(model.summary.transfers[0].artifact,'notes/a.md');
 assert.equal(model.summary.questions.length,10);
 assert.match(model.summary.questions.find(q=>q.q.startsWith('Were humans')).a,/^2 human messages/);
 const html=renderPage(model,{home:'index.html'});
 assert.match(html,/<b>1<\/b>supported by both reviewers/);
 assert.match(html,/All cases/);
});

test('largest component ignores direction and unconnected lanes', () => {
 const edges=[{producer:'a',consumer:'b'},{producer:'c',consumer:'b'},{producer:'d',consumer:'e'}];
 assert.deepEqual(largestComponent(['a','b','c','d','e','f'],edges).sort(),['a','b','c']);
});
