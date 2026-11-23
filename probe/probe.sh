#!/usr/bin/env bash
# Checks the media sources the event window will use, from a GitHub runner (the build sandbox can't reach them)
set -u
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
REF='https://wazabi0.github.io/'
Y=$(date -u -d yesterday +%F); T=$(date -u +%F); W=$(date -u -d '7 days ago' +%F)
echo "today $T yesterday $Y week $W"
echo "== GIBS WMS capabilities"
curl -s -A "$UA" 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0' -o caps.xml; ls -la caps.xml
for L in VIIRS_SNPP_CorrectedReflectance_TrueColor VIIRS_NOAA20_CorrectedReflectance_TrueColor VIIRS_NOAA21_CorrectedReflectance_TrueColor MODIS_Terra_CorrectedReflectance_TrueColor MODIS_Aqua_CorrectedReflectance_TrueColor VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1 VIIRS_NOAA20_CorrectedReflectance_BandsM11-I2-I1 VIIRS_NOAA21_CorrectedReflectance_BandsM11-I2-I1 VIIRS_SNPP_Thermal_Anomalies_375m_All VIIRS_NOAA20_Thermal_Anomalies_375m_All VIIRS_NOAA21_Thermal_Anomalies_375m_All MODIS_Combined_Thermal_Anomalies_All Reference_Labels_15m Reference_Features_15m Coastlines_15m; do
  python3 - "$L" <<'PY'
import sys,re
L=sys.argv[1]; x=open('caps.xml',encoding='utf-8',errors='ignore').read()
m=re.search(r'<Layer[^>]*>\s*<Name>'+re.escape(L)+r'</Name>(.*?)</Layer>',x,re.S)
if not m: print(f'{L}: MISSING'); sys.exit()
d=re.search(r'<Dimension[^>]*name="time"[^>]*default="([^"]*)"[^>]*>([^<]*)<',m.group(1))
fm=re.findall(r'<Format>([^<]+)</Format>',m.group(1))
print(f'{L}: ok default={d.group(1) if d else "-"} extent_tail={(d.group(2)[-60:] if d else "-")} formats={fm[:3]}')
PY
done
gm() { curl -s -A "$UA" -e "$REF" -o "$2" -w "%{http_code} %{content_type} %{size_download}B" "$1"; echo " <- $2"; }
B='https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&STYLES=&CRS=EPSG:4326&WIDTH=800&HEIGHT=450'
# Tokyo bay area 3 deg tall, Sahara (always clear), Lagos
gm "$B&LAYERS=VIIRS_SNPP_CorrectedReflectance_TrueColor&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$Y" snpp_tokyo_y.jpg
gm "$B&LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$Y" n20_tokyo_y.jpg
gm "$B&LAYERS=VIIRS_NOAA21_CorrectedReflectance_TrueColor&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$Y" n21_tokyo_y.jpg
gm "$B&LAYERS=VIIRS_SNPP_CorrectedReflectance_TrueColor&BBOX=20,5,26,15.7&FORMAT=image/jpeg&TIME=$Y" snpp_sahara_y.jpg
gm "$B&LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor&BBOX=20,5,26,15.7&FORMAT=image/jpeg&TIME=$Y" n20_sahara_y.jpg
gm "$B&LAYERS=VIIRS_NOAA21_CorrectedReflectance_TrueColor&BBOX=20,5,26,15.7&FORMAT=image/jpeg&TIME=$Y" n21_sahara_y.jpg
gm "$B&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&BBOX=20,5,26,15.7&FORMAT=image/jpeg&TIME=$Y" terra_sahara_y.jpg
gm "$B&LAYERS=VIIRS_SNPP_CorrectedReflectance_TrueColor&BBOX=20,5,26,15.7&FORMAT=image/jpeg&TIME=$T" snpp_sahara_t.jpg
gm "$B&LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor&BBOX=20,5,26,15.7&FORMAT=image/jpeg&TIME=$T" n20_sahara_t.jpg
gm "$B&LAYERS=VIIRS_NOAA20_CorrectedReflectance_BandsM11-I2-I1&BBOX=20,5,26,15.7&FORMAT=image/jpeg&TIME=$Y" n20_false_sahara_y.jpg
gm "$B&LAYERS=VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1&BBOX=20,5,26,15.7&FORMAT=image/jpeg&TIME=$Y" snpp_false_sahara_y.jpg
gm "$B&LAYERS=VIIRS_NOAA20_Thermal_Anomalies_375m_All&BBOX=-15,-60,-5,-45&FORMAT=image/png&TRANSPARENT=TRUE&TIME=$Y" n20_fires_brazil.png
gm "$B&LAYERS=VIIRS_SNPP_Thermal_Anomalies_375m_All&BBOX=-15,-60,-5,-45&FORMAT=image/png&TRANSPARENT=TRUE&TIME=$Y" snpp_fires_brazil.png
gm "$B&LAYERS=Reference_Labels_15m&BBOX=34,135.5,37,140.9&FORMAT=image/png&TRANSPARENT=TRUE" labels_tokyo.png
gm "$B&LAYERS=Coastlines_15m&BBOX=34,135.5,37,140.9&FORMAT=image/png&TRANSPARENT=TRUE" coast_tokyo.png
gm "$B&LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor,Reference_Labels_15m&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$Y" multi_tokyo.jpg
gm "$B&LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor&BBOX=-10,-200,10,-160&FORMAT=image/jpeg&TIME=$Y" n20_dateline.jpg
python3 -m pip install -q pillow >/dev/null 2>&1 && python3 - <<'PY'
from PIL import Image, ImageStat; import glob
for f in sorted(glob.glob('*.jpg')+glob.glob('*.png')):
    try:
        im=Image.open(f); st=ImageStat.Stat(im.convert('RGB')); a=None
        if im.mode in('RGBA','LA','P'): a=sum(1 for p in im.convert('RGBA').getdata() if p[3]>0)
        print(f, im.size, im.mode, 'mean', [round(x) for x in st.mean], 'opaque px', a)
    except Exception as e: print(f, 'ERR', e, open(f,'rb').read(200))
