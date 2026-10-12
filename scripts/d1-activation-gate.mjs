import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync('wrangler.d1-pilot.jsonc','utf8'));
const flags=['SPORTS_SCORE_COLLECT_ENABLED','SPORTS_D1_WRITE_ENABLED','INTELLIGENCE_D1_WRITE_ENABLED'];
const active=flags.filter(x=>config.vars?.[x]==='true');
const stable=typeof process.env.D1_PILOT_CRON_SECRET==='string'&&process.env.D1_PILOT_CRON_SECRET.length>=32&&
 typeof process.env.D1_PILOT_INGEST_SECRET==='string'&&process.env.D1_PILOT_INGEST_SECRET.length>=32&&
 process.env.D1_PILOT_CRON_SECRET!==process.env.D1_PILOT_INGEST_SECRET;
if(active.length&&!stable){
 console.error('D1 activation refused: persistent distinct CRON and INGEST credentials are required.');
 process.exit(1);
}
console.log('D1 activation gate:',active.length?'stable credentials verified; upstream approval still required':'collection and writes disabled');
