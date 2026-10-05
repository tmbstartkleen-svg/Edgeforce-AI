import {deriveRedistributionProfiles} from '@/lib/lineupRoleRedistribution';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const rows=[
  ...Array.from({length:8},(_,i)=>({athleteId:'target',sport:'NBA',team:'Team A',eventId:'with-'+i,minutes:30,usage:.20,stats:{points:20+i%2}})),
  ...Array.from({length:4},(_,i)=>({athleteId:'target',sport:'NBA',team:'Team A',eventId:'without-'+i,minutes:36,usage:.27,stats:{points:28+i%2}})),
  ...Array.from({length:8},(_,i)=>({athleteId:'star',sport:'NBA',team:'Team A',eventId:'with-'+i,minutes:35,usage:.30,stats:{points:26+i%3}})),
  ...Array.from({length:12},(_,i)=>({athleteId:'bench',sport:'NBA',team:'Team A',eventId:i<8?'with-'+i:'without-'+(i-8),minutes:15,usage:.11,stats:{points:7+i%2}}))
 ];
 const profiles=deriveRedistributionProfiles(rows);
 const p=profiles.find((x:any)=>x.athleteId==='target'&&x.absentAthleteId==='star'&&x.statKey==='points') as any;
 const ok=Boolean(p&&p.withGames===8&&p.withoutGames===4&&p.statLift>0&&p.minutesLift>0&&p.usageLift>0&&p.confidence>0);
 return Response.json({ok,build:'V65',schemaVersion:'v65-lineup-redistribution-1',profile:p,count:profiles.length},{headers:{'Cache-Control':'no-store'}});
}
