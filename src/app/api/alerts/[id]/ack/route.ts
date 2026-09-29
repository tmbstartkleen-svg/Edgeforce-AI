import {db} from '@/lib/db';

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const alertId=Number(id);
 if(!Number.isFinite(alertId))return Response.json({ok:false,error:'invalid id'},{status:400});
 const sql=db();
 if(!sql)return Response.json({ok:false,error:'database not configured'},{status:503});
 const rows=await sql`
  update alerts set resolved_at=now() where id=${alertId} and resolved_at is null
  returning id,resolved_at as "resolvedAt"
 `;
 return Response.json({ok:true,alert:rows[0]||null});
}
