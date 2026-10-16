import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync('scripts/d1-pg-consistent-export.mjs','utf8');
test('read-only export rejects unmapped source columns',()=>{assert.match(code,/information_schema.columns/);assert.match(code,/UNMAPPED_SOURCE_COLUMNS_/);assert.match(code,/read only isolation level repeatable read/);});
test('all ten baseline tables have explicit column contracts',()=>{for(const name of ['teams','athletes','events','market_snapshots','player_game_stats','injury_snapshots','weather_snapshots','model_runs','bet_results','calibration_metrics'])assert.match(code,new RegExp('\\b'+name+':\\['));});
