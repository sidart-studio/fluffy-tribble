import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BUILDINGS, BUILDING_KEYS } from "./buildings.js";

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const GRID = 12;                 // tiles per side
const TILE = 2;                  // world units per tile
const HALF = (GRID * TILE) / 2;
const SAVE_KEY = "mega-city-tycoon-v1";

// ----------------------------------------------------------------------------
// Game state
// ----------------------------------------------------------------------------
const state = {
  cash: 200,
  income: 0,
  population: 0,
  placed: 0,
  tiles: {},          // "x,z" -> { type, mesh }
  selectedTool: null, // building key, "bulldoze", or null
};

// ----------------------------------------------------------------------------
// Three.js scene setup
// ----------------------------------------------------------------------------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e0);
scene.fog = new THREE.Fog(0x87b8e0, 40, 90);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
camera.position.set(HALF + 14, 20, HALF + 18);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.15;  // don't go below ground
controls.minDistance = 8;
controls.maxDistance = 70;

// Lighting -------------------------------------------------------------------
const ambient = new THREE.HemisphereLight(0xcfe8ff, 0x4a5d3a, 0.85);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
sun.position.set(20, 30, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -HALF - 6;
sun.shadow.camera.right = HALF + 6;
sun.shadow.camera.top = HALF + 6;
sun.shadow.camera.bottom = -HALF - 6;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 90;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);

// Ground & grid --------------------------------------------------------------
const groundMat = new THREE.MeshStandardMaterial({ color: 0x6aa84f, roughness: 1 });
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(GRID * TILE + 4, 1, GRID * TILE + 4),
  groundMat
);
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// Plot platform (slightly lighter so build area is obvious)
const plot = new THREE.Mesh(
  new THREE.BoxGeometry(GRID * TILE, 0.2, GRID * TILE),
  new THREE.MeshStandardMaterial({ color: 0x7cb35a, roughness: 1 })
);
plot.position.y = 0.0;
plot.receiveShadow = true;
scene.add(plot);

// Grid lines
const gridHelper = new THREE.GridHelper(GRID * TILE, GRID, 0x2f5d2a, 0x3f7035);
gridHelper.position.y = 0.11;
gridHelper.material.opacity = 0.5;
gridHelper.material.transparent = true;
scene.add(gridHelper);

// Hover highlight tile
const highlight = new THREE.Mesh(
  new THREE.PlaneGeometry(TILE * 0.96, TILE * 0.96),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
);
highlight.rotation.x = -Math.PI / 2;
highlight.position.y = 0.12;
highlight.visible = false;
scene.add(highlight);

// A few decorative trees around the plot for flavor
function addTree(x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.7, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4423 })
  );
  trunk.position.set(x, 0.35, z);
  trunk.castShadow = true;
  const leaves = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 0),
    new THREE.MeshStandardMaterial({ color: 0x3f7d3a, flatShading: true })
  );
  leaves.position.set(x, 1.0, z);
  leaves.castShadow = true;
  scene.add(trunk, leaves);
}
for (let i = 0; i < GRID; i += 2) {
  const edge = HALF + 1.2;
  addTree(-edge, -HALF + i * TILE + 1);
  addTree(edge, -HALF + i * TILE + 1);
}

// ----------------------------------------------------------------------------
// Building mesh factory
// ----------------------------------------------------------------------------
function makeBuildingMesh(typeKey) {
  const b = BUILDINGS[typeKey];
  const group = new THREE.Group();
  const w = TILE * 0.7;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, b.height, w),
    new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.7, metalness: 0.05 })
  );
  body.position.y = b.height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof / cap — pyramid for short buildings, slab for tall ones
  if (b.height <= 1.8) {
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(w * 0.78, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: b.roof, roughness: 0.8 })
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = b.height + 0.25;
    roof.castShadow = true;
    group.add(roof);
  } else {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.85, 0.25, w * 0.85),
      new THREE.MeshStandardMaterial({ color: b.roof, roughness: 0.6 })
    );
    cap.position.y = b.height + 0.12;
    cap.castShadow = true;
    group.add(cap);
    // antenna
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.8, 4),
      new THREE.MeshStandardMaterial({ color: 0xdddddd })
    );
    ant.position.y = b.height + 0.6;
    group.add(ant);
  }

  return group;
}

// ----------------------------------------------------------------------------
// Tile helpers
// ----------------------------------------------------------------------------
function tileKey(ix, iz) { return `${ix},${iz}`; }

// world position (center) of a tile index
function tileCenter(ix, iz) {
  return new THREE.Vector3(
    -HALF + ix * TILE + TILE / 2,
    0,
    -HALF + iz * TILE + TILE / 2
  );
}

