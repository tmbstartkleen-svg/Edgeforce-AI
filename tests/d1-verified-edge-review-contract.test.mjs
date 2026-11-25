import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const worker=read('worker/d1-sportsbook-opportunity-review.ts');
const join=read('src/lib/intelligence-core/d1-verified-edge-join.mjs');
const ui=read('src/components/RemoteOperationsDashboard.tsx');

test('V196 D1 review joins stored quote model and calibration evidence without writes',()=>{
 assert.match(worker,/reviewD1ModelEdges/);
 assert.match(worker,/FROM model_runs/);
 assert.match(worker,/FROM calibration_metrics/);
 assert.match(worker,/modelEdgeReview/);
 assert.match(worker,/modelVerifiedEdges:\[\]/);
 assert.match(worker,/ordersPlaced:0/);
 assert.match(worker,/externalRequests:0/);
 assert.doesNotMatch(worker,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b/i);
 assert.doesNotMatch(worker,/fetch\(/);
});

test('V196 edge join requires independent out-of-sample validation evidence and exact chronology',()=>{
 assert.match(join,/probabilityOrigin!=='INDEPENDENT_MODEL'/);
 assert.match(join,/outOfSampleVerified!==true/);
 assert.match(join,/validationEvidenceGrade/);
 assert.match(join,/promotionEligible!==true/);
 assert.match(join,/validationEvidenceId/);
 assert.match(join,/createdAt>=start/);
 assert.match(join,/q\.observedAt<createdAt\|\|q\.observedAt>=start/);
 assert.match(join,/INDEPENDENT_UPSTREAM_CONSENSUS_MISSING/);
 assert.match(join,/TARGET_BOOK_QUOTE_MISSING/);
 assert.match(join,/productionBetRecommendationAuthorized:false/);
 assert.match(join,/upstreamIdentityIndependentlyAuthenticated:false/);
});

test('V196 operations UI separates model review from theoretical pricing and never exposes execution controls',()=>{
 assert.match(ui,/Independent-model edge review/);
 assert.match(ui,/Model \+EV review/);
 assert.match(ui,/Review only · never auto-authorized/);
 assert.match(ui,/No model probability is inferred from sportsbook prices/);
 assert.match(ui,/execution NONE/);
 assert.match(ui,/Validation assertion/);
 assert.match(ui,/model-supplied assertions/);
 assert.doesNotMatch(ui,/orders\.create\(|placeOrder\(|submitOrder\(/);
});
