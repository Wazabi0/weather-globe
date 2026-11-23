# Live Weather Globe

A single-file, interactive 3D Earth showing live weather, disasters, conflict, disease outbreaks, travel risk and breaking news from free public data sources. No API keys, no build step.

**Open it:** https://wazabi0.github.io/weather-globe/ (GitHub Pages, published from the `main` branch). The page needs to be served from a normal web address like this one: some sandboxed previews block requests to other sites, and the globe then loads with no live data.

## Run it locally

Easiest (recommended, so the live lightning feed can connect):

```
cd weather-globe
python3 -m http.server 8080
```

Then open http://localhost:8080 in Chrome, Edge, Firefox or Safari.

You can also just double-click `index.html`; everything works except that some browsers send a "null" origin from local files, which the lightning network may refuse.

## Controls

- Drag to rotate. Scroll, pinch or press + and - to zoom: each wheel notch goes about a quarter of the way in, toward the point under the pointer. Double-click to go about three times closer.
- On phones and tablets, pinch to zoom and drag with two fingers to move around.
- Click anywhere for local conditions, a 24 h forecast, nearby lightning and active alerts.
- Capitals are marked with a gold star. Click a capital, city, state or province name to fly there and read its news.
- Search box flies to any city.
- Bottom slider moves the sun ±24 h (lighting, terminator, twilight); ▶ animates a day cycle.
- Keys: R auto-rotate, L layer panel, T threat assessment, N news list, M event media window, + and - zoom, Space day cycle, Esc close popups.

## Layers

