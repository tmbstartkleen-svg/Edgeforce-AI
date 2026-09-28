import fs from 'node:fs';

const path=process.argv[2];
if(!path){
 console.error('Usage: node scripts/import-history.mjs historical-data.json');
 process.exit(1);
}
const records=JSON.parse(fs.readFileSync(path,'utf8'));
if(!Array.isArray(records)) throw new Error('Historical package must be an array');
const counts={};
for(const record of records){
 if(!record?.type) throw new Error('Every record requires a type');
 counts[record.type]=(counts[record.type]||0)+1;
}
console.log('Validated historical import package:',counts);
console.log('Next step: batch validated normalized records into PostgreSQL using DATABASE_URL.');
