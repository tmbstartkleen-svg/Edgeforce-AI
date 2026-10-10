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
