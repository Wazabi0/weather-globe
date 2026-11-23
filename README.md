# Live Weather Globe

A single-file, interactive 3D Earth showing live weather, disasters, conflict, disease outbreaks and travel risk from free public data sources. No API keys, no build step.

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

- Drag to rotate, scroll or pinch to zoom, double-click to dive in.
- Click anywhere for local conditions, a 24 h forecast, nearby lightning and active alerts.
- Search box flies to any city.
- Bottom slider moves the sun ±24 h (lighting, terminator, twilight); ▶ animates a day cycle.
- Keys: R auto-rotate, L layer panel, T threat assessment, Space day cycle, Esc close popup.

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
| Significant earthquakes, space weather (threat score only) | USGS, NOAA SWPC | minutes |

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

## Notes

- The model grid is coarse (about 10° x 12°) to stay inside Open-Meteo's free rate limits, so wind and temperature show the large-scale pattern, not local detail.
- Settings (layers, filters, units) are remembered in your browser.
- The first visit reads every country page of the UK travel advice (about 225 small requests). Later visits only fetch countries whose advice changed.
- Launch Library allows 15 requests an hour, so launches are cached for 25 minutes.
