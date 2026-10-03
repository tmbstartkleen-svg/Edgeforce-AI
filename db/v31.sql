-- Edgeforce V32: line movement, steam detection and persistent CLV

alter table bet_legs add column if not exists closing_implied_probability numeric;
alter table bet_legs add column if not exists clv_probability numeric;

create index if not exists market_snapshots_line_history_idx
  on market_snapshots(event_id,market_key,selection_key,pulled_at desc);

create index if not exists bet_legs_clv_idx
  on bet_legs(clv_probability) where clv_probability is not null;
