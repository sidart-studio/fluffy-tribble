// Grid navigation for the diner: obstacles are painted onto a coarse grid,
// paths come from A* and are then straightened, and people get a soft push
// away from each other so they never overlap.

import * as THREE from 'three';

export const MASK = { CUSTOMER: 1, STAFF: 2, CHEF: 4, ALL: 7 };

export class NavGrid {
  constructor({ minX = -12, maxX = 12, minZ = -8, maxZ = 11, cell = 0.25, radius = 0.22 } = {}) {
    this.minX = minX; this.minZ = minZ; this.cell = cell; this.radius = radius;
    this.cols = Math.ceil((maxX - minX) / cell);
    this.rows = Math.ceil((maxZ - minZ) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.defs = [];       // obstacle definitions, replayed on rebuild()
    this.version = 0;     // bumped whenever the grid changes so agents re-path
  }

  // ---- painting obstacles -----------------------------------------------
  rect(x1, x2, z1, z2, mask = MASK.ALL, inflate = this.radius) {
    this.defs.push({ kind: 'rect', x1, x2, z1, z2, mask, inflate });
    this.paint(this.defs[this.defs.length - 1]);
    this.version++;
  }
  circle(cx, cz, r, mask = MASK.ALL, inflate = this.radius) {
    this.defs.push({ kind: 'circle', cx, cz, r, mask, inflate });
    this.paint(this.defs[this.defs.length - 1]);
    this.version++;
  }
  /** Block the floor footprint of every floor-standing mesh in an object. */
  footprint(object, mask = MASK.ALL, { minY = 0.9, minHeight = 0.3, inflate = this.radius } = {}) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3();
    object.traverse((o) => {
      if (!o.isMesh) return;
      box.setFromObject(o);
      if (box.isEmpty() || box.min.y > minY || box.max.y - box.min.y < minHeight) return;
      this.defs.push({ kind: 'rect', x1: box.min.x, x2: box.max.x, z1: box.min.z, z2: box.max.z, mask, inflate });
      this.paint(this.defs[this.defs.length - 1]);
    });
    this.version++;
  }
  paint(d) {
    const inf = d.inflate;
    if (d.kind === 'rect') {
      const i1 = this.col(d.x1 - inf), i2 = this.col(d.x2 + inf), j1 = this.row(d.z1 - inf), j2 = this.row(d.z2 + inf);
      for (let j = Math.max(0, j1); j <= Math.min(this.rows - 1, j2); j++) for (let i = Math.max(0, i1); i <= Math.min(this.cols - 1, i2); i++) {
        const cx = this.minX + (i + 0.5) * this.cell, cz = this.minZ + (j + 0.5) * this.cell;
        if (cx >= d.x1 - inf && cx <= d.x2 + inf && cz >= d.z1 - inf && cz <= d.z2 + inf) this.blocked[j * this.cols + i] |= d.mask;
      }
    } else {
      const r = d.r + inf;
      const i1 = this.col(d.cx - r), i2 = this.col(d.cx + r), j1 = this.row(d.cz - r), j2 = this.row(d.cz + r);
      for (let j = Math.max(0, j1); j <= Math.min(this.rows - 1, j2); j++) for (let i = Math.max(0, i1); i <= Math.min(this.cols - 1, i2); i++) {
        const cx = this.minX + (i + 0.5) * this.cell, cz = this.minZ + (j + 0.5) * this.cell;
        if ((cx - d.cx) ** 2 + (cz - d.cz) ** 2 <= r * r) this.blocked[j * this.cols + i] |= d.mask;
      }
    }
  }
  rebuild() {
    this.blocked.fill(0);
    for (const d of this.defs) this.paint(d);
    this.version++;
  }

  // ---- queries ------------------------------------------------------------
  col(x) { return Math.floor((x - this.minX) / this.cell); }
  row(z) { return Math.floor((z - this.minZ) / this.cell); }
  inBounds(i, j) { return i >= 0 && j >= 0 && i < this.cols && j < this.rows; }
  cellFree(i, j, mask) { return this.inBounds(i, j) && (this.blocked[j * this.cols + i] & mask) === 0; }
  walkable(x, z, mask) { return this.cellFree(this.col(x), this.row(z), mask); }
  center(i, j) { return new THREE.Vector3(this.minX + (i + 0.5) * this.cell, 0, this.minZ + (j + 0.5) * this.cell); }

