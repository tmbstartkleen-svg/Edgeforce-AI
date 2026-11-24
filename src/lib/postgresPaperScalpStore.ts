import type {ScalpSnapshotStore} from './paperScalpPersistence';

/**
 * PostgreSQL-compatible durable paper-state adapter.
 * Caller supplies a transaction-capable SQL client. No connections are opened
 * here, no live orders, and no schema mutations at runtime.
 *
 * Required migration:
 * CREATE TABLE IF NOT EXISTS edgeforce_paper_scalp_snapshots (
 *   market_id TEXT PRIMARY KEY,
 *   revision BIGINT NOT NULL CHECK (revision >= 0),
 *   payload TEXT NOT NULL,
 *   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 */
export type SqlResult<T>={rows:T[];rowCount:number|null};
export type PaperScalpSqlClient={
 query:<T extends Record<string,unknown>>(sql:string,params:unknown[])=>Promise<SqlResult<T>>;
};
export function createPostgresPaperScalpStore(client:PaperScalpSqlClient):ScalpSnapshotStore{
 return {
  async read(marketId){
   if(!marketId)throw Error('missing_market_id');
   const result=await client.query<{revision:string|number;payload:string}>(
    'SELECT revision, payload FROM edgeforce_paper_scalp_snapshots WHERE market_id = $1',[marketId]);
   if(result.rows.length!==1)return null;
   const revision=Number(result.rows[0].revision);
   if(!Number.isSafeInteger(revision)||revision<0)throw Error('invalid_database_revision');
   return {revision,payload:result.rows[0].payload};
  },
  async compareAndSwap(marketId,expectedRevision,nextRevision,payload){
   if(!marketId||!Number.isSafeInteger(nextRevision)||nextRevision<0||
    (expectedRevision!==null&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<0))||
    (expectedRevision===null?nextRevision!==0:nextRevision!==expectedRevision+1)||
    typeof payload!=='string'||!payload)throw Error('invalid_persistence_request');
   if(expectedRevision===null){
    const result=await client.query(
     'INSERT INTO edgeforce_paper_scalp_snapshots (market_id, revision, payload) VALUES ($1, $2, $3) ON CONFLICT (market_id) DO NOTHING',
     [marketId,nextRevision,payload]);
    return result.rowCount===1;
   }
   const result=await client.query(
    'UPDATE edgeforce_paper_scalp_snapshots SET revision = $3, payload = $4, updated_at = NOW() WHERE market_id = $1 AND revision = $2',
    [marketId,expectedRevision,nextRevision,payload]);
   return result.rowCount===1;
  }
 };
}
