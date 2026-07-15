// web/fort.js — the FOCUS page: history / shape / now / life for one fort.
// Reads ?f=<slug>, fetches web/data/citadels.json once, renders. All text
// goes through textContent (never innerHTML) — Vietnamese diacritics and any
// stray source text must never be HTML-mangled.
import { ensure as ensureOverlay } from "./lib/historical_overlay.js";
import { FATE_COLORS, LIFE_COLORS } from "./lib/palette.js";

const FATE_LABELS = {
  intact: "Intact",
  fragments: "Fragments",
  built_over: "Built over",
  erased: "Erased",
  unknown: "Unknown",
};

const LIFE_LABELS = {
  eat: "Eat",
  shop: "Shop",
  serve: "Serve",
  civic: "Civic",
  other: "Other",
};

const LANDUSE_LABELS = {
  commercial: "Commercial",
  residential: "Residential",
  civic: "Civic / institutional",
  industrial: "Industrial",
  green: "Green / recreation",
};

function $(id) { return document.getElementById(id); }

function fmtInt(n) {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString("en-US");
}

function fmtArea(m2) {
  if (m2 === null || m2 === undefined) return "—";
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
  return `${fmtInt(m2)} m²`;
}

function addFact(list, k, v) {
  if (v === null || v === undefined || v === "") return;
  const li = document.createElement("li");
  const kEl = document.createElement("span");
  kEl.className = "k";
  kEl.textContent = k;
  const vEl = document.createElement("span");
  vEl.className = "v";
  vEl.textContent = v;
  li.appendChild(kEl);
  li.appendChild(vEl);
  list.appendChild(li);
}

function renderHeader(fort) {
  $("fort-province").textContent = fort.province || "";
  $("fort-name-vi").textContent = fort.name_vi;
  $("fort-name-en").textContent = fort.name_en || "";

  const fate = fort.fate in FATE_COLORS ? fort.fate : "unknown";
  const chip = $("fort-fate-chip");
  const color = FATE_COLORS[fate];
  chip.style.background = color;
  chip.style.color = "#fff";
  $("fort-fate-label").textContent = FATE_LABELS[fate] || fate;

  $("fort-header").hidden = false;
  document.title = `${fort.name_vi} — Vauban Came East, Then Faded`;
}

function renderHistory(fort) {
  const facts = $("history-facts");
  addFact(facts, "Built", fort.built_year ? String(fort.built_year) : null);
  addFact(facts, "Ruler", fort.ruler);
  addFact(facts, "Engineer", fort.engineer);
  addFact(facts, "Perimeter", fort.perimeter_m ? `${fmtInt(fort.perimeter_m)} m` : null);
  addFact(facts, "Bastions", fort.bastions ? String(fort.bastions) : null);
  addFact(facts, "Wall style", fort.wall_style);

  const noteEl = $("history-vauban-note");
  if (fort.vauban_note) {
    noteEl.textContent = fort.vauban_note;
  } else {
    noteEl.remove();
  }

  const list = $("history-sources-list");
  const sources = fort.sources || [];
  if (sources.length === 0) {
    $("history-sources").remove();
  } else {
    for (const src of sources) {
      const li = document.createElement("li");
      const claimEl = document.createElement("div");
      claimEl.textContent = src.claim || "";
      li.appendChild(claimEl);
      if (src.cite) {
        const citeText = src.cite;
        const urlMatch = citeText.match(/https?:\/\/\S+/);
        if (urlMatch) {
          const a = document.createElement("a");
          a.href = urlMatch[0];
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = citeText;
          li.appendChild(a);
        } else {
          const citeEl = document.createElement("div");
          citeEl.textContent = citeText;
          li.appendChild(citeEl);
        }
      }
      list.appendChild(li);
    }
  }
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

function renderShape(fort) {
  if (typeof maplibregl === "undefined") return;

  const bounds = polygonBounds(fort.star_geometry);

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
        { id: "bg", type: "background", paint: { "background-color": "#14181c" } },
        {
          id: "osm-raster",
          type: "raster",
          source: "osm",
          paint: { "raster-opacity": 0.55, "raster-saturation": -0.7, "raster-brightness-min": 0, "raster-brightness-max": 0.6 },
        },
      ],
    },
    attributionControl: true,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  map.on("load", () => {
    map.resize(); // container may have been 0-sized at construction time
    map.fitBounds(bounds, { padding: 48, duration: 0 });
    ensureOverlay(map, { polygon: fort.star_geometry, style: { color: "#e8c37a", width: 3, blur: 0.8 } });
  });

  window.addEventListener("resize", () => map.resize());
}

