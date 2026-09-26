// The city around the diner: a grid of blocks you can build on. Buildings add
// population, jobs and happiness, earn money, and send citizens walking the
// streets, some of whom drop into the diner.

import * as THREE from 'three';

export const PITCH = 22;          // block-to-block distance (12 m block + pavement + 6 m street)
export const BLOCK = 12;          // buildable square per block
export const RADIUS = 2;          // blocks from the diner in each direction (5x5 grid)

const cmat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
const cshadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

export const BUILDINGS = [
  { id: 'apartments', name: 'Apartments', icon: '🏢', cost: 350, desc: 'Home to 12 citizens. More people means more walk-ins everywhere.', population: 12, income: 3 },
  { id: 'office', name: 'Office block', icon: '🏬', cost: 650, desc: '20 jobs. Workers eat out: lunch rush at every food business.', jobs: 20, income: 6 },
  { id: 'park', name: 'City park', icon: '🌳', cost: 300, desc: 'Trees, a fountain and benches. +10% happiness, which multiplies all city income.', happiness: 10 },
  { id: 'shop', name: 'Corner shop', icon: '🛒', cost: 300, desc: 'Earns from foot traffic.', income: 7 },
  { id: 'hotdogstand', name: 'Hot dog stand', icon: '🌭', cost: 220, desc: 'A cart with a giant hot dog on top. Cheap and cheerful.', income: 5, food: true },
  { id: 'burgerjoint', name: 'Burger joint', icon: '🍔', cost: 520, desc: 'A drive-through with a rooftop burger. Big earner near offices.', income: 10, food: true },
  { id: 'kebabhouse', name: 'Kebab house', icon: '🍢', cost: 480, desc: 'A spinning skewer sign that pulls people in.', income: 9, food: true },
];
export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

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

// ---------------------------------------------------------------- builders
function tree(x, z, h = 2.2) {
  const g = new THREE.Group();
  const trunk = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h * 0.4, 8), cmat(0x6d4c41))); trunk.position.y = h * 0.2; g.add(trunk);
  const crown = cshadowed(new THREE.Mesh(new THREE.ConeGeometry(0.9, h * 0.8, 9), cmat(0x3f8f4a + Math.floor(Math.random() * 0x001500)))); crown.position.y = h * 0.7; g.add(crown);
  g.position.set(x, 0, z);
  return g;
}

export function buildApartments() {
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

export function buildOffice() {
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

export function buildPark() {
  const g = new THREE.Group();
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), cmat(0x6abf4b, { roughness: 1 })); lawn.rotation.x = -Math.PI / 2; lawn.position.y = 0.01; lawn.receiveShadow = true; g.add(lawn);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.add(tree(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 2 + Math.random() * 1.2)); }
  const basin = cshadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.5, 20), cmat(0xbdbdbd))); basin.position.y = 0.25; g.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.1, 20), cmat(0x4fc3f7, { roughness: 0.1, metalness: 0.2 })); water.position.y = 0.5; g.add(water);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.2, 10), cmat(0xbdbdbd)); spout.position.y = 1.0; g.add(spout);
  for (const [x, z, r] of [[-3, 0, Math.PI / 2], [3, 0, -Math.PI / 2], [0, -3, 0], [0, 3, Math.PI]]) {
    const bench = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), cmat(0x8d6e63))); bench.position.set(x, 0.5, z); bench.rotation.y = r; g.add(bench);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), cmat(0x8d6e63)); back.position.set(x, 0.8, z); back.rotation.y = r; back.translateZ(-0.22); g.add(back);
  }
  return g;
}

export function buildShop() {
  const g = new THREE.Group();
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(8, 4, 7), cmat(0xffcc80))); body.position.y = 2; g.add(body);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.1, 1.6), cmat(0xc73e3a)); awning.position.set(0, 3.0, 4.2); awning.rotation.x = 0.25; g.add(awning);
  const win = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 0.1), cmat(0x9fd8ff, { roughness: 0.1, metalness: 0.3 })); win.position.set(0, 1.6, 3.55); g.add(win);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshBasicMaterial({ map: signTexture('CORNER SHOP', '#fff5e1', '#2b2f38') })); sign.position.set(0, 3.5, 3.56); g.add(sign);
  return g;
}

/** A cart with a giant hot dog on top; `proto` is the fitted Poly hot dog. */
export function buildHotDogStand(proto) {
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
export function buildBurgerJoint(proto) {
  const g = new THREE.Group();
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 7), cmat(0xffe0b2))); body.position.y = 2.1; g.add(body);
  const band = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.7, 7.2), cmat(0xe53935)); band.position.y = 4.0; g.add(band);
  const win = new THREE.Mesh(new THREE.BoxGeometry(7, 2, 0.1), cmat(0x9fd8ff, { roughness: 0.1, metalness: 0.3 })); win.position.set(0, 1.7, 3.55); g.add(win);
  if (proto) { const b = proto.clone(true); const s = 3.2 / proto.userData.size.y; b.scale.setScalar(s); b.position.set(0, 4.4, 0); g.add(b); g.userData.spin = b; }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshBasicMaterial({ map: signTexture('BURGERS', '#ffd166', '#2b2f38') })); sign.position.set(0, 3.3, 3.56); g.add(sign);
  return g;
}

