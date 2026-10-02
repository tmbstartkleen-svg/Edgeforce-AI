import {db} from './db';
import type {FeedIntegrity} from './feedIntegrity';

export async function recordFeedIntegrity(integrity:FeedIntegrity){
  const sql=db();
  if(!sql)return {configured:false,written:false};
  await sql`
    insert into feed_integrity_snapshots(
      status,official_eligible,source,mode,total_markets,accepted_markets,rejected_markets,
      rejected_stale,rejected_invalid,rejected_conflicts,max_source_age_min,conflict_rate,
      validation_compared,validation_conflicts,reconciliation_coverage,reasons
    ) values(
      ${integrity.status},${integrity.officialEligible},${integrity.source},${integrity.mode},${integrity.totalMarkets},${integrity.acceptedMarkets},${integrity.rejectedMarkets},
      ${integrity.rejectedStale},${integrity.rejectedInvalid},${integrity.rejectedConflicts},${integrity.maxSourceAgeMin},${integrity.conflictRate},
      ${integrity.validationCompared},${integrity.validationConflicts},${integrity.reconciliationCoverage},${sql.json(integrity.reasons as any)}
    )
  `;
  return {configured:true,written:true};
}

export async function latestFeedIntegrity(limit=24){
  const sql=db();
  if(!sql)return [];
  return sql`
    select status,official_eligible as "officialEligible",source,mode,total_markets as "totalMarkets",
      accepted_markets as "acceptedMarkets",rejected_markets as "rejectedMarkets",rejected_stale as "rejectedStale",
      rejected_invalid as "rejectedInvalid",rejected_conflicts as "rejectedConflicts",max_source_age_min::float as "maxSourceAgeMin",
      conflict_rate::float as "conflictRate",validation_compared as "validationCompared",validation_conflicts as "validationConflicts",
      reconciliation_coverage::float as "reconciliationCoverage",reasons,created_at as "createdAt"
    from feed_integrity_snapshots order by created_at desc limit ${limit}
  `;
}
