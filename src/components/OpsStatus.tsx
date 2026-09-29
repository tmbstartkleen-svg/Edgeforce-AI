'use client';
import {useEffect,useState} from 'react';

type Ops={
 ok:boolean;
 version:string;
 deployment:{vercel:boolean;environment:string;url:string|null;commit:string|null;projectId:string|null};
 uptimeSeconds:number;
 database:{configured:boolean;ok:boolean;error?:string};
 providers:Record<string,number>;
 time:string;
};

export default function OpsStatus(){
 const [ops,setOps]=useState<Ops|null>(null);
 const [error,setError]=useState('');

 useEffect(()=>{
  let live=true;
  const load=async()=>{
   try{
    const res=await fetch('/api/ops/status',{cache:'no-store'});
    if(!res.ok)throw new Error('ops status unavailable');
    const json=await res.json();
    if(live){setOps(json);setError('');}
   }catch(e){if(live)setError(e instanceof Error?e.message:'ops unavailable')}
  };
  load();
  const id=setInterval(load,30000);
  return()=>{live=false;clearInterval(id)};
 },[]);

 const providerTotal=ops?Object.values(ops.providers||{}).reduce((a,b)=>a+b,0):0;
 return <section className="opsStrip">
  <div><small>DEPLOYMENT</small><strong>{ops?.deployment.vercel?'VERCEL '+String(ops.deployment.environment).toUpperCase():'LOCAL / UNLINKED'}</strong></div>
  <div><small>DATABASE</small><strong className={ops?.database.ok?'lime':'orange'}>{ops?.database.ok?'HEALTHY':ops?.database.configured?'ERROR':'NOT CONFIGURED'}</strong></div>
  <div><small>PROVIDERS</small><strong>{providerTotal}</strong></div>
  <div><small>UPTIME</small><strong>{ops?Math.floor(ops.uptimeSeconds/60)+'m':'—'}</strong></div>
  <div><small>VERSION</small><strong>{ops?.version||'—'}</strong></div>
  <div><small>STATUS</small><strong className={error?'orange':'lime'}>{error||'MONITORING'}</strong></div>
 </section>
}
