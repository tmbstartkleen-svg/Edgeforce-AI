import {dbHealth} from './db';
import {configuredProviders} from './providers/config';

export async function releaseReadiness(){
 const database=await dbHealth();
 const providers=configuredProviders();
 const required={
  ingestSecret:Boolean(process.env.INGEST_SECRET),
  cronSecret:Boolean(process.env.CRON_SECRET),
  modelVersion:process.env.MODEL_VERSION==='edgeforce-v17',
  bankroll:Boolean(process.env.DEFAULT_BANKROLL)
 };
 const providerState={
  odds:providers.filter(p=>p.capability==='ODDS').length,
  weather:providers.filter(p=>p.capability==='WEATHER').length,
  injuries:providers.filter(p=>p.capability==='INJURIES').length,
  stats:providers.filter(p=>p.capability==='STATS').length,
  results:providers.filter(p=>p.capability==='RESULTS').length
 };
 const baseReady=Object.values(required).every(Boolean);
 return {
  ready:baseReady,
  version:'17.0.0',
  required,
  database,
  providers:providerState,
  deployment:{
   vercel:Boolean(process.env.VERCEL),
   environment:process.env.VERCEL_ENV||'local',
   url:process.env.VERCEL_URL||null,
   commit:process.env.VERCEL_GIT_COMMIT_SHA||null
  }
 };
}
