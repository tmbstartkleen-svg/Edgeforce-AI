-- Edgeforce V28: provider hardening, circuit breaker, and payload-quality controls

alter table provider_health add column if not exists consecutive_failures int not null default 0;
alter table provider_health add column if not exists consecutive_successes int not null default 0;
alter table provider_health add column if not exists circuit_state text not null default 'CLOSED';
alter table provider_health add column if not exists quarantined_until timestamptz;
alter table provider_health add column if not exists freshness_score numeric;
alter table provider_health add column if not exists quality_score numeric;
alter table provider_health add column if not exists last_payload_at timestamptz;
alter table provider_health add column if not exists last_failure_reason text;

alter table provider_payload_audit add column if not exists row_count int;
alter table provider_payload_audit add column if not exists payload_age_seconds numeric;
alter table provider_payload_audit add column if not exists quality_score numeric;
alter table provider_payload_audit add column if not exists quality_grade text;
alter table provider_payload_audit add column if not exists rejected boolean not null default false;

create index if not exists provider_health_circuit_idx
 on provider_health(enabled,circuit_state,quarantined_until,priority desc);

create index if not exists provider_payload_audit_quality_idx
 on provider_payload_audit(provider_id,rejected,received_at desc);
