/** Public, privacy-minimized pilot dashboard: metadata counts only, no raw market content. */
import type {D1Database} from './d1-observations';
type Env={INTELLIGENCE_DB?:unknown};
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function d1WorkspaceSummary(request:Request,env:Env):Promise<Response>{
 if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
 const db=env.INTELLIGENCE_DB as D1Database|undefined;
 if(!db||typeof db.prepare!=='function')
  return Response.json({ok:false,reason:'D1_BINDING_MISSING'},{status:503,headers:noStore});
 try{
  // Counts only. Cert-only rows never count as genuine market coverage.
  const rows=await db.prepare(`SELECT observation_kind AS kind, COUNT(*) AS count
   FROM intelligence_observations WHERE source_id != 'edgeforce-d1-certification'
   GROUP BY observation_kind ORDER BY observation_kind LIMIT 8`).all<{kind:string;count:number}>();
  const counts=Object.fromEntries(rows.results.map(x=>[x.kind,Number(x.count)]));
  return Response.json({ok:true,source:'D1_PILOT',coverage:'UNVERIFIED',
   actualLiveCoverageCertified:false,
   sports:{scores:counts.score??0,odds:counts.odds??0,injuries:counts.injury??0,
     playerStats:counts['player-stat']??0,lineups:counts.lineup??0},
   predictionMarkets:{nonSportsContractCount:null,unclassifiedContractObservations:counts['prediction-market']??0,
    note:'Non-sports classification cannot be inferred from current D1 observation schema.'},
   historicalNeonData:'NOT_MIGRATED',
   dataWarning:'Counts are stored observations, not live-event coverage or simulation confidence.'},
   {status:200,headers:noStore});
 }catch{return Response.json({ok:false,reason:'D1_READ_FAILED'},{status:503,headers:noStore});}
}