  lineClear(a, b, mask) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(len / (this.cell * 0.5)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (!this.walkable(a.x + dx * t, a.z + dz * t, mask)) return false;
    }
    return true;
  }

  /** Nearest free cell to a point, searching outward in rings. */
  nearestFree(x, z, mask, maxRings = 16) {
    const ci = this.col(x), cj = this.row(z);
    if (this.cellFree(ci, cj, mask)) return [ci, cj];
    for (let r = 1; r <= maxRings; r++) {
      let best = null, bestD = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (!this.cellFree(i, j, mask)) continue;
        const c = this.center(i, j);
        const d = (c.x - x) ** 2 + (c.z - z) ** 2;
        if (d < bestD) { bestD = d; best = [i, j]; }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * A* over the grid (8 directions, no corner cutting), then straightened.
   * Returns waypoints ending exactly at `to`. Falls back to [to] when no
   * route exists so an agent never freezes.
   */
  findPath(from, to, mask) {
    if (this.lineClear(from, to, mask)) return [to.clone()];
    const s = this.nearestFree(from.x, from.z, mask);
    const g = this.nearestFree(to.x, to.z, mask);
    if (!s || !g) return [to.clone()];
    const cols = this.cols, rows = this.rows;
    const key = (i, j) => j * cols + i;
    const gScore = new Float32Array(cols * rows).fill(Infinity);
    const came = new Int32Array(cols * rows).fill(-1);
    const closed = new Uint8Array(cols * rows);
    const open = new MinHeap();
    const h = (i, j) => { const dx = Math.abs(i - g[0]), dy = Math.abs(j - g[1]); return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy); };
    const sk = key(s[0], s[1]);
    gScore[sk] = 0;
    open.push(h(s[0], s[1]), sk);
    const goalKey = key(g[0], g[1]);
    let found = false, expanded = 0;
    while (open.size) {
      const cur = open.pop();
      if (cur === goalKey) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++expanded > 30000) break;
      const ci = cur % cols, cj = (cur - ci) / cols;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!this.cellFree(ni, nj, mask)) continue;
        if (di && dj && (!this.cellFree(ci + di, cj, mask) || !this.cellFree(ci, cj + dj, mask))) continue; // no corner cutting
        const nk = key(ni, nj);
        if (closed[nk]) continue;
        const cost = gScore[cur] + (di && dj ? 1.4142 : 1);
        if (cost < gScore[nk]) { gScore[nk] = cost; came[nk] = cur; open.push(cost + h(ni, nj), nk); }
      }
    }
    if (!found) return [to.clone()];
    const cells = [];
    for (let k = goalKey; k !== -1; k = came[k]) { const i = k % cols; cells.push(this.center(i, (k - i) / cols)); }
    cells.reverse();
    // straighten: greedily skip waypoints that are in clear line of sight
    const pts = [];
    let anchor = from.clone();
    let idx = 0;
    while (idx < cells.length) {
      let far = idx;
      for (let k = cells.length - 1; k > idx; k--) { if (this.lineClear(anchor, cells[k], mask)) { far = k; break; } }
      pts.push(cells[far]);
      anchor = cells[far];
      idx = far + 1;
    }
    // the last leg goes to the exact target even if it sits against an obstacle
    if (pts.length && this.lineClear(pts[pts.length - 1], to, mask)) pts.push(to.clone());
    else pts.push(to.clone());
    if (pts.length >= 2 && pts[pts.length - 2].distanceTo(to) < this.cell) pts.splice(pts.length - 2, 1);
    return pts;
  }
}

class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    this.k.push(key); this.v.push(val);
    let i = this.k.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= this.k[i]) break; this.swap(i, p); i = p; }
  }
  pop() {
    const top = this.v[0];
    const lk = this.k.pop(), lv = this.v.pop();
    if (this.k.length) {
      this.k[0] = lk; this.v[0] = lv;
      let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < this.k.length && this.k[l] < this.k[m]) m = l; if (r < this.k.length && this.k[r] < this.k[m]) m = r; if (m === i) break; this.swap(i, m); i = m; }
    }
    return top;
  }
  swap(a, b) { [this.k[a], this.k[b]] = [this.k[b], this.k[a]]; [this.v[a], this.v[b]] = [this.v[b], this.v[a]]; }
}

/**
 * Push overlapping people apart. Only agents that are walking get moved, so
 * someone standing at their spot in line is never shoved around. Pushes that
 * would land inside an obstacle are dropped.
 */
export function separate(agents, nav, dt, radius = 0.5) {
  const n = agents.length;
  for (let a = 0; a < n; a++) {
    const A = agents[a];
    for (let b = a + 1; b < n; b++) {
      const B = agents[b];
      if (!A.moving && !B.moving) continue;
      const dx = A.obj.position.x - B.obj.position.x, dz = A.obj.position.z - B.obj.position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > radius * radius || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (radius - d) * Math.min(1, dt * 6);
      const nx = dx / d, nz = dz / d;
      const shareA = A.moving && B.moving ? 0.5 : A.moving ? 1 : 0;
      const shareB = 1 - shareA;
      if (shareA) tryMove(A, nx * push * shareA, nz * push * shareA, nav);
      if (shareB) tryMove(B, -nx * push * shareB, -nz * push * shareB, nav);
    }
  }
}
function tryMove(agent, dx, dz, nav) {
  const x = agent.obj.position.x + dx, z = agent.obj.position.z + dz;
  if (nav.walkable(x, z, agent.mask)) { agent.obj.position.x = x; agent.obj.position.z = z; }
}
