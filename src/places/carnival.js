import * as THREE from 'three';
import { Place, pad } from './kit.js';
import { toon, glowMat, drawTexture, neonText, toonGradient } from '../core/textures.js';
import { placeCenter, streetPos } from '../world/layout.js';
import { createCharacter } from '../world/characters.js';
import { clamp, rand, pick, damp } from '../core/util.js';

// Platform table (local to the carnival center): x, z, radius, top height, rim colour
const PLATS = {
  A: [0, 55, 9, 0, 0xffd23f],
  B: [0, 18, 14, 0, 0xff3d8b],
  C: [-30, 10, 8, 1.5, 0x33f0ff],
  D: [28, 8, 8, 1, 0x6dff8a],
  F: [-8, -8, 4, 2.5, 0xb14dff],
  E: [-16, -28, 7, 3.5, 0xff8a1f],
  G: [8, -42, 5, 10, 0x33f0ff],
  H: [34, -24, 5, 5, 0xff3d8b],
  I: [-26, 38, 5, 1, 0x6dff8a],
  J: [28, 36, 5, 2, 0xffd23f],
  K: [-42, -14, 5, 6, 0xb14dff],
};
const KID_PLATS = ['B', 'C', 'D', 'F', 'E', 'G', 'H', 'I', 'J', 'K'];

export function buildCarnival(game) {
  const P = new Place(game, 'carnival');
  const c = placeCenter('carnival');
  const Y = 150;
  P.center = new THREE.Vector3(c.x, Y, c.z);
  P.gravity = 7;
  P.jump = 6.4;
  P.killY = Y - 30;
  const W = (x, y, z) => new THREE.Vector3(c.x + x, Y + y, c.z + z);
  P.W = W;

  // Platforms
  P.plats = {};
  const floorTex = (a, b) => drawTexture(256, 256, (g, w) => {
    const n = 16;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? a : b;
      g.beginPath(); g.moveTo(w / 2, w / 2); g.arc(w / 2, w / 2, w / 2, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(w / 2, w / 2, w * 0.1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, w / 2, w * 0.46, 0, Math.PI * 2); g.stroke();
  });
  const floors = [floorTex('#3a2458', '#4a2d70'), floorTex('#26305a', '#2f3c70'), floorTex('#3d2046', '#4d2858')];
  const side = toon(0x2d2446);
  let fi = 0;
  for (const [k, [x, z, r, y, rim]] of Object.entries(PLATS)) {
    const mat = [side, new THREE.MeshToonMaterial({ map: floors[fi++ % floors.length], gradientMap: toonGradient() }), side];
    const d = P.disc(c.x + x, Y + y, c.z + z, r, mat, { rim, thick: 1.2 });
    P.plats[k] = { key: k, x: c.x + x, z: c.z + z, r, y: Y + y, group: d };
  }
  // Bridge from pad to hub
  P.box(c.x, Y - 0.6, c.z + 39.5, 4, 0.6, 13, toon(0x3a2458));
  P.railing(c.x - 2, c.z + 33, c.x - 2, c.z + 46, Y, { color: 0xff3d8b });
  P.railing(c.x + 2, c.z + 33, c.x + 2, c.z + 46, Y, { color: 0xff3d8b });
  // Arch sign over the bridge
  P.box(c.x - 3, Y, c.z + 44, 0.4, 6, 0.4, toon(0x3a3550), { collide: false });
  P.box(c.x + 3, Y, c.z + 44, 0.4, 6, 0.4, toon(0x3a3550), { collide: false });
  P.sign('ZERO-G CARNIVAL', c.x, Y + 6.4, c.z + 44, 0, { w: 9, h: 1.8, color: '#6dff8a' });
  P.sign('ZERO-G CARNIVAL', c.x, Y + 6.4, c.z + 44.02, Math.PI, { w: 9, h: 1.8, color: '#6dff8a' });

  // Launch pads: each one flings you to a specific platform.
  const T = (k, dy = 0) => { const [x, z, , y] = PLATS[k]; return W(x, y + dy, z); };
  pad(P, c.x + 9, Y, c.z + 26, 1.3, 13, 0x6dff8a, T('J'));
  pad(P, c.x - 9, Y, c.z + 9, 1.3, 15, 0x6dff8a, T('G'));
  pad(P, c.x + 31, Y + 1, c.z + 3, 1.2, 13, 0x6dff8a, T('H'));
  pad(P, c.x - 30, Y + 1.5, c.z + 5, 1.2, 13, 0x6dff8a, T('K'));
  pad(P, c.x - 7, Y + 2.5, c.z - 9, 1.1, 13, 0x6dff8a, T('G'));
  pad(P, c.x + 34, Y + 5, c.z - 24, 1.2, 12, 0x6dff8a, T('G'));
  pad(P, c.x + 28, Y + 2, c.z + 36, 1.2, 12, 0x6dff8a, T('B'));
  pad(P, c.x + 8, Y + 10, c.z - 42, 1.1, 12, 0x6dff8a, T('B'));
  pad(P, c.x - 42, Y + 6, c.z - 14, 1.1, 12, 0x6dff8a, T('I'));
  pad(P, c.x - 26, Y + 1, c.z + 38, 1.1, 12, 0x6dff8a, T('B'));

  // Bouncy castle on E (its roof is a big bounce pad)
  {
    const [x, z, , y] = PLATS.E;
    const bx = c.x + x, bz = c.z + z, by = Y + y;
    const castle = toon(0xff8a1f), stripe = toon(0xffd23f);
    P.box(bx, by, bz, 7, 2.2, 7, castle, { collide: true });
    const roof = P.colliders[P.colliders.length - 1];
    roof.pad = 17;
    for (const [dx, dz] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 3.6, 10), stripe);
      t.position.set(bx + dx, by + 1.8, bz + dz);
      P.group.add(t);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1.4, 10), toon(0xff3d8b));
      cone.position.set(bx + dx, by + 4.3, bz + dz);
      P.group.add(cone);
    }
    const bounceTop = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.2, 6.4), glowMat(0xff8a1f, 1.2));
    bounceTop.position.set(bx, by + 2.25, bz);
    P.group.add(bounceTop);
    // Steps up to the castle
    P.box(bx + 4.6, by, bz, 2, 1.1, 3, stripe);
  }

  // Carousel on C (rotates you!)
  {
    const pc = P.plats.C;
    const car = new THREE.Group();
    car.position.set(pc.x, pc.y, pc.z);
    P.group.add(car);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 7, 10), toon(0xffd23f));
    pole.position.y = 3.5;
    car.add(pole);
    const canopyTex = drawTexture(256, 64, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#ff3d8b' : '#fff4d0'; g.fillRect(i * 16, 0, 16, h); } });
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(7.5, 3, 24, 1, true), new THREE.MeshToonMaterial({ map: canopyTex, side: THREE.DoubleSide }));
    canopy.position.y = 8.2;
    car.add(canopy);
    const rockets = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const rg = new THREE.Group();
      rg.position.set(Math.cos(a) * 5, 0, Math.sin(a) * 5);
      car.add(rg);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7, 6), toon(0xdddddd));
      rod.position.y = 3.5;
      rg.add(rod);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.2, 4, 10), toon([0x33f0ff, 0xff3d8b, 0x6dff8a][i % 3]));
      body.rotation.z = Math.PI / 2;
      body.rotation.y = -a;
      body.position.y = 2;
      rg.add(body);
      rockets.push(body);
    }
    const w = 0.45;
    for (const col of pc.group.userData.cols) {
      col.carry = (pos, dt, pl) => {
        const dx = pos.x - pc.x, dz = pos.z - pc.z;
        const cs = Math.cos(-w * dt), sn = Math.sin(-w * dt);
        pos.x = pc.x + dx * cs - dz * sn;
        pos.z = pc.z + dx * sn + dz * cs;
        pl.yaw += w * dt;
      };
    }
    P.updaters.push((dt) => {
      car.rotation.y += w * dt;
      rockets.forEach((r, i) => { r.position.y = 2 + Math.sin(game.time * 2 + i) * 0.8; });
    });
  }

  // Ferris wheel by D
  {
    const pd = P.plats.D;
    const fw = new THREE.Group();
    fw.position.set(pd.x + 2, pd.y + 15, pd.z);
    P.group.add(fw);
    const legM = toon(0x3a3550);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 17, 0.5), legM);
      leg.position.set(pd.x + 2, pd.y + 7, pd.z + s * 4);
      leg.rotation.x = s * 0.25;
      P.group.add(leg);
    }
    const wheel = new THREE.Group();
    fw.add(wheel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(12, 0.3, 8, 64), glowMat(0x33f0ff, 2));
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(8, 0.15, 6, 48), glowMat(0xff3d8b, 2));
    rim2.rotation.y = Math.PI / 2;
    wheel.add(rim2);
    const gondolas = [];
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, 12, 0.12), toon(0xdddddd));
      spoke.position.set(0, Math.cos(a) * 6, Math.sin(a) * 6);
      spoke.rotation.x = -a;
      wheel.add(spoke);
      const gon = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), toon([0xffd23f, 0xff3d8b, 0x6dff8a, 0xb14dff, 0x33f0ff][i % 5]));
      fw.add(gon);
      gondolas.push({ gon, a });
    }
    P.updaters.push((dt) => {
      wheel.rotation.x += dt * 0.15;
      for (const g of gondolas) {
        const a = g.a + wheel.rotation.x;
        g.gon.position.set(0, Math.cos(a) * 12 - 1, Math.sin(a) * 12);
      }
    });
  }

  // Hub stalls
  const stall = (x, z, ry, text, color) => {
    const g = new THREE.Group();
    g.position.set(c.x + x, Y, c.z + z);
    g.rotation.y = ry;
    P.group.add(g);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.2), toon(0x3a2458));
    counter.position.y = 0.55;
    g.add(counter);
    const awnTex = drawTexture(128, 32, (gg, w, h) => { for (let i = 0; i < 8; i++) { gg.fillStyle = i % 2 ? color : '#fff4d0'; gg.fillRect(i * 16, 0, 16, h); } });
    const awn = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.15, 1.8), new THREE.MeshToonMaterial({ map: awnTex }));
    awn.position.set(0, 2.8, 0.2);
    awn.rotation.x = 0.2;
    g.add(awn);
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 6), toon(0xdddddd));
      p.position.set(s * 1.6, 1.4, 0.9);
      g.add(p);
    }
    P.sign(text, 0, 3.4, 0.9, 0, { w: 3.6, h: 0.8, color, parent: g });
    const wp = new THREE.Vector3(0, 0, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(ry)).add(new THREE.Vector3(c.x + x, Y, c.z + z));
    P.colliders.push({ minX: wp.x - 1.8, maxX: wp.x + 1.8, minY: Y, maxY: Y + 1.1, minZ: wp.z - 1.8, maxZ: wp.z + 1.8, tag: 'stall' });
    return g;
  };
  stall(-7, 24, Math.PI * 0.15, 'SPACE FLOSS 5₡', '#ff3d8b');
  stall(8, 12, -Math.PI * 0.6, 'RING TOSS', '#33f0ff');
  stall(-8, 12, Math.PI * 0.6, 'POPCORN', '#ffd23f');
  P.flossStall = W(-6.3, 1.2, 26.3);
  // floss cones on the stall counter
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), toon(0xff9ad8));
    f.position.copy(W(-7.8 + i * 0.7, 1.5, 24.4));
    P.group.add(f);
  }

  // Balloons
  const balloonMats = [0xff3d8b, 0x33f0ff, 0xffd23f, 0x6dff8a, 0xb14dff].map((col) => toon(col));
  const balloons = [];
  for (let i = 0; i < 26; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), balloonMats[i % 5]);
    b.scale.y = 1.2;
    b.position.copy(W(rand(-50, 50), rand(8, 30), rand(-50, 60)));
    b.userData.base = b.position.clone();
    b.userData.ph = rand(0, 10);
    P.group.add(b);
    balloons.push(b);
  }
  P.updaters.push(() => {
    for (const b of balloons) b.position.y = b.userData.base.y + Math.sin(game.time * 0.6 + b.userData.ph) * 1.5;
  });
  // Sparkles in the low-grav field
  const sparkGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 400; i++) pts.push(c.x + rand(-60, 60), Y + rand(-5, 35), c.z + rand(-60, 70));
  sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: new THREE.Color(1.5, 1.2, 2), size: 0.25, transparent: true, opacity: 0.8 }));
  P.group.add(sparks);
  P.updaters.push((dt) => { sparks.rotation.y += dt * 0.02; });
  const light = new THREE.PointLight(0xff9ad8, 400, 120, 1.4);
  light.position.copy(W(0, 20, 10));
  P.group.add(light);

  // Dock: taxi on the west side of the pad, facing -z (right side toward the pad).
  P.dock = {
    pos: W(-11.6, -0.3, 55),
    yaw: 0,
    pre: W(-11.6, 0.5, 80),
    entry: new THREE.Vector3(c.x - 11.6, 72, streetPos(11)),
  };
  P.spawn = { pos: W(-7, 0, 55), yaw: -Math.PI / 2 + 0.3 };
  P.sheilaSpot = W(-5, 0, 60);
  game.scene.add(P.group);
  return P;
}

