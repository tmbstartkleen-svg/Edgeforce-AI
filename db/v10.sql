create table if not exists bankroll_accounts (
 id bigserial primary key,
 name text not null default 'Main',
 starting_bankroll numeric not null,
 current_bankroll numeric not null,
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);

create table if not exists portfolio_snapshots (
 id bigserial primary key,
 bankroll_account_id bigint references bankroll_accounts(id),
 generated_at timestamptz default now(),
 model_version text not null,
 daily_risk_pct numeric,
 weekly_risk_pct numeric,
 total_stake numeric,
 expected_profit numeric,
 expected_roi numeric,
 drawdown_pct numeric,
 positions jsonb not null,
 rejected jsonb default '[]'::jsonb
);
create index if not exists portfolio_snapshots_recent_idx on portfolio_snapshots(generated_at desc);

create table if not exists open_positions (
 id bigserial primary key,
 bankroll_account_id bigint references bankroll_accounts(id),
 event_id text,
 market_key text,
 selection_key text,
 sport text,
 stake numeric not null,
 odds int not null,
 model_probability numeric,
 expected_value numeric,
 opened_at timestamptz default now(),
 status text not null default 'open',
 settled_at timestamptz,
 pnl numeric
);
create index if not exists open_positions_status_idx on open_positions(status,opened_at desc);

create table if not exists cashout_evaluations (
 id bigserial primary key,
 open_position_id bigint references open_positions(id),
 evaluated_at timestamptz default now(),
 current_probability numeric,
 cashout_offer numeric,
 hold_value numeric,
 cashout_edge numeric,
 decision text
);

create table if not exists risk_budget_history (
 id bigserial primary key,
 bankroll_account_id bigint references bankroll_accounts(id),
 as_of timestamptz default now(),
 daily_budget_pct numeric,
 weekly_budget_pct numeric,
 max_event_pct numeric,
 max_sport_pct numeric,
 max_correlated_pct numeric,
 drawdown_brake_pct numeric
);
