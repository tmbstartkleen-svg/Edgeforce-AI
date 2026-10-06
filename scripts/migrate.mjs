import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const url=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRES_PRISMA_URL||process.env.NEON_DATABASE_URL;
if(!url){
 console.error('DATABASE_URL is required');
 process.exit(1);
}

const sql=postgres(url,{max:1,prepare:false});

const baseSchema=await fs.readFile(path.resolve(process.cwd(),'db','schema.sql'),'utf8');
console.log('apply base schema');
await sql.unsafe(baseSchema);

const legacyPredictionSnapshots=await sql`
 select to_regclass('public.prediction_market_snapshots') as table_name
`;
if(legacyPredictionSnapshots[0]?.table_name){
 console.log('reconcile legacy prediction_market_snapshots schema');
 const legacyProviderColumn=await sql`
  select is_nullable
  from information_schema.columns
  where table_schema='public'
    and table_name='prediction_market_snapshots'
    and column_name='provider'
  limit 1
 `;
 await sql.begin(async tx=>{
  await tx.unsafe(`
   alter table prediction_market_snapshots
    add column if not exists venue text,
    add column if not exists contract_id text,
    add column if not exists title text,
    add column if not exists category text default 'OTHER',
    add column if not exists yes_probability numeric,
    add column if not exists bid_probability numeric,
    add column if not exists ask_probability numeric,
    add column if not exists volume numeric,
    add column if not exists liquidity numeric,
    add column if not exists observed_hour timestamptz,
    add column if not exists raw jsonb default '{}'::jsonb
  `);
  await tx.unsafe(`
   update prediction_market_snapshots
   set venue=coalesce(nullif(venue,''),'legacy'),
       contract_id=coalesce(nullif(contract_id,''),'legacy-' || md5(ctid::text)),
       title=coalesce(nullif(title,''),'Legacy prediction market'),
       category=coalesce(nullif(category,''),'OTHER'),
       yes_probability=coalesce(yes_probability,0.5),
       observed_hour=coalesce(observed_hour,now()),
       raw=coalesce(raw,'{}'::jsonb)
  `);
  await tx.unsafe(`
   delete from prediction_market_snapshots a
   using prediction_market_snapshots b
   where a.ctid < b.ctid
     and a.venue=b.venue
     and a.contract_id=b.contract_id
     and a.observed_hour=b.observed_hour
  `);
  await tx.unsafe(`
   alter table prediction_market_snapshots
    alter column venue set not null,
    alter column contract_id set not null,
    alter column title set not null,
    alter column category set default 'OTHER',
    alter column category set not null,
    alter column yes_probability set not null,
    alter column observed_hour set not null,
    alter column raw set default '{}'::jsonb,
    alter column raw set not null
  `);
  if(legacyProviderColumn.length){
   await tx.unsafe(`
    update prediction_market_snapshots
    set provider=coalesce(nullif(provider,''),venue,'legacy')
    where provider is null or provider=''
   `);
   await tx.unsafe(`
    alter table prediction_market_snapshots
     alter column provider drop not null
   `);
  }
  await tx.unsafe(`
   create unique index if not exists prediction_market_snapshots_venue_contract_hour_key
    on prediction_market_snapshots(venue,contract_id,observed_hour)
  `);
 });
}


const legacyAthletes=await sql`
 select to_regclass('public.athletes') as table_name
`;
if(legacyAthletes[0]?.table_name){
 console.log('reconcile legacy athletes schema');
 await sql.begin(async tx=>{
  await tx.unsafe(`
   alter table athletes
    add column if not exists source_id text,
    add column if not exists name text,
    add column if not exists normalized_name text,
    add column if not exists team text,
    add column if not exists first_seen_at timestamptz default now(),
    add column if not exists last_seen_at timestamptz default now()
  `);
  await tx.unsafe(`
   update athletes
   set name=coalesce(nullif(name,''),nullif(full_name,''),id),
       normalized_name=coalesce(
        nullif(normalized_name,''),
        lower(regexp_replace(trim(coalesce(nullif(full_name,''),id)),'\\s+',' ','g'))
       ),
       team=coalesce(nullif(team,''),nullif(team_id,'')),
       metadata=coalesce(metadata,'{}'::jsonb),
       first_seen_at=coalesce(first_seen_at,created_at,now()),
       last_seen_at=coalesce(last_seen_at,updated_at,created_at,now())
  `);
  await tx.unsafe(`
   with ranked as (
    select id,sport,normalized_name,
           row_number() over(partition by sport,normalized_name order by id) as rn
    from athletes
   )
   update athletes a
   set normalized_name=a.normalized_name || ' #' || substr(md5(a.id),1,8)
   from ranked r
   where a.id=r.id and r.rn>1
  `);
  await tx.unsafe(`
   alter table athletes
    alter column name set not null,
    alter column normalized_name set not null,
    alter column metadata set default '{}'::jsonb,
    alter column metadata set not null,
    alter column first_seen_at set default now(),
    alter column first_seen_at set not null,
    alter column last_seen_at set default now(),
    alter column last_seen_at set not null
  `);
  await tx.unsafe(`
   create unique index if not exists athletes_sport_normalized_name_key
    on athletes(sport,normalized_name)
  `);
 });
}

const legacyPlayerStats=await sql`
 select to_regclass('public.player_game_stats') as table_name
`;
if(legacyPlayerStats[0]?.table_name){
 console.log('reconcile legacy player_game_stats schema');
 await sql.begin(async tx=>{
  await tx.unsafe(`
   alter table player_game_stats
    add column if not exists opponent text,
    add column if not exists home_away text,
    add column if not exists team text,
    add column if not exists minutes numeric,
    add column if not exists usage_rate numeric,
    add column if not exists raw jsonb default '{}'::jsonb,
    add column if not exists ingested_at timestamptz default now()
  `);
  await tx.unsafe(`
   update player_game_stats
   set source=coalesce(nullif(source,''),'legacy'),
       raw=coalesce(raw,'{}'::jsonb),
       ingested_at=coalesce(ingested_at,imported_at,now())
  `);
  await tx.unsafe(`
   alter table player_game_stats
    alter column stat_date type timestamptz using stat_date::timestamptz,
    alter column source set not null,
    alter column raw set default '{}'::jsonb,
    alter column raw set not null,
    alter column ingested_at set default now(),
    alter column ingested_at set not null
  `);
  await tx.unsafe(`
   alter table player_game_stats
    drop constraint if exists player_game_stats_athlete_id_event_id_key
  `);
  await tx.unsafe(`
   create unique index if not exists player_game_stats_athlete_event_source_key
    on player_game_stats(athlete_id,event_id,source)
  `);
 });
}

await sql`
 create table if not exists schema_migrations(
  version text primary key,
  applied_at timestamptz not null default now()
 )
`;

const dir=path.resolve(process.cwd(),'db');
const files=(await fs.readdir(dir))
 .filter(name=>/^v\d+\.sql$/.test(name))
 .sort((a,b)=>Number(a.match(/\d+/)?.[0]||0)-Number(b.match(/\d+/)?.[0]||0));

for(const file of files){
 const version=file.replace('.sql','');
 const exists=await sql`select version from schema_migrations where version=${version}`;
 if(exists.length){
  console.log('skip',version);
  continue;
 }
 const body=await fs.readFile(path.join(dir,file),'utf8');
 console.log('apply',version);
 await sql.begin(async tx=>{
  await tx.unsafe(body);
  await tx`insert into schema_migrations(version) values(${version})`;
 });
}
await sql.end();
console.log('migrations complete');
