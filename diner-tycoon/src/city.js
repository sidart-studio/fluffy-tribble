// The city: a 9x9 grid of blocks around your diner. You buy land ring by ring,
// zone homes, workplaces, food businesses and services, and the simulation
// does the rest: people move in when there are homes, jobs and food; they pay
// tax; businesses earn from customers; power plants keep the lights on;
// parks and services keep everyone happy; unhappy citizens move out.

import * as THREE from 'three';

export const PITCH = 22;          // block-to-block distance (12 m block + pavement + 6 m street)
export const BLOCK = 12;          // buildable square per block
export const RADIUS = 4;          // blocks from the diner in each direction (9x9 grid)
export const FREE_POWER = 8;      // buildings the street grid powers before you need a plant

const cmat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
const cshadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

/** City ranks by population. Each rank unlocks more buildings. */
export const RANKS = [
  { id: 0, name: 'Crossroads', pop: 0 },
  { id: 1, name: 'Village', pop: 25 },
  { id: 2, name: 'Town', pop: 100 },
  { id: 3, name: 'City', pop: 300 },
  { id: 4, name: 'Metropolis', pop: 800 },
];

/** Price of each ring of land beyond the starting 3x3. */
export const RING_COST = { 2: 900, 3: 3200, 4: 9000 };

export const CITY_CATEGORIES = [
  { id: 'homes', name: 'Homes', icon: '🏠' },
  { id: 'jobs', name: 'Jobs', icon: '🏢' },
  { id: 'food', name: 'Food & shops', icon: '🍔' },
  { id: 'services', name: 'Services', icon: '🌳' },
];

// housing: how many people can live there. jobs: workplaces. customers: how
// many customers a minute the business can serve at `price` each. power: capacity
// supplied. happy: flat happiness bonus (negative = pollution). growth: move-in
// speed multiplier. Level 2 and 3 multiply the numbers by 1.5 and 2.
export const BUILDINGS = [
  { id: 'house', cat: 'homes', name: 'Family houses', icon: '🏠', cost: 130, rank: 0, desc: 'Three little houses with gardens. Room for 6.', housing: 6 },
  { id: 'apartments', cat: 'homes', name: 'Apartments', icon: '🏢', cost: 420, rank: 1, desc: 'A mid-rise block. Room for 24.', housing: 24 },
  { id: 'tower', cat: 'homes', name: 'Residential tower', icon: '🏙️', cost: 1900, rank: 2, desc: 'A high-rise. Room for 90.', housing: 90 },

  { id: 'workshop', cat: 'jobs', name: 'Workshop', icon: '🔧', rank: 0, cost: 260, desc: 'A garage and a workshop. 12 jobs.', jobs: 12, jobPay: 0.5 },
  { id: 'office', cat: 'jobs', name: 'Office block', icon: '🏬', rank: 1, cost: 750, desc: 'A glass tower. 40 jobs, and office workers eat out at lunch.', jobs: 40, jobPay: 0.55, lunch: true },
  { id: 'factory', cat: 'jobs', name: 'Factory', icon: '🏭', rank: 2, cost: 950, desc: '70 well-paid jobs, but the chimney costs happiness (-8).', jobs: 70, jobPay: 0.65, happy: -8 },

  { id: 'hotdogstand', cat: 'food', name: 'Hot dog stand', icon: '🌭', rank: 0, cost: 200, desc: 'A cart with a giant hot dog on top. 6 customers a minute.', customers: 6, price: 4, jobs: 2, food: true },
  { id: 'kebabhouse', cat: 'food', name: 'Kebab house', icon: '🍢', rank: 0, cost: 430, desc: 'A spinning skewer sign. 8 customers a minute.', customers: 8, price: 7, jobs: 4, food: true },
  { id: 'burgerjoint', cat: 'food', name: 'Burger joint', icon: '🍔', rank: 1, cost: 520, desc: 'A drive-through with a rooftop burger. 9 customers a minute.', customers: 9, price: 8, jobs: 5, food: true },
  { id: 'shop', cat: 'food', name: 'Corner shop', icon: '🛒', rank: 0, cost: 280, desc: 'Groceries and papers. 10 customers a minute.', customers: 10, price: 3.5, jobs: 3 },
  { id: 'mall', cat: 'food', name: 'Shopping mall', icon: '🏪', rank: 2, cost: 1600, desc: 'Every brand under one roof. 30 customers a minute and 25 jobs.', customers: 30, price: 4.5, jobs: 25 },

  { id: 'park', cat: 'services', name: 'City park', icon: '🌳', rank: 0, cost: 220, desc: 'Trees, a fountain, benches. +7 happiness.', happy: 7 },
  { id: 'powerplant', cat: 'services', name: 'Power plant', icon: '⚡', rank: 0, cost: 600, desc: 'Powers 12 more buildings. Unpowered buildings do nothing. -3 happiness.', power: 12, happy: -3, jobs: 6, jobPay: 0.6 },
  { id: 'school', cat: 'services', name: 'School', icon: '🏫', rank: 1, cost: 900, desc: '+6 happiness, 10 jobs, and families move in 30% faster.', happy: 6, jobs: 10, jobPay: 0.4, growth: 0.3 },
  { id: 'hospital', cat: 'services', name: 'Hospital', icon: '🏥', rank: 2, cost: 1700, desc: '+10 happiness, 30 jobs, people move in 40% faster.', happy: 10, jobs: 30, jobPay: 0.5, growth: 0.4 },
  { id: 'stadium', cat: 'services', name: 'Stadium', icon: '🏟️', rank: 3, cost: 6000, desc: 'Match day every day. +15 happiness, 40 jobs, and every food business sells 30% more.', happy: 15, jobs: 40, jobPay: 0.5, foodBoost: 0.3 },
];
export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
export const LEVEL_MULT = [1, 1.5, 2];
export const MAX_LEVEL = 3;
export function levelUpCost(def, level) { return Math.round(def.cost * 0.8 * level); }

// ---------------------------------------------------------------- textures
function windowTexture(base, glass, cols, rows) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
  const w = 256 / cols, h = 256 / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    ctx.fillStyle = Math.random() < 0.75 ? glass : '#ffe9a8';
    ctx.fillRect(i * w + w * 0.2, j * h + h * 0.2, w * 0.6, h * 0.55);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function signTexture(text, fg, bg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = fg; ctx.font = 'bold 64px "Lilita One", "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function labelSprite(text, color = '#ffd54f') {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d'); ctx.font = '96px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(3, 3, 1); s.renderOrder = 20;
  return s;
}

