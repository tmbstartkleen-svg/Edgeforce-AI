import MobilePredictionTerminal from '@/components/MobilePredictionTerminal';
import '../mobile/mobile.css';

export const metadata={
 title:'Edgeforce Prediction Intelligence',
 description:'All-market Kalshi and Polymarket research terminal with smart flow and cross-venue pricing.'
};

export default function PredictionsPage(){
 return <MobilePredictionTerminal/>;
}
