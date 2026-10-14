export function isSoccerBoardRow(row:{sport?:string}):boolean;
export function enforceSoccerEvidence<T extends {sport?:string}>(rows:T[]):{eligible:T[];withheldSoccerCount:number;reason:string;gateEnforced:boolean;note:string};