// ---------------------------------------------------------------- builders
function tree(x, z, h = 2.2) {
  const g = new THREE.Group();
  const trunk = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h * 0.4, 8), cmat(0x6d4c41))); trunk.position.y = h * 0.2; g.add(trunk);
  const crown = cshadowed(new THREE.Mesh(new THREE.ConeGeometry(0.9, h * 0.8, 9), cmat(0x3f8f4a + Math.floor(Math.random() * 0x001500)))); crown.position.y = h * 0.7; g.add(crown);
  g.position.set(x, 0, z);
  return g;
}
function glassWin(w, h, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), cmat(0x9fd8ff, { roughness: 0.1, metalness: 0.3 })); m.position.set(x, y, z); return m;
}
function smokeStack(x, z, h, group) {
  const stack = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, h, 12), cmat(0x8d6e63))); stack.position.set(x, h / 2, z); group.add(stack);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.5, 12), cmat(0xffffff)); stripe.position.set(x, h - 0.8, z); group.add(stripe);
  group.userData.smoke = new THREE.Vector3(x, h + 0.2, z);
}

function buildHouses() {
  const g = new THREE.Group();
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), cmat(0x7cc35a, { roughness: 1 })); lawn.rotation.x = -Math.PI / 2; lawn.position.y = 0.01; lawn.receiveShadow = true; g.add(lawn);
  const colors = [0xfff3e0, 0xffe0b2, 0xe1f5fe, 0xf8bbd0, 0xdcedc8];
  for (const [x, z] of [[-3.6, -2.4], [0.2, -2.6], [3.7, -2.2]]) {
    const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 3.2), cmat(colors[Math.floor(Math.random() * colors.length)]))); body.position.set(x, 1.3, z); g.add(body);
    const roof = cshadowed(new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.5, 4), cmat([0xc73e3a, 0x8d6e63, 0x546e7a][Math.floor(Math.random() * 3)]))); roof.rotation.y = Math.PI / 4; roof.position.set(x, 3.3, z); g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.1), cmat(0x5d4037)); door.position.set(x, 0.7, z + 1.65); g.add(door);
    g.add(glassWin(0.7, 0.7, x - 0.9, 1.5, z + 1.65)); g.add(glassWin(0.7, 0.7, x + 0.9, 1.5, z + 1.65));
    const path = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4.2), cmat(0xd7ccc8)); path.rotation.x = -Math.PI / 2; path.position.set(x, 0.02, z + 3.8); g.add(path);
  }
  g.add(tree(-4.8, 3.4, 2.6)); g.add(tree(1.8, 3.9, 2.0)); g.add(tree(4.9, 3.0, 2.4));
  return g;
}

function buildApartments() {
  const g = new THREE.Group();
  const floors = 4 + Math.floor(Math.random() * 3);
  const h = floors * 2.6;
  const w = 9, d = 8;
  const walls = cmat(0xf1e1c8, { map: windowTexture('#e9d8bd', '#3c6f9a', 6, floors) });
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), walls)); body.position.y = h / 2; g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.25, d + 0.3), cmat(0x8d6e63)); roof.position.y = h + 0.12; g.add(roof);
  const tank = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 12), cmat(0x9e9e9e))); tank.position.set(-2.5, h + 0.95, 2); g.add(tank);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.1), cmat(0x5d4037)); door.position.set(0, 1.1, d / 2 + 0.05); g.add(door);
  g.add(tree(-5, 4.5, 2.4)); g.add(tree(5, 4.5, 2.0));
  return g;
}

function buildTower() {
  const g = new THREE.Group();
  const h = 30 + Math.random() * 8;
  const walls = cmat(0xe3eaf2, { map: windowTexture('#cfd8e3', '#3b5b7a', 7, 22) });
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(8, h, 8), walls)); body.position.y = h / 2; g.add(body);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 6), cmat(0x37474f)); crown.position.y = h + 0.8; g.add(crown);
  const podium = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(10.5, 3, 10.5), cmat(0xb0bec5))); podium.position.y = 1.5; g.add(podium);
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 4.2), cmat(0xffffff)); b.position.set(4.25, 6 + k * 6.5, 0); g.add(b); }
  return g;
}

function buildWorkshop() {
  const g = new THREE.Group();
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(9, 3.6, 6), cmat(0xb0bec5))); body.position.set(0, 1.8, -1.5); g.add(body);
  const roof = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 9.2, 16), cmat(0x78909c))); roof.rotation.z = Math.PI / 2; roof.position.set(0, 3.0, -1.5); roof.scale.set(0.45, 1, 1); g.add(roof);
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 0.1), cmat(0x455a64)); doorL.position.set(-2.2, 1.4, 1.55); g.add(doorL);
  const doorR = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 0.1), cmat(0xff8f00)); doorR.position.set(2.2, 1.4, 1.55); g.add(doorR);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, 5), cmat(0x616161)); yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0.01, 3.5); g.add(yard);
  for (const [x, c] of [[-3.5, 0xef5350], [3.6, 0x42a5f5]]) { const van = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.4, 3.2), cmat(c))); van.position.set(x, 0.75, 3.8); g.add(van); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.1), new THREE.MeshBasicMaterial({ map: signTexture('WORKSHOP', '#fff5e1', '#455a64') })); sign.position.set(0, 3.0, 1.56); g.add(sign);
  return g;
}

function buildOffice() {
  const g = new THREE.Group();
  const h = 18 + Math.random() * 6;
  const glass = cmat(0x7fb3d5, { metalness: 0.6, roughness: 0.15, map: windowTexture('#5c8db3', '#c7e6ff', 8, 14) });
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(8, h, 8), glass)); body.position.y = h / 2; g.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.5, 8.4), cmat(0x37474f)); cap.position.y = h + 0.25; g.add(cap);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3, 6), cmat(0x37474f)); antenna.position.y = h + 2; g.add(antenna);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 2 })); beacon.position.y = h + 3.5; g.add(beacon);
  const lobby = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 10), cmat(0x546e7a, { metalness: 0.3, roughness: 0.4 })); lobby.position.y = 1.6; g.add(lobby);
  return g;
}

