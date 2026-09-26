// Short Order Tycoon: run a diner. Guests queue at the register, the cashier
// takes their money, the kitchen cooks, the runner carries plates to the
// pickup counter, and the cash stack on the register grows until you bank it.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadModelFitted, parseGLTF, fitModel, applyClipPose } from './glb-loader.js';
import { Sfx, Music, Ambience } from './audio.js';
import { Fx } from './fx.js';
import { NavGrid, MASK, separate } from './nav.js';
import { L, COUNTER_TOP, buildWorld, buildTable, buildCustomer, buildChefPlaceholder, buildFood, buildCoin, buildBill, buildToque, buildCrown, buildHustleRing } from './world.js';
import { DAY_LENGTH, START_CASH, START_REPUTATION, QUEUE_PATIENCE, FOOD_PATIENCE, EAT_TIME, SAVE_KEY, MENU, UPGRADES, MILESTONES, QUESTS, CATEGORIES, upgradeCost } from './config.js';

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Math.floor(n).toLocaleString()}`;
const money2 = (n) => `$${n.toFixed(2)}`;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// ----------------------------------------------------------------- movement
function stepToward(obj, target, speed, dt, faceMotion = true, arrive = 0.02) {
  const dx = target.x - obj.position.x, dz = target.z - obj.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist < arrive) { if (arrive <= 0.05) { obj.position.x = target.x; obj.position.z = target.z; } return true; }
  const step = Math.min(dist, speed * dt);
  obj.position.x += (dx / dist) * step;
  obj.position.z += (dz / dist) * step;
  if (faceMotion) obj.rotation.y = lerpAngle(obj.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 12));
  return false;
}
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}
function faceTo(obj, target) { obj.rotation.y = Math.atan2(target.x - obj.position.x, target.z - obj.position.z); }

/** A rigged person (Food Worker / Retail Worker rig) with idle + walk clips. */
class Character {
  constructor(model, scene, { tint = null, hat = null } = {}) {
    this.obj = model;
    scene.add(model);
    if (tint != null) {
      model.traverse((o) => {
        if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); }
      });
    }
    if (hat) {
      const head = (model.userData.model ?? model).getObjectByName('Head');
      if (head) {
        // Bones live in the armature's centimetre space (scale 100). Express
        // the hat in rig units: the head bone sits at the neck and the chibi
        // head is about 1.4 rig units tall and 1.2 wide.
        model.updateMatrixWorld(true);
        const headScale = new THREE.Vector3(); head.getWorldScale(headScale);
        const rigScale = new THREE.Vector3(); (model.userData.model ?? model).getWorldScale(rigScale);
        const rigPerLocal = headScale.x / (rigScale.x || 1);
        hat.scale.setScalar(2.2 / rigPerLocal);
        hat.position.set(0, 1.3 / rigPerLocal, 0);
        head.add(hat);
      } else model.add(hat);
    }
    // Stand the rig upright before the mixer records its "original state":
    // the idle clip only animates a few bones, the rest keep this pose.
    if (model.animations?.length) applyClipPose(model.userData.model ?? model, model.animations);
    this.mixer = new THREE.AnimationMixer(model.userData.model ?? model);
    this.actions = {};
    for (const clip of model.animations ?? []) {
      const key = clip.name.replace(/^Armature\|/, '').toLowerCase();
      this.actions[key] = this.mixer.clipAction(clip);
    }
    this.current = null;
    this.play('idle');
    // Whatever the character carries rides between the two hand bones, so it
    // swings with the arms instead of floating in front of the face.
    this.carry = new THREE.Group();
    this.carry.name = 'hand';
    const rig = model.userData.model ?? model;
    this.handL = rig.getObjectByName('Hand.L');
    this.handR = rig.getObjectByName('Hand.R');
    this.carry.position.set(0, 0.55, 0.35);
    model.add(this.carry);
    this.carryTarget = null; // optional lift target (e.g. the mouth), in model space
    this.carryBlend = 0;
    this.carryYaw = 0;
    this.carryTilt = 0;
    this.updateCarry();
    // hustle: a timed speed boost with a cooldown, shown as a glowing ring
    this.boost = 0;
    this.cooldown = 0;
    this.ring = buildHustleRing();
    model.add(this.ring);
    CHARACTER_OF.set(model, this); // not in userData: that gets JSON-cloned with the model
  }
  get boosted() { return this.boost > 0; }
  hustle() {
    if (this.cooldown > 0) return false;
    this.boost = 6; this.cooldown = 16;
    return true;
  }
  tickBoost(dt, time) {
    if (this.boost > 0) this.boost -= dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    this.ring.visible = this.boost > 0;
    if (this.ring.visible) { const k = 1 + Math.sin(time * 10) * 0.12; this.ring.scale.set(k, k, 1); this.ring.material.opacity = 0.5 + 0.3 * Math.sin(time * 10); }
    if (this.mixer) this.mixer.timeScale = this.boost > 0 ? 1.6 : 1;
  }
  updateCarry() {
    if (!this.handL || !this.handR) return;
    this.obj.updateMatrixWorld(true);
    const a = this.handL.getWorldPosition(_v1), b = this.handR.getWorldPosition(_v2);
    const mid = a.add(b).multiplyScalar(0.5);
    this.obj.worldToLocal(mid);
    mid.y += 0.04; mid.z = Math.max(mid.z, 0) + 0.46; // held out in front of the belly, clear of the chunky body
    if (this.carryTarget && this.carryBlend > 0) mid.lerp(this.carryTarget, this.carryBlend);
    this.carry.position.copy(mid);
    this.carry.rotation.set(this.carryTilt * this.carryBlend, this.carryYaw * this.carryBlend, 0);
  }
  play(name, fade = 0.2) {
    const next = this.actions[name] ?? this.actions.idle;
    if (!next || next === this.current) return;
    next.reset().fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }
  update(dt) { this.mixer.update(dt); this.updateCarry(); }
}
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const CHARACTER_OF = new WeakMap();

// ----------------------------------------------------------------- game
export class Game {
  constructor({ canvas, manifest, modelBytes = null }) {
    this.canvas = canvas;
    this.manifest = manifest;
    this.modelBytes = modelBytes; // optional { file: ArrayBuffer } for single-file builds
    this.sfx = new Sfx();
    this.models = {};
    this.credits = [];
    this.customers = [];
    this.orders = [];
    this.runners = [];
    this.coins = [];
    this.floaters = [];
    this.tables = [];
    this.cabinets = [];
    this.passPlates = [null, null, null, null];
    this.pickupPlates = [null, null, null];
    this.running = false;
    this.paused = false;
    this.speed = 1;
    this.saveTimer = 0;
    this.time = 0;
    this.tutorial = { paid: false, shop: false, collected: false };
    this.registers = [];
    this.setupScene();
    this.fx = new Fx(this.scene);
    this.music = new Music(this.sfx);
    this.ambience = new Ambience(this.sfx);
    this.displayCash = 0;
    this.steamTimer = 0;
    this.bindUI();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------- scene
  setupScene() {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.localClippingEnabled = true; // bites out of kebabs
    this.renderer = renderer;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6e7d2);
    scene.fog = new THREE.Fog(0xf6e7d2, 28, 48);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.camera.position.set(6.5, 8.6, 11.8);
    const controls = new OrbitControls(this.camera, this.canvas);
    controls.target.set(0.3, 0.6, 0.9);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 26;
    controls.maxPolarAngle = 1.3;
    controls.minPolarAngle = 0.25;
    controls.screenSpacePanning = false;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls = controls;

    this.hemi = new THREE.HemisphereLight(0xfff4e0, 0x8c7b6b, 0.85);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.0);
    this.sun = sun;
    sun.position.set(6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    const kitchenLight = new THREE.PointLight(0xdfefff, 14, 8, 2); kitchenLight.position.set(1, 2.6, -3.5); scene.add(kitchenLight);
    this.lamps = []; // { obj, light, bulbMats } filled by placeLamps()
    this.skyDay = new THREE.Color(0xf6e7d2); this.skyDusk = new THREE.Color(0xe8a87c); this.skyNight = new THREE.Color(0x2a3350);

    this.world = buildWorld(scene);
    this.buildNav();
    this.chef = buildChefPlaceholder();
    this.chef.position.copy(L.chef);
    this.chef.rotation.y = Math.PI; // face the stove
    scene.add(this.chef);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.onResize();
    addEventListener('resize', () => this.onResize());
  }

  /** Walkability grid: walls, counters, furniture. Models add their footprints once loaded. */
  buildNav() {
    const nav = new NavGrid();
    const A = MASK.ALL;
    // walls (the front wall has the door gap at x -7.8..-6.2)
    nav.rect(-12, 12, -8, -6.0, A);
    nav.rect(-8.3, -8.0, -6.2, 6.2, A);   // side walls only span the building; the pavement outside is open
    nav.rect(8.0, 8.3, -6.2, 6.2, A);
    nav.rect(-12, 12, 10.5, 11, A);      // far edge of the road
    nav.rect(-8.0, -7.8, 6.0, 6.2, A);
    nav.rect(-6.2, 8.0, 6.0, 6.2, A);
    // counters
    nav.rect(-3.8, 3.8, 0.75, 1.65, A);        // front counter
    nav.rect(-1.95, 2.55, -2.25, -1.45, A);    // kitchen pass (a corridor runs behind it)
    // planters by the door
    nav.circle(-5.6, 5.6, 0.35, A); nav.circle(6.9, 5.6, 0.35, A);
    // keep each kind of person on their own side of the counters
    nav.rect(-8, 8, -6.0, 0.75, MASK.CUSTOMER, 0);   // guests never go behind the counter
    nav.rect(-8, 8, 1.65, 11, MASK.STAFF | MASK.CHEF, 0); // staff stay behind it
    nav.rect(-8, 8, -1.45, 0.75, MASK.CHEF, 0);      // the chef stays behind the pass
    nav.rect(-8, -2.3, -6.0, -1.45, MASK.CHEF, 0);    // ...and out of the far-left corner
    this.nav = nav;
  }

  onResize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.9 ? 55 : 38;
    this.camera.updateProjectionMatrix();
  }

  async loadModel(key) {
    const e = this.manifest.models[key];
    if (!e) return null;
    let model;
    if (this.modelBytes?.[e.file]) model = fitModel(await parseGLTF(this.modelBytes[e.file]), { height: e.height });
    else model = await loadModelFitted(`models/${e.file}`, { height: e.height });
    model.rotation.y = THREE.MathUtils.degToRad(e.rotationY ?? 0);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (e.credit) this.credits.push(e.credit);
    return model;
  }

  async load() {
    const keys = Object.keys(this.manifest.models);
    const status = $('load-status');
    for (const key of keys) {
      status.textContent = `Loading ${this.manifest.models[key].file}…`;
      try { this.models[key] = await this.loadModel(key); }
      catch (err) { console.error(`[tycoon] ${key} failed`, err); this.models[key] = null; }
    }
    this.placeStatic();
    if (this.models.chef) {
      this.scene.remove(this.chef);
      this.chef = this.models.chef; this.chef.position.copy(L.chef); this.chef.rotation.y += Math.PI; this.scene.add(this.chef);
    } else if (this.models.cashier) {
      this.scene.remove(this.chef);
      this.chefs = [];
      this.addChef(0);
      this.chefRig = this.chefs[0].rig;
      this.chef = this.chefRig.obj;
    }
    $('credits').textContent = `Models: ${this.credits.join(' · ')}`;
    $('shop-credits').textContent = `Models: ${this.credits.join(' · ')}`;
    const failed = keys.filter((k) => !this.models[k]);
    status.textContent = failed.length ? `Loaded with placeholders for: ${failed.join(', ')}` : 'All models loaded.';
    $('btn-new').disabled = false;
    $('btn-continue').disabled = !this.hasSave();
    $('btn-continue').hidden = !this.hasSave();
  }

  placeStatic() {
    const reg = this.models.register ?? placeholderBox(0.9, 0.9, 0.8, 0x3b3f46);
    reg.position.copy(L.register); this.scene.add(reg); this.register = reg;
    // register 0 is created in addRegister below
    const stack = this.models.cashStack ?? placeholderBox(0.2, 0.1, 0.2, 0x4caf50);
    stack.position.copy(L.cashStack); this.scene.add(stack); this.cashStack = stack;
    this.stackParts = [];
    stack.traverse((o) => { if (o.isMesh && /^Cash/.test(o.name)) this.stackParts.push(o); });
    if (!this.stackParts.length) stack.traverse((o) => { if (o.isMesh) this.stackParts.push(o); });
    this.stackParts.sort((a, b) => a.name.localeCompare(b.name));
    const kitchen = this.models.kitchen ?? placeholderBox(2.2, 2, 2, 0xbbbbbb);
    kitchen.position.copy(L.kitchen); this.scene.add(kitchen);
    // guests and runners stay out of the kitchen; the chef walks around its actual furniture
    this.nav.rect(0.1, 3.4, -6.0, -3.0, MASK.CUSTOMER | MASK.STAFF, 0);
    this.nav.footprint(kitchen, MASK.ALL, { inflate: 0.12 }); // tight margins: the walkways inside are narrow
    this.knifeProto = this.models.knife;
    this.cabinetProto = this.models.cabinet;
    this.addRegister(0);
    // street lamps use the Ali12 light too, lit at night
    for (const p of L.streetLamps) {
      const lamp = this.buildLamp();
      lamp.obj.position.copy(p); lamp.obj.position.y = p.y - 0.05;
      lamp.outdoor = true;
      this.scene.add(lamp.obj);
      this.lamps.push(lamp);
    }
  }

  /** Chef 0 comes with the diner; chef 1 is the Sous chef upgrade. Each has a board and a burner. */
  addChef(index) {
    if (this.chefs[index]) return;
    const rig = new Character(cloneRig(this.models.cashier), this.scene, { tint: index === 0 ? 0xf4f4f0 : 0xe8f0e0, hat: buildToque() });
    rig.mask = MASK.CHEF;
    const stove = index === 0 ? L.stove : L.stove2;
    const prep = index === 0 ? L.prep : L.prep2;
    rig.obj.position.copy(stove);
    rig.obj.rotation.y = Math.PI;
    this.chefs[index] = { index, rig, stove, prep, state: 'idle', order: null, timer: 0 };
  }

  removeSousChef() {
    const c = this.chefs?.[1];
    if (!c) return;
    this.scene.remove(c.rig.obj);
    this.chefs.length = 1;
  }

  /** Register 0 is the one from the manifest; register 1 comes with the upgrade. */
  addRegister(index) {
    if (this.registers[index]) return;
    const pos = index === 0 ? L.register : L.register2;
    const stand = index === 0 ? L.cashier : L.cashier2;
    const queueHead = index === 0 ? L.queueHead : L.queueHead2;
    const model = index === 0 ? this.register : (this.models.register ? this.models.register.clone(true) : placeholderBox(0.9, 0.9, 0.8, 0x3b3f46));
    if (index !== 0) { model.position.copy(pos); this.scene.add(model); }
    let cashier = null;
    if (this.models.cashier) {
      cashier = new Character(index === 0 ? this.models.cashier : cloneRig(this.models.cashier), this.scene, index === 0 ? {} : { tint: 0xdfe7ff });
      cashier.mask = MASK.STAFF; cashier.moving = false;
      cashier.obj.position.copy(stand);
      cashier.obj.rotation.y = 0; // faces +z, toward the guests
    }
    this.registers[index] = { index, pos, stand, queueHead, model, cashier, busy: null, timer: 0 };
  }

  removeSecondRegister() {
    const r = this.registers[1];
    if (!r) return;
    this.scene.remove(r.model);
    if (r.cashier) this.scene.remove(r.cashier.obj);
    this.registers.length = 1;
  }

  // ---------------------------------------------------------- state
  freshState() {
    return {
      v: 1, cash: START_CASH, till: 0, reputation: START_REPUTATION, day: 1, dayTime: 0,
      upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, u.start ?? 0])),
      stats: { servedTotal: 0, earnedTotal: 0, specialsServed: 0, angryTotal: 0, servedToday: 0, earnedToday: 0, angryToday: 0, tipsToday: 0, collects: 0, hustles: 0, streakBest: 0, vipHappy: 0 },
      milestones: [],
      streak: 0,
      questIndex: 0,
    };
  }
  hasSave() { try { return Boolean(localStorage.getItem(SAVE_KEY)); } catch { return false; } }
  save() {
    if (!this.running) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch {}
  }
  startNew() {
    this.s = this.freshState();
    this.tutorial = { paid: false, shop: false, collected: false };
    this.begin();
    this.toast('Welcome to your diner. Guests are on their way.', 'info', 3500);
  }
  continueGame() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch {}
    this.s = s ? { ...this.freshState(), ...s, stats: { ...this.freshState().stats, ...(s.stats ?? {}) }, upgrades: { ...this.freshState().upgrades, ...(s.upgrades ?? {}) } } : this.freshState();
    this.tutorial = { paid: true, shop: true, collected: true };
    this.begin();
    this.toast(`Welcome back. Day ${this.s.day}, ${money(this.s.cash)} in the bank.`, 'info', 3000);
  }
  begin() {
    this.sfx.ensure();
    this.music.start();
    this.ambience.start();
    $('btn-music').classList.toggle('cherry', this.music.playing);
    this.resetEntities();
    this.applyUpgradesToWorld();
    this.running = true;
    this.displayCash = this.s.cash;
    this.renderQuest();
    this.paused = false;
    this.spawnTimer = 1.5;
    $('overlay-title').classList.remove('show');
    $('hud').classList.add('show');
    this.renderShop();
    this.updateHud();
    this.save();
  }
  resetEntities() {
    for (const c of this.customers) this.scene.remove(c.obj);
    this.customers = [];
    for (const o of this.orders) if (o.plate) this.scene.remove(o.plate);
    this.orders = [];
    this.passPlates = [null, null, null, null];
    this.pickupPlates = [null, null, null];
    for (const r of this.runners) this.scene.remove(r.obj);
    this.runners = [];
    for (const t of this.tables) this.scene.remove(t);
    this.tables = [];
    for (const c of this.cabinets) this.scene.remove(c);
    this.cabinets = [];
    for (const l of this.lamps) if (!l.outdoor) this.scene.remove(l.obj);
    this.lamps = this.lamps.filter((l) => l.outdoor);
    if (this.knife) { this.scene.remove(this.knife); this.knife = null; }
    for (const r of this.registers) { r.busy = null; r.timer = 0; }
    if (this.lvl('register2') < 1) this.removeSecondRegister();
    this.autoTimer = 0;
    if (this.chefs) {
      if (this.lvl('chef2') < 1) this.removeSousChef();
      for (const c of this.chefs) { c.rig.carry.clear(); c.state = 'idle'; c.order = null; c.rig.obj.position.copy(c.stove); }
    }
  }

  lvl(id) { return this.s.upgrades[id] ?? 0; }
  stars() { return this.s.reputation / 20; }

  applyUpgradesToWorld() {
    this.placeLamps();
    if (this.lvl('register2') >= 1) this.addRegister(1);
    if (this.lvl('chef2') >= 1 && this.chefs) this.addChef(1);
    // runners
    while (this.runners.length < this.lvl('runner')) {
      const idx = this.runners.length;
      const model = this.models.runner ? cloneRig(this.models.runner) : placeholderPerson(0x2e7d32);
      const w = new Character(model, this.scene);
      w.mask = MASK.STAFF;
      w.obj.position.copy(L.runnerIdle[idx % L.runnerIdle.length]);
      w.state = 'idle'; w.order = null; w.idleSpot = L.runnerIdle[idx % L.runnerIdle.length];
      this.runners.push(w);
    }
    // tables
    while (this.tables.length < this.lvl('tables')) {
      const t = buildTable(L.tables[this.tables.length]);
      t.userData.taken = new Array(4).fill(null);
      this.scene.add(t); this.tables.push(t);
      this.nav.circle(t.position.x, t.position.z, 0.78, MASK.ALL);
    }
    // cabinets on the back wall
    while (this.cabinets.length < this.lvl('cabinet')) {
      const c = this.cabinetProto ? this.cabinetProto.clone(true) : placeholderBox(1, 1, 0.5, 0xd0d4d8);
      const p = L.cabinets[this.cabinets.length];
      c.position.set(p.x, p.y - 0.5, p.z); this.scene.add(c); this.cabinets.push(c);
    }
    // lamps: the Ali12 light over the counter from the start, more over the tables per level
    this.placeLamps();
    // knife on the cutting board
    if (this.lvl('knife') > 0 && !this.knife) {
      const k = this.knifeProto ? this.knifeProto.clone(true) : placeholderBox(0.05, 0.5, 0.03, 0xcccccc);
      k.rotation.set(Math.PI / 2, 0, Math.PI / 2 + 0.3);
      k.position.set(L.knife.x, L.knife.y + 0.04, L.knife.z);
      this.scene.add(k); this.knife = k;
    }
  }

  placeLamps() {
    const wanted = LAMP_SPOTS.slice(0, 2 + this.lvl('lamps') * 2);
    let indoor = this.lamps.filter((l) => !l.outdoor).length;
    while (indoor < wanted.length) {
      const spot = wanted[indoor++];
      const lamp = this.buildLamp();
      lamp.obj.position.copy(spot);
      this.scene.add(lamp.obj);
      this.lamps.push(lamp);
    }
    this.updateLighting();
  }

  buildLamp() {
    const group = new THREE.Group();
    const bulbMats = [];
    let model;
    if (this.models.light) {
      model = this.models.light.clone(true);
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        if (/light/i.test(o.material.name)) { o.material.emissive.setHex(0xffb347); o.material.emissiveIntensity = 2; bulbMats.push(o.material); }
        if (/glass/i.test(o.material.name)) { o.material.transparent = true; o.material.opacity = 0.55; o.material.roughness = 0.1; o.material.metalness = 0.2; }
        o.castShadow = false;
      });
    } else {
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.3, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xc73e3a, side: THREE.DoubleSide }));
      shade.position.y = 0.15;
      model = new THREE.Group(); model.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffe3a3, emissiveIntensity: 1.5 }));
      bulb.position.y = 0.05; model.add(bulb); bulbMats.push(bulb.material);
    }
    // the fitted model stands on y=0; hang it from the ceiling by its top
    const h = this.models.light ? this.models.light.userData.size.y : 0.45;
    model.position.y = -h;
    group.add(model);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.2 - LAMP_Y - 0.02), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    cord.position.y = (3.2 - LAMP_Y) / 2;
    group.add(cord);
    const light = new THREE.PointLight(0xffc98a, 14, 8, 2);
    light.position.y = -h * 0.75;
    group.add(light);
    return { obj: group, light, bulbMats, baseIntensity: 14 };
  }

  // ---------------------------------------------------------- economy helpers
  arrivalsPerMinute() { return (3.6 + this.stars() * 1.8) * (1 + 0.25 * this.lvl('sign')) * (this.rush > 0 ? 1.9 : 1) * (this.registers.length > 1 ? 1.25 : 1); }
  /** Cosy lighting keeps guests patient: +12% per lamp level. */
  patienceMult() { return 1 + 0.12 * this.lvl('lamps'); }
  tipMult() { return 1 + Math.min(this.s.streak ?? 0, 20) / 20; }
  orderTime() { return 4.2 * Math.pow(0.85, this.lvl('cashier')); }
  cookTime(item) { return 1.6 * Math.pow(0.8, this.lvl('knife')) + item.cook * Math.pow(0.88, this.lvl('cabinet')); }
  runnerSpeed() { return 2.1 * (1 + 0.2 * this.lvl('shoes')); }
  stoves() { return this.lvl('stove'); }
  availableMenu() { const tier = this.lvl('menu'); return MENU.filter((m) => m.tier <= tier); }

  // ---------------------------------------------------------- movement
  /**
   * Walk an agent ({ obj, nav?, mask }) toward `target` along a grid path.
   * Re-plans when the target moves or the grid changes. Returns true on arrival.
   */
  walkTo(agent, target, speed, dt) {
    const st = agent.nav ?? (agent.nav = { target: null, path: [], version: -1 });
    if (!st.target || st.target.distanceToSquared(target) > 0.0025 || st.version !== this.nav.version) {
      st.target = target.clone();
      st.version = this.nav.version;
      st.path = this.nav.findPath(agent.obj.position, target, agent.mask ?? MASK.ALL);
    }
    while (st.path.length) {
      const wp = st.path[0];
      const last = st.path.length === 1;
      // Near an intermediate corner, turn early when the shortcut to the next
      // corner is clear: nobody standing on a corner can block the route, and
      // the check keeps the shortcut from clipping furniture.
      if (!last && st.path[1]) {
        const d = Math.hypot(wp.x - agent.obj.position.x, wp.z - agent.obj.position.z);
        if (d < 0.45 && this.nav.lineClear(agent.obj.position, st.path[1], agent.mask ?? MASK.ALL)) { st.path.shift(); continue; }
      }
      if (!stepToward(agent.obj, wp, speed, dt)) { agent.moving = true; return false; }
      st.path.shift();
      if (last) { agent.moving = false; return true; }
    }
    agent.moving = false;
    return true;
  }

  /** Everyone who can bump into someone this frame. */
  collectAgents() {
    const list = [];
    for (const c of this.customers) if (!c.dead) list.push(c);
    for (const r of this.runners) list.push(r);
    for (const c of this.chefs ?? []) list.push(c.rig);
    for (const r of this.registers) if (r.cashier) list.push(r.cashier);
    return list;
  }

  // ---------------------------------------------------------- customers
  spawnCustomer() {
    let obj, rig = null;
    const vip = this.s.day >= 1 && this.stars() >= 2 && Math.random() < 0.07 && !this.customers.some((c) => c.vip);
    const protos = [this.models.runner, this.models.cashier].filter(Boolean);
    if (protos.length) {
      const tint = vip ? new THREE.Color(0xffe082) : new THREE.Color().setHSL(Math.random(), 0.5, 0.78);
      rig = new Character(cloneRig(pick(protos)), this.scene, { tint, hat: vip ? buildCrown() : null });
      obj = rig.obj; // rig.carry is named 'hand' and follows the hand bones
    } else {
      obj = buildCustomer();
      this.scene.add(obj);
    }
    obj.position.copy(L.spawn);
    const bubble = makeBubble();
    bubble.position.y = 2.25;
    obj.add(bubble);
    // join the shortest line
    const register = this.registers.reduce((best, r) => (this.lineLength(r) < this.lineLength(best) ? r : best), this.registers[0]);
    const c = { obj, rig, bubble, vip, register, cheered: false, mask: MASK.CUSTOMER, moving: false, patienceMax: QUEUE_PATIENCE * this.patienceMult() * (vip ? 0.85 : 1), state: 'enter', path: [L.corridor.clone(), null], patience: QUEUE_PATIENCE * this.patienceMult() * (vip ? 0.85 : 1), waitSpot: null, seat: null, order: null, timer: 0, speed: rand(1.6, 2.1), happy: true, bob: Math.random() * 6 };
    this.customers.push(c);
    if (vip) { this.toast('👑 A food critic just walked in. Serve them fast!', 'warn', 4000); this.sfx.bell(); }
    return c;
  }

  lineLength(r) { return this.customers.filter((c) => c.register === r && (c.state === 'enter' || c.state === 'queue')).length; }

  queueTargets() {
    const inQueue = this.customers.filter((c) => c.state === 'queue' || c.state === 'enter');
    inQueue.sort((a, b) => (a.queueIndex ?? 99) - (b.queueIndex ?? 99));
    return inQueue;
  }

  updateCustomers(dt) {
    // assign queue indices in arrival order
    for (const r of this.registers) {
      let idx = 0;
      for (const c of this.customers) {
        if (c.register === r && (c.state === 'queue' || c.state === 'enter')) {
          c.queueIndex = idx++;
          c.queueTarget = new THREE.Vector3(r.queueHead.x + (idx > L.queueMax ? 0.6 : 0), 0, r.queueHead.z + (idx - 1) * L.queueStep);
        }
      }
    }
    for (const c of this.customers) {
      const o = c.obj;
      switch (c.state) {
        case 'enter': {
          // the grid routes them in through the door and around the furniture
          const moving = !this.walkTo(c, c.queueTarget, c.speed, dt);
          this.bob(c, moving, dt);
          if (!moving) { c.state = 'queue'; faceTo(o, c.register.pos); }
          break;
        }
        case 'queue': {
          const moving = !this.walkTo(c, c.queueTarget, c.speed, dt);
          this.bob(c, moving, dt);
          if (!moving) faceTo(o, new THREE.Vector3(c.register.pos.x, 0, c.register.pos.z));
          c.patience -= dt;
          if (c.queueIndex === 0 && !c.register.busy) {
            c.register.busy = c; c.state = 'ordering'; c.register.timer = this.orderTime();
            c.item = pick(this.availableMenu());
            if (c.register.cashier) c.register.cashier.play('jump', 0.15);
          } else if (c.patience <= 0) {
            this.leave(c, false, 'left the line');
          }
          break;
        }
        case 'ordering': {
          this.bob(c, false, dt); c.moving = false;
          break; // cashier timer drives it
        }
        case 'toWait': {
          const moving = !this.walkTo(c, c.waitSpot, c.speed, dt);
          this.bob(c, moving, dt);
          if (!moving) { c.state = 'waitFood'; faceTo(o, new THREE.Vector3(o.position.x, 0, 1.2)); }
          c.patience -= dt;
          if (c.patience <= 0) this.abandon(c);
          break;
        }
        case 'waitFood': {
          this.bob(c, false, dt); c.moving = false;
          c.patience -= dt;
          if (c.patience <= 0) this.abandon(c);
          break;
        }
        case 'toPickup': {
          const moving = !this.walkTo(c, c.pickupTarget, c.speed, dt);
          this.bob(c, moving, dt);
          if (!moving) {
            // take the plate
            const slot = c.order.pickupSlot;
            const plate = this.pickupPlates[slot];
            if (plate) { this.pickupPlates[slot] = null; this.scene.remove(plate); const hand = o.getObjectByName('hand'); plate.position.set(0, 0, 0); plate.scale.setScalar(1); hand.add(plate); c.plate = plate; }
            this.sfx.pop();
            const seat = this.findSeat();
            if (seat) { c.seat = seat; seat.table.userData.taken[seat.index] = c; c.state = 'toSeat'; }
            else { this.finishCustomer(c, false); }
          }
          break;
        }
        case 'toSeat': {
          const moving = !this.walkTo(c, c.seat.pos, c.speed, dt);
          this.bob(c, moving, dt);
          if (!moving) { c.state = 'eating'; c.timer = EAT_TIME; faceTo(o, c.seat.table.position); }
          break;
        }
        case 'eating': {
          c.moving = false;
          c.timer -= dt;
          if (c.rig) this.bob(c, false, dt); else o.position.y = Math.abs(Math.sin(this.time * 6)) * 0.02;
          this.updateEating(c, dt);
          if (c.timer <= 0) {
            if (c.plate) { const hand = o.getObjectByName('hand'); hand.remove(c.plate); if (c.eat && !c.rig) { hand.position.copy(c.eat.rest); hand.rotation.set(0, c.eat.restRot, 0); } if (c.rig) { c.rig.carryBlend = 0; c.rig.carryTarget = null; } c.plate = null; }
            c.seat.table.userData.taken[c.seat.index] = null;
            this.finishCustomer(c, true);
          }
          break;
        }
        case 'leave': {
          const moving = !this.walkTo(c, c.exit, c.speed * 1.15, dt);
          this.bob(c, moving, dt);
          if (!moving) { this.scene.remove(o); c.dead = true; }
          break;
        }
      }
    }
    for (const c of this.customers) this.updateBubble(c);
    this.customers = this.customers.filter((c) => !c.dead);
    separate(this.collectAgents(), this.nav, dt);
  }

  updateBubble(c) {
    const b = c.bubble;
    if (!b) return;
    const waiting = c.state === 'queue' || c.state === 'toWait' || c.state === 'waitFood';
    b.visible = waiting || c.state === 'ordering';
    if (!b.visible) return;
    const frac = Math.max(0, Math.min(1, c.patience / (c.patienceMax || 1)));
    const item = c.state === 'queue' ? null : c.item;
    drawBubble(b, { frac, item, ordering: c.state === 'ordering' });
  }

  bob(c, moving, dt) {
    if (c.rig) { c.rig.play(moving ? 'walk' : 'idle'); c.rig.update(dt); c.obj.position.y = 0; return; }
    if (moving) { c.bob += dt * 11; c.obj.position.y = Math.abs(Math.sin(c.bob)) * 0.06; }
    else c.obj.position.y = 0;
  }

  /**
   * Lift the plate to the mouth, bite, lower it. Each bite moves the plate's
   * clipping plane further down the skewer so the kebab visibly shrinks.
   */
  updateEating(c, dt) {
    const hand = c.obj.getObjectByName('hand');
    const plate = c.plate;
    if (!hand || !plate) return;
    const e = c.eat ?? (c.eat = { t: 0, bites: 0, total: Math.max(3, Math.round(EAT_TIME / 1.5)), rest: hand.position.clone(), restRot: hand.rotation.y });
    e.t += dt;
    const period = EAT_TIME / e.total;
    const phase = (e.t % period) / period; // 0..1 within one bite
    // mouth position in the guest's local space (chibi head is big and forward)
    const mouth = c.rig ? new THREE.Vector3(0.0, 1.1, 0.8) : new THREE.Vector3(0.0, 1.42, 0.3);
    let k; // 0 = plate at rest, 1 = at the mouth
    if (phase < 0.35) k = phase / 0.35;
    else if (phase < 0.55) k = 1;
    else k = 1 - (phase - 0.55) / 0.45;
    k = k * k * (3 - 2 * k);
    if (c.rig) {
      // the rig keeps the plate in the hands; blend it up to the mouth for the bite
      c.rig.carryTarget = mouth; c.rig.carryBlend = k; c.rig.carryYaw = -Math.PI / 2; c.rig.carryTilt = 0.35;
    } else {
      hand.position.lerpVectors(e.rest, mouth, k);
      hand.rotation.y = e.restRot + k * (-Math.PI / 2);
      hand.rotation.x = k * 0.35;
    }
    const biteIndex = Math.floor(e.t / period);
    if (biteIndex > e.bites && biteIndex <= e.total) {
      e.bites = biteIndex;
      this.sfx.pop();
      if (c.rig) c.obj.position.y = 0.03; // little chomp hop
    }
    // eaten fraction grows in steps; the drink/cup has no skewer so nothing to clip
    const eaten = Math.min(0.9, e.bites / e.total);
    const skewers = plate.userData.skewers ?? [];
    if (skewers.length && plate.userData.bitePlane) {
      const sk = skewers[Math.min(skewers.length - 1, 1)];
      sk.updateMatrixWorld(true);
      const tipLocal = plate.userData.biteTipLocal ?? new THREE.Vector3(0, plate.userData.skewerLength, 0);
      const L = plate.userData.biteLength ?? plate.userData.skewerLength;
      const axis = tipLocal.clone().normalize().transformDirection(sk.matrixWorld).normalize();
      const tip = sk.localToWorld(tipLocal.clone());
      const cut = tip.addScaledVector(axis, -eaten * L);
      plate.userData.bitePlane.normal.copy(axis).negate();
      plate.userData.bitePlane.constant = axis.dot(cut);
    }
  }

  findSeat() {
    for (const t of this.tables) {
      const i = t.userData.taken.findIndex((x) => !x);
      if (i >= 0) return { table: t, index: i, pos: t.userData.seats[i] };
    }
    return null;
  }

  finishCustomer(c, seated) {
    let tip = 0;
    if (seated) {
      tip = Math.round(c.item.price * rand(0.15, 0.35) * (1 + 0.1 * this.lvl('lamps')) * this.tipMult() * (c.vip ? 3 : 1) * 100) / 100;
      this.s.till += tip;
      this.s.stats.earnedTotal += tip; this.s.stats.earnedToday += tip; this.s.stats.tipsToday = (this.s.stats.tipsToday ?? 0) + tip;
      this.float(c.obj.position, `tip ${money2(tip)}`, 'gold');
    }
    this.leave(c, true, seated ? 'ate in' : 'took it to go');
  }

  leave(c, happy, why) {
    if (c.waitSpot) { c.waitSpot.taken = false; c.waitSpot = null; }
    if (c.register && c.register.busy === c) c.register.busy = null;
    c.state = 'leave';
    c.exit = L.spawn.clone().add(new THREE.Vector3(rand(-0.6, 0.6), 0, rand(-0.6, 0.6)));
    if (happy) {
      this.s.reputation = Math.min(100, this.s.reputation + (why === 'ate in' ? 1.5 : 0.8) + (c.vip ? 6 : 0));
      this.s.stats.servedTotal += 1; this.s.stats.servedToday += 1;
      this.s.streak = (this.s.streak ?? 0) + 1;
      this.s.stats.streakBest = Math.max(this.s.stats.streakBest ?? 0, this.s.streak);
      if (c.item?.id === 'special') this.s.stats.specialsServed += 1;
      this.float(c.obj.position, why === 'ate in' ? '★ ate in' : '★ to go', 'good');
      this.fx.hearts(c.obj.position, c.vip ? 6 : 2);
      if (c.vip) { this.s.stats.vipHappy = (this.s.stats.vipHappy ?? 0) + 1; this.fx.stars(c.obj.position, 10); this.toast('👑 The critic loved it! +6 reputation.', 'good', 3500); this.sfx.levelUp(); }
      if (this.s.streak > 0 && this.s.streak % 10 === 0) { this.toast(`🔥 ${this.s.streak} guests in a row! Tips ×${this.tipMult().toFixed(1)}`, 'good', 3000); }
    } else {
      this.s.reputation = Math.max(0, this.s.reputation - (c.vip ? 10 : 4));
      this.s.stats.angryTotal += 1; this.s.stats.angryToday += 1;
      if ((this.s.streak ?? 0) >= 5) this.toast(`Streak of ${this.s.streak} lost.`, 'bad');
      this.s.streak = 0;
      this.sfx.buzz();
      this.fx.grumble(c.obj.position);
      this.float(c.obj.position, `✗ ${why}`, 'bad');
      this.log(`${c.vip ? 'The food critic' : 'A guest'} ${why} unhappy. Reputation −${c.vip ? 10 : 4}.`);
    }
    this.updateHud();
  }

  abandon(c) {
    // gave up waiting for food: cancel the order wherever it is
    const o = c.order;
    if (o) {
      o.cancelled = true;
      if (o.plate && o.state === 'ready') { this.scene.remove(o.plate); this.passPlates[o.passSlot] = null; }
      if (o.plate && o.state === 'delivered') { this.scene.remove(o.plate); this.pickupPlates[o.pickupSlot] = null; }
      this.orders = this.orders.filter((x) => x !== o);
      if (o.state === 'carrying' && o.runner) { o.runner.carry.clear(); o.runner.order = null; o.runner.state = 'return'; }
      if (o.chef) { if (o.plate) o.chef.rig.carry.remove(o.plate); o.chef.order = null; o.chef.state = 'idle'; o.chef = null; }
    }
    this.leave(c, false, 'waited too long');
  }

  // ---------------------------------------------------------- cashier
  updateCashier(dt) {
    for (const r of this.registers) {
      if (r.cashier) { r.cashier.tickBoost(dt, this.time); r.cashier.update(dt); }
      if (!r.busy) continue;
      const c = r.busy;
      r.timer -= dt * (r.cashier?.boosted ? 2.2 : 1);
      if (r.timer > 0) continue;
      // paid
      const bill = c.item.price;
      this.s.till += bill;
      this.s.stats.earnedTotal += bill; this.s.stats.earnedToday += bill;
      const order = { customer: c, item: c.item, state: 'queued', remaining: 0, plate: null, passSlot: -1, pickupSlot: -1, runner: null };
      c.order = order;
      this.orders.push(order);
      r.busy = null;
      if (r.cashier) r.cashier.play('idle');
      this.sfx.chaChing();
      this.float(r.pos.clone().add(new THREE.Vector3(0, 0.9, 0)), `+${money2(bill)}`, 'gold');
      this.fx.sparkle(r.pos.clone().add(new THREE.Vector3(0, 0.6, 0.2)), 4);
      this.spawnBills(2, r.pos);
      // a free waiting spot, or (when the area is full) a jittered spot along the front wall so nobody stacks
      let spot = L.waitSpots.find((w) => !w.taken);
      if (!spot) { spot = new THREE.Vector3(rand(-6.5, -4.2), 0, rand(2.2, 5.0)); spot.overflow = true; }
      spot.taken = true; c.waitSpot = spot;
      c.state = 'toWait'; c.patience = FOOD_PATIENCE * this.patienceMult() * (c.vip ? 0.85 : 1); c.patienceMax = c.patience;
      if (!this.tutorial.paid) { this.tutorial.paid = true; this.toast('First sale! Cash piles up on the register. Click it or press Space to bank it.', 'info', 4500); }
      this.updateHud();
    }
  }

  // ---------------------------------------------------------- kitchen
  updateKitchen(dt) {
    // stoves cook on their own once the chef has prepped the order
    let cookingNow = 0;
    for (const o of this.orders) {
      if (o.state !== 'cooking') continue;
      cookingNow++;
      o.remaining -= dt * (this.chefs?.some((c) => c.rig.boosted) ? 1.5 : 1);
      if (o.remaining <= 0) { o.state = 'plated'; o.remaining = 0; }
    }
    if (cookingNow) { this.steamTimer -= dt; if (this.steamTimer <= 0) { this.steamTimer = 0.3; this.fx.steam(L.stove.clone().add(new THREE.Vector3(0.1, 1.1, -0.55))); } }
    if (this.chefs?.length) for (const c of this.chefs) this.updateChef(c, dt);
    else this.updateChefless(dt);
  }

  /** Fallback when no character rig loaded: orders progress without a walking chef. */
  updateChefless(dt) {
    const cooking = this.orders.filter((o) => o.state === 'cooking').length;
    let free = this.stoves() - cooking;
    for (const o of this.orders) {
      if (free <= 0) break;
      if (o.state === 'queued') { o.state = 'cooking'; o.remaining = this.cookTime(o.item); free--; }
    }
    for (const o of this.orders) if (o.state === 'plated') this.plateToPass(o);
    const busy = cooking > 0;
    this.chef.position.y = busy ? Math.abs(Math.sin(this.time * 8)) * 0.05 : 0;
  }

  foodProtos() { return { kebab: this.models.kebab, hotdog: this.models.hotdog, hamburger: this.models.hamburger }; }
  prepTime() { return 1.6 * Math.pow(0.8, this.lvl('knife')); }
  stoveTime(item) { return item.cook * Math.pow(0.88, this.lvl('cabinet')); }

  /** Put a finished order on a free pass slot; returns false if the pass is full. */
  plateToPass(o) {
    const slot = this.passPlates.findIndex((p) => !p);
    if (slot < 0) return false;
    const plate = o.plate ?? buildFood(o.item, this.foodProtos());
    plate.scale.setScalar(1);
    plate.position.copy(L.passSlots[slot]);
    this.scene.add(plate);
    o.plate = plate; o.passSlot = slot; o.state = 'ready';
    this.passPlates[slot] = plate;
    this.sfx.bell();
    return true;
  }

  /**
   * One cook: preps the next order at their board, starts it on a free stove,
   * and carries finished plates from the burner to the pass.
   */
  updateChef(c, dt) {
    const chef = c.rig;
    chef.tickBoost(dt, this.time);
    const speed = 2.2 * (chef.boosted ? 1.6 : 1);
    switch (c.state) {
      case 'idle': {
        const plated = this.orders.find((o) => o.state === 'plated' && !o.chef);
        const busy = this.orders.filter((o) => o.state === 'cooking' || o.state === 'prepping').length;
        const next = this.orders.find((o) => o.state === 'queued' && !o.chef);
        if (plated) { plated.chef = c; c.order = plated; plated.state = 'carrying-chef'; c.state = 'toStoveForPlate'; }
        else if (next && busy < this.stoves()) { next.chef = c; c.order = next; next.state = 'prepping'; c.state = 'toPrep'; }
        else {
          const cooking = this.orders.some((o) => o.state === 'cooking');
          const arrived = this.walkTo(chef, c.stove, speed, dt);
          if (arrived) { chef.obj.rotation.y = Math.PI; chef.play(cooking ? 'walk' : 'idle'); }
          else chef.play('walk');
        }
        break;
      }
      case 'toPrep': {
        chef.play('walk');
        if (this.walkTo(chef, c.prep, speed, dt)) { c.state = 'prepping'; c.timer = this.prepTime(); chef.obj.rotation.y = 0; }
        break;
      }
      case 'prepping': {
        chef.moving = false;
        chef.play('walk'); // chopping motion stand-in
        chef.obj.position.y = Math.abs(Math.sin(this.time * 10)) * 0.03;
        c.timer -= dt * (chef.boosted ? 2 : 1);
        if (this.knife && c.index === 0) this.knife.rotation.z = Math.PI / 2 + 0.3 + Math.sin(this.time * 10) * 0.2;
        if (c.timer <= 0) { chef.obj.position.y = 0; if (this.knife) this.knife.rotation.z = Math.PI / 2 + 0.3; c.state = 'toStove'; }
        break;
      }
      case 'toStove': {
        chef.play('walk');
        if (this.walkTo(chef, c.stove, speed, dt)) {
          const o = c.order;
          if (o && o.state === 'prepping') { o.state = 'cooking'; o.remaining = this.stoveTime(o.item); o.chef = null; }
          c.order = null; c.state = 'idle'; chef.obj.rotation.y = Math.PI;
        }
        break;
      }
      case 'toStoveForPlate': {
        chef.play('walk');
        if (this.walkTo(chef, c.stove, speed, dt)) {
          const o = c.order;
          if (!o) { c.state = 'idle'; break; }
          o.plate = buildFood(o.item, this.foodProtos());
          o.plate.scale.setScalar(0.9);
          chef.carry.add(o.plate);
          c.state = 'toPass';
        }
        break;
      }
      case 'toPass': {
        chef.play('walk');
        const o = c.order;
        if (!o) { c.state = 'idle'; break; }
        let slot = this.passPlates.findIndex((p) => !p);
        const target = new THREE.Vector3(slot >= 0 ? L.passSlots[slot].x : L.passSlots[1].x + c.index * 0.5, 0, L.passStandChef);
        if (this.walkTo(chef, target, speed, dt)) {
          chef.obj.rotation.y = 0;
          slot = this.passPlates.findIndex((p) => !p);
          if (slot < 0) { chef.play('idle'); break; } // pass full: wait here holding the plate
          chef.carry.remove(o.plate);
          this.plateToPass(o);
          o.chef = null;
          c.order = null; c.state = 'idle';
        }
        break;
      }
    }
    chef.update(dt);
  }

  // ---------------------------------------------------------- runners
  updateRunners(dt) {
    for (const r of this.runners) {
      r.tickBoost(dt, this.time);
      r.update(dt);
      const spd = this.runnerSpeed() * (r.boosted ? 1.8 : 1);
      switch (r.state) {
        case 'idle': {
          const ready = this.orders.find((o) => o.state === 'ready' && !o.runner);
          if (ready) { ready.runner = r; r.order = ready; r.state = 'toPass'; r.play('walk'); }
          else { const arrived = this.walkTo(r, r.idleSpot, spd, dt); r.play(arrived ? 'idle' : 'walk'); if (arrived) faceTo(r.obj, L.passSlots[1]); }
          break;
        }
        case 'toPass': {
          const o = r.order;
          const target = new THREE.Vector3(L.passSlots[o.passSlot].x, 0, L.passStand.z);
          if (this.walkTo(r, target, spd, dt)) {
            this.scene.remove(o.plate); this.passPlates[o.passSlot] = null;
            o.plate.position.set(0, 0, 0); o.plate.scale.setScalar(0.9); r.carry.add(o.plate);
            o.state = 'carrying';
            r.state = 'toPickup';
          }
          break;
        }
        case 'toPickup': {
          const o = r.order;
          if (o.pickupSlot < 0) {
            const slot = this.pickupPlates.findIndex((p) => !p);
            if (slot < 0) { const arrived = this.walkTo(r, L.pickupStand, spd, dt); r.play(arrived ? 'idle' : 'walk'); break; }
            o.pickupSlot = slot; this.pickupPlates[slot] = o.plate;
          }
          r.play('walk');
          const target = new THREE.Vector3(L.pickupSlots[o.pickupSlot].x, 0, L.pickupStand.z);
          if (this.walkTo(r, target, spd, dt)) {
            r.carry.remove(o.plate); o.plate.scale.setScalar(1); o.plate.position.copy(L.pickupSlots[o.pickupSlot]); this.scene.add(o.plate);
            o.state = 'delivered';
            const c = o.customer;
            if (!c.dead && (c.state === 'waitFood' || c.state === 'toWait')) {
              if (c.waitSpot) { c.waitSpot.taken = false; c.waitSpot = null; }
              c.state = 'toPickup'; c.pickupTarget = new THREE.Vector3(L.pickupSlots[o.pickupSlot].x, 0, 2.05);
            }
            r.order = null; r.state = 'return';
            this.orders = this.orders.filter((x) => x !== o);
          }
          break;
        }
        case 'return': {
          const arrived = this.walkTo(r, r.idleSpot, spd, dt);
          r.play(arrived ? 'idle' : 'walk');
          if (arrived) { r.state = 'idle'; faceTo(r.obj, L.passSlots[1]); }
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------- cash
  collect(fromClick = true) {
    if (this.s.till <= 0) return;
    const amount = this.s.till;
    this.s.cash += amount;
    this.s.till = 0;
    this.s.stats.collects = (this.s.stats.collects ?? 0) + 1;
    this.sfx.chaChing();
    this.spawnCoins(Math.min(18, 4 + Math.floor(amount / 8)));
    this.fx.sparkle(L.cashStack.clone().add(new THREE.Vector3(0, 0.3, 0)), 10);
    this.float(L.cashStack.clone().add(new THREE.Vector3(0, 0.8, 0)), `+${money2(amount)} banked`, 'gold');
    if (fromClick && !this.tutorial.collected) { this.tutorial.collected = true; this.toast('Banked. Press B or the Shop button: a Dining table is $100, runners and stoves are there too.', 'info', 5500); }
    this.updateHud();
    this.renderShop();
  }

  updateCashStack() {
    const till = this.s.till;
    this.cashStack.visible = till > 0;
    const stacks = till <= 0 ? 0 : Math.min(this.stackParts.length, 1 + Math.floor(till / 30));
    this.stackParts.forEach((p, i) => { p.visible = i < stacks; });
    const pulse = 1 + Math.sin(this.time * 4) * 0.03 * Math.min(1, till / 100);
    this.cashStack.scale.setScalar(pulse * (1 + Math.min(0.6, till / 400)));
  }

  // ---------------------------------------------------------- upgrades
  buy(id) {
    const def = UPGRADES.find((u) => u.id === id);
    const level = this.lvl(id);
    if (def.max != null && level >= def.max) return;
    const cost = upgradeCost(def, level - (def.start ?? 0));
    if (this.s.cash < cost) { this.sfx.tooEarly(); this.toast(`Need ${money(cost)} for ${def.name}.`, 'warn'); return; }
    this.s.cash -= cost;
    this.s.upgrades[id] = level + 1;
    this.sfx.levelUp();
    this.applyUpgradesToWorld();
    this.log(`Bought ${def.name} (level ${level + 1}) for ${money(cost)}.`);
    this.toast(`${def.icon} ${def.name} → level ${level + 1}`, 'good');
    this.renderShop();
    this.updateHud();
    this.save();
  }

  renderShop() {
    const el = $('shop-list');
    let html = '';
    for (const cat of CATEGORIES) {
      const items = UPGRADES.filter((u) => (u.cat ?? 'staff') === cat.id);
      if (!items.length) continue;
      html += `<div class="shop-cat">${cat.icon} ${cat.name}</div>`;
      for (const u of items) {
        const level = this.lvl(u.id);
        const maxed = u.max != null && level >= u.max;
        const cost = maxed ? null : upgradeCost(u, level - (u.start ?? 0));
        const can = cost != null && this.s.cash >= cost;
        const pct = u.max ? Math.round((level / u.max) * 100) : Math.min(100, level * 20);
        html += `<div class="upgrade ${maxed ? 'maxed' : can ? 'can' : ''}">
          <div class="u-icon">${u.icon}</div>
          <div class="u-body"><div class="u-name">${u.name} <span class="u-lvl">${u.max ? `${level}/${u.max}` : `lv ${level}`}</span></div><div class="u-desc">${u.desc}</div><div class="u-bar"><i style="width:${pct}%"></i></div></div>
          <button class="u-buy" data-id="${u.id}" ${maxed || !can ? 'disabled' : ''}>${maxed ? 'Max' : money(cost)}</button>
        </div>`;
      }
    }
    el.innerHTML = html;
  }

  checkQuests() {
    const q = QUESTS[this.s.questIndex ?? 0];
    if (!q) return;
    if (q.check(this.s.stats, this)) {
      this.s.cash += q.reward;
      this.s.questIndex += 1;
      this.sfx.levelUp();
      this.toast(`✅ Quest complete: ${q.text}  +${money(q.reward)}`, 'good', 4500);
      this.log(`Quest complete: ${q.text} (+${money(q.reward)})`);
      this.fx.confetti(L.cashStack.clone().add(new THREE.Vector3(0, 1.2, 0)), 40);
      $('quest').classList.remove('done'); void $('quest').offsetWidth; $('quest').classList.add('done');
      this.renderQuest();
      this.renderShop();
      this.save();
    }
  }

  renderQuest() {
    const idx = this.s.questIndex ?? 0;
    const q = QUESTS[idx];
    $('quest-total').textContent = QUESTS.length;
    if (!q) { $('quest-n').textContent = QUESTS.length; $('quest-text').textContent = 'All quests complete. Best diner in the world.'; $('quest-reward').textContent = ''; return; }
    $('quest-n').textContent = idx + 1;
    $('quest-text').textContent = q.text;
    $('quest-reward').textContent = `Reward ${money(q.reward)}`;
  }

  checkMilestones() {
    for (const m of MILESTONES) {
      if (this.s.milestones.includes(m.id)) continue;
      if (m.check({ ...this.s.stats, reputation: this.s.reputation })) {
        this.s.milestones.push(m.id);
        this.sfx.levelUp();
        this.fx.confetti(L.register.clone().add(new THREE.Vector3(0, 1.5, 0)), 60);
        this.toast(`🏆 Milestone: ${m.label}`, 'good', 4000);
        this.log(`Milestone reached: ${m.label}`);
      }
    }
    $('milestones').innerHTML = MILESTONES.map((m) => `<li class="${this.s.milestones.includes(m.id) ? 'done' : ''}">${m.label}</li>`).join('');
  }

  // ---------------------------------------------------------- day cycle
  /** 0 = opening (morning), 1 = closing (night). */
  dayFraction() { return this.s ? this.s.dayTime / DAY_LENGTH : 0.3; }

  updateLighting() {
    const f = this.dayFraction();
    // daylight peaks mid-day and fades to evening in the last third
    const daylight = f < 0.55 ? 1 : Math.max(0.12, 1 - (f - 0.55) / 0.4);
    const evening = 1 - daylight;
    this.sun.intensity = 0.35 + 1.75 * daylight;
    this.sun.color.setHex(f > 0.7 ? 0xffb07a : 0xfff1dc);
    this.hemi.intensity = 0.35 + 0.55 * daylight;
    const sky = new THREE.Color();
    if (f < 0.55) sky.copy(this.skyDay);
    else if (f < 0.8) sky.lerpColors(this.skyDay, this.skyDusk, (f - 0.55) / 0.25);
    else sky.lerpColors(this.skyDusk, this.skyNight, (f - 0.8) / 0.2);
    this.scene.background.copy(sky);
    this.scene.fog.color.copy(sky);
    const glow = 0.25 + 0.75 * evening;
    for (const lamp of this.lamps) {
      lamp.light.intensity = lamp.baseIntensity * (lamp.outdoor ? evening * 1.4 : 0.35 + 0.9 * evening);
      for (const m of lamp.bulbMats) m.emissiveIntensity = 0.6 + 2.4 * glow;
    }
    this.renderer.toneMappingExposure = 1.0 + 0.15 * evening;
    if (this.world) {
      this.world.nightSky.opacity = Math.max(0, (f - 0.78) / 0.22) * 0.9;
      this.world.neon.emissiveIntensity = 0.8 + 2.2 * evening + Math.sin(this.time * 7) * 0.15 * evening;
      const lit = this.s ? this.stars() : 0;
      this.world.signStars.forEach((st, i) => { const on = lit >= i + 0.5; st.material.color.setHex(on ? 0xffd54f : 0x4a4f58); st.material.opacity = on ? 1 : 0.6; });
    }
  }

  updateDay(dt) {
    this.s.dayTime += dt;
    // rush hour: a burst of walk-ins just after mid-day
    const f = this.dayFraction();
    if (!this.rushAnnounced && f > 0.45 && f < 0.7) { this.rushAnnounced = true; this.rush = 22; this.toast('🔥 Rush hour! Extra guests for a while.', 'warn', 3500); this.log('Rush hour: walk-ins doubled for a bit.'); }
    if (this.rush > 0) this.rush -= dt;
    if (this.s.dayTime >= DAY_LENGTH) {
      this.s.dayTime -= DAY_LENGTH;
      const st = this.s.stats;
      this.log(`Day ${this.s.day} closed: ${money(st.earnedToday)} earned, ${st.servedToday} served, ${st.angryToday} walked out.`);
      this.toast(`Day ${this.s.day} closed · ${money(st.earnedToday)} · ${st.servedToday} guests`, 'info', 4500);
      this.showDaySummary(st);
      this.fx.confetti(new THREE.Vector3(0, 2.5, 2), 50);
      this.s.day += 1;
      this.rushAnnounced = false;
      st.tipsToday = 0; st.earnedToday = 0; st.servedToday = 0; st.angryToday = 0;
      this.sfx.bell();
      this.save();
    }
  }

  showDaySummary(st) {
    const el = $('summary');
    const stars = this.stars();
    $('summary-title').textContent = `Day ${this.s.day} closed`;
    $('summary-body').innerHTML = `
      <li><span>Sales</span><b>${money2(st.earnedToday - (st.tipsToday ?? 0))}</b></li>
      <li><span>Tips</span><b>${money2(st.tipsToday ?? 0)}</b></li>
      <li><span>Guests served</span><b>${st.servedToday}</b></li>
      <li><span>Walked out</span><b class="${st.angryToday ? 'bad' : ''}">${st.angryToday}</b></li>
      <li><span>Rating</span><b>${'★'.repeat(Math.round(stars))}${'☆'.repeat(5 - Math.round(stars))} ${stars.toFixed(1)}</b></li>
      <li><span>In the bank</span><b>${money(this.s.cash)}</b></li>`;
    el.hidden = false;
    clearTimeout(this.summaryTimer);
    this.summaryTimer = setTimeout(() => { el.hidden = true; }, 7000);
  }

  // ---------------------------------------------------------- effects
  spawnCoins(n) {
    for (let i = 0; i < n; i++) {
      const coin = buildCoin();
      coin.position.copy(L.cashStack).add(new THREE.Vector3(0, 0.3, 0));
      this.scene.add(coin);
      this.coins.push({ mesh: coin, vel: new THREE.Vector3(rand(-1.5, 1.5), rand(2.5, 4.2), rand(0.5, 2.2)), spin: rand(4, 10), life: 1.3 });
    }
  }
  spawnBills(n, from = L.register) {
    for (let i = 0; i < n; i++) {
      const bill = buildBill();
      bill.position.copy(from).add(new THREE.Vector3(rand(-0.2, 0.2), 0.6, 0.4));
      this.scene.add(bill);
      this.coins.push({ mesh: bill, vel: new THREE.Vector3(rand(-1.2, -0.4), rand(1.2, 2), rand(-0.2, 0.2)), spin: rand(3, 6), life: 0.9, toStack: true });
    }
  }
  updateCoins(dt) {
    for (const c of this.coins) {
      c.life -= dt;
      if (c.toStack) {
        c.mesh.position.lerp(L.cashStack.clone().add(new THREE.Vector3(0, 0.1, 0)), Math.min(1, dt * 4));
        c.mesh.rotation.x += c.spin * dt;
      } else {
        c.vel.y -= 9.5 * dt;
        c.mesh.position.addScaledVector(c.vel, dt);
        c.mesh.rotation.x += c.spin * dt; c.mesh.rotation.z += c.spin * 0.7 * dt;
        if (c.mesh.position.y < COUNTER_TOP && c.mesh.position.z < 1.7 && c.mesh.position.z > 0.7) { c.mesh.position.y = COUNTER_TOP; c.vel.y *= -0.4; c.vel.x *= 0.7; c.vel.z *= 0.7; }
        if (c.mesh.position.y < 0.02) { c.mesh.position.y = 0.02; c.vel.set(0, 0, 0); }
      }
      if (c.life <= 0) this.scene.remove(c.mesh);
    }
    this.coins = this.coins.filter((c) => c.life > 0);
  }
  float(pos, text, kind) {
    const el = document.createElement('div');
    el.className = `floater ${kind}`;
    el.textContent = text;
    $('floaters').appendChild(el);
    this.floaters.push({ el, pos: pos.clone().add(new THREE.Vector3(0, 1.9, 0)), life: 1.4 });
  }
  updateFloaters(dt) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    for (const f of this.floaters) {
      f.life -= dt; f.pos.y += dt * 0.6;
      v.copy(f.pos).project(this.camera);
      const visible = v.z < 1;
      f.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%,-50%)`;
      f.el.style.opacity = visible ? Math.max(0, Math.min(1, f.life)) : 0;
      if (f.life <= 0) f.el.remove();
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }
  toast(msg, kind = 'info', ms = 2200) {
    const el = $('toast');
    el.textContent = msg; el.className = `toast ${kind} show`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  log(msg) {
    const el = $('log');
    const line = document.createElement('div');
    line.textContent = msg;
    el.prepend(line);
    while (el.children.length > 6) el.lastChild.remove();
  }

  // ---------------------------------------------------------- HUD
  updateHud() {
    if (!this.s) return;
    $('hud-cash').textContent = money(this.displayCash);
    $('hud-streak').textContent = this.s.streak ?? 0;
    $('hud-streak').classList.toggle('hot', (this.s.streak ?? 0) >= 10);
    this.ambience.setCrowd(this.customers.length);
    $('hud-till').textContent = money2(this.s.till);
    $('btn-collect').disabled = this.s.till <= 0;
    $('btn-collect').classList.toggle('hot', this.s.till >= 40);
    const st = this.stars();
    $('hud-stars').textContent = '★'.repeat(Math.round(st)) + '☆'.repeat(5 - Math.round(st));
    $('hud-rep').textContent = `${st.toFixed(1)} · ${this.arrivalsPerMinute().toFixed(1)} guests/min`;
    $('hud-day').textContent = `Day ${this.s.day}`;
    $('hud-clock').style.width = `${(this.s.dayTime / DAY_LENGTH) * 100}%`;
    $('hud-served').textContent = this.s.stats.servedToday;
    $('hud-queue').textContent = this.customers.filter((c) => c.state === 'queue' || c.state === 'enter').length;
    $('hud-kitchen').textContent = `${this.orders.filter((o) => o.state === 'cooking' || o.state === 'prepping').length}/${this.stoves()}`;
    $('hud-waiting').textContent = this.orders.length;
    $('btn-speed').textContent = `${this.speed}×`;
    if (!this.tutorial.shop && this.s.cash >= 100) { this.tutorial.shop = true; this.toast('You can afford a Dining table. Open the Shop (B) → Dining table.', 'info', 5000); }
  }

  bindUI() {
    $('btn-new').addEventListener('click', () => this.startNew());
    $('btn-continue').addEventListener('click', () => this.continueGame());
    $('btn-collect').addEventListener('click', () => this.collect(true));
    $('btn-speed').addEventListener('click', () => { this.speed = this.speed >= 3 ? 1 : this.speed + 1; this.updateHud(); });
    $('btn-pause').addEventListener('click', () => this.togglePause());
    $('btn-mute').addEventListener('click', () => { this.sfx.muted = !this.sfx.muted; $('btn-mute').textContent = this.sfx.muted ? 'Unmute' : 'Mute'; this.ambience.setCrowd(this.customers.length); });
    $('btn-music').addEventListener('click', () => { const on = this.music.toggle(); $('btn-music').classList.toggle('cherry', on); });
    $('btn-shop').addEventListener('click', () => $('shop').classList.toggle('open'));
    $('btn-shop-close').addEventListener('click', () => $('shop').classList.remove('open'));
    $('btn-reset').addEventListener('click', () => {
      if (!confirm('Start over? This wipes the saved diner.')) return;
      try { localStorage.removeItem(SAVE_KEY); } catch {}
      this.startNew();
    });
    $('shop-list').addEventListener('click', (e) => { const b = e.target.closest('.u-buy'); if (b) this.buy(b.dataset.id); });
    document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => this.viewPreset(b.dataset.view)));
    $('summary').addEventListener('click', () => { $('summary').hidden = true; });
    this.canvas.addEventListener('pointerdown', () => { this.camTween = null; }, { capture: true });
    addEventListener('keydown', (e) => {
      if (!this.running) return;
      if (e.code === 'Space') { e.preventDefault(); this.collect(true); }
      else if (e.key === 'p' || e.key === 'P') this.togglePause();
      else if (e.key === 'b' || e.key === 'B') $('shop').classList.toggle('open');
      else if (e.key === '1' || e.key === '2' || e.key === '3') { this.speed = Number(e.key); this.updateHud(); }
      else if (e.key === 'v' || e.key === 'V') { const order = ['overview', 'register', 'kitchen', 'tables']; this.viewIdx = ((this.viewIdx ?? 0) + 1) % order.length; this.viewPreset(order[this.viewIdx]); }
    });
    // click = collect from the register / cash stack (distinguish from orbit drag)
    let down = null;
    this.canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down || !this.running) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6) return;
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      // staff first: a click on any worker makes them hustle
      const staff = [...this.registers.map((r) => r.cashier).filter(Boolean), ...this.runners, ...(this.chefs ?? []).map((c) => c.rig)];
      const staffHits = this.raycaster.intersectObjects(staff.map((w) => w.obj), true);
      if (staffHits.length) { this.hustle(staffHits[0].object); return; }
      const guestHits = this.raycaster.intersectObjects(this.customers.map((c) => c.obj), true);
      if (guestHits.length) { this.cheer(guestHits[0].object); return; }
      const hits = this.raycaster.intersectObjects([...this.registers.map((r) => r.model), this.cashStack].filter(Boolean), true);
      if (hits.length) { if (this.s.till > 0) this.collect(true); else { this.sfx.pop(); this.toast('The register is empty. Serve some guests first.', 'info'); } }
    });
    addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  viewPreset(name) {
    const presets = {
      overview: { pos: [7, 9.5, 12.5], target: [0.3, 0.6, 0.8] },
      register: { pos: [4.5, 3.2, 5.0], target: [2.6, 1.0, 1.0] },
      kitchen: { pos: [1.5, 3.4, 1.8], target: [0.8, 1.0, -3.0] },
      tables: { pos: [8.5, 5.0, 9.0], target: [4.5, 0.6, 4.0] },
    };
    const p = presets[name];
    if (!p) return;
    this.camTween = { from: this.camera.position.clone(), to: new THREE.Vector3(...p.pos), tFrom: this.controls.target.clone(), tTo: new THREE.Vector3(...p.target), t: 0 };
  }

  updateCameraTween(dt) {
    const tw = this.camTween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt * 1.6);
    const e = tw.t * tw.t * (3 - 2 * tw.t);
    this.camera.position.lerpVectors(tw.from, tw.to, e);
    this.controls.target.lerpVectors(tw.tFrom, tw.tTo, e);
    if (tw.t >= 1) this.camTween = null;
  }

  /** Find the Character that owns a clicked mesh. */
  ownerOf(mesh) {
    let o = mesh;
    while (o) { const ch = CHARACTER_OF.get(o); if (ch) return ch; o = o.parent; }
    return null;
  }

  hustle(mesh) {
    const w = this.ownerOf(mesh);
    if (!w) return;
    if (!w.hustle()) { this.sfx.tooEarly(); this.toast(`Catching their breath… ${Math.ceil(w.cooldown)}s`, 'info', 1200); return; }
    this.s.stats.hustles = (this.s.stats.hustles ?? 0) + 1;
    this.sfx.levelUp();
    this.float(w.obj.position, 'HUSTLE!', 'gold');
    this.fx.sparkle(w.obj.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 8);
  }

  cheer(mesh) {
    const w = this.ownerOf(mesh);
    const c = this.customers.find((x) => x.obj === mesh || (w && x.rig === w) || x.obj === mesh.parent);
    if (!c) return;
    if (c.cheered || !['queue', 'toWait', 'waitFood', 'enter'].includes(c.state)) { this.sfx.pop(); return; }
    c.cheered = true;
    c.patience = Math.min(c.patienceMax, c.patience + c.patienceMax * 0.35);
    this.sfx.bell();
    this.fx.hearts(c.obj.position, 2);
    this.float(c.obj.position, 'Thanks!', 'good');
  }

  togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
    $('btn-pause').textContent = this.paused ? 'Resume' : 'Pause';
    $('paused').hidden = !this.paused;
  }

  // ---------------------------------------------------------- frame
  frame() {
    const real = Math.min(this.clock.getDelta(), 0.1);
    this.updateCameraTween(real);
    this.controls.update();
    if (this.running && !this.paused) {
      const dt = real * this.speed;
      this.time += dt;
      // arrivals
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        if (this.customers.length < 26) this.spawnCustomer();
        this.spawnTimer = (60 / this.arrivalsPerMinute()) * rand(0.6, 1.4);
      }
      this.updateCustomers(dt);
      this.updateCashier(dt);
      this.updateKitchen(dt);
      this.updateRunners(dt);
      if (this.lvl('auto') > 0) { this.autoTimer += dt; if (this.autoTimer >= 6 && this.s.till > 0) { this.autoTimer = 0; this.collect(false); } }
      this.updateDay(dt);
      this.updateLighting();
      this.updateCashStack();
      this.updateCoins(dt);
      this.checkMilestones();
      this.checkQuests();
      this.fx.update(dt);
      this.saveTimer += real;
      if (this.saveTimer > 5) { this.saveTimer = 0; this.save(); }
      // cash counter rolls toward the real value
      this.displayCash += (this.s.cash - this.displayCash) * Math.min(1, real * 6);
      if (Math.abs(this.s.cash - this.displayCash) < 0.6) this.displayCash = this.s.cash;
      if ((this.hudTimer = (this.hudTimer ?? 0) + real) > 0.12) { this.hudTimer = 0; this.updateHud(); }
    } else {
      for (const r of this.registers) r.cashier?.update(real);
      for (const r of this.runners) r.update(real);
      for (const c of this.chefs ?? []) c.rig.update(real);
    }
    this.updateFloaters(real);
    this.renderer.render(this.scene, this.camera);
  }
}

