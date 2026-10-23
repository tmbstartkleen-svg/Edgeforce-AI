import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=p=>ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+p,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const dep=uri(compile('draftkings-player-identity-reconciliation.ts'));
const compiled=compile('odds-export-player-identity-audit.ts')
 .replace("from './draftkings-player-identity-reconciliation'","from "+JSON.stringify(dep));
const {auditOddsExportPlayerIdentities}=await import(uri(compiled));
const now=Date.parse('2026-10-23T21:00:00Z');
const event=()=>[{id:'match-1',sport_key:'basketball_nba',sport_title:'NBA',
 commence_time:new Date(now+3600000).toISOString(),bookmakers:[{key:'draftkings',
 last_update:new Date(now-20000).toISOString(),markets:[{key:'player_points',
 outcomes:[{name:'Over',description:'Jane Smith',price:-115,point:21.5}]}]}]}];
const roster=[{eventId:'match-1',sport:'basketball_nba',league:'NBA',
 athleteId:'athlete-123',displayName:'Jane Smith',teamId:'NY'}];
test('provider player points joined to event roster remain unverified research matches',()=>{
 const r=auditOddsExportPlayerIdentities(event(),roster,now);
 assert.equal(r.examinedProviderOutcomes,1);
 assert.equal(r.candidateCount,1);
 assert.equal(r.candidates[0].proposedAthleteId,'athlete-123');
 assert.equal(r.certifiedProps,0);
 assert.equal(r.releaseCertified,false);
});
test('no roster and malformed bookmaker payload yield no certified player props',()=>{
 const r=auditOddsExportPlayerIdentities(event(),[],now);
 assert.equal(r.candidateCount,0);
 assert.equal(r.unresolvedCount,1);
 assert.equal(r.issues.ATHLETE_NOT_FOUND,1);
 assert.equal(auditOddsExportPlayerIdentities([],roster,now).certifiedProps,0);
});
test('offline export audit cannot request or persist live sportsbook data',()=>{
 assert.doesNotMatch(compiled,/fetch\(|INSERT INTO|writeFile/);
});
