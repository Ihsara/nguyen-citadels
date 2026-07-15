// web/historical_overlay.js
// Opt-in "ghost" overlay: draw a GeoJSON polygon (a fort's traced star) as a
// glowing line over the live basemap. NOT wired at boot — poster.js only calls
// ensure() when a caller supplies a polygon, so the default poster tool is
// unchanged. Dual-mode: ES-module exports (vitest) + window.historicalOverlay.
const SRC = "hist-overlay";
const LAYER = "hist-overlay-line";

export function ensure(map, { polygon, style = {} }) {
  const data = { type: "Feature", geometry: polygon, properties: {} };
  const existing = map.getSource(SRC);
  if (existing) { existing.setData(data); return; }
  map.addSource(SRC, { type: "geojson", data });
  map.addLayer({
    id: LAYER, type: "line", source: SRC,
    paint: {
      "line-color": style.color || "#e8c37a",
      "line-width": style.width || 2,
      "line-opacity": style.opacity ?? 0.95,
      "line-blur": style.blur ?? 0.6,
    },
  });
}
export function clear(map) {
  if (map.getLayer(LAYER)) map.removeLayer(LAYER);
  if (map.getSource(SRC)) map.removeSource(SRC);
}
export function isActive(map) { return !!map.getLayer(LAYER); }

if (typeof window !== "undefined") {
  window.historicalOverlay = { ensure, clear, isActive };
}