// world coord -> tile index, or null if off-plot
function worldToTile(point) {
  const ix = Math.floor((point.x + HALF) / TILE);
  const iz = Math.floor((point.z + HALF) / TILE);
  if (ix < 0 || iz < 0 || ix >= GRID || iz >= GRID) return null;
  return { ix, iz };
}

// ----------------------------------------------------------------------------
// Economy actions
// ----------------------------------------------------------------------------
function place(typeKey, ix, iz) {
  const b = BUILDINGS[typeKey];
  const key = tileKey(ix, iz);
  if (state.tiles[key]) { toast("Tile occupied", true); return; }
  if (state.cash < b.cost) { toast(`Need $${fmt(b.cost)}`, true); return; }

  state.cash -= b.cost;
  const mesh = makeBuildingMesh(typeKey);
  const c = tileCenter(ix, iz);
  mesh.position.set(c.x, 0, c.z);
  mesh.scale.set(0.01, 0.01, 0.01); // pop-in animation
  mesh.userData.spawn = performance.now();
  scene.add(mesh);

  state.tiles[key] = { type: typeKey, mesh };
  state.placed++;
  recompute();
  updateHUD();
  refreshTools();
}

function bulldoze(ix, iz) {
  const key = tileKey(ix, iz);
  const t = state.tiles[key];
  if (!t) return;
  const refund = Math.floor(BUILDINGS[t.type].cost * 0.5);
  scene.remove(t.mesh);
  disposeGroup(t.mesh);
  delete state.tiles[key];
  state.placed--;
  state.cash += refund;
  recompute();
  updateHUD();
  refreshTools();
  toast(`Sold for $${fmt(refund)}`);
}

function recompute() {
  let income = 0, pop = 0;
  for (const k in state.tiles) {
    const b = BUILDINGS[state.tiles[k].type];
    income += b.income;
    pop += b.pop;
  }
  state.income = income;
  state.population = pop;
}

function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
}

// ----------------------------------------------------------------------------
// UI: HUD + toolbar
// ----------------------------------------------------------------------------
const el = {
  cash: document.getElementById("cash"),
  income: document.getElementById("income"),
  buildings: document.getElementById("buildings"),
  population: document.getElementById("population"),
  toolList: document.getElementById("tool-list"),
  toast: document.getElementById("toast"),
  loading: document.getElementById("loading"),
};

function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toLocaleString("en-US");
}

function updateHUD() {
  el.cash.textContent = "$" + fmt(state.cash);
  el.income.textContent = "$" + fmt(state.income) + "/s";
  el.buildings.textContent = state.placed.toLocaleString("en-US");
  el.population.textContent = fmt(state.population);
}

// Build the toolbar buttons once
function buildTools() {
  el.toolList.innerHTML = "";
  for (const key of BUILDING_KEYS) {
    const b = BUILDINGS[key];
    const btn = document.createElement("button");
    btn.className = "tool";
    btn.dataset.tool = key;
    btn.innerHTML = `
      <span class="tool-icon">${b.icon}</span>
      <span class="tool-info">
        <span class="tool-name">${b.name}</span>
        <span class="tool-sub">+$${fmt(b.income)}/s · ${b.desc}</span>
      </span>
      <span class="tool-cost">$${fmt(b.cost)}</span>`;
    btn.addEventListener("click", () => {
      if (btn.classList.contains("locked")) {
        toast(`Unlocks at ${b.tier} buildings`, true);
        return;
      }
      selectTool(key);
    });
    el.toolList.appendChild(btn);
  }
}

// Reflect lock/afford/selected states
function refreshTools() {
  document.querySelectorAll(".tool[data-tool]").forEach((btn) => {
    const key = btn.dataset.tool;
    if (key === "bulldoze") return;
    const b = BUILDINGS[key];
    const locked = state.placed < b.tier;
    btn.classList.toggle("locked", locked);
    btn.classList.toggle("unaffordable", !locked && state.cash < b.cost);
    btn.classList.toggle("selected", state.selectedTool === key);
  });
  document.getElementById("tool-bulldoze")
    .classList.toggle("selected", state.selectedTool === "bulldoze");
}

function selectTool(tool) {
  state.selectedTool = state.selectedTool === tool ? null : tool;
  highlight.visible = false;
  refreshTools();
}

let toastTimer = null;
function toast(msg, isError = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle("error", isError);
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 1800);
}

// ----------------------------------------------------------------------------
// Pointer interaction (raycasting against the plot)
// ----------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoverTile = null;
let downPos = null;

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

function pickTile() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(plot, false);
  if (!hits.length) return null;
  return worldToTile(hits[0].point);
}

