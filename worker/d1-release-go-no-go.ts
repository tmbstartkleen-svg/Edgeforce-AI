// Explicit evidence-based EdgeForce D1 release gate; never deploys or mutates storage.
export type ReleaseEvidence={
 codeChecksPassed:boolean;isolatedD1Accessible:boolean;sourceIdentityAuthenticated:boolean;
 independentOddsProviderAvailable:boolean;sourceFreshnessVerified:boolean;
 historicalSourceReconciled:boolean;backupRestoreObserved:boolean;
 modelCalibrationVerified:boolean;rollbackDrillPassed:boolean;
};
export function evaluateRelease(e:ReleaseEvidence){
 const checks=[
 ['CODE_CHECKS',e.codeChecksPassed],['D1_ACCESS',e.isolatedD1Accessible],
 ['SOURCE_IDENTITY',e.sourceIdentityAuthenticated],['INDEPENDENT_ODDS',e.independentOddsProviderAvailable],
 ['SOURCE_FRESHNESS',e.sourceFreshnessVerified],['HISTORY_RECONCILED',e.historicalSourceReconciled],
 ['RESTORE_DRILL',e.backupRestoreObserved],['MODEL_CALIBRATION',e.modelCalibrationVerified],
 ['ROLLBACK_DRILL',e.rollbackDrillPassed]
 ] as const;
 const unmet=checks.filter(([,passed])=>passed!==true).map(([name])=>name);
 return {status:unmet.length===0?'EVIDENCE_COMPLETE_REQUIRES_HUMAN_APPROVAL':'NO_GO',
  unmet,automatedProductionCutoverAllowed:false,bettingRecommendationsAuthorized:false};
}
