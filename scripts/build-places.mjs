// Builds data/places.json: capitals, cities and first-level regions (states, provinces) for the
// globe's city markers and local news. Run it on a machine with internet access:
//   node scripts/build-places.mjs data/places.json
// Sources: GeoNames (cities1000, admin1CodesASCII, countryInfo, alternateNamesV2; CC BY 4.0) and the
// Natural Earth country names the globe uses (world-atlas countries-50m).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import readline from 'readline';

const OUT = process.argv[2] || 'data/places.json';
const TMP = process.env.PLACES_TMP || 'tmp-places';
fs.mkdirSync(TMP, { recursive: true });
const GN = 'https://download.geonames.org/export/dump/';
function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  execFileSync('curl', ['-sSfL', '--retry', '3', '-o', file, url], { stdio: 'inherit' });
  return file;
}
const unzip = (zip, member) => { const f = path.join(TMP, member); if (!fs.existsSync(f)) execFileSync('unzip', ['-o', '-q', zip, member, '-d', TMP]); return f; };
async function* lines(file) { const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity }); for await (const l of rl) yield l; }
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const DEG = Math.PI / 180;
const unit = (lat, lon) => [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)];
const gc = (a, b) => 6371 * Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const r2 = x => Math.round(x * 100) / 100;

// ---------- inputs ----------
const citiesTxt = unzip(download(GN + 'cities1000.zip', path.join(TMP, 'cities1000.zip')), 'cities1000.txt');
const admin1Txt = download(GN + 'admin1CodesASCII.txt', path.join(TMP, 'admin1CodesASCII.txt'));
const countryTxt = download(GN + 'countryInfo.txt', path.join(TMP, 'countryInfo.txt'));
const altZip = download(GN + 'alternateNamesV2.zip', path.join(TMP, 'alternateNamesV2.zip'));
const atlasFile = download('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json', path.join(TMP, 'countries-50m.json'));

// Natural Earth names by ISO 3166-1 numeric code, as the globe's country shapes use them
const atlas = JSON.parse(fs.readFileSync(atlasFile, 'utf8'));
const neByNum = new Map(), neNames = new Set();
for (const g of atlas.objects.countries.geometries) { const n = g.properties?.name; if (!n) continue; neNames.add(n); if (g.id != null && g.id !== '-99') neByNum.set(+g.id, n); }

const countries = new Map(); // ISO2 -> { name, ne, pop, capital }
for await (const l of lines(countryTxt)) {
  if (!l || l.startsWith('#')) continue;
  const f = l.split('\t'); const iso = f[0], num = +f[2], name = f[4], area = +f[6], pop = +f[7];
  let ne = neByNum.get(num) || (neNames.has(name) ? name : null);
  if (iso === 'XK') ne = 'Kosovo';
  countries.set(iso, { name, ne, pop, area });
}

const admin1 = new Map(); // 'CC.code' -> { name, ascii, gid }
for await (const l of lines(admin1Txt)) { const [code, name, ascii, gid] = l.split('\t'); if (code) admin1.set(code, { name, ascii, gid: +gid }); }

const all = []; // every populated place in cities1000
for await (const l of lines(citiesTxt)) {
  const f = l.split('\t'); if (f.length < 15) continue;
  all.push({ gid: +f[0], name: f[1], ascii: f[2], lat: +f[4], lon: +f[5], fc: f[7], cc: f[8], a1: f[8] + '.' + f[10], pop: +f[14] });
}
console.log('cities1000', all.length, 'admin1', admin1.size, 'countries', countries.size);

// ---------- capitals ----------
// GeoNames marks capitals PPLC and other seats of government PPLG. A few need a hand.
const CAPITAL_FIX = { IL: ['Jerusalem'], PS: ['Ramallah'], BO: ['Sucre', 'La Paz'], NL: ['Amsterdam', 'The Hague'], ZA: ['Pretoria', 'Cape Town', 'Bloemfontein'],
  CI: ['Yamoussoukro', 'Abidjan'], MY: ['Kuala Lumpur', 'Putrajaya'], LK: ['Sri Jayewardenepura Kotte', 'Colombo'], BJ: ['Porto-Novo', 'Cotonou'] };
