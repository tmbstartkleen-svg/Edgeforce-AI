import Link from 'next/link';
import OpponentMatchupPanel from '@/components/OpponentMatchupPanel';
import ForecastResearchLabPanel from '@/components/ForecastResearchLabPanel';

export const metadata={
 title:'Sports Research & Matchup Intelligence | EdgeForce',
 description:'Evidence-led sports research with historical calibration, opponent matchup trends, and source-aware coverage.'
};

export default function SportsResearchPage(){
 return <main className="sportsResearchPage">
  <header className="sportsResearchHero">
   <div>
    <div className="eyebrow">EDGEFORCE • SPORTS INTELLIGENCE</div>
    <h1>Research the matchup.<br/><span>Measure the edge.</span></h1>
    <p>One workspace for historical performance, model reliability, opponent tendencies, and evidence quality. Missing data stays visible—no fabricated player bios, averages, or head-to-head records.</p>
    <div className="sportsResearchActions">
     <Link href="/">Command Center</Link>
     <Link href="/predictions">Prediction Terminal</Link>
     <Link href="/research">Forecast Research</Link>
    </div>
   </div>
   <aside className="sportsResearchGuard">
    <small>RESEARCH STANDARD</small>
    <strong>Evidence first</strong>
    <p>Every statistic should show its season/window, sample size, source, last update, and whether it is observed or estimated.</p>
    <div><span/> No-data is not a zero</div>
    <div><span/> Scores are not sportsbook odds</div>
    <div><span/> Simulation probability is not certainty</div>
   </aside>
  </header>
  <section className="sportsResearchMetrics" aria-label="Research modules">
   <article><small>01 / COVERAGE</small><h2>League & market inventory</h2><p>Track each supported league, available market types, source health, last successful poll, and coverage gaps. Do not mark a league covered merely because a scoreboard endpoint exists.</p></article>
   <article><small>02 / PLAYER & TEAM DOSSIERS</small><h2>Season, career & bio</h2><p>Compare season averages with career baselines, recent form, home/away splits, injury status, role changes, and opponent-specific history—with sample sizes and source timestamps.</p></article>
   <article><small>03 / MATCHUP HISTORY</small><h2>Head-to-head context</h2><p>Review prior meetings, player-versus-opponent samples, pace and style, venue context, and comparable-favorite performance. Show the actual sample and uncertainty, not just a headline percentage.</p></article>
   <article><small>04 / PRICE & EDGE</small><h2>Odds-aware simulations</h2><p>Compare model probability to current, timestamped prices; remove vig where possible; report expected value, line movement, market availability, and missing-book coverage.</p></article>
  </section>
  <section className="sportsResearchSection">
   <div className="sportsResearchSectionHead"><div><div className="eyebrow">MATCHUP LAB</div><h2>Opponent & player trends</h2></div><span>Live API data • source-dependent</span></div>
   <OpponentMatchupPanel/>
  </section>
  <section className="sportsResearchSection">
   <div className="sportsResearchSectionHead"><div><div className="eyebrow">MODEL HISTORY</div><h2>Seasonal reliability & calibration</h2></div><span>Historical forecast records only</span></div>
   <ForecastResearchLabPanel/>
  </section>
  <section className="sportsResearchFoot">
   <strong>What makes an edge trustworthy?</strong>
   <p>Coverage completeness + source freshness + price comparison + calibrated probabilities + adequate sample size. If one is missing, the interface should say so and downgrade or suppress the recommendation.</p>
  </section>
 </main>;
}
