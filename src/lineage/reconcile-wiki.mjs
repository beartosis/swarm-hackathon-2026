import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {enrichWiki} from './assemble.mjs';

const root = resolve(process.argv[2] || 'output/lineage-build-20261003');
const suffix = process.argv[3] || 'accepted';
if(!/^[a-z0-9-]+$/.test(suffix))throw Error('Invalid output revision');
const paths = ['wiki/replay-bundle.json', 'wiki/neutral-packet.json', 'independent-review/wiki-neutral.review.json'];
const bytes = await Promise.all(paths.map(path => readFile(join(root,path))));
const [initial, neutral, review] = bytes.map(data => JSON.parse(data));
if (!review.freeze?.judgments_before_reconciliation) throw Error('Independent first judgment must be frozen');
const bundle = enrichWiki(initial,neutral);
let amendmentBytes=null;
try{amendmentBytes=await readFile(join(root,'wiki/qa-amendment.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
const amendment=amendmentBytes?JSON.parse(amendmentBytes):{corrections:[]};
for(const correction of amendment.corrections){
  if(correction.kind==='edge'){
    const edge=bundle.edges.find(item=>item.id===correction.subject);
    if(edge)edge.citations=edge.citations.map(citation=>citation.recordId===correction.recordId && citation.quote===correction.quote?correction.correctedCitation:citation);
  }
}
const accepted = review.edges.filter(edge=>edge.uptake_status === 'reported');
const recordMap = new Map(bundle.records.map(record=>[record.id,record]));
const decisions = [];
bundle.edges = bundle.edges.map(edge=>{
  const match = accepted.find(item=>edge.evidenceIds.includes(item.version_specificity?.first_contribution_revision) && edge.evidenceIds.includes(item.version_specificity?.consumer_report_revision));
  // Retain the exact latest source timestamp, including sub-millisecond fractions.
  const fraction=value=>(value.match(/\.(\d+)(?:Z|[+-]\d\d:\d\d)$/)?.[1]||'').padEnd(12,'0');
  const availableAt = edge.evidenceIds.map(id=>recordMap.get(id).availableAt).sort((a,b)=>Date.parse(a)-Date.parse(b)||fraction(a).localeCompare(fraction(b))).at(-1);
  const dimension = (status,value)=>({status,value,availableAt,evidenceIds:edge.evidenceIds});
  decisions.push({investigatorEdgeId:edge.id,independentEdgeId:match?.id || null,acceptedStatus:match?'reported':'unknown',
    reason:match?'Both reviewers support source-specific reported analytical reuse.':'Independent review does not establish source-specific uptake; retain as unresolved candidate.'});
  return {...edge,kind:match?'reported-uptake':'unresolved-candidate',status:match?'reported':'unknown',availableAt,
    label:match?'Reported timing-method reuse':'Unresolved contribution-to-uptake candidate',
    summary:match?'A later signature explicitly applies the earlier timing recurrence. This is a reported analytical use, not an observed receiver read or external answer execution.':'The original version pair remains inspectable. Comparison, acknowledgement, or matching content alone does not settle this uptake link.',
    dimensions:{write:dimension('observed','Versioned contribution and reply bodies are preserved in the archive.'),
      read:dimension('unknown','No receiver-read telemetry establishes which revision was fetched.'),
      use:dimension(match?'reported':'unknown',match?'Explicit reported timing-method reuse.':'Source-specific uptake remains unresolved after independent review.'),
      action:dimension('unknown','External answer or monitoring execution is not established by these wiki posts.'),
      producer:dimension('unknown','Source signatures are not authenticated distinct producing agents.'),
      permission:dimension('unknown','Governing information-boundary instructions unavailable.'),
      evaluation:dimension('unknown','No scored outcome or causal evaluation effect.'),
      intent:dimension('unknown','Coordination content does not establish misalignment or coalition intent.')},
    missingLinks:[{dimension:'read',description:'Which revision did the receiver actually read?',availableAt,evidenceIds:edge.evidenceIds},
      {dimension:'action',description:'Did an attributable external action follow?',availableAt,evidenceIds:edge.evidenceIds}]};
});
bundle.claims=[]; // Original global claims lack evidence-bearing subjects; conclusions belong in the review report.
const reconciliation={format:'buzzer-wiki-reconciliation-v1',createdAt:new Date().toISOString(),
  sourceBindings:paths.map((path,i)=>({path,sha256:createHash('sha256').update(bytes[i]).digest('hex')})),
  amendmentBinding:amendmentBytes?{path:'wiki/qa-amendment.json',sha256:createHash('sha256').update(amendmentBytes).digest('hex')}:null,
  decisions,reportedEdges:decisions.filter(row=>row.acceptedStatus==='reported').length,
  unknownEdges:decisions.filter(row=>row.acceptedStatus==='unknown').length,
  motifGate:'not-established',
  disagreement:'Investigator treats named-cohort comparisons as reported analytical uptake and proposes a three-signature fanout. Independent reviewer requires more explicit source-specific uptake. Final demo retains the stricter conclusion and shows disputed pairs as unknown.',
  scientificLimits:'No authenticated producing-agent lower bound, receiver read/executed answer chain, causal effect, misalignment or generalization established.',
  clock:'Retrospective interpretation of originals available at cutoff. Review process time is recorded here separately; no future original supports an earlier edge.'};
await writeFile(join(root,`wiki-replay-${suffix}.json`),JSON.stringify(bundle,null,2)+'\n',{flag:'wx'});
await writeFile(join(root,`wiki-reconciliation-${suffix}.json`),JSON.stringify(reconciliation,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({reported:reconciliation.reportedEdges,unknown:reconciliation.unknownEdges,motif:reconciliation.motifGate}));
