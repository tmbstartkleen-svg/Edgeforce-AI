import{t as e}from"./db-9LtqYd6N.js";async function t(){let t=e();if(!t)return Response.json({source:`none`,releases:[]});let n=await t`
  select id,version,commit_sha as "commitSha",preview_url as "previewUrl",
   production_url as "productionUrl",migration_version as "migrationVersion",
   smoke_passed as "smokePassed",promoted,rollback_target as "rollbackTarget",
   created_at as "createdAt",promoted_at as "promotedAt"
  from release_candidates
  order by created_at desc
  limit 50
 `;return Response.json({source:`database`,releases:n})}export{t as GET};