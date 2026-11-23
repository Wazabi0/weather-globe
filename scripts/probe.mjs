// One-off probe run on a GitHub runner: which data and media sources answer from GitHub's network.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, opt = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.8', ...(opt.headers || {}) }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const body = opt.head ? '' : await r.text();
    return { status: r.status, url: r.url, ms: Date.now() - t0, body, len: body.length, type: r.headers.get('content-type') };
  } catch (e) { return { status: 0, err: String(e).slice(0, 120), ms: Date.now() - t0, body: '' }; }
}
const titles = xml => [...xml.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/g)].map(m => m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
const log = (...a) => console.log(...a);

log('== GeoNames and Natural Earth');
for (const u of ['https://download.geonames.org/export/dump/admin1CodesASCII.txt', 'https://download.geonames.org/export/dump/cities15000.zip', 'https://download.geonames.org/export/dump/countryInfo.txt',
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson']) {
  const r = await get(u, { head: u.endsWith('.zip') || u.endsWith('.geojson') }); log(r.status, r.type, r.len, r.ms + 'ms', u);
}

log('== Google News RSS');
const places = ['Lyon', 'Gothenburg', 'Texas', 'Bavaria', 'Mumbai', 'Lagos', 'Osaka', 'Queensland', 'Kharkiv', 'Medellin', 'Ontario', 'Kerala', 'Malmo', 'Marseille', 'Chiang Mai', 'Cordoba', 'Mombasa', 'Busan', 'Surabaya', 'Perth'];
for (const [i, p] of places.entries()) {
  const u = `https://news.google.com/rss/search?q=${encodeURIComponent('"' + p + '" when:2d')}&hl=en-US&gl=US&ceid=US:en`;
  const r = await get(u); const t = titles(r.body);
  log(r.status, r.ms + 'ms', 'items', t.length, p, '|', t.slice(0, 3).join(' || ').slice(0, 300));
  if (i === 0) log('   sample item:', (r.body.match(/<item>[\s\S]*?<\/item>/) || [''])[0].slice(0, 900));
  await sleep(1500);
}
{ const r = await get('https://news.google.com/rss/headlines/section/geo/Lyon?hl=en-US&gl=US&ceid=US:en'); log('geo section', r.status, 'items', titles(r.body).length, titles(r.body).slice(0, 3).join(' || ').slice(0, 250)); }

log('== Bing News RSS');
for (const p of ['Lyon', 'Gothenburg', 'Texas']) {
  const r = await get(`https://www.bing.com/news/search?q=${encodeURIComponent(p)}&format=rss`); const t = titles(r.body);
  log(r.status, r.ms + 'ms', 'items', t.length, p, '|', t.slice(0, 3).join(' || ').slice(0, 250));
  if (p === 'Lyon') log('   sample item:', (r.body.match(/<item>[\s\S]*?<\/item>/) || [''])[0].slice(0, 900));
  await sleep(1500);
}

log('== RSS image fields in current feeds');
for (const u of ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://www.aljazeera.com/xml/rss/all.xml', 'https://www.theguardian.com/world/rss', 'https://rss.dw.com/rdf/rss-en-world', 'https://www.france24.com/en/rss', 'https://feeds.npr.org/1004/rss.xml']) {
  const r = await get(u); const it = (r.body.match(/<item[\s>][\s\S]*?<\/item>/) || [''])[0];
  const img = it.match(/<(media:thumbnail|media:content|enclosure)[^>]*>/g) || [];
  log(r.status, u, '| image tags:', img.slice(0, 2).join(' ').slice(0, 300) || 'none', '| img in description:', /<img/i.test(it));
}

log('== YouTube live channels');
const CH = { 'Al Jazeera English': 'UCNye-wNBqNL5ZzHSJj3l8Bg', 'DW News': 'UCknLrEdhRCp1aegoMqRaCZg', 'France 24 English': 'UCQfwfsi5VrQ8yKZ-UWmAEFg', 'Sky News': 'UCoMdktPbSTixAyNGwb-UYkQ',
  'NHK World': 'UCSPEjw8F2nQDtmUKPFNF7_A', 'ABC News Australia': 'UCVgO39Bk5sMo66-6o6Spn6Q', 'CNA': 'UC83jt4dlz1Gjl58fzQrrKZg', 'TRT World': 'UC7fWeaHhqgM4Ry-RMpM2YYw', 'Euronews': 'UCSrZ3UV4jOidv8ppoVuvW9Q',
  'WION': 'UC_gUM8rL-Lrg6O3adPW9K1g', 'CGTN': 'UCgrNz-aDmcr2uuto8_DL2jg', 'Bloomberg': 'UCIALMKvObZNtJ6AmdCLP7Lg', 'ABC News US': 'UCBi2mrWuNuyYy4gbM6fU18Q', 'NBC News': 'UCeY0bbntWzzVIaj2z3QigXg',
  'CBS News': 'UC8p1vwvWtl6T73JiExfWs1g', 'LiveNOW from FOX': 'UCJg9wBPyKMNA5sRDnvzmkdg', 'Africanews': 'UC1_E8NeF5QHY2dtdLRBCCLA', 'Channels TV': 'UCEXGDNclvmg6RW0vipJYsTQ', 'SABC News': 'UC8yH-uI81UUtEMDsowQyx1g',
  'NDTV': 'UCZFMm1mMw0F81Z37aaEzTUA', 'India Today': 'UCYPvAwZP8pZhSMW8qs7cVCw', 'Global News': 'UChLtXXpo4Ge1ReTEboVvTDg', 'CBC News': 'UCuFFtHWoLl5fauMMD5Ww2jA', 'AP': 'UC52X5wxOL_s5yw0dQk7NtgA',
  'Reuters': 'UChqUTb7kYRX8-EiaN3XFrSQ', 'i24NEWS English': 'UCvHDpsWKADrDia0c99X37vg', 'teleSUR English': 'UCmuTmpLY35O3csvhyA6vrkg', 'Arirang News': 'UCHuIhXv0pVVAFZsd2vnAhvA', 'KBS News': 'UCcQTRi69dsVYHN3exePtZ1A',
  '9 News Australia': 'UCIYLOcEUX6TbBo7HQVF2PKA', 'GB News': 'UC0vn8ISa4LKMunLbzaXLnOQ', 'Times Now': 'UC6RJ7-PaXg6TIH2BzZfTV7w', 'NTV Kenya': 'UCqBJ47FjJcl61fmSbcadAVg', 'Citizen TV Kenya': 'UChBQgieUidXV1CmDxSdRm3g',
  'TVP World': 'UCMxW0IRLaSFIdEKjDwvwdNw', 'Al Arabiya English': 'UCIJXOvggjKtCagMfxvcCzAA', 'ARY News': 'UCMmpLL2ucRHAXbNHiCPyIyg', 'Geo News': 'UC_vt34wimdCzdkrzVejwX9g', 'Kyiv Independent': 'UCfGOBYdlkmA7wtIXPPOCzUg' };
for (const [name, id] of Object.entries(CH)) {
  const r = await get(`https://www.youtube.com/channel/${id}/live`);
  const b = r.body;
  const t = (b.match(/<meta property="og:title" content="([^"]*)"/) || b.match(/<title>([^<]*)<\/title>/) || [])[1];
  const canon = (b.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  const owner = (b.match(/"ownerChannelName":"([^"]*)"/) || b.match(/"author":"([^"]*)"/) || [])[1];
  log(r.status, name, id, '| title:', (t || '').slice(0, 70), '| owner:', owner, '| canonical:', canon, '| live:', /"isLiveNow":true/.test(b), '| embed:', (b.match(/"playableInEmbed":(true|false)/) || [])[1], '| consent:', /consent\.youtube|before you continue/i.test(b));
  await sleep(800);
}

log('== Wikipedia, USGS, GIBS, Launch Library (sanity)');
for (const u of ['https://en.wikipedia.org/api/rest_v1/page/summary/Kanlaon', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson',
  'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=VIIRS_SNPP_CorrectedReflectance_TrueColor&CRS=EPSG:4326&BBOX=9,122,12,125&WIDTH=256&HEIGHT=256&FORMAT=image/jpeg&TIME=2026-11-20',
  'https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&TIME=2026-11-20&BBOX=9,122,12,125&CRS=EPSG:4326&LAYERS=VIIRS_SNPP_CorrectedReflectance_TrueColor&FORMAT=image/jpeg&WIDTH=256&HEIGHT=256']) {
  const r = await get(u); log(r.status, r.type, r.len, r.ms + 'ms', u.slice(0, 120));
}
{ const r = await get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson'); try { const j = JSON.parse(r.body); const f = j.features[0]; log('USGS first', f?.id, f?.properties?.title, f?.properties?.detail);
  if (f) { const d = await get(f.properties.detail); const dj = JSON.parse(d.body); const sm = dj.properties.products?.shakemap?.[0]; log('  shakemap', !!sm, sm && Object.keys(sm.contents).filter(k => /intensity|pga/.test(k)).slice(0, 6).join(', '), sm?.contents?.['download/intensity.jpg']?.url); } } catch (e) { log('usgs parse', e.message); } }
