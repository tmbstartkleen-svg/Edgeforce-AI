import {buildMarketEntryForecastLedger,type ForecastLedgerRow} from './marketEntryForecastLedger';
import {evaluateEntryReplay,type EntryReplayCalibration} from './marketEntryReplayCalibration';

/** Offline-only audit report; data is supplied by an external verified importer. */
export type MarketEntryAuditReport={
 status:'insufficient_evidence'|'invalid'|'ready';
 included:number;
 excluded:number;
 excludedReasons:Record<string,number>;
 calibration:EntryReplayCalibration;
 warning:string;
};
export function auditMarketEntryForecasts(rows:ForecastLedgerRow[],minimumSample=100):MarketEntryAuditReport{
 const invalid=!Array.isArray(rows);
 const ledger=buildMarketEntryForecastLedger(invalid?[]:rows);
 const calibration=evaluateEntryReplay(ledger.observations,minimumSample);
 const excludedReasons:Record<string,number>={};
 for(const item of ledger.excluded)excludedReasons[item.reason]=(excludedReasons[item.reason]??0)+1;
 return {status:invalid?'invalid':calibration.status,included:ledger.observations.length,
  excluded:ledger.excluded.length,excludedReasons,calibration,
  warning:'Research audit only. Complete trade prints establish price touches, not order fills; no model is certified for trading by this report.'};
}