function buildFactory() {
  const g = new THREE.Group();
  const hall = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(11, 5, 7), cmat(0xa1887f))); hall.position.set(0, 2.5, -1.8); g.add(hall);
  for (let k = -1; k <= 1; k++) { const saw = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 7), cmat(0x8d6e63))); saw.position.set(k * 3.6, 5.7, -1.8); saw.rotation.z = 0.35; g.add(saw); }
  smokeStack(-3.5, 3.0, 9, g);
  const stack2 = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 7, 12), cmat(0x8d6e63))); stack2.position.set(-1.6, 3.5, 3.0); g.add(stack2);
  const tank = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 3.2, 16), cmat(0xcfd8dc))); tank.position.set(3.6, 1.6, 3.2); g.add(tank);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), new THREE.MeshBasicMaterial({ map: signTexture('FACTORY', '#fff5e1', '#5d4037') })); sign.position.set(0, 4.2, 1.71); g.add(sign);
  return g;
}

function buildPark() {
  const g = new THREE.Group();
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), cmat(0x6abf4b, { roughness: 1 })); lawn.rotation.x = -Math.PI / 2; lawn.position.y = 0.01; lawn.receiveShadow = true; g.add(lawn);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.add(tree(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 2 + Math.random() * 1.2)); }
  const basin = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.5, 20), cmat(0xbdbdbd))); basin.position.y = 0.25; g.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.1, 20), cmat(0x4fc3f7, { roughness: 0.1, metalness: 0.2 })); water.position.y = 0.5; g.add(water);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.2, 10), cmat(0xbdbdbd)); spout.position.y = 1.0; g.add(spout);
  g.userData.fountain = new THREE.Vector3(0, 1.7, 0);
  for (const [x, z, r] of [[-3, 0, Math.PI / 2], [3, 0, -Math.PI / 2], [0, -3, 0], [0, 3, Math.PI]]) {
    const bench = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), cmat(0x8d6e63))); bench.position.set(x, 0.5, z); bench.rotation.y = r; g.add(bench);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), cmat(0x8d6e63)); back.position.set(x, 0.8, z); back.rotation.y = r; back.translateZ(-0.22); g.add(back);
  }
  return g;
}

function buildPowerPlant() {
  const g = new THREE.Group();
  const hall = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, 7), cmat(0x90a4ae))); hall.position.set(1.2, 2.75, -1.5); g.add(hall);
  smokeStack(-3.8, -2.5, 11, g);
  for (const x of [-4.4, -2.8]) { const t = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 14), cmat(0xeceff1))); t.position.set(x, 1.3, 3.4); g.add(t); }
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), cmat(0x757575)); yard.rotation.x = -Math.PI / 2; yard.position.y = 0.01; yard.receiveShadow = true; g.add(yard);
  const fence = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 1.2, 0.08), cmat(0xb0bec5, { transparent: true, opacity: 0.6 })); fence.position.set(0, 0.6, BLOCK / 2); g.add(fence);
  // pylon
  const pylon = new THREE.Group();
  for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 8, 6), cmat(0x616161)); leg.position.set(s * 0.6, 4, 0); leg.rotation.z = s * 0.06; pylon.add(leg); }
  for (const y of [5, 6.6, 8]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2 - (y - 5) * 0.5, 0.12, 0.12), cmat(0x616161)); arm.position.y = y; pylon.add(arm); }
  pylon.position.set(3.8, 0, 3.6); g.add(pylon);
  const bolt = labelSprite('⚡', '#ffd54f'); bolt.position.set(1.2, 7.4, -1.5); bolt.scale.set(2.2, 2.2, 1); g.add(bolt);
  return g;
}

function buildSchool() {
  const g = new THREE.Group();
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(10, 4.5, 5), cmat(0xffe0b2, { map: windowTexture('#f2d2a0', '#7fb3d5', 8, 2) }))); body.position.set(0, 2.25, -2.5); g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.3, 5.4), cmat(0xc73e3a)); roof.position.set(0, 4.6, -2.5); g.add(roof);
  const clock = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), cmat(0xfff3e0)); clock.position.set(0, 6, -2.5); g.add(clock);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), cmat(0xffffff)); face.position.set(0, 6.2, -1.49); g.add(face);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, 6), cmat(0xc5e1a5)); yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0.01, 3); yard.receiveShadow = true; g.add(yard);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5, 6), cmat(0xeeeeee)); pole.position.set(-4.5, 2.5, 4.5); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), cmat(0xc73e3a, { side: THREE.DoubleSide })); flag.position.set(-3.8, 4.5, 4.5); g.add(flag);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.1), new THREE.MeshBasicMaterial({ map: signTexture('SCHOOL', '#fff5e1', '#c73e3a') })); sign.position.set(0, 3.6, 0.01); g.add(sign);
  return g;
}

function buildHospital() {
  const g = new THREE.Group();
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(10, 9, 8), cmat(0xffffff, { map: windowTexture('#f4f6f8', '#a9d4ef', 8, 4) }))); body.position.y = 4.5; g.add(body);
  const wing = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 3.5, 4), cmat(0xf5f5f5))); wing.position.set(0, 1.75, 4); g.add(wing);
  for (const [w, h] of [[2.4, 0.7], [0.7, 2.4]]) { const cross = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), new THREE.MeshStandardMaterial({ color: 0xe53935, emissive: 0xe53935, emissiveIntensity: 0.6 })); cross.position.set(0, 7.2, 4.08); g.add(cross); }
  const pad = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), cmat(0x616161)); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 9.02, 0); g.add(pad);
  const hMark = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.2, 24), cmat(0xffffff)); hMark.rotation.x = -Math.PI / 2; hMark.position.set(0, 9.03, 0); g.add(hMark);
  return g;
}

function buildStadium() {
  const g = new THREE.Group();
  const bowl = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.2, 4.5, 28, 1, true), cmat(0xe0e0e0, { side: THREE.DoubleSide }))); bowl.position.y = 2.25; g.add(bowl);
  const pitch = new THREE.Mesh(new THREE.CircleGeometry(4.6, 28), cmat(0x43a047)); pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.6; g.add(pitch);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 3.6, 0.6, 28), cmat(0xc73e3a)); stand.position.y = 0.3; g.add(stand);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 9, 8), cmat(0x9e9e9e)); mast.position.set(Math.cos(a) * 5.6, 4.5, Math.sin(a) * 5.6); g.add(mast);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.3), new THREE.MeshStandardMaterial({ color: 0xfffde7, emissive: 0xfff59d, emissiveIntensity: 1.5 })); lamp.position.set(Math.cos(a) * 5.3, 9, Math.sin(a) * 5.3); lamp.lookAt(0, 3, 0); g.add(lamp);
  }
  return g;
}

