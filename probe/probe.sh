#!/usr/bin/env bash
# Second pass: how reliable GIBS WMS is per layer, and the WMTS fallbacks
set -u
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
REF='https://wazabi0.github.io/'
Y=$(date -u -d yesterday +%F); T=$(date -u +%F); W=$(date -u -d '6 days ago' +%F)
B='https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&STYLES=&CRS=EPSG:4326&WIDTH=800&HEIGHT=450'
try() { local ok=0 bad=0 sizes=""; for i in 1 2 3 4 5 6; do r=$(curl -s -A "$UA" -e "$REF" -o /tmp/x -w "%{content_type} %{size_download}" "$1&_r=$i$RANDOM"); case "$r" in image/*) ok=$((ok+1)); sizes="$sizes ${r#* }";; *) bad=$((bad+1)); sizes="$sizes ERR";; esac; done; echo "$2: ok=$ok bad=$bad [$sizes ]"; }
try "$B&LAYERS=VIIRS_NOAA21_CorrectedReflectance_TrueColor&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$Y" "N21 true Y"
try "$B&LAYERS=VIIRS_NOAA21_CorrectedReflectance_TrueColor&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$W" "N21 true W"
try "$B&LAYERS=VIIRS_NOAA21_CorrectedReflectance_TrueColor&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$T" "N21 true T"
try "$B&LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$Y" "N20 true Y"
try "$B&LAYERS=VIIRS_NOAA21_CorrectedReflectance_BandsM11-I2-I1&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$Y" "N21 false Y"
try "$B&LAYERS=VIIRS_NOAA20_CorrectedReflectance_BandsM11-I2-I1&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$Y" "N20 false Y"
try "$B&LAYERS=VIIRS_NOAA21_Thermal_Anomalies_375m_All&BBOX=-15,-60,-5,-45&FORMAT=image/png&TRANSPARENT=TRUE&TIME=$Y" "N21 fires Y"
try "$B&LAYERS=VIIRS_NOAA20_Thermal_Anomalies_375m_All&BBOX=-15,-60,-5,-45&FORMAT=image/png&TRANSPARENT=TRUE&TIME=$Y" "N20 fires Y"
try "$B&LAYERS=MODIS_Combined_Thermal_Anomalies_All&BBOX=-15,-60,-5,-45&FORMAT=image/png&TRANSPARENT=TRUE&TIME=$Y" "MODIS fires Y"
try "$B&LAYERS=Reference_Labels_15m&BBOX=34,135.5,37,140.9&FORMAT=image/png&TRANSPARENT=TRUE" "labels"
try "$B&LAYERS=Coastlines_15m&BBOX=34,135.5,37,140.9&FORMAT=image/png&TRANSPARENT=TRUE" "coast"
try "$B&LAYERS=VIIRS_NOAA21_CorrectedReflectance_TrueColor,Reference_Labels_15m&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$Y" "N21+labels Y"
try "$B&LAYERS=VIIRS_NOAA21_CorrectedReflectance_TrueColor,VIIRS_NOAA21_Thermal_Anomalies_375m_All&BBOX=-15,-60,-5,-45&FORMAT=image/jpeg&TIME=$Y" "N21+fires Y"
echo "== error body sample"; curl -s -A "$UA" "$B&LAYERS=Reference_Labels_15m&BBOX=34,135.5,37,140.9&FORMAT=image/png&TRANSPARENT=TRUE" | head -c 300; echo
echo "== WMTS capabilities for overlay layers"
curl -s -A "$UA" 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities' -o wmts.xml; ls -la wmts.xml
for L in VIIRS_NOAA21_CorrectedReflectance_TrueColor VIIRS_NOAA20_CorrectedReflectance_TrueColor VIIRS_NOAA21_CorrectedReflectance_BandsM11-I2-I1 VIIRS_NOAA21_Thermal_Anomalies_375m_All VIIRS_NOAA20_Thermal_Anomalies_375m_All Reference_Labels_15m Coastlines_15m Reference_Features_15m; do
python3 - "$L" <<'PY'
import sys,re
L=sys.argv[1]; x=open('wmts.xml',encoding='utf-8',errors='ignore').read()
m=re.search(r'<ows:Identifier>'+re.escape(L)+r'</ows:Identifier>(.*?)</Layer>',x,re.S)
if not m: print(L,'MISSING'); sys.exit()
b=m.group(1); t=re.findall(r'<TileMatrixSet>([^<]+)</TileMatrixSet>',b); f=re.findall(r'<Format>([^<]+)</Format>',b); tpl=re.findall(r'template="([^"]+)"',b)
d=re.search(r'<Default>([^<]+)</Default>',b)
print(L,'tms',t,'fmt',f,'default',d.group(1) if d else '-', 'tpl', tpl[:1])
PY
done
tile() { curl -s -A "$UA" -e "$REF" -o /tmp/t -w "%{http_code} %{content_type} %{size_download}B" "$1"; echo " <- $2"; }
G=https://gibs.earthdata.nasa.gov/wmts/epsg4326/best
# level 6 tile over Tokyo: span 4.5 deg; col=floor((139.7+180)/4.5)=71, row=floor((90-35.7)/4.5)=12
tile "$G/VIIRS_NOAA21_CorrectedReflectance_TrueColor/default/$Y/250m/6/12/71.jpg" "wmts N21 true"
tile "$G/Reference_Labels_15m/default/default/15.625m/6/12/71.png" "wmts labels 15.625m"
tile "$G/Reference_Labels_15m/default/2023-01-01/15.625m/6/12/71.png" "wmts labels dated"
tile "$G/Coastlines_15m/default/default/15.625m/6/12/71.png" "wmts coast"
# fires tile over Brazil -10,-52: col=floor(128/4.5)=28, row=floor(100/4.5)=22
tile "$G/VIIRS_NOAA21_Thermal_Anomalies_375m_All/default/$Y/1km/6/22/28.png" "wmts N21 fires 1km"
tile "$G/VIIRS_NOAA21_Thermal_Anomalies_375m_All/default/$Y/250m/6/22/28.png" "wmts N21 fires 250m"
tile "$G/VIIRS_NOAA21_Thermal_Anomalies_375m_All/default/$Y/500m/6/22/28.png" "wmts N21 fires 500m"
echo "== CORS on WMS image"
curl -s -A "$UA" -H 'Origin: https://wazabi0.github.io' -D - -o /dev/null "$B&LAYERS=VIIRS_NOAA21_CorrectedReflectance_TrueColor&BBOX=34,135.5,37,140.9&FORMAT=image/jpeg&TIME=$Y" | grep -iE '^(HTTP|access-control|cache-control|content-type)'
