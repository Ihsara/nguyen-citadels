// web/story.js — the STORY page: 3-step click-stepper (NOT scroll-jack).
// Step "what": draw a bastioned star-fort diagram (inline SVG primitives).
// Step "network": light forts one-by-one on a network map, Huế first/brightest.
// Step "faded": the same map recolors by fate, with a legend.
// Reads web/data/citadels.json once. All fort text via textContent.
import { FATE_COLORS } from "./lib/palette.js";

const FATE_LABELS = {
  intact: "Intact",
  fragments: "Fragments",
  built_over: "Built over",
  erased: "Erased",
  unknown: "Unknown",
};

const FATE_ORDER = ["intact", "fragments", "built_over", "erased", "unknown"];

// Huế is the imperial seat and the story's "brightest first" beat.
const HUE_SLUG = "thành-huế";

function $(id) { return document.getElementById(id); }

// --- Star-fort diagram (step "what") -------------------------------------
// Standard bastioned-star primitive: N points alternating an outward bastion
// tip with an inward re-entrant angle, drawn around a circle. Not a specific
// fort — a generic teaching diagram.
function drawStarFortDiagram() {
  const poly = $("star-wall-poly");
  if (!poly) return;
  const cx = 200, cy = 200;
  const outerR = 150, innerR = 96;
  const points = 8; // eight bastions
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  poly.setAttribute("points", pts.join(" "));
}

// --- Geometry helpers (same idiom as atlas.js) ----------------------------
function polygonCentroid(polygon) {
  const rings = polygon.type === "Polygon" ? [polygon.coordinates[0]] : polygon.coordinates.map((p) => p[0]);
  let sx = 0, sy = 0, n = 0;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
      n += 1;
    }
  }
  return n > 0 ? [sx / n, sy / n] : [0, 0];
}

function fateOf(fort) {
  return fort.fate in FATE_COLORS ? fort.fate : "unknown";
}

function boundsOf(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [[minX, minY], [maxX, maxY]];
}

function baseStyle() {
  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#efe7d6" } },
      {
        id: "osm-raster",
        type: "raster",
        source: "osm",
        paint: { "raster-opacity": 0.55, "raster-saturation": -0.6, "raster-brightness-min": 0.3, "raster-brightness-max": 1 },
      },
    ],
  };
}

// --- Step "network": light forts one-by-one, Huế first/brightest ---------
function buildNetworkOrder(forts) {
  const hue = forts.find((f) => f.slug === HUE_SLUG);
  const rest = forts.filter((f) => f.slug !== HUE_SLUG);
  return hue ? [hue, ...rest] : forts;
}

function initNetworkMap(forts) {
  const el = $("network-map");
  if (!el || typeof maplibregl === "undefined") return null;

  const order = buildNetworkOrder(forts);
  const centroids = order.map((f) => polygonCentroid(f.star_geometry));
  const bounds = boundsOf(centroids);

  const map = new maplibregl.Map({
    container: "network-map",
    style: baseStyle(),
    attributionControl: true,
    interactive: false,
  });

  let revealed = 0; // how many forts (in order) are currently lit

  map.on("load", () => {
    map.resize();
    map.fitBounds(bounds, { padding: 48, duration: 0 });

    const features = order.map((f, i) => ({
      type: "Feature",
      properties: { slug: f.slug, name_vi: f.name_vi, idx: i, isHue: f.slug === HUE_SLUG },
      geometry: { type: "Point", coordinates: polygonCentroid(f.star_geometry) },
    }));

    map.addSource("network-forts", { type: "geojson", data: { type: "FeatureCollection", features } });

    map.addLayer({
      id: "network-dots-halo",
      type: "circle",
      source: "network-forts",
      filter: ["<", ["get", "idx"], 0], // nothing shown until reveal() runs
      paint: {
        "circle-radius": ["case", ["get", "isHue"], 13, 8],
        "circle-color": "#ffffff",
        "circle-opacity": 0.55,
      },
    });

    map.addLayer({
      id: "network-dots",
      type: "circle",
      source: "network-forts",
      filter: ["<", ["get", "idx"], 0],
      paint: {
        "circle-radius": ["case", ["get", "isHue"], 9, 5.5],
        "circle-color": ["case", ["get", "isHue"], "#e8c37a", "#7a4a1f"],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#2b2420",
      },
    });

    map._reveal = (count) => {
      revealed = count;
      const filt = ["<", ["get", "idx"], revealed];
      if (map.getLayer("network-dots-halo")) map.setFilter("network-dots-halo", filt);
      if (map.getLayer("network-dots")) map.setFilter("network-dots", filt);
    };
    map._ready = true;
    if (map._pendingReveal !== undefined) {
      map._reveal(map._pendingReveal);
      map._pendingReveal = undefined;
    }
  });

  window.addEventListener("resize", () => map.resize());

  return { map, order };
}

let networkTimer = null;

function revealNetworkStep(count) {
  const el = $("network-map");
  if (!el || !el._maplibreHandle) return;
  const { map } = el._maplibreHandle;
  if (map._ready) map._reveal(count);
  else map._pendingReveal = count;
}

function playNetworkReveal(order) {
  clearTimeout(networkTimer);
  let i = 0;
  const caption = $("network-caption");
  const step = () => {
    i += 1;
    revealNetworkStep(i);
    if (caption && order[i - 1]) {
      caption.textContent = i === 1
        ? `Lighting up the network, one citadel at a time — Huế first (${order[i - 1].name_vi}).`
        : `${i} of ${order.length} citadels lit — most recently ${order[i - 1].name_vi}.`;
    }
    if (i < order.length) {
      networkTimer = setTimeout(step, 220);
    }
  };
  step();
}

// --- Step "faded": same layout, recolored by fate + legend ---------------
function buildLegend(forts) {
  const legend = $("fate-legend");
  if (!legend) return;
  legend.textContent = "";
  const present = new Set(forts.map(fateOf));
  for (const key of FATE_ORDER) {
    if (!present.has(key)) continue;
    const li = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = FATE_COLORS[key];
    const label = document.createElement("span");
    label.textContent = FATE_LABELS[key] || key;
    li.appendChild(swatch);
    li.appendChild(label);
    legend.appendChild(li);
  }
}

function initFateMap(forts) {
  const el = $("fate-map");
  if (!el || typeof maplibregl === "undefined") return;

  const centroids = forts.map((f) => polygonCentroid(f.star_geometry));
  const bounds = boundsOf(centroids);

  const map = new maplibregl.Map({
    container: "fate-map",
    style: baseStyle(),
    attributionControl: true,
    interactive: false,
  });

  map.on("load", () => {
    map.resize();
    map.fitBounds(bounds, { padding: 48, duration: 0 });

    const features = forts.map((f) => ({
      type: "Feature",
      properties: { slug: f.slug, name_vi: f.name_vi, fate: fateOf(f) },
      geometry: { type: "Point", coordinates: polygonCentroid(f.star_geometry) },
    }));

    map.addSource("fate-forts", { type: "geojson", data: { type: "FeatureCollection", features } });

    map.addLayer({
      id: "fate-dots-halo",
      type: "circle",
      source: "fate-forts",
      paint: { "circle-radius": 9, "circle-color": "#ffffff", "circle-opacity": 0.6 },
    });

    map.addLayer({
      id: "fate-dots",
      type: "circle",
      source: "fate-forts",
      paint: {
        "circle-radius": 6,
        "circle-color": [
          "match", ["get", "fate"],
          "intact", FATE_COLORS.intact,
          "fragments", FATE_COLORS.fragments,
          "built_over", FATE_COLORS.built_over,
          "erased", FATE_COLORS.erased,
          FATE_COLORS.unknown,
        ],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#2b2420",
      },
    });
  });

  window.addEventListener("resize", () => map.resize());
}

// --- Stepper (click-stepper, NOT scroll-jack) -----------------------------
function initStepper(forts, networkHandle) {
  const root = document.body;
  const steps = Array.from(document.querySelectorAll(".step"));
  const back = $("step-back");
  const forward = $("step-forward");
  const counter = $("step-counter");
  if (steps.length === 0 || !back || !forward || !counter) return;

  root.classList.add("js-stepper");
  let current = 0;

  function render() {
    steps.forEach((s, i) => s.classList.toggle("is-active", i === current));
    back.disabled = current === 0;
    forward.textContent = current === steps.length - 1 ? "Explore the atlas ›" : "Next ›";
    counter.textContent = `Step ${current + 1} of ${steps.length}`;

    const name = steps[current].dataset.step;
    if (name === "what") {
      drawStarFortDiagram();
    } else if (name === "network" && networkHandle) {
      playNetworkReveal(networkHandle.order);
    } else if (name === "faded") {
      clearTimeout(networkTimer);
    }
  }

  back.addEventListener("click", () => {
    current = Math.max(0, current - 1);
    render();
  });

  forward.addEventListener("click", () => {
    if (current === steps.length - 1) {
      window.location.href = "atlas.html";
      return;
    }
    current = Math.min(steps.length - 1, current + 1);
    render();
  });

  render();
}

async function main() {
  drawStarFortDiagram(); // draw immediately; graceful even if data/map fail

  let data;
  try {
    const res = await fetch("data/citadels.json");
    data = await res.json();
  } catch (err) {
    return; // steps 2/3 stay as their static (no-JS) DOM content
  }

  const forts = data.forts || [];
  buildLegend(forts);

  const networkHandle = initNetworkMap(forts);
  if (networkHandle) {
    // stash the maplibre handle on the container so revealNetworkStep can reach it
    $("network-map")._maplibreHandle = networkHandle;
  }
  initFateMap(forts);

  initStepper(forts, networkHandle);
}

main();