/** A kebab house with a slowly turning skewer sign. */
export function buildKebabHouse(proto) {
  const g = new THREE.Group();
  const body = cshadowed(new THREE.Mesh(new THREE.BoxGeometry(8, 5, 7), cmat(0xd7ccc8))); body.position.y = 2.5; g.add(body);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.4, 7.2), cmat(0x2e7d32)); trim.position.y = 5.0; g.add(trim);
  const win = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 0.1), cmat(0x9fd8ff, { roughness: 0.1, metalness: 0.3 })); win.position.set(0, 1.8, 3.55); g.add(win);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), cmat(0x9e9e9e)); pole.position.set(0, 6.6, 0); g.add(pole);
  if (proto) { const k = proto.clone(true); const s = 4.5 / proto.userData.size.y; k.scale.setScalar(s); k.position.set(0, 5.3, 0); g.add(k); g.userData.spin = k; }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshBasicMaterial({ map: signTexture('KEBAB HOUSE', '#fff5e1', '#2e7d32') })); sign.position.set(0, 3.9, 3.56); g.add(sign);
  return g;
}

export function buildFor(id, protos) {
  switch (id) {
    case 'apartments': return buildApartments();
    case 'office': return buildOffice();
    case 'park': return buildPark();
    case 'shop': return buildShop();
    case 'hotdogstand': return buildHotDogStand(protos.hotdog);
    case 'burgerjoint': return buildBurgerJoint(protos.hamburger);
    case 'kebabhouse': return buildKebabHouse(protos.kebab);
    default: return new THREE.Group();
  }
}

// ---------------------------------------------------------------- ground
/** Asphalt streets, pavements and block outlines for the whole city grid. */
export function buildCityGround(scene) {
  const span = (RADIUS * 2 + 1) * PITCH;
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(span + 20, span + 20), cmat(0x3a3f47, { roughness: 1 }));
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.y = -0.03; asphalt.receiveShadow = true; scene.add(asphalt);
  const pavementMat = cmat(0x9aa0a6, { roughness: 1 });
  const outlineMat = cmat(0xb9c0c6, { roughness: 1 });
  const lots = new Map();
  for (let i = -RADIUS; i <= RADIUS; i++) for (let j = -RADIUS; j <= RADIUS; j++) {
    const cx = i * PITCH, cz = j * PITCH;
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK + 4, BLOCK + 4), pavementMat);
    pave.rotation.x = -Math.PI / 2; pave.position.set(cx, -0.02, cz); pave.receiveShadow = true; scene.add(pave);
    if (i === 0 && j === 0) continue; // the diner block
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK, BLOCK), outlineMat);
    lot.rotation.x = -Math.PI / 2; lot.position.set(cx, -0.01, cz); lot.receiveShadow = true; scene.add(lot);
    lots.set(`${i},${j}`, lot);
  }
  // dashed centre lines along every street
  const dashMat = cmat(0xf5f1e8);
  for (let k = -RADIUS; k < RADIUS; k++) {
    const c = (k + 0.5) * PITCH;
    for (let s = -span / 2; s < span / 2; s += 3) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.16), dashMat); d1.rotation.x = -Math.PI / 2; d1.position.set(s, -0.025, c); scene.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.4), dashMat); d2.rotation.x = -Math.PI / 2; d2.position.set(c, -0.025, s); scene.add(d2);
    }
  }
  // highlight square for placement
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK + 0.6, BLOCK + 0.6), new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.35, depthWrite: false }));
  hl.rotation.x = -Math.PI / 2; hl.position.y = 0.02; hl.visible = false; scene.add(hl);
  return { lots, highlight: hl };
}

// ---------------------------------------------------------------- city sim
export class City {
  constructor(game) {
    this.game = game;
    this.buildings = new Map(); // "i,j" -> { i, j, type, obj }
    this.citizens = [];
    this.ground = buildCityGround(game.scene);
    this.placing = null; // building id while in build mode
    this.income = 0;
  }
  key(i, j) { return `${i},${j}`; }
  inGrid(i, j) { return Math.abs(i) <= RADIUS && Math.abs(j) <= RADIUS && !(i === 0 && j === 0); }
  tileAt(x, z) { return [Math.round(x / PITCH), Math.round(z / PITCH)]; }
  tileCenter(i, j) { return new THREE.Vector3(i * PITCH, 0, j * PITCH); }
  canBuild(i, j) { return this.inGrid(i, j) && !this.buildings.has(this.key(i, j)); }

  place(i, j, type, { silent = false } = {}) {
    if (!this.canBuild(i, j)) return null;
    const def = BUILDING_BY_ID[type];
    if (!def) return null;
    const obj = buildFor(type, this.game.foodProtos());
    obj.position.copy(this.tileCenter(i, j));
    this.game.scene.add(obj);
    const b = { i, j, type, obj };
    this.buildings.set(this.key(i, j), b);
    const lot = this.ground.lots.get(this.key(i, j));
    if (lot) lot.visible = false;
    if (!silent) this.game.fx.confetti(obj.position.clone().add(new THREE.Vector3(0, 4, 0)), 30);
    return b;
  }