canvas.addEventListener("pointermove", (e) => {
  setPointer(e);
  if (!state.selectedTool) { highlight.visible = false; hoverTile = null; return; }
  const t = pickTile();
  hoverTile = t;
  if (t) {
    const c = tileCenter(t.ix, t.iz);
    highlight.position.set(c.x, 0.12, c.z);
    highlight.visible = true;
    const occupied = !!state.tiles[tileKey(t.ix, t.iz)];
    if (state.selectedTool === "bulldoze") {
      highlight.material.color.setHex(occupied ? 0xff5555 : 0x888888);
    } else {
      highlight.material.color.setHex(occupied ? 0xff5555 : 0x4ade80);
    }
  } else {
    highlight.visible = false;
  }
});

canvas.addEventListener("pointerdown", (e) => { downPos = { x: e.clientX, y: e.clientY }; });

canvas.addEventListener("pointerup", (e) => {
  // ignore if this was a camera drag
  if (downPos) {
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > 6) return;
  }
  if (!state.selectedTool) return;
  setPointer(e);
  const t = pickTile();
  if (!t) return;
  if (state.selectedTool === "bulldoze") bulldoze(t.ix, t.iz);
  else place(state.selectedTool, t.ix, t.iz);
});

canvas.addEventListener("pointerleave", () => { highlight.visible = false; });

// Keyboard: Esc clears tool, digits pick buildings
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") selectTool(null);
  const n = parseInt(e.key, 10);
  if (!isNaN(n) && n >= 1 && n <= BUILDING_KEYS.length) {
    const key = BUILDING_KEYS[n - 1];
    if (state.placed >= BUILDINGS[key].tier) selectTool(key);
  }
});

// ----------------------------------------------------------------------------
// Save / load
// ----------------------------------------------------------------------------
function save(silent = false) {
  const data = {
    cash: state.cash,
    placed: state.placed,
    tiles: Object.fromEntries(
      Object.entries(state.tiles).map(([k, v]) => [k, v.type])
    ),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    if (!silent) toast("Game saved");
  } catch (_) { if (!silent) toast("Save failed", true); }
}

function load() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (_) { return; }
  if (!raw) return;
  let data;
  try { data = JSON.parse(raw); } catch (_) { return; }

  state.cash = data.cash ?? 200;
  state.placed = 0;
  for (const [k, type] of Object.entries(data.tiles || {})) {
    if (!BUILDINGS[type]) continue;
    const [ix, iz] = k.split(",").map(Number);
    const mesh = makeBuildingMesh(type);
    const c = tileCenter(ix, iz);
    mesh.position.set(c.x, 0, c.z);
    scene.add(mesh);
    state.tiles[k] = { type, mesh };
    state.placed++;
  }
  recompute();
}

function reset() {
  if (!confirm("Reset your city? This cannot be undone.")) return;
  for (const k in state.tiles) { scene.remove(state.tiles[k].mesh); disposeGroup(state.tiles[k].mesh); }
  state.tiles = {};
  state.cash = 200;
  state.placed = 0;
  state.selectedTool = null;
  recompute();
  updateHUD();
  refreshTools();
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  toast("New city started");
}

document.getElementById("save-btn").addEventListener("click", () => save(false));
document.getElementById("reset-btn").addEventListener("click", reset);
document.getElementById("tool-bulldoze").addEventListener("click", () => selectTool("bulldoze"));
window.addEventListener("beforeunload", () => save(true));
setInterval(() => save(true), 15000); // autosave

// ----------------------------------------------------------------------------
// Main loop
// ----------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

let last = performance.now();
let hudAccum = 0;
let dayT = 0;

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  // earn money
  if (state.income > 0) state.cash += state.income * dt;

  // refresh HUD ~10x/sec (also reflects newly affordable/unlocked tools)
  hudAccum += dt;
  if (hudAccum > 0.1) { hudAccum = 0; updateHUD(); refreshTools(); }

  // building pop-in animation
  for (const k in state.tiles) {
    const m = state.tiles[k].mesh;
    if (m.userData.spawn) {
      const p = Math.min((now - m.userData.spawn) / 280, 1);
      const s = easeOutBack(p);
      m.scale.set(s, s, s);
      if (p >= 1) delete m.userData.spawn;
    }
  }

  // slow day/night sun drift
  dayT += dt * 0.04;
  const ang = dayT;
  sun.position.set(Math.cos(ang) * 28, 22 + Math.sin(ang) * 6, Math.sin(ang) * 18);
  const daylight = THREE.MathUtils.clamp(Math.sin(ang) * 0.5 + 0.85, 0.35, 1.3);
  sun.intensity = daylight * 1.4;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// ----------------------------------------------------------------------------
// Boot
// ----------------------------------------------------------------------------
buildTools();
load();
resize();
updateHUD();
refreshTools();
el.loading.classList.add("hidden");
requestAnimationFrame(loop);
