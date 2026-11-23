#!/usr/bin/env node
// Collects regional headlines for the globe's breaking news ticker.
//
// Browsers can't read most news sites' RSS feeds directly (they don't send CORS
// headers), so this runs on a schedule in GitHub Actions (.github/workflows/news.yml),
// and publishes news.json to the `news-data` branch. The page reads it from
// raw.githubusercontent.com, which does allow cross-origin requests.
//
// It also runs a few dozen Google News searches per run for capitals, big cities and
// states or provinces (data/local-queries.json, made by scripts/build-places.mjs), in
// turns, so each place is refreshed every few hours; those go to local/<country>.json.
//
// No dependencies. Node 18 or newer. Usage: node scripts/build-news.mjs out/news.json
// Env: LOCAL_QUERIES (default data/local-queries.json), LOCAL_PREV (the previous run's
// local/ folder, default prev/local), LOCAL_PER_RUN (searches per run, default 40).
import { writeFile, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const OUT = process.argv[2] || 'out/news.json';
const MAX_AGE_H = 72, PER_FEED = 40, MAX_ITEMS = 1400, TIMEOUT_MS = 15000, CONCURRENCY = 8, MIN_OK = 6;
const UA = `Mozilla/5.0 (compatible; weather-globe-news/1.0; +https://github.com/${process.env.GITHUB_REPOSITORY || 'Wazabi0/weather-globe'})`;

// [id, name, url, regions, country]
// regions: WORLD, AF Africa, AS Asia, EU Europe, ME Middle East, NA North America, SA South America, OC Oceania.
// country: a Natural Earth country name, used only when a headline names no country itself.
const FEEDS = [
  // world
  ['bbc-world', 'BBC News', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'WORLD'],
  ['aljazeera', 'Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'WORLD'],
  ['guardian-world', 'The Guardian', 'https://www.theguardian.com/world/rss', 'WORLD'],
  ['npr-world', 'NPR', 'https://feeds.npr.org/1004/rss.xml', 'WORLD'],
  ['dw', 'DW', 'https://rss.dw.com/xml/rss-en-world', 'WORLD'],
  ['france24', 'France 24', 'https://www.france24.com/en/rss', 'WORLD'],
  ['un-news', 'UN News', 'https://news.un.org/feed/subscribe/en/news/all/rss.xml', 'WORLD'],
  // Africa
  ['bbc-africa', 'BBC News', 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', 'AF'],
  ['guardian-africa', 'The Guardian', 'https://www.theguardian.com/world/africa/rss', 'AF'],
  ['france24-africa', 'France 24', 'https://www.france24.com/en/africa/rss', 'AF'],
  ['allafrica', 'AllAfrica', 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', 'AF'],
  ['premiumtimes', 'Premium Times', 'https://www.premiumtimesng.com/feed', 'AF', 'Nigeria'],
  ['dailymaverick', 'Daily Maverick', 'https://www.dailymaverick.co.za/dmrss/', 'AF', 'South Africa'],
  // Asia
  ['bbc-asia', 'BBC News', 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', 'AS'],
  ['guardian-asia', 'The Guardian', 'https://www.theguardian.com/world/asia-pacific/rss', 'AS OC'],
  ['japantimes', 'The Japan Times', 'https://www.japantimes.co.jp/feed/', 'AS', 'Japan'],
  ['hindu', 'The Hindu', 'https://www.thehindu.com/news/national/feeder/default.rss', 'AS', 'India'],
  ['yonhap', 'Yonhap', 'https://en.yna.co.kr/RSS/news.xml', 'AS', 'South Korea'],
  ['dawn', 'Dawn', 'https://www.dawn.com/feeds/home', 'AS', 'Pakistan'],
  ['rappler', 'Rappler', 'https://www.rappler.com/feed/', 'AS', 'Philippines'],
  ['vnexpress', 'VnExpress International', 'https://e.vnexpress.net/rss/news.rss', 'AS', 'Vietnam'],
  ['bangkokpost', 'Bangkok Post', 'https://www.bangkokpost.com/rss/data/topstories.xml', 'AS', 'Thailand'],
  // Middle East
  ['bbc-me', 'BBC News', 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', 'ME'],
  ['guardian-me', 'The Guardian', 'https://www.theguardian.com/world/middleeast/rss', 'ME'],
  ['middleeasteye', 'Middle East Eye', 'https://www.middleeasteye.net/rss', 'ME'],
  // Europe
  ['bbc-europe', 'BBC News', 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', 'EU'],
  ['guardian-europe', 'The Guardian', 'https://www.theguardian.com/world/europe-news/rss', 'EU'],
  ['france24-europe', 'France 24', 'https://www.france24.com/en/europe/rss', 'EU'],
  ['bbc-uk', 'BBC News', 'https://feeds.bbci.co.uk/news/uk/rss.xml', 'EU', 'United Kingdom'],
  ['rte', 'RTÉ', 'https://www.rte.ie/feeds/rss/?index=/news/', 'EU', 'Ireland'],
  ['thelocal-se', 'The Local Sweden', 'https://www.thelocal.se/feeds/rss.php', 'EU', 'Sweden'],
  ['thelocal-dk', 'The Local Denmark', 'https://www.thelocal.dk/feeds/rss.php', 'EU', 'Denmark'],
  ['thelocal-no', 'The Local Norway', 'https://www.thelocal.no/feeds/rss.php', 'EU', 'Norway'],
  ['thelocal-de', 'The Local Germany', 'https://www.thelocal.de/feeds/rss.php', 'EU', 'Germany'],
  ['thelocal-fr', 'The Local France', 'https://www.thelocal.fr/feeds/rss.php', 'EU', 'France'],
  ['thelocal-es', 'The Local Spain', 'https://www.thelocal.es/feeds/rss.php', 'EU', 'Spain'],
  ['thelocal-it', 'The Local Italy', 'https://www.thelocal.it/feeds/rss.php', 'EU', 'Italy'],
  ['thelocal-at', 'The Local Austria', 'https://www.thelocal.at/feeds/rss.php', 'EU', 'Austria'],
  ['thelocal-ch', 'The Local Switzerland', 'https://www.thelocal.ch/feeds/rss.php', 'EU', 'Switzerland'],
  ['notesfrompoland', 'Notes from Poland', 'https://notesfrompoland.com/feed/', 'EU', 'Poland'],
  ['balkaninsight', 'Balkan Insight', 'https://balkaninsight.com/feed/', 'EU'],
  ['meduza', 'Meduza', 'https://meduza.io/rss/en/all', 'EU', 'Russia'],
  ['kyivindependent', 'The Kyiv Independent', 'https://kyivindependent.com/news-archive/rss/', 'EU', 'Ukraine'],
  // North America
  ['bbc-us', 'BBC News', 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', 'NA'],
  ['npr-us', 'NPR', 'https://feeds.npr.org/1003/rss.xml', 'NA', 'United States of America'],
  ['guardian-us', 'The Guardian', 'https://www.theguardian.com/us-news/rss', 'NA', 'United States of America'],
  ['cbs', 'CBS News', 'https://www.cbsnews.com/latest/rss/main', 'NA', 'United States of America'],
  ['globalnews', 'Global News', 'https://globalnews.ca/feed/', 'NA', 'Canada'],
  ['mexiconewsdaily', 'Mexico News Daily', 'https://mexiconewsdaily.com/feed/', 'NA', 'Mexico'],
  ['ticotimes', 'The Tico Times', 'https://ticotimes.net/feed', 'NA', 'Costa Rica'],
  // South America (and Latin America feeds that also cover Mexico and the Caribbean)
  ['bbc-latam', 'BBC News', 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml', 'SA NA'],
  ['guardian-americas', 'The Guardian', 'https://www.theguardian.com/world/americas/rss', 'SA NA'],
  ['france24-americas', 'France 24', 'https://www.france24.com/en/americas/rss', 'SA NA'],
  ['mercopress', 'MercoPress', 'https://en.mercopress.com/rss', 'SA'],
  ['riotimes', 'The Rio Times', 'https://www.riotimesonline.com/feed/', 'SA', 'Brazil'],
  ['batimes', 'Buenos Aires Times', 'https://www.batimes.com.ar/feed', 'SA', 'Argentina'],
  // Oceania
  ['bbc-australia', 'BBC News', 'https://feeds.bbci.co.uk/news/world/australia/rss.xml', 'OC'],
  ['guardian-au', 'The Guardian', 'https://www.theguardian.com/australia-news/rss', 'OC', 'Australia'],
  ['abc-au', 'ABC News (Australia)', 'https://www.abc.net.au/news/feed/2942460/rss.xml', 'OC', 'Australia'],
  ['rnz', 'RNZ', 'https://www.rnz.co.nz/rss/national.xml', 'OC', 'New Zealand'],
  ['rnz-pacific', 'RNZ Pacific', 'https://www.rnz.co.nz/rss/pacific.xml', 'OC'],
];

/* ---------- text helpers ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', bull: '•', middot: '·', euro: '€', pound: '£', yen: '¥', copy: '©', reg: '®', deg: '°',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù', acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', aring: 'å', atilde: 'ã', otilde: 'õ', ntilde: 'ñ', ccedil: 'ç', oslash: 'ø', aelig: 'æ', szlig: 'ß' };
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e) => {
  if (e[0] !== '#') { if (ENT[e] != null) return ENT[e]; const k = e.toLowerCase(); return ENT[k] == null ? m : e[0] === k[0] ? ENT[k] : ENT[k].toUpperCase(); }
  const n = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
  return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
});
const text = s => {
  if (!s) return '';
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  s = decode(s).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ');
  return decode(s).replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
};
const clip = (s, n) => s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
const tag = (x, names) => {
  for (const n of names) { const m = x.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i')); if (m) return m[1]; }
  return '';
};
const TZ = { AEDT: '+1100', AEST: '+1000', ACDT: '+1030', ACST: '+0930', AWST: '+0800', NZDT: '+1300', NZST: '+1200', JST: '+0900', KST: '+0900', HKT: '+0800', SGT: '+0800', PHT: '+0800', WIB: '+0700', ICT: '+0700',
  IST: '+0530', PKT: '+0500', GST: '+0400', MSK: '+0300', EAT: '+0300', EEST: '+0300', EET: '+0200', CEST: '+0200', SAST: '+0200', CAT: '+0200', CET: '+0100', WAT: '+0100', BST: '+0100', WET: '+0000', UTC: '+0000', ART: '-0300', BRT: '-0300' };
function parseDate(s) {
  if (!s) return null;
  let t = Date.parse(s);
  if (!isFinite(t)) { const m = s.match(/^(.*\d)\s+([A-Z]{2,5})$/); if (m && TZ[m[2]]) t = Date.parse(`${m[1]} ${TZ[m[2]]}`); }
  return isFinite(t) ? t : null;
}
function linkOf(block) {
  const plain = text(tag(block, ['link']));
  if (/^https?:\/\//i.test(plain)) return plain;
  let best = '';
  for (const m of block.matchAll(/<link\b([^>]*)>/gi)) {
    const href = m[1].match(/\bhref=["']([^"']+)["']/i)?.[1], rel = m[1].match(/\brel=["']([^"']+)["']/i)?.[1] || 'alternate';
    if (href && /^https?:\/\//i.test(decode(href)) && (rel === 'alternate' || !best)) best = decode(href);
  }
  if (best) return best;
  const g = text(tag(block, ['guid', 'id']));
  return /^https?:\/\//i.test(g) ? g : '';
}
// Yonhap marks updated stories "(LEAD)", "(2nd LD)", "(URGENT)"; without the tag they also dedupe
const TITLE_TAG = /^\((?:LEAD|URGENT|\d+(?:st|nd|rd|th) LD|News Focus|Yonhap Interview|Yonhap Feature)\)\s*/i;
function imageOf(block) { // a story's picture: media:thumbnail, media:content, an image enclosure, or the first <img> in its text
  const attr = (t, a) => t.match(new RegExp(`\\b${a}=["']([^"']+)["']`, 'i'))?.[1];
  let best = '', bw = 0;
  for (const m of block.matchAll(/<(media:thumbnail|media:content|enclosure)\b([^>]*)>/gi)) {
    const u = attr(m[2], 'url'), type = attr(m[2], 'type') || '', medium = attr(m[2], 'medium') || '';
    if (!u || (m[1] !== 'media:thumbnail' && !/^image\//i.test(type) && medium !== 'image' && !/\.(jpe?g|png|webp)(\?|$)/i.test(u))) continue;
    const w = +(attr(m[2], 'width') || 0) || 480;
    if (!best || (w > bw && w <= 1200)) { best = u; bw = w; }
  }
  if (!best) best = decode(block).match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '';
  best = decode(best).trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(best) && best.length <= 400 ? best : '';
}
function parseFeed(xml) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const out = [];
  for (const b of blocks) {
    const title = text(tag(b, ['title'])).replace(TITLE_TAG, ''), link = linkOf(b);
    if (!title || !link) continue;
    out.push({ title, link, t: parseDate(text(tag(b, ['pubDate', 'dc:date', 'published', 'updated', 'a10:updated']))), desc: text(tag(b, ['description', 'summary', 'content:encoded', 'content'])),
      img: imageOf(b), src: text(tag(b, ['source'])) });
  }
  return out;
}
async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.byteLength > 6e6) throw new Error('feed too large');
  const head = new TextDecoder('latin1').decode(buf.subarray(0, 300));
  const enc = (r.headers.get('content-type') || '').match(/charset=["']?([\w-]+)/i)?.[1] || head.match(/encoding=["']([\w-]+)["']/i)?.[1] || 'utf-8';
  try { return new TextDecoder(enc.toLowerCase()).decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
}
const cleanUrl = u => { try { const x = new URL(u); x.hash = ''; for (const k of [...x.searchParams.keys()]) if (/^(utm_|at_|cmp|ito|ns_|xtor)/i.test(k)) x.searchParams.delete(k); return x.toString(); } catch { return u; } };
const titleKey = s => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
async function pool(list, n, fn) { // n sites in parallel, one request at a time per site
  const out = new Array(list.length), groups = new Map();
  list.forEach((x, k) => { const h = new URL(x[2]).hostname.replace(/^(www|rss|feeds|en|e)\./, ''); if (!groups.has(h)) groups.set(h, []); groups.get(h).push(k); });
  const queue = [...groups.values()];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => {
    while (queue.length) { const g = queue.shift(); for (const k of g) { out[k] = await fn(list[k], k); if (g.length > 1) await new Promise(r => setTimeout(r, 2000)); } }
  }));
  return out;
}

/* ---------- collect ---------- */
const now = Date.now();
const results = await pool(FEEDS, CONCURRENCY, async ([id, name, url, regions, country]) => {
  const t0 = Date.now();
  try { const items = parseFeed(await get(url)); return { id, name, regions, country, ok: items.length > 0, err: items.length ? '' : 'no items found', items, ms: Date.now() - t0 }; }
  catch (e) { return { id, name, regions, country, ok: false, err: String(e?.cause?.code || e?.message || e).slice(0, 120), items: [], ms: Date.now() - t0 }; }
});

const sources = results.map(r => ({ id: r.id, name: r.name, regions: r.regions.split(' '), country: r.country || null, ok: r.ok, n: 0, ...(r.ok ? {} : { err: r.err }) }));
const items = [], byKey = new Map();
results.forEach((r, si) => {
  let kept = 0;
  for (const it of r.items) {
    if (kept >= PER_FEED) break;
    let t = it.t;
    if (t != null && t > now + 10 * 60e3) t = now; // feeds with clocks in the future
    if (t != null && now - t > MAX_AGE_H * 3600e3) continue;
    if (t == null && kept >= 10) continue;
    const u = cleanUrl(it.link), k2 = titleKey(it.title), dup = byKey.get(u) || byKey.get(k2);
    if (dup) { if (!dup.s.includes(si)) dup.s.push(si); continue; }
    const rec = { t: clip(it.title, 220), u, s: [si], p: t == null ? null : Math.round(t / 1000), d: clip(it.desc, 160), i: it.img };
    if (!rec.d || titleKey(rec.d).startsWith(k2.slice(0, 40))) delete rec.d;
    if (!rec.i) delete rec.i;
    byKey.set(u, rec); byKey.set(k2, rec); items.push(rec); kept++;
  }
});
items.sort((a, b) => (b.p ?? 0) - (a.p ?? 0));
items.length = Math.min(items.length, MAX_ITEMS);
for (const it of items) for (const si of it.s) sources[si].n++;

const ok = sources.filter(s => s.ok).length;
for (const [i, r] of results.entries()) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(20)} ${String(sources[i].n).padStart(3)} kept / ${String(r.items.length).padStart(3)} parsed  ${String(r.ms).padStart(5)} ms  ${r.err || ''}`);
console.log(`${items.length} headlines from ${ok} of ${sources.length} sources`);
if (ok < MIN_OK) { console.error(`Only ${ok} sources answered, so the previous news.json is kept.`); process.exit(1); }

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ v: 1, generated: new Date(now).toISOString(), sources, items }));
console.log(`wrote ${OUT}`);

/* ---------- local news: Google News searches for cities and regions, in turns ---------- */
// Each place keeps its last search for up to a week, so a run only refreshes the places that are due:
// capitals every 4 hours, other big cities and regions every 8.
const LOCAL_QUERIES = process.env.LOCAL_QUERIES || 'data/local-queries.json', LOCAL_PREV = process.env.LOCAL_PREV || 'prev/local';
const LOCAL_OUT = join(dirname(OUT), 'local'), LOCAL_KEEP = 12, LOCAL_MAX_AGE_D = 7;
const NOT_NEWS = /^(?:Flightradar24|Robinhood|Coinbase|Kalshi|Polymarket|Facebook|Instagram|TikTok|LinkedIn|X|IMDb|Britannica|Wikipedia|Tripadvisor|Booking\.com|Expedia|Yelp|Zillow|Realtor\.com|Indeed|Glassdoor|Flashscore.*|LiveScore|SofaScore|FotMob|YouTube|Amazon|eBay|Etsy|Artsy|PR Newswire|GlobeNewswire|Business Wire|EIN Presswire|openPR.*|Newsfile|Morningstar|MarketScreener|Investing\.com|TradingView|Simply Wall St)$/i;
const NOT_A_STORY = /\b(?:Prediction Market|Moneyline|Betting Odds|Odds and Predictions|Live Score|Arrivals|Departures|Horoscope|Obituar(?:y|ies))\b/i;
async function localNews() {
  let Q;
  try { Q = JSON.parse(await readFile(LOCAL_QUERIES, 'utf8')).queries; } catch (e) { console.log(`no local searches (${e.message})`); return; }
  const prev = new Map(); // place key -> [fetched (s), items]
  try { for (const f of await readdir(LOCAL_PREV)) if (f.endsWith('.json')) for (const [k, v] of Object.entries(JSON.parse(await readFile(join(LOCAL_PREV, f), 'utf8')).places || {})) prev.set(k, v); }
  catch { /* first run */ }
  const nowS = Math.round(now / 1000), minP = nowS - LOCAL_MAX_AGE_D * 86400;
  const due = Q.map(q => ({ q, score: (nowS - (prev.get(q[0])?.[0] || 0)) / ((q[4] === 1 ? 4 : 8) * 3600) })).filter(x => x.score >= 1).sort((a, b) => b.score - a.score);
  const fresh = Q.filter(q => !prev.has(q[0])).length;
  const perRun = +process.env.LOCAL_PER_RUN || (fresh > Q.length / 2 ? 100 : 40); // fill faster after a reset
  let okN = 0, failN = 0, streak = 0, kept = 0;
  for (const { q: [key, query, ed] } of due.slice(0, perRun)) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-${ed}&gl=${ed}&ceid=${ed}:en`;
    try {
      const list = [], seen = new Set();
      for (const it of parseFeed(await get(url))) {
        const p = it.t == null ? null : Math.round(Math.min(it.t, now) / 1000);
        if (p == null || p < minP) continue;
        const src = it.src || '', title = clip(src && it.title.endsWith(' - ' + src) ? it.title.slice(0, -src.length - 3) : it.title, 220);
        if (NOT_NEWS.test(src) || NOT_A_STORY.test(title)) continue;
        const k2 = titleKey(title); if (seen.has(k2)) continue; seen.add(k2);
        list.push([title, it.link, src, p]);
      }
      list.sort((a, b) => b[3] - a[3]); list.length = Math.min(list.length, LOCAL_KEEP);
      prev.set(key, [nowS, list]); okN++; streak = 0; kept += list.length;
    } catch (e) {
      failN++; streak++; console.log(`local FAIL ${key} ${query}: ${e.message}`);
      if (/HTTP (429|503)/.test(e.message) || streak >= 3) { console.log('Google News is refusing searches; the rest wait for the next run'); break; }
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  const byCountry = new Map(), cc = new Map(Q.map(q => [q[0], q[3]]));
  for (const [k, [t, list]] of prev) {
    const c = cc.get(k); if (!c) continue; // a place no longer searched
    const l = list.filter(x => x[3] >= minP); if (!l.length && nowS - t > LOCAL_MAX_AGE_D * 86400) continue;
    if (!byCountry.has(c)) byCountry.set(c, {}); byCountry.get(c)[k] = [t, l];
  }
  await mkdir(LOCAL_OUT, { recursive: true });
  for (const [c, places] of byCountry) await writeFile(join(LOCAL_OUT, `${c}.json`), JSON.stringify({ v: 1, generated: new Date(now).toISOString(), places }));
  console.log(`local: ${okN} searches ok, ${failN} failed, ${kept} headlines; ${due.length} places were due; ${prev.size} of ${Q.length} places have results; ${byCountry.size} country files`);
}
await localNews();