function renderNow(fort) {
  const now = fort.now || {};
  const img = $("now-sat-thumb");
  img.src = `img/sat/${encodeURIComponent(fort.slug)}.png`;
  img.alt = `Satellite view of ${fort.name_vi}`;
  img.onerror = () => { img.style.display = "none"; };

  const stats = $("now-stats");
  const tiles = [
    ["POIs", fmtInt(now.poi_total)],
    ["Buildings", now.buildings ? fmtInt(now.buildings.count) : "0"],
    ["Building footprint", now.buildings ? fmtArea(now.buildings.footprint_m2) : "—"],
    ["Area (walls)", fmtArea(now.area_m2)],
  ];
  for (const [label, num] of tiles) {
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    const numEl = document.createElement("span");
    numEl.className = "num";
    numEl.textContent = num;
    const labelEl = document.createElement("span");
    labelEl.className = "label";
    labelEl.textContent = label;
    tile.appendChild(numEl);
    tile.appendChild(labelEl);
    stats.appendChild(tile);
  }

  if (now.buildings && now.buildings.count === 0) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = "No buildings measured inside the walls — likely thin OSM coverage here, not evidence the fort is unbuilt.";
    stats.parentElement.insertBefore(note, stats.nextSibling);
  }

  const landuseList = $("now-landuse");
  const landuse = now.landuse || {};
  const entries = Object.entries(landuse).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    landuseList.remove();
  } else {
    for (const [key, share] of entries) {
      const li = document.createElement("li");
      const kEl = document.createElement("span");
      kEl.textContent = LANDUSE_LABELS[key] || key;
      const vEl = document.createElement("span");
      vEl.textContent = `${(share * 100).toFixed(1)}%`;
      li.appendChild(kEl);
      li.appendChild(vEl);
      landuseList.appendChild(li);
    }
  }
}

function renderLife(fort) {
  const now = fort.now || {};
  const lives = now.lives || {};
  const maxCount = Math.max(1, ...Object.values(lives));
  const container = $("life-bars");

  const order = ["eat", "shop", "serve", "civic", "other"];
  for (const key of order) {
    if (!(key in lives)) continue;
    const count = lives[key];
    const row = document.createElement("div");
    row.className = "life-bar-row";

    const label = document.createElement("span");
    label.textContent = LIFE_LABELS[key] || key;

    const track = document.createElement("div");
    track.className = "life-bar-track";
    const fill = document.createElement("div");
    fill.className = "life-bar-fill";
    fill.style.width = `${Math.max(2, (count / maxCount) * 100)}%`;
    fill.style.background = LIFE_COLORS[key] || "#999";
    track.appendChild(fill);

    const countEl = document.createElement("span");
    countEl.className = "count";
    countEl.textContent = fmtInt(count);

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(countEl);
    container.appendChild(row);
  }

  const captionEl = $("life-caption");
  if (fort.caption_now) {
    captionEl.textContent = fort.caption_now;
    captionEl.hidden = false;
  }
}

function showNotFound() {
  $("not-found").hidden = false;
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("f");

  let data;
  try {
    const res = await fetch("data/citadels.json");
    data = await res.json();
  } catch (err) {
    showNotFound();
    return;
  }

  const forts = data.forts || [];
  const fort = slug ? forts.find((f) => f.slug === slug) : null;

  if (!fort) {
    showNotFound();
    return;
  }

  renderHeader(fort);
  renderHistory(fort);
  $("fort-main").hidden = false; // unhide BEFORE map init so #map has real layout size
  renderShape(fort);
  renderNow(fort);
  renderLife(fort);
}

main();
