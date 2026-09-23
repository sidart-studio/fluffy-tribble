// Static diner scene: floor, walls, counters, tables, decor, and primitive
// builders for the things that have no model yet (customers, food, the chef).

import * as THREE from 'three';

export const COUNTER_TOP = 0.95;
export const L = {
  register: new THREE.Vector3(3.0, COUNTER_TOP, 1.2),
  cashStack: new THREE.Vector3(2.15, COUNTER_TOP, 1.25),
  cashier: new THREE.Vector3(2.3, 0, 0.3),
  queueHead: new THREE.Vector3(3.0, 0, 2.3),
  queueStep: 0.75,
  queueMax: 7,
  pickupSlots: [new THREE.Vector3(-3.0, COUNTER_TOP, 1.2), new THREE.Vector3(-2.3, COUNTER_TOP, 1.2), new THREE.Vector3(-1.6, COUNTER_TOP, 1.2)],
  pickupStand: new THREE.Vector3(-2.3, 0, 0.35),
  waitSpots: [],
  passSlots: [new THREE.Vector3(-1.0, COUNTER_TOP, -2.6), new THREE.Vector3(-0.3, COUNTER_TOP, -2.6), new THREE.Vector3(0.4, COUNTER_TOP, -2.6), new THREE.Vector3(1.1, COUNTER_TOP, -2.6)],
  passStand: new THREE.Vector3(0.0, 0, -1.8),
  runnerIdle: [new THREE.Vector3(-1.2, 0, -1.2), new THREE.Vector3(-0.2, 0, -0.9), new THREE.Vector3(0.8, 0, -1.2)],
  // kitchen: the sirkitree set is a corner unit open toward +z; the chef works inside it
  kitchen: new THREE.Vector3(1.7, 0, -4.55),
  chef: new THREE.Vector3(1.7, 0, -3.9),
  stove: new THREE.Vector3(1.7, 0, -4.0),       // stand here facing the back wall to cook
  prep: new THREE.Vector3(1.9, 0, -3.3),        // behind the pass, facing the cutting board
  passStandChef: -3.3,                          // z where the chef stands to set plates on the pass
  cabinets: [new THREE.Vector3(-1.3, 1.45, -5.7), new THREE.Vector3(-2.5, 1.45, -5.7), new THREE.Vector3(-3.7, 1.45, -5.7)],
  knife: new THREE.Vector3(1.9, COUNTER_TOP + 0.02, -2.55),
  door: new THREE.Vector3(-7.0, 0, 6.2),
  spawn: new THREE.Vector3(-9.5, 0, 7.5),
  corridor: new THREE.Vector3(-3.5, 0, 6.0),
  tables: [new THREE.Vector3(5.6, 0, 3.2), new THREE.Vector3(5.6, 0, 5.4), new THREE.Vector3(-5.6, 0, 3.2), new THREE.Vector3(-5.6, 0, 5.4)],
};
for (let i = 0; i < 9; i++) L.waitSpots.push(new THREE.Vector3(-3.4 + (i % 3) * 0.9, 0, 2.4 + Math.floor(i / 3) * 0.85));

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });

