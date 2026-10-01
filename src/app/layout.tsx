import './globals.css';
import './v21.css';

export const metadata={
 title:'Edgeforce AI',
 description:'Live sports probability, simulation, history and prediction-market intelligence'
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>
}
