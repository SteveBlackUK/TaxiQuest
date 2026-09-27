import * as THREE from 'three';
import { N, HALF, PITCH, PLACES, streetPos } from '../world/layout.js';
import { clamp, damp, dampAngle, wrapAngle } from '../core/util.js';

export const CRUISE_ALT = 72;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Intersections inside multi-block plazas are off-limits (the spire lives there).
const BLOCKED = new Set();
for (const p of Object.values(PLACES)) {
  for (let kx = p.bi + 1; kx < p.bi + p.w; kx++) for (let kz = p.bj + 1; kz < p.bj + p.h; kz++) BLOCKED.add(`${kx},${kz}`);
}
const valid = (kx, kz) => kx >= 1 && kx <= N - 1 && kz >= 1 && kz <= N - 1 && !BLOCKED.has(`${kx},${kz}`);

// Dijkstra over (intersection, heading) with a turn penalty so routes look like a cabbie drove them.
export function findRoute(start, startDir, goal) {
  const key = (kx, kz, d) => (kx * 32 + kz) * 4 + d;
  const dist = new Map();
  const prev = new Map();
  const open = [];
  const s0 = key(start.kx, start.kz, startDir);
  dist.set(s0, 0);
  open.push({ kx: start.kx, kz: start.kz, d: startDir, c: 0 });
  let best = null;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].c < open[bi].c) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.kx, cur.kz, cur.d);
    if (cur.c > (dist.get(ck) ?? Infinity)) continue;
    if (cur.kx === goal.kx && cur.kz === goal.kz) { best = cur; break; }
    for (let d = 0; d < 4; d++) {
      const nx = cur.kx + DIRS[d][0], nz = cur.kz + DIRS[d][1];
      if (!valid(nx, nz)) continue;
      const uturn = (d ^ 1) === cur.d && d !== cur.d;
      const cost = cur.c + 1 + (d !== cur.d ? 0.6 : 0) + (uturn ? 40 : 0);
      const nk = key(nx, nz, d);
      if (cost < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, cost);
        prev.set(nk, ck);
        open.push({ kx: nx, kz: nz, d, c: cost });
      }
    }
  }
  if (!best) return [start];
  const out = [];
  let k = key(best.kx, best.kz, best.d);
  while (k !== undefined) {
    const d = k % 4, n = (k - d) / 4;
    out.push({ kx: Math.floor(n / 32), kz: n % 32 });
    k = prev.get(k);
  }
  return out.reverse();
}

const nodePos = (n, alt) => new THREE.Vector3(streetPos(n.kx), alt, streetPos(n.kz));

// The next intersection ahead of a position moving along the grid.
export function nextNode(pos, fwd) {
  const fx = (pos.x + HALF) / PITCH, fz = (pos.z + HALF) / PITCH;
  let kx, kz, d;
  if (Math.abs(fwd.x) >= Math.abs(fwd.z)) {
    kz = Math.round(fz);
    kx = fwd.x > 0 ? Math.floor(fx + 0.3) + 1 : Math.ceil(fx - 0.3) - 1;
    d = fwd.x > 0 ? 0 : 1;
  } else {
    kx = Math.round(fx);
    kz = fwd.z > 0 ? Math.floor(fz + 0.3) + 1 : Math.ceil(fz - 0.3) - 1;
    d = fwd.z > 0 ? 2 : 3;
  }
  kx = clamp(kx, 1, N - 1); kz = clamp(kz, 1, N - 1);
  if (!valid(kx, kz)) { kx = clamp(kx + (d === 0 ? 1 : d === 1 ? -1 : 0), 1, N - 1); kz = clamp(kz + (d === 2 ? 1 : d === 3 ? -1 : 0), 1, N - 1); }
  return { kx, kz, d };
}

