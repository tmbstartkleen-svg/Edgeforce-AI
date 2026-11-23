import {validatePaperLedgerSnapshot,type ScalpLedgerSnapshot} from './paperScalpLedger';
import type {PaperScalpLedgerStorage} from './paperScalpDurableStorage';

/** SQL schema for isolated paper trading state. Apply via reviewed migration.
 * Never share this table with live orders or store exchange credentials.
 */
export const PAPER_SCALP_LEDGER_SQL=`
CREATE TABLE IF NOT EXISTS paper_scalp_ledgers (
 market_id TEXT PRIMARY KEY,
 revision INTEGER NOT NULL CHECK (revision >= 0),
 snapshot_json TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export type PaperScalpSqlStatement={
 bind(...values:(string|number)[]):PaperScalpSqlStatement;
 first<T>():Promise<T|null>;
 run():Promise<{meta?:{changes?:number}}>;
};
export type PaperScalpSqlDatabase={
 prepare(sql:string):PaperScalpSqlStatement;
};
export function createPaperScalpSqlStorage(db:PaperScalpSqlDatabase):PaperScalpLedgerStorage{
 return {
  async read(marketId:string):Promise<unknown>{
   if(!marketId||marketId.length>200)throw Error('invalid_market_id');
   const row=await db.prepare('SELECT snapshot_json FROM paper_scalp_ledgers WHERE market_id = ?')
    .bind(marketId).first<{snapshot_json:string}>();
   if(!row)return null;
   const parsed:unknown=JSON.parse(row.snapshot_json);
   if(!validatePaperLedgerSnapshot(parsed)||(parsed as ScalpLedgerSnapshot).marketId!==marketId)
    throw Error('invalid_stored_snapshot');
   return parsed;
  },
  async compareAndSwap(marketId:string,expectedRevision:number,next:ScalpLedgerSnapshot):Promise<boolean>{
   if(!validatePaperLedgerSnapshot(next)||next.marketId!==marketId||
    !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
    next.revision!==expectedRevision+1)return false;
   const result=await db.prepare(
    'UPDATE paper_scalp_ledgers SET revision = ?, snapshot_json = ?, updated_at = CURRENT_TIMESTAMP WHERE market_id = ? AND revision = ?'
   ).bind(next.revision,JSON.stringify(next),marketId,expectedRevision).run();
   return result.meta?.changes===1;
  }
 };
}
/** Explicit initialization only; no implicit table creation or reset. */
export async function initializePaperScalpSqlSnapshot(
 db:PaperScalpSqlDatabase,snapshot:ScalpLedgerSnapshot
):Promise<boolean>{
 if(!validatePaperLedgerSnapshot(snapshot)||snapshot.revision!==0||
  snapshot.processedEventIds.length!==0||snapshot.book.orders.length!==0||
  snapshot.book.fills.length!==0||snapshot.book.owned!==0)return false;
 const result=await db.prepare(
  'INSERT OR IGNORE INTO paper_scalp_ledgers (market_id, revision, snapshot_json) VALUES (?, ?, ?)'
 ).bind(snapshot.marketId,0,JSON.stringify(snapshot)).run();
 return result.meta?.changes===1;
}
