import {readFileSync,writeFileSync} from 'node:fs';
import {scoreSports} from '../src/lib/intelligence-core/score-source-catalog.mjs';
import {soccerCandidates} from '../src/lib/intelligence-core/soccer-fixture-registry.mjs';
const manifest=JSON.parse(readFileSync(new URL('../config/soccer-coverage-targets.json',import.meta.url),'utf8'));
export function auditSoccerCoverage({targets=manifest.draftKingsLeagueSeed,approved=scoreSports}={}){
 const current=approved.filter(x=>x.id.startsWith('soccer-'));
 const normal=x=>x.toLowerCase().replace(/^english /,'').replace(/[^a-z0-9]/g,'');
 const recognized=new Set(current.map(x=>normal(x.label)));
 const uncovered=targets.filter(x=>!recognized.has(normal(x)));
 return {persona:manifest.persona,verifiedComplete:false,targetLeagueCount:targets.length,
   activeApprovedScoreboardLeagues:current.map(x=>x.label),uncoveredTargets:uncovered,
   missingLeagueCount:uncovered.length,candidateSoccerLeagues:soccerCandidates.map(x=>x.league),
   candidateLeaguesNotEnabled:soccerCandidates.filter(x=>!current.some(s=>s.id===x.id)).map(x=>x.league),
   evidence:'STATIC_SEED_ONLY_NOT_LIVE_DRAFTKINGS_INVENTORY',
   liveDraftKingsOddsVerified:false,allFixturesVerified:false};
}
if(import.meta.url===`file://${process.argv[1]}`){
 const result=auditSoccerCoverage();
 const output=process.argv[2];
 if(output)writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 else process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
