import fs from 'node:fs/promises';
import path from 'node:path';
import {db} from './db';

export async function runRuntimeMigrations(){
 const sql=db();
 if(!sql)throw new Error('DATABASE_URL is not configured in the deployed runtime');
 await sql`
  create table if not exists schema_migrations(
   version text primary key,
   applied_at timestamptz not null default now()
  )
 `;
 const dir=path.resolve(process.cwd(),'db');
 const files=(await fs.readdir(dir)).filter(name=>/^v\d+\.sql$/.test(name))
  .sort((a,b)=>Number(a.match(/\d+/)?.[0]||0)-Number(b.match(/\d+/)?.[0]||0));
 const applied:string[]=[];
 const skipped:string[]=[];
 for(const file of files){
  const version=file.replace('.sql','');
  const exists=await sql`select version from schema_migrations where version=${version}`;
  if(exists.length){skipped.push(version);continue}
  const body=await fs.readFile(path.join(dir,file),'utf8');
  await sql.begin(async tx=>{
   await tx.unsafe(body);
   await tx`insert into schema_migrations(version) values(${version})`;
  });
  applied.push(version);
 }
 return {ok:true,applied,skipped,latest:files.at(-1)?.replace('.sql','')||null};
}
