import * as THREE from 'three';
import { clamp, damp } from '../core/util.js';

const EPS = 0.001;

// First-person on-foot controller with AABB collisions.
export class Foot {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.32;
    this.height = 1.75;
    this.crouching = false;
    this.grounded = false;
    this.level = null;
    this.active = false;
    this.frozen = false;
    this.bobT = 0;
    this.bob = 0;
    this.lastSafe = new THREE.Vector3();
    this.held = new THREE.Group();
    this.focus = null;
    this.speedMul = 1;
    this._boxes = [];
  }

  enter(level, spawn) {
    const g = this.game;
    this.level = level;
    this.active = true;
    this.frozen = false;
    this.pos.copy(spawn.pos);
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.lastSafe.copy(this.pos);
    g.scene.attach(g.camera);
    g.camera.fov = 75;
    g.camera.updateProjectionMatrix();
    g.camera.add(this.held);
    this.held.position.set(0, 0, 0);
    g.setCamera(this);
    g.addSystem(this);
    g.input.wantLock = true;
    g.ui.crosshair(true);
    this.updateCamera(0);
  }

  exit() {
    const g = this.game;
    this.active = false;
    g.removeSystem(this);
    if (g.cameraCtl === this) g.setCamera(null);
    g.input.wantLock = false;
    g.input.releaseLock();
    g.ui.crosshair(false);
    g.ui.prompt(null);
    g.ui.lockHint(false);
    this.clearHeld();
    this.level = null;
  }

  clearHeld() { while (this.held.children.length) this.held.remove(this.held.children[0]); }
  hold(obj, x = 0.32, y = -0.32, z = -0.7) {
    this.clearHeld();
    obj.position.set(x, y, z);
    this.held.add(obj);
  }

  jumpPower() {
    return (this.level?.jump ?? 6.2) * (this.game.state.has('boots') ? 1.3 : 1);
  }

  eyePos(out = new THREE.Vector3()) {
    return out.set(this.pos.x, this.pos.y + (this.crouching ? 1.0 : this.height - 0.1) + this.bob, this.pos.z);
  }
  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  collide(axis, boxes, prevY) {
    const r = this.radius;
    const h = this.crouching ? 1.1 : this.height;
    const p = this.pos;
    let hit = null;
    for (const b of boxes) {
      if (b.disabled) continue;
      if (p.x + r <= b.minX || p.x - r >= b.maxX || p.z + r <= b.minZ || p.z - r >= b.maxZ || p.y + h <= b.minY || p.y >= b.maxY) continue;
      if (axis === 'y') {
        if (prevY >= b.maxY - 0.05 - EPS) { p.y = b.maxY; hit = b; this.landed = b; }
        else if (this.vel.y > 0) { p.y = b.minY - h - EPS; this.vel.y = 0; }
        else if (b.maxY - p.y < 0.45) { p.y = b.maxY; hit = b; this.landed = b; }
        continue;
      }
      // Step up small ledges.
      if (b.maxY - p.y <= 0.45 && b.maxY - p.y > 0) {
        const oldY = p.y;
        p.y = b.maxY + EPS;
        let blocked = false;
        for (const o of boxes) if (o !== b && !o.disabled && p.x + r > o.minX && p.x - r < o.maxX && p.z + r > o.minZ && p.z - r < o.maxZ && p.y + h > o.minY && p.y < o.maxY) blocked = true;
        if (!blocked) continue;
        p.y = oldY;
      }
      if (axis === 'x') {
        const pen1 = p.x + r - b.minX, pen2 = b.maxX - (p.x - r);
        if (pen1 < pen2) p.x = b.minX - r - EPS; else p.x = b.maxX + r + EPS;
        this.vel.x = 0;
      } else {
        const pen1 = p.z + r - b.minZ, pen2 = b.maxZ - (p.z - r);
        if (pen1 < pen2) p.z = b.minZ - r - EPS; else p.z = b.maxZ + r + EPS;
        this.vel.z = 0;
      }
    }
    return hit;
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    const input = g.input;
    const lvl = this.level;
    const st = g.state;
    g.ui.lockHint(!input.locked && !g.ui.modalOpen && !g.ui.line && !this.frozen, 'Click to look around');
    // Mouse look
    const sens = 0.0022 * (st.settings.sensitivity || 1);
    if (input.locked) {
      this.yaw -= input.mouse.dx * sens;
      this.pitch = clamp(this.pitch - input.mouse.dy * sens, -1.45, 1.45);
    }
    const talking = !!g.ui.line;
    const canMove = !this.frozen && !talking;
    // Movement input
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rgt = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const mv = new THREE.Vector3();
    if (canMove) {
      mv.addScaledVector(f, input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']));
      mv.addScaledVector(rgt, input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']));
    }
    if (mv.lengthSq() > 1) mv.normalize();
    const wantCrouch = canMove && input.anyDown('KeyC', 'ControlLeft');
    if (wantCrouch) this.crouching = true;
    else if (this.crouching) {
      // stand up if there's room
      const saved = this.crouching;
      this.crouching = false;
      const boxes = this.gatherBoxes();
      const h = this.height;
      for (const b of boxes) if (!b.disabled && this.pos.x + this.radius > b.minX && this.pos.x - this.radius < b.maxX && this.pos.z + this.radius > b.minZ && this.pos.z - this.radius < b.maxZ && this.pos.y + h > b.minY && this.pos.y < b.maxY) this.crouching = saved;
    }
    const sprint = canMove && input.anyDown('ShiftLeft', 'ShiftRight') && !this.crouching;
    const reflex = st.stat('reflex');
    let speed = (sprint ? 8.2 : 5.2) * (1 + (reflex - 1) * 0.05) * this.speedMul * (lvl?.speedMul ?? 1);
    if (this.crouching) speed *= 0.5;
    const accel = this.grounded ? 60 : (this.airLock > 0 ? 3 : 14);
    this.airLock = Math.max(0, (this.airLock || 0) - dt);
    const hasInput = mv.lengthSq() > 0.01;
    const wish = mv.multiplyScalar(speed);
    // In the air, keep momentum unless you steer (so launch pads can fling you).
    if (!this.grounded && hasInput) {
      const cur = Math.hypot(this.vel.x, this.vel.z);
      if (cur > speed) wish.setLength(cur);
    }
    const dvx = wish.x - this.vel.x, dvz = wish.z - this.vel.z;
    const dl = Math.hypot(dvx, dvz);
    const maxDv = accel * dt;
    if (dl > 0 && (this.grounded || hasInput)) {
      const k = Math.min(1, maxDv / dl);
      this.vel.x += dvx * k;
      this.vel.z += dvz * k;
    }
    if (canMove && this.grounded && input.hit('Space')) {
      this.vel.y = this.jumpPower();
      this.grounded = false;
      g.audio.play('jump');
    }
    const grav = lvl?.gravity ?? 18;
    this.vel.y -= grav * dt;
    this.vel.y = Math.max(this.vel.y, -40);

    // Integrate with substeps
    const boxes = this.gatherBoxes();
    const travel = Math.hypot(this.vel.x, this.vel.y, this.vel.z) * dt;
    const steps = Math.max(1, Math.ceil(travel / 0.25));
    const sdt = dt / steps;
    const wasGrounded = this.grounded;
    const fallSpeed = -this.vel.y;
    this.grounded = false;
    this.landed = null;
    for (let i = 0; i < steps; i++) {
      this.pos.x += this.vel.x * sdt;
      this.collide('x', boxes);
      this.pos.z += this.vel.z * sdt;
      this.collide('z', boxes);
      const prevY = this.pos.y;
      this.pos.y += this.vel.y * sdt;
      const hit = this.collide('y', boxes, prevY);
      if (hit) {
        if (this.vel.y <= 0) this.grounded = true;
        this.vel.y = Math.max(0, this.vel.y);
      }
    }
    if (this.grounded && this.landed) {
      const b = this.landed;
      if (b.pad) {
        this.vel.y = b.pad;
        this.grounded = false;
        if (b.padTo) {
          // Aim the launch so you land on the target platform.
          const gr = lvl?.gravity ?? 18;
          const dy = b.padTo.y - this.pos.y;
          const disc = b.pad * b.pad - 2 * gr * dy;
          const t = disc > 0 ? (b.pad + Math.sqrt(disc)) / gr : (2 * b.pad) / gr;
          this.vel.x = (b.padTo.x - this.pos.x) / t;
          this.vel.z = (b.padTo.z - this.pos.z) / t;
          this.airLock = t * 0.75;
        }
        g.audio.play('boing');
        if (b.onPad) b.onPad();
      }
      if (b.carry) b.carry(this.pos, dt, this);
      if (!b.noSafe && !b.pad) this.lastSafe.copy(this.pos);
      if (!wasGrounded && fallSpeed > 6) g.audio.play('land');
    }
    // Head bob + footsteps
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && hs > 0.5) {
      const prev = Math.sin(this.bobT);
      this.bobT += dt * hs * 1.7;
      const now = Math.sin(this.bobT);
      if (prev > 0 && now <= 0) g.audio.play('step', { vol: 0.8 });
      this.bob = Math.abs(now) * 0.05;
    } else this.bob = damp(this.bob, 0, 10, dt);

    // Fell off the world?
    if (lvl && this.pos.y < (lvl.killY ?? -50)) {
      if (lvl.onFall) lvl.onFall(this);
      else this.respawn();
    }

    // Interactables
    this.updateFocus(canMove);
    if (lvl && lvl.update) lvl.update(dt, this);
  }

  respawn(pos = this.lastSafe) {
    this.pos.copy(pos);
    this.pos.y += 0.2;
    this.vel.set(0, 0, 0);
  }

  gatherBoxes() {
    const lvl = this.level;
    const out = this._boxes;
    out.length = 0;
    if (lvl && lvl.colliders) for (const b of lvl.colliders) out.push(b);
    if (lvl && lvl.dynamicColliders) for (const b of lvl.dynamicColliders()) out.push(b);
    return out;
  }

  updateFocus(canMove) {
    const g = this.game;
    const lvl = this.level;
    let best = null, bestScore = Infinity;
    if (lvl && lvl.interactables && canMove) {
      const eye = this.eyePos();
      const fwd = this.forward();
      for (const it of lvl.interactables) {
        if (it.enabled && !it.enabled()) continue;
        const p = typeof it.pos === 'function' ? it.pos() : it.pos;
        const d = eye.distanceTo(p);
        const r = it.radius ?? 2.6;
        if (d > r) continue;
        const dir = p.clone().sub(eye).normalize();
        const dot = dir.dot(fwd);
        if (dot < (it.cone ?? 0.55) && d > 1.2) continue;
        const score = d * (2 - dot);
        if (score < bestScore) { best = it; bestScore = score; }
      }
    }
    this.focus = best;
    if (best) {
      const label = typeof best.prompt === 'function' ? best.prompt() : best.prompt;
      g.ui.prompt(`<kbd>E</kbd>${label}`);
      if (g.input.hit('KeyE')) best.use();
    } else g.ui.prompt(null);
  }

  updateCamera() {
    const cam = this.game.camera;
    const e = this.eyePos();
    cam.position.copy(e);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch, this.yaw, 0);
  }
}
