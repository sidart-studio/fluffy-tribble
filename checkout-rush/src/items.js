// Things that ride the conveyor belt. Groceries are built from primitives so
// the game works before any item models exist; a `models/manifest.json`
// entry with a `file` replaces a catalog entry's look with a real .glb.

import * as THREE from 'three';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });

function box(w, h, d, color, extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color, extra));
  m.position.y = h / 2;
  return m;
}
function cyl(rTop, rBot, h, color, extra, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), std(color, extra));
  m.position.y = h / 2;
  return m;
}
function sphere(r, color, extra) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), std(color, extra));
  m.position.y = r;
  return m;
}
function group(...parts) {
  const g = new THREE.Group();
  for (const p of parts) g.add(p);
  return g;
}
function band(parent, y, r, h, color) {
  const b = cyl(r * 1.02, r * 1.02, h, color, { roughness: 0.5 });
  b.position.y = y;
  parent.add(b);
}

export const CATALOG = [
  {
    id: 'soup', name: 'Tomato Soup', price: 1.79, build: () => {
      const g = group(cyl(0.16, 0.16, 0.42, 0xd8d8dc, { metalness: 0.6, roughness: 0.35 }));
      band(g, 0.21, 0.16, 0.24, 0xc62828);
      return g;
    },
  },
  {
    id: 'cereal', name: 'Crunch-O Cereal', price: 4.49, build: () => {
      const g = group(box(0.42, 0.6, 0.16, 0xf9a825));
      const label = box(0.3, 0.3, 0.005, 0xffffff); label.position.set(0, 0.34, 0.083); g.add(label);
      return g;
    },
  },
  {
    id: 'milk', name: 'Whole Milk', price: 3.29, build: () => {
      const g = group(box(0.26, 0.5, 0.26, 0xf5f5f5));
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 4), std(0x1565c0));
      roof.rotation.y = Math.PI / 4; roof.position.y = 0.57; g.add(roof);
      const stripe = box(0.262, 0.1, 0.262, 0x1565c0); stripe.position.y = 0.2; g.add(stripe);
      return g;
    },
  },
  {
    id: 'apple', name: 'Apple', price: 0.89, build: () => {
      const g = group(sphere(0.15, 0xd32f2f, { roughness: 0.4 }));
      const stem = cyl(0.015, 0.015, 0.08, 0x5d4037); stem.position.y = 0.3; g.add(stem);
      return g;
    },
  },
  {
    id: 'banana', name: 'Bananas', price: 1.25, build: () => {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 10, 16, Math.PI * 0.75), std(0xfdd835, { roughness: 0.5 }));
        b.rotation.z = Math.PI * 0.12; b.rotation.x = Math.PI / 2 + i * 0.25; b.position.set(0, 0.09, (i - 1) * 0.07);
        g.add(b);
      }
      return g;
    },
  },
  {
    id: 'soda', name: 'Fizz Cola', price: 1.99, build: () => {
      const g = group(cyl(0.11, 0.11, 0.5, 0x6d4c41, { roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }));
      const neck = cyl(0.05, 0.11, 0.12, 0x6d4c41, { roughness: 0.2, transparent: true, opacity: 0.9 }); neck.position.y = 0.56; g.add(neck);
      const cap = cyl(0.05, 0.05, 0.05, 0xe53935); cap.position.y = 0.645; g.add(cap);
      band(g, 0.25, 0.11, 0.18, 0xe53935);
      return g;
    },
  },
  {
    id: 'bread', name: 'Sourdough Loaf', price: 3.75, build: () => {
      const g = group(box(0.52, 0.22, 0.26, 0xc68642, { roughness: 0.9 }));
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.52, 16, 1, false, 0, Math.PI), std(0xb5773a, { roughness: 0.9 }));
      top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2; top.position.y = 0.22; g.add(top);
      return g;
    },
  },
  {
    id: 'eggs', name: 'Dozen Eggs', price: 2.99, build: () => group(box(0.44, 0.14, 0.3, 0xb0bec5, { roughness: 0.95 })),
  },
  {
    id: 'cheese', name: 'Cheddar Wedge', price: 5.15, build: () => {
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.42, 0); shape.lineTo(0.42, 0.24); shape.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false });
      const m = new THREE.Mesh(geo, std(0xffb300, { roughness: 0.6 }));
      m.rotation.x = -Math.PI / 2; m.position.set(-0.21, 0.22, 0.12);
      return group(m);
    },
  },
  {
    id: 'detergent', name: 'Laundry Soap', price: 8.99, build: () => {
      const g = group(box(0.34, 0.5, 0.2, 0x1e88e5, { roughness: 0.4 }));
      const cap = cyl(0.07, 0.07, 0.08, 0xff7043); cap.position.set(0.08, 0.54, 0); g.add(cap);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16), std(0x1e88e5)); handle.position.set(-0.1, 0.5, 0); g.add(handle);
      return g;
    },
  },
  {
    id: 'coffee', name: 'Ground Coffee', price: 7.49, build: () => {
      const g = group(box(0.28, 0.4, 0.14, 0x3e2723));
      const lbl = box(0.2, 0.16, 0.005, 0xefebe9); lbl.position.set(0, 0.22, 0.073); g.add(lbl);
      return g;
    },
  },
  {
    id: 'watermelon', name: 'Watermelon', price: 4.99, build: () => {
      const m = sphere(0.24, 0x2e7d32, { roughness: 0.5 }); m.scale.set(1.25, 1, 1);
      const g = group(m);
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.015, 6, 24), std(0x1b5e20));
        s.rotation.y = (i / 6) * Math.PI; s.position.y = 0.24; s.scale.set(1.25, 1, 1); g.add(s);
      }
      return g;
    },
  },
];

