import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(file){return fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');}
const hierarchy=read('src/lib/networkOrganization.ts');
const director=read('src/lib/networkDirector.ts');
const route=read('src/app/api/network/director/route.ts');
const room=read('src/components/NetworkCommand.tsx');
const page=read('src/app/network/page.tsx');

test('one Founder owns the hierarchy and ATLAS reports directly to the Founder',()=>{
 assert.match(hierarchy,/id:'owner',name:'Founder'.*rank:'owner'.*reportsTo:null/);
 assert.match(hierarchy,/id:'atlas',name:'ATLAS'.*rank:'director'.*reportsTo:'owner'/);
 const nodes=[...hierarchy.matchAll(/\{id:'([^']+)',name:'([^']+)'.*rank:'(owner|director|division|specialist)'.*reportsTo:(null|'[^']+')/g)];
 const ids=nodes.map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length);
 assert.equal(nodes.filter(x=>x[3]==='owner').length,1);
 assert.equal(nodes.filter(x=>x[3]==='director').length,1);
 assert.ok(ids.length>=15,'Must have genuine multi-division hierarchy');
 for(const n of nodes){
  const parent=n[4]==='null'?null:n[4].replaceAll("'","");
  if(parent)assert.ok(ids.includes(parent),n[1]+' parent is missing: '+parent);
 }
});

test('founder approval remains mandatory for meaningful external actions',()=>{
 for(const action of ['deploy','spend','purchase-data','activate-provider','wager']){
  assert.match(hierarchy,new RegExp("'"+action+"'"));
 }
 assert.match(route,/requiresOwnerApproval:true|runDirectorNetwork/);
 assert.match(route,/EDGEFORCE_NETWORK_OWNER_TOKEN/);
 assert.match(route,/UNAUTHORIZED/);
 assert.match(route,/tokenMatches/);
 assert.match(route,/crypto\.subtle\.digest/);
});

test('director delegates real model-assisted tasks and independent critic',()=>{
 assert.match(director,/api\.openai\.com\/v1\/chat\/completions/);
 assert.match(director,/Promise\.all\(chosen\.map/);
 assert.match(director,/SENTINEL, Independent Verification Director/);
 assert.match(director,/ATLAS, the Chief Director/);
 assert.match(director,/modelCall/);
 assert.match(director,/actionableBetRecommendations:false/);
 assert.match(director,/verifiedValueBets:false/);
 assert.match(director,/ordersPlaced:0/);
 assert.match(director,/providerCoverageGuaranteed:false/);
 assert.doesNotMatch(director,/draftkings\.com/);
});

test('owner command room exposes approvals, directors, tasks, and evidence',()=>{
 assert.match(room,/Founder access token/);
 assert.match(room,/Founder.*access token/);
 assert.match(room,/founder|FOUNDER/);
 assert.match(room,/networkMissionStats/);
 assert.match(room,/networkReport/);
 assert.match(room,/SENTINEL|networkLimit/);
 assert.match(room,/\/api\/network\/director/);
 assert.match(room,/type="password"/);
 assert.doesNotMatch(room,/localStorage/);
 assert.match(page,/NetworkCommand/);
});

test('research route reuses existing quota-aware provider and does not hallucinate coverage',()=>{
 assert.match(route,/ingestOdds\(\)/);
 assert.match(route,/scanEdgeOpportunities\(marketPanel/);
 assert.match(route,/buildTeamResearch/);
 assert.match(route,/No guaranteed coverage of all DraftKings markets/);
 assert.match(route,/AI_NOT_CONFIGURED/);
 assert.match(route,/ownerToken\.length<24/);
});
