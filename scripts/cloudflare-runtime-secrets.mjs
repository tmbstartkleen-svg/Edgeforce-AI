import {writeFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const required=['DATABASE_URL','THE_ODDS_API_KEY','INGEST_SECRET','CRON_SECRET'];
const optional=['SPORTS_GAME_ODDS_API_KEY'];

export function runtimeSecrets(env){
 const secrets={};
 for(const key of required){
  const value=env[key];
  if(typeof value!=='string'||!value.trim()||/[\r\n\0]/.test(value)||value==='[SENSITIVE]'){
   throw new Error('Required Cloudflare runtime secret is missing or invalid');
  }
  secrets[key]=value;
 }
 for(const key of optional){
  const value=env[key];
  if(value===undefined||value==='')continue;
  if(typeof value!=='string'||!value.trim()||/[\r\n\0]/.test(value)||value==='[SENSITIVE]'){
   throw new Error('Optional Cloudflare runtime secret is invalid');
  }
  secrets[key]=value;
 }
 return secrets;
}

export function writeRuntimeSecrets(file,env=process.env){
 if(typeof file!=='string'||!isAbsolute(file))throw new Error('An absolute private secrets-file path is required');
 const content=JSON.stringify(runtimeSecrets(env));
 // Exclusive creation refuses existing files and symlinks. Never overwrite or
 // follow a path that could have been placed by another process.
 try{
  writeFileSync(file,content,{encoding:'utf8',mode:0o600,flag:'wx'});
 }catch{
  throw new Error('Could not create the private Cloudflare secrets file');
 }
 return {prepared:true};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 try{
  writeRuntimeSecrets(process.argv[2]);
  console.log('Cloudflare runtime secrets prepared for atomic deployment; values withheld.');
 }catch{
  // Do not log raw error paths, environment values or secret-bearing content.
  console.error('Cloudflare runtime secrets preparation failed; deployment blocked.');
  process.exitCode=1;
 }
}
