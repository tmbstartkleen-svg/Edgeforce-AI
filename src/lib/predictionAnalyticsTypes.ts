import type {buildTraderSignals} from './predictionTraderIntelligence';

export type ReturnTypeOfTraderSignal=ReturnType<typeof buildTraderSignals>[number];
