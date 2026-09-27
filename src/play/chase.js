import * as THREE from 'three';
import { toon, glowMat } from '../core/textures.js';
import { createTaxi } from '../world/taxi.js';
import { clamp, damp, rand } from '../core/util.js';

function bananaMesh() {
  const g = new THREE.Group();
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 14, Math.PI * 0.75), toon(0xffd84a));
  arc.rotation.z = Math.PI * 0.1;
  g.add(arc);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), toon(0x5a3a1a));
  tip.position.set(0.22, 0.02, 0);
  g.add(tip);
  return g;
}

function kevinBall() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), toon(0xc98a4b)));
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x3adf5a));
  hat.position.y = 0.2;
  g.add(hat);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xdcdcdc }));
    e.position.set(s * 0.12, 0.08, -0.3);
    g.add(e);
  }
  return g;
}

function policeDrone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), toon(0x1c2a5a));
  body.scale.set(1.3, 0.5, 1.7);
  g.add(body);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), glowMat(0x88e8ff, 1.2));
  canopy.position.set(0, 0.35, -0.3);
  canopy.scale.set(1, 0.7, 1.3);
  g.add(canopy);
  const red = glowMat(0xff2030, 4, { unique: true });
  const blue = glowMat(0x2050ff, 4, { unique: true });
  const r = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), red); r.position.set(-0.35, 0.6, 0.2); g.add(r);
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), blue); b.position.set(0.35, 0.6, 0.2); g.add(b);
  const rotors = [];
  for (const [x, z] of [[-1.5, -1], [1.5, -1], [-1.5, 1], [1.5, 1]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 16), toon(0x333a55));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0, z);
    g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), glowMat(0x66ccff, 1.1, { transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0, z);
    g.add(disc);
    rotors.push(disc);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), glowMat(0xff3040, 3, { unique: true }));
  eye.position.set(0, -0.1, -1.6);
  g.add(eye);
  g.userData = { red, blue, eye, rotors, radius: 2.2 };
  return g;
}

function roboCab() {
  const t = createTaxi({ robo: true });
  const g = new THREE.Group();
  t.root.rotation.y = Math.PI; // face the player's taxi (they chase from behind)
  g.add(t.root);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), glowMat(0xff3040, 3, { unique: true }));
  eye.position.set(0, 1.0, 2.8);
  g.add(eye);
  g.userData = { eye, taxi: t, radius: 2.8 };
  return g;
}

