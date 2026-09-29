import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const url=process.env.DATABASE_URL;
if(!url){
 console.error('DATABASE_URL is required');
 process.exit(1);
}

const sql=postgres(url,{max:1,prepare:false});
await sql`
 create table if not exists schema_migrations(
  version text primary key,
  applied_at timestamptz not null default now()
 )
`;

const dir=path.resolve(process.cwd(),'db');
const files=(await fs.readdir(dir))
 .filter(name=>/^v\d+\.sql$/.test(name))
 .sort((a,b)=>Number(a.match(/\d+/)?.[0]||0)-Number(b.match(/\d+/)?.[0]||0));

for(const file of files){
 const version=file.replace('.sql','');
 const exists=await sql`select version from schema_migrations where version=${version}`;
 if(exists.length){
  console.log('skip',version);
  continue;
 }
 const body=await fs.readFile(path.join(dir,file),'utf8');
 console.log('apply',version);
 await sql.begin(async tx=>{
  await tx.unsafe(body);
  await tx`insert into schema_migrations(version) values(${version})`;
 });
}
await sql.end();
console.log('migrations complete');
