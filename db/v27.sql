-- Edgeforce V27: weekly replacement target view and lookup optimization

create or replace view weekly_replacement_targets as
select
  week_start,market_id,sport,event,selection,market,start_time,
  coalesce(original_odds,odds) as original_odds,
  coalesce(original_sim_probability,sim_probability) as original_sim_probability,
  coalesce(current_odds,odds) as current_odds,
  coalesce(current_sim_probability,sim_probability) as current_sim_probability,
  locked,
  coalesce(decision_status,'KEEP') as decision_status,
  coalesce(decision_score,50) as decision_score,
  coalesce(decision_reasons,'[]'::jsonb) as decision_reasons,
  coalesce(change_summary,'[]'::jsonb) as change_summary,
  decision_updated_at
from weekly_parlay_legs
where result='pending'
  and coalesce(decision_status,'KEEP') in ('WATCH','REPLACE_CANDIDATE');

create index if not exists weekly_parlay_replacement_lookup_idx
  on weekly_parlay_legs(week_start,result,decision_status,current_sim_probability desc);
