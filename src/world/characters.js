import * as THREE from 'three';
import { toon, glowMat, drawTexture, neonText, FONT_DISPLAY, toonGradient } from '../core/textures.js';
import { clamp, damp, dampAngle, rand } from '../core/util.js';

const S = (r, w = 12, h = 10) => new THREE.SphereGeometry(r, w, h);
const unlit = (c) => new THREE.MeshBasicMaterial({ color: c });
const WHITE_EYE = unlit(0xdcdcdc);
const BLACK = unlit(0x0a0a0a);

function part(parent, geo, mat, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = [], [sx = 1, sy = 1, sz = 1] = []) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}

// Cylinder spanning two points.
function limb(parent, a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const geo = new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 8);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  parent.add(m);
  return m;
}

function eye(parent, x, y, z, r, { iris = null, pupil = 0x0a0a0a, slit = false, lidColor = null, pupilScale = 0.55 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  part(g, S(r, 14, 12), WHITE_EYE);
  let pup;
  if (iris !== null) {
    part(g, S(r * 0.72, 12, 10), unlit(iris), [0, 0, -r * 0.42]);
    pup = slit ? part(g, new THREE.BoxGeometry(r * 0.22, r * 1.1, r * 0.2), unlit(pupil), [0, 0, -r * 0.92])
      : part(g, S(r * 0.38, 10, 8), unlit(pupil), [0, 0, -r * 0.8]);
  } else {
    pup = part(g, S(r * pupilScale, 12, 10), unlit(pupil), [0, 0, -r * 0.55]);
  }
  part(g, S(r * 0.18, 6, 5), unlit(0xe8e8e8), [r * 0.25, r * 0.3, -r * 0.95]);
  let lid = null;
  if (lidColor !== null) {
    lid = new THREE.Group();
    g.add(lid);
    part(lid, new THREE.SphereGeometry(r * 1.08, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(lidColor), [0, 0, 0]);
    lid.rotation.x = 0.7;
  }
  return { g, pup, lid };
}

// ---------- Rig ----------
class Character {
  constructor(def) {
    this.def = def;
    this.root = new THREE.Group();
    this.root.name = def.name || 'character';
    this.body = new THREE.Group();          // turns a little toward look targets
    this.root.add(this.body);
    this.torso = new THREE.Group();
    this.body.add(this.torso);
    this.headPivot = new THREE.Group();
    this.body.add(this.headPivot);
    this.head = new THREE.Group();
    this.headPivot.add(this.head);
    this.jaw = null;
    this.jawOpenMax = 0.35;
    this.lids = [];
    this.pupils = [];
    this.talking = false;
    this.talkT = 0;
    this.blinkT = rand(1, 4);
    this.lookTarget = null;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.maxYaw = 1.9;
    this.bodyTurn = 0.35;
    this.baseLidRot = 0.7;
    this.sleepy = false;
    this.t = rand(0, 10);
    this.speedMul = 1;
    this.extras = [];
    this.bob = 0;
    this.mood = 'normal';
  }
  setTalking(v) { this.talking = v; }
  lookAt(target) { this.lookTarget = target; }
  update(dt) {
    const s = this.speedMul;
    this.t += dt * s;
    const t = this.t;
    // breathing
    this.torso.scale.y = 1 + Math.sin(t * 2) * 0.015;
    // look
    let yaw = 0, pitch = 0;
    if (this.attending) this.lookTarget = this.attending();
    if (this.lookTarget) {
      const p = this._tmp || (this._tmp = new THREE.Vector3());
      p.copy(this.lookTarget);
      this.root.worldToLocal(p);
      p.sub(this.headPivot.position);
      yaw = Math.atan2(-p.x, -p.z);
      pitch = Math.atan2(p.y, Math.hypot(p.x, p.z));
    }
    const bodyYaw = clamp(yaw * this.bodyTurn, -0.6, 0.6);
    const headYaw = clamp(yaw - bodyYaw, -this.maxYaw, this.maxYaw);
    const lam = 5 * s;
    this.body.rotation.y = dampAngle(this.body.rotation.y, bodyYaw, lam * 0.6, dt);
    this.lookYaw = dampAngle(this.lookYaw, headYaw, lam, dt);
    this.lookPitch = damp(this.lookPitch, clamp(pitch, -0.5, 0.5), lam, dt);
    this.headPivot.rotation.y = this.lookYaw;
    this.headPivot.rotation.x = this.lookPitch;
    // talking
    if (this.talking) {
      this.talkT += dt * s;
      const open = (Math.sin(this.talkT * 17) * 0.5 + 0.5) * (0.6 + 0.4 * Math.sin(this.talkT * 5.3));
      if (this.jaw) this.jaw.rotation.x = -open * this.jawOpenMax;
      this.head.rotation.z = Math.sin(this.talkT * 4) * 0.04;
      this.head.position.y = Math.abs(Math.sin(this.talkT * 8)) * 0.012;
    } else {
      if (this.jaw) this.jaw.rotation.x = damp(this.jaw.rotation.x, 0, 12, dt);
      this.head.rotation.z = damp(this.head.rotation.z, Math.sin(t * 0.7) * 0.03, 3, dt);
      this.head.position.y = damp(this.head.position.y, 0, 8, dt);
    }
    // blinking
    this.blinkT -= dt * s;
    let lidRot = this.sleepy ? -0.5 : this.baseLidRot;
    if (this.blinkT < 0) {
      lidRot = -1.5;
      if (this.blinkT < -0.12 / s) this.blinkT = rand(2, 5);
    }
    if (this.asleep) lidRot = -1.55;
    for (const l of this.lids) l.rotation.x = lidRot;
    if (this.bob) this.root.position.y = this.baseY + Math.abs(Math.sin(t * this.bob)) * 0.05;
    for (const fn of this.extras) fn(dt, t, this);
  }
}

function seatedBody(c, { shirt, fur, skin = fur, broad = 1, hands = 'wheel', neckY = 0.62 }) {
  const shirtMat = toon(shirt);
  const furMat = toon(fur);
  part(c.torso, new THREE.CapsuleGeometry(0.2, 0.26, 6, 12), shirtMat, [0, 0.3, 0], [0, 0, 0], [1.15 * broad, 1, 0.85]);
  part(c.torso, S(0.1, 10, 8), furMat, [0, neckY - 0.1, 0], [0, 0, 0], [1.2, 1, 1.1]); // neck
  c.headPivot.position.set(0, neckY, 0);
  // legs (thighs) forward under the dash
  const legMat = toon(0x2a2438);
  for (const s of [-1, 1]) {
    limb(c.torso, new THREE.Vector3(s * 0.12, 0.04, 0), new THREE.Vector3(s * 0.13, 0.02, -0.42), 0.085, legMat);
    limb(c.torso, new THREE.Vector3(s * 0.13, 0.02, -0.42), new THREE.Vector3(s * 0.13, -0.38, -0.5), 0.07, legMat);
  }
  const sh = 0.24 * broad;
  const handTargets = hands === 'wheel'
    ? [new THREE.Vector3(-0.17, 0.36, -0.64), new THREE.Vector3(0.17, 0.36, -0.64)]
    : hands === 'up'
      ? [new THREE.Vector3(-0.3, 0.75, -0.2), new THREE.Vector3(0.3, 0.75, -0.2)]
      : [new THREE.Vector3(-0.15, 0.14, -0.3), new THREE.Vector3(0.15, 0.14, -0.3)];
  c.arms = [];
  [-1, 1].forEach((s, i) => {
    const arm = new THREE.Group();
    arm.position.set(s * sh, 0.46, 0);
    c.torso.add(arm);
    const tgt = handTargets[i].clone().sub(arm.position);
    const elbow = tgt.clone().multiplyScalar(0.5).add(new THREE.Vector3(s * 0.08, -0.12, 0.05));
    limb(arm, new THREE.Vector3(0, 0, 0), elbow, 0.065 * broad, shirtMat);
    limb(arm, elbow, tgt, 0.055 * broad, furMat);
    part(arm, S(0.065 * broad, 10, 8), toon(skin), [tgt.x, tgt.y, tgt.z]);
    c.arms.push(arm);
  });
}

function standingBody(c, { shirt, fur, skin = fur, h = 1, legColor = null }) {
  // Scaled so the head is ~1.6 * h above the feet.
  const shirtMat = toon(shirt);
  const furMat = toon(fur);
  const legMat = toon(legColor ?? fur);
  c.torso.position.y = 0.72 * h;
  part(c.torso, new THREE.CapsuleGeometry(0.2 * h, 0.26 * h, 6, 12), shirtMat, [0, 0.3 * h, 0], [0, 0, 0], [1.1, 1, 0.85]);
  c.headPivot.position.set(0, 0.72 * h + 0.62 * h, 0);
  c.legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.1 * h, 0.72 * h, 0);
    c.body.add(leg);
    limb(leg, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.66 * h, 0), 0.075 * h, legMat);
    part(leg, S(0.09 * h), toon(skin), [0, -0.7 * h, -0.05], [0, 0, 0], [1, 0.6, 1.5]);
    c.legs.push(leg);
  }
  c.arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.25 * h, 1.18 * h, 0);
    c.body.add(arm);
    limb(arm, new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.05, -0.5 * h, 0), 0.06 * h, shirtMat);
    part(arm, S(0.065 * h), toon(skin), [s * 0.05, -0.54 * h, 0]);
    c.arms.push(arm);
  }
  c.walkPhase = 0;
  c.extras.push((dt, t, ch) => {
    if (ch.walking) {
      ch.walkPhase += dt * 9 * (ch.walkSpeed || 1);
      const a = Math.sin(ch.walkPhase) * 0.6;
      ch.legs[0].rotation.x = a; ch.legs[1].rotation.x = -a;
      ch.arms[0].rotation.x = -a * 0.7; ch.arms[1].rotation.x = a * 0.7;
    } else {
      for (const l of ch.legs) l.rotation.x = damp(l.rotation.x, 0, 8, dt);
      if (!ch.armPose) for (const a of ch.arms) a.rotation.x = damp(a.rotation.x, 0, 8, dt);
    }
    if (ch.armPose === 'cheer') {
      ch.arms[0].rotation.z = damp(ch.arms[0].rotation.z, -2.6 + Math.sin(t * 10) * 0.2, 10, dt);
      ch.arms[1].rotation.z = damp(ch.arms[1].rotation.z, 2.6 - Math.sin(t * 10) * 0.2, 10, dt);
    } else if (ch.armPose === 'wave') {
      ch.arms[1].rotation.z = damp(ch.arms[1].rotation.z, 2.5 + Math.sin(t * 9) * 0.35, 10, dt);
      ch.arms[0].rotation.z = damp(ch.arms[0].rotation.z, 0, 8, dt);
    } else {
      for (const a of ch.arms) a.rotation.z = damp(a.rotation.z, 0, 8, dt);
    }
  });
}

