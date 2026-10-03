import fs from 'node:fs';

const placeholder=/^(?:PASTE_|YOUR_|<|\{\{)/i;
const value=(name)=>String(process.env[name]||'').trim();
const account=value('CLOUDFLARE_ACCOUNT_ID');
const token=value('CLOUDFLARE_API_TOKEN');

const failures=[];
if(!fs.existsSync('package.json'))failures.push('Run this command from the Edgeforce-AI repository root.');
if(!fs.existsSync('wrangler.jsonc'))failures.push('wrangler.jsonc is missing from the repository root.');
if(account&&placeholder.test(account))failures.push('CLOUDFLARE_ACCOUNT_ID still contains a placeholder value. Unset it or replace it with the real account ID.');
if(token&&placeholder.test(token))failures.push('CLOUDFLARE_API_TOKEN still contains a placeholder value. Unset it or replace it with a real token.');
if(account==='PASTE_YOUR_ACCOUNT_ID_HERE')failures.push('CLOUDFLARE_ACCOUNT_ID is the literal PASTE_YOUR_ACCOUNT_ID_HERE placeholder.');
if(token==='PASTE_YOUR_TOKEN_HERE')failures.push('CLOUDFLARE_API_TOKEN is the literal PASTE_YOUR_TOKEN_HERE placeholder.');

const authMode=token?'api-token':'oauth-or-existing-wrangler-session';
const report={
  ok:failures.length===0,
  authMode,
  accountIdConfigured:Boolean(account),
  apiTokenConfigured:Boolean(token),
  repositoryRoot:process.cwd(),
  failures
};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
