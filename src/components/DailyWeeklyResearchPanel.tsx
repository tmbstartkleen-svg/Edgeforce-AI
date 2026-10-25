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
 const [stake,setStake]=useState('');
 const [offer,setOffer]=useState('');
 const stakeAmount=Number(stake),offerAmount=Number(offer);
 const hasOffer=stake.trim()!==''&&offer.trim()!==''&&Number.isFinite(stakeAmount)&&stakeAmount>0&&Number.isFinite(offerAmount)&&offerAmount>=0;
 const filtered=rows.filter(row=>(sport==='ALL'||row.sport===sport)&&(session==='ALL'||row.time.endsWith(session)));
 return <section className="efops-panel" aria-label="Daily and weekly research">
  <h2>Daily &amp; Weekly Research</h2>
  <p>Research edition: October 25, 2026 morning · All times America/New_York. This is a dated research snapshot, not a live odds feed or a completed bet list.</p>
  <div className="efops-panel-head"><label>Edition <select value={period} onChange={e=>setPeriod(e.target.value)}><option value="daily">Monday, October 26</option><option value="weekly">October 26–November 1</option></select></label><label>Sport <select value={sport} onChange={e=>setSport(e.target.value)}><option value="ALL">All researched sports</option>{['NBA','NHL','NFL','MLB'].map(x=><option key={x}>{x}</option>)}</select></label><label>Start window <select value={session} onChange={e=>setSession(e.target.value)}><option value="ALL">AM and PM</option><option value="AM">AM</option><option value="PM">PM</option></select></label></div>
  <div className="efops-grid"><div className="efops-stat"><span>Verified bet recommendations</span><strong>0</strong><small>Prices and calibrated models missing</small></div><div className="efops-stat"><span>Matchups in research queue</span><strong>{rows.length}</strong><small>October 26 only; incomplete sports coverage</small></div><div className="efops-stat"><span>Parlays published</span><strong>0</strong><small>Sequential tickets awaiting qualifying evidence</small></div></div>
  <p role="status">Working price rule: earlier legs at -400 or more negative; last leg at -200 or more negative. Sportsbook and region remain unconfirmed. No prices, win percentages or cash-out offers have been verified for these selections.</p>
  {period==='weekly'&&<p className="efops-error">Weekly research is incomplete. Only October 26 matchups are listed below. October 27–November 1 schedules, injuries, rosters and prices have not been reviewed; no weekly ticket is published.</p>}
  <h3>October 26 matchup research</h3>
  <div className="efops-tablebox"><table><thead><tr><th>Sport / Matchup</th><th>Start ET</th><th>Injuries &amp; roster review</th><th>Odds</th><th>Monte Carlo %</th><th>Decision</th></tr></thead><tbody>{filtered.map(row=><tr key={row.event}><td>{row.sport}<br/>{row.event}</td><td>{row.time}</td><td>{row.note}<br/><a href={row.source} target="_blank" rel="noreferrer">Reviewed source</a></td><td>Unavailable</td><td>Unavailable</td><td>Hold — research incomplete</td></tr>)}</tbody></table></div>
  {!filtered.length&&<p>No researched matchups match this filter. This does not establish that no games are scheduled.</p>}
  <h3>Cowboys–Eagles: injury and activation review</h3>
  <p>Dallas: Turpin (ribs), Shelton (hamstring) and Winters (calf) out. Liufau and Locke are questionable and need IR activation. Philadelphia: DeVonta Smith, Wicks, Nolan Smith and Carter II out. Barkley remains questionable despite full Saturday practice; Goedert is cleared. Greenard and Hunt remain questionable. Bennett, Calcaterra, Dickerson and Stowers need IR activation.</p>
  <p>Analysis: receiving roles and pass protection may change materially. Check activations, final inactives and workload expectations before evaluating sides, totals or player props. This review does not establish a betting edge. <a href={nflReport} target="_blank" rel="noreferrer">Team report, October 24</a>.</p>
  <h3>Timed ticket plans</h3>
  <p>The goal is to review an available cash-out offer after earlier legs settle, before the next event begins. Earlier legs must still win for an ordinary parlay to remain alive. Adding legs does not by itself improve the chance of reaching a profitable exit.</p>
  <div className="efops-tablebox"><table><thead><tr><th>Plan</th><th>Timing rule</th><th>Leg count</th><th>Review points</th></tr></thead><tbody>
   <tr><td>24-hour AM start</td><td>Morning opening; final estimated finish within 24 hours of first start</td><td>Start with 2–5; longer only if verified events fit</td><td>After each settled leg, before the next starts</td></tr>
   <tr><td>24-hour PM start</td><td>Afternoon/evening opening; may finish the following day within 24 hours</td><td>Start with 2–5; longer only if verified events fit</td><td>After each settled leg, before the next starts</td></tr>
   <tr><td>Weekly sequence</td><td>Final estimated finish within 7 days of first start</td><td>As many qualifying, non-overlapping events as the book permits; no filler</td><td>After each settled leg; repeat injury and lineup checks daily</td></tr>
  </tbody></table></div>
  <p>Each next start must follow the prior estimated finish plus a settlement buffer. Reject overlapping legs, duplicate events and tickets that cannot be combined at one sportsbook. Actual end and settlement times may change. A future tournament round with unknown participants is not a selectable leg.</p>
  <h3>Price-fit research leads — not tickets</h3>
  <p>A public PokerStars France page retrieved October 25 lists these October 26 Vienna match-winner prices. These are regional reference quotes, not verified account offers. Its repeated 12:00 listings do not establish a usable match order or timezone, so no timed parlay is built from them.</p>
  <div className="efops-tablebox"><table><thead><tr><th>Selection / Opponent</th><th>Listed decimal</th><th>American equivalent</th><th>Timing / health / Monte Carlo</th></tr></thead><tbody>
   <tr><td>Alexander Zverev / Martin Landaluce</td><td>1.03</td><td>Approximately -3333</td><td>Unverified / Unverified / Unavailable</td></tr>
   <tr><td>Daniil Medvedev / Daniel Merida</td><td>1.15</td><td>Approximately -667</td><td>Unverified / Unverified / Unavailable</td></tr>
   <tr><td>Carlos Alcaraz / Karen Khachanov</td><td>1.10</td><td>-1000</td><td>Unverified / Unverified / Unavailable</td></tr>
  </tbody></table></div>
  <p><a href="https://www.pokerstars.fr/en/sports/tennis/2/atp-vienna-2026/12840460/" target="_blank" rel="noreferrer">Public price source</a>. Passing the price filter alone does not establish value. No independent probabilities or cash-out prices are available for these leads.</p>
  <p>Timing check: the <a href="https://www.erstebank-open.com/en/scores/schedule" target="_blank" rel="noreferrer">official schedule reviewed October 25</a> currently shows Sunday qualifying, not Monday match times. The <a href="https://www.erstebank-open.com/en/news/storys/erstes-training-von-carlos-alcaraz" target="_blank" rel="noreferrer">tournament reports Zverev and Alcaraz practicing October 24</a>; practice attendance is not medical clearance. <a href="https://www.erstebank-open.com/en/news/storys/medvedev-mit-rueckenwind-nach-wien" target="_blank" rel="noreferrer">Medvedev played a three-set Almaty final October 25 and then travels to Vienna</a>. That workload and travel need review before using him as an early leg.</p>
  <h3>Review an actual cash-out offer</h3>
  <p>Enter the original cash stake and the total amount currently offered by your sportsbook, in the same currency. This calculates the difference only; it does not predict an offer or tell you to accept it. Excludes promotions, fees, tax and any previous partial cash-out.</p>
  <div className="efops-panel-head"><label>Original cash stake<input type="number" min="0.01" step="0.01" value={stake} onChange={e=>setStake(e.target.value)}/></label><label>Current total cash-out offer<input type="number" min="0" step="0.01" value={offer} onChange={e=>setOffer(e.target.value)}/></label></div>
  <p role="status">{hasOffer?`Difference from original stake: ${(offerAmount-stakeAmount).toFixed(2)} (${((offerAmount/stakeAmount-1)*100).toFixed(1)}%). ${offerAmount>stakeAmount?'Offer exceeds the original stake.':offerAmount===stakeAmount?'Offer equals the original stake.':'Offer is below the original stake.'}`:'Enter a positive stake and a nonnegative actual offer to compare them.'}</p>
  <p>Combined win probability requires a joint model that accounts for dependence. Multiplying displayed percentages is not a joint Monte Carlo simulation. Cash-out eligibility remains sportsbook-specific.</p>
  <h3>Coverage still to complete</h3>
  <p>WNBA, soccer competitions, verified tennis schedules and health reports, college sports, golf, combat sports, motorsport and other sports remain unverified for this edition. The sports-network connection does not establish complete odds, injury or roster coverage. Check Sportsbook Coverage for stored-source evidence.</p>
  <p>No paid collection, archive writes, automated wagers or provider activation are performed by this section.</p>
 </section>;
}
