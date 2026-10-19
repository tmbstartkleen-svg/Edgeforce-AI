export type TennisPreviewItem={id:string;provider_event_id:string;sport:'tennis';league:string;start_time:string;source:string;observed_at:string;status:string};
export type TennisPreviewBatch={type:'events';items:TennisPreviewItem[];previewOnly:true;sourceApprovedForMarketRanking:false;sportsbookOddsAvailable:false;draftKingsInventoryCertified:false};
export declare function previewTennisD1Batches(records:Array<{id:string;tournament:string;startTime:string}>,context?:{source?:string;observedAt?:string}):{
 previewOnly:boolean;sourceApprovedForMarketRanking:boolean;sportsbookOddsAvailable:boolean;
 draftKingsInventoryCertified:boolean;batches:TennisPreviewBatch[];totalObserved?:number;
 rejected?:number;complete:boolean;ingestionEnabled?:boolean;reason?:string
};
