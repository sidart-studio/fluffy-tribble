// Checkout Rush: you are the cashier. Groceries ride the belt toward the cash
// register; scan each one while it is inside the glowing scanner zone, leave
// the customer's own stuff alone, then ring up the total.

import * as THREE from 'three';
import { loadModelFitted } from './glb-loader.js';
import { CATALOG, DECOYS, money } from './items.js';
import { Sfx } from './audio.js';

// ---------------------------------------------------------------- layout
const COUNTER_TOP = 0.9;
const BELT = { start: -4.4, end: 1.55, z: 0.05, width: 0.95, y: COUNTER_TOP + 0.02 };
const SCAN_ZONE = { start: 0.55, end: 1.45 };
const REGISTER_POS = new THREE.Vector3(2.05, COUNTER_TOP, -0.15);
const BAG_POS = new THREE.Vector3(2.85, COUNTER_TOP, 0.5);
const CUSTOMER_STAND = new THREE.Vector3(-1.4, 0, -1.25);
const CUSTOMER_ENTER_X = -7;
const CUSTOMER_EXIT_X = 6.5;
const MAX_STRIKES = 3;
const BEST_KEY = 'checkout-rush:best:v1';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- difficulty
function levelConfig(level) {
  return {
    itemCount: Math.min(3 + level, 14),
    speed: Math.min(1.1 + 0.13 * (level - 1), 3.4),
    spacing: Math.max(0.55, 1.45 - 0.07 * (level - 1)),
    decoyChance: Math.min(0.06 + 0.03 * (level - 1), 0.35),
  };
}

// ---------------------------------------------------------------- game class
export class CheckoutRush {
  constructor({ canvas, manifestUrl = 'models/manifest.json' } = {}) {
    this.canvas = canvas;
    this.manifestUrl = manifestUrl;
    this.sfx = new Sfx();
    this.state = 'loading';
    this.items = [];
    this.floaters = [];
    this.coins = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.shake = 0;
    this.time = 0;
    this.catalog = CATALOG.map((c) => ({ ...c }));
    this.decoys = DECOYS.map((d) => ({ ...d }));
    this.credits = [];
    this.registerBaseScale = new THREE.Vector3(1, 1, 1);
    this.setupScene();
    this.bindInput();
    this.resetRun();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ scene
  setupScene() {
    // ?lowfx=1 (or a saved preference) turns off shadows and high-DPI rendering for weak GPUs.
    const params = new URLSearchParams(location.search);
    this.lowFx = params.get('lowfx') === '1' || (params.get('lowfx') !== '0' && localStorage.getItem('checkout-rush:lowfx') === '1');
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.lowFx, powerPreference: 'high-performance' });
    renderer.setPixelRatio(this.lowFx ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !this.lowFx;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd9e4ec);
    scene.fog = new THREE.Fog(0xd9e4ec, 14, 26);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    this.cameraHome = new THREE.Vector3(0.1, 3.4, 6.0);
    this.cameraLook = new THREE.Vector3(-0.5, 1.35, -0.4);
    this.camera.position.copy(this.cameraHome);
    this.camera.lookAt(this.cameraLook);

