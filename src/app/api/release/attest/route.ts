import {db} from '@/lib/db';
import {evaluateReadiness} from '@/lib/readiness';
import {RELEASE} from '@/lib/releaseManifest';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const auth=req.headers.get('authorization');
 const secrets=[process.env.INGEST_SECRET,process.env.CRON_SECRET].filter(Boolean);
 return !secrets.length||secrets.some(secret=>auth===`Bearer ${secret}`);
}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'unauthorized'},{status:401});
 const body=await req.json().catch(()=>({}));
 const readiness=await evaluateReadiness();
 const sql=db();
 if(!sql)return Response.json({ok:true,mode:'dry-run',version:RELEASE.appVersion,readiness});
 const [row]=await sql`
  insert into release_attestations(
   version,commit_sha,environment,migration_version,build_passed,smoke_passed,load_passed,readiness_passed,metadata
  ) values(
   ${RELEASE.appVersion},${process.env.VERCEL_GIT_COMMIT_SHA||body.commitSha||null},
   ${process.env.VERCEL_ENV||body.environment||'unknown'},${RELEASE.migrationVersion},
   ${body.buildPassed===true},${body.smokePassed===true},${body.loadPassed===true},
   ${readiness.ready},${sql.json({source:body.source||'release-workflow',deploymentUrl:process.env.VERCEL_URL||body.deploymentUrl||null,productionReady:readiness.productionReady})}
  )
  returning id,created_at as "createdAt"
 `;
 return Response.json({ok:true,mode:'database',id:Number(row.id),createdAt:row.createdAt,version:RELEASE.appVersion,readiness});
}
