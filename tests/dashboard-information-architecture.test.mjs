import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

const dashboard=readFileSync(new URL('../src/components/Dashboard.tsx',import.meta.url),'utf8');
const page=readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');

test('sports-first dashboard order stays user-facing before research internals',()=>{
  const markers=[
    ['edge','id="edge"'],
    ['board','id="board"'],
    ['parlays','id="parlays"'],
    ['predictions','id="predictions"'],
    ['signals','id="signals"'],
    ['research','id="research"'],
    ['operator','id="operator"']
  ];
  const positions=markers.map(([name,marker])=>[name,dashboard.indexOf(marker)]);
  for(const [name,pos] of positions)assert.ok(pos>=0,name+' anchor is missing');
  for(let i=1;i<positions.length;i++){
    assert.ok(positions[i][1]>positions[i-1][1],positions[i][0]+' must remain after '+positions[i-1][0]);
  }
  assert.ok(dashboard.indexOf('V51 PREDICTION VALIDATION LAB')>dashboard.indexOf('id="research"'));
  assert.ok(dashboard.indexOf('V40 MODEL DIAGNOSTICS')>dashboard.indexOf('id="research"'));
});

test('initial board hydration does not present loading as a real zero board',()=>{
  assert.match(dashboard,/const boardLoading=board\.source==='loading'/);
  assert.match(dashboard,/boardLoading\?'—':filtered\.length/);
  assert.match(dashboard,/loading live board/);
});

test('home shortcuts contain no literal escaped newline text',()=>{
  assert.equal(page.includes('\\n'),false);
  assert.match(page,/Prediction Terminal/);
  assert.match(page,/Forecast Research/);
});


test('V187 mobile and live board surfaces preserve sports-first usability',()=>{
  assert.match(dashboard,/href="#live"/);
  assert.match(dashboard,/liveScoreSurface/);
  assert.match(dashboard,/liveScoreGrid/);
  assert.match(dashboard,/mobileBoardCards/);
  assert.match(dashboard,/desktopBoardTable/);
});


test('V188 sport navigator exposes one-tap sports and resettable filters',()=>{
  assert.match(dashboard,/V188 SPORT NAVIGATOR/);
  assert.match(dashboard,/sportChipRail/);
  assert.match(dashboard,/aria-pressed=/);
  assert.match(dashboard,/resetBoardFilters/);
  assert.match(dashboard,/sportCounts/);
});


test('V189 probability board renders the ranked filtered decision surface',()=>{
  assert.match(dashboard,/boardDecisionSummary/);
  assert.match(dashboard,/rankedFiltered\.map/);
  assert.match(dashboard,/decisionBadge/);
  assert.match(dashboard,/decisionRow/);
  assert.match(dashboard,/No qualified rows match the current ranking and review filters/);
});


test('V190 market command bar exposes presets and collapsible advanced filters',()=>{
  assert.match(dashboard,/V190 MARKET COMMAND BAR/);
  assert.match(dashboard,/applyBoardPreset/);
  assert.match(dashboard,/marketChipRail/);
  assert.match(dashboard,/advancedBoardFilters/);
  assert.match(dashboard,/High Sim/);
  assert.match(dashboard,/Robust/);
  assert.match(dashboard,/Review/);
});


test('V191 live board scan exposes sticky action-first controls',()=>{
  assert.match(dashboard,/V191 LIVE SCAN/);
  assert.match(dashboard,/boardScanLanes/);
  assert.match(dashboard,/boardScanDock/);
  assert.match(dashboard,/boardScanLane/);
  assert.match(dashboard,/Action-first board/);
  assert.match(dashboard,/setRankingMode\('PRIORITY'\)/);
});


test('V192 live game center promotes score clock and source health',()=>{
  assert.match(dashboard,/V192 LIVE GAME CENTER/);
  assert.match(dashboard,/liveGameCenter/);
  assert.match(dashboard,/featuredLiveGame/);
  assert.match(dashboard,/liveGamePulse/);
  assert.match(dashboard,/MULTI-SOURCE/);
  assert.match(dashboard,/SOURCE CONFLICT/);
  assert.match(dashboard,/compactLiveRail/);
});
