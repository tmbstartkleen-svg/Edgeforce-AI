import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('V153 backtest and calibration metrics use settlement evidence weight',()=>{
 const backtest=read('src/lib/backtest.ts');
 const calibration=read('src/lib/modelCalibration.ts');
 assert.match(backtest,/settlementLearningFromFeatures\(r\.features\)\.evidenceWeight/);
 assert.match(backtest,/effectiveSampleSize:totalWeight/);
 assert.match(backtest,/brier\+=\(p-r\.outcome\)\*\*2\*weight/);
 assert.match(calibration,/settlementLearningFromFeatures\(row\.features\)\.evidenceWeight/);
 assert.match(calibration,/effectiveSampleSize/);
});

test('V153 rolling performance and recalibration strength use effective evidence',()=>{
 const performance=read('src/lib/modelPerformance.ts');
 const recalibration=read('src/lib/recalibrationEngine.ts');
 assert.match(performance,/confidenceDecay\(ageDays\)\*evidenceWeight/);
 assert.match(performance,/effectiveSampleSize:summary\.effectiveSampleSize/);
 assert.match(recalibration,/const effectiveSampleSize=allSummary\.effectiveSampleSize/);
 assert.match(recalibration,/const shrinkage=effectiveSampleSize\/\(effectiveSampleSize\+options\.shrinkageSamples\)/);
});

test('V153 internal sport model fitting weights standardization gradients calibration and metrics',()=>{
 const model=read('src/lib/trainedSportModels.ts');
 assert.match(model,/evidenceWeight:settlementLearningFromFeatures\(row\.features\)\.evidenceWeight/);
 assert.match(model,/row\.x\[j\]\*row\.evidenceWeight\/totalWeight/);
 assert.match(model,/gradB\+=error\*row\.evidenceWeight/);
 assert.match(model,/ga\+=e\*score\*row\.evidenceWeight/);
 assert.match(model,/brier\+=\(p-row\.y\)\*\*2\*weight/);
 assert.match(model,/holdoutEffectiveSampleSize:holdoutMetrics\.effectiveSampleSize/);
});

test('V153 external ML contract transports and consumes evidence weights',()=>{
 const tournament=read('src/lib/externalMlTournament.ts');
 const service=read('ml-service/app.py');
 assert.match(tournament,/evidenceWeight:settlementLearningFromFeatures\(row\.features\)\.evidenceWeight/);
 assert.match(service,/evidenceWeight: float = Field\(default=1\.0, ge=0\.05, le=1\.0\)/);
 assert.match(service,/sample_weight=sample_weight/);
 assert.match(service,/brier_score_loss\(y, p, sample_weight=sample_weight\)/);
 assert.match(service,/effectiveSampleSize/);
});
