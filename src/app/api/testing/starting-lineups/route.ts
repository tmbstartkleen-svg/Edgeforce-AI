import {deriveDepthChartProfiles} from '@/lib/startingLineupIntelligence';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const rows=[
  ...Array.from({length:10},()=>({athleteId:'starter',sport:'NBA',team:'A',position:'G',starter:true,minutes:34,usage:.25})),
  ...Array.from({length:10},(_,i)=>({athleteId:'backup',sport:'NBA',team:'A',position:'G',starter:false,minutes:18+i%2,usage:.14})),
  ...Array.from({length:10},()=>({athleteId:'wing',sport:'NBA',team:'A',position:'F',starter:true,minutes:32,usage:.21}))
 ];
 const profiles=deriveDepthChartProfiles(rows);
 const starter=profiles.find(x=>x.athleteId==='starter');
 const backup=profiles.find(x=>x.athleteId==='backup');
 const ok=Boolean(starter&&backup&&starter.starterRate===1&&backup.starterRate===0&&starter.depthRank===1&&starter.roleScore>backup.roleScore);
 return Response.json({ok,build:'V66',schemaVersion:'v66-starting-lineup-1',starter,backup,count:profiles.length},{headers:{'Cache-Control':'no-store'}});
}
