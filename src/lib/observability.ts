export type LogLevel='debug'|'info'|'warn'|'error';

export function logEvent(level:LogLevel,event:string,details:Record<string,unknown>={}){
 const payload={
  ts:new Date().toISOString(),
  level,
  event,
  service:'edgeforce-ai',
  version:process.env.MODEL_VERSION||'edgeforce-v16',
  deployment:process.env.VERCEL_URL||null,
  ...details
 };
 const line=JSON.stringify(payload);
 if(level==='error')console.error(line);
 else if(level==='warn')console.warn(line);
 else console.log(line);
 return payload;
}

export async function timed<T>(event:string,fn:()=>Promise<T>,details:Record<string,unknown>={}):Promise<T>{
 const started=Date.now();
 try{
  const value=await fn();
  logEvent('info',event,{...details,ok:true,durationMs:Date.now()-started});
  return value;
 }catch(error){
  logEvent('error',event,{...details,ok:false,durationMs:Date.now()-started,error:error instanceof Error?error.message:String(error)});
  throw error;
 }
}