function taxiCap(head, y, color = 0xffc21a, backwards = false, scale = 1) {
  const g = new THREE.Group();
  g.position.set(0, y, 0);
  g.scale.setScalar(scale);
  head.add(g);
  part(g, new THREE.CylinderGeometry(0.15, 0.17, 0.09, 16), toon(color), [0, 0.04, 0]);
  part(g, new THREE.CylinderGeometry(0.155, 0.155, 0.02, 16), toon(0x111111), [0, 0.0, 0]);
  const brim = part(g, new THREE.BoxGeometry(0.2, 0.02, 0.12), toon(0x111111), [0, -0.005, backwards ? 0.19 : -0.19]);
  brim.rotation.x = backwards ? -0.2 : 0.2;
  return g;
}

// ---------- Species ----------
const BUILDERS = {
  croc(c, o) {
    const green = 0x3f9b4a, belly = 0xbfe08e;
    if (o.standing) standingBody(c, { shirt: o.shirt ?? 0x7a3fb0, fur: green, hands: o.hands , h: o.h ?? 1 });
    else seatedBody(c, { shirt: o.shirt ?? 0x7a3fb0, fur: green, hands: o.hands });
    const gm = toon(green), bm = toon(belly);
    const h = c.head;
    part(h, S(0.19), gm, [0, 0.03, 0.02], [0, 0, 0], [1.05, 0.8, 1.15]);
    part(h, new THREE.BoxGeometry(0.25, 0.1, 0.42), gm, [0, 0.0, -0.3]);
    part(h, S(0.13), gm, [0, 0.0, -0.5], [0, 0, 0], [1, 0.42, 0.7]);
    for (const s of [-1, 1]) part(h, S(0.025, 6, 5), toon(0x1a3a1a), [s * 0.05, 0.05, -0.56]);
    // bumps
    for (let i = 0; i < 4; i++) part(h, S(0.03, 6, 5), toon(0x2f7a3a), [0, 0.13 - i * 0.01, 0.12 + i * 0.06]);
    // teeth (upper)
    const tooth = new THREE.ConeGeometry(0.018, 0.05, 5);
    const toothMat = unlit(0xd6d6c8);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) part(h, tooth, toothMat, [s * 0.11, -0.06, -0.14 - i * 0.07], [Math.PI, 0, 0]);
    // jaw
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.05, -0.05);
    h.add(jaw);
    part(jaw, new THREE.BoxGeometry(0.23, 0.06, 0.46), bm, [0, -0.02, -0.24]);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) part(jaw, tooth, toothMat, [s * 0.1, 0.03, -0.12 - i * 0.08]);
    c.jaw = jaw;
    c.jawOpenMax = 0.45;
    // eyes on top bumps
    for (const s of [-1, 1]) {
      part(h, S(0.07), gm, [s * 0.09, 0.12, -0.06], [0, 0, 0], [1, 0.8, 1]);
      const e = eye(h, s * 0.09, 0.15, -0.1, 0.05, { iris: 0xf0c020, slit: true, lidColor: green });
      c.lids.push(e.lid);
    }
    c.baseLidRot = 0.05;
    // sunglasses on forehead + cap
    const glasses = new THREE.Group();
    glasses.position.set(0, 0.2, -0.02);
    glasses.rotation.x = -0.4;
    h.add(glasses);
    for (const s of [-1, 1]) part(glasses, new THREE.CylinderGeometry(0.055, 0.055, 0.015, 14), unlit(0x111111), [s * 0.07, 0, -0.09], [Math.PI / 2, 0, 0]);
    part(glasses, new THREE.BoxGeometry(0.26, 0.015, 0.015), toon(0xffd23f), [0, 0.02, -0.09]);
    taxiCap(h, 0.16, 0xffc21a, true);
  },

  roo(c, o) {
    const fur = 0xc98a4b, light = 0xf2d6ac;
    if (o.standing) standingBody(c, { shirt: o.shirt ?? 0xff5aa8, fur, hands: o.hands , h: o.h ?? 1 });
    else seatedBody(c, { shirt: o.shirt ?? 0xff5aa8, fur, hands: o.hands });
    const fm = toon(fur), lm = toon(light);
    const h = c.head;
    part(h, S(0.16), fm, [0, 0.06, 0], [0, 0, 0], [1, 1, 1.1]);
    part(h, S(0.1), fm, [0, 0.0, -0.16], [0.1, 0, 0], [0.95, 0.85, 1.6]);
    part(h, S(0.08), lm, [0, -0.04, -0.2], [0, 0, 0], [0.9, 0.6, 1.3]);
    part(h, S(0.035, 8, 6), unlit(0x1a0f0a), [0, 0.02, -0.33], [0, 0, 0], [1.3, 0.9, 1]);
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.06, -0.1);
    h.add(jaw);
    part(jaw, S(0.06), lm, [0, -0.02, -0.12], [0, 0, 0], [0.9, 0.5, 1.3]);
    c.jaw = jaw;
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(s * 0.08, 0.2, 0.04);
      ear.rotation.z = -s * 0.25;
      h.add(ear);
      part(ear, new THREE.ConeGeometry(0.055, 0.26, 10), fm, [0, 0.12, 0], [0, 0, 0], [1, 1, 0.45]);
      part(ear, new THREE.ConeGeometry(0.035, 0.2, 8), toon(0xffa0b4), [0, 0.11, -0.012], [0, 0, 0], [1, 1, 0.3]);
      c.extras.push((dt, t) => { ear.rotation.x = Math.sin(t * 3 + s) * 0.08; });
      const e = eye(h, s * 0.07, 0.09, -0.11, 0.05, { lidColor: fur, pupilScale: 0.65 });
      c.lids.push(e.lid);
      part(h, new THREE.BoxGeometry(0.05, 0.008, 0.01), BLACK, [s * 0.09, 0.14, -0.14], [0, 0, s * 0.4]);
    }
    // trucker cap on backwards
    taxiCap(h, 0.19, 0xff3d8b, true, 0.95);
    // pouch
    part(c.torso, S(0.14), lm, [0, 0.2, -0.13], [0, 0, 0], [1.1, 0.8, 0.6]);
  },

  gorilla(c, o) {
    const fur = 0x2b2b32, skin = 0x5d4c46;
    if (o.standing) standingBody(c, { shirt: o.shirt ?? 0x191919, fur, skin, broad: 1.35, hands: o.hands, neckY: 0.66 , h: o.h ?? 1 });
    else seatedBody(c, { shirt: o.shirt ?? 0x191919, fur, skin, broad: 1.35, hands: o.hands, neckY: 0.66 });
    const fm = toon(fur), sm = toon(skin);
    const h = c.head;
    part(h, S(0.21), fm, [0, 0.05, 0], [0, 0, 0], [1.05, 1, 1]);
    part(h, S(0.12), fm, [0, 0.2, 0.05], [0, 0, 0], [1, 0.9, 1.4]);
    part(h, S(0.16), sm, [0, 0.0, -0.13], [0, 0, 0], [1.05, 1, 0.7]);
    part(h, new THREE.BoxGeometry(0.3, 0.06, 0.1), fm, [0, 0.1, -0.2], [0.2, 0, 0]);
    part(h, S(0.1), sm, [0, -0.07, -0.21], [0, 0, 0], [1.3, 0.85, 0.9]);
    for (const s of [-1, 1]) {
      part(h, S(0.022, 6, 5), BLACK, [s * 0.035, -0.04, -0.3], [0, 0, 0], [1.3, 0.8, 1]);
      part(h, S(0.05), sm, [s * 0.21, 0.03, 0.0], [0, 0, 0], [0.6, 1, 1]);
      eye(h, s * 0.07, 0.05, -0.22, 0.032, { pupil: 0x3a1f0f, pupilScale: 0.7 });
    }
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.1, -0.12);
    h.add(jaw);
    part(jaw, S(0.09), sm, [0, -0.04, -0.08], [0, 0, 0], [1.25, 0.6, 0.9]);
    c.jaw = jaw;
    c.jawOpenMax = 0.3;
    // toothpick
    part(jaw, new THREE.CylinderGeometry(0.005, 0.005, 0.14, 4), toon(0xe8d49a), [0.08, -0.02, -0.18], [Math.PI / 2, 0.4, 0]);
    // beanie
    part(h, new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x8a1a2a), [0, 0.18, 0.02], [0, 0, 0], [1.05, 0.8, 1.05]);
    part(h, new THREE.TorusGeometry(0.19, 0.035, 8, 20), toon(0x6a1020), [0, 0.18, 0.02], [Math.PI / 2, 0, 0], [1.05, 1.05, 1]);
    // gold chain
    part(c.torso, new THREE.TorusGeometry(0.17, 0.02, 6, 20), toon(0xffd23f, { emissive: 0x442200 }), [0, 0.55, -0.04], [Math.PI / 2 - 0.4, 0, 0]);
  },

  sloth(c, o) {
    const fur = 0x9a8568, mask = 0xefe0c2, stripe = 0x3a2a1c;
    if (o.standing) standingBody(c, { shirt: o.shirt ?? 0x141418, fur, hands: o.hands , h: o.h ?? 1 });
    else seatedBody(c, { shirt: o.shirt ?? 0x141418, fur, hands: o.hands });
    // tux shirt front and bow tie
    part(c.torso, S(0.12), toon(0xf4f4f4), [0, 0.38, -0.13], [0, 0, 0], [0.8, 1.3, 0.5]);
    part(c.torso, new THREE.ConeGeometry(0.04, 0.08, 4), toon(0xd8203a), [-0.04, 0.54, -0.17], [0, 0, Math.PI / 2]);
    part(c.torso, new THREE.ConeGeometry(0.04, 0.08, 4), toon(0xd8203a), [0.04, 0.54, -0.17], [0, 0, -Math.PI / 2]);
    const fm = toon(fur), mm = toon(mask);
    const h = c.head;
    part(h, S(0.18), fm, [0, 0.03, 0], [0, 0, 0], [1.05, 1, 1]);
    part(h, S(0.15), mm, [0, 0.0, -0.1], [0, 0, 0], [1.05, 0.88, 0.7]);
    for (const s of [-1, 1]) {
      part(h, S(0.05), toon(stripe), [s * 0.075, 0.0, -0.18], [0, 0, s * 0.55], [1.7, 0.75, 0.5]);
      const e = eye(h, s * 0.065, 0.01, -0.2, 0.028, { lidColor: stripe });
      c.lids.push(e.lid);
    }
    part(h, S(0.035, 8, 6), unlit(0x1a120c), [0, -0.05, -0.23], [0, 0, 0], [1.3, 0.9, 1]);
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.09, -0.19);
    h.add(jaw);
    part(jaw, new THREE.TorusGeometry(0.05, 0.01, 6, 12, Math.PI), unlit(0x3a2a1c), [0, 0.02, 0], [0, 0, Math.PI]);
    c.jaw = jaw;
    c.jawOpenMax = 0.2;
    for (let i = 0; i < 5; i++) part(h, S(0.05, 6, 5), fm, [(i - 2) * 0.05, 0.18 + Math.sin(i) * 0.02, 0.02], [0, 0, 0], [1, 1.4, 1]);
    c.sleepy = true;
    c.speedMul = 0.45;
  },

  tortoise(c, o) {
    const skin = 0x8aa06a;
    const sm = toon(skin);
    if (o.standing) standingBody(c, { shirt: 0x6d5a8a, fur: skin, h: 0.9 });
    else seatedBody(c, { shirt: 0x6d5a8a, fur: skin, hands: 'lap' });
    // shell on the back
    const shellTex = drawTexture(128, 128, (g) => {
      g.fillStyle = '#5a4a2a'; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#c8a860'; g.lineWidth = 4;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
        const cx = x * 30 + (y % 2) * 15, cy = y * 26;
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13); }
        g.closePath(); g.stroke();
      }
    });
    const shellMat = new THREE.MeshToonMaterial({ map: shellTex, gradientMap: toonGradient() });
    part(c.torso, S(0.3, 16, 12), shellMat, [0, 0.36, 0.12], [0, 0, 0], [1, 1.1, 0.7]);
    const h = c.head;
    part(h, S(0.14), sm, [0, 0.02, -0.03], [0, 0, 0], [1, 0.95, 1.2]);
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.05, -0.1);
    h.add(jaw);
    part(jaw, S(0.07), sm, [0, -0.01, -0.06], [0, 0, 0], [1.1, 0.5, 1]);
    c.jaw = jaw;
    for (const s of [-1, 1]) {
      eye(h, s * 0.06, 0.05, -0.14, 0.035, {});
      part(h, new THREE.TorusGeometry(0.05, 0.008, 6, 16), toon(0xd04080), [s * 0.06, 0.05, -0.17]);
    }
    part(h, new THREE.BoxGeometry(0.03, 0.006, 0.006), toon(0xd04080), [0, 0.05, -0.17]);
    // headset
    part(h, new THREE.TorusGeometry(0.15, 0.012, 6, 20, Math.PI), toon(0x222222), [0, 0.03, 0], [0, Math.PI / 2, 0]);
    part(h, S(0.04), toon(0x222222), [0.15, 0.02, 0], [0, 0, 0], [0.5, 1, 1]);
    part(h, new THREE.CylinderGeometry(0.006, 0.006, 0.14, 4), toon(0x222222), [0.12, -0.05, -0.08], [1.1, 0, 0]);
    part(h, S(0.018, 6, 5), glowMat(0xff3d8b, 2), [0.1, -0.08, -0.14]);
    // curlers
    for (let i = 0; i < 3; i++) part(h, new THREE.CylinderGeometry(0.025, 0.025, 0.09, 8), toon(0xff9ac8), [(i - 1) * 0.06, 0.15, 0.0], [0, 0, Math.PI / 2]);
  },

  kid(c, o) {
    // small critter with a propeller hat; o.species: 'roo' | 'bunny' | 'penguin' | 'fox'
    const kind = o.species || 'roo';
    const pal = { roo: [0xc98a4b, 0xf2d6ac], bunny: [0xf0f0f0, 0xffc8d8], penguin: [0x1a1a24, 0xf4f4f4], fox: [0xf07a2a, 0xfff0e0] }[kind];
    standingBody(c, { shirt: o.shirt ?? pal[1], fur: pal[0], h: 0.55 });
    const fm = toon(pal[0]), lm = toon(pal[1]);
    const h = c.head;
    h.scale.setScalar(0.85);
    part(h, S(0.17), fm, [0, 0.03, 0]);
    part(h, S(0.1), lm, [0, -0.03, -0.12], [0, 0, 0], [1.1, 0.8, 0.8]);
    for (const s of [-1, 1]) {
      eye(h, s * 0.065, 0.05, -0.13, 0.05, { pupilScale: 0.68 });
      if (kind === 'roo' || kind === 'bunny') {
        part(h, new THREE.ConeGeometry(0.05, kind === 'bunny' ? 0.3 : 0.2, 8), fm, [s * 0.07, 0.24, 0.02], [0, 0, -s * 0.2], [1, 1, 0.45]);
      } else if (kind === 'fox') {
        part(h, new THREE.ConeGeometry(0.06, 0.14, 4), fm, [s * 0.09, 0.19, 0.0], [0, 0, -s * 0.2]);
      }
    }
    if (kind === 'penguin') part(h, new THREE.ConeGeometry(0.04, 0.1, 6), toon(0xffa020), [0, -0.02, -0.19], [-Math.PI / 2, 0, 0]);
    else part(h, S(0.025, 6, 5), BLACK, [0, 0.0, -0.21]);
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.07, -0.13);
    h.add(jaw);
    part(jaw, S(0.03, 6, 5), unlit(0x5a1020), [0, -0.01, -0.02], [0, 0, 0], [1.5, 0.6, 0.6]);
    c.jaw = jaw;
    // propeller hat
    const hat = new THREE.Group();
    hat.position.set(0, 0.15, 0);
    h.add(hat);
    const hc = o.hat ?? 0x3adf5a;
    part(hat, new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(hc));
    part(hat, new THREE.CylinderGeometry(0.008, 0.008, 0.08, 4), toon(0x888888), [0, 0.14, 0]);
    const prop = new THREE.Group();
    prop.position.set(0, 0.18, 0);
    hat.add(prop);
    part(prop, new THREE.BoxGeometry(0.26, 0.008, 0.04), toon(0xffd23f));
    part(prop, new THREE.BoxGeometry(0.04, 0.008, 0.26), toon(0xff3d8b));
    c.extras.push((dt) => { prop.rotation.y += dt * (c.walking ? 30 : 8); });
    c.maxYaw = 1.2;
  },

  sheep(c, o) {
    standingBody(c, { shirt: 0xf2f0ea, fur: 0x1c1c22, h: 0.9 });
    const wool = toon(0xf2f0ea);
    for (let i = 0; i < 9; i++) part(c.torso, S(0.13), wool, [Math.cos(i) * 0.14, 0.2 + (i % 3) * 0.14, Math.sin(i * 2) * 0.1]);
    const h = c.head;
    part(h, S(0.12), toon(0x1c1c22), [0, 0, -0.04], [0, 0, 0], [0.9, 1, 1.3]);
    for (let i = 0; i < 4; i++) part(h, S(0.07), wool, [(i - 1.5) * 0.06, 0.1, 0.02]);
    for (const s of [-1, 1]) {
      eye(h, s * 0.055, 0.03, -0.14, 0.03, { iris: 0xd8c040, slit: true });
      part(h, S(0.06), toon(0x1c1c22), [s * 0.14, 0.02, 0.0], [0, 0, s * 0.8], [1.3, 0.5, 0.6]);
    }
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.08, -0.1);
    h.add(jaw);
    part(jaw, S(0.05), toon(0x2a2a30), [0, 0, -0.04], [0, 0, 0], [1, 0.5, 1]);
    c.jaw = jaw;
  },

  robot(c, o) {
    // Clerk / teller robot. o.face: canvas texture key
    const metal = toon(o.color ?? 0xd8dce8);
    if (o.standing !== false) standingBody(c, { shirt: o.shirt ?? 0xd8203a, fur: o.color ?? 0xd8dce8, h: 1 });
    const h = c.head;
    part(h, new THREE.BoxGeometry(0.34, 0.28, 0.28), metal, [0, 0.02, 0]);
    const faceTex = drawTexture(128, 96, () => {});
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTex, color: new THREE.Color(1.5, 1.5, 1.5) });
    part(h, new THREE.PlaneGeometry(0.28, 0.2), faceMat, [0, 0.02, -0.142], [0, Math.PI, 0]);
    part(h, new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4), metal, [0, 0.2, 0]);
    part(h, S(0.03), glowMat(0xff3040, 3), [0, 0.27, 0]);
    if (o.cap) taxiCap(h, 0.16, o.cap, false, 1.2);
    c.face = (expr = '^_^', color = '#33f0ff') => {
      const g = faceTex.userData.ctx;
      g.fillStyle = '#0a0f18'; g.fillRect(0, 0, 128, 96);
      neonText(g, expr, 64, 50, color, 40, { font: FONT_DISPLAY, maxW: 116 });
      faceTex.needsUpdate = true;
    };
    c.face();
    c.maxYaw = 1.4;
  },

  securibot(c) {
    const metal = toon(0x3a3f55);
    c.torso.position.y = 0.3;
    part(c.torso, new THREE.CapsuleGeometry(0.28, 0.5, 6, 12), metal, [0, 0.5, 0]);
    part(c.torso, new THREE.BoxGeometry(0.3, 0.2, 0.05), glowMat(0x33f0ff, 1.5), [0, 0.6, -0.27]);
    part(c.body, new THREE.CylinderGeometry(0.3, 0.36, 0.2, 16), toon(0x22242e), [0, 0.12, 0]);
    part(c.body, new THREE.CylinderGeometry(0.34, 0.34, 0.03, 16), glowMat(0x33f0ff, 2), [0, 0.02, 0]);
    c.headPivot.position.set(0, 1.35, 0);
    const h = c.head;
    part(h, new THREE.SphereGeometry(0.24, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal);
    c.visor = part(h, new THREE.BoxGeometry(0.36, 0.07, 0.1), glowMat(0xff2030, 3, { unique: true }), [0, 0.08, -0.18]);
    part(h, new THREE.CylinderGeometry(0.05, 0.07, 0.1, 8), toon(0xffd23f), [0, 0.26, 0]);
    c.siren = part(h, S(0.06), glowMat(0xff2030, 4, { unique: true }), [0, 0.33, 0]);
    c.maxYaw = 0;
  },

  flamingo(c) {
    const pink = toon(0xff7ab8), light = toon(0xffc0dc), dark = toon(0x1a1a1a), legM = toon(0xe86a9a);
    // Standing on one leg, obviously.
    const hip = new THREE.Vector3(0, 1.0, 0.05);
    limb(c.body, hip, new THREE.Vector3(0, 0.5, 0.02), 0.025, legM);
    limb(c.body, new THREE.Vector3(0, 0.5, 0.02), new THREE.Vector3(0, 0.03, 0), 0.025, legM);
    part(c.body, S(0.07), legM, [0, 0.02, -0.05], [0, 0, 0], [1, 0.3, 1.6]);
    limb(c.body, new THREE.Vector3(0.06, 1.0, 0.08), new THREE.Vector3(0.08, 0.72, -0.12), 0.022, legM);
    limb(c.body, new THREE.Vector3(0.08, 0.72, -0.12), new THREE.Vector3(0.07, 0.9, 0.1), 0.022, legM);
    c.torso.position.set(0, 1.15, 0.05);
    part(c.torso, S(0.24), pink, [0, 0, 0], [0.25, 0, 0], [1, 0.75, 1.45]);
    part(c.torso, new THREE.ConeGeometry(0.12, 0.3, 8), pink, [0, 0.05, 0.36], [-1.2, 0, 0]);
    for (const sx of [-1, 1]) part(c.torso, S(0.17), light, [sx * 0.2, 0.02, 0.05], [0.2, 0, 0], [0.35, 0.6, 1.3]);
    // S-curved neck
    const neck = [[0, 0.2, -0.28], [0, 0.35, -0.34], [0, 0.48, -0.28], [0, 0.58, -0.2], [0, 0.7, -0.2]];
    for (const [x, y, z] of neck) part(c.torso, S(0.055), pink, [x, y, z]);
    c.headPivot.position.set(0, 1.15 + 0.8, -0.2 + 0.05);
    const h = c.head;
    part(h, S(0.1), pink, [0, 0, 0], [0, 0, 0], [0.9, 0.95, 1.1]);
    const beak = new THREE.Group();
    beak.position.set(0, -0.02, -0.08);
    h.add(beak);
    part(beak, new THREE.CylinderGeometry(0.035, 0.028, 0.12, 8), light, [0, 0, -0.05], [Math.PI / 2, 0, 0]);
    part(beak, new THREE.ConeGeometry(0.028, 0.1, 8), dark, [0, -0.04, -0.13], [Math.PI * 0.8, 0, 0]);
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.03, -0.05);
    h.add(jaw);
    part(jaw, new THREE.BoxGeometry(0.03, 0.01, 0.08), dark, [0, -0.01, -0.04]);
    c.jaw = jaw;
    for (const sx of [-1, 1]) eye(h, sx * 0.065, 0.03, -0.04, 0.025, { iris: 0xffd23f });
    // doctor's head mirror
    part(h, new THREE.CylinderGeometry(0.05, 0.05, 0.01, 16), glowMat(0xdde8ff, 1.2), [0, 0.08, -0.08], [1.2, 0, 0]);
    part(h, new THREE.TorusGeometry(0.1, 0.008, 4, 20), toon(0x333333), [0, 0.04, 0], [Math.PI / 2 - 0.3, 0, 0]);
    c.maxYaw = 1.4;
    c.extras.push((dt, t) => { c.body.position.y = Math.sin(t * 1.3) * 0.01; });
  },

  sweeper(c) {
    const metal = toon(0x5a8ab8);
    c.torso.position.y = 0.1;
    part(c.torso, new THREE.CylinderGeometry(0.28, 0.32, 0.5, 16), metal, [0, 0.25, 0]);
    part(c.torso, new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), glowMat(0x6dff8a, 1.6), [0, 0.02, 0]);
    c.headPivot.position.set(0, 0.62, 0);
    part(c.head, new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xd8dce8));
    part(c.head, S(0.07), glowMat(0x33f0ff, 2.5), [0, 0.1, -0.2]);
    const broom = new THREE.Group();
    broom.position.set(0.3, 0.35, -0.1);
    c.body.add(broom);
    part(broom, new THREE.CylinderGeometry(0.015, 0.015, 0.9, 5), toon(0xb88a5a), [0, 0, -0.25], [1.1, 0, 0]);
    part(broom, new THREE.BoxGeometry(0.25, 0.12, 0.06), toon(0xe8c860), [0, -0.3, -0.55], [0.4, 0, 0]);
    c.extras.push((dt, t) => { broom.rotation.y = Math.sin(t * 6) * 0.5; });
    c.maxYaw = 1;
  },

  mayor(c) {
    const metal = toon(0xb8c0d0);
    const dark = toon(0x40485a);
    standingBody(c, { shirt: 0x2a2f45, fur: 0xb8c0d0, h: 1.45 });
    // cape + sash
    part(c.body, new THREE.PlaneGeometry(0.9, 1.3), toon(0xb0182a, { side: THREE.DoubleSide }), [0, 1.2, 0.24], [0.1, 0, 0]);
    part(c.torso, new THREE.BoxGeometry(0.08, 0.7, 0.4), toon(0xffd23f), [0, 0.35, -0.02], [0, 0, 0.7]);
    const h = c.head;
    h.scale.setScalar(1.5);
    part(h, new THREE.BoxGeometry(0.42, 0.34, 0.34), metal, [0, 0.02, 0]);
    for (const s of [-1, 1]) part(h, new THREE.ConeGeometry(0.1, 0.18, 4), metal, [s * 0.14, 0.25, 0], [0, Math.PI / 4, s * -0.2]);
    const faceTex = drawTexture(160, 128, () => {});
    part(h, new THREE.PlaneGeometry(0.36, 0.26), new THREE.MeshBasicMaterial({ map: faceTex, color: new THREE.Color(1.6, 1.6, 1.6) }), [0, 0.02, -0.172], [0, Math.PI, 0]);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) part(h, new THREE.BoxGeometry(0.22, 0.008, 0.008), dark, [s * 0.3, -0.02 + (k - 1) * 0.04, -0.15], [0, 0, s * (k - 1) * 0.15]);
    part(h, new THREE.CylinderGeometry(0.15, 0.15, 0.12, 16), toon(0x111111), [0, 0.24, 0.05]);
    part(h, new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16), toon(0x111111), [0, 0.18, 0.05]);
    c.face = (expr = '=^_^=', color = '#33f0ff') => {
      const g = faceTex.userData.ctx;
      g.fillStyle = '#060a12'; g.fillRect(0, 0, 160, 128);
      neonText(g, expr, 80, 64, color, 44, { font: FONT_DISPLAY, maxW: 146 });
      for (let y = 0; y < 128; y += 4) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, 160, 2); }
      faceTex.needsUpdate = true;
    };
    c.face();
    c.maxYaw = 1.0;
  },
};

