import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

// Execute real SQLite statements against the same reference schema that D1 uses.
// This is local SQL behavior verification, not a Cloudflare remote D1 smoke test.
const schema=readFileSync('db/d1/0002_reference_entities.sql','utf8')+'\n'+readFileSync('db/d1/0005_event_provenance.sql','utf8');
const py=`
import json,sqlite3,sys
db=sqlite3.connect(':memory:')
db.executescript(sys.stdin.read())
sql="INSERT OR IGNORE INTO teams(id,sport,name,metadata) VALUES(?,?,?,?)"
with db:
 db.execute(sql,('t1','soccer','Team One','{"source":"test"}'))
count_after_first=db.execute("SELECT count(*) FROM teams").fetchone()[0]
with db:
 db.execute(sql,('t1','soccer','Team One','{"source":"test"}'))
count_after_duplicate=db.execute("SELECT count(*) FROM teams").fetchone()[0]
try:
 with db:
  db.execute(sql,('t2','soccer','Team Two','{"source":"test"}'))
  db.execute("INSERT INTO teams(id,sport,name,metadata) VALUES(?,?,?,?)",('t3','soccer','Team Three','not-json'))
except sqlite3.IntegrityError:
 pass
count_after_failure=db.execute("SELECT count(*) FROM teams").fetchone()[0]
cols=[r[1] for r in db.execute("PRAGMA table_info(events)")]
print(json.dumps({"first":count_after_first,"duplicate":count_after_duplicate,"rollback":count_after_failure,"event_provenance":all(c in cols for c in ['source','observed_at'])}))
`;
test('reference entity SQL enforces idempotent insert and rollback after a batch failure',()=>{
 const run=spawnSync('python3',['-c',py],{input:schema,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const result=JSON.parse(run.stdout);
 assert.deepEqual(result,{first:1,duplicate:1,rollback:1,event_provenance:true});
});