export class Chase {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.group = new THREE.Group();
    this.ray = new THREE.Raycaster();
    this.tmpM = new THREE.Matrix4();
  }

  begin({ kind = 'police', total = 8, maxAlive = 3, dmg = 0.09, special = null, hp = 2, taxiHp = 1 } = {}) {
    const g = this.game;
    this.kind = kind;
    this.total = total;
    this.maxAlive = maxAlive;
    this.dmg = dmg * (1 - (g.state.stat('nerve') - 1) * 0.06);
    this.special = special;
    this.hp = hp;
    this.enemies = [];
    this.shots = [];
    this.kills = 0;
    this.spawned = 0;
    this.damage = 1 - taxiHp;
    this.cool = 0;
    this.specialCool = 0;
    this.spawnT = 1.2;
    this.t = 0;
    this.finished = false;
    this.active = true;
    g.taxi.root.add(this.group);
    g.taxi.setInside(false);
    g.taxi.setDoor(false);
    const ride = g.ride;
    ride.camOffset = new THREE.Vector3(1.25, 0.62, -0.5);
    ride.lookOverride = { yaw: Math.PI + 0.22, pitch: -0.06, follow: true };
    g.canvas.style.cursor = 'crosshair';
    g.addSystem(this);
    this.hitFlash = document.getElementById('hitflash') || (() => {
      const d = document.createElement('div');
      d.id = 'hitflash';
      d.style.cssText = 'position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 160px 40px rgba(255,30,60,0.9);opacity:0;transition:opacity 0.35s;z-index:5';
      document.getElementById('app').appendChild(d);
      return d;
    })();
    this.refreshHud();
    return new Promise((res) => { this.done = res; });
  }

  end() {
    const g = this.game;
    this.active = false;
    g.removeSystem(this);
    for (const e of this.enemies) this.group.remove(e.obj);
    for (const s of this.shots) this.group.remove(s.obj);
    this.enemies = [];
    this.shots = [];
    g.taxi.root.remove(this.group);
    g.taxi.setDoor(false);
    g.taxi.setInside(true);
    g.ride.camOffset = null;
    g.ride.lookOverride = null;
    g.canvas.style.cursor = '';
    g.ui.meter('taxi', { value: null });
    g.ui.meter('kills', { value: null });
    g.audio.siren(false);
  }

  refreshHud() {
    const ui = this.game.ui;
    ui.meter('kills', { label: this.kind === 'police' ? 'DRONES BANANA\'D' : 'ROBOCABS BONKED', value: this.kills / this.total, color: '#ffd23f', right: `${this.kills}/${this.total}` });
    ui.meter('taxi', { label: 'TAXI DAMAGE', value: this.damage, color: '#ff4d4d', right: `${Math.round(this.damage * 100)}%` });
  }

  spawnEnemy() {
    const obj = this.kind === 'police' ? policeDrone() : roboCab();
    const slot = new THREE.Vector3(rand(-3, 13), rand(-1, 7), rand(15, 28));
    obj.position.set(slot.x * 2, slot.y + rand(-4, 8), 90);
    this.group.add(obj);
    this.enemies.push({ obj, slot, hp: this.hp, state: 'approach', t: rand(1.5, 3), phase: rand(0, 10), stun: 0, dying: 0, spin: 0 });
    this.spawned++;
    if (this.kind === 'police') this.game.audio.siren(true);
  }

  aimRay() {
    const g = this.game;
    const m = g.input.mouse;
    this.ray.setFromCamera(new THREE.Vector2(m.nx, m.ny), g.camera);
    const inv = this.tmpM.copy(g.taxi.root.matrixWorld).invert();
    const o = this.ray.ray.origin.clone().applyMatrix4(inv);
    const d = this.ray.ray.direction.clone().transformDirection(inv);
    return { o, d };
  }

  throwShot(kind = 'banana') {
    const g = this.game;
    const { o, d } = this.aimRay();
    const obj = kind === 'kevin' ? kevinBall() : bananaMesh();
    obj.position.copy(o).addScaledVector(d, 1.2);
    this.group.add(obj);
    const speed = kind === 'kevin' ? 45 : 58;
    this.shots.push({ obj, vel: d.clone().multiplyScalar(speed).add(new THREE.Vector3(0, 2.5, 0)), life: kind === 'kevin' ? 3.5 : 1.6, kind, bounces: 0, hitSet: new Set() });
    g.audio.play('throw');
    if (kind === 'kevin') g.audio.play('giggle');
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    const input = g.input;
    const st = g.state;
    this.t += dt;
    this.cool -= dt;
    this.specialCool -= dt;
    const talking = !!g.ui.line;
    if (!talking && input.mouse.clicked && this.cool <= 0) {
      this.throwShot('banana');
      this.cool = 0.34 - (st.stat('reflex') - 1) * 0.04;
    }
    if (!talking && this.special === 'kevin' && input.mouse.rclicked && this.specialCool <= 0) {
      this.throwShot('kevin');
      this.specialCool = 5;
    }
    if (this.special === 'kevin') g.ui.hint(this.specialCool > 0 ? `Kevin is recharging… ${Math.ceil(this.specialCool)}s` : '<span class="kbd">R-CLICK</span> THROW KEVIN (he insists)');

    // Spawning
    const alive = this.enemies.filter((e) => !e.dying).length;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && alive < this.maxAlive && this.spawned < this.total) {
      this.spawnEnemy();
      this.spawnT = rand(1.2, 2.6);
    }

    // Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const o = e.obj;
      const ud = o.userData;
      if (e.dying > 0) {
        e.dying -= dt;
        o.position.y -= (1.5 - e.dying) * 14 * dt;
        o.position.z += 10 * dt;
        o.rotation.z += dt * 8;
        o.rotation.x += dt * 3;
        if (e.dying <= 0) {
          const wp = o.getWorldPosition(new THREE.Vector3());
          g.fx.spawn(wp, { count: 22, color: 0xffa040, speed: 10, life: 0.8, size: 2.2 });
          g.fx.spawn(wp, { count: 12, color: 0xffffff, speed: 5, life: 0.5, size: 3 });
          g.audio.play('explode', { vol: 0.7 });
          this.group.remove(o);
          this.enemies.splice(i, 1);
        }
        continue;
      }
      e.phase += dt;
      const target = e.slot.clone().add(new THREE.Vector3(Math.sin(e.phase * 1.3) * 2.5, Math.sin(e.phase * 1.9) * 1.2, Math.sin(e.phase * 0.7) * 3));
      o.position.x = damp(o.position.x, target.x, 1.6, dt);
      o.position.y = damp(o.position.y, target.y, 1.6, dt);
      o.position.z = damp(o.position.z, target.z, e.state === 'approach' ? 1.0 : 1.8, dt);
      o.rotation.z = damp(o.rotation.z, (target.x - o.position.x) * -0.08, 4, dt);
      if (ud.rotors) for (const r of ud.rotors) r.rotation.z += dt * 30;
      if (ud.red) {
        const on = Math.floor(this.t * 6) % 2 === 0;
        ud.red.visible = on; ud.blue.visible = !on;
      }
      if (ud.taxi) ud.taxi.update(dt, 40);
      if (e.flash > 0) { e.flash -= dt; o.visible = Math.floor(e.flash * 30) % 2 === 0; } else o.visible = true;
      if (e.stun > 0) { e.stun -= dt; ud.eye.scale.setScalar(0.6); continue; }
      e.t -= dt;
      if (e.state === 'approach' && o.position.z < 40) { e.state = 'idle'; e.t = rand(1.0, 2.5); }
      else if (e.state === 'idle' && e.t <= 0) {
        e.state = 'charge';
        e.t = 1.5;
        g.audio.play('charge', { vol: 0.6 });
      } else if (e.state === 'charge') {
        const k = 1 - e.t / 1.5;
        ud.eye.scale.setScalar(1 + k * 2.5);
        if (e.t <= 0) {
          this.fire(e);
          e.state = 'idle';
          e.t = rand(2.2, 4.2) + (st.stat('nerve') - 1) * 0.3;
          ud.eye.scale.setScalar(1);
        }
      }
    }

    // Projectiles
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      s.vel.y -= 9 * dt;
      s.obj.position.addScaledVector(s.vel, dt);
      s.obj.rotation.z += dt * 18;
      s.obj.rotation.x += dt * 7;
      let hit = null;
      const bonus = (st.stat('reflex') - 1) * 0.3;
      for (const e of this.enemies) {
        if (e.dying || s.hitSet.has(e)) continue;
        if (e.obj.position.distanceTo(s.obj.position) < e.obj.userData.radius + bonus + (s.kind === 'kevin' ? 0.8 : 0)) { hit = e; break; }
      }
      if (hit) {
        this.hit(hit, s.kind === 'kevin' ? 2 : 1);
        if (s.kind === 'kevin' && s.bounces < 3) {
          s.hitSet.add(hit);
          s.bounces++;
          const next = this.enemies.find((e) => !e.dying && !s.hitSet.has(e));
          if (next) s.vel.copy(next.obj.position).sub(s.obj.position).setLength(40);
          else s.vel.set(0, 12, -30);
          g.audio.play('boing', { vol: 0.6 });
        } else {
          this.group.remove(s.obj);
          this.shots.splice(i, 1);
        }
        continue;
      }
      if (s.life <= 0) {
        this.group.remove(s.obj);
        this.shots.splice(i, 1);
      }
    }

    if (this.kills >= this.total && !this.finished) {
      this.finished = true;
      g.audio.siren(false);
      setTimeout(() => this.done({ win: true, damage: this.damage }), 600);
    }
  }

  hit(e, dmg) {
    const g = this.game;
    e.hp -= dmg;
    e.flash = 0.25;
    e.stun = e.state === 'charge' ? 0.9 : 0.3;
    if (e.state === 'charge') { e.state = 'idle'; e.t = rand(1.5, 3); e.obj.userData.eye.scale.setScalar(1); }
    e.obj.position.z += 3;
    const wp = e.obj.getWorldPosition(new THREE.Vector3());
    g.fx.spawn(wp, { count: 10, color: 0xffe060, speed: 8, life: 0.4, size: 0.9 });
    g.audio.play('splat', { vol: 0.8 });
    g.audio.play('hit', { vol: 0.7 });
    if (e.hp <= 0) {
      e.dying = 1.3;
      this.kills++;
      g.state.addCredits(this.kind === 'police' ? 0 : 5);
      this.refreshHud();
      if (this.onKill) this.onKill(this.kills);
      const alive = this.enemies.filter((x) => !x.dying).length;
      if (alive === 0 && this.spawned >= this.total) g.audio.siren(false);
    }
  }

  fire(e) {
    const g = this.game;
    const from = e.obj.position.clone();
    const to = new THREE.Vector3(rand(-0.8, 0.8), 1.2, rand(0.5, 2));
    const d = to.clone().sub(from);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, d.length(), 6, 1, true), glowMat(this.kind === 'police' ? 0x66aaff : 0xff3040, 4));
    beam.position.copy(from).addScaledVector(d, 0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    this.group.add(beam);
    setTimeout(() => this.group.remove(beam), 160);
    g.audio.play('zap');
    g.addShake(1.2);
    this.damage = clamp(this.damage + this.dmg, 0, 1);
    this.hitFlash.style.transition = 'none';
    this.hitFlash.style.opacity = '1';
    requestAnimationFrame(() => { this.hitFlash.style.transition = 'opacity 0.5s'; this.hitFlash.style.opacity = '0'; });
    this.refreshHud();
    if (this.onHurt) this.onHurt(this.damage);
    if (this.damage >= 1 && !this.finished) {
      this.finished = true;
      g.audio.siren(false);
      setTimeout(() => this.done({ win: false }), 400);
    }
  }
}