function buildShop() {
  const g = new THREE.Group();
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(8, 4, 7), cmat(0xffcc80))); body.position.y = 2; g.add(body);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.1, 1.6), cmat(0xc73e3a)); awning.position.set(0, 3.0, 4.2); awning.rotation.x = 0.25; g.add(awning);
  g.add(glassWin(6, 2, 0, 1.6, 3.55));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshBasicMaterial({ map: signTexture('CORNER SHOP', '#fff5e1', '#2b2f38') })); sign.position.set(0, 3.5, 3.56); g.add(sign);
  return g;
}

function buildMall() {
  const g = new THREE.Group();
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 7, 9), cmat(0xf8bbd0, { map: windowTexture('#f3c9d8', '#b3e5fc', 10, 3) }))); body.position.set(0, 3.5, -1); g.add(body);
  const atrium = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.6, 20), cmat(0x9fd8ff, { roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.8 })); atrium.position.set(0, 7.8, -1); g.add(atrium);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 2.6), cmat(0x37474f)); canopy.position.set(0, 3.6, 4.6); g.add(canopy);
  for (const x of [-3.5, 3.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.6, 8), cmat(0x37474f)); p.position.set(x, 1.8, 5.6); g.add(p); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.4), new THREE.MeshBasicMaterial({ map: signTexture('THE MALL', '#2b2f38', '#ffd166') })); sign.position.set(0, 5.6, 3.51); g.add(sign);
  return g;
}

/** A cart with a giant hot dog on top; `proto` is the fitted Poly hot dog. */
function buildHotDogStand(proto) {
  const g = new THREE.Group();
  const cart = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 1.6), cmat(0xf5f1e8))); cart.position.y = 0.9; g.add(cart);
  for (const s of [-1, 1]) { const wheel = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 14), cmat(0x2b2f38))); wheel.rotation.z = Math.PI / 2; wheel.position.set(s * 1.3, 0.4, 0.9); g.add(wheel); }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), cmat(0x9e9e9e)); pole.position.set(0, 2.5, 0); g.add(pole);
  const umbrella = cshadowed(new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 12, 1, true), cmat(0xc73e3a, { side: THREE.DoubleSide }))); umbrella.position.y = 3.6; g.add(umbrella);
  if (proto) { const dog = proto.clone(true); const s = 2.6 / proto.userData.size.z; dog.scale.setScalar(s); dog.position.set(0, 4.15, 0); dog.rotation.y = Math.PI / 2; g.add(dog); g.userData.spin = dog; }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.8), new THREE.MeshBasicMaterial({ map: signTexture('HOT DOGS', '#fff5e1', '#c73e3a') })); sign.position.set(0, 1.2, 0.81); g.add(sign);
  g.add(tree(-4.5, -3.5, 2.2)); g.add(tree(4.5, 3.5, 2.4));
  return g;
}

/** A drive-through with the jeremy hamburger on the roof. */
function buildBurgerJoint(proto) {
  const g = new THREE.Group();
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 7), cmat(0xffe0b2))); body.position.y = 2.1; g.add(body);
  const band = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.7, 7.2), cmat(0xe53935)); band.position.y = 4.0; g.add(band);
  g.add(glassWin(7, 2, 0, 1.7, 3.55));
  if (proto) { const b = proto.clone(true); const s = 3.2 / proto.userData.size.y; b.scale.setScalar(s); b.position.set(0, 4.4, 0); g.add(b); g.userData.spin = b; }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: signTexture('BURGERS', '#ffd166', '#2b2f38') })); sign.position.set(0, 3.3, 3.56); g.add(sign);
  return g;
}

/** A kebab house with a slowly turning skewer sign. */
function buildKebabHouse(proto) {
  const g = new THREE.Group();
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(8, 5, 7), cmat(0xd7ccc8))); body.position.y = 2.5; g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.4, 7.2), cmat(0x2e7d32)); trim.position.y = 5.0; g.add(trim);
  g.add(glassWin(5, 2.2, 0, 1.8, 3.55));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), cmat(0x9e9e9e)); pole.position.set(0, 6.6, 0); g.add(pole);
  if (proto) { const k = proto.clone(true); const s = 4.5 / proto.userData.size.y; k.scale.setScalar(s); k.position.set(0, 5.3, 0); g.add(k); g.userData.spin = k; }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshBasicMaterial({ map: signTexture('KEBAB HOUSE', '#fff5e1', '#2e7d32') })); sign.position.set(0, 3.9, 3.56); g.add(sign);
  return g;
}

export function buildFor(id, protos) {
  switch (id) {
    case 'house': return buildHouses();
    case 'apartments': return buildApartments();
    case 'tower': return buildTower();
    case 'workshop': return buildWorkshop();
    case 'office': return buildOffice();
    case 'factory': return buildFactory();
    case 'park': return buildPark();
    case 'powerplant': return buildPowerPlant();
    case 'school': return buildSchool();
    case 'hospital': return buildHospital();
    case 'stadium': return buildStadium();
    case 'shop': return buildShop();
    case 'mall': return buildMall();
    case 'hotdogstand': return buildHotDogStand(protos.hotdog);
    case 'burgerjoint': return buildBurgerJoint(protos.hamburger);
    case 'kebabhouse': return buildKebabHouse(protos.kebab);
    default: return new THREE.Group();
  }
}

/** A little car: body, cabin, wheels. */
function buildCar() {
  const g = new THREE.Group();
  const color = [0xef5350, 0x42a5f5, 0xffee58, 0x66bb6a, 0xf5f5f5, 0x8d6e63, 0xab47bc, 0x26c6da][Math.floor(Math.random() * 8)];
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 3.6), cmat(color, { metalness: 0.3, roughness: 0.4 }))); body.position.y = 0.55; g.add(body);
  const cabin = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 1.8), cmat(0x263238, { metalness: 0.5, roughness: 0.2 }))); cabin.position.set(0, 1.1, -0.2); g.add(cabin);
  for (const [x, z] of [[-0.8, 1.2], [0.8, 1.2], [-0.8, -1.2], [0.8, -1.2]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 12), cmat(0x212121)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.32, z); g.add(w); }
  const lights = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0xfff9c4, emissive: 0xfff59d, emissiveIntensity: 1.2 })); lights.position.set(0, 0.6, 1.83); g.add(lights);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 0.1), new THREE.MeshStandardMaterial({ color: 0xb71c1c, emissive: 0xff1744, emissiveIntensity: 1 })); tail.position.set(0, 0.6, -1.83); g.add(tail);
  return g;
}

