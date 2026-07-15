// web/atlas.js — the EXPLORER page: card grid + sort/filter + network map.
// Reads web/data/citadels.json once, renders. All fort text goes through
// textContent (never innerHTML) — Vietnamese diacritics must never be
// HTML-mangled.
import { FATE_COLORS } from "./lib/palette.js";

const FATE_LABELS = {
  intact: "Intact",
  fragments: "Fragments",
  built_over: "Built over",
  erased: "Erased",
  unknown: "Unknown",
};

const FATE_ORDER = ["intact", "fragments", "built_over", "erased", "unknown"];

function $(id) { return document.getElementById(id); }

function fmtInt(n) {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString("en-US");
}

// Centroid of a GeoJSON Polygon/MultiPolygon's outer ring — plain vertex
// average, good enough for placing a network dot (not an area-weighted
// centroid; these star polygons are compact and roughly convex).
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

function polygonBounds(polygon) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const rings = polygon.type === "Polygon" ? polygon.coordinates : polygon.coordinates.flat();
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [[minX, minY], [maxX, maxY]];
}

function fateOf(fort) {
  return fort.fate in FATE_COLORS ? fort.fate : "unknown";
}

function buildLegend(forts) {
  const legend = $("map-legend");
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

function renderMap(forts) {
  if (typeof maplibregl === "undefined") return;

  const allBoundsPts = forts.map((f) => polygonCentroid(f.star_geometry));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of allBoundsPts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const map = new maplibregl.Map({
    container: "map",
    style: {
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
          paint: { "raster-opacity": 0.65, "raster-saturation": -0.5, "raster-brightness-min": 0.25, "raster-brightness-max": 1 },
        },
      ],
    },
    attributionControl: true,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  map.on("load", () => {
    map.resize(); // container may have been 0-sized at construction time
    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 56, duration: 0 });

    const features = forts.map((f) => ({
      type: "Feature",
      properties: { slug: f.slug, name_vi: f.name_vi, fate: fateOf(f) },
      geometry: { type: "Point", coordinates: polygonCentroid(f.star_geometry) },
    }));

    map.addSource("forts", { type: "geojson", data: { type: "FeatureCollection", features } });

    map.addLayer({
      id: "fort-dots-halo",
      type: "circle",
      source: "forts",
      paint: {
        "circle-radius": 9,
        "circle-color": "#ffffff",
        "circle-opacity": 0.6,
      },
    });

    map.addLayer({
      id: "fort-dots",
      type: "circle",
      source: "forts",
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

    map.on("mouseenter", "fort-dots", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "fort-dots", () => { map.getCanvas().style.cursor = ""; });
    map.on("click", "fort-dots", (e) => {
      const slug = e.features && e.features[0] && e.features[0].properties.slug;
      if (slug) window.location.href = `fort.html?f=${encodeURIComponent(slug)}`;
    });
  });

  window.addEventListener("resize", () => map.resize());
}

function makeCard(fort) {
  const fate = fateOf(fort);
  const card = document.createElement("a");
  card.className = "fort-card";
  card.href = `fort.html?f=${encodeURIComponent(fort.slug)}`;

  const thumbWrap = document.createElement("div");
  thumbWrap.className = "thumb-wrap";
  const img = document.createElement("img");
  img.className = "thumb";
  img.loading = "lazy";
  img.src = `img/sat/${encodeURIComponent(fort.slug)}.png`;
  img.alt = `Satellite view of ${fort.name_vi}`;
  img.onerror = () => { thumbWrap.classList.add("no-thumb"); };
  thumbWrap.appendChild(img);

  const chip = document.createElement("span");
  chip.className = "fate-chip";
  chip.style.background = FATE_COLORS[fate];
  chip.textContent = FATE_LABELS[fate] || fate;
  thumbWrap.appendChild(chip);

  const body = document.createElement("div");
  body.className = "card-body";

  const province = document.createElement("p");
  province.className = "card-eyebrow";
  province.textContent = fort.province || "";

  const nameVi = document.createElement("h3");
  nameVi.textContent = fort.name_vi;

  const nameEn = document.createElement("p");
  nameEn.className = "card-name-en";
  nameEn.textContent = fort.name_en || "";

  const facts = document.createElement("dl");
  facts.className = "card-facts";
  const factPairs = [
    ["Built", fort.built_year ? String(fort.built_year) : "—"],
    ["Ruler", fort.ruler || "—"],
    ["Perimeter", fort.perimeter_m ? `${fmtInt(fort.perimeter_m)} m` : "—"],
  ];
  for (const [k, v] of factPairs) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    facts.appendChild(dt);
    facts.appendChild(dd);
  }

  body.appendChild(province);
  body.appendChild(nameVi);
  body.appendChild(nameEn);
  body.appendChild(facts);

  card.appendChild(thumbWrap);
  card.appendChild(body);
  return card;
}

function rulerShort(ruler) {
  // Rulers often carry a long "X to Y (year, note)" span; the filter uses
  // the leading name so overlapping reigns still group together.
  if (!ruler) return "";
  return ruler.split(/\s*\(/)[0].split(" to ")[0].trim();
}

function populateSelect(select, values, allLabel) {
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  }
}

function renderGrid(forts) {
  const grid = $("fort-grid");
  grid.textContent = "";
  for (const fort of forts) {
    grid.appendChild(makeCard(fort));
  }
  $("empty-state").hidden = forts.length > 0;
  $("result-count").textContent = `${forts.length} fort${forts.length === 1 ? "" : "s"}`;
}

function applySortAndFilter(allForts) {
  const sortBy = $("sort-select").value;
  const province = $("filter-province").value;
  const fate = $("filter-fate").value;
  const ruler = $("filter-ruler").value;

  let out = allForts.filter((f) => {
    if (province && f.province !== province) return false;
    if (fate && fateOf(f) !== fate) return false;
    if (ruler && rulerShort(f.ruler) !== ruler) return false;
    return true;
  });

  out = out.slice();
  if (sortBy === "year") {
    out.sort((a, b) => (a.built_year || 9999) - (b.built_year || 9999));
  } else if (sortBy === "perimeter") {
    out.sort((a, b) => (b.perimeter_m || 0) - (a.perimeter_m || 0));
  } else {
    out.sort((a, b) => a.name_vi.localeCompare(b.name_vi, "vi"));
  }

  renderGrid(out);
}

function initControls(forts) {
  const provinces = [...new Set(forts.map((f) => f.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
  const fates = FATE_ORDER.filter((k) => forts.some((f) => fateOf(f) === k));
  const rulers = [...new Set(forts.map((f) => rulerShort(f.ruler)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));

  populateSelect($("filter-province"), provinces);
  for (const key of fates) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = FATE_LABELS[key] || key;
    $("filter-fate").appendChild(opt);
  }
  populateSelect($("filter-ruler"), rulers);

  for (const id of ["sort-select", "filter-province", "filter-fate", "filter-ruler"]) {
    $(id).addEventListener("change", () => applySortAndFilter(forts));
  }
}

async function main() {
  let data;
  try {
    const res = await fetch("data/citadels.json");
    data = await res.json();
  } catch (err) {
    $("empty-state").hidden = false;
    $("empty-state").textContent = "Could not load the fort data.";
    return;
  }

  const forts = data.forts || [];

  buildLegend(forts);
  renderMap(forts);
  initControls(forts);
  applySortAndFilter(forts);
}

main();