const capitalOf = new Map(); // gid -> 1 capital, 2 seat of government
for (const c of all) if (c.fc === 'PPLC') capitalOf.set(c.gid, 1);
for (const [cc, names] of Object.entries(CAPITAL_FIX)) {
  for (const c of all) if (c.cc === cc && capitalOf.get(c.gid) === 1 && !names.includes(c.name)) capitalOf.delete(c.gid);
  names.forEach((n, i) => {
    const m = all.filter(c => c.cc === cc && (c.name === n || c.ascii === n)).sort((a, b) => b.pop - a.pop)[0];
    if (m) capitalOf.set(m.gid, i ? 2 : 1); else console.warn('capital not found', cc, n);
  });
}

// ---------- regions ----------
const byRegion = new Map();
for (const c of all) { if (!admin1.has(c.a1)) continue; (byRegion.get(c.a1) || byRegion.set(c.a1, []).get(c.a1)).push(c); }

// ---------- which countries have a useful first level (states, provinces, counties) ----------
// Small countries, and those whose first level is hundreds of municipalities (Slovenia, Latvia), get cities only.
const regionLevel = new Set();
{ const n = new Map(); for (const code of byRegion.keys()) { const cc = code.slice(0, 2); n.set(cc, (n.get(cc) || 0) + 1); }
  for (const [cc, k] of n) { const C = countries.get(cc); if (C?.ne && k >= 2 && C.area >= 30000 && (k <= 50 || (k <= 90 && C.area > 250000))) regionLevel.add(cc); } }
console.log('countries with regions', regionLevel.size);

// ---------- which cities get names on the map ----------
const named = new Map();
for (const c of all) {
  const cap = capitalOf.get(c.gid) || 0;
  if (cap || c.pop >= 150000 || (c.fc === 'PPLA' && c.pop >= 50000)) named.set(c.gid, c);
}
for (const [code, list] of byRegion) { if (!regionLevel.has(code.slice(0, 2))) continue; const top = list.reduce((a, b) => (b.pop > a.pop ? b : a)); if (top.pop >= 10000) named.set(top.gid, top); }
console.log('named cities', named.size);