// ---------- Kevin & the decoy kids ----------
export class KidAI {
  constructor(game, place, char, { kevin = false, home = 'B', name = 'kid' } = {}) {
    this.game = game;
    this.P = place;
    this.c = char;
    this.kevin = kevin;
    this.name = name;
    this.plat = place.plats[home];
    this.pos = new THREE.Vector3(this.plat.x, this.plat.y, this.plat.z);
    this.state = 'idle';
    this.t = 0;
    this.jumps = 0;
    this.wander = this.pos.clone();
    this.hopT = rand(0, 1);
    this.giggleT = rand(1, 3);
    this.dizzyT = 0;
    this.stars = null;
    place.group.add(char.root);
    char.root.position.copy(this.pos);
  }
  fleeDist() { return Math.max(3.8, 8.5 - this.jumps * 0.75); }
  dizzyTime() { return Math.min(6, 1.1 + this.jumps * 0.7); }

  jumpTo(plat, point = null) {
    this.state = 'jump';
    this.from = this.pos.clone();
    const a = rand(0, Math.PI * 2), rr = rand(0, plat.r * 0.5);
    this.to = point ? point.clone() : new THREE.Vector3(plat.x + Math.cos(a) * rr, plat.y, plat.z + Math.sin(a) * rr);
    const d = this.from.distanceTo(this.to);
    this.T = 0.8 + d / 28;
    this.H = 5 + d * 0.22;
    this.t = 0;
    this.nextPlat = plat;
    if (this.kevin) this.game.audio.play('giggle', { vol: 0.7, pan: this.pan() });
  }

