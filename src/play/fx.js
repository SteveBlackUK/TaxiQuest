import * as THREE from 'three';
import { glowTexture, drawTexture, neonText, FONT_DISPLAY } from '../core/textures.js';

// Pooled sprite particles for sparks, confetti, explosions, Zzz, cash...
export class FX {
  constructor(game, max = 600) {
    this.game = game;
    this.parts = [];
    this.pool = [];
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.mats = new Map();
    this.textTex = new Map();
  }
  mat(color, additive = true, map = null) {
    const key = color + '|' + additive + '|' + (map ? map.uuid : '');
    if (!this.mats.has(key)) {
      this.mats.set(key, new THREE.SpriteMaterial({
        map: map || glowTexture(), color, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }));
    }
    return this.mats.get(key);
  }
  textSprite(text, color = '#ffffff') {
    const key = text + color;
    if (!this.textTex.has(key)) {
      this.textTex.set(key, drawTexture(128, 128, (g) => neonText(g, text, 64, 64, color, 70, { font: FONT_DISPLAY, glow: 10 })));
    }
    return this.textTex.get(key);
  }
  spawn(pos, { count = 10, color = 0xffffff, speed = 4, life = 0.8, size = 0.4, gravity = 0, spread = 1, up = 0, parent = null, additive = true, map = null, drag = 0, spin = 0, grow = 0 } = {}) {
    const m = this.mat(color, additive, map);
    for (let i = 0; i < count; i++) {
      let s = this.pool.pop();
      if (!s) s = new THREE.Sprite(m);
      s.material = m;
      s.visible = true;
      (parent || this.group).add(s);
      s.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7) * spread);
      v.y += up;
      s.scale.setScalar(size);
      this.parts.push({ s, v, life, max: life, size, gravity, drag, grow, rot: 0, spin: (Math.random() - 0.5) * spin });
    }
  }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.s.parent && p.s.parent.remove(p.s);
        this.pool.push(p.s);
        this.parts.splice(i, 1);
        continue;
      }
      p.v.y -= p.gravity * dt;
      if (p.drag) p.v.multiplyScalar(Math.exp(-p.drag * dt));
      p.s.position.addScaledVector(p.v, dt);
      const k = p.life / p.max;
      const sc = p.size * (p.grow ? 1 + (1 - k) * p.grow : (0.4 + 0.6 * k));
      p.s.scale.setScalar(sc);
    }
  }
  clear() {
    for (const p of this.parts) { p.s.parent && p.s.parent.remove(p.s); this.pool.push(p.s); }
    this.parts.length = 0;
  }
}