// ---------------------------------------------------------------- ground
/**
 * Meadow under everything; per block a "cell" (pavement + the half streets
 * around it) that is hidden until its ring of land is bought.
 */
export function buildCityGround(scene) {
  const span = (RADIUS * 2 + 1) * PITCH;
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(span + 160, span + 160), cmat(0x86b95c, { roughness: 1 }));
  meadow.rotation.x = -Math.PI / 2; meadow.position.y = -0.06; meadow.receiveShadow = true; scene.add(meadow);
  const asphaltMat = cmat(0x3a3f47, { roughness: 1 });
  const pavementMat = cmat(0x9aa0a6, { roughness: 1 });
  const outlineMat = cmat(0xb9c0c6, { roughness: 1 });
  const dashMat = cmat(0xf5f1e8);
  const lots = new Map(), cells = new Map(), wild = new Map();
  const half = PITCH / 2, inner = BLOCK / 2 + 2;
  for (let i = -RADIUS; i <= RADIUS; i++) for (let j = -RADIUS; j <= RADIUS; j++) {
    const cx = i * PITCH, cz = j * PITCH;
    const cell = new THREE.Group(); cell.position.set(cx, 0, cz);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(PITCH, PITCH), asphaltMat); road.rotation.x = -Math.PI / 2; road.position.y = -0.03; road.receiveShadow = true; cell.add(road);
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(inner * 2, inner * 2), pavementMat); pave.rotation.x = -Math.PI / 2; pave.position.y = -0.02; pave.receiveShadow = true; cell.add(pave);
    // dashes down the centre of the streets east and south of the block (west/north on the outer rim)
    const edges = [[half, 'z'], [half, 'x']];
    if (i === -RADIUS) edges.push([-half, 'z']);
    if (j === -RADIUS) edges.push([-half, 'x']);
    for (const [off, axis] of edges) for (let s = -half + 1; s < half; s += 3) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(axis === 'z' ? 0.16 : 1.4, axis === 'z' ? 1.4 : 0.16), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.y = -0.025;
      if (axis === 'z') d.position.set(off, -0.025, s); else d.position.set(s, -0.025, off);
      cell.add(d);
    }
    // zebra crossings on the street side of the block
    for (let s = -2.5; s <= 2.5; s += 1) { const z1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 4), dashMat); z1.rotation.x = -Math.PI / 2; z1.position.set(s, -0.024, inner + 2); cell.add(z1); }
    const ring = Math.max(Math.abs(i), Math.abs(j));
    cell.visible = ring <= 1;
    scene.add(cell);
    cells.set(`${i},${j}`, cell);
    if (i === 0 && j === 0) continue; // the diner block
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), outlineMat);
    lot.rotation.x = -Math.PI / 2; lot.position.set(cx, -0.01, cz); lot.receiveShadow = true; lot.visible = cell.visible; scene.add(lot);
    lots.set(`${i},${j}`, lot);
    // wild land: a few trees until the ring is bought
    if (ring > 1) {
      const w = new THREE.Group();
      for (let k = 0; k < 3; k++) w.add(tree(cx + (Math.random() - 0.5) * 14, cz + (Math.random() - 0.5) * 14, 1.8 + Math.random() * 1.6));
      scene.add(w); wild.set(`${i},${j}`, w);
    }
  }
  // distant tree line so the horizon isn't bare
  for (let k = 0; k < 90; k++) { const a = Math.random() * Math.PI * 2, r = span / 2 + 12 + Math.random() * 40; scene.add(tree(Math.cos(a) * r, Math.sin(a) * r, 3 + Math.random() * 3)); }
  // highlight square for placement
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK + 0.6, BLOCK + 0.6), new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.35, depthWrite: false }));
  hl.rotation.x = -Math.PI / 2; hl.position.y = 0.02; hl.visible = false; scene.add(hl);
  // selection ring for a clicked building
  const sel = new THREE.Mesh(new THREE.RingGeometry(BLOCK / 2 + 0.6, BLOCK / 2 + 1.2, 40), new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.8, depthWrite: false }));
  sel.rotation.x = -Math.PI / 2; sel.position.y = 0.04; sel.visible = false; scene.add(sel);
  return { lots, cells, wild, highlight: hl, select: sel };
}

// ---------------------------------------------------------------- city sim
export class City {
  constructor(game) {
    this.game = game;
    this.buildings = new Map(); // "i,j" -> { i, j, type, level, obj, powered }
    this.citizens = [];
    this.cars = [];
    this.ground = buildCityGround(game.scene);
    this.placing = null;   // building id while in build mode; 'bulldoze' for the wrecking ball
    this.rings = 1;        // rings of land owned (1 = the 3x3 around the diner)
    this.pop = 0;          // people living here (float; grows toward capacity)
    this.popShown = 0;
    this.eventTimer = 90;
    this.boost = null;     // { name, mult, t } from a city event
    this.income = 0;
    this.cache = null;
  }
  key(i, j) { return `${i},${j}`; }
  ring(i, j) { return Math.max(Math.abs(i), Math.abs(j)); }
  inGrid(i, j) { return Math.abs(i) <= RADIUS && Math.abs(j) <= RADIUS && !(i === 0 && j === 0); }
  owned(i, j) { return this.inGrid(i, j) && this.ring(i, j) <= this.rings; }
  tileAt(x, z) { return [Math.round(x / PITCH), Math.round(z / PITCH)]; }
  tileCenter(i, j) { return new THREE.Vector3(i * PITCH, 0, j * PITCH); }
  canBuild(i, j) { return this.owned(i, j) && !this.buildings.has(this.key(i, j)); }
  rank() { let r = RANKS[0]; for (const k of RANKS) if (this.pop >= k.pop) r = k; return r; }
  nextRank() { return RANKS.find((k) => k.pop > this.pop) ?? null; }
  unlocked(def) { return def.rank <= this.rank().id; }
  nextRingCost() { return this.rings < RADIUS ? RING_COST[this.rings + 1] : null; }
  span() { return (this.rings * 2 + 1) * PITCH; }