// Turn a node list into smooth control points that stay inside street canyons.
export function nodesToPoints(nodes, alt, inDir, tail = []) {
  const pts = [];
  for (let i = 0; i < nodes.length; i++) {
    const c = nodePos(nodes[i], alt);
    const prev = i > 0 ? nodePos(nodes[i - 1], alt) : null;
    const next = i < nodes.length - 1 ? nodePos(nodes[i + 1], alt) : (tail[0] ? tail[0].clone().setY(alt) : null);
    const dIn = prev ? c.clone().sub(prev).setY(0).normalize() : inDir.clone().setY(0).normalize();
    const dOut = next ? next.clone().sub(c).setY(0).normalize() : dIn.clone();
    if (dIn.dot(dOut) < 0.7) {
      pts.push(c.clone().addScaledVector(dIn, -11));
      pts.push(c.clone().addScaledVector(dIn, -3).addScaledVector(dOut, 3));
      pts.push(c.clone().addScaledVector(dOut, 11));
    } else pts.push(c);
  }
  return pts.concat(tail);
}

export class Ride {
  constructor(game) {
    this.game = game;
    this.taxi = game.taxi;
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.targetSpeed = 32;
    this.curve = null;
    this.s = 0;
    this.len = 0;
    this.mode = 'hover';
    this.style = 'smooth';
    this.roll = 0;
    this.pitch = 0;
    this.t = 0;
    this.look = { yaw: 0, pitch: 0 };
    this.lookOverride = null;
    this.driver = null;
    this.active = false;
    this.bounceY = 0;
    this.onArrive = null;
    this.alt = CRUISE_ALT;
    this.freeze = false;
    this._fwd = new THREE.Vector3();
  }

  fwd() { return this._fwd.set(-Math.sin(this.heading), 0, -Math.cos(this.heading)); }

  begin({ driver, pos, yaw = 0, style = 'smooth', speed = 32, place = null, passenger = true }) {
    const g = this.game;
    this.active = true;
    this.place = place;
    this.finalYaw = undefined;
    this.driver = driver;
    this.style = style;
    this.targetSpeed = speed;
    this.pos.copy(pos);
    this.heading = yaw;
    this.speed = 0;
    this.mode = 'hover';
    this.curve = null;
    this.lookOverride = null;
    this.camOffset = null;
    this.driverLookOverride = null;
    this.barks = null;
    this.barkT = 10;
    this.taxi.root.visible = true;
    this.taxi.setDoor(false);
    this.taxi.resetFare();
    if (driver) {
      this.taxi.anchors.driver.add(driver.root);
      driver.root.position.set(0, 0, 0);
      driver.root.rotation.set(0, 0, 0);
    }
    g.addSystem(this);
    this.passenger = false;
    this.taxi.setInside(false);
    if (passenger) this.setPassenger(true);
    this.applyTransform(0);
  }

  setPassenger(on) {
    const g = this.game;
    this.passenger = on;
    this.taxi.setInside(on);
    if (on) {
      this.taxi.anchors.eyeRear.add(g.camera);
      g.camera.position.set(0, 0, 0);
      g.camera.rotation.set(0, 0, 0);
      g.camera.fov = 74;
      g.camera.updateProjectionMatrix();
      g.setCamera(this);
      g.input.wantLock = false;
      g.input.releaseLock();
      g.ui.crosshair(false);
      this.look.yaw = 0;
      this.look.pitch = 0;
    } else {
      if (g.camera.parent !== g.scene) g.scene.attach(g.camera);
      if (g.cameraCtl === this) g.setCamera(null);
    }
  }

  end() {
    const g = this.game;
    this.active = false;
    g.removeSystem(this);
    if (this.passenger) this.setPassenger(false);
    this.taxi.setInside(false);
    if (this.driver) this.driver.lookAt(null);
    g.audio.setEngine(0, 0);
  }

  // Wander the streets forever until told otherwise.
  cruise() {
    if (this.place) { this.depart(this.place); return; }
    this.mode = 'cruise';
    this.onArrive = null;
    this.finalYaw = undefined;
    this.planWander();
  }