function shadowed(m) {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildWorld(scene) {
  // floor: black & white diner checker
  const checker = canvasTexture(256, (ctx) => {
    const n = 8, s = 256 / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { ctx.fillStyle = (x + y) % 2 ? '#f3efe6' : '#2b2f38'; ctx.fillRect(x * s, y * s, s, s); }
  });
  checker.repeat.set(8, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // sidewalk outside the front
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(26, 5), mat(0x9aa0a6, { roughness: 1 }));
  walk.rotation.x = -Math.PI / 2; walk.position.set(0, -0.002, 8.5); walk.receiveShadow = true; scene.add(walk);

  // walls: back + two sides, front is open to the camera
  const wallMat = mat(0xbfe3d6, { roughness: 0.95 });
  const back = shadowed(new THREE.Mesh(new THREE.BoxGeometry(16, 3.2, 0.2), wallMat)); back.position.set(0, 1.6, -6.1); scene.add(back);
  const wainscot = new THREE.Mesh(new THREE.BoxGeometry(16, 1.0, 0.24), mat(0xc73e3a, { roughness: 0.6 })); wainscot.position.set(0, 0.5, -6.08); scene.add(wainscot);
  for (const sx of [-1, 1]) {
    const side = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 12), wallMat)); side.position.set(sx * 8.1, 1.6, 0); scene.add(side);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 3.2), new THREE.MeshStandardMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2 }));
    win.position.set(sx * 8.05, 1.8, 3.0); scene.add(win);
  }
  // door frame at the front-left
  const frame = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.15), mat(0xc73e3a))); frame.position.set(L.door.x, 1.2, 6.1); scene.add(frame);
  const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.06), new THREE.MeshStandardMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.4 })); doorGlass.position.set(L.door.x, 1.1, 6.1); scene.add(doorGlass);
  // low front wall segments either side of the door so the room reads as a room
  const fw1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.0, 0.2), wallMat)); fw1.position.set(-4.5 + 1.15, 0.5, 6.1); fw1.position.x = -3.4; scene.add(fw1);
  const fw2 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(8.0, 1.0, 0.2), wallMat)); fw2.position.set(4.0, 0.5, 6.1); scene.add(fw2);

  // front counter (order + pickup) with chrome trim and red base
  const counterBase = shadowed(new THREE.Mesh(new THREE.BoxGeometry(7.4, COUNTER_TOP - 0.05, 0.9), mat(0xc73e3a, { roughness: 0.5 })));
  counterBase.position.set(0, (COUNTER_TOP - 0.05) / 2, 1.2); scene.add(counterBase);
  const counterTop = shadowed(new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.06, 1.0), mat(0xf5f1e8, { roughness: 0.3 })));
  counterTop.position.set(0, COUNTER_TOP - 0.03, 1.2); scene.add(counterTop);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.05, 0.05), mat(0xd9dde3, { metalness: 0.9, roughness: 0.25 }));
  trim.position.set(0, COUNTER_TOP - 0.06, 1.72); scene.add(trim);
  // "PICK UP" and "ORDER" labels on the counter front
  const labelPick = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshBasicMaterial({ map: textTexture('PICK UP', '#fff5e1', '#c73e3a'), transparent: true }));
  labelPick.position.set(-2.3, 0.55, 1.66); scene.add(labelPick);
  const labelOrder = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshBasicMaterial({ map: textTexture('ORDER HERE', '#fff5e1', '#c73e3a'), transparent: true }));
  labelOrder.position.set(2.8, 0.55, 1.66); scene.add(labelOrder);

  // kitchen pass counter
  const pass = shadowed(new THREE.Mesh(new THREE.BoxGeometry(4.4, COUNTER_TOP - 0.05, 0.8), mat(0xd9dde3, { metalness: 0.7, roughness: 0.35 })));
  pass.position.set(0.3, (COUNTER_TOP - 0.05) / 2, -2.6); scene.add(pass);
  const passTop = shadowed(new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.06, 0.9), mat(0xe8ebef, { metalness: 0.8, roughness: 0.25 })));
  passTop.position.set(0.3, COUNTER_TOP - 0.03, -2.6); scene.add(passTop);
  const heatLamp = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.08, 0.3), mat(0x3a3f47, { metalness: 0.6 }));
  heatLamp.position.set(0.3, 2.1, -2.6); scene.add(heatLamp);
  for (let i = 0; i < 4; i++) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffb36b, emissive: 0xff8a3d, emissiveIntensity: 2 }));
    bulb.position.set(-1.0 + i * 0.85, 2.02, -2.6); scene.add(bulb);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.1), mat(0x3a3f47)); rod.position.set(-1.0 + i * 0.85, 2.65, -2.6); scene.add(rod);
  }
  // cutting board where the knife goes
  const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.35), mat(0xc8a06a, { roughness: 0.9 })));
  board.position.set(L.knife.x, COUNTER_TOP + 0.01, L.knife.z); scene.add(board);

  // menu board above the register
  const menuBoard = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 0.08), mat(0x2b2f38));
  menuBoard.position.set(-3.6, 2.55, -5.95); scene.add(menuBoard);
  const menuFace = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: textTexture('SHORT ORDER  ·  MENU', '#ffd166', '#2b2f38', 44) }));
  menuFace.position.set(-3.6, 2.55, -5.9); scene.add(menuFace);

  // ceiling lamps are placed by the game (the Ali12 light model), see game.js placeLamps()

  // plants by the door
  for (const x of [-5.6, 6.9]) scene.add(plant(x, 5.6));
}

export function buildTable(pos) {
  const g = new THREE.Group();
  const top = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 24), mat(0xf5f1e8, { roughness: 0.3 })));
  top.position.y = 0.78; g.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 8, 32), mat(0xd9dde3, { metalness: 0.9, roughness: 0.25 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.78; g.add(rim);
  const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 12), mat(0xd9dde3, { metalness: 0.9, roughness: 0.25 })));
  leg.position.y = 0.38; g.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20), mat(0xd9dde3, { metalness: 0.9 })); foot.position.y = 0.02; g.add(foot);
  g.userData.seats = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const cx = Math.cos(a) * 1.05, cz = Math.sin(a) * 1.05;
    const seat = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 16), mat(0xc73e3a, { roughness: 0.5 })));
    seat.position.set(cx, 0.48, cz); g.add(seat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 10), mat(0xd9dde3, { metalness: 0.9 })); stem.position.set(cx, 0.22, cz); g.add(stem);
    g.userData.seats.push(new THREE.Vector3(pos.x + cx, 0, pos.z + cz));
  }
  g.position.copy(pos);
  return g;
}

