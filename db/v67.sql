-- Edgeforce V118 cash-out policy governance

create table if not exists cashout_policy_governance_snapshots (
 id bigserial primary key,
 observed_at timestamptz not null default now(),
 sportsbook text not null,
 alert_type text not null,
 samples int not null,
 recent_samples int not null,
 baseline_regret numeric not null,
 learned_regret numeric not null,
 regret_improvement numeric not null,
 baseline_accuracy numeric not null,
 learned_accuracy numeric not null,
 accuracy_lift numeric not null,
 recent_learned_regret numeric not null,
 drift_score numeric not null,
 confidence numeric not null,
 role text not null,
 health text not null,
 promoted boolean not null default false,
 reason text
);

create index if not exists cashout_policy_governance_lookup_idx
 on cashout_policy_governance_snapshots(sportsbook,alert_type,observed_at desc);
