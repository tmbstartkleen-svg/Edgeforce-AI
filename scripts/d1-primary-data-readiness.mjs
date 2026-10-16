// Cloudflare D1 primary readiness evidence. Never performs a production cutover.
// Read a Wrangler --remote D1 query JSON result from stdin or a file.
import fs from 'node:fs';
const file=process.argv[2];
if(!file){console.error('USAGE: node scripts/d1-primary-data-readiness.mjs D1_COUNTS_JSON');process.exit(1)}
const expected=['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'];
let input;
try{input=JSON.parse(fs.readFileSync(file,'utf8'))}catch{console.error('INVALID_D1_COUNTS_JSON');process.exit(1)}
const records=Array.isArray(input)?input:input?.results;
const rows=Array.isArray(records)?records.flatMap(r=>Array.isArray(r?.results)?r.results:r?.table_name?[r]:[]):[];
const counts=Object.fromEntries(rows.filter(r=>typeof r.table_name==='string'&&Number.isSafeInteger(r.row_count)&&r.row_count>=0).map(r=>[r.table_name,r.row_count]));
const missing=expected.filter(t=>!Object.hasOwn(counts,t));
const zero=expected.filter(t=>counts[t]===0);
const duplicate=rows.length!==new Set(rows.map(r=>r.table_name)).size;
const ok=missing.length===0&&!duplicate&&zero.length===0;
console.log(JSON.stringify({ok,kind:'D1_PILOT_PRIMARY_READINESS_CHECK',tableCount:expected.length,missing,emptyTables:zero,sourceReconciliationVerified:false,appPersistenceContractsVerified:false,productionCutoverAuthorized:false}));
if(!ok)process.exitCode=1;
