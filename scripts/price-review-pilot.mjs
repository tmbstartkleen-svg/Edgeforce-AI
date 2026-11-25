import {closeSync, constants, fstatSync, openSync, readSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createPriceReviewTracker, normalizePriceReviewSource, priceReviewApproval} from '../src/lib/providers/priceReview.ts';

const INPUT_SCHEMA = 'edgeforce-price-review-pilot-v1';
const MAX_REPLAY_BYTES = 8 * 1024 * 1024;
const MAX_ROWS_PER_FEED = 4000;
const stages = ['MATCH', 'WITHDRAWAL', 'REOPEN', 'OUTAGE', 'EXPIRY'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const label = value => typeof value === 'string' && value.length <= 150 && !/[\x00-\x1f\x7f]/.test(value)
 ? value.trim().replace(/\s+/g, ' ').normalize('NFC') : '';
const key = value => label(value).toLowerCase();
const zonedTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const revisionFields = ['sourceEventId', 'bookmaker', 'sourceTimestamp', 'status', 'selection', 'odds',
 'market', 'venueType', 'liveEligible', 'evidenceClass', 'period', 'currency', 'settlementKey', 'line',
 'startTime', 'home', 'away', 'sport', 'league', 'outcomeCount'];

class ReplayInputError extends Error {}
const reject = message => { throw new ReplayInputError(message); };

function time(value) {
 if (typeof value !== 'string' || !zonedTime.test(value)) return NaN;
 const wallTime = value.slice(0, 19);
 const calendar = new Date(wallTime + 'Z');
 if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 19) !== wallTime) return NaN;
 return Date.parse(value);
}

function marketScope(row) {
 return JSON.stringify([
  key(row.sport), key(row.league), key(row.home), key(row.away), time(row.startTime),
  row.market, row.period, row.settlementKey, row.line ?? null, row.currency, row.outcomeCount
 ]);
}

function approvalsFor(feeds) {
 if (!Array.isArray(feeds) || feeds.length !== 2 || feeds.some(feed=>!isObject(feed) || typeof feed.id !== 'string') ||
  new Set(feeds.map(feed=>feed.id)).size !== 2) reject('A pilot requires two uniquely configured feed slots.');
 const approvals = JSON.stringify(Object.fromEntries(feeds.map(feed=>[feed.id, {
  origin: feed.origin, operator: feed.operator, books: feed.books
 }])));
 const approved = feeds.map(feed=>({id: feed.id, approval: priceReviewApproval({
  id: feed.id, url: feed.origin, maxAgeMin: feed.maxAgeMin
 }, approvals)}));
 if (approved.some(feed=>!feed.approval)) reject('Each feed requires a valid slot, HTTPS origin, operator, book list and maximum age.');
 const [first, second] = approved.map(feed=>feed.approval);
 if (first.host === second.host || first.operator === second.operator ||
  ![...first.books].some(a=>[...second.books].some(b=>a !== b))) {
  reject('The declared feed origins, upstream operators and book pair must be distinct.');
 }
 return approved;
}

function framesFor(input, approved, scope) {
 if (!Array.isArray(input.frames) || input.frames.length !== stages.length) {
  reject('Supply five frames covering match, withdrawal, reopening, outage and expiry.');
 }
 let previousTime = -Infinity;
 let selectedMarket;
 return input.frames.map((frame,index)=>{
  if (!isObject(frame) || frame.stage !== stages[index] || !isObject(frame.feeds) ||
   Object.keys(frame.feeds).length !== approved.length || approved.some(feed=>!Object.hasOwn(frame.feeds,feed.id))) {
   reject('Frame stages must be in order and declare an array or null for each feed.');
  }
  const at = time(frame.at);
  if (!(at > previousTime)) reject('Frame times require increasing, valid zoned timestamps.');
  previousTime = at;
  for (const {id} of approved) {
   const rows = frame.feeds[id];
   if (rows === null) continue;
   if (!Array.isArray(rows) || rows.length > MAX_ROWS_PER_FEED) reject('Each responding feed must provide a bounded array.');
   for (const row of rows) {
    if (!isObject(row) || key(row.sport) !== key(scope.sport) || key(row.league) !== key(scope.league)) {
     reject('Every quote must be within the selected sport and league.');
    }
    const market = marketScope(row);
    selectedMarket ??= market;
    if (market !== selectedMarket) reject('All frames must refer to the same fixture and market contract.');
   }
  }
  return {stage: stages[index], at, feeds: frame.feeds};
 });
}