export function buildCustomer(rng = Math.random) {
  const g = new THREE.Group();
  const hue = rng();
  const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue, 0.55, 0.5), roughness: 0.8 });
  const skin = mat([0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac][Math.floor(rng() * 5)], { roughness: 0.85 });
  const legs = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.75, 12), mat([0x2b2f38, 0x3b5b8a, 0x5a4636][Math.floor(rng() * 3)])));
  legs.position.y = 0.375; g.add(legs);
  const torso = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.42, 6, 14), shirt)); torso.position.y = 1.02; g.add(torso);
  const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.19, 18, 14), skin)); head.position.y = 1.55; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(new THREE.Color().setHSL(rng() * 0.12, 0.5, 0.12 + rng() * 0.4)));
  hair.position.y = 1.56; g.add(hair);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), mat(0x222222)); eye.position.set(s * 0.065, 1.58, 0.17); g.add(eye);
    const arm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.4, 4, 10), shirt)); arm.position.set(s * 0.33, 1.0, 0.03); arm.rotation.z = s * 0.12; g.add(arm);
    arm.name = s < 0 ? 'armL' : 'armR';
  }
  const hand = new THREE.Group(); hand.name = 'hand'; hand.position.set(0.15, 1.05, 0.32); g.add(hand);
  return g;
}

export function buildChefPlaceholder() {
  // Stands in for the chef model until it arrives.
  const g = new THREE.Group();
  const white = mat(0xf7f7f2, { roughness: 0.9 });
  const legs = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.8, 12), mat(0x2b2f38))); legs.position.y = 0.4; g.add(legs);
  const torso = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.45, 6, 14), white)); torso.position.y = 1.1; g.add(torso);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.05), mat(0xc73e3a)); apron.position.set(0, 0.95, 0.3); g.add(apron);
  const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), mat(0xe0ac69))); head.position.y = 1.66; g.add(head);
  const hat = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.32, 16), white)); hat.position.y = 1.98; g.add(hat);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), white); puff.position.y = 2.12; puff.scale.y = 0.6; g.add(puff);
  const mustache = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 12, Math.PI), mat(0x3e2723)); mustache.position.set(0, 1.58, 0.19); mustache.rotation.x = Math.PI; g.add(mustache);
  for (const s of [-1, 1]) { const arm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 4, 10), white)); arm.position.set(s * 0.38, 1.05, 0.1); arm.rotation.x = -0.9; g.add(arm); }
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('chef model coming soon', '#ffffff', '#00000099', 36), transparent: true, depthTest: false }));
  label.scale.set(1.6, 0.4, 1); label.position.y = 2.55; g.add(label);
  return g;
}

/**
 * A plate of food. `protos.kebab` is the fitted Poly kebab model; skewers are
 * cloned from it and their meat cubes tinted per dish. Anything without a
 * model falls back to primitives.
 */
