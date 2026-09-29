import {fetchWithFailover} from './failover';

export async function fetchWeatherContext(){return fetchWithFailover('WEATHER');}
export async function fetchInjuryContext(){return fetchWithFailover('INJURIES');}
export async function fetchStatsContext(){return fetchWithFailover('STATS');}
export async function fetchResultsContext(){return fetchWithFailover('RESULTS');}
export async function fetchPredictionMarketContext(){return fetchWithFailover('PREDICTION_MARKETS');}
