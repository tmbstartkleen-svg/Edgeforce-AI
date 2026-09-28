export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET && auth!==`Bearer ${process.env.CRON_SECRET}`) return Response.json({ok:false},{status:401});
 return Response.json({ok:true,ranAt:new Date().toISOString(),modelVersion:process.env.MODEL_VERSION||'edgeforce-v6',action:'recalibration hook ready'});
}