  planWander() {
    const f = this.fwd();
    const nn = nextNode(this.pos, f);
    const goal = { kx: 1 + Math.floor(Math.random() * (N - 1)), kz: 1 + Math.floor(Math.random() * (N - 1)) };
    if (!valid(goal.kx, goal.kz) || (Math.abs(goal.kx - nn.kx) + Math.abs(goal.kz - nn.kz) < 5)) { goal.kx = N - nn.kx; goal.kz = N - nn.kz; }
    const nodes = findRoute(nn, nn.d, valid(goal.kx, goal.kz) ? goal : { kx: 2, kz: 2 });
    const pts = [this.pos.clone(), this.pos.clone().addScaledVector(f, 10).setY(this.pos.y + (this.alt - this.pos.y) * 0.2)];
    this.setPath(pts.concat(nodesToPoints(nodes, this.alt, f)), 0);
  }

  // Fly to a place's dock. Resolves on arrival.
  goTo(place) {
    return new Promise((res) => {
      let f = this.fwd().clone();
      let from = this.pos.clone();
      const head = [this.pos.clone()];
      if (this.place) {
        // Leave the current dock first.
        const d0 = this.place.dock;
        const along = this.alongStreet(d0.entry, place.dock.entry);
        head.push(d0.pre.clone(), d0.entry.clone().setY(d0.pre.y), d0.entry.clone().setY(this.alt));
        from = d0.entry.clone().setY(this.alt).addScaledVector(along, 30);
        head.push(from.clone());
        f = along;
        this.place = null;
      } else head.push(this.pos.clone().addScaledVector(f, 10).setY(this.pos.y + (this.alt - this.pos.y) * 0.2));
      const dock = place.dock;
      const entry = dock.entry;
      const nn = nextNode(from, f);
      // Entry is on a street line; aim for the nearer intersection on that street.
      const ex = (entry.x + HALF) / PITCH, ez = (entry.z + HALF) / PITCH;
      let cands;
      if (Math.abs(ex - Math.round(ex)) < 0.05) cands = [{ kx: Math.round(ex), kz: Math.floor(ez) }, { kx: Math.round(ex), kz: Math.ceil(ez) }];
      else cands = [{ kx: Math.floor(ex), kz: Math.round(ez) }, { kx: Math.ceil(ex), kz: Math.round(ez) }];
      cands = cands.filter((c) => valid(c.kx, c.kz));
      cands.sort((a, b) => nodePos(a, 0).distanceTo(this.pos) - nodePos(b, 0).distanceTo(this.pos));
      const goal = cands[0];
      const nodes = findRoute(nn, nn.d, goal);
      const up = entry.clone().setY(dock.pre.y);
      const tail = [entry.clone().setY(this.alt), up, dock.pre.clone(), dock.pos.clone()];
      this.setPath(head.concat(nodesToPoints(nodes, this.alt, f, tail)), 0);
      this.mode = 'goto';
      this.finalYaw = dock.yaw;
      this.onArrive = () => { this.place = place; res(); };
    });
  }

  // Leave a dock and join the street grid.
  depart(place) {
    const dock = place.dock;
    const pts = [this.pos.clone(), dock.pre.clone(), dock.entry.clone().setY(dock.pre.y), dock.entry.clone().setY(this.alt)];
    const along = this.alongStreet(dock.entry, new THREE.Vector3(0, 0, 0));
    pts.push(dock.entry.clone().setY(this.alt).addScaledVector(along, 40));
    this.setPath(pts, 0);
    this.mode = 'depart';
    this.place = null;
    this.finalYaw = undefined;
    this.onArrive = null;
  }

