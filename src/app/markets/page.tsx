import UniversalMarketsPanel from '@/components/UniversalMarketsPanel';
import '../mobile/mobile.css';

export const metadata={
 title:'Edgeforce Markets',
 description:'Separate non-sports prediction-market intelligence plus a switchable sports pricing view.'
};

export default function MarketsPage(){
 return <UniversalMarketsPanel/>;
}
