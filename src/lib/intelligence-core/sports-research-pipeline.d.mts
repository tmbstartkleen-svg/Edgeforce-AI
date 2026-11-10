export function buildSportsResearchPipeline(
 input?:{quotes?:Record<string,any>[];forecasts?:Record<string,any>[];playerResearch?:Record<string,any>[]},
 options?:{now?:number;maxAgeMs?:number;targetBook?:string}
):Record<string,any>;