  // Unit vector along the street an entry point sits on, pointing roughly toward 'toward'.
  alongStreet(entry, toward) {
    const fx = ((entry.x + HALF) / PITCH) % 1;
    const onX = Math.abs(fx) < 0.05 || Math.abs(fx) > 0.95; // entry.x is a street line -> street runs along z
    const along = onX ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    const d = new THREE.Vector3().subVectors(toward, entry);
    if (along.dot(d) < 0) along.negate();
    return along;
  }

  setPath(points, s0 = 0) {
    // Drop points that are too close together (Catmull-Rom hates that).
    const clean = [points[0]];
    for (let i = 1; i < points.length; i++) if (points[i].distanceTo(clean[clean.length - 1]) > 2) clean.push(points[i]);
    if (clean.length < 2) clean.push(clean[0].clone().add(new THREE.Vector3(0, 0.1, -1)));
    this.curve = new THREE.CatmullRomCurve3(clean, false, 'centripetal', 0.5);
    this.curve.arcLengthDivisions = Math.max(200, clean.length * 30);
    this.len = this.curve.getLength();
    this.s = s0;
  }

  // Short direct move (e.g. pull forward to the pick-up window).
  moveTo(pos, yaw) {
    return new Promise((res) => {
      const pts = [this.pos.clone(), this.pos.clone().lerp(pos, 0.5), pos.clone()];
      this.setPath(pts, 0);
      this.mode = 'goto';
      this.finalYaw = yaw;
      const place = this.place;
      this.onArrive = () => { this.place = place; res(); };
      this.place = place;
    });
  }

  hover() {
    this.mode = 'hover';
    this.curve = null;
  }

  teleport(pos, yaw) {
    this.pos.copy(pos);
    this.heading = yaw;
    this.speed = 0;
    this.curve = null;
    this.mode = 'hover';
    this.applyTransform(0);
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (this.freeze) {
      // A script is driving the taxi's transform directly (e.g. the nose-dive).
      this.taxi.update(dt, this.speed);
      if (this.driver) this.driver.update(dt);
      return;
    }
    const prevHeading = this.heading;
    if (this.curve && !this.freeze) {
      const remaining = this.len - this.s;
      let target = this.targetSpeed;
      if (this.mode === 'depart') target = Math.min(target, 22);
      if (this.mode === 'goto' || this.mode === 'depart') target = Math.min(target, Math.sqrt(2 * 9 * Math.max(0, remaining)) + 1.5);
      this.speed = damp(this.speed, target, this.speed < target ? 0.9 : 3, dt);
      this.s = Math.min(this.len, this.s + this.speed * dt);
      const u = this.len > 0 ? this.s / this.len : 1;
      this.curve.getPointAt(u, this.pos);
      const tan = this.curve.getTangentAt(Math.min(u, 0.999));
      const flat = Math.hypot(tan.x, tan.z);
      if (flat > 0.2) this.heading = dampAngle(this.heading, Math.atan2(-tan.x, -tan.z), 6, dt);
      this.pitch = damp(this.pitch, clamp(Math.atan2(tan.y, flat) * 0.6, -0.35, 0.35), 4, dt);
      if (this.s >= this.len - 0.05) {
        if (this.mode === 'cruise') this.planWander();
        else {
          this.curve = null;
          if (this.mode === 'depart') this.cruise();
          else {
            this.mode = 'hover';
            const cb = this.onArrive;
            this.onArrive = null;
            if (cb) cb();
          }
        }
      } else if (this.mode === 'cruise' && remaining < 90) {
        this.planWander();
      }
    } else {
      this.speed = damp(this.speed, 0, 3, dt);
      this.pitch = damp(this.pitch, 0, 3, dt);
      if (this.finalYaw !== undefined && this.mode === 'hover') this.heading = dampAngle(this.heading, this.finalYaw, 2.5, dt);
    }
    const yawRate = wrapAngle(this.heading - prevHeading) / Math.max(dt, 1e-4);
    const rollMul = this.style === 'aggressive' ? 1.6 : this.style === 'slow' ? 0.3 : 1;
    this.roll = damp(this.roll, clamp(yawRate * this.speed * 0.012 * rollMul, -0.45, 0.45), 3, dt);
    // Style flavour
    if (this.style === 'bouncy' && this.speed > 5) {
      const ph = (this.t * 1.25) % 1;
      const y = Math.sin(ph * Math.PI) * 2.2;
      if (this.bounceY > 0.3 && y < 0.3 && this._lastBounce !== Math.floor(this.t * 1.25)) {
        this._lastBounce = Math.floor(this.t * 1.25);
        this.game.addShake(0.5);
        this.game.audio.play('boing', { vol: 0.35 });
      }
      this.bounceY = y;
    } else this.bounceY = damp(this.bounceY, 0, 4, dt);
    this.applyTransform(dt);
    this.taxi.update(dt, this.speed);
    // Ambient chatter and honks while cruising
    if (this.passenger && this.speed > 8 && !this.game.ui.line && !this.game.chase.active) {
      this.barkT = (this.barkT ?? 12) - dt;
      if (this.barkT <= 0) {
        this.barkT = 14 + Math.random() * 10;
        if (Math.random() < 0.6) this.game.audio.play('honk', { vol: 0.5, pan: Math.random() * 2 - 1 });
        if (this.barks && this.barks.length && this.driver) this.game.ui.bark(this.driver.cast?.name?.toUpperCase() || 'DRIVER', this.barks[Math.floor(Math.random() * this.barks.length)], 3.5);
      }
    }
    if (this.passenger) this.game.audio.setEngine(1, clamp(this.speed / 60, 0, 1));
    else this.game.audio.setEngine(0, 0);
    if (this.driver) {
      this.driver.update(dt);
      if (!this.driver.attending && !this.driverLookOverride) {
        const ahead = this._ahead || (this._ahead = new THREE.Vector3());
        this.taxi.anchors.driver.getWorldPosition(ahead);
        ahead.addScaledVector(this.fwd(), 20);
        ahead.y += 1;
        this.driver.lookAt(ahead);
      } else if (this.driverLookOverride) this.driver.lookAt(this.driverLookOverride);
    }
  }

