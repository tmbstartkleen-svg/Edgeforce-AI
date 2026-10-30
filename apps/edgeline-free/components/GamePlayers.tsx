import {useEffect,useState} from 'react';
import {api} from '../lib/api';
const leagues:Record<string,string>={NBA:'nba',WNBA:'wnba',NFL:'nfl',NHL:'nhl',MLB:'mlb',NCAAF:'ncaaf',NCAAB:'ncaab',EPL:'epl'};
const canonical=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export default function GamePlayers({sport,home,away}:{sport:string;home:string;away:string}){
 const league=leagues[sport];const [data,setData]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;setData(null);setError('');if(!league)return;async function read(){if(document.hidden)return;try{const r=await api.get(`/api/player-updates?league=${league}`);if(active){setData(r.data);setError('');}}catch{if(active)setError('Player reports unavailable.');}}read();const timer=setInterval(read,300000);return()=>{active=false;clearInterval(timer);};},[league,home,away]);
 if(!league)return <p>Player reports are not connected for {sport}. Explore supported leagues in Player updates.</p>;
 const teams=data?.teams?.rows||[];const matched=[home,away].map(name=>{const hits=teams.filter((t:any)=>canonical(t.name)===canonical(name));return hits.length===1?hits[0]:null;});
 const rows=(data?.injuries?.rows||[]).filter((r:any)=>matched.some(t=>t&&t.id===r.teamId));
 return <section aria-label="Game player reports"><h3>Player availability review</h3><p>Market probabilities do not incorporate these reports. Review availability before using a candidate.</p>{error&&<p role="alert">{error} Previous reports may be stale.</p>}{!data&&!error&&<p>Checking public reports…</p>}{data&&<><p>ESPN reports retrieved {data.injuries.checkedAt}. Report dates may be older.</p>{data.injuries.error&&<p role="alert">{data.injuries.error}</p>}{matched.map((t,i)=><p key={i}>{[home,away][i]}: {t?'Team matched to source':'No unambiguous team match — coverage unverified'}</p>)}{rows.length?<ul>{rows.map((r:any)=><li key={r.id}>{r.team} · {r.player}: <strong>{r.status}</strong> · {r.bodyPart||'Area unspecified'} · Report {r.reportedAt||'date unknown'}</li>)}</ul>:<p>No matched injury entries. This does not confirm that either team is healthy or its lineup is final.</p>}</>}<p>Full rosters and news are available in the Player updates tab.</p></section>;
}