// lamp hanging points: the first two light the counters, the rest come with the Lighting upgrade
const LAMP_Y = 3.05; // top of the pendant; the fitted model is 0.9 tall, so the bulb hangs at ~2.2
const LAMP_SPOTS = [
  new THREE.Vector3(2.6, LAMP_Y, 0.4), new THREE.Vector3(-2.3, LAMP_Y, 0.4),
  new THREE.Vector3(5.6, LAMP_Y, 3.2), new THREE.Vector3(-5.6, LAMP_Y, 3.2),
  new THREE.Vector3(5.6, LAMP_Y, 5.4), new THREE.Vector3(-5.6, LAMP_Y, 5.4),
  new THREE.Vector3(0.3, LAMP_Y, -0.7), new THREE.Vector3(0.3, LAMP_Y, 4.2),
];

// speech bubble + patience bar drawn on a canvas sprite
function makeBubble() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 96;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(0.66, 0.5, 1);
  sprite.userData.canvas = canvas;
  sprite.userData.last = '';
  sprite.renderOrder = 10;
  return sprite;
}
function drawBubble(sprite, { frac, item, ordering }) {
  const key = `${Math.round(frac * 40)}|${item?.id ?? ''}|${ordering ? 1 : 0}`;
  if (sprite.userData.last === key) return;
  sprite.userData.last = key;
  const c = sprite.userData.canvas, ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  // bubble
  ctx.fillStyle = 'rgba(255,250,241,0.95)';
  roundRect(ctx, 8, 6, 112, 64, 14); ctx.fill();
  ctx.beginPath(); ctx.moveTo(54, 70); ctx.lineTo(64, 84); ctx.lineTo(74, 70); ctx.fill();
  // content: dish dot or "…"
  if (item) {
    ctx.fillStyle = '#' + item.color.toString(16).padStart(6, '0');
    ctx.beginPath(); ctx.arc(64, 30, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2f38'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText({ kebab: '🍢', platter: '🍢', special: '🍢', hotdog: '🌭', burger: '🍔' }[item.shape] ?? '🥤', 64, 35);
  } else {
    ctx.fillStyle = '#2b2f38'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(ordering ? '$' : '…', 64, 40);
  }
  // patience bar
  ctx.fillStyle = 'rgba(43,47,56,0.15)'; roundRect(ctx, 20, 54, 88, 8, 4); ctx.fill();
  ctx.fillStyle = frac > 0.5 ? '#3f8f4a' : frac > 0.25 ? '#e0a02c' : '#c73e3a';
  roundRect(ctx, 20, 54, Math.max(6, 88 * frac), 8, 4); ctx.fill();
  sprite.material.map.needsUpdate = true;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ----------------------------------------------------------------- helpers
function placeholderBox(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color }));
  m.position.y = h / 2; m.castShadow = true;
  const g = new THREE.Group(); g.add(m); return g;
}
function placeholderPerson(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 6, 14), new THREE.MeshStandardMaterial({ color }));
  body.position.y = 0.95; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe0ac69 }));
  head.position.y = 1.62; g.add(head);
  g.animations = []; g.userData.model = g;
  return g;
}
/** Clone a rigged model (SkinnedMesh + bones) so each runner animates independently. */
function cloneRig(source) {
  const clone = source.clone(true);
  clone.animations = source.animations;
  // rebind skinned meshes to the cloned skeleton (three's clone keeps the old bones)
  const srcBones = [], dstBones = [];
  source.traverse((o) => { if (o.isBone) srcBones.push(o); });
  clone.traverse((o) => { if (o.isBone) dstBones.push(o); });
  const map = new Map(srcBones.map((b, i) => [b.uuid, dstBones[i]]));
  clone.traverse((o) => {
    if (o.isSkinnedMesh) {
      const bones = o.skeleton.bones.map((b) => map.get(b.uuid) ?? b);
      o.bind(new THREE.Skeleton(bones, o.skeleton.boneInverses), o.bindMatrix);
      o.material = o.material.clone();
    }
  });
  // animation tracks are bound by uuid; remap to the clone's bones
  const uuidMap = Object.fromEntries(srcBones.map((b, i) => [b.uuid, dstBones[i].uuid]));
  clone.animations = source.animations.map((clip) => {
    const c = clip.clone();
    for (const t of c.tracks) { const [uuid, prop] = t.name.split('.'); if (uuidMap[uuid]) t.name = `${uuidMap[uuid]}.${prop}`; }
    return c;
  });
  // the mixer root must be the cloned inner model
  const srcModel = source.userData.model;
  let dstModel = null;
  if (srcModel) { const idx = source.children.indexOf(srcModel); dstModel = clone.children[idx]; }
  clone.userData.model = dstModel ?? clone;
  return clone;
}
