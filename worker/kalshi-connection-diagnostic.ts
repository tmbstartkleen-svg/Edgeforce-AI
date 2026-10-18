import {kalshiReadOnlyHeaders} from '../src/lib/providers/kalshi-readonly-auth';

type Env={KALSHI_API_KEY_ID?:string;KALSHI_PRIVATE_KEY?:string;INGEST_SECRET?:string};

export async function kalshiConnectionDiagnostic(request:Request,env:Env):Promise<Response>{
 const json=(payload:Record<string,unknown>,status=200)=>Response.json(payload,{status,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);
 if(!env.INGEST_SECRET||request.headers.get('authorization')!==`Bearer ${env.INGEST_SECRET}`)return json({ok:false,error:'unauthorized'},401);
 const keyId=env.KALSHI_API_KEY_ID;
 const privateKey=env.KALSHI_PRIVATE_KEY;
 if(!keyId||!privateKey)return json({ok:false,mode:'not_configured',keyIdPresent:Boolean(keyId),privateKeyPresent:Boolean(privateKey)},503);
 const url=new URL('https://external-api.kalshi.com/trade-api/v2/markets?status=open&limit=1');
 let headers:Record<string,string>;
 try{headers=kalshiReadOnlyHeaders(url,keyId,privateKey);}
 catch{return json({ok:false,mode:'signing_failed'},503);}
 try{
  const response=await fetch(url.toString(),{method:'GET',headers:{Accept:'application/json',...headers},signal:AbortSignal.timeout(7000)});
  if(!response.ok)return json({ok:false,mode:'upstream_rejected',upstreamStatus:response.status},502);
  const payload=await response.json() as {markets?:unknown[]};
  return json({ok:true,mode:'authenticated_readonly',upstreamStatus:response.status,marketCount:Array.isArray(payload.markets)?payload.markets.length:0});
 }catch{return json({ok:false,mode:'upstream_unreachable'},502);}
}