// Not-for-sale things that sneak onto the belt. Scanning these is a strike.
export const DECOYS = [
  {
    id: 'wallet', name: "Customer's wallet", build: () => {
      const g = group(box(0.3, 0.06, 0.2, 0x5d4037, { roughness: 0.8 }));
      const clasp = box(0.06, 0.02, 0.2, 0xc9a227, { metalness: 0.8, roughness: 0.3 }); clasp.position.set(0.12, 0.065, 0); g.add(clasp);
      return g;
    },
  },
  {
    id: 'phone', name: "Customer's phone", build: () => {
      const g = group(box(0.16, 0.02, 0.32, 0x212121, { roughness: 0.3, metalness: 0.3 }));
      const screen = box(0.14, 0.005, 0.29, 0x42a5f5, { emissive: 0x1e88e5, emissiveIntensity: 0.7 }); screen.position.y = 0.022; g.add(screen);
      return g;
    },
  },
  {
    id: 'keys', name: "Customer's keys", build: () => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 20), std(0xbdbdbd, { metalness: 0.9, roughness: 0.3 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.015; g.add(ring);
      for (let i = 0; i < 3; i++) {
        const k = box(0.05, 0.01, 0.16, 0x9e9e9e, { metalness: 0.9, roughness: 0.3 });
        k.position.set(0.05 + i * 0.02, 0.01 + i * 0.012, 0.13); k.rotation.y = (i - 1) * 0.3; g.add(k);
      }
      return g;
    },
  },
  {
    id: 'kitten', name: 'A kitten (?!)', build: () => {
      const body = sphere(0.14, 0xff9800, { roughness: 0.9 }); body.scale.set(1.3, 0.9, 1);
      const head = sphere(0.1, 0xff9800, { roughness: 0.9 }); head.position.set(0.2, 0.2, 0);
      const g = group(body, head);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), std(0xff9800)); ear.position.set(0.22, 0.3, s * 0.06); g.add(ear);
        const eye = sphere(0.015, 0x212121); eye.position.set(0.29, 0.21, s * 0.04); g.add(eye);
      }
      const tail = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 8, 16, Math.PI), std(0xff9800)); tail.position.set(-0.2, 0.15, 0); g.add(tail);
      return g;
    },
  },
];

export function money(n) {
  return `$${n.toFixed(2)}`;
}
