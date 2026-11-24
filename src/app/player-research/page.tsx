import Link from 'next/link';
import PlayerResearchWorkbench from '@/components/PlayerResearchWorkbench';

export const metadata = { title:'EdgeForce — Player Stat Research', description:'Read-only, source-audited historical player streak analysis.' };

export default function Page() {
 return <main style={{background:'#071018',minHeight:'100vh'}}>
  <nav style={{padding:'14px 24px',borderBottom:'1px solid #263a4c'}}>
   <Link style={{color:'#b3e4cb'}} href="/">← EdgeForce Dashboard</Link>
  </nav>
  <PlayerResearchWorkbench/>
 </main>;
}
