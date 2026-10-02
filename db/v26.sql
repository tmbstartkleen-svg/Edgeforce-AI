-- Edgeforce V27 application build: automated wager settlement and performance ledger

alter table bet_slips add column if not exists sportsbook text default 'DraftKings';
alter table bet_slips add column if not exists combined_odds int;
alter table bet_slips add column if not exists potential_return numeric;
alter table bet_slips add column if not exists model_probability numeric;
alter table bet_slips add column if not exists net_pnl numeric;
alter table bet_slips add column if not exists settled_at timestamptz;
alter table bet_slips add column if not exists settlement_source text;
alter table bet_slips add column if not exists updated_at timestamptz default now();

alter table bet_legs add column if not exists event_label text;
alter table bet_legs add column if not exists model_probability numeric;
alter table bet_legs add column if not exists raw_implied_probability numeric;
alter table bet_legs add column if not exists no_vig_probability numeric;
alter table bet_legs add column if not exists prediction_market_probability numeric;
alter table bet_legs add column if not exists closing_odds int;
alter table bet_legs add column if not exists settled_at timestamptz;

create table if not exists ledger_events (
  id bigserial primary key,
  bet_slip_id text,
  event_type text not null,
  source text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists ledger_events_slip_idx on ledger_events(bet_slip_id,created_at desc);
create index if not exists bet_slips_settlement_idx on bet_slips(result,settled_at desc);
create index if not exists bet_legs_event_settlement_idx on bet_legs(event_id,market_type,selection,result);

insert into bet_slips(
  id,placed_at,source,confidence,sport,leg_count,stake,returned,result,
  notes,sportsbook,net_pnl,settled_at,settlement_source
) values(
  'baseline-2026-09-29',
  '2026-09-29T12:00:00-04:00',
  'baseline',
  'confirmed',
  'All',
  0,
  25,
  32,
  'win',
  'Correct starting performance baseline supplied by user: $25 staked, $32 returned, +$7 net, +28% ROI.',
  'DraftKings',
  7,
  '2026-09-29T23:59:59-04:00',
  'user-confirmed'
)
on conflict (id) do nothing;
