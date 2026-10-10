import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const src=readFileSync(new URL('../src/lib/edgeScanner.ts',import.meta.url),'utf8');
const mathSrc=readFileSync(new URL('../src/lib/math.ts',import.meta.url),'utf8');
const compile=source=>{
 const r=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(r.diagnostics?.length||0,0);
 return r.outputText;
};
const mathModule={exports:{}};
new Function('require','module','exports',compile(mathSrc))(require,mathModule,mathModule.exports);
const scannerModule={exports:{}};
new Function('require','module','exports',compile(src))(id=>{
 if(id==='./math')return mathModule.exports;
 throw new Error('Unexpected dependency '+id);
},scannerModule,scannerModule.exports);
const {scanEdgeOpportunities}=scannerModule.exports;

const NEXT=new Date(Date.now()+4*60*60*1000).toISOString();
const STAMP=new Date(Date.now()-45000).toISOString();
const row=(book,selection,odds,other={})=>({
 id:book+selection,sport:'NFL',league:'NFL',event:'Away @ Home',market:'h2h',
 home:'Home',away:'Away',selection,startTime:NEXT,sourceBook:book,odds,
 sourceTimestamp:STAMP,sourceAgeMin:.75,...other
});
const full=(book,home=-110,away=-110)=>[row(book,'Home',home),row(book,'Away',away)];
const scan=rows=>scanEdgeOpportunities(rows,{minEv:.01});

test('V196 requires actual independent market books, not target self-consensus',()=>{
 const target=full('DraftKings',+125,-160);
 const single=scan(target);
 assert.equal(single.positiveEvCount,0);
 assert.equal(single.sharpReferenceGroups,0);
 assert.equal(single.consensusReferenceGroups,0);
 const withSharp=scan([...target,...full('Pinnacle',-110,-110)]);
 assert.ok(withSharp.positiveEv.some(x=>x.book==='DraftKings'&&x.selection==='Home'));
 const pick=withSharp.positiveEv.find(x=>x.selection==='Home'&&x.book==='DraftKings');
 assert.ok(pick.referenceBooks.includes('Pinnacle'));
 assert.ok(!pick.referenceBooks.includes('DraftKings'));
 assert.equal(pick.quoteTimestamp,STAMP);
});
test('V196 unsigned or expired quotes cannot appear as valid EV or arbitrage',()=>{
 const quote=full('DraftKings',+125,-160);
 const others=full('Pinnacle',-110,-110);
 const missing=scan([...quote.map(x=>({...x,sourceTimestamp:undefined})),...others]);
 assert.equal(missing.positiveEvCount,0);
 assert.equal(missing.rejectedUnverifiedQuotes,2);
 const stale=scan([...quote.map(x=>({...x,sourceTimestamp:new Date(Date.now()-40*60000).toISOString(),sourceAgeMin:40})),...others]);
 assert.equal(stale.positiveEvCount,0);
 assert.equal(stale.rejectedStaleQuotes,2);
 const expired=scan([...quote.map(x=>({...x,startTime:new Date(Date.now()-60000).toISOString()})),...others.map(x=>({...x,startTime:new Date(Date.now()-60000).toISOString()}))]);
 assert.equal(expired.groupCount,0);
 assert.equal(expired.rejectedExpiredQuotes,4);
});
test('V196 requires at least two independent complete references for consensus',()=>{
 const candidate=full('DraftKings',+140,-180);
 const insufficient=scan([...candidate,...full('BetMGM',-110,-110)]);
 assert.equal(insufficient.consensusReferenceGroups,0);
 const enough=scan([...candidate,...full('BetMGM',-110,-110),...full('Caesars',-112,-108)]);
 const p=enough.positiveEv.find(x=>x.book==='DraftKings'&&x.selection==='Home');
 assert.ok(p);
 assert.deepEqual(new Set(p.referenceBooks),new Set(['BetMGM','Caesars']));
 assert.equal(p.reference,'independent multi-book consensus');
});
test('V196 underround from a single book does not become guaranteed cross-book arb',()=>{
 const result=scan(full('DraftKings',+120,+120));
 assert.equal(result.arbitrageCount,0);
});
test('V196 spread markets need opposite signed points for exact settlement parity',()=>{
 const mismatched=[
  row('DraftKings','Home -3.5',+125,{market:'spreads'}),
  row('Pinnacle','Away -3.5',-105,{market:'spreads'})
 ];
 const mismatch=scan(mismatched);
 assert.equal(mismatch.arbitrageCount,0);
 assert.equal(mismatch.positiveEvCount,0);
 const paired=scan([
  row('DraftKings','Home -3.5',+125,{market:'spreads'}),
  row('DraftKings','Away +3.5',-160,{market:'spreads'}),
  row('Pinnacle','Home -3.5',-110,{market:'spreads'}),
  row('Pinnacle','Away +3.5',-110,{market:'spreads'})
 ]);
 assert.ok(paired.positiveEv.some(x=>x.selection==='Home -3.5'&&x.book==='DraftKings'));
});
test('V196 scanner remains request-free, and reference quote never self validates',()=>{
 assert.doesNotMatch(src,/fetch\s*\(|axios|https?:\/\//);
 assert.match(src,/independent=rows\.filter\(x=>norm\(x\.book\)!==norm\(bestQuote\.book\)\)/);
 assert.match(src,/EDGE_SCANNER_MAX_QUOTE_AGE_MIN/);
 assert.match(src,/rejectedUnverifiedQuotes/);
});