function revisions(rows) {
 if (!Array.isArray(rows)) return null;
 return JSON.stringify(rows.map(row=>JSON.stringify(revisionFields.map(field=>row[field]))).sort());
}

export function runPriceReviewPilot(input, operatorSupplied = false) {
 if (!isObject(input) || input.schema !== INPUT_SCHEMA || !isObject(input.scope)) reject('The replay schema is invalid.');
 const scope = {sport: label(input.scope.sport), league: label(input.scope.league)};
 if (!scope.sport || !scope.league) reject('Choose one sport and league for the replay.');
 const approved = approvalsFor(input.feeds);
 const tracker = createPriceReviewTracker();
 const replay = framesFor(input,approved,scope).map(frame=>{
  const sources = new Map();
  for (const {id,approval} of approved) {
   if (frame.feeds[id] !== null) sources.set(id, normalizePriceReviewSource(frame.feeds[id],id,approval,frame.at));
  }
  const snapshot = tracker.capture(approved.length,[...sources.values()],frame.at);
  return {...frame, sources, snapshot, review:snapshot.read(frame.at)};
 });
 const [match, withdrawal, reopen, outage, expiry] = replay;
 const matched = match.review.markets.length === 1 && match.review.markets[0].sources.length === 2
  ? match.review.markets[0] : undefined;
 const initialBooks = [...match.sources].flatMap(([id,source])=>source.eligibleMarkets
  .filter(market=>market.marketKey === matched?.id).map(market=>({id, market})));
 const withdrew = initialBooks.flatMap(({id,market})=>{
  const source = withdrawal.sources.get(id);
  if (!source?.rejections.MARKET_NOT_OPEN) return [];
  const revision = source.revisions.get(market.groupKey);
  return revision?.state === 'WITHHELD' && revision.at > Date.parse(market.sourceUpdatedAt)
   ? [{id, at:revision.at}] : [];
 });
 const unaffectedMarket = [...withdrawal.sources.values()].some(source=>source.eligibleMarkets.some(market=>market.marketKey === matched?.id));
 const reopened = reopen.review.markets.length === 1 && reopen.review.markets[0].id === matched?.id
  ? reopen.review.markets[0] : undefined;
 const reopenedPrice = reopened && withdrew.every(change=>reopened.sources.some(source=>
  source.providerId === change.id && Date.parse(source.sourceUpdatedAt) > change.at));
 const activeOutageSource = [...outage.sources.values()].some(source=>source.eligibleMarkets.some(market=>market.marketKey === reopened?.id));
 const expiredBeforeStart = reopened && expiry.at < Date.parse(reopened.startTime) &&
  reopened.sources.every(source=>expiry.at >= Date.parse(source.expiresAt));

 const checks = [
  {scenario:'MATCH', passed:Boolean(matched && initialBooks.length === 2)},
  {scenario:'WITHDRAWAL', passed:withdrew.length > 0 && unaffectedMarket && withdrawal.review.corroboratedMarkets === 0},
  {scenario:'REOPEN', passed:Boolean(withdrew.length && reopenedPrice)},
  {scenario:'OUTAGE', passed:Boolean(reopened && outage.sources.size === 1 && activeOutageSource &&
   outage.review.eligibleBookMarkets === 1 && outage.review.corroboratedMarkets === 0)},
  {scenario:'EXPIRY', passed:Boolean(expiredBeforeStart && expiry.sources.size === 2 &&
   approved.every(({id})=>revisions(expiry.feeds[id]) === revisions(reopen.feeds[id]) &&
    expiry.sources.get(id).rejections.BOOK_UPDATE_EXPIRED > 0) && expiry.review.corroboratedMarkets === 0 &&
   reopen.snapshot.read(expiry.at).corroboratedMarkets === 0)}
 ];
 return {
  schema:'edgeforce-price-review-pilot-result-v1',
  evidence:operatorSupplied?'OPERATOR_SUPPLIED_REPLAY':'SYNTHETIC_REPLAY',
  passed:checks.every(check=>check.passed), scope, checks, productionVerified:false,
  recommendationsAuthorized:false, externalRequests:0,
  frames:replay.map(({stage,at,review})=>({
   stage, at:new Date(at).toISOString(), status:review.status, respondedFeeds:review.respondedFeeds,
   eligibleBookMarkets:review.eligibleBookMarkets, corroboratedMarkets:review.corroboratedMarkets, rejections:review.rejections
  }))
 };
}

