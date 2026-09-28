export type PlayerProfile={id:string;name:string;sport:string;team:string;position:string;games:number;recentForm:number;usage:number;injuryStatus:string;trend:'UP'|'FLAT'|'DOWN';lastUpdated:string};
export const demoPlayers:PlayerProfile[]=[
{id:'hurts',name:'Jalen Hurts',sport:'NFL',team:'Philadelphia Eagles',position:'QB',games:2,recentForm:.78,usage:.92,injuryStatus:'Active',trend:'UP',lastUpdated:'2026-09-28T14:45:00-05:00'},
{id:'smith',name:'DeVonta Smith',sport:'NFL',team:'Philadelphia Eagles',position:'WR',games:2,recentForm:.81,usage:.84,injuryStatus:'Active',trend:'UP',lastUpdated:'2026-09-28T14:45:00-05:00'},
{id:'altmaier',name:'Daniel Altmaier',sport:'Tennis',team:'ATP',position:'Singles',games:12,recentForm:.66,usage:1,injuryStatus:'Active',trend:'FLAT',lastUpdated:'2026-09-28T12:30:00-05:00'}
];
