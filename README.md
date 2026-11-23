# Live Weather Globe

A single-file, interactive 3D Earth showing live weather from free public data sources. No API keys, no build step.

## Run it

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
- Keys: R auto-rotate, L layer panel, Space day cycle, Esc close popup.

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

The **Sources** tab in the app shows the live status of each feed, so if one is down or blocked you can see which and why. Data auto-refreshes every 10 minutes (↻ forces a refresh).

## Notes

- The model grid is coarse (about 10° x 12°) to stay inside Open-Meteo's free rate limits, so wind and temperature show the large-scale pattern, not local detail.
- Settings (layers, filters, units) are remembered in your browser.
