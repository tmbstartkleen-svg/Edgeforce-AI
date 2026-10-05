import fs from 'node:fs';

const file=process.argv[2];
if(!file||!fs.existsSync(file))process.exit(1);
const raw=fs.readFileSync(file,'utf8').trim();
let data=null;
try{data=JSON.parse(raw)}catch{}

const candidates=[
 data?.url,
 data?.preview_url,
 data?.previewUrl,
 data?.deployment_url,
 data?.deploymentUrl,
 data?.result?.url,
 data?.result?.preview_url,
 data?.result?.previewUrl
].filter(Boolean);

if(!candidates.length){
 const match=raw.match(/https:\/\/[^\s"'<>]+/);
 if(match)candidates.push(match[0]);
}
const url=String(candidates[0]||'').replace(/[),.;]+$/,'');
if(!/^https:\/\//.test(url))process.exit(1);
process.stdout.write(url);