    // lights
    scene.add(new THREE.HemisphereLight(0xfaf6ee, 0x6b7a86, 0.9));
    const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.lowFx ? 512 : 2048, this.lowFx ? 512 : 2048);
    sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 25;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    const lamp = new THREE.PointLight(0xffd9a0, 12, 7, 2);
    lamp.position.set(2.2, 3.2, 1.2);
    scene.add(lamp);

    this.buildShop();
    this.buildCounter();
    this.buildBag();
    this.buildPlaceholderRegister();
    this.buildCustomer();
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
  }

  buildShop() {
    const floorTex = checkerTexture('#cfd5d9', '#b8c1c8', 8);
    floorTex.repeat.set(12, 12);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 1 }));
    wall.position.set(0, 4, -4.2);
    wall.receiveShadow = true;
    this.scene.add(wall);

    // back shelves with colorful stock
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.8 });
    const palette = [0xef5350, 0xffca28, 0x66bb6a, 0x42a5f5, 0xab47bc, 0xff7043, 0x26c6da];
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let sx = -9; sx <= 9; sx += 4.5) {
      const unit = new THREE.Group();
      for (let level = 0; level < 4; level++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(4, 0.08, 0.6), shelfMat);
        plank.position.set(0, 0.8 + level * 0.9, 0);
        plank.castShadow = true; plank.receiveShadow = true;
        unit.add(plank);
        for (let i = 0; i < 9; i++) {
          if (rnd() < 0.2) continue;
          const h = 0.3 + rnd() * 0.45;
          const g = new THREE.Mesh(new THREE.BoxGeometry(0.28 + rnd() * 0.1, h, 0.28), new THREE.MeshStandardMaterial({ color: palette[Math.floor(rnd() * palette.length)], roughness: 0.6 }));
          g.position.set(-1.75 + i * 0.44, 0.84 + level * 0.9 + h / 2, 0);
          g.castShadow = true;
          unit.add(g);
        }
      }
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.2, 0.6), shelfMat);
      side.position.set(-2.04, 2.1, 0); unit.add(side);
      const side2 = side.clone(); side2.position.x = 2.04; unit.add(side2);
      unit.position.set(sx, 0, -3.8);
      this.scene.add(unit);
    }

    // hanging sign
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 0.08), new THREE.MeshStandardMaterial({ map: signTexture('CHECKOUT  3'), roughness: 0.5 }));
    sign.position.set(-0.5, 3.6, -1.6);
    this.scene.add(sign);
    for (const dx of [-1.1, 1.1]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      chain.position.set(-0.5 + dx, 4.75, -1.6);
      this.scene.add(chain);
    }
  }

  buildCounter() {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f5563, roughness: 0.6 });
    const topMat = new THREE.MeshStandardMaterial({ color: 0xe0e6ea, roughness: 0.35, metalness: 0.1 });
    const length = 8.6, depth = 1.5, cx = -0.7;
    const base = new THREE.Mesh(new THREE.BoxGeometry(length, COUNTER_TOP - 0.06, depth - 0.1), bodyMat);
    base.position.set(cx, (COUNTER_TOP - 0.06) / 2, 0);
    base.castShadow = true; base.receiveShadow = true;
    this.scene.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(length + 0.1, 0.06, depth), topMat);
    top.position.set(cx, COUNTER_TOP - 0.03, 0);
    top.receiveShadow = true; top.castShadow = true;
    this.scene.add(top);

    // conveyor belt: scrolling stripes
    this.beltTex = beltTexture();
    this.beltTex.repeat.set(10, 1);
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(BELT.end - BELT.start + 0.4, BELT.width), new THREE.MeshStandardMaterial({ map: this.beltTex, roughness: 0.95 }));
    belt.rotation.x = -Math.PI / 2;
    belt.position.set((BELT.start + BELT.end) / 2 - 0.2, BELT.y, BELT.z);
    belt.receiveShadow = true;
    this.scene.add(belt);
    for (const dz of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(BELT.end - BELT.start + 0.4, 0.06, 0.05), new THREE.MeshStandardMaterial({ color: 0x9aa7b0, metalness: 0.6, roughness: 0.4 }));
      rail.position.set(belt.position.x, BELT.y + 0.02, BELT.z + dz * (BELT.width / 2 + 0.03));
      rail.castShadow = true;
      this.scene.add(rail);
    }

    // scanner zone glow strip + laser line
    this.zoneMat = new THREE.MeshStandardMaterial({ color: 0xff5252, emissive: 0xff1744, emissiveIntensity: 0.6, transparent: true, opacity: 0.35, depthWrite: false });
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(SCAN_ZONE.end - SCAN_ZONE.start, BELT.width), this.zoneMat);
    zone.rotation.x = -Math.PI / 2;
    zone.position.set((SCAN_ZONE.start + SCAN_ZONE.end) / 2, BELT.y + 0.006, BELT.z);
    this.scene.add(zone);
    const scanner = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.35), new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.4, metalness: 0.4 }));
    scanner.position.set((SCAN_ZONE.start + SCAN_ZONE.end) / 2, COUNTER_TOP + 0.06, BELT.z - BELT.width / 2 - 0.28);
    scanner.castShadow = true;
    this.scene.add(scanner);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 2 }));
    eye.position.set(scanner.position.x, COUNTER_TOP + 0.13, scanner.position.z + 0.18);
    this.scene.add(eye);
    this.scannerEye = eye;
  }

  buildBag() {
    const bag = new THREE.Group();
    const paper = new THREE.MeshStandardMaterial({ color: 0xc8a97e, roughness: 0.95, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.62, 0.4), paper);
    body.position.y = 0.31;
    body.castShadow = true;
    bag.add(body);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.5, 0.36), new THREE.MeshStandardMaterial({ color: 0x6d5537, roughness: 1 }));
    inner.position.y = 0.4;
    bag.add(inner);
    bag.position.copy(BAG_POS);
    this.scene.add(bag);
    this.bag = bag;
  }

  buildPlaceholderRegister() {
    // Used until the .glb loads (or if it cannot).
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.7), new THREE.MeshStandardMaterial({ color: 0x546e7a }));
    body.position.y = 0.25; g.add(body);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.08), new THREE.MeshStandardMaterial({ color: 0x263238 }));
    screen.position.set(0, 0.68, -0.2); screen.rotation.x = -0.3; g.add(screen);
    g.position.copy(REGISTER_POS);
    this.scene.add(g);
    this.register = g;
  }

  async loadModels() {
    let manifest = { register: null, items: [], decoys: [] };
    try {
      const res = await fetch(this.manifestUrl);
      if (res.ok) manifest = { ...manifest, ...(await res.json()) };
    } catch (err) {
      console.warn('[checkout] no manifest, using placeholders', err);
    }
    const status = [];

    if (manifest.register?.file) {
      this.setLoading(`Loading ${manifest.register.file}…`);
      try {
        const model = await loadModelFitted(`models/${manifest.register.file}`, { height: manifest.register.height ?? 1.15 });
        model.rotation.y = THREE.MathUtils.degToRad(manifest.register.rotationY ?? 0);
        model.position.copy(REGISTER_POS);
        this.scene.remove(this.register);
        this.scene.add(model);
        this.register = model;
        this.registerBaseScale.copy(model.scale);
        if (manifest.register.credit) this.credits.push(manifest.register.credit);
        status.push('register ✓');
      } catch (err) {
        console.error('[checkout] register model failed, keeping placeholder', err);
        status.push('register ✗ (placeholder)');
      }
    }

    const loadInto = async (list, entries, isDecoy) => {
      for (const e of entries ?? []) {
        if (!e.file) continue;
        this.setLoading(`Loading ${e.file}…`);
        try {
          const proto = await loadModelFitted(`models/${e.file}`, { height: e.height ?? 0.45 });
          proto.rotation.y = THREE.MathUtils.degToRad(e.rotationY ?? 0);
          const build = () => proto.clone(true);
          const existing = list.find((c) => c.id === e.id);
          if (existing) Object.assign(existing, { build, name: e.name ?? existing.name, price: e.price ?? existing.price });
          else list.push({ id: e.id ?? e.file, name: e.name ?? e.file, price: isDecoy ? 0 : (e.price ?? 2.5), build });
          if (e.credit) this.credits.push(e.credit);
          status.push(`${e.id ?? e.file} ✓`);
        } catch (err) {
          console.error(`[checkout] item model ${e.file} failed`, err);
          status.push(`${e.id ?? e.file} ✗`);
        }
      }
    };
    await loadInto(this.catalog, manifest.items, false);
    await loadInto(this.decoys, manifest.decoys, true);

    $('credits').textContent = this.credits.length ? `Models: ${this.credits.join(' · ')}` : '';
    this.setLoading('');
    this.state = 'title';
    $('btn-start').disabled = false;
    $('load-status').textContent = status.join('  ');
  }

  setLoading(msg) {
    $('load-status').textContent = msg;
  }

  buildCustomer() {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.8 });
    this.customerShirt = new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: 0.8 });
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.85, 12), new THREE.MeshStandardMaterial({ color: 0x37474f }));
    legs.position.y = 0.425; g.add(legs);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 6, 14), this.customerShirt);
    torso.position.y = 1.15; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), skin);
    head.position.y = 1.72; g.add(head);
    this.customerHair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4e342e }));
    this.customerHair.position.y = 1.74; g.add(this.customerHair);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshStandardMaterial({ color: 0x212121 }));
      eye.position.set(s * 0.07, 1.75, 0.18); g.add(eye);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.45, 4, 10), this.customerShirt);
      arm.position.set(s * 0.38, 1.15, 0.05); arm.rotation.z = s * 0.15; g.add(arm);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.set(CUSTOMER_ENTER_X, 0, CUSTOMER_STAND.z);
    this.scene.add(g);
    this.customer = g;
    this.customerTargetX = CUSTOMER_ENTER_X;
  }

  onResize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Narrow screens: pull the camera back and widen the view so the whole
    // belt and the register stay on screen.
    if (aspect < 0.8) {
      // portrait: frame the scanner zone and the register; items enter from the left edge
      this.cameraHome.set(0.9, 2.6, 6.3);
      this.cameraLook.set(0.75, 1.15, -0.3);
      this.camera.fov = 68;
    } else if (aspect < 1.3) {
      this.cameraHome.set(0.3, 3.8, 7.0);
      this.cameraLook.set(-0.4, 1.1, -0.4);
      this.camera.fov = 54;
    } else {
      this.cameraHome.set(0.1, 3.4, 6.0);
      this.cameraLook.set(-0.5, 1.35, -0.4);
      this.camera.fov = 42;
    }
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ input
  bindInput() {
    this.canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.tryTotal(); }
      else if (e.key === 'p' || e.key === 'P') this.togglePause();
      else if (e.key === 'm' || e.key === 'M') this.toggleMute();
      else if (e.key === 'l' || e.key === 'L') this.toggleLowFx();
    });
    $('btn-fx').addEventListener('click', () => this.toggleLowFx());
    $('btn-fx').textContent = this.lowFx ? 'Graphics: low' : 'Graphics: high';
    $('btn-start').addEventListener('click', () => this.startRun());
    $('btn-restart').addEventListener('click', () => this.startRun());
    $('btn-total').addEventListener('click', () => this.tryTotal());
    $('btn-pause').addEventListener('click', () => this.togglePause());
    $('btn-mute').addEventListener('click', () => this.toggleMute());
  }

  onPointer(e) {
    if (this.state !== 'serving' && this.state !== 'ready') return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hitboxes = this.items.filter((it) => it.alive).map((it) => it.hit);
    const hits = this.raycaster.intersectObjects(hitboxes, false);
    if (hits.length) {
      this.clickItem(hits[0].object.userData.item);
      return;
    }
    // clicking the register rings up the total
    const reg = this.raycaster.intersectObject(this.register, true);
    if (reg.length) this.tryTotal();
  }

  // ------------------------------------------------------------ run / customers
  resetRun() {
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.strikes = 0;
    this.level = 0;
    this.served = 0;
    this.receipt = [];
    this.clearItems();
    this.updateHud();
  }

  startRun() {
    if (this.state === 'loading') return;
    this.sfx.ensure();
    this.resetRun();
    $('overlay-title').classList.remove('show');
    $('overlay-over').classList.remove('show');
    $('hud').classList.add('show');
    this.nextCustomer();
  }

  nextCustomer() {
    this.level += 1;
    this.cfg = levelConfig(this.level);
    this.receipt = [];
    this.customerMistakes = 0;
    this.spawnQueue = this.makeQueue(this.cfg);
    this.spawnTimer = 1.6; // customer walks in first
    this.customerShirt.color.setHSL(Math.random(), 0.55, 0.5);
    this.customerHair.material.color.setHSL(Math.random() * 0.1, 0.5, 0.15 + Math.random() * 0.35);
    this.customer.position.set(CUSTOMER_ENTER_X, 0, CUSTOMER_STAND.z);
    this.customerTargetX = CUSTOMER_STAND.x;
    this.state = 'serving';
    this.customerStart = this.time;
    this.renderReceipt();
    this.updateHud();
    this.toast(`Customer ${this.level}: ${this.cfg.itemCount} items`, 'info');
    if (this.level > 1) this.sfx.levelUp();
    else this.sfx.bell();
  }

  makeQueue(cfg) {
    const queue = [];
    for (let i = 0; i < cfg.itemCount; i++) queue.push({ def: pick(this.catalog), isDecoy: false });
    // sprinkle decoys between groceries (never first, so the round opens fairly)
    for (let i = 1; i < queue.length; i++) {
      if (Math.random() < cfg.decoyChance) queue.splice(i, 0, { def: pick(this.decoys), isDecoy: true });
    }
    return queue;
  }

  spawnItem(entry) {
    const wrapper = new THREE.Group();
    const visual = entry.def.build();
    visual.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    wrapper.add(visual);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.22;
    wrapper.add(hit);
    wrapper.position.set(BELT.start - 0.3, BELT.y, BELT.z + (Math.random() - 0.5) * 0.25);
    wrapper.rotation.y = Math.random() * Math.PI * 2;
    wrapper.scale.setScalar(0.01);
    this.scene.add(wrapper);
    const item = { def: entry.def, isDecoy: entry.isDecoy, obj: wrapper, hit, alive: true, born: this.time, flash: 0, fly: null };
    hit.userData.item = item;
    this.items.push(item);
  }

  clearItems() {
    for (const it of this.items) this.scene.remove(it.obj);
    this.items = [];
    for (const f of this.floaters) f.el.remove();
    this.floaters = [];
    for (const c of this.coins) this.scene.remove(c.mesh);
    this.coins = [];
  }

  // ------------------------------------------------------------ actions
  clickItem(item) {
    if (!item.alive) return;
    const x = item.obj.position.x;
    if (item.isDecoy) {
      this.strike(`That's the customer's ${item.def.name.replace("Customer's ", '')}!`);
      this.retire(item, 'customer');
      return;
    }
    if (x < SCAN_ZONE.start) {
      this.combo = 0;
      item.flash = 0.35;
      this.sfx.tooEarly();
      this.float(item.obj.position, 'Too early', 'warn');
      this.updateHud();
      return;
    }
    // inside the zone (anything past the end is already gone)
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = this.multiplier();
    const pts = 10 * mult;
    this.score += pts;
    this.receipt.push({ name: item.def.name, price: item.def.price });
    this.sfx.scan(this.combo);
    this.float(item.obj.position, `+${pts}${mult > 1 ? `  ×${mult}` : ''}`, 'good');
    this.pulseZone();
    this.retire(item, 'bag');
    this.renderReceipt();
    this.updateHud();
  }

  multiplier() {
    return Math.min(1 + Math.floor(this.combo / 5), 4);
  }

  strike(msg) {
    this.strikes += 1;
    this.combo = 0;
    this.customerMistakes += 1;
    this.shake = 0.5;
    this.sfx.buzz();
    this.toast(msg, 'bad');
    this.updateHud();
    if (this.strikes >= MAX_STRIKES) this.gameOver();
  }

  retire(item, where) {
    item.alive = false;
    const from = item.obj.position.clone();
    let to;
    if (where === 'bag') to = BAG_POS.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.35, (Math.random() - 0.5) * 0.15));
    else if (where === 'customer') to = this.customer.position.clone().add(new THREE.Vector3(0, 1.1, 0.3));
    else to = REGISTER_POS.clone().add(new THREE.Vector3(-0.2, 0.3, 0));
    item.fly = { from, to, t: 0, dur: where === 'bag' ? 0.45 : 0.6 };
  }

  tryTotal() {
    if (this.state === 'ready') return this.total();
    if (this.state === 'serving') {
      this.sfx.tooEarly();
      this.toast('Still items on the belt!', 'warn');
    }
  }

  total() {
    this.state = 'paying';
    const sum = this.receipt.reduce((s, l) => s + l.price, 0);
    const elapsed = this.time - this.customerStart;
    const par = this.cfg.itemCount * this.cfg.spacing + 6;
    const speedBonus = Math.max(0, Math.round((par - elapsed) * 4));
    const clean = this.customerMistakes === 0 && this.receipt.length === this.cfg.itemCount;
    const bonus = 50 + speedBonus + (clean ? 75 : 0);
    this.score += bonus;
    this.served += 1;
    this.saveBest();
    this.sfx.chaChing();
    this.squash = 0.55;
    this.burstCoins();
    this.float(REGISTER_POS.clone().add(new THREE.Vector3(0, 1.3, 0)), `+${bonus}`, 'gold');
    this.renderReceipt({ total: sum, bonus, speedBonus, clean });
    this.toast(clean ? 'Flawless checkout! +75' : 'Paid. Next!', clean ? 'good' : 'info');
    this.updateHud();
    setTimeout(() => {
      if (this.state !== 'paying') return;
      this.customerTargetX = CUSTOMER_EXIT_X;
      setTimeout(() => { if (this.state === 'paying') this.nextCustomer(); }, 1300);
    }, 900);
  }

  saveBest() {
    let stored = 0;
    try { stored = Number(localStorage.getItem(BEST_KEY)) || 0; } catch {}
    const best = Math.max(this.score, stored);
    try { localStorage.setItem(BEST_KEY, String(best)); } catch {}
    return best;
  }

  gameOver() {
    this.state = 'over';
    this.sfx.gameOver();
    const best = this.saveBest();
    $('over-score').textContent = this.score;
    $('over-sub').textContent = `${this.served} customer${this.served === 1 ? '' : 's'} served · best combo ×${this.bestCombo} · best score ${best}`;
    $('overlay-over').classList.add('show');
  }

  togglePause() {
    if (this.state === 'serving' || this.state === 'ready') {
      this.pausedFrom = this.state;
      this.state = 'paused';
      $('btn-pause').textContent = 'Resume';
      this.toast('Paused', 'info', 99999);
    } else if (this.state === 'paused') {
      this.state = this.pausedFrom;
      $('btn-pause').textContent = 'Pause';
      this.toast('', 'info', 1);
    }
  }

  toggleLowFx() {
    try { localStorage.setItem('checkout-rush:lowfx', this.lowFx ? '0' : '1'); } catch {}
    const url = new URL(location.href);
    url.searchParams.set('lowfx', this.lowFx ? '0' : '1');
    location.href = url.href; // renderer settings need a fresh context
  }

  toggleMute() {
    this.sfx.muted = !this.sfx.muted;
    $('btn-mute').textContent = this.sfx.muted ? 'Unmute' : 'Mute';
  }

  // ------------------------------------------------------------ effects
  float(pos, text, kind) {
    const el = document.createElement('div');
    el.className = `floater ${kind}`;
    el.textContent = text;
    $('floaters').appendChild(el);
    this.floaters.push({ el, pos: pos.clone().add(new THREE.Vector3(0, 0.5, 0)), life: 1.1 });
  }

  toast(msg, kind, ms = 1600) {
    const el = $('toast');
    el.textContent = msg;
    el.className = `toast ${kind} ${msg ? 'show' : ''}`;
    clearTimeout(this.toastTimer);
    if (msg) this.toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  pulseZone() {
    this.zonePulse = 1;
  }

  burstCoins() {
    const geo = new THREE.CylinderGeometry(0.06, 0.06, 0.015, 14);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffc107, metalness: 0.9, roughness: 0.25 });
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(REGISTER_POS).add(new THREE.Vector3(0, 0.9, 0.2));
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.coins.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 2.4, 2.6 + Math.random() * 1.8, 1 + Math.random() * 1.6),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 1.4,
      });
    }
  }

  // ------------------------------------------------------------ frame
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.state !== 'paused') this.time += dt;
    if (this.state === 'serving' || this.state === 'ready') this.updateBelt(dt);
    if (this.state === 'serving' || this.state === 'ready' || this.state === 'paying') this.updateCustomer(dt);
    this.updateFlyers(dt);
    this.updateCoins(dt);
    this.updateFloaters();
    this.updateCamera(dt);
    // ambient animation
    this.scannerEye.material.emissiveIntensity = 1.5 + Math.sin(this.time * 12) * 0.8;
    this.zonePulse = Math.max(0, (this.zonePulse ?? 0) - dt * 3);
    this.zoneMat.opacity = 0.3 + 0.12 * Math.sin(this.time * 4) + this.zonePulse * 0.4;
    this.zoneMat.emissiveIntensity = 0.5 + this.zonePulse * 2;
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt);
      const k = this.squash / 0.55;
      const s = 1 + Math.sin(k * Math.PI * 3) * 0.12 * k;
      this.register.scale.set(this.registerBaseScale.x * (2 - s), this.registerBaseScale.y * s, this.registerBaseScale.z * (2 - s));
    }
    this.renderer.render(this.scene, this.camera);
  }

  updateBelt(dt) {
    const speed = this.cfg.speed;
    this.beltTex.offset.x += (speed / (BELT.end - BELT.start + 0.4)) * 10 * dt;

    // spawning
    if (this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnItem(this.spawnQueue.shift());
        this.spawnTimer = this.cfg.spacing;
      }
    }

    for (const it of this.items) {
      if (!it.alive) continue;
      it.obj.position.x += speed * dt;
      const grow = Math.min(1, (this.time - it.born) * 3);
      it.obj.scale.setScalar(grow);
      if (it.flash > 0) {
        it.flash -= dt;
        it.obj.position.y = BELT.y + Math.abs(Math.sin(it.flash * 30)) * 0.04;
      } else it.obj.position.y = BELT.y;
      if (it.obj.position.x > SCAN_ZONE.end + 0.1) {
        if (it.isDecoy) {
          this.score += 5;
          this.sfx.pop();
          this.float(it.obj.position, 'Good eye +5', 'good');
          this.retire(it, 'customer');
        } else {
          this.strike(`Missed the ${it.def.name}!`);
          this.retire(it, 'register');
        }
        this.updateHud();
      }
    }

    // all items resolved?
    if (this.state === 'serving' && !this.spawnQueue.length && this.items.every((i) => !i.alive)) {
      this.state = 'ready';
      this.toast('Belt clear. Press SPACE or tap the register to total', 'info', 4000);
      $('btn-total').classList.add('ready');
      this.sfx.bell();
    }
    if (this.state !== 'ready') $('btn-total').classList.remove('ready');
  }

  updateCustomer(dt) {
    const c = this.customer;
    const dx = this.customerTargetX - c.position.x;
    if (Math.abs(dx) > 0.02) {
      c.position.x += Math.sign(dx) * Math.min(Math.abs(dx), 3.2 * dt);
      c.position.y = Math.abs(Math.sin(this.time * 9)) * 0.05;
      c.rotation.y = dx > 0 ? 0.35 : -0.35;
    } else {
      c.position.y = Math.sin(this.time * 2) * 0.01;
      c.rotation.y = 0;
    }
  }

  updateFlyers(dt) {
    for (const it of this.items) {
      if (!it.fly) continue;
      it.fly.t += dt / it.fly.dur;
      const k = Math.min(1, it.fly.t);
      const e = k * k * (3 - 2 * k);
      it.obj.position.lerpVectors(it.fly.from, it.fly.to, e);
      it.obj.position.y += Math.sin(k * Math.PI) * 0.7;
      it.obj.rotation.y += dt * 6;
      it.obj.scale.setScalar(1 - e * 0.85);
      if (k >= 1) {
        this.scene.remove(it.obj);
        it.fly = null;
        it.done = true;
      }
    }
    if (this.items.some((i) => i.done)) this.items = this.items.filter((i) => !i.done);
  }

  updateCoins(dt) {
    for (const c of this.coins) {
      c.life -= dt;
      c.vel.y -= 9 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.z += c.spin.z * dt;
      if (c.mesh.position.y < COUNTER_TOP + 0.01 && c.mesh.position.x < 3.1 && c.mesh.position.x > -5) {
        c.mesh.position.y = COUNTER_TOP + 0.01; c.vel.y *= -0.35; c.vel.x *= 0.7; c.vel.z *= 0.7;
      }
      if (c.life <= 0) this.scene.remove(c.mesh);
    }
    this.coins = this.coins.filter((c) => c.life > 0);
  }

  updateFloaters() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    for (const f of this.floaters) {
      f.life -= 0.016;
      f.pos.y += 0.012;
      v.copy(f.pos).project(this.camera);
      f.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
      f.el.style.opacity = Math.max(0, Math.min(1, f.life * 1.5));
      if (f.life <= 0) f.el.remove();
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  updateCamera(dt) {
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const s = this.shake * this.shake * 0.12;
    this.camera.position.set(
      this.cameraHome.x + (Math.random() - 0.5) * s,
      this.cameraHome.y + (Math.random() - 0.5) * s,
      this.cameraHome.z,
    );
    this.camera.lookAt(this.cameraLook);
  }

  // ------------------------------------------------------------ HUD
  updateHud() {
    $('hud-score').textContent = this.score;
    $('hud-combo').textContent = this.combo ? `×${this.multiplier()} (${this.combo})` : '–';
    $('hud-customer').textContent = this.level || '–';
    $('hud-left').textContent = this.state === 'serving' || this.state === 'ready'
      ? this.spawnQueue.filter((q) => !q.isDecoy).length + this.items.filter((i) => i.alive && !i.isDecoy).length
      : '–';
    $('hud-strikes').innerHTML = Array.from({ length: MAX_STRIKES }, (_, i) => `<span class="${i < this.strikes ? 'lost' : ''}">♥</span>`).join('');
  }

  renderReceipt(summary) {
    const lines = this.receipt.map((l) => `<li><span>${escapeHtml(l.name)}</span><span>${money(l.price)}</span></li>`).join('');
    const sum = this.receipt.reduce((s, l) => s + l.price, 0);
    let foot = `<li class="sub"><span>Subtotal</span><span>${money(sum)}</span></li>`;
    if (summary) {
      foot += `<li class="total"><span>TOTAL</span><span>${money(summary.total)}</span></li>`;
      foot += `<li class="bonus"><span>Service bonus</span><span>+${summary.bonus}</span></li>`;
      if (summary.speedBonus) foot += `<li class="bonus"><span>Speed</span><span>+${summary.speedBonus}</span></li>`;
      if (summary.clean) foot += `<li class="bonus"><span>Flawless</span><span>+75</span></li>`;
    }
    $('receipt-lines').innerHTML = lines || '<li class="empty">Waiting for items…</li>';
    $('receipt-foot').innerHTML = foot;
    const list = $('receipt-lines');
    list.scrollTop = list.scrollHeight;
  }
}

// ---------------------------------------------------------------- helpers
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function checkerTexture(a, b, n) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const s = 256 / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    ctx.fillStyle = (x + y) % 2 ? a : b;
    ctx.fillRect(x * s, y * s, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function beltTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#23272b'; ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#31363b'; ctx.fillRect(0, 0, 10, 64);
  ctx.fillStyle = '#1b1e21'; ctx.fillRect(64, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 140;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e88e5'; ctx.fillRect(0, 0, 512, 140);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 76px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 74);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
