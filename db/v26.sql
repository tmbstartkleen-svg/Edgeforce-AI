-- Edgeforce V26: objective weekly-leg confidence status

alter table weekly_parlay_legs add column if not exists decision_status text default 'KEEP';
alter table weekly_parlay_legs add column if not exists decision_score int default 50;
alter table weekly_parlay_legs add column if not exists decision_reasons jsonb default '[]'::jsonb;
alter table weekly_parlay_legs add column if not exists decision_updated_at timestamptz;

create index if not exists weekly_parlay_decision_idx
  on weekly_parlay_legs(week_start,decision_status,decision_score desc);

update weekly_parlay_legs
set decision_status=coalesce(decision_status,'KEEP'),
    decision_score=coalesce(decision_score,50),
    decision_reasons=coalesce(decision_reasons,'[]'::jsonb),
    decision_updated_at=coalesce(decision_updated_at,updated_at,now())
where decision_updated_at is null;
