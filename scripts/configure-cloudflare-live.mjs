import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const run=(args,options={})=>{
 const result=spawnSync('npx',['wrangler',...args],{cwd:process.cwd(),encoding:'utf8',...options});
 if(result.stdout)process.stdout.write(result.stdout);
 if(result.stderr)process.stderr.write(result.stderr);
 if(result.status!==0)process.exit(result.status??1);
};

const promptSecret=(name)=>{
 console.log(`\nConfiguring Cloudflare secret: ${name}`);
 console.log('Wrangler will ask for the value in your terminal. Do not paste it into chat.');
 run(['secret','put',name,'--config','wrangler.jsonc'],{stdio:'inherit',encoding:undefined});
};

const generatedSecret=(name)=>{
 const secret=randomBytes(32).toString('hex');
 const result=spawnSync('npx',['wrangler','secret','put',name,'--config','wrangler.jsonc'],{
  cwd:process.cwd(),
  input:secret+'\n',
  encoding:'utf8',
 });
 if(result.stdout)process.stdout.write(result.stdout.replaceAll(secret,'[redacted]'));
 if(result.stderr)process.stderr.write(result.stderr.replaceAll(secret,'[redacted]'));
 if(result.status!==0)process.exit(result.status??1);
};

console.log('Edgeforce Cloudflare live-data setup');
console.log('This configures encrypted Worker secrets without printing their values.');

promptSecret('THE_ODDS_API_KEY');
promptSecret('DATABASE_URL');
generatedSecret('INGEST_SECRET');
generatedSecret('CRON_SECRET');

console.log('\nCloudflare live-data secrets configured.');
console.log('Next: npm run deploy:cloudflare');
