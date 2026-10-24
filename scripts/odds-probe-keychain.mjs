#!/usr/bin/env node
/**
 * macOS Keychain wrapper for ONE explicitly acknowledged live odds probe.
 * Never prints/persists API key or invokes network itself. No background jobs.
 */
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {platform,userInfo} from 'node:os';
const args=process.argv.slice(2);
if(args.length!==1||args[0]!=='--ack-provider-charge'){
 console.error('Usage: npm run odds:probe-keychain -- --ack-provider-charge');
 console.error('Only run when you explicitly accept provider API credit usage.');
 process.exitCode=2;
}else if(platform()!=='darwin'){
 console.error('MACOS_KEYCHAIN_REQUIRED');
 process.exitCode=2;
}else{
 let secret;
 try{
  secret=execFileSync('security',['find-generic-password','-a',userInfo().username,
   '-s','edgeforce-the-odds-api','-w'],{
   encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:5000,maxBuffer:8192
  }).trim();
  if(!secret||secret.length>4096)throw Error('INVALID_KEYCHAIN_ENTRY');
 }catch{
  console.error('KEYCHAIN_ODDS_API_KEY_MISSING_OR_UNAVAILABLE');
  console.error('Save it with macOS Keychain under service edgeforce-the-odds-api.');
  process.exitCode=2;
 }
 if(secret){
  const path=fileURLToPath(new URL('./odds-probe-live.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[path,'--ack-provider-charge'],{
   stdio:'inherit',env:{...process.env,THE_ODDS_API_KEY:secret},
   timeout:20000,windowsHide:true
  });
  // No key leaks to command-line arguments. Child environment dies on exit.
  secret=undefined;
  if(result.error){console.error('KEYCHAIN_PROBE_CHILD_FAILED');process.exitCode=3;}
  else process.exitCode=Number.isInteger(result.status)?result.status:3;
 }
}