PY
echo "== Wikipedia page images (CORS)"
curl -s -A "$UA" -H 'Origin: https://wazabi0.github.io' -D - 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&prop=pageimages|description&piprop=thumbnail|name&pithumbsize=480&titles=Kanlaon|Ebola|Kharkiv|Falcon%209|Hurricane%20Melissa' | grep -iE '^(HTTP|access-control-allow-origin)|"pages"' | cut -c1-1500
echo "== Commons geosearch (CORS)"
curl -s -A "$UA" -H 'Origin: https://wazabi0.github.io' -D - 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&generator=geosearch&ggscoord=38.27|140.87&ggsradius=10000&ggsnamespace=6&ggslimit=12&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=480&iiextmetadatafilter=Artist|LicenseShortName|ObjectName|DateTimeOriginal|ImageDescription' -o commons.json; head -c 300 commons.json; echo; python3 -c "
import json;d=json.load(open('commons.json'));ps=d.get('query',{}).get('pages',[]);print(len(ps),'pages')
for p in ps[:4]:
  ii=p.get('imageinfo',[{}])[0];em=ii.get('extmetadata',{});print(p['title'][:70],ii.get('mime'),ii.get('thumburl','')[:110],'|',em.get('Artist',{}).get('value','')[:80],'|',em.get('LicenseShortName',{}).get('value',''),'|',p.get('index'))
"
echo "== USGS significant + detail"
curl -s -A "$UA" -H 'Origin: https://wazabi0.github.io' -D - 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson' -o sig.json | grep -i 'access-control'; python3 - <<'PY'
import json,subprocess
d=json.load(open('sig.json')); fs=d['features'][:3]
for f in fs:
    p=f['properties']; print(p['mag'],p['place'],p['url'],p.get('detail'))
    j=json.loads(subprocess.run(['curl','-s',p['detail']],capture_output=True,text=True).stdout)
    pr=j['properties'].get('products',{}); print('  products', sorted(pr.keys())[:30])
    sm=pr.get('shakemap',[{}])[0].get('contents',{}); print('  shakemap keys', [k for k in sm if k.endswith('.jpg') or k.endswith('.png')][:12])
    if 'download/intensity.jpg' in sm: print('  intensity', sm['download/intensity.jpg']['url'])
    pg=pr.get('losspager',[{}])[0].get('contents',{}); print('  pager imgs', [k for k in pg if k.endswith('.png') or k.endswith('.jpg')][:10])
    dy=pr.get('dyfi',[{}])[0].get('contents',{}); print('  dyfi imgs', [k for k in dy if k.endswith('.png') or k.endswith('.jpg')][:10])
PY
echo "== Launch Library list + detail"
curl -s -A "$UA" -H 'Origin: https://wazabi0.github.io' -D ll.h 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=5&hide_recent_previous=true' -o ll.json; grep -iE '^(HTTP|access-control-allow-origin|x-ratelimit|retry)' ll.h
python3 - <<'PY'
import json,subprocess
d=json.load(open('ll.json'))
for r in d.get('results',[])[:5]: print(r['id'], r['name'], '| image:', str(r.get('image'))[:120], '| webcast_live:', r.get('webcast_live'), '| keys has vidURLs:', 'vidURLs' in r)
if d.get('results'):
    rid=d['results'][0]['id']; j=json.loads(subprocess.run(['curl','-s',f'https://ll.thespacedevs.com/2.2.0/launch/{rid}/'],capture_output=True,text=True).stdout)
    print('detail vidURLs', json.dumps(j.get('vidURLs'))[:800]); print('detail image', j.get('image'))
PY
curl -s -A "$UA" 'https://ll.thespacedevs.com/2.2.0/launch/previous/?limit=8' -o llp.json; python3 -c "
import json,subprocess;d=json.load(open('llp.json'))
for r in d.get('results',[])[:3]:
  j=json.loads(subprocess.run(['curl','-s','https://ll.thespacedevs.com/2.2.0/launch/'+r['id']+'/'],capture_output=True,text=True).stdout); print(r['name'],'| vid:',[ (v.get('url'),v.get('publisher'),v.get('type',{}).get('name') if isinstance(v.get('type'),dict) else v.get('type')) for v in (j.get('vidURLs') or [])][:4])
"
echo "== Sun and aurora images (with a github.io referer)"
for U in https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0193.jpg https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0304.jpg https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0193.jpg https://soho.nascom.nasa.gov/data/realtime/c3/1024/latest.jpg https://soho.nascom.nasa.gov/data/realtime/c2/1024/latest.jpg https://soho.nascom.nasa.gov/data/realtime/c3/512/latest.jpg https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg https://services.swpc.noaa.gov/images/animations/ovation/south/latest.jpg https://services.swpc.noaa.gov/images/swx-overview-large.gif; do
  curl -s -A "$UA" -e "$REF" -o /dev/null -w "%{http_code} %{content_type} %{size_download}B $U\n" -D - "$U" | grep -iE '^(last-modified|HTTP)|B https' | tr '\n' ' '; echo
done
echo "== Worldview"
curl -s -A "$UA" -o /dev/null -w "%{http_code}\n" 'https://worldview.earthdata.nasa.gov/?v=135,34,141,37&t=2026-11-20&l=VIIRS_SNPP_CorrectedReflectance_TrueColor'
