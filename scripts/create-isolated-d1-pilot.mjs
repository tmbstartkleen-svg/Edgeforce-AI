import {writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
const name='edgeforce-d1-pilot-isolated';
if(!/^[a-f\d]{32}$/i.test(account??'')||!token)throw Error('Cloudflare account ID or API token missing/invalid');
const endpoint=`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`;
async function api(url,init={}){
 const response=await fetch(url,{...init,headers:{Authorization:`Bearer ${token}`,...(init.headers??{})}});
 const body=await response.json().catch(()=>({}));
 if(!response.ok||body.success!==true)throw Error(`Cloudflare D1 API failed (HTTP ${response.status}); ensure token has D1 Edit permission. ${(body.errors??[]).map(e=>e.code??'error').join(',')}`);
 return body.result;
}
const list=await api(endpoint+'?per_page=100');
const databases=Array.isArray(list)?list:Array.isArray(list?.databases)?list.databases:[];
const found=databases.filter(x=>x.name===name);
if(found.length>1)throw Error('Duplicate pilot database names: manual investigation required');
let db=found[0];
if(!db){
 console.log('Isolated pilot not found; requesting dedicated D1 database creation');
 db=await api(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
}
const uuid=db.uuid??db.id;
if(!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(uuid??''))throw Error('Cloudflare did not return valid D1 database UUID');
if(uuid==='335bcda1-8603-4bdf-8e27-acefdf0d8069')throw Error('Pilot database matches existing EdgeForce D1 database');
const summary=`Created or found isolated pilot D1 database: ${name} (UUID: ${uuid}). Existing edgeforce-intelligence is unchanged. No schema migration performed.\n`;
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)writeFileSync(process.env.GITHUB_STEP_SUMMARY,summary,{flag:'a'});
