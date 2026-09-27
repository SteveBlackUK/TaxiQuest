import * as THREE from 'three';
import { clamp, damp, dampAngle, pushSphereOutOfAabb } from '../core/util.js';
import { glowMat } from '../core/textures.js';
import { HALF } from '../world/layout.js';

// You fly the taxi. Mouse steers, W/S throttle, A/D strafe, Space/C altitude, Shift boost.
export class Drive {
  constructor(game) {
    this.game = game;
    this.taxi = game.taxi;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.boost = 1;
    this.active = false;
    this.bumps = 0;
    this.extraColliders = [];
    this.course = null;
    this.t = 0;
    this._q = [];
    // Holographic arrow on the dash pointing at the next checkpoint.
    this.arrow = new THREE.Group();
    const arrowMat = glowMat(0xffd23f, 1.5);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), arrowMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = -0.1;
    this.arrow.add(cone);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.16), arrowMat);
    shaft.position.z = 0.03;
    this.arrow.add(shaft);
    this.arrow.position.set(-0.5, 1.22, -1.05);
    this.arrow.visible = false;
    this.taxi.body.add(this.arrow);
  }

  begin({ pos, yaw = 0, passenger = null }) {
    const g = this.game;
    this.active = true;
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.boost = 1;
    this.bumps = 0;
    this.taxi.root.visible = true;
    this.taxi.setInside(true);
    this.taxi.setDriving(true);
    this.taxi.anchors.eyeDriver.add(g.camera);
    g.camera.position.set(0, 0, 0);
    g.camera.rotation.set(0, 0, 0);
    g.setFov(80);
    g.setCamera(this);
    g.addSystem(this);
    g.input.wantLock = true;
    g.ui.crosshair(true);
    this.passenger = passenger;
  }

  end() {
    const g = this.game;
    this.active = false;
    g.removeSystem(this);
    g.scene.attach(g.camera);
    if (g.cameraCtl === this) g.setCamera(null);
    g.input.wantLock = false;
    g.input.releaseLock();
    g.ui.crosshair(false);
    g.ui.lockHint(false);
    g.ui.meter('boost', { value: null });
    g.audio.setEngine(0, 0);
    this.arrow.visible = false;
    this.taxi.setInside(false);
    this.taxi.setDriving(false);
    this.clearCourse();
  }

  fwd(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  // ---------- Checkpoint course ----------
  setCourse(points, { onGate, radius = 9 } = {}) {
    this.clearCourse();
    const group = new THREE.Group();
    const rings = points.map((p, i) => {
      const ring = new THREE.Group();
      const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.55, 8, 40), glowMat(i === points.length - 1 ? 0xff3d8b : 0xffd23f, 2.2, { unique: true }));
      ring.add(torus);
      const next = points[i + 1] || points[i - 1];
      ring.position.copy(p);
      if (next) {
        const d = next.clone().sub(p);
        if (i === points.length - 1) d.negate();
        ring.lookAt(p.clone().add(d.setY(0)));
      }
      group.add(ring);
      return ring;
    });
    this.game.scene.add(group);
    this.course = { points, rings, idx: 0, group, onGate, radius };
    this.arrow.visible = true;
    this.highlight();
    return new Promise((res) => { this.course.done = res; });
  }
  highlight() {
    const c = this.course;
    c.rings.forEach((r, i) => {
      r.visible = i >= c.idx && i < c.idx + 3;
      r.scale.setScalar(i === c.idx ? 1 : 0.8);
      r.children[0].material.color.setScalar(0).add(new THREE.Color(i === c.points.length - 1 ? 0xff3d8b : i === c.idx ? 0x33f0ff : 0xffd23f).multiplyScalar(i === c.idx ? 3 : 1.2));
    });
  }
  clearCourse() {
    if (this.course) {
      this.game.scene.remove(this.course.group);
      this.course = null;
    }
    this.arrow.visible = false;
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    const input = g.input;
    this.t += dt;
    const talking = !!g.ui.line;
    g.ui.lockHint(!input.locked && !g.ui.modalOpen && !talking, 'Click to take the wheel');
    const sens = 0.0021 * (g.state.settings.sensitivity || 1);
    if (input.locked && !this.frozen) {
      this.yaw -= input.mouse.dx * sens;
      this.pitch = clamp(this.pitch - input.mouse.dy * sens * (g.state.settings.invertY ? -1 : 1), -0.75, 0.75);
    }
    const ctl = !this.frozen && !talking;
    const kYaw = ctl ? input.axis(['ArrowRight'], ['ArrowLeft']) : 0;
    this.yaw += kYaw * 1.6 * dt;
    const thr = ctl ? input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']) : 0;
    const strafe = ctl ? input.axis(['KeyA'], ['KeyD']) : 0;
    const vert = ctl ? input.axis(['KeyC', 'KeyQ'], ['Space']) : 0;
    const boosting = ctl && input.anyDown('ShiftLeft', 'ShiftRight') && this.boost > 0.02 && thr > 0;
    this.boost = clamp(this.boost + (boosting ? -0.35 : 0.14) * dt, 0, 1);
    g.ui.meter('boost', { label: 'BOOST [SHIFT]', value: this.boost, color: boosting ? '#ff3d8b' : '#33f0ff' });

    const f = this.fwd();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const accel = boosting ? 95 : 48;
    this.vel.addScaledVector(f, thr * accel * dt);
    this.vel.addScaledVector(right, strafe * 30 * dt);
    this.vel.y += vert * 30 * dt;
    // drag: stronger sideways so it handles like a car, not a puck
    const along = f.clone().multiplyScalar(this.vel.dot(f));
    const side = this.vel.clone().sub(along);
    along.multiplyScalar(Math.exp(-(thr === 0 ? 0.9 : 0.55) * dt));
    side.multiplyScalar(Math.exp(-2.6 * dt));
    this.vel.copy(along.add(side));
    const maxV = boosting ? 105 : 62;
    if (this.vel.length() > maxV) this.vel.setLength(damp(this.vel.length(), maxV, 3, dt));

    // Integrate + collide against buildings, landmarks, traffic
    const steps = Math.max(1, Math.ceil(this.vel.length() * dt / 1.2));
    const sdt = dt / steps;
    const center = new THREE.Vector3();
    for (let i = 0; i < steps; i++) {
      this.pos.addScaledVector(this.vel, sdt);
      center.copy(this.pos); center.y += 0.9;
      const boxes = g.city.query(center.x, center.z, 8, this._q);
      for (const b of boxes.concat(this.extraColliders)) {
        const n = pushSphereOutOfAabb(center, 1.7, b);
        if (n) this.bump(n);
      }
      this.pos.copy(center); this.pos.y -= 0.9;
    }
    if (this.pos.y < 8) { this.pos.y = 8; if (this.vel.y < -8) this.bump({ x: 0, y: 1, z: 0 }); this.vel.y = Math.max(0, this.vel.y); }
    if (this.pos.y > 460) { this.pos.y = 460; this.vel.y = Math.min(0, this.vel.y); }
    const lim = HALF + 150;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
    for (const car of g.traffic.near(this.pos, 4)) {
      const d = new THREE.Vector3().subVectors(this.pos, car.pos);
      const len = d.length() || 1;
      d.divideScalar(len);
      this.pos.addScaledVector(d, 4 - len);
      this.vel.addScaledVector(d, 12);
      if (!car.honked || this.t - car.honked > 1.5) {
        car.honked = this.t;
        g.audio.play('honk', { vol: 0.8 });
        g.addShake(0.8);
        this.bumps++;
        if (this.onBump) this.onBump('car');
      }
    }

    // Visual attitude
    const lateral = this.vel.dot(right);
    this.roll = damp(this.roll, clamp(-lateral * 0.02 - kYaw * 0.2 - (input.locked ? input.mouse.dx * 0.004 : 0), -0.5, 0.5), 5, dt);
    const r = this.taxi.root;
    r.position.copy(this.pos);
    r.rotation.order = 'YXZ';
    r.rotation.set(this.pitch * 0.85, this.yaw, this.roll);
    this.taxi.update(dt, this.vel.length());
    g.audio.setEngine(1, clamp(this.vel.length() / 80, 0, 1));
    if (this.passenger) this.passenger.update(dt);

    // Course
    const c = this.course;
    if (c && c.idx < c.points.length) {
      const target = c.points[c.idx];
      const ring = c.rings[c.idx];
      ring.rotation.z += dt;
      const d = center.distanceTo(target);
      if (d < c.radius + 1.5) {
        g.audio.play('checkpoint');
        const i = c.idx;
        c.idx++;
        if (c.onGate) c.onGate(i);
        if (c.idx >= c.points.length) {
          const done = c.done;
          this.arrow.visible = false;
          c.rings.forEach((rr) => (rr.visible = false));
          done();
        } else this.highlight();
      }
      if (this.course && this.course.idx < this.course.points.length) {
        const tgt = this.course.points[this.course.idx];
        const wp = new THREE.Vector3();
        this.arrow.getWorldPosition(wp);
        const m = new THREE.Matrix4().lookAt(wp, tgt, new THREE.Vector3(0, 1, 0));
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        const pq = new THREE.Quaternion();
        this.arrow.parent.getWorldQuaternion(pq);
        this.arrow.quaternion.copy(pq.invert().multiply(q));
        this.distToGate = d;
      }
    }
  }

  bump(n) {
    const g = this.game;
    const vn = this.vel.x * n.x + this.vel.y * n.y + this.vel.z * n.z;
    if (vn < 0) {
      this.vel.x -= 1.4 * vn * n.x;
      this.vel.y -= 1.4 * vn * n.y;
      this.vel.z -= 1.4 * vn * n.z;
      this.vel.multiplyScalar(0.7);
      if (-vn > 6) {
        g.audio.play('crash', { vol: clamp(-vn / 40, 0.3, 1) });
        g.addShake(clamp(-vn / 15, 0.4, 2));
        this.bumps++;
        if (this.onBump) this.onBump('wall', -vn);
      }
    }
  }

  updateCamera() {
    const cam = this.game.camera;
    cam.position.set(0, 0, 0);
    cam.rotation.set(this.pitch * 0.15 - 0.04, 0, 0);
  }
}
