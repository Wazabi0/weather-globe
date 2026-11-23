// One-off probe run on a GitHub runner: compare Bing and Google News for local queries.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  const t0 = Date.now();
  try { const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const body = await r.text(); return { status: r.status, ms: Date.now() - t0, body };
  } catch (e) { return { status: 0, err: String(e).slice(0, 120), ms: Date.now() - t0, body: '' }; }
}
const items = xml => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
const field = (it, tag) => ((it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
const ageH = it => { const d = Date.parse(field(it, 'pubDate')); return isNaN(d) ? null : Math.round((Date.now() - d) / 36e5); };
const Q = [['Lyon', 'France'], ['Gothenburg', 'Sweden'], ['Malmo', 'Sweden'], ['Ontario', 'Canada'], ['Perth', 'Australia'], ['Cordoba', 'Argentina'], ['Medellin', 'Colombia'],
  ['Bavaria', 'Germany'], ['Texas', ''], ['Kharkiv', 'Ukraine'], ['Mombasa', 'Kenya'], ['Busan', 'South Korea'], ['Surabaya', 'Indonesia'], ['Chiang Mai', 'Thailand'], ['Kerala', 'India'],
  ['Sicily', 'Italy'], ['Gauteng', 'South Africa'], ['Lagos', 'Nigeria'], ['Valencia', 'Spain'], ['Hyderabad', 'India'], ['Birmingham', 'England'], ['Tripoli', 'Libya'], ['Stockholm', 'Sweden'], ['Uppsala', 'Sweden'],
  ['Quebec', 'Canada'], ['Sao Paulo', 'Brazil'], ['Minas Gerais', 'Brazil'], ['Jalisco', 'Mexico'], ['Hokkaido', 'Japan'], ['Sichuan', 'China'], ['Punjab', 'Pakistan'], ['Darfur', 'Sudan'],
  ['Aleppo', 'Syria'], ['Basra', 'Iraq'], ['Tabriz', 'Iran'], ['Cusco', 'Peru'], ['Auckland', 'New Zealand'], ['Accra', 'Ghana'], ['Kinshasa', 'Congo'], ['Ulaanbaatar', 'Mongolia']];
const show = (label, r) => {
  const its = items(r.body); const ages = its.map(ageH).filter(x => x != null);
  console.log(`${r.status} ${String(r.ms).padStart(4)}ms n=${String(its.length).padStart(3)} newest=${ages.length ? Math.min(...ages) : '-'}h median=${ages.length ? ages.sort((a, b) => a - b)[ages.length >> 1] : '-'}h  ${label}`);
  for (const it of its.slice(0, 4)) console.log('      ·', field(it, 'title').slice(0, 110), '|', field(it, 'News:Source') || field(it, 'source'), '| img:', /News:Image|media:content|media:thumbnail/.test(it));
};
console.log('== Bing: "City" Country');
for (const [p, c] of Q) { show(`${p} ${c}`, await get(`https://www.bing.com/news/search?q=${encodeURIComponent(`"${p}"${c ? ' ' + c : ''}`)}&format=rss&setlang=en-US&cc=US`)); await sleep(1000); }
console.log('\n== Bing full sample item'); { const r = await get(`https://www.bing.com/news/search?q=${encodeURIComponent('"Lyon" France')}&format=rss`); console.log(items(r.body)[0]); }
console.log('\n== Google: "City" Country when:3d');
for (const [p, c] of Q.slice(0, 20)) { show(`${p} ${c}`, await get(`https://news.google.com/rss/search?q=${encodeURIComponent(`"${p}"${c ? ' ' + c : ''} when:3d`)}&hl=en-US&gl=US&ceid=US:en`)); await sleep(1000); }
console.log('\n== Bing sort by date');
for (const [p, c] of Q.slice(0, 6)) { show(`${p} ${c} (sortbydate)`, await get(`https://www.bing.com/news/search?q=${encodeURIComponent(`"${p}"${c ? ' ' + c : ''}`)}&format=rss&qft=sortbydate%3d%221%22`)); await sleep(1000); }
