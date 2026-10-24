import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const path='db/d1/0006_prediction_arbitrage_alerts.sql';
const sql=readFileSync(path,'utf8');
const forbidden=/\b(?:DROP|DELETE|TRUNCATE|REPLACE|ALTER\s+TABLE)\b/i;
if(forbidden.test(sql)){console.error('PREDICTION_MIGRATION_FORBIDDEN_DESTRUCTIVE_SQL');process.exit(1)}
for(const table of ['prediction_arbitrage_watches','prediction_arbitrage_observations','prediction_arbitrage_alerts']){
 if(!sql.includes('CREATE TABLE IF NOT EXISTS '+table)){console.error('PREDICTION_TABLE_NOT_IDEMPOTENT '+table);process.exit(1)}
}
const py=String.raw`import sqlite3,sys,json
sql=sys.stdin.read()
db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
for _ in range(2):
    db.executescript(sql)
names={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required={'prediction_arbitrage_watches','prediction_arbitrage_observations','prediction_arbitrage_alerts'}
assert required.issubset(names), 'MISSING_WATCH_TABLES'
try:
    db.execute("INSERT INTO prediction_arbitrage_watches(watch_id,kalshi_ticker,poly_yes_token,poly_no_token,minimum_net_roi_pct,contract_pairs) VALUES('test','KXTEST-01','123','456',-1,10)")
    raise AssertionError('INVALID_THRESHOLD_ACCEPTED')
except sqlite3.IntegrityError:pass
try:
    db.execute("INSERT INTO prediction_arbitrage_watches(watch_id,kalshi_ticker,poly_yes_token,poly_no_token,minimum_net_roi_pct,contract_pairs,enabled) VALUES('bad','KXTEST-01','123','456',2,10,2)")
    raise AssertionError('INVALID_WATCH_STATE_ACCEPTED')
except sqlite3.IntegrityError:pass
db.execute("INSERT INTO prediction_arbitrage_watches(watch_id,kalshi_ticker,poly_yes_token,poly_no_token,minimum_net_roi_pct,contract_pairs) VALUES('good','KXTEST-01','123','456',2,10)")
assert db.execute("SELECT enabled,settlement_verified FROM prediction_arbitrage_watches WHERE watch_id='good'").fetchone()==(0,0)
try:
    db.execute("INSERT INTO prediction_arbitrage_alerts(watch_id,status,reason,confirmed_executable) VALUES('good','REVIEW_REQUIRED','unknown',1)")
    raise AssertionError('FAKE_EXECUTABLE_ALERT_ACCEPTED')
except sqlite3.IntegrityError:pass
print(json.dumps({'ok':True,'tables':sorted(required),'idempotent':True,'invalid_states_blocked':True,'fake_executable_blocked':True}))`;
const outcome=spawnSync('python3',['-c',py],{input:sql,encoding:'utf8',timeout:12000});
if(outcome.error||outcome.status!==0){console.error(outcome.stderr||outcome.error?.message||'PREDICTION_MIGRATION_FAILED');process.exit(1)}
console.log(outcome.stdout.trim());