// ---------- English names ----------
const wanted = new Set([...named.keys(), ...[...admin1.values()].map(a => a.gid)]);
const en = new Map(); // gid -> [{n, pref, short}]
{
  const altTxt = unzip(altZip, 'alternateNamesV2.txt');
  for await (const l of lines(altTxt)) {
    const f = l.split('\t'); const gid = +f[1];
    if (f[2] !== 'en' || !wanted.has(gid) || f[6] === '1' || f[7] === '1') continue;
    (en.get(gid) || en.set(gid, []).get(gid)).push({ n: f[3], pref: f[4] === '1', short: f[5] === '1' });
  }
}
const okAlias = s => s && s.length >= 3 && s.length <= 32 && !/[\d()\/,;]/.test(s) && /^[\p{L}\p{M}' .\-’]+$/u.test(s);
const KNOWN_ALIASES = { Bengaluru: ['Bangalore'], 'Ho Chi Minh City': ['Saigon'], Kyiv: ['Kiev'], Odesa: ['Odessa'], Kharkiv: ['Kharkov'], 'New York City': ['New York', 'NYC'],
  Almaty: ['Alma-Ata'], Astana: ['Nur-Sultan'], Ulaanbaatar: ['Ulan Bator'], 'Mexico City': ['CDMX'], Gurugram: ['Gurgaon'], Chisinau: ['Kishinev'], Yangon: ['Rangoon'] };
const SUFFIX = / (?:Region|Province|Department|Governorate|Prefecture|District|Municipality|Voivodeship)$/;
function namesFor(gid, base, ascii, cityNames) {
  const e = (en.get(gid) || []).filter(x => okAlias(x.n));
  const pref = e.find(x => x.pref);
  let display = pref ? pref.n : base;
  if (SUFFIX.test(display) && fold(display.replace(SUFFIX, '')) === fold(base) && !cityNames?.has(fold(base))) display = base; // "Île-de-France Region" -> "Île-de-France"
  const seen = new Set([fold(display)]), aliases = [];
  const add = n => { if (!okAlias(n)) return; const k = fold(n); if (seen.has(k)) return; seen.add(k); aliases.push(n); };
  add(base); add(ascii);
  for (const n of KNOWN_ALIASES[display] || []) add(n);
  for (const x of e) if (fold(x.n).slice(0, 3) === fold(display).slice(0, 3) && !fold(x.n).includes(' of ')) add(x.n); // Kiev, Malmoe, but not nicknames
  return { display, aliases: aliases.slice(0, 4) };
}
const cityNamesIn = new Map(); // country -> folded names of its bigger towns
for (const c of all) if (c.pop >= 50000) (cityNamesIn.get(c.cc) || cityNamesIn.set(c.cc, new Set()).get(c.cc)).add(fold(c.name));

// Regions: label at the mean position of their towns, size from how far the towns spread
const REGION_QUERY = new Set(['US', 'CA', 'AU', 'IN', 'BR', 'MX', 'NG', 'DE', 'GB', 'PK', 'ZA', 'CN', 'IT', 'ES', 'FR']);
const regions = [], regionIdx = new Map();
for (const [code, a] of admin1) {
  const list = byRegion.get(code); if (!list?.length) continue;
  const cc = code.slice(0, 2), C = countries.get(cc); if (!C?.ne || !regionLevel.has(cc)) continue;
  let x = 0, y = 0, z = 0; for (const c of list) { const u = unit(c.lat, c.lon); x += u[0]; y += u[1]; z += u[2]; }
  const m = Math.hypot(x, y, z), cu = [x / m, y / m, z / m];
  const lat = Math.asin(cu[2]) / DEG, lon = Math.atan2(cu[1], cu[0]) / DEG;
  const d = list.map(c => gc(cu, unit(c.lat, c.lon))).sort((p, q) => p - q);
  const radius = Math.round(d[Math.floor(d.length * 0.9)] || 20);
  const pop = list.reduce((s, c) => s + c.pop, 0);
  let { display, aliases } = namesFor(a.gid, a.name, a.ascii, cityNamesIn.get(cc));
  if (display.length > 32) display = a.name;
  regionIdx.set(code, regions.length);
  regions.push({ code, cc, display, aliases, lat, lon, radius, pop });
}
console.log('regions', regions.length);

// ---------- local news queries (Google News search, run in turns by the news collector) ----------
const EDITIONS = new Set(['US', 'GB', 'CA', 'AU', 'IN', 'IE', 'NZ', 'ZA', 'NG', 'KE', 'GH', 'PK', 'PH', 'SG', 'MY', 'UG', 'ZW', 'BW', 'NA', 'TZ', 'ET']);
const QUERY_FIX = { 'US.GA': '"Georgia" Atlanta', 'US.WA': '"Washington state"', 'US.NY': '"New York state"', 'US.DC': null };
function query(name, cc, key) {
  if (key in QUERY_FIX) return QUERY_FIX[key];
  const C = countries.get(cc); const ed = EDITIONS.has(cc) ? cc : 'US';
  const cn = C.name; const f = fold(name), fc = fold(cn);
  const q = `"${name}"` + (ed === cc || f.includes(fc) || fc.includes(f) ? '' : ` ${cn}`);
  return [q, ed];
}

const cities = [], queries = [];
const cityNamesByCountry = new Map();
for (const c of [...named.values()].sort((a, b) => b.pop - a.pop)) {
  if (!countries.get(c.cc)?.ne) continue;
  const { display, aliases } = namesFor(c.gid, c.name, c.ascii);
  const cap = capitalOf.get(c.gid) || 0;
  const ri = regionIdx.has(c.a1) ? regionIdx.get(c.a1) : -1;
  const isSeat = c.fc === 'PPLA';
  const big = c.pop >= 1e6, capQ = cap && (countries.get(c.cc).pop >= 200000 || c.pop >= 50000);
  let flags = (cap === 1 ? 1 : 0) | (cap === 2 ? 2 : 0) | (isSeat ? 4 : 0);
  if (big || capQ) { const q = query(display, c.cc, String(c.gid)); if (q) { flags |= 8; queries.push([String(c.gid), q[0] + ' when:3d', q[1], c.cc, cap ? 1 : 2]); } }
  cities.push([flags & 8 ? c.gid : 0, display, c.cc, ri, r2(c.lat), r2(c.lon), Math.round(c.pop / 1000), flags, aliases.join('|')]); // the GeoNames id keys the local news files
  (cityNamesByCountry.get(c.cc) || cityNamesByCountry.set(c.cc, new Set()).get(c.cc)).add(fold(display));
}
for (const r of regions) {
  if (!REGION_QUERY.has(r.cc) || r.pop < 300000) continue;
  if (cityNamesByCountry.get(r.cc)?.has(fold(r.display))) continue; // a city of the same name already has its own search
  const q = query(r.display, r.cc, r.code); if (!q) continue;
  r.query = true; queries.push([r.code, q[0] + ' when:3d', q[1], r.cc, 2]);
}
console.log('queries', queries.length, 'cities flagged', cities.filter(c => c[7] & 8).length, 'regions flagged', regions.filter(r => r.query).length);

// ---------- dense points for "which region is this?" (nearest town with a known region) ----------
const gridPts = all.filter(c => (c.pop >= 20000 || named.has(c.gid)) && regionIdx.has(c.a1));
const buf = Buffer.alloc(gridPts.length * 6);
gridPts.forEach((c, i) => { buf.writeInt16LE(Math.round(c.lat * 100), i * 6); buf.writeInt16LE(Math.round(c.lon * 100), i * 6 + 2); buf.writeUInt16LE(regionIdx.get(c.a1), i * 6 + 4); });

const cc2ne = {}; for (const [iso, C] of countries) if (C.ne) cc2ne[iso] = C.ne;
const out = {
  v: 1, generated: new Date().toISOString(),
  credit: 'GeoNames (geonames.org, CC BY 4.0); country names from Natural Earth',
  countries: cc2ne,
  regions: regions.map(r => [r.code, r.display, r2(r.lat), r2(r.lon), r.radius, r.query ? 1 : 0, r.aliases.join('|')]),
  cities,
  grid: buf.toString('base64'),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const QOUT = path.join(path.dirname(OUT), 'local-queries.json');
fs.writeFileSync(QOUT, JSON.stringify({ v: 1, generated: out.generated, note: 'Google News searches the news collector runs in turns: [place key (GeoNames id or region code), query, edition, country, 1 capital / 2 other]', queries }));
const size = fs.statSync(OUT).size;
console.log('wrote', OUT, (size / 1024).toFixed(0), 'KB (regions', (JSON.stringify(out.regions).length / 1024).toFixed(0), 'KB, cities', (JSON.stringify(out.cities).length / 1024).toFixed(0), 'KB, grid', (out.grid.length / 1024).toFixed(0), 'KB) and', QOUT, (fs.statSync(QOUT).size / 1024).toFixed(0), 'KB;', 'grid points', gridPts.length, 'capitals', cities.filter(c => c[7] & 3).length);
console.log('sample capitals', cities.filter(c => c[7] & 3).slice(0, 25).map(c => `${c[1]}/${c[2]}`).join(', '));
console.log('sample queries', queries.slice(0, 12).map(q => q.join(' ~ ')).join('\n  '));
console.log('region-level countries', [...regionLevel].sort().join(' '));
for (const n of ['Gothenburg', 'Cologne', 'Munich', 'Kyiv', 'Bengaluru', 'Bangalore', 'Mumbai', 'Geneva', 'Antwerp', 'Seville', 'Ho Chi Minh City', 'Washington', 'Jerusalem', 'Ramallah', 'Lyon', 'Malmö'])
  console.log('  ', n, JSON.stringify(cities.find(c => c[1] === n || c[8].split('|').includes(n)) || null));
for (const n of ['Bavaria', 'Stockholm', 'Stockholm County', 'Île-de-France', 'England', 'Scotland', 'California', 'Texas', 'Kerala', 'Punjab', 'Victoria', 'Ontario', 'Catalonia', 'Sicily'])
  console.log('  ', n, JSON.stringify(out.regions.filter(r => r[1] === n || r[6].split('|').includes(n)).slice(0, 3)));
