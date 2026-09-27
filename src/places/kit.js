import * as THREE from 'three';
import { toon, glowMat, drawTexture, neonText, FONT_DISPLAY, roundRect } from '../core/textures.js';
import { mergeGeometries } from '../core/geom.js';

// Helpers for building walkable places with matching colliders (world coordinates).
export class Place {
  constructor(game, name) {
    this.game = game;
    this.name = name;
    this.group = new THREE.Group();
    this.group.name = name;
    this.colliders = [];
    this.interactables = [];
    this.gravity = 18;
    this.killY = -50;
    this.updaters = [];
    this.actors = [];
  }

  // Box with its bottom at y0. Returns the mesh; pushes a collider unless collide=false.
  box(x, y0, z, w, h, d, mat, { collide = true, parent = this.group, tag = 'solid' } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y0 + h / 2, z);
    parent.add(m);
    if (parent === this.group) m.userData.boxStatic = true;
    if (collide) {
      const b = { minX: x - w / 2, maxX: x + w / 2, minY: y0, maxY: y0 + h, minZ: z - d / 2, maxZ: z + d / 2, tag, mesh: m };
      this.colliders.push(b);
      m.userData.collider = b;
    }
    return m;
  }

  // Round platform approximated by a few boxes for collision.
  disc(x, yTop, z, r, mat, { thick = 1, rim = null, collide = true, segs = 32 } = {}) {
    const G = this.group;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, thick, segs), mat);
    top.position.set(x, yTop - thick / 2, z);
    G.add(top);
    const under = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, r * 0.7, segs), toon(0x2a2340));
    under.rotation.x = Math.PI;
    under.position.set(x, yTop - thick - r * 0.35, z);
    G.add(under);
    if (rim) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, segs * 2), glowMat(rim, 2.5));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, yTop - 0.1, z);
      G.add(ring);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(r * 0.6, 0.06, 6, segs * 2), glowMat(rim, 1.6));
      glow.rotation.x = Math.PI / 2;
      glow.position.set(x, yTop - thick - r * 0.5, z);
      G.add(glow);
    }
    const cols = [];
    if (collide) {
      // Inscribed cross of boxes covering most of the disc.
      const a = r * 0.92, b = r * 0.55;
      for (const [w, d] of [[a * 2, b * 2], [b * 2, a * 2], [r * 1.5, r * 1.5]]) {
        const c = { minX: x - w / 2, maxX: x + w / 2, minY: yTop - thick, maxY: yTop, minZ: z - d / 2, maxZ: z + d / 2, tag: 'disc' };
        this.colliders.push(c);
        cols.push(c);
      }
    }
    return { userData: { cols }, position: new THREE.Vector3(x, yTop, z) };
  }

  // Merge static meshes that share a material into one mesh each (far fewer draw calls).
  // Anything animated or toggled later is flagged userData.keep and left alone.
  freeze() { mergeChildren(this.group); }

  interact(pos, prompt, use, opts = {}) {
    const it = { pos, prompt, use, ...opts };
    this.interactables.push(it);
    return it;
  }

  sign(text, x, y, z, ry, { w = 6, h = 1.5, color = '#ff3d8b', bg = 'rgba(10,5,25,0.9)', size = 90, font = FONT_DISPLAY, intensity = 1.8, parent = this.group, double = false } = {}) {
    const tex = drawTexture(1024, Math.round(1024 * h / w), (g, W, H) => {
      g.fillStyle = bg;
      roundRect(g, 6, 6, W - 12, H - 12, 24);
      g.fill();
      g.strokeStyle = color; g.lineWidth = 8; g.shadowColor = color; g.shadowBlur = 16;
      roundRect(g, 18, 18, W - 36, H - 36, 18);
      g.stroke();
      g.shadowBlur = 0;
      neonText(g, text, W / 2, H / 2 + 4, color, size, { font, maxW: W - 80, glow: 22 });
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(intensity, intensity, intensity), side: double ? THREE.DoubleSide : THREE.FrontSide }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    parent.add(m);
    return m;
  }

  railing(x0, z0, x1, z1, y, { h = 1.1, color = 0x33f0ff, gap = null } = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const dir = new THREE.Vector2(x1 - x0, z1 - z0).normalize();
    const g = new THREE.Group();
    this.group.add(g);
    const post = new THREE.CylinderGeometry(0.05, 0.05, h, 6);
    const pm = toon(0x3a3550);
    for (let s = 0; s <= len; s += 2.5) {
      const p = new THREE.Mesh(post, pm);
      p.position.set(x0 + dir.x * s, y + h / 2, z0 + dir.y * s);
      g.add(p);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), glowMat(color, 2));
    rail.position.set((x0 + x1) / 2, y + h, (z0 + z1) / 2);
    rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(rail);
    mergeChildren(g);
    // invisible wall so you can't just walk off (you can still jump it)
    const minX = Math.min(x0, x1) - 0.15, maxX = Math.max(x0, x1) + 0.15, minZ = Math.min(z0, z1) - 0.15, maxZ = Math.max(z0, z1) + 0.15;
    this.colliders.push({ minX, maxX, minY: y, maxY: y + h, minZ, maxZ, tag: 'rail' });
    return g;
  }

  addActor(ch, x, y, z, ry = 0) {
    ch.root.position.set(x, y, z);
    ch.root.rotation.y = ry;
    this.group.add(ch.root);
    this.actors.push(ch);
    return ch;
  }

  update(dt, player) {
    for (const a of this.actors) a.update(dt);
    for (const fn of this.updaters) fn(dt, player);
  }
}

export function pad(place, x, yTop, z, r, power, color = 0x6dff8a, to = null) {
  const g = new THREE.Group();
  g.position.set(x, yTop, z);
  place.group.add(g);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 24), toon(0x222233));
  base.position.set(x, yTop + 0.15, z);
  place.group.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, 0.06, 24), glowMat(color, 2.2));
  top.position.set(x, yTop + 0.32, z);
  place.group.add(top);
  const arrows = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, r * 0.5, 4), glowMat(color, 3));
  arrows.position.y = 0.9;
  g.add(arrows);
  g.userData.parts = [base, top];
  const col = { minX: x - r * 0.8, maxX: x + r * 0.8, minY: yTop, maxY: yTop + 0.35, minZ: z - r * 0.8, maxZ: z + r * 0.8, pad: power, padTo: to, tag: 'pad' };
  place.colliders.push(col);
  place.updaters.push((dt) => {
    arrows.position.y = 0.9 + Math.sin(place.game.time * 5) * 0.2;
    arrows.rotation.y += dt * 2;
  });
  return { g, col };
}

export function mergeChildren(group) {
  const buckets = new Map();
  for (const m of [...group.children]) {
    if (!m.isMesh || m.isInstancedMesh || Array.isArray(m.material) || m.userData.keep) continue;
    if (!buckets.has(m.material)) buckets.set(m.material, []);
    buckets.get(m.material).push(m);
  }
  for (const [mat, list] of buckets) {
    if (list.length < 2) continue;
    const geos = list.map((m) => { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); return g; });
    const merged = new THREE.Mesh(mergeGeometries(geos), mat);
    merged.renderOrder = Math.max(...list.map((m) => m.renderOrder));
    for (const m of list) group.remove(m);
    group.add(merged);
  }
}
