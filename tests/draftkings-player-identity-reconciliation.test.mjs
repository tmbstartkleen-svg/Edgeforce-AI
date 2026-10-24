import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const raw=fs.readFileSync(new URL('../src/lib/draftkings-player-identity-reconciliation.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {reconcilePlayerProps}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const now=Date.parse('2026-10-23T21:00:00Z');
const athlete=(extra={})=>({athleteId:'athlete-123',displayName:'Jane Smith',teamId:'NY',
 eventId:'event1',sport:'basketball_nba',league:'NBA',aliases:['J. Smith'],...extra});
const prop=(extra={})=>({eventId:'event1',sport:'basketball_nba',league:'NBA',teamId:'NY',
 athleteName:'Jane Smith',marketType:'player_points',line:'21.5',outcomeId:'Over',americanOdds:-115,
 observedAt:new Date(now-10000).toISOString(),startsAt:new Date(now+3600000).toISOString(),...extra});
test('unique player event/team scoped match is only a provisional candidate',()=>{
 const r=reconcilePlayerProps([prop()],[athlete()],now);
 assert.equal(r.candidateCount,1);
 assert.equal(r.candidates[0].proposedAthleteId,'athlete-123');
 assert.equal(r.candidates[0].status,'ROSTER_MATCH_UNVERIFIED');
 assert.equal(r.pricedPropsCertified,0);
 assert.equal(r.rosterSourceAuthenticated,false);
 assert.equal(r.releaseCertified,false);
});
test('similarly named athletes and team mismatch never pick an arbitrary identity',()=>{
 const r=reconcilePlayerProps([prop({teamId:undefined})],
  [athlete(),athlete({athleteId:'athlete-456',teamId:'LA'})],now);
 assert.equal(r.candidateCount,0);
 assert.equal(r.issues.AMBIGUOUS_ATHLETE,1);
 assert.equal(reconcilePlayerProps([prop({teamId:'LA'})],[athlete()],now).unresolvedCount,1);
});
test('name-only IDs, stale quotes and wrong event never count as certified athletes',()=>{
 const a=reconcilePlayerProps([prop()],[athlete({athleteId:'name:jane-smith'})],now);
 assert.equal(a.issues.INVALID_ATHLETE,1);
 assert.equal(a.candidateCount,0);
 const b=reconcilePlayerProps([prop({observedAt:new Date(now-3600000).toISOString()})],[athlete()],now);
 assert.equal(b.issues.STALE_OR_STARTED_PROP,1);
 const c=reconcilePlayerProps([prop({eventId:'event2'})],[athlete()],now);
 assert.equal(c.issues.ATHLETE_NOT_FOUND,1);
});
test('aliases require exact normalized full-name equality, not fuzzy matching',()=>{
 const a=reconcilePlayerProps([prop({athleteName:'J. Smith'})],[athlete()],now);
 assert.equal(a.candidateCount,1);
 const b=reconcilePlayerProps([prop({athleteName:'Smith'})],[athlete()],now);
 assert.equal(b.candidateCount,0);
});
test('reconciliation cannot call network, write stores or issue certifications',()=>{
 assert.doesNotMatch(raw,/fetch\(|INSERT INTO|writeFile\(|Math\.random/);
 assert.throws(()=>reconcilePlayerProps([],[],Infinity),/INVALID_PROP_IDENTITY_BATCH/);
});