  applyTransform() {
    const r = this.taxi.root;
    r.position.copy(this.pos);
    r.position.y += this.bounceY + Math.sin(this.t * 1.7) * 0.12;
    r.rotation.order = 'YXZ';
    r.rotation.set(this.pitch, this.heading, this.roll);
    r.updateMatrixWorld(true);
  }

  updateCamera(dt) {
    const g = this.game;
    const cam = g.camera;
    let ty, tp;
    const m = g.input.mouse;
    if (this.lookOverride) {
      ty = this.lookOverride.yaw; tp = this.lookOverride.pitch;
      if (this.lookOverride.follow) { ty -= m.nx * 0.28; tp += m.ny * 0.16; }
    } else {
      ty = -m.nx * 1.25;
      tp = m.ny * 0.45 - 0.08;
    }
    this.look.yaw = damp(this.look.yaw, ty, 5, dt || 0.016);
    this.look.pitch = damp(this.look.pitch, tp, 5, dt || 0.016);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.look.pitch, this.look.yaw, 0);
    if (this.camOffset) cam.position.copy(this.camOffset);
    else cam.position.set(0, 0, 0);
  }

  // Yaw/pitch for the back-seat camera to face a world point.
  lookAtWorld(p) {
    const eye = this.taxi.anchors.eyeRear;
    this.taxi.root.updateMatrixWorld(true);
    const local = eye.worldToLocal(p.clone());
    if (this.camOffset) local.sub(this.camOffset);
    return { yaw: Math.atan2(-local.x, -local.z), pitch: Math.atan2(local.y, Math.hypot(local.x, local.z)) };
  }

  // World-space camera position (for characters to look at).
  cameraWorld(out = new THREE.Vector3()) {
    return this.game.camera.getWorldPosition(out);
  }
}