  place(i, j, type, { silent = false, level = 1 } = {}) {
    if (!this.canBuild(i, j)) return null;
    const def = BUILDING_BY_ID[type];
    if (!def) return null;
    const obj = buildFor(type, this.game.foodProtos());
    obj.position.copy(this.tileCenter(i, j));
    this.game.scene.add(obj);
    const b = { i, j, type, level, obj, powered: true, fill: 1 };
    this.buildings.set(this.key(i, j), b);
    const lot = this.ground.lots.get(this.key(i, j));
    if (lot) lot.visible = false;
    if (!silent) this.game.fx.confetti(obj.position.clone().add(new THREE.Vector3(0, 4, 0)), 30);
    this.cache = null;
    return b;
  }

  remove(b) {
    this.game.scene.remove(b.obj);
    this.buildings.delete(this.key(b.i, b.j));
    const lot = this.ground.lots.get(this.key(b.i, b.j));
    if (lot) lot.visible = true;
    this.cache = null;
  }

  levelUp(b) {
    if (b.level >= MAX_LEVEL) return false;
    b.level += 1;
    const s = 1 + (b.level - 1) * 0.12;
    b.obj.scale.set(s, 1 + (b.level - 1) * 0.25, s);
    this.game.fx.sparkle(b.obj.position.clone().add(new THREE.Vector3(0, 5, 0)), 20);
    this.cache = null;
    return true;
  }

  buyRing() {
    if (this.rings >= RADIUS) return false;
    this.rings += 1;
    for (const [k, cell] of this.ground.cells) {
      const [i, j] = k.split(',').map(Number);
      if (this.ring(i, j) === this.rings) {
        cell.visible = true;
        const lot = this.ground.lots.get(k); if (lot) lot.visible = !this.buildings.has(k);
        const w = this.ground.wild.get(k); if (w) { this.game.scene.remove(w); this.ground.wild.delete(k); }
      }
    }
    this.cache = null;
    return true;
  }

  clear() {
    for (const b of [...this.buildings.values()]) this.remove(b);
    for (const c of this.citizens) this.game.scene.remove(c.rig.obj);
    this.citizens = [];
    for (const c of this.cars) this.game.scene.remove(c.obj);
    this.cars = [];
    // give the land back
    while (this.rings > 1) {
      for (const [k, cell] of this.ground.cells) {
        const [i, j] = k.split(',').map(Number);
        if (this.ring(i, j) === this.rings) { cell.visible = false; const lot = this.ground.lots.get(k); if (lot) lot.visible = false; }
      }
      this.rings -= 1;
    }
    this.pop = 0; this.popShown = 0; this.boost = null; this.eventTimer = 90;
    this.cache = null;
  }

  serialize() { return { buildings: [...this.buildings.values()].map((b) => ({ i: b.i, j: b.j, type: b.type, level: b.level })), pop: this.pop, rings: this.rings }; }
  restore(data) {
    if (!data) return;
    const list = Array.isArray(data) ? data : data.buildings ?? [];
    const rings = Array.isArray(data) ? 2 : data.rings ?? 1;
    while (this.rings < rings) this.buyRing();
    for (const b of list) {
      if (!BUILDING_BY_ID[b.type]) continue;
      const placed = this.place(b.i, b.j, b.type, { silent: true });
      if (placed) for (let l = 1; l < (b.level ?? 1); l++) this.levelUp(placed);
    }
    this.pop = Array.isArray(data) ? this.stats().housing : data.pop ?? 0;
    this.popShown = Math.floor(this.pop);
    this.cache = null;
  }

  /** Everything the HUD and the sim need, computed once per tick. */
  stats() {
    if (this.cache) return this.cache;
    const st = { housing: 0, jobs: 0, power: FREE_POWER, powerUsed: 0, happyBase: 50, growth: 1, foodCap: 0, customersCap: 0, foodBoost: 0, buildings: this.buildings.size, byType: {} };
    // power: buildings are powered in the order they were built; plants always run
    const ordered = [...this.buildings.values()];
    for (const b of ordered) { const d = BUILDING_BY_ID[b.type]; if (d.power) st.power += d.power * LEVEL_MULT[b.level - 1]; }
    let used = 0;
    for (const b of ordered) {
      const d = BUILDING_BY_ID[b.type];
      if (d.power) { b.powered = true; continue; }
      used += 1;
      b.powered = used <= st.power;
    }
    st.powerUsed = used;
    const diner = this.game.stars();
    for (const b of ordered) {
      const d = BUILDING_BY_ID[b.type];
      const m = LEVEL_MULT[b.level - 1];
      st.byType[b.type] = (st.byType[b.type] ?? 0) + 1;
      if (d.happy && d.happy < 0) st.happyBase += d.happy;            // pollution counts even without power
      if (!b.powered) continue;
      if (d.housing) st.housing += d.housing * m;
      if (d.jobs) st.jobs += Math.round(d.jobs * m);
      if (d.happy && d.happy > 0) st.happyBase += d.happy * (1 + (b.level - 1) * 0.3);
      if (d.growth) st.growth += d.growth;
      if (d.customers) { st.customersCap += d.customers * m; if (d.food) st.foodCap += d.customers * m; }
      if (d.foodBoost) st.foodBoost += d.foodBoost;
    }
    // the diner is the town's own restaurant: it feeds people too, more with a better rating
    st.foodCap += 4 + diner * 2;
    st.customersCap += 4 + diner * 2;
    const pop = this.pop;
    st.population = Math.floor(pop);
    st.workforce = Math.round(pop * 0.55);
    st.employed = Math.min(st.workforce, st.jobs);
    st.unemployed = st.workforce - st.employed;
    st.openJobs = st.jobs - st.employed;
    // demand for food and shopping, in customers per minute
    st.demand = 3 + pop * 0.08 + st.employed * 0.1;
    st.foodDemand = 2 + pop * 0.06 + st.employed * 0.1;
    st.fill = st.customersCap > 0 ? Math.min(1, st.demand / st.customersCap) : 0;
    // happiness
    let happy = st.happyBase + diner * 3;
    st.hunger = st.foodCap > 0 ? Math.max(0, st.foodDemand / st.foodCap - 1) : 1;
    happy -= Math.min(25, st.hunger * 40);
    if (pop > 0) happy -= Math.min(30, (st.unemployed / pop) * 55);
    if (st.powerUsed > st.power) happy -= Math.min(20, (st.powerUsed - st.power) * 3);
    if (pop > 300) happy -= Math.min(10, (pop - 300) / 100); // big-city bustle
    st.happiness = Math.round(Math.max(5, Math.min(100, happy)));
    // income per minute
    const hm = st.happiness / 100;
    st.tax = pop * 0.6 * hm;
    st.wages = 0; st.sales = 0;
    for (const b of ordered) {
      const d = BUILDING_BY_ID[b.type];
      if (!b.powered) { b.fill = 0; continue; }
      const m = LEVEL_MULT[b.level - 1];
      const jobFill = st.jobs > 0 ? st.employed / st.jobs : 0;
      if (d.jobPay && d.jobs) st.wages += d.jobs * m * jobFill * d.jobPay;
      if (d.customers) { b.fill = st.fill; st.sales += d.customers * m * d.price * st.fill * (d.food ? 1 + st.foodBoost : 1); }
    }
    const eventMult = this.boost ? this.boost.mult : 1;
    st.income = Math.round((st.tax + st.wages + st.sales) * eventMult * 10) / 10;
    // demand meters (0..1) for the HUD: what the city wants next
    st.wantHomes = st.housing > 0 ? Math.max(0, Math.min(1, (pop / st.housing - 0.7) / 0.3)) : 1;
    st.wantJobs = st.workforce > 0 ? Math.max(0, Math.min(1, st.unemployed / Math.max(6, st.workforce * 0.5))) : 0;
    st.wantFood = Math.max(0, Math.min(1, st.foodDemand / st.foodCap - 0.8));
    // people move toward this many
    st.target = st.happiness >= 40 ? st.housing : Math.min(st.housing, pop * 0.8);
    this.cache = st;
    return st;
  }

