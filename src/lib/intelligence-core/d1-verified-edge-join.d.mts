export type D1ModelEdgeCandidate={
 eventId:string;marketKey:string;selection:string;targetBook:string;odds:number;
 modelProbability:number;breakEvenProbability:number;edgePercentagePoints:number;expectedRoi:number;
 status:'CANDIDATE_FOR_FURTHER_REVIEW';modelRunId:number|null;modelVersion:string;modelCreatedAt:string;
 storedRunCount:number;validationEvidenceGrade:'QUALIFIED'|'VERIFIED';validationEvidenceId:string;
 calibration:{id:unknown;sampleSize:number;brierScore:number;logLoss:number;calibrationError:number;periodEnd:string;createdAt:string};
 evidenceJoin:'D1_STORED_QUOTE_MODEL_CALIBRATION';approvalScope:'REVIEW_ONLY';
 upstreamIdentityIndependentlyAuthenticated:false;productionBetRecommendationAuthorized:false;
 sourceObservedAt:number;
};
export type D1ModelEdgeReview={
 mode:'D1_MODEL_EDGE_EVIDENCE_JOIN_REVIEW_ONLY';
 modelsExamined:number;eligibleModels:number;calibrationMatched:number;exactQuoteMatches:number;
 candidateCount:number;candidates:D1ModelEdgeCandidate[];rejectionReasons:Record<string,number>;
 probabilitiesInvented:0;pricesInvented:0;networkRequests:0;ordersPlaced:0;
 upstreamIdentityIndependentlyAuthenticated:false;productionBetRecommendationAuthorized:false;
};
export function reviewD1ModelEdges(
 quotes:unknown[],
 modelRuns:unknown[],
 calibrations:unknown[],
 options?:{now?:number;targetBook?:string;maxModelAgeMs?:number}
):D1ModelEdgeReview;
