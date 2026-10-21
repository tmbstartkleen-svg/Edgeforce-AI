import Link from 'next/link';
import CoverageInspector from '@/components/CoverageInspector';
export const metadata={title:'EdgeForce — All-Sports Coverage Inspector',description:'Owner-gated, source-backed sports and league coverage reconciliation.'};
export default function CoveragePage(){return <main style={{background:'#071018',minHeight:'100vh'}}><nav style={{padding:'14px 24px',borderBottom:'1px solid #263a4c'}}><Link style={{color:'#b3e4cb'}} href="/network">← ATLAS Network</Link></nav><CoverageInspector/></main>}
