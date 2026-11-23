#!/usr/bin/env bash
# Third pass: which news channels are live on YouTube right now, and whether their live streams can be embedded
set -u
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
REF='https://wazabi0.github.io/'
check() { # $1 = label, $2 = /channel/UC... or /@handle
  local html vid live title cid oe emb
  html=$(curl -sL --max-time 20 -A "$UA" -H 'Accept-Language: en-US,en' "https://www.youtube.com$2/live")
  vid=$(grep -oP '<link rel="canonical" href="https://www\.youtube\.com/watch\?v=\K[\w-]{11}' <<<"$html" | head -1)
  live=$(grep -oP '"isLiveNow":\K(true|false)' <<<"$html" | head -1)
  title=$(grep -oP '<meta name="title" content="\K[^"]{0,90}' <<<"$html" | head -1)
  cid=$(grep -oP '"channelId":"\KUC[\w-]{22}' <<<"$html" | head -1)
  oe=-; [ -n "$vid" ] && oe=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=$vid&format=json")
  emb=-; [ -n "$cid" ] && emb=$(curl -s --max-time 15 -A "$UA" -e "$REF" "https://www.youtube.com/embed/live_stream?channel=$cid" | grep -oP '"(status|reason|errorCode|playableInEmbed)":("[^"]{0,60}"|true|false)|"videoId":"[\w-]{11}"' | sort | uniq -c | sort -rn | head -6 | tr -s ' \n' ' ')
  echo "$1 | $2 | channel=$cid | vid=$vid live=$live oembed=$oe | $title | embed:$emb"
}
echo "== current channels"
check 'Al Jazeera' /channel/UCNye-wNBqNL5ZzHSJj3l8Bg
check 'DW News' /channel/UCknLrEdhRCp1aegoMqRaCZg
check 'France 24' /channel/UCQfwfsi5VrQ8yKZ-UWmAEFg
check 'Euronews' /channel/UCSrZ3UV4jOidv8ppoVuvW9Q
check 'TRT World' /channel/UC7fWeaHhqgM4Ry-RMpM2YYw
check 'i24NEWS' /channel/UCvHDpsWKADrDia0c99X37vg
check 'Africanews' /channel/UC1_E8NeF5QHY2dtdLRBCCLA
check 'NHK World' /channel/UCSPEjw8F2nQDtmUKPFNF7_A
check 'CNA' /channel/UC83jt4dlz1Gjl58fzQrrKZg
check 'ABC Australia' /channel/UCVgO39Bk5sMo66-6o6Spn6Q
check 'CBS News' /channel/UC8p1vwvWtl6T73JiExfWs1g
check 'Bloomberg' /channel/UCIALMKvObZNtJ6AmdCLP7Lg
echo "== candidates"
for h in SkyNews ABCNews NBCNews LiveNOWFOX WION CGTNOfficial arirangnews NDTV IndiaToday globalnews SkyNewsAustralia ABSCBNNews TaiwanPlusNews KBSWorldNews ArirangTV markets Reuters CNN TimesNow nhkworldjapan NHKWORLDJAPAN channelnewsasia ScrippsNews news9 GBNewsOnline CBCNews CTVNews 9NewsAUS 7NEWSAustralia RNZ TVNZ1News NTVUganda KTNNewsKE TVCNewsNigeria AriseTV SABCNews eNCA tvpworld Ukraine24 KyivIndependent rtenews; do check "@$h" "/@$h"; done