  pan() {
    const cam = this.game.camera;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    const d = this.pos.clone().sub(cam.getWorldPosition(new THREE.Vector3())).normalize();
    return clamp(d.dot(right), -1, 1);
  }

  pickFleeTarget(player) {
    let best = null, bestScore = -Infinity;
    for (const k of KID_PLATS) {
      const p = this.P.plats[k];
      if (p === this.plat) continue;
      const dk = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      if (dk > 52) continue;
      const dp = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
      const score = dp + rand(0, 14);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  update(dt, player, floss) {
    const ch = this.c;
    this.t += dt;
    ch.update(dt);
    if (this.state === 'held') return;
    if (this.state === 'jump') {
      const u = clamp(this.t / this.T, 0, 1);
      this.pos.lerpVectors(this.from, this.to, u);
      this.pos.y += Math.sin(u * Math.PI) * this.H;
      const dir = this.to.clone().sub(this.from);
      ch.root.rotation.y = Math.atan2(-dir.x, -dir.z);
      ch.walking = true;
      if (u >= 1) {
        this.plat = this.nextPlat;
        this.jumps++;
        ch.walking = false;
        if (this.eatTarget) { this.state = 'eat'; this.dizzyT = 5.5; }
        else { this.state = 'dizzy'; this.dizzyT = this.dizzyTime(); }
        this.game.audio.play('land', { vol: 0.5 });
      }
    } else {
      // Hop around on the platform
      this.hopT += dt * (this.state === 'dizzy' ? 0.6 : 2.2);
      const hop = Math.abs(Math.sin(this.hopT * Math.PI)) * (this.state === 'dizzy' ? 0.1 : 0.45);
      if (this.state === 'idle') {
        if (this.pos.distanceTo(this.wander) < 0.4 || Math.random() < dt * 0.2) {
          const a = rand(0, Math.PI * 2), rr = rand(0, this.plat.r * 0.6);
          this.wander.set(this.plat.x + Math.cos(a) * rr, this.plat.y, this.plat.z + Math.sin(a) * rr);
        }
        const d = this.wander.clone().sub(this.pos).setY(0);
        if (d.length() > 0.1) {
          d.setLength(Math.min(d.length(), dt * 2.5));
          this.pos.add(d);
          ch.root.rotation.y = damp(ch.root.rotation.y, Math.atan2(-d.x, -d.z), 6, dt);
        }
        ch.walking = true;
        ch.walkSpeed = 1.3;
      } else ch.walking = false;
      this.pos.y = this.plat.y;
      ch.root.position.copy(this.pos);
      ch.root.position.y += hop;
      if (!this.kevin && this.state === 'dizzy') {
        this.dizzyT -= dt;
        if (this.dizzyT <= 0) this.state = 'idle';
      }
      if (this.kevin) {
        const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z) + Math.max(0, Math.abs(player.pos.y - this.pos.y) - 2);
        if (this.state === 'eat') {
          this.dizzyT -= dt;
          ch.setTalking(true);
          if (this.dizzyT <= 0) { this.state = 'idle'; ch.setTalking(false); this.eatTarget = null; if (floss) floss.eaten = true; }
        } else if (this.state === 'dizzy') {
          this.dizzyT -= dt;
          if (this.dizzyT <= 0) this.state = 'idle';
        } else if (floss && !floss.eaten && !floss.flying) {
          const fd = floss.pos.distanceTo(this.pos);
          if (fd < 55 && floss.plat) { this.eatTarget = floss; this.jumpTo(floss.plat, floss.pos.clone().add(new THREE.Vector3(0.6, 0, 0.6))); floss.claimed = true; }
        } else if (dist < this.fleeDist()) {
          const t = this.pickFleeTarget(player);
          if (t) this.jumpTo(t);
        }
        if (this.state !== 'jump' && this.state !== 'eat') ch.lookAt(player.eyePos());
        this.giggleT -= dt;
        if (this.giggleT <= 0) {
          this.giggleT = rand(2.5, 4.5);
          const cam = this.game.camera.getWorldPosition(new THREE.Vector3());
          const vol = clamp(1.1 - cam.distanceTo(this.pos) / 70, 0.15, 1);
          this.game.audio.play('giggle', { vol, pan: this.pan() });
        }
      }
    }
    // Dizzy stars
    if (this.state === 'dizzy' || this.state === 'eat') {
      if (!this.stars) {
        this.stars = new THREE.Group();
        const tex = this.game.fx.textSprite(this.state === 'eat' ? '♥' : '★', this.state === 'eat' ? '#ff3d8b' : '#ffd23f');
        for (let i = 0; i < 3; i++) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
          s.scale.setScalar(0.35);
          this.stars.add(s);
        }
        this.P.group.add(this.stars);
      }
      this.stars.position.copy(this.pos).add(new THREE.Vector3(0, 1.25, 0));
      this.stars.children.forEach((s, i) => {
        const a = this.t * 4 + i * 2.1;
        s.position.set(Math.cos(a) * 0.4, Math.sin(this.t * 6 + i) * 0.05, Math.sin(a) * 0.4);
      });
    } else if (this.stars) {
      this.P.group.remove(this.stars);
      this.stars = null;
    }
    if (this.state !== 'jump') ch.root.position.copy(this.pos).add(new THREE.Vector3(0, ch.root.position.y - this.pos.y, 0));
    else ch.root.position.copy(this.pos);
  }

  grabbable() { return this.state === 'dizzy' || this.state === 'eat' || this.state === 'idle'; }
}

export { KID_PLATS, pick };
