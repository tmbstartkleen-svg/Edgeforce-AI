export type LegResult='win'|'loss'|'push'|'unknown';

export type HistoricalLeg={
  label:string;
  sport:string;
  marketType:string;
  result:LegResult;
  offeredOdds?:number;
  closingOdds?:number;
  eventId?:string;
  event?:string;
  modelProbability?:number;
};

export type HistoricalBet={
  id:string;
  placedAt:string;
  source:'uploaded-screenshot'|'manual'|'api'|'baseline';
  confidence:'confirmed'|'partial';
  sport:string;
  legCount:number;
  stake:number;
  paid:number;
  result:'win'|'loss'|'push'|'open';
  combinedOdds?:number;
  modelProbability?:number;
  settledAt?:string;
  legs:HistoricalLeg[];
  notes?:string;
};

// Parsed only from clearly visible information in the uploaded DraftKings screenshots.
// Losing slips with hidden legs are deliberately marked "unknown" rather than guessed.
export const uploadedBetHistory:HistoricalBet[]=[
  {
    id:'baseline-2026-09-29',
    placedAt:'2026-09-29T12:00:00-04:00',
    source:'baseline',
    confidence:'confirmed',
    sport:'All',
    legCount:0,
    stake:25,
    paid:32,
    result:'win',
    settledAt:'2026-09-29T23:59:59-04:00',
    legs:[],
    notes:'Correct starting baseline supplied by user: $25 staked, $32 returned, +$7 net profit, +28% ROI.'
  },
  {
    id:'2026-09-30-tennis-djokovic-gea',
    placedAt:'2026-09-30T03:24:41-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'Tennis',
    legCount:2,
    stake:71.98,
    paid:122,
    result:'win',
    legs:[
      {label:'Novak Djokovic to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Arthur Gea to win',sport:'Tennis',marketType:'Moneyline',result:'win'}
    ]
  },
  {
    id:'2026-09-30-tennis-four-a',
    placedAt:'2026-09-30T04:36:22-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'Tennis',
    legCount:4,
    stake:4.80,
    paid:12,
    result:'win',
    legs:[
      {label:'Novak Djokovic to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Arthur Gea to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Carlos Alcaraz to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Frances Tiafoe to win',sport:'Tennis',marketType:'Moneyline',result:'win'}
    ]
  },
  {
    id:'2026-09-30-tennis-dart-rakhimova',
    placedAt:'2026-09-30T05:07:12-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'Tennis',
    legCount:2,
    stake:7.59,
    paid:11,
    result:'win',
    legs:[
      {label:'Harriet Dart to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Kamilla Rakhimova to win',sport:'Tennis',marketType:'Moneyline',result:'win'}
    ]
  },
  {
    id:'2026-09-30-mlb-alt-runline',
    placedAt:'2026-09-30T05:00:40-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'MLB',
    legCount:2,
    stake:6.96,
    paid:12,
    result:'win',
    legs:[
      {label:'NY Yankees +2.5',sport:'MLB',marketType:'Run Line',result:'win'},
      {label:'SD Padres +1.5',sport:'MLB',marketType:'Run Line',result:'win'}
    ]
  },
  {
    id:'2026-09-30-tennis-zheng-demin',
    placedAt:'2026-09-30T11:03:04-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'Tennis',
    legCount:2,
    stake:280.09,
    paid:374,
    result:'win',
    legs:[
      {label:'Qinwen Zheng to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Alex De Minaur to win',sport:'Tennis',marketType:'Moneyline',result:'win'}
    ]
  },
  {
    id:'2026-09-30-prediction-bitcoin',
    placedAt:'2026-09-30T10:51:40-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'Prediction Market',
    legCount:1,
    stake:6.41,
    paid:9,
    result:'win',
    legs:[
      {label:'Bitcoin above $83,670.07 at 10:55 AM ET',sport:'Prediction Market',marketType:'Binary',result:'win'}
    ]
  },
  {
    id:'2026-09-30-tennis-dart-demin',
    placedAt:'2026-09-30T09:27:39-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'Tennis',
    legCount:2,
    stake:49.40,
    paid:65,
    result:'win',
    legs:[
      {label:'Harriet Dart to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Alex De Minaur to win',sport:'Tennis',marketType:'Moneyline',result:'win'}
    ]
  },
  {
    id:'2026-09-30-tennis-four-b',
    placedAt:'2026-09-30T05:12:39-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'Tennis',
    legCount:4,
    stake:15.99,
    paid:39,
    result:'win',
    legs:[
      {label:'Harriet Dart to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Arthur Gea to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Kamilla Rakhimova to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Novak Djokovic to win',sport:'Tennis',marketType:'Moneyline',result:'win'}
    ]
  },
  {
    id:'2026-09-30-tennis-four-c',
    placedAt:'2026-09-30T05:10:10-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'Tennis',
    legCount:4,
    stake:10,
    paid:25,
    result:'win',
    legs:[
      {label:'Harriet Dart to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Arthur Gea to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Novak Djokovic to win',sport:'Tennis',marketType:'Moneyline',result:'win'},
      {label:'Magdalena Frech to win',sport:'Tennis',marketType:'Moneyline',result:'win'}
    ]
  },
  {
    id:'2026-09-30-mlb-four-loss',
    placedAt:'2026-09-30T04:51:45-04:00',
    source:'uploaded-screenshot',
    confidence:'partial',
    sport:'MLB',
    legCount:4,
    stake:5,
    paid:0,
    result:'loss',
    legs:[
      {label:'PHI Phillies to win',sport:'MLB',marketType:'Moneyline',result:'unknown'},
      {label:'HOU Astros to win',sport:'MLB',marketType:'Moneyline',result:'unknown'},
      {label:'NY Yankees to win',sport:'MLB',marketType:'Moneyline',result:'unknown'},
      {label:'SD Padres to win',sport:'MLB',marketType:'Moneyline',result:'unknown'}
    ],
    notes:'Slip result is visible, but the losing leg is not shown in the uploaded frame.'
  },
  {
    id:'2026-09-30-wnba-two-loss',
    placedAt:'2026-09-30T11:55:10-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'WNBA',
    legCount:2,
    stake:9.84,
    paid:0,
    result:'loss',
    legs:[
      {label:'ATL Dream to win',sport:'WNBA',marketType:'Moneyline',result:'win'},
      {label:'GS Valkyries to win',sport:'WNBA',marketType:'Moneyline',result:'loss'}
    ]
  },
  {
    id:'2026-09-30-wnba-three-loss',
    placedAt:'2026-09-30T04:25:42-04:00',
    source:'uploaded-screenshot',
    confidence:'partial',
    sport:'WNBA',
    legCount:3,
    stake:3.91,
    paid:0,
    result:'loss',
    legs:[
      {label:'GS Valkyries to win',sport:'WNBA',marketType:'Moneyline',result:'unknown'},
      {label:'LV Aces to win',sport:'WNBA',marketType:'Moneyline',result:'unknown'},
      {label:'ATL Dream to win',sport:'WNBA',marketType:'Moneyline',result:'unknown'}
    ]
  },
  {
    id:'2026-09-30-nhl-avs-flyers-loss',
    placedAt:'2026-09-30T04:26:44-04:00',
    source:'uploaded-screenshot',
    confidence:'partial',
    sport:'NHL',
    legCount:2,
    stake:4,
    paid:0,
    result:'loss',
    legs:[
      {label:'COL Avalanche moneyline',sport:'NHL',marketType:'Moneyline',result:'unknown'},
      {label:'PHI Flyers moneyline',sport:'NHL',marketType:'Moneyline',result:'unknown'}
    ]
  },
  {
    id:'2026-09-30-nhl-avs-total-loss',
    placedAt:'2026-09-30T11:53:36-04:00',
    source:'uploaded-screenshot',
    confidence:'confirmed',
    sport:'NHL',
    legCount:2,
    stake:10,
    paid:0,
    result:'loss',
    legs:[
      {label:'COL Avalanche moneyline',sport:'NHL',marketType:'Moneyline',result:'win'},
      {label:'NYI @ TOR over 5.5 goals',sport:'NHL',marketType:'Total',result:'loss'}
    ]
  }
];
