import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const source=read('../src/lib/networkAgentTeam.ts')
 .replace(/^import \{db\} from '[^']+';\n/m,'')
 .replace(/^import \{ESPN_SCOREBOARD_FEEDS\} from '[^']+';\n/m,'')
 .replace(/^import \{easternDay,loadSchedule\} from '[^']+';\n/m,'');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(output.diagnostics?.length??0,0);
const {NETWORK_AGENT_IDS,normalizeAgentSourceIds,safeAgeMinutes}=await import('data:text/javascript,'+encodeURIComponent(output.outputText));
test('V211 seven network agents have independently named fact-checking specialties',()=>{
 assert.equal(NETWORK_AGENT_IDS.length,7);
 assert.equal(new Set(NETWORK_AGENT_IDS).size,7);
 for(const key of ['market-watch','injury-watch','player-watch','forecast-audit','score-watch','book-comparison','score-scout'])
  assert.ok(NETWORK_AGENT_IDS.includes(key));
});
test('V211 no source labels or absent timestamps are invented or promoted',()=>{
 const now=Date.parse('2026-10-10T21:00:00Z');
 assert.equal(safeAgeMinutes(null,now),null);
 assert.equal(safeAgeMinutes('not-a-time',now),null);
 assert.equal(safeAgeMinutes('2026-10-10T20:50:00Z',now),10);
 assert.equal(safeAgeMinutes('2026-10-10T21:05:00Z',now),null);
 assert.deepEqual(normalizeAgentSourceIds(['espn-core-odds','sharp-api','sharp-api','bad upstream','']),['espn-core-odds','sharp-api']);
});
test('V211 PostgreSQL schedule uses short leases, cross-instance locks, 2-agent cap and durable history',()=>{
 const migration=read('../db/v211.sql');
 const team=read('../src/lib/networkAgentTeam.ts');
 const run=read('../src/app/api/network/v1/agents/dispatch/route.ts');
 const status=read('../src/app/api/network/v1/agents/route.ts');
 assert.match(migration,/edgeforce_network_agents_v211/);
 assert.match(migration,/edgeforce_network_agent_observations_v211/);
 assert.match(migration,/lease_token text/);
 assert.match(migration,/on conflict \(agent_id\) do nothing/);
 assert.match(team,/for update skip locked/);
 assert.match(team,/interval '4 minutes'/);
 assert.match(team,/Math\.min\(2,Math\.floor\(limit\)\)/);
 assert.match(team,/tx\.json\(result\.facts(?: as any)?\)/);
 assert.match(team,/collectNetworkAgent/);
 assert.match(run,/authorizeNetwork\(request\)/);
 assert.match(run,/EDGEFORCE_AGENT_TEAM_ENABLED/);
 assert.match(status,/authorizeNetwork\(request\)/);
 assert.match(status,/observed_at desc,id desc limit 1/);
 assert.doesNotMatch(run,/\bfetch\(/);
 assert.doesNotMatch(status,/\bfetch\(/);
});
test('V211 external scoreboard requires explicit rights and only one selected league per tick',()=>{
 const team=read('../src/lib/networkAgentTeam.ts');
 assert.match(team,/EDGEFORCE_AGENT_SCORE_SOURCE_ENABLED/);
 assert.match(team,/EDGEFORCE_OUTCOME_ALLOWED_SOURCES/);
 assert.match(team,/EDGEFORCE_AGENT_SCORE_FEEDS/);
 assert.match(team,/loadSchedule\(easternDay\(0\),0,chosen.id\)/);
 assert.match(team,/Math\.floor\(now\/3600000\)/);
 const schedule=read('../.github/workflows/sports-network-agent-team.yml');
 assert.match(schedule,/7,37 \* \* \* \*/);
 assert.match(schedule,/EDGEFORCE_NETWORK_TOKEN_RAW/);
 assert.match(schedule,/EDGEFORCE_AGENT_TEAM_ENABLED/);
 assert.match(schedule,/maxJobs/);
 assert.match(schedule,/--retry 0/);
 const ui=read('../src/components/SportsNetworkAgents.tsx');
 assert.match(ui,/Sports Network/i);
 assert.doesNotMatch(ui,/setInterval|localStorage/);
});
