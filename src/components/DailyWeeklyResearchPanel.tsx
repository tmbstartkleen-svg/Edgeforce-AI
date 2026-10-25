'use client';
import {useState} from 'react';
const nbaReport='https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-10-25_08_30AM.pdf';
const nflReport='https://www.philadelphiaeagles.com/news/cowboys-vs-eagles-injury-report-2026-nfl-week-7-saquon-barkley-jalyx-hunt';
const nbaGames=[['7:00 PM','Washington Wizards at Charlotte Hornets'],['7:00 PM','Minnesota Timberwolves at Cleveland Cavaliers'],['7:30 PM','Chicago Bulls at Boston Celtics'],['7:30 PM','Dallas Mavericks at Miami Heat'],['8:00 PM','Indiana Pacers at Milwaukee Bucks'],['8:00 PM','Phoenix Suns at Oklahoma City Thunder'],['8:30 PM','Atlanta Hawks at Houston Rockets'],['9:00 PM','Memphis Grizzlies at Utah Jazz'],['10:00 PM','Golden State Warriors at Denver Nuggets']];
const nhlGames=[['7:00 PM','Los Angeles Kings at New York Rangers'],['8:30 PM','Toronto Maple Leafs at Calgary Flames'],['9:30 PM','Detroit Red Wings at Edmonton Oilers']];
const rows=[
 ...nbaGames.map(([time,event])=>({sport:'NBA',time,event,note:'Both teams: October 26 injury reports not yet submitted in the reviewed official report. Rosters and minutes restrictions still require review.',source:nbaReport})),
 ...nhlGames.map(([time,event])=>({sport:'NHL',time,event,note:'Schedule lead only. Starting goalies, scratches, injuries and roster transactions not yet verified for this game.',source:'https://www.nhl-schedules.com/season/2026-2027/10/26/'})),
 {sport:'NFL',time:'8:15 PM',event:'Dallas Cowboys at Philadelphia Eagles',note:'Injury review below. Final inactives, IR activations and current sportsbook prices still pending.',source:nflReport},
 {sport:'MLB',time:'8:00 PM',event:'Milwaukee Brewers at Tampa Bay Rays — Game 3',note:'Probable pitchers: Robert Gasser / Freddy Peralta. Confirm starters, lineups, postseason roster and bullpen availability before pricing.',source:'https://apnews.com/article/f67c22051a74370846c32b98fea39fa0'},
];
export default function DailyWeeklyResearchPanel(){
 const [period,setPeriod]=useState('daily');
 const [sport,setSport]=useState('ALL');
 const [session,setSession]=useState('ALL');
 const filtered=rows.filter(row=>(sport==='ALL'||row.sport===sport)&&(session==='ALL'||row.time.endsWith(session)));
 return <section className="efops-panel" aria-label="Daily and weekly research">
  <h2>Daily &amp; Weekly Research</h2>
  <p>Research edition: October 25, 2026 morning · All times America/New_York. This is a dated research snapshot, not a live odds feed or a completed bet list.</p>
  <div className="efops-panel-head"><label>Edition <select value={period} onChange={e=>setPeriod(e.target.value)}><option value="daily">Monday, October 26</option><option value="weekly">October 26–November 1</option></select></label><label>Sport <select value={sport} onChange={e=>setSport(e.target.value)}><option value="ALL">All researched sports</option>{['NBA','NHL','NFL','MLB'].map(x=><option key={x}>{x}</option>)}</select></label><label>Start window <select value={session} onChange={e=>setSession(e.target.value)}><option value="ALL">AM and PM</option><option value="AM">AM</option><option value="PM">PM</option></select></label></div>
  <div className="efops-grid"><div className="efops-stat"><span>Verified bet recommendations</span><strong>0</strong><small>Prices and calibrated models missing</small></div><div className="efops-stat"><span>Matchups in research queue</span><strong>{rows.length}</strong><small>October 26 only; incomplete sports coverage</small></div><div className="efops-stat"><span>Parlays published</span><strong>0</strong><small>2–5 leg request awaiting qualifying evidence</small></div></div>
  <p role="status">Awaiting sportsbook, state/country and clarification of the -400 / -200 price rules. No prices, win percentages or cash-out offers have been verified for these selections.</p>
  {period==='weekly'&&<p className="efops-error">Weekly research is incomplete. Only October 26 matchups are listed below. October 27–November 1 schedules, injuries, rosters and prices have not been reviewed; no weekly ticket is published.</p>}
  <h3>October 26 matchup research</h3>
  <div className="efops-tablebox"><table><thead><tr><th>Sport / Matchup</th><th>Start ET</th><th>Injuries &amp; roster review</th><th>Odds</th><th>Monte Carlo %</th><th>Decision</th></tr></thead><tbody>{filtered.map(row=><tr key={row.event}><td>{row.sport}<br/>{row.event}</td><td>{row.time}</td><td>{row.note}<br/><a href={row.source} target="_blank" rel="noreferrer">Reviewed source</a></td><td>Unavailable</td><td>Unavailable</td><td>Hold — research incomplete</td></tr>)}</tbody></table></div>
  {!filtered.length&&<p>No researched matchups match this filter. This does not establish that no games are scheduled.</p>}
  <h3>Cowboys–Eagles: injury and activation review</h3>
  <p>Dallas: Turpin (ribs), Shelton (hamstring) and Winters (calf) out. Liufau and Locke are questionable and need IR activation. Philadelphia: DeVonta Smith, Wicks, Nolan Smith and Carter II out. Barkley remains questionable despite full Saturday practice; Goedert is cleared. Greenard and Hunt remain questionable. Bennett, Calcaterra, Dickerson and Stowers need IR activation.</p>
  <p>Analysis: receiving roles and pass protection may change materially. Check activations, final inactives and workload expectations before evaluating sides, totals or player props. This review does not establish a betting edge. <a href={nflReport} target="_blank" rel="noreferrer">Team report, October 24</a>.</p>
  <h3>Requested parlay structure</h3>
  <p>Target: 2–5 legs, AM or PM opening, with all events expected to finish within 24 hours of the first start. Event end times and settlement can run late. The final leg must start after earlier legs are expected to finish if the goal is to review a cash-out offer before it begins.</p>
  <p>“Stronger” is ambiguous: -500 is a stronger favorite than -400 but pays less. The price filter is not applied until its meaning is confirmed. Combined win probability requires a joint model that accounts for dependence; multiplying displayed percentages is not a joint Monte Carlo simulation.</p>
  <p>Cash-out availability is unconfirmed and can be suspended or withdrawn by the sportsbook. A final leg at -200 does not guarantee an offer or a profitable exit.</p>
  <h3>Coverage still to complete</h3>
  <p>WNBA, soccer competitions, tennis, college sports, golf, combat sports, motorsport and other sports remain unverified for this edition. The sports-network connection does not establish complete odds, injury or roster coverage. Check Sportsbook Coverage for stored-source evidence.</p>
  <p>No paid collection, archive writes, automated wagers or provider activation are performed by this section.</p>
 </section>;
}