export function syntheticPriceReviewPilot() {
 const now = Date.parse('2026-11-25T12:00:00Z');
 const at = offset=>new Date(now+offset).toISOString();
 const scope = {sport:'Basketball', league:'Replay League'};
 const [primary, secondary] = ['odds-provider-primary', 'odds-provider-secondary'];
 const feed = (id,operator,book)=>({id,origin:`https://${operator}.example`,operator,books:[book],maxAgeMin:5});
 const rows = (bookmaker,sourceEventId,stamp,status='OPEN')=>['Example Home','Example Away'].map((selection,index)=>({
  ...scope, home:'Example Home', away:'Example Away', startTime:at(7_200_000), sourceEventId, bookmaker,
  market:'moneyline', period:'FULL_GAME', settlementKey:'includes-overtime', currency:'USD', venueType:'SPORTSBOOK',
  outcomeCount:2, selection, odds:index===0?-110:105, sourceTimestamp:at(stamp), status
 }));
 const buildFrame = (stage,offset,first,second)=>({stage,at:at(offset),feeds:{[primary]:first,[secondary]:second}});
 const initial = rows('DraftKings','example-a',-30_000);
 const other = rows('FanDuel','example-b',-20_000);
 const suspended = rows('DraftKings','example-a',20_000,'SUSPENDED');
 const restored = rows('DraftKings','example-a',45_000);
 const refreshed = rows('FanDuel','example-b',50_000);
 return {
  schema:INPUT_SCHEMA, scope, feeds:[feed(primary,'example-a','draftkings'),feed(secondary,'example-b','fanduel')],
  frames:[
   buildFrame('MATCH',0,initial,other),
   buildFrame('WITHDRAWAL',30_000,suspended,other),
   buildFrame('REOPEN',60_000,restored,refreshed),
   buildFrame('OUTAGE',90_000,restored,null),
   buildFrame('EXPIRY',360_000,restored,refreshed)
  ]
 };
}

function readReplay(path) {
 let fd;
 try {
  fd = openSync(path,constants.O_RDONLY | constants.O_NONBLOCK);
  const stat = fstatSync(fd);
  if (!stat.isFile() || stat.size > MAX_REPLAY_BYTES) reject('Replay input must be a local file up to 8 MiB.');
  const bytes = Buffer.alloc(MAX_REPLAY_BYTES+1);
  let offset = 0;
  while (offset < bytes.length) {
   const read = readSync(fd,bytes,offset,bytes.length-offset,null);
   if (!read) break;
   offset += read;
  }
  if (offset > MAX_REPLAY_BYTES) reject('Replay input must be a local file up to 8 MiB.');
  return JSON.parse(bytes.subarray(0,offset).toString('utf8'));
 } catch (error) {
  if (error instanceof ReplayInputError) throw error;
  reject('Could not read a valid local replay JSON file.');
 } finally {
  if (fd !== undefined) closeSync(fd);
 }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const args = process.argv.slice(2);
 try {
  if (args.length === 1 && args[0] === '--example') {
   console.log(JSON.stringify(syntheticPriceReviewPilot(),null,2));
  } else {
   const operatorSupplied = args.length === 2 && args[0] === '--file' && Boolean(args[1]);
   if (args.length && !operatorSupplied) reject('Use --example to print the synthetic input or --file PATH to replay a local JSON file.');
   const result = runPriceReviewPilot(operatorSupplied?readReplay(args[1]):syntheticPriceReviewPilot(),operatorSupplied);
   console.log(JSON.stringify(result,null,2));
   if (!result.passed) process.exitCode = 1;
  }
 } catch (error) {
  console.error(JSON.stringify({passed:false,error:error instanceof ReplayInputError?error.message:'Price review replay failed.',
   productionVerified:false,recommendationsAuthorized:false,externalRequests:0}));
  process.exitCode = 1;
 }
}