| Layer | Source | Freshness |
|---|---|---|
| Clouds (infrared satellite) | NOAA GMGSI global mosaic via nowCOAST; fallback NASA GIBS GOES-East/West + Himawari; fallback model cloud cover | ~hourly / 10 min |
| Radar precipitation (+ 2 h loop) | RainViewer | ~10 min |
| Global precipitation | NASA GPM IMERG via GIBS | ~4-6 h delay |
| Wind flow, temperature, humidity, pressure isobars + H/L, gusts, CAPE, model thunderstorm cells | Open-Meteo (510-point global grid, cached 30 min) | hourly model |
| Lightning strikes | Blitzortung.org live websocket (non-commercial use) | seconds |
| Tropical cyclones + tracks | NASA EONET, GDACS fallback | hours |
| Severe weather alerts | US National Weather Service | minutes |
| Aurora oval | NOAA SWPC OVATION | 30 min |
| Sea surface temperature | NASA GHRSST MUR via GIBS | daily |
| Earthquakes, wildfires, volcanoes | USGS, NASA EONET | minutes / daily |
| Base map, city lights, borders | NASA Blue/Black Marble, Natural Earth | static |
| Disaster alerts (red, orange, green) | GDACS (UN / European Commission) | minutes |
| Conflict & attacks, world news events | Wikipedia "Current events" portal, placed using the linked articles' coordinates | as edited |
| Disease outbreaks | WHO Disease Outbreak News | daily |
| UK travel advice by country | GOV.UK (FCDO) content API | as published |
| Rocket launches | Launch Library 2 (The Space Devs) | 25 min |
| Breaking news ticker | About 60 news sites' RSS feeds and Google News searches for about 1,200 places, collected by this repository's GitHub Actions job (see below) | 15 min (each place's search every 6 to 12 h) |
| Capitals, cities, states and provinces | [GeoNames](https://www.geonames.org/) (CC BY 4.0) with Natural Earth country names, built into `data/places.json` | static |
| Significant earthquakes, space weather (threat score only) | USGS, NOAA SWPC | minutes |
| Event media window | News channels' YouTube live streams, Launch Library webcasts, NASA GIBS (NOAA-21 and NOAA-20 VIIRS), USGS ShakeMap, Wikipedia, Wikimedia Commons, NASA SDO, ESA/NASA SOHO, NOAA SWPC | live / daily |

The **Sources** tab in the app shows the live status of each feed, so if one is down or blocked you can see which and why. Data auto-refreshes every 10 minutes (↻ forces a refresh).

## Global threat assessment

The badge next to the title (or the **T** key) opens the **Threats** tab. It scores five domains from 0 to 100, worked out in your browser from the feeds above:

- **Conflict & security:** Wikipedia conflict and attack reports from the last two days, the deaths they mention, and UK travel advice levels.
- **Natural hazards:** GDACS red and orange alerts, plus USGS significant earthquakes.
- **Storms & severe weather:** active tropical cyclones by strength, plus US tornado and extreme warnings.
- **Disease outbreaks:** WHO reports from the last 30 days, weighted up for diseases such as Ebola, Marburg and MERS.
- **Space weather:** NOAA's G, S and R scales and the Kp index.

The overall level (Low, Guarded, Elevated, High, Severe) is 60% the worst domain and 40% the average. Below it is a ranked list of the top events; click one to fly there. Clicking anywhere on the globe also lists events nearby and, with the travel advice layer on, the UK advice for that country.

This is a rough guide to how much is happening, not an official assessment. Wikipedia entries are written by volunteers, and event positions come from the places the entries link to, so they are approximate.

Each feed loads on its own. If one is down, the others still show, the score uses whatever arrived (it needs at least two kinds of data), and the Sources tab says what failed.

## Breaking news by region

The ticker in the top bar follows what you are looking at. Zoomed out, it shows world headlines. Zoom in to about continent height and it switches to that region (Africa, Asia, Europe, the Middle East, North America including Central America and the Caribbean, South America, or Oceania), then to the country, then to the state or province, and closest in to the city. When you zoom with the mouse or a pinch, the news follows the place you zoomed toward; after a drag it follows the middle of the screen. Headlines less than an hour old are marked **Breaking**. Click the ticker (or press **N**) for the full list, with links to the articles and buttons to jump back out to the state, country, region or world. A place with little news of its own also shows more from the state or country around it.

Browsers can't read most news sites' RSS feeds directly, because those sites don't allow cross-site requests. So a scheduled GitHub Actions job in this repository ([`.github/workflows/news.yml`](.github/workflows/news.yml), running [`scripts/build-news.mjs`](scripts/build-news.mjs)) collects about 60 feeds every 15 minutes: BBC, Al Jazeera, The Guardian, NPR, DW, France 24 and UN News for world news, plus regional desks and national outlets such as AllAfrica, Premium Times, The Hindu, Dawn, Yonhap, The Japan Times, The Local, Kyiv Independent, Global News, MercoPress, ABC and RNZ. It writes `news.json` (the last three days, deduplicated) to the `news-data` branch, and the page reads it from raw.githubusercontent.com. Each headline is placed by the countries, cities, leaders and regions it names, falling back to the outlet's home country, so a few land in the wrong place.

### Cities, states and provinces

The same job also runs Google News searches for headlines that name about 1,200 places in their title: every capital, each country's five largest cities, every city of over a million people, and the states and provinces of 18 large countries. It runs 40 searches each time, oldest first, so capitals are refreshed about every 6 hours and other places about every 12, and writes them to `local/<country code>.json` on the `news-data` branch. The page adds those to the headlines from the news sites above that name the place. Google News sometimes refuses searches from GitHub's shared servers for a while; the job then keeps the previous results and carries on next time.

The places come from `data/places.json`: 240 capitals, about 5,500 cities and 2,600 states and provinces from [GeoNames](https://www.geonames.org/) (CC BY 4.0), plus a grid of towns used to tell which state or province a point is in. The capitals are also built into the page so the stars show at once; the rest loads the first time you zoom in to country height. To rebuild it, run "Build places data" from the Actions tab: it pushes a fresh `data/places.json` and `data/local-queries.json` (the list of searches) to the `places-update` branch, ready to merge through a pull request. You can also run `node scripts/build-places.mjs data/places.json` on any machine that can reach download.geonames.org.

To change the sources, edit the `FEEDS` list in the script. You can run the job by hand from the repository's **Actions** tab ("Breaking news feed", then "Run workflow"). GitHub turns off scheduled workflows in a public repository after 60 days without activity, so if the headlines stop updating, open the Actions tab and enable "Breaking news feed" again. A copy of the globe published from another repository reads that repository's `news-data` branch first and falls back to this one.

## Event media window

Click an event on the globe or in the Threats or Events list and a small picture-in-picture window opens with it. On a phone, tap the ▶ button on the event's card instead. Drag the window by its title, make it bigger, minimise it to a bar, or pop it out (⧉, in Chrome and Edge) into its own window that stays on top while you use other apps. Press **M** to close or reopen it. To stop it opening by itself, turn off "Event media window" in Layers; the ▶ button on each card still opens it.

- **Live TV:** a 24-hour news channel for that part of the world, from the channel's own YouTube live stream: NHK World and CNA for East Asia, Al Jazeera and TRT World for the Middle East, DW News, Euronews and Sky News for Europe, WION for South Asia, Africanews for Africa, ABC Australia for Oceania, CBS News for North America, and more under "More channels". Streams start muted (on a phone, tap to play with sound), and the channel you pick is remembered for that part of the world. A rocket launch shows its webcast when Launch Library lists one on YouTube, otherwise a countdown and a link to the official webcast. Space weather shows the Sun as NASA SDO and ESA/NASA SOHO see it now, and NOAA's aurora forecast.
- **Satellite:** a before-and-after slider from NASA GIBS. The newest daily image from the NOAA-21 VIIRS satellite (NOAA-20 if it is missing) sits against one from before the event began. Switch to the shortwave infrared view, where floodwater shows dark blue and burn scars brown (floods and fires open in it), add the fires the satellites detected that day, or open the same view in NASA Worldview. The images come from the satellites' early afternoon pass, so today's appears in the evening.
- **Photos:** a slideshow of the USGS ShakeMap and PAGER estimate for earthquakes, the rocket for launches, photos from news stories about the event, Wikipedia's lead pictures of the places involved, and Wikimedia Commons photos taken within 10 km.
- **Headlines:** the news items from the ticker's sources that name the event, its kind of disaster or its places, with a Google News search for more. The crawl along the bottom scrolls them; click it for the list.

The pop-out window has no web address of its own, and YouTube's player will not play without one, so there the stream plays through [`tv.html`](tv.html), a small page in this repository that only holds the player. A channel that is not live at the moment shows YouTube's own message; pick another channel below the picture.

## Notes

- The model grid is coarse (about 10° x 12°) to stay inside Open-Meteo's free rate limits, so wind and temperature show the large-scale pattern, not local detail.
- Settings (layers, filters, units) are remembered in your browser.
- The first visit reads every country page of the UK travel advice (about 225 small requests). Later visits only fetch countries whose advice changed.
- Launch Library allows 15 requests an hour, so launches are cached for 25 minutes. The webcast list for each launch (only in its own record) is fetched when you open it and kept for an hour.
- Suomi NPP's VIIRS stopped sending images on 2 November 2026, so the satellite base map and the event window use NOAA-21, with NOAA-20 as the fallback.
