import {deriveVenueConditionSignals,normalizeSurface} from '@/lib/venueWeatherIntelligence';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const calm=deriveVenueConditionSignals({sportKey:'nfl',indoor:false,elevationFt:500,weather:{temperatureF:65,apparentTemperatureF:65,humidityPct:50,precipitationProbability:5,precipitationIn:0,windMph:4,windGustMph:7}});
 const storm=deriveVenueConditionSignals({sportKey:'nfl',indoor:false,elevationFt:500,weather:{temperatureF:30,apparentTemperatureF:22,humidityPct:90,precipitationProbability:90,precipitationIn:.3,snowfallIn:.12,windMph:22,windGustMph:36}});
 const hotBaseball=deriveVenueConditionSignals({sportKey:'mlb',indoor:false,elevationFt:5200,surface:'natural grass',weather:{temperatureF:95,apparentTemperatureF:98,humidityPct:35,precipitationProbability:0,precipitationIn:0,windMph:5,windGustMph:8}});
 const dome=deriveVenueConditionSignals({sportKey:'nfl',indoor:true,elevationFt:600,surface:'artificial turf',weather:null});
 const ok=storm.venueTotalEffect<calm.venueTotalEffect&&storm.venueVolatilityEffect>calm.venueVolatilityEffect&&hotBaseball.venueTotalEffect>0&&hotBaseball.venueAltitudeEffect>0&&dome.venueConditionSeverity===0&&normalizeSurface('Synthetic Turf')==='turf';
 return Response.json({ok,build:'V68',schemaVersion:'v68-venue-conditions-1',calm,storm,hotBaseball,dome},{headers:{'Cache-Control':'no-store'}});
}