/** A toque to attach to the chef's head bone. */
export function buildToque() {
  const g = new THREE.Group();
  const white = mat(0xf7f7f2, { roughness: 0.9 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.16, 18), white); band.position.y = 0.08; g.add(band);
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), white); puff.position.y = 0.22; puff.scale.y = 0.65; g.add(puff);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildFood(item, protos = {}) {
  const g = new THREE.Group();
  // a small saucer: the skewer should overhang it like a real kebab plate
  const plateR = item.shape === 'platter' || item.shape === 'special' ? 0.17 : 0.13;
  const plate = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(plateR, plateR * 0.8, 0.025, 20), mat(0xf7f7f2, { roughness: 0.3 })));
  plate.position.y = 0.0125; g.add(plate);
  const c = item.color;
  // Bites are a clipping plane shared by every edible mesh on the plate; the
  // game moves it along the skewer while a guest eats (see Game.updateEating).
  const bitePlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  g.userData.bitePlane = bitePlane;
  g.userData.skewers = [];
  g.userData.skewerLength = protos.kebab ? protos.kebab.userData.size.y : 0.4;
  const skewer = (tint, dx = 0, dz = 0, yaw = 0) => {
    if (!protos.kebab) {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), mat(tint ?? c));
      k.material.clippingPlanes = [bitePlane];
      k.position.set(dx, 0.06, dz); k.rotation.set(0, yaw, Math.PI / 2); g.userData.skewers.push(k); return k;
    }
    const k = protos.kebab.clone(true);
    k.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        if (tint && /lambert3SG/.test(o.material.name)) o.material.color.setHex(tint);
        // everything but the metal stick gets eaten
        if (!/lambert2SG/.test(o.material.name)) { o.material.clippingPlanes = [bitePlane]; o.material.clipShadows = true; }
        o.castShadow = true;
      }
    });
    // the model is an upright skewer (local +y = tip): lay it across the plate
    const size = protos.kebab.userData.size;
    k.rotation.set(0, yaw, Math.PI / 2);
    k.position.set(dx + size.y / 2 * Math.cos(yaw), 0.025 + size.x / 2, dz - size.y / 2 * Math.sin(yaw));
    g.userData.skewers.push(k);
    return k;
  };
  switch (item.shape) {
    case 'kebab': {
      g.add(skewer(item.meat));
      const lemon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), mat(0xfff176)); lemon.position.set(0.08, 0.035, 0.09); g.add(lemon);
      break;
    }
    case 'platter': {
      g.add(skewer(0xf0c987, 0, -0.08, 0));
      g.add(skewer(0x6b3a26, 0, 0.0, 0));
      g.add(skewer(0x8d4a3a, 0, 0.08, 0));
      break;
    }
    case 'burger': {
      const bun = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd9954a))); bun.position.y = 0.16; g.add(bun);
      const patty = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), mat(0x5b3a29)); patty.position.y = 0.1; g.add(patty);
      const lettuce = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 16), mat(0x6abf4b)); lettuce.position.y = 0.135; g.add(lettuce);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.05, 16), mat(0xd9954a)); base.position.y = 0.055; g.add(base);
      break;
    }
    case 'fries': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.12), mat(0xc73e3a)); box.position.y = 0.11; g.add(box);
      for (let i = 0; i < 7; i++) { const fry = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), mat(c)); fry.position.set(-0.07 + i * 0.023, 0.24, (i % 2) * 0.04 - 0.02); fry.rotation.z = (i - 3) * 0.08; g.add(fry); }
      break;
    }
    case 'cup': {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.2, 16), mat(0xf7f7f2)); cup.position.y = 0.12; g.add(cup);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 16), mat(c)); lid.position.y = 0.23; g.add(lid);
      const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.18, 6), mat(0xc73e3a)); straw.position.set(0.025, 0.31, 0); straw.rotation.z = 0.2; g.add(straw);
      break;
    }
    case 'slice': {
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.36, -0.13); shape.lineTo(0.36, 0.13); shape.lineTo(0, 0);
      const slice = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }), mat(c)); slice.rotation.x = -Math.PI / 2; slice.position.set(-0.17, 0.06, 0); g.add(slice);
      for (let i = 0; i < 3; i++) { const pep = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 10), mat(0xb0332f)); pep.position.set(0.0 + i * 0.07 - 0.05, 0.075, (i - 1) * 0.04); g.add(pep); }
      break;
    }
    case 'bowl': {
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0x3b5b8a, { side: THREE.DoubleSide })); bowl.position.y = 0.2; g.add(bowl);
      const food = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(c)); food.position.y = 0.19; food.scale.y = 0.5; g.add(food);
      break;
    }
    case 'steak': {
      const steak = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 16), mat(c)); steak.scale.x = 1.3; steak.position.set(-0.04, 0.055, 0); g.add(steak);
      const mash = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), mat(0xfff1c9)); mash.position.set(0.13, 0.08, 0.06); g.add(mash);
      const peas = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0x6abf4b)); peas.position.set(0.12, 0.06, -0.08); g.add(peas);
      break;
    }
    case 'special': {
      g.add(skewer(0xc63d5c, 0, -0.05, 0));
      g.add(skewer(0xf0c987, 0, 0.06, 0));
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xffb74d, emissive: 0xff7043, emissiveIntensity: 2 })); flame.position.set(0.12, 0.1, 0); g.add(flame);
      const glow = new THREE.PointLight(c, 1.5, 1.2); glow.position.y = 0.3; g.add(glow);
      break;
    }
  }
  return g;
}

export function buildCoin() {
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 14), mat(0xffc107, { metalness: 0.9, roughness: 0.25 }));
  coin.castShadow = true;
  return coin;
}

export function buildBill() {
  const bill = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), mat(0x4caf50, { side: THREE.DoubleSide, roughness: 0.8 }));
  return bill;
}

function plant(x, z) {
  const g = new THREE.Group();
  const pot = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.45, 14), mat(0xb0532f))); pot.position.y = 0.225; g.add(pot);
  for (let i = 0; i < 6; i++) {
    const leaf = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 6), mat(0x3f8f4a)));
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.15, 0.75, Math.sin(a) * 0.15); leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}

export function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function textTexture(text, fg, bg, fontPx = 52) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = fg; ctx.font = `bold ${fontPx}px "Lilita One", "Arial Black", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
