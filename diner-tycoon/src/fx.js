// Lightweight particle effects: steam, sparkles, hearts, grumbles, confetti.
// Sprites with canvas textures, pooled per kind.

import * as THREE from 'three';

function canvasSprite(draw, size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TEX = {};
function tex(kind) {
  if (TEX[kind]) return TEX[kind];
  const t = canvasSprite((ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    if (kind === 'puff') { const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); }
    else if (kind === 'spark') { const g = ctx.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2); g.addColorStop(0, '#fff8d6'); g.addColorStop(0.3, '#ffd54f'); g.addColorStop(1, 'rgba(255,213,79,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); }
    else if (kind === 'heart') { ctx.fillStyle = '#ff5b8a'; ctx.beginPath(); const x = s / 2, y = s / 2; ctx.moveTo(x, y + s * 0.3); ctx.bezierCurveTo(x - s * 0.5, y - s * 0.1, x - s * 0.25, y - s * 0.45, x, y - s * 0.15); ctx.bezierCurveTo(x + s * 0.25, y - s * 0.45, x + s * 0.5, y - s * 0.1, x, y + s * 0.3); ctx.fill(); }
    else if (kind === 'grumble') { ctx.fillStyle = '#3a3f47'; ctx.font = `bold ${s * 0.6}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('#!', s / 2, s / 2); }
    else if (kind === 'star') { ctx.fillStyle = '#ffd54f'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.2 : s * 0.46; const a = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
    else if (kind === 'confetti') { ctx.fillStyle = '#fff'; ctx.fillRect(s * 0.2, s * 0.35, s * 0.6, s * 0.3); }
  });
  TEX[kind] = t;
  return t;
}

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }
  spawn(kind, pos, { vel = new THREE.Vector3(0, 0.6, 0), life = 1, size = 0.25, grow = 0, color = null, gravity = 0, spin = 0, fade = true } = {}) {
    const mat = new THREE.SpriteMaterial({ map: tex(kind), transparent: true, depthWrite: false, color: color ?? 0xffffff });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(pos);
    sp.scale.setScalar(size);
    this.scene.add(sp);
    this.items.push({ sp, vel: vel.clone(), life, maxLife: life, grow, gravity, spin, fade });
    return sp;
  }
  steam(pos) { for (let i = 0; i < 2; i++) this.spawn('puff', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3)), { vel: new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.5 + Math.random() * 0.3, 0), life: 1.6, size: 0.18, grow: 0.35, color: 0xf0f0f0 }); }
  sparkle(pos, n = 6) { for (let i = 0; i < n; i++) this.spawn('spark', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.3, (Math.random() - 0.5) * 0.4)), { vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.8), life: 0.7, size: 0.12 + Math.random() * 0.12, gravity: 1.5 }); }
  heart(pos) { this.spawn('heart', pos.clone().add(new THREE.Vector3(0, 2.0, 0)), { vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.9, 0), life: 1.3, size: 0.3, grow: 0.2 }); }
  hearts(pos, n = 3) { for (let i = 0; i < n; i++) setTimeout(() => this.heart(pos), i * 120); }
  grumble(pos) { this.spawn('grumble', pos.clone().add(new THREE.Vector3(0.2, 2.1, 0)), { vel: new THREE.Vector3(0.2, 0.7, 0), life: 1.2, size: 0.4 }); }
  stars(pos, n = 5) { for (let i = 0; i < n; i++) this.spawn('star', pos.clone().add(new THREE.Vector3(0, 1.8, 0)), { vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1.5 + Math.random(), (Math.random() - 0.5) * 2), life: 1.2, size: 0.25, gravity: 2.5, spin: 4 }); }
  confetti(pos, n = 40) {
    const colors = [0xff5b8a, 0xffd54f, 0x4fc3f7, 0x81c784, 0xba68c8, 0xff8a65];
    for (let i = 0; i < n; i++) this.spawn('confetti', pos.clone(), { vel: new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5), life: 2.2 + Math.random(), size: 0.14, gravity: 5, spin: 6 + Math.random() * 6, color: colors[i % colors.length] });
  }
  update(dt) {
    for (const p of this.items) {
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.sp.position.addScaledVector(p.vel, dt);
      if (p.grow) p.sp.scale.addScalar(p.grow * dt);
      if (p.spin) p.sp.material.rotation += p.spin * dt;
      if (p.fade) p.sp.material.opacity = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.5)));
      if (p.life <= 0) { this.scene.remove(p.sp); p.sp.material.dispose(); }
    }
    this.items = this.items.filter((p) => p.life > 0);
  }
}
