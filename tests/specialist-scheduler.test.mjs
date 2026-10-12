import test from 'node:test';import assert from 'node:assert/strict';
import {planSpecialistAssignments} from '../src/lib/intelligence-core/specialist-scheduler.mjs';
test('distinct sport and non-sports jobs require approved licensed sources',()=>{
 const jobs=[{id:'nfl',division:'SPORTS',sport:'NFL',sourceId:'approved',cost:2},
 {id:'economy',division:'PREDICTION_MARKETS',category:'ECONOMICS',sourceId:'approved',cost:2},
 {id:'fake',division:'SPORTS',sport:'NHL',sourceId:'unapproved',cost:1}];
 const x=planSpecialistAssignments({jobs,approvedSources:[{sourceId:'approved',enabled:true,licenseApproved:true}],maxCost:4});
 assert.equal(x.assignments.length,2);assert.equal(x.rejected.length,1);
 assert.notEqual(x.assignments[0].agentId,x.assignments[1].agentId);
 assert.equal(x.mode,'PLAN_ONLY');
 assert.equal(x.dataPreservation,'NO_DELETES_NO_MIGRATIONS');
});
test('unapproved source and disabled agent never receive assignments',()=>{
 const x=planSpecialistAssignments({jobs:[{id:1,division:'SPORTS',sport:'NFL',sourceId:'p'}],
 approvedSources:[{sourceId:'p',enabled:true,licenseApproved:false}]});
 assert.equal(x.assignments.length,0);
});
