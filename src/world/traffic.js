import * as THREE from 'three';
import { mergeGeometries, colorize, boxAt } from '../core/geom.js';
import { N, HALF, streetPos } from './layout.js';

const TRAFFIC_ALTS = [40, 60, 84, 112, 150, 195];
const CAR_COLORS = [0xffd23f, 0xffd23f, 0xf2f2f2, 0xd8324a, 0x3a6bd8, 0x7a3ad8, 0x202028, 0x2ad8a8, 0xff7a2a];

function carBodyGeometry() {
  const body = colorize(boxAt(2.2, 0.8, 4.6, 0, 0, 0), 0xffffff);
  const cabin = colorize(boxAt(1.9, 0.7, 2.4, 0, 0.72, 0.2), 0xffffff);
  const glass = colorize(boxAt(1.95, 0.5, 2.3, 0, 0.75, 0.15), 0x223055);
  const pod1 = colorize(boxAt(0.5, 0.4, 1.2, -1.2, -0.3, 1.4), 0x444455);
  const pod2 = colorize(boxAt(0.5, 0.4, 1.2, 1.2, -0.3, 1.4), 0x444455);
  const pod3 = colorize(boxAt(0.5, 0.4, 1.2, -1.2, -0.3, -1.4), 0x444455);
  const pod4 = colorize(boxAt(0.5, 0.4, 1.2, 1.2, -0.3, -1.4), 0x444455);
  return mergeGeometries([body, cabin, glass, pod1, pod2, pod3, pod4]);
}

function carLightsGeometry() {
  // Car faces -Z (front). Headlights front, taillights back, underglow.
  const hl1 = colorize(boxAt(0.5, 0.18, 0.1, -0.7, 0.05, -2.32), new THREE.Color(3, 3, 2.6));
  const hl2 = colorize(boxAt(0.5, 0.18, 0.1, 0.7, 0.05, -2.32), new THREE.Color(3, 3, 2.6));
  const tl = colorize(boxAt(1.9, 0.16, 0.1, 0, 0.1, 2.32), new THREE.Color(4, 0.3, 0.35));
  const under1 = colorize(boxAt(0.4, 0.1, 1.0, -1.2, -0.52, 1.4), new THREE.Color(0.4, 2.2, 3));
  const under2 = colorize(boxAt(0.4, 0.1, 1.0, 1.2, -0.52, 1.4), new THREE.Color(0.4, 2.2, 3));
  const under3 = colorize(boxAt(0.4, 0.1, 1.0, -1.2, -0.52, -1.4), new THREE.Color(0.4, 2.2, 3));
  const under4 = colorize(boxAt(0.4, 0.1, 1.0, 1.2, -0.52, -1.4), new THREE.Color(0.4, 2.2, 3));
  return mergeGeometries([hl1, hl2, tl, under1, under2, under3, under4]);
}

export class Traffic {
  constructor(count = 420, seed = 7) {
    this.cars = [];
    let s = seed;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const lanes = [];
    for (let k = 1; k < N; k++) {
      for (const alt of TRAFFIC_ALTS) {
        for (const dir of [1, -1]) {
          lanes.push({ axis: 'x', c: streetPos(k) + dir * 6, alt: alt + (dir > 0 ? 0 : 3), dir });
          lanes.push({ axis: 'z', c: streetPos(k) - dir * 6, alt: alt + (dir > 0 ? 1.5 : 4.5), dir });
        }
      }
    }
    for (let i = 0; i < count; i++) {
      const lane = lanes[Math.floor(r() * lanes.length)];
      this.cars.push({
        lane,
        t: -HALF + r() * HALF * 2,
        speed: 18 + r() * 30,
        bob: r() * 10,
        pos: new THREE.Vector3(),
        color: CAR_COLORS[Math.floor(r() * CAR_COLORS.length)],
        active: true,
      });
    }
    const bodyGeo = carBodyGeometry();
    const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.body = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    this.lights = new THREE.InstancedMesh(carLightsGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true }), count);
    const c = new THREE.Color();
    this.cars.forEach((car, i) => this.body.setColorAt(i, c.setHex(car.color)));
    this.body.instanceColor.needsUpdate = true;
    this.body.frustumCulled = false;
    this.lights.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.body, this.lights);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3(1, 1, 1);
    this._yaws = {
      'x1': new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2),
      'x-1': new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2),
      'z1': new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
      'z-1': new THREE.Quaternion(),
    };
    this.update(0, 0);
  }

  update(dt, time) {
    const m = this._m;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const L = car.lane;
      car.t += car.speed * L.dir * dt;
      if (car.t > HALF + 60) car.t = -HALF - 60;
      if (car.t < -HALF - 60) car.t = HALF + 60;
      const y = L.alt + Math.sin(time * 1.3 + car.bob) * 0.35;
      if (L.axis === 'x') car.pos.set(car.t, y, L.c);
      else car.pos.set(L.c, y, car.t);
      if (!car.active) { this.body.setMatrixAt(i, hide); this.lights.setMatrixAt(i, hide); continue; }
      m.compose(car.pos, this._yaws[L.axis + L.dir], this._s);
      this.body.setMatrixAt(i, m);
      this.lights.setMatrixAt(i, m);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.lights.instanceMatrix.needsUpdate = true;
  }

  // Cars near a point (for collisions / honks).
  near(p, r) {
    const out = [];
    const r2 = r * r;
    for (const car of this.cars) if (car.active && car.pos.distanceToSquared(p) < r2) out.push(car);
    return out;
  }
}
