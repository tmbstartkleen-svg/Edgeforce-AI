import {writeFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const required=['DATABASE_URL','INGEST_SECRET','CRON_SECRET'];
const optional=['THE_ODDS_API_KEY','SPORTS_GAME_ODDS_API_KEY','FOOTBALL_DATA_API_KEY','API_SPORTS_KEY','BIGBALLS_API_KEY'];

export function runtimeSecrets(env){
 const secrets={};
 for(const key of required){
  const value=env[key];
  if(typeof value!=='string'||!value.trim()||/[\r\n\0]/.test(value)||value==='[SENSITIVE]'){
   throw new Error('Required Cloudflare runtime secret is missing or invalid');
  }
  secrets[key]=value;
 }
 // Sharp is a strictly opt-in provider. Do not silently copy a key into Cloudflare
 // or activate delayed third-party feeds without explicit operator intent.
 if(env.SHARP_API_ENABLED==='true'){
  const key=env.SHARP_API_KEY;
  if(typeof key!=='string'||!key.trim()||key==='[SENSITIVE]'||/[\r\n\0]/.test(key)){
   throw new Error('SharpAPI was enabled but its GitHub secret is missing or invalid');
  }
  secrets.SHARP_API_KEY=key;
  secrets.SHARP_API_ENABLED='true';
 }else if(env.SHARP_API_ENABLED!==undefined&&env.SHARP_API_ENABLED!==''&&env.SHARP_API_ENABLED!=='false'){
  throw new Error('SharpAPI opt-in must be exactly true or false');
 }
 // The first-party network stores only a SHA-256 digest of an operator-issued token.
 // Explicit presence is optional, but malformed data must block deployment rather than
 // silently turn off authentication or accidentally ship a raw bearer token.
 const networkHash=env.EDGEFORCE_NETWORK_TOKEN_SHA256;
 if(networkHash!==undefined&&networkHash!==''){
  if(typeof networkHash!=='string'||!/^[a-f0-9]{64}$/i.test(networkHash.trim())){
   throw new Error('EdgeForce Network authentication hash is invalid');
  }
  secrets.EDGEFORCE_NETWORK_TOKEN_SHA256=networkHash.trim().toLowerCase();
 }
 // Archive access is always opt-in and depends on explicit source retention rights.
 for(const variable of ['EDGEFORCE_ARCHIVE_WRITES_ENABLED','EDGEFORCE_ARCHIVE_PLAYER_STATS_ENABLED']){
  const flag=env[variable];
  if(flag!==undefined&&flag!==''&&flag!=='false'&&flag!=='true')
   throw new Error('Archive opt-in variable must be exactly true or false');
  if(flag==='true')secrets[variable]='true';
 }
 const sources=env.EDGEFORCE_ARCHIVE_ALLOWED_PROVIDERS;
 if(sources!==undefined&&sources!==''){
  if(typeof sources!=='string'||sources.length>1800||
   sources.split(',').some(x=>!/^[A-Za-z0-9._-]{2,64}$/.test(x.trim()))){
   throw new Error('Archive source allowlist contains invalid provider IDs');
  }
  secrets.EDGEFORCE_ARCHIVE_ALLOWED_PROVIDERS=sources;
 }
 // V209 scoreboard and operator-imported plays are explicitly opt-in, separately licensed.
 for(const variable of ['EDGEFORCE_OUTCOME_CAPTURE_ENABLED','EDGEFORCE_PLAY_IMPORT_ENABLED']){
  const enabled=env[variable];
  if(enabled!==undefined&&enabled!==''&&enabled!=='false'&&enabled!=='true')
   throw new Error('Sports history opt-in flag must be exactly true or false');
  if(enabled==='true')secrets[variable]='true';
 }
 for(const variable of ['EDGEFORCE_OUTCOME_ALLOWED_SOURCES','EDGEFORCE_PLAY_ALLOWED_PROVIDERS']){
  const sources=env[variable];
  if(sources!==undefined&&sources!==''){
   if(typeof sources!=='string'||sources.length>1800||
    sources.split(',').some(s=>!/^[A-Za-z0-9._-]{2,64}$/.test(s.trim())))
    throw new Error('Sports history source rights allowlist is invalid');
   secrets[variable]=sources;
  }
 }
 // Human-reviewed source identity mappings must be explicitly enabled.
 const review=env.EDGEFORCE_IDENTITY_REVIEW_ENABLED;
 if(review!==undefined&&review!==''&&review!=='true'&&review!=='false')
  throw new Error('Identity review opt-in must be exactly true or false');
 if(review==='true')secrets.EDGEFORCE_IDENTITY_REVIEW_ENABLED='true';
 // First-party agents are opt-in. Never begin external polling from release defaults.
 for(const variable of ['EDGEFORCE_AGENT_TEAM_ENABLED','EDGEFORCE_AGENT_SCORE_SOURCE_ENABLED']){
  const enabled=env[variable];
  if(enabled!==undefined&&enabled!==''&&enabled!=='true'&&enabled!=='false')
   throw new Error('Sports agent enablement must be exactly true or false');
  if(enabled==='true')secrets[variable]='true';
 }
 const ids=env.EDGEFORCE_AGENT_SCORE_FEEDS;
 if(ids!==undefined&&ids!==''){
  if(typeof ids!=='string'||ids.length>300||
   ids.split(',').some(x=>!/^[a-z0-9-]{2,40}$/.test(x.trim())))
   throw new Error('Sports agent scoreboard league list invalid');
  secrets.EDGEFORCE_AGENT_SCORE_FEEDS=ids;
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
