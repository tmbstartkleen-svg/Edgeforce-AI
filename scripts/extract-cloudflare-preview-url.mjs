import fs from 'node:fs';

const file=process.argv[2];
if(!file||!fs.existsSync(file))process.exit(1);
const raw=fs.readFileSync(file,'utf8').trim();
let data=null;
try{data=JSON.parse(raw)}catch{}

const structured=[
 data?.url,
 data?.preview_url,
 data?.previewUrl,
 data?.deployment_url,
 data?.deploymentUrl,
 data?.result?.url,
 data?.result?.preview_url,
 data?.result?.previewUrl
].filter(Boolean).map(String);

const rawUrls=[...(raw.match(/https:\/\/[^\s"'<>]+/g)||[])].map(x=>x.replace(/[),.;]+$/,''));
const safe=[...structured,...rawUrls].filter(url=>
 /^https:\/\//.test(url)
 && !url.includes('claim-preview')
 && !url.includes('cloudflare.com/terms')
 && !url.includes('cloudflare.com/privacypolicy')
);
const preferred=safe.find(url=>/\.workers\.dev(?:\/|$)/.test(url))
 || safe.find(url=>/\.pages\.dev(?:\/|$)/.test(url))
 || safe[0]
 || '';
if(!preferred)process.exit(1);
process.stdout.write(preferred);
