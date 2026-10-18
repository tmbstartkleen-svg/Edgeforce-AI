import postgres from 'postgres';
const url=process.env.DATABASE_URL||process.env.EDGEFORCE_DATABASE_URL;
if(!url){console.error('DATABASE_PREFLIGHT_CONFIG_MISSING: release blocked; no database URL.');process.exit(1);}
const sql=postgres(url,{max:1,prepare:false,connect_timeout:8,idle_timeout:5});
try{
 await sql`select 1 as healthy`;
 console.log('DATABASE_PREFLIGHT_CONNECTED: read-only PostgreSQL connectivity verified.');
 console.log('DATABASE_PREFLIGHT_LIMITATION: connectivity does not prove storage quota or migration readiness; production migrations remain mandatory.');
}catch(error){
 const code=typeof error?.code==='string'?error.code:'UNKNOWN';
 if(code==='53000'||/exceeded the quota/i.test(String(error?.message||''))){
  console.error('DATABASE_PREFLIGHT_QUOTA_BLOCKED: PostgreSQL resource/quota limit. Review provider plan, billing, storage and project limits before migration. No database reset or schema bypass attempted.');
 }else{
  console.error('DATABASE_PREFLIGHT_FAILED: PostgreSQL connectivity or permission check failed; error code '+(/^[A-Z0-9]{1,8}$/.test(code)?code:'UNKNOWN'));
 }
 process.exitCode=1;
}finally{await sql.end({timeout:3}).catch(()=>{});}
