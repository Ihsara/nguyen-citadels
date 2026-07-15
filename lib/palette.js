// web/lib/palette.js
// Shared color constants for all three nguyen-citadels pages (fort.html,
// atlas.html, index.html) — the DESIGN-SYSTEM.md source of truth. Do NOT
// hand-copy hexes per page; import this file everywhere a fate or life color
// is needed so the three pages never drift apart (derived-value drift).
// Dual-mode: ES-module export (for future bundling/tests) + window global
// (for a plain <script> include, matching historical_overlay.js's pattern).

// fate = IDENTITY (the spine) — one fixed hex per fate, a living->gone decay ramp.
const FATE_COLORS = {
  intact: "#3f7d5a",      // living green — walls stand, life inside
  fragments: "#c99a3b",   // faded gold — partial, weathering
  built_over: "#b5651d",  // rust/terracotta — the city ate it
  erased: "#8a8078",      // ash grey — gone, only the footprint remains
  unknown: "#c6c6c6",     // tail
};

// four lives = DATA (category) — ~5 saturated, well-separated hues.
// In bars: darkness/length carries the count; hue only labels the life.
const LIFE_COLORS = {
  eat: "#d1495b",    // warm red — food
  shop: "#edae49",   // amber — commerce
  serve: "#4b6858",  // muted teal-green — services
  civic: "#3d6a9e",  // institutional blue — state/community
  other: "#b0a89c",  // neutral tan
};

if (typeof window !== "undefined") {
  window.FATE_COLORS = FATE_COLORS;
  window.LIFE_COLORS = LIFE_COLORS;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FATE_COLORS, LIFE_COLORS };
}
export { FATE_COLORS, LIFE_COLORS };