export const CAST = {
  carl: { kind: 'croc', name: 'Carl', species: 'Crocodile · Cabbie, 40 years', voice: 'croc', portrait: 'carl' },
  sheila: { kind: 'roo', name: 'Sheila', species: 'Kangaroo · Cabbie & Mum', voice: 'roo', portrait: 'sheila' },
  gary: { kind: 'gorilla', name: 'Gary', species: 'Gorilla · Cabbie, Ex-Banana Farmer', voice: 'gorilla', portrait: 'gary' },
  lenny: { kind: 'sloth', name: 'Lenny', species: 'Sloth · Cabbie, Groom-to-be', voice: 'sloth', portrait: 'lenny', speed: 0.3 },
  doris: { kind: 'tortoise', name: 'Doris', species: 'Tortoise · Dispatcher, Rank 7', voice: 'tortoise', portrait: 'doris' },
  kevin: { kind: 'kid', name: 'Kevin', species: 'Joey · Age 4', voice: 'kid', portrait: 'kevin', opts: { species: 'roo', hat: 0x3adf5a, shirt: 0xffd23f } },
  linda: { kind: 'sloth', name: 'Linda', species: 'Sloth · Bride, Very Patient', voice: 'sloth', portrait: 'linda', speed: 0.3 },
  mayor: { kind: 'mayor', name: 'Mayor Mechawhiskers', species: 'Robot Cat · Mayor', voice: 'mayor', portrait: 'mayor' },
  clerk: { kind: 'robot', name: 'SNACK-BOT 9000', species: 'McSnackers Crew Member', voice: 'robot', portrait: 'clerk', opts: { cap: 0xd8203a } },
  teller: { kind: 'robot', name: 'TELL-R', species: 'Bank Teller Unit', voice: 'robot', portrait: 'teller', opts: { color: 0xc8b070, shirt: 0x2a3a6a } },
  flamingo: { kind: 'flamingo', name: 'Dr. Plumeria', species: 'Flamingo · Carl\'s Doctor', voice: 'roo', portrait: 'flamingo' },
  sweep: { kind: 'sweeper', name: 'SWEEP-E', species: 'Janitor Unit · Rank 7', voice: 'robot', portrait: null },
  you: { name: 'You', species: '', voice: 'you', portrait: null },
};

export function createCharacter(kindOrId, opts = {}) {
  const cast = CAST[kindOrId];
  const kind = cast ? cast.kind : kindOrId;
  const o = { ...(cast?.opts || {}), ...opts };
  const c = new Character({ name: cast?.name || kind });
  BUILDERS[kind](c, o);
  if (kindOrId === 'linda') {
    // veil + flower
    part(c.head, new THREE.ConeGeometry(0.24, 0.5, 16, 1, true), new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, gradientMap: toonGradient() }), [0, -0.02, 0.12], [0.3, 0, 0]);
    part(c.head, S(0.04), toon(0xff5aa8), [0.12, 0.16, -0.02]);
    c.torso.children[0].material = toon(0xf8f4ff);
  }
  c.cast = cast;
  return c;
}