  /** Called every sim tick: grow, bank income, spin signs, keep the streets busy. */
  update(dt) {
    this.cache = null;
    const st = this.stats();
    this.income = st.income;
    const g = this.game;
    if (st.income > 0) { const inc = (st.income / 60) * dt; g.s.cash += inc; g.s.stats.earnedTotal += inc; g.s.stats.cityEarned = (g.s.stats.cityEarned ?? 0) + inc; g.s.stats.cityToday = (g.s.stats.cityToday ?? 0) + inc; }
    // population drifts toward the target: quickly when happy and there are jobs, slowly otherwise
    const gap = st.target - this.pop;
    if (gap > 0) {
      const jobsFactor = 0.35 + 0.65 * Math.min(1, (st.openJobs + 4) / Math.max(4, gap * 0.55));
      const rate = (0.05 + gap * 0.012) * (st.happiness / 70) * st.growth * jobsFactor;
      this.pop = Math.min(st.target, this.pop + rate * dt);
    } else if (gap < 0) {
      this.pop = Math.max(st.target, this.pop - (0.1 + -gap * 0.02) * dt);
    }
    const shown = Math.floor(this.pop);
    if (shown >= this.popShown + 5) { this.popShown = shown; g.cityFloat(`+${shown - (this.lastFloatPop ?? 0)} residents`, 'good'); this.lastFloatPop = shown; }
    else if (shown <= this.popShown - 5) { this.popShown = shown; g.cityFloat('residents are leaving', 'bad'); this.lastFloatPop = shown; }
    // rank ups
    const rank = this.rank();
    if (rank.id > (this.lastRank ?? 0)) { this.lastRank = rank.id; g.onRankUp(rank); }
    // building animation: signs, smoke, fountains, unpowered flags
    for (const b of this.buildings.values()) {
      if (b.obj.userData.spin) b.obj.userData.spin.rotation.y += dt * 0.8;
      if (b.obj.userData.smoke && b.powered && Math.random() < dt * 2.5) g.fx.smoke(b.obj.position.clone().add(b.obj.userData.smoke));
      if (b.obj.userData.fountain && Math.random() < dt * 4) g.fx.sparkle(b.obj.position.clone().add(b.obj.userData.fountain), 1);
      if (!b.powered && !b.flag) { b.flag = labelSprite('⚡', '#ff5252'); b.flag.position.y = 6; b.obj.add(b.flag); }
      if (b.powered && b.flag) { b.obj.remove(b.flag); b.flag = null; }
      if (b.flag) b.flag.material.opacity = 0.6 + 0.4 * Math.sin(g.time * 4);
    }
    // events
    if (this.boost) { this.boost.t -= dt; if (this.boost.t <= 0) { this.boost = null; g.toast('The festival is over.', 'info'); } }
    this.eventTimer -= dt;
    if (this.eventTimer <= 0 && st.population >= 20) { this.eventTimer = 150 + Math.random() * 120; this.randomEvent(st); }
    this.updateCitizens(dt, st);
    this.updateCars(dt, st);
  }

  randomEvent(st) {
    const g = this.game;
    const roll = Math.random();
    if (roll < 0.4) { this.boost = { name: 'Street food festival', mult: 1.6, t: 60 }; g.toast('🎪 Street food festival! City income ×1.6 for a minute.', 'warn', 4500); g.fx.confetti(new THREE.Vector3(0, 8, 0), 80); }
    else if (roll < 0.7) { const n = Math.min(12, Math.floor(st.housing - this.pop)); if (n > 2) { this.pop += n; g.toast(`🚚 ${n} newcomers moved in today.`, 'good', 3500); } else { this.boost = { name: 'Tourist coach', mult: 1.3, t: 45 }; g.toast('🚌 A tourist coach arrived. Sales ×1.3 for a while.', 'good', 3500); } }
    else { const bonus = Math.round(20 + st.population * 1.5); g.s.cash += bonus; g.toast(`🏛️ Government grant: ${g.fmt(bonus)} for your ${this.rank().name.toLowerCase()}.`, 'good', 3500); }
  }

  // -- streets ---------------------------------------------------------
  /** Pavement on the north side of the street below tile row j. */
  streetZ(v) { return (Math.floor(v / PITCH) + 0.5) * PITCH - 3.5; }
  /** The pavement point in front of a block (its south edge, on the street side). */
  doorstep(i, j) { return new THREE.Vector3(i * PITCH + (Math.random() - 0.5) * 6, 0, j * PITCH + BLOCK / 2 + 1.2); }