  clear() {
    for (const b of this.buildings.values()) { this.game.scene.remove(b.obj); const lot = this.ground.lots.get(this.key(b.i, b.j)); if (lot) lot.visible = true; }
    this.buildings.clear();
    for (const c of this.citizens) this.game.scene.remove(c.rig.obj);
    this.citizens = [];
  }

  serialize() { return [...this.buildings.values()].map((b) => ({ i: b.i, j: b.j, type: b.type })); }
  restore(list) { for (const b of list ?? []) this.place(b.i, b.j, b.type, { silent: true }); }

  stats() {
    let population = 0, jobs = 0, happiness = 55, income = 0, food = 0;
    for (const b of this.buildings.values()) {
      const d = BUILDING_BY_ID[b.type];
      population += d.population ?? 0; jobs += d.jobs ?? 0; happiness += d.happiness ?? 0; if (d.food) food++;
    }
    const diner = this.game.stars() * 5; // a great diner lifts the whole neighbourhood
    happiness = Math.min(100, happiness + diner);
    const traffic = 0.5 + population / 60 + jobs / 80;
    for (const b of this.buildings.values()) {
      const d = BUILDING_BY_ID[b.type];
      if (d.income) income += d.income * traffic * (happiness / 100) * (d.food ? 1 + jobs / 100 : 1);
    }
    return { population, jobs, happiness: Math.round(happiness), income: Math.round(income * 10) / 10, food, buildings: this.buildings.size };
  }

  /** Called every sim tick: bank city income, keep citizens walking, spin signs. */
  update(dt) {
    const st = this.stats();
    this.income = st.income;
    if (st.income > 0) { this.game.s.cash += (st.income / 60) * dt; this.game.s.stats.earnedTotal += (st.income / 60) * dt; this.game.s.stats.cityEarned = (this.game.s.stats.cityEarned ?? 0) + (st.income / 60) * dt; }
    for (const b of this.buildings.values()) if (b.obj.userData.spin) b.obj.userData.spin.rotation.y += dt * 0.8;
    this.updateCitizens(dt, st);
  }

  // citizens walk block to block along the streets; some head for the diner
  updateCitizens(dt, st) {
    const wanted = Math.min(14, Math.floor(st.population / 6));
    if (this.citizens.length < wanted && this.buildings.size && Math.random() < dt * 0.6) this.spawnCitizen();
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
    const homes = [...this.buildings.values()].filter((b) => b.type === 'apartments');
    const from = homes.length ? homes[Math.floor(Math.random() * homes.length)] : [...this.buildings.values()][0];
    const rig = this.game.makeCitizenRig();
    if (!rig) return;
    const start = this.doorstep(from.i, from.j);
    rig.obj.position.copy(start);
    const c = { rig, route: [], rest: 0, speed: 1.4 + Math.random() * 0.6, toDiner: false, dead: false, home: from };
    this.citizens.push(c);
    this.newRoute(c);
  }

  /** The pavement point in front of a block (its south edge, on the street side). */
  doorstep(i, j) { return new THREE.Vector3(i * PITCH + (Math.random() - 0.5) * 6, 0, j * PITCH + BLOCK / 2 + 1.2); }

  /** Manhattan route along the street grid from the citizen to a block's doorstep, or to the diner door. */
  newRoute(c) {
    const targets = [...this.buildings.values()].filter((b) => b !== c.home);
    const goDiner = Math.random() < 0.35;
    let dest, isDiner = false;
    if (goDiner) { dest = new THREE.Vector3(-9.0, 0, 8.5); isDiner = true; }
    else if (targets.length) { const b = targets[Math.floor(Math.random() * targets.length)]; dest = this.doorstep(b.i, b.j); }
    else dest = this.doorstep(c.home.i, c.home.j);
    const p = c.rig.obj.position;
    // walk to the nearest street line (horizontal), then along it, then up/down to the destination
    const streetZ = (v) => (Math.floor(v / PITCH) + 0.5) * PITCH - 3.5; // the pavement on the north side of the street
    const z1 = streetZ(p.z), z2 = streetZ(dest.z);
    const route = [new THREE.Vector3(p.x, 0, z1)];
    if (Math.abs(z2 - z1) > 0.1) { const xs = (Math.floor(dest.x / PITCH) + 0.5) * PITCH - 3.5; route.push(new THREE.Vector3(xs, 0, z1)); route.push(new THREE.Vector3(xs, 0, z2)); }
    route.push(new THREE.Vector3(dest.x, 0, z2));
    route.push(dest);
    c.route = route; c.toDiner = isDiner;
  }

  arriveAtDiner(c) {
    c.dead = true;
    this.game.scene.remove(c.rig.obj);
    const guest = this.game.spawnCustomer();
    guest.obj.position.copy(c.rig.obj.position);
    guest.fromCity = true;
  }
}
