-- Edgeforce V116: close legacy prediction snapshot compatibility.
-- Some older production databases retained a required provider column on
-- prediction_market_snapshots even though the canonical V40 contract keys by venue.

do $$
begin
 if exists (
  select 1
  from information_schema.columns
  where table_schema='public'
    and table_name='prediction_market_snapshots'
    and column_name='provider'
 ) then
  execute $sql$
   update prediction_market_snapshots
   set provider=coalesce(nullif(provider,''),nullif(venue,''),'edgeforce-prediction')
   where provider is null or provider=''
  $sql$;

  execute $sql$
   alter table prediction_market_snapshots
    alter column provider set default 'edgeforce-prediction'
  $sql$;
 end if;
end
$$;