  updateCitizens(dt, st) {
    const wanted = Math.min(24, Math.floor(st.population / 5) + (this.buildings.size ? 1 : 0));
    if (this.citizens.length < wanted && Math.random() < dt * 0.8) this.spawnCitizen();
    if (this.citizens.length > wanted + 4) { const c = this.citizens.pop(); this.game.scene.remove(c.rig.obj); }
    for (const c of this.citizens) {
      c.rig.update(dt);
      if (!c.route.length) { this.newRoute(c); continue; }
      const target = c.route[0];
      const dx = target.x - c.rig.obj.position.x, dz = target.z - c.rig.obj.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) {
        c.route.shift();
        if (!c.route.length) {
          if (c.toDiner) { this.arriveAtDiner(c); continue; }
          c.rest = 1 + Math.random() * 3;
        }
        continue;
      }
      if (c.rest > 0) { c.rest -= dt; c.rig.play('idle'); continue; }
      const step = Math.min(dist, c.speed * dt);
      c.rig.obj.position.x += (dx / dist) * step; c.rig.obj.position.z += (dz / dist) * step;
      c.rig.obj.rotation.y = Math.atan2(dx, dz);
      c.rig.play('walk');
    }
    this.citizens = this.citizens.filter((c) => !c.dead);
  }

  spawnCitizen() {
    const all = [...this.buildings.values()];
    const homes = all.filter((b) => BUILDING_BY_ID[b.type].housing);
    const from = homes.length ? homes[Math.floor(Math.random() * homes.length)] : all[Math.floor(Math.random() * all.length)];
    const rig = this.game.makeCitizenRig();
    if (!rig) return;
    const start = from ? this.doorstep(from.i, from.j) : new THREE.Vector3(PITCH, 0, PITCH / 2 - 3.5);
    rig.obj.position.copy(start);
    const c = { rig, route: [], rest: 0, speed: 1.4 + Math.random() * 0.6, toDiner: false, dead: false, home: from };
    this.citizens.push(c);
    this.newRoute(c);
  }

  /** Manhattan route along the street grid to another block's doorstep, or to the diner door. */
  newRoute(c) {
    const targets = [...this.buildings.values()].filter((b) => b !== c.home);
    const goDiner = Math.random() < 0.3;
    let dest, isDiner = false;
    if (goDiner) { dest = new THREE.Vector3(-9.0, 0, 8.5); isDiner = true; }
    else if (targets.length) { const b = targets[Math.floor(Math.random() * targets.length)]; dest = this.doorstep(b.i, b.j); }
    else if (c.home) dest = this.doorstep(c.home.i, c.home.j);
    else dest = new THREE.Vector3(-PITCH, 0, PITCH / 2 - 3.5);
    const p = c.rig.obj.position;
    const z1 = this.streetZ(p.z), z2 = this.streetZ(dest.z);
    const route = [new THREE.Vector3(p.x, 0, z1)];
    if (Math.abs(z2 - z1) > 0.1) { const xs = (Math.floor(dest.x / PITCH) + 0.5) * PITCH - 3.5; route.push(new THREE.Vector3(xs, 0, z1)); route.push(new THREE.Vector3(xs, 0, z2)); }
    route.push(new THREE.Vector3(dest.x, 0, z2));
    route.push(dest);
    c.route = route; c.toDiner = isDiner;
  }

  arriveAtDiner(c) {
    c.dead = true;
    this.game.scene.remove(c.rig.obj);
    if (this.game.customers.length >= 26) return;
    const guest = this.game.spawnCustomer();
    guest.obj.position.copy(c.rig.obj.position);
    guest.fromCity = true;
  }

  // -- traffic ---------------------------------------------------------
  /** Cars drive the street grid inside the land you own, turning at random at intersections. */
  updateCars(dt, st) {
    const wanted = Math.min(28, 2 + Math.floor(st.population / 12) + Math.floor(st.employed / 20));
    if (this.cars.length < wanted && Math.random() < dt * 0.7) this.spawnCar();
    while (this.cars.length > wanted + 3) { const c = this.cars.pop(); this.game.scene.remove(c.obj); }
    const lim = this.rings * PITCH + PITCH / 2; // street lines run from -lim to lim
    for (const c of this.cars) {
      c.pos += c.dir * c.speed * dt;
      // intersections sit at (k + 0.5) * PITCH; maybe turn when crossing one
      const k = Math.floor((c.pos - PITCH / 2) / PITCH);
      if (k !== c.lastK) {
        c.lastK = k;
        const cross = (k + 0.5) * PITCH;
        if (Math.abs(cross) <= lim - PITCH && Math.random() < 0.35) {
          // turn onto the crossing street
          const newLine = cross;
          const newPos = c.line;
          c.axis = c.axis === 'x' ? 'z' : 'x';
          c.line = newLine; c.pos = newPos; c.dir = Math.random() < 0.5 ? 1 : -1;
          c.lastK = Math.floor((c.pos - PITCH / 2) / PITCH);
        }
      }
      if (c.pos > lim + 4 || c.pos < -lim - 4) { c.dir *= -1; c.pos = Math.max(-lim - 4, Math.min(lim + 4, c.pos)); }
      const lane = 1.5 * c.dir; // drive on the right
      if (c.axis === 'x') { c.obj.position.set(c.pos, 0, c.line + lane); c.obj.rotation.y = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { c.obj.position.set(c.line - lane, 0, c.pos); c.obj.rotation.y = c.dir > 0 ? 0 : Math.PI; }
    }
  }

  spawnCar() {
    const lines = [];
    for (let k = -this.rings; k < this.rings; k++) lines.push((k + 0.5) * PITCH);
    const line = lines[Math.floor(Math.random() * lines.length)];
    const lim = this.rings * PITCH + PITCH / 2;
    const car = { obj: buildCar(), axis: Math.random() < 0.5 ? 'x' : 'z', line, pos: (Math.random() * 2 - 1) * lim, dir: Math.random() < 0.5 ? 1 : -1, speed: 5 + Math.random() * 4, lastK: null };
    this.game.scene.add(car.obj);
    this.cars.push(car);
  }
}
