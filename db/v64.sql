-- Edgeforce V115 cash-out offer capture and decision learning

create table if not exists cashout_observations (
 id bigserial primary key,
 command_id text,
 ladder_id text,
 checkpoint_label text,
 stake numeric not null,
 original_odds int not null,
 current_win_probability numeric not null,
 cashout_offer numeric not null,
 model_hold_value numeric not null,
 model_cashout_edge numeric not null,
 model_decision text not null,
 user_action text not null,
 outcome text not null default 'PENDING',
 final_payout numeric,
 sportsbook text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index if not exists cashout_observations_command_idx
 on cashout_observations(command_id,created_at desc);

create index if not exists cashout_observations_outcome_idx
 on cashout_observations(outcome,created_at desc);

create table if not exists cashout_learning_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 alert_type text not null,
 samples int not null,
 graded_samples int not null,
 positive_samples int not null,
 positive_rate numeric not null,
 average_decision_utility numeric not null,
 average_offer_edge numeric not null,
 confidence numeric not null,
 multiplier numeric not null,
 state text not null,
 metadata jsonb not null default '{}'::jsonb
);

create index if not exists cashout_learning_snapshots_lookup_idx
 on cashout_learning_snapshots(alert_type,observed_at desc);
