import * as THREE from 'three';
import { Place } from './kit.js';
import { toon, glowMat, drawTexture, neonText, FONT_DISPLAY, lambert } from '../core/textures.js';
import { placeCenter, streetPos } from '../world/layout.js';
import { createCharacter } from '../world/characters.js';
import { clamp, damp, dampAngle, segmentHitsBoxXZ, rand } from '../core/util.js';

// ---------- Exterior (part of the skyline) ----------
export function buildBankExterior(game) {
  const P = new Place(game, 'bankExt');
  const c = placeCenter('bank');
  const gold = toon(0xe8b83a, { emissive: 0x2a1a00 });
  const marble = toon(0xd8d0e8);
  const dark = toon(0x2a2438);
  const cx = -339, cz = c.z;
  const add = (x, y0, z, w, h, d, m) => {
    P.box(x, y0, z, w, h, d, m, { collide: false });
    game.city.addCollider({ minX: x - w / 2, maxX: x + w / 2, minY: y0, maxY: y0 + h, minZ: z - d / 2, maxZ: z + d / 2, tag: 'bank' });
  };
  add(cx, 0, cz, 42, 44, 44, dark);
  add(cx, 44, cz, 40, 10, 42, lambert(0x5a7ab8, { emissive: 0x1a2a55 }));
  for (let i = 0; i < 8; i++) P.box(cx + 21, 44, cz - 18 + i * 5.1, 1.2, 10, 1.2, gold, { collide: false });
  add(cx, 54, cz, 38, 60, 40, marble);
  add(cx, 114, cz, 30, 30, 32, dark);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  dome.position.set(cx, 144, cz);
  P.group.add(dome);
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1, 32), glowMat(0xffd23f, 2));
  coin.rotation.x = Math.PI / 2;
  coin.position.set(cx, 166, cz);
  P.group.add(coin);
  P.updaters.push((dt) => { coin.rotation.z += dt * 0.8; });
  // gold bands
  for (const y of [44, 54, 114]) P.box(cx, y - 0.4, cz, 42.6, 0.8, 44.6, glowMat(0xffc21a, 1.4), { collide: false });
  P.sign('GALACTIC RESERVE BANK', cx + 19.3, 100, cz, Math.PI / 2, { w: 30, h: 5, color: '#ffd23f' });
  // Landing pad
  const padY = 46;
  P.box(-311.5, padY - 1, cz, 13, 1, 14, toon(0x3a3350));
  P.box(-311.5, padY - 0.02, cz, 11, 0.06, 12, glowMat(0xb8861a, 0.45), { collide: false });
  P.box(-311.5, padY + 0.02, cz, 12, 0.02, 1.6, toon(0xa01830), { collide: false });
  P.railing(-318, cz - 7, -305, cz - 7, padY, { color: 0xffd23f });
  P.railing(-318, cz + 7, -305, cz + 7, padY, { color: 0xffd23f });
  // Doors
  P.box(-318.2, padY, cz, 0.6, 5, 5, gold, { collide: false });
  const doorMat = new THREE.MeshBasicMaterial({ map: drawTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#1a1405'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd23f'; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24);
    g.beginPath(); g.moveTo(w / 2, 12); g.lineTo(w / 2, h - 12); g.stroke();
    neonText(g, '₡', w / 2, h / 2, '#ffd23f', 120);
  }), color: new THREE.Color(1.3, 1.3, 1.3) });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(4, 4.4), doorMat);
  door.position.set(-317.85, padY + 2.2, cz);
  door.rotation.y = Math.PI / 2;
  P.group.add(door);
  P.doorPos = new THREE.Vector3(-317.4, padY + 1.4, cz);
  P.padY = padY;
  P.colliders.push({ minX: -318.3, maxX: -317.9, minY: padY, maxY: padY + 5, minZ: cz - 7, maxZ: cz + 7, tag: 'wall' });
  P.killY = padY - 20;
  const lamp = new THREE.PointLight(0xffd08a, 80, 30, 1.5);
  lamp.position.set(-310, padY + 6, cz);
  P.group.add(lamp);

  P.dock = {
    pos: new THREE.Vector3(-303.4, padY - 0.3, cz),
    yaw: Math.PI,
    pre: new THREE.Vector3(-303.4, padY + 1, cz - 26),
    entry: new THREE.Vector3(streetPos(4), 72, cz - 26),
  };
  P.spawn = { pos: new THREE.Vector3(-307, padY, cz), yaw: Math.PI / 2 };
  game.scene.add(P.group);
  return P;
}

// ---------- Interior heist level ----------
const O = new THREE.Vector3(3000, 50, 3000);

export function buildBankInterior(game) {
  const P = new Place(game, 'bank');
  P.origin = O;
  P.killY = O.y - 20;
  const H = 6;
  const wallM = toon(0x6a5a8a);
  const marble = toon(0xe8e0f0);
  const gold = toon(0xe8b83a, { emissive: 0x2a1a00 });
  const L = (x, z) => new THREE.Vector3(O.x + x, O.y, O.z + z);
  // Local-coordinate box helper
  const B = (x0, z0, x1, z1, y0, h, mat, opts = {}) => {
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    return P.box(O.x + (x0 + x1) / 2, O.y + y0, O.z + (z0 + z1) / 2, w, h, d, mat, opts);
  };
  const wall = (x0, z0, x1, z1) => B(x0, z0, x1, z1, 0, H, wallM, { tag: 'wall' });

  // Floors
  const floorTex = drawTexture(256, 256, (g, w) => {
    g.fillStyle = '#d8d0e8'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#b8b0d0';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) g.fillRect(i * 64, j * 64, 64, 64);
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(8, 8);
  const floorM = new THREE.MeshToonMaterial({ map: floorTex });
  B(-32, 2, 26, -58, -0.5, 0.5, floorM);
  B(-32, 2, 26, -58, H, 0.4, toon(0x2a2440), { collide: false });
  // Carpet
  B(-1.5, 0, 1.5, -19, 0.01, 0.02, toon(0xa01830), { collide: false });

  // Lobby walls
  wall(-14.5, 0.5, -2, 0); wall(2, 0.5, 14.5, 0);           // front with door gap
  B(-2, 0, 2, 0.5, 4.5, 1.5, wallM, { tag: 'wall' });        // over door
  wall(-14.5, 0, -14, -24); wall(14, 0, 14.5, -24);           // sides
  wall(-14.5, -24.5, 9, -24); wall(13, -24.5, 14.5, -24);     // north with gap 9..13
  // Pillars
  for (const x of [-7, 7]) for (const z of [-8, -15]) {
    B(x - 0.7, z - 0.7, x + 0.7, z + 0.7, 0, H, marble, { tag: 'wall' });
    B(x - 0.9, z - 0.9, x + 0.9, z + 0.9, H - 0.6, 0.6, gold, { collide: false });
  }
  // Teller counter (low: blocks sight only when you crouch)
  B(-13.5, -19.5, 3, -20.5, 0, 1.2, toon(0x5a3a2a), { tag: 'low' });
  B(-13.5, -19.4, 3, -20.6, 1.2, 0.08, gold, { collide: false });
  B(3, -19.5, 3.3, -24, 0, 1.2, toon(0x5a3a2a), { tag: 'low' });
  // Rope line
  for (let i = 0; i < 4; i++) {
    B(-0.9 - 0.1, -10 - i * 2.5 - 0.1, -0.9 + 0.1, -10 - i * 2.5 + 0.1, 0, 1, gold, { collide: false });
  }
  // Big hanging sign
  const hs = P.sign('GALACTIC RESERVE', O.x, O.y + 4.8, O.z - 23.6, 0, { w: 10, h: 1.4, color: '#ffd23f' });
  hs.renderOrder = 1;
  // Plants
  for (const [x, z] of [[-12.5, -1.5], [12.5, -1.5]]) {
    B(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0, 0.8, toon(0x3a3550), { tag: 'low' });
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), toon(0x3a9a4a));
    p.position.copy(L(x, z)).add(new THREE.Vector3(0, 1.5, 0));
    P.group.add(p);
  }

  // Corridor A (x 9..13, z -24..-44)
  wall(8.5, -24.5, 9, -44);
  wall(13, -24.5, 13.5, -32); wall(13, -36, 13.5, -44.5);
  // Manager's office (x 13..23, z -28..-40)
  wall(13, -27.5, 23.5, -28); wall(13, -40, 23.5, -40.5); wall(23, -28, 23.5, -40.5);
  B(17, -32.5, 21, -35.5, 0, 0.9, toon(0x5a3a2a), { tag: 'low' });  // desk
  B(20.5, -36.8, 22.5, -38.5, 0, 0.6, toon(0x8a2040), { tag: 'low' }); // sofa-ish
  P.sign('MANAGER · MR. PORKSWORTH', O.x + 22.9, O.y + 3.4, O.z - 34, -Math.PI / 2, { w: 5.5, h: 0.9, color: '#ff3d8b' });
  P.sign('EMPLOYEE OF THE MONTH: TELL-R', O.x + 18, O.y + 3.6, O.z - 28.06, Math.PI, { w: 5, h: 0.9, color: '#33f0ff', size: 60 });
  const keycard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.32), glowMat(0x33f0ff, 2.5));
  keycard.position.copy(L(19, -34)).add(new THREE.Vector3(0, 0.95, 0));
  P.group.add(keycard);
  P.keycard = keycard;
  // Laser hall (x -14..13, z -50..-44)
  wall(-14.5, -44.5, 8.5, -44); wall(-14.5, -50.5, 13.5, -50);
  wall(13, -44, 13.5, -50);
  // Laser grids
  P.lasers = [];
  const laserM = glowMat(0xff2030, 4, { unique: true });
  const laser = (x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 6), laserM);
    m.position.copy(L(x, -47)).add(new THREE.Vector3(0, y, 0));
    P.group.add(m);
    P.lasers.push({ minX: O.x + x - 0.05, maxX: O.x + x + 0.05, minY: O.y + y - 0.04, maxY: O.y + y + 0.04, minZ: O.z - 50, maxZ: O.z - 44, mesh: m });
  };
  for (const x of [-3.5, -1.5]) for (const y of [1.25, 1.55, 1.85, 2.3]) laser(x, y);
  laser(3.5, 0.28); laser(3.5, 2.3); laser(3.5, 2.0);
  for (const x of [-3.5, -1.5, 3.5]) {
    B(x - 0.15, -44.3, x + 0.15, -44, 0, 2.6, toon(0x333333), { collide: false });
    B(x - 0.15, -50, x + 0.15, -49.7, 0, 2.6, toon(0x333333), { collide: false });
  }
  // Hiding spots in the laser hall
  B(5.3, -50, 6.9, -48.5, 0, H, marble, { tag: 'wall' });
  B(-9.3, -50, -7.7, -48.5, 0, H, marble, { tag: 'wall' });
  B(-0.3, -45.6, 1.5, -44.5, 0, 1.0, toon(0x6a4a2a), { tag: 'low' });
  B(0.0, -45.3, 1.2, -44.5, 1.0, 0.5, toon(0x7a5a3a), { tag: 'low' });
  P.sign('STAFF ONLY', O.x + 11, O.y + 4.6, O.z - 23.95, 0, { w: 3.4, h: 0.7, color: '#ff4d4d', size: 70 });
  P.sign('CROUCH [C] UNDER · JUMP OVER', O.x - 2.5, O.y + 3.6, O.z - 44.56, Math.PI, { w: 6, h: 0.8, color: '#ff4d4d', size: 56 });

  // Vault (x -30..-14, z -56..-38)
  wall(-30.5, -38, -14, -37.5); wall(-30.5, -56.5, -14, -56); wall(-30.5, -56, -30, -38);
  wall(-14.5, -38, -14, -44.5); wall(-14.5, -50, -14, -56);
  const vaultDoor = new THREE.Group();
  vaultDoor.position.copy(L(-14.2, -47)).add(new THREE.Vector3(0, 2.6, 0));
  P.group.add(vaultDoor);
  const vd = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.8, 32), toon(0x8a8a9a));
  vd.rotation.z = Math.PI / 2;
  vaultDoor.add(vd);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.2), gold);
    spoke.position.x = 0.5;
    spoke.rotation.x = i * Math.PI / 3;
    vaultDoor.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16), gold);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = 0.6;
  vaultDoor.add(hub);
  P.vaultDoor = vaultDoor;
  P.vaultCol = { minX: O.x - 14.6, maxX: O.x - 13.8, minY: O.y, maxY: O.y + 6, minZ: O.z - 50, maxZ: O.z - 44, tag: 'wall' };
  P.colliders.push(P.vaultCol);
  // Vault contents
  const boxTex = drawTexture(256, 256, (g, w) => {
    g.fillStyle = '#6a6a7a'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#3a3a48'; g.lineWidth = 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.strokeRect(i * 64 + 4, j * 64 + 4, 56, 56); g.fillStyle = '#e8b83a'; g.fillRect(i * 64 + 26, j * 64 + 30, 12, 6); }
  });
  boxTex.wrapS = boxTex.wrapT = THREE.RepeatWrapping;
  boxTex.repeat.set(4, 1.5);
  const depositM = new THREE.MeshToonMaterial({ map: boxTex });
  B(-29.9, -55.9, -29.5, -38.1, 0, 5, depositM, { collide: false });
  B(-29.9, -55.9, -14.6, -55.5, 0, 5, depositM, { collide: false });
  // gold bar stacks
  for (const [x, z] of [[-27, -40], [-27, -54], [-17, -54]]) {
    for (let k = 0; k < 3; k++) B(x - 0.9, z - 0.5, x + 0.9, z + 0.5, k * 0.35, 0.33, gold, { tag: 'low' });
  }
  const vaultLight = new THREE.PointLight(0xffd08a, 40, 18, 1.5);
  vaultLight.position.copy(L(-22, -47)).add(new THREE.Vector3(0, 4.5, 0));
  P.group.add(vaultLight);
  // Money bags
  P.bags = [];
  const bagSpots = [[-20, -41], [-24, -42.5], [-18, -52], [-23, -52.5], [-27.5, -47]];
  bagSpots.forEach(([x, z]) => {
    const g = moneyBag();
    g.position.copy(L(x, z));
    P.group.add(g);
    P.bags.push(g);
  });
  // Golden banana on a pedestal
  B(-22.6, -47.6, -21.4, -46.4, 0, 1.1, marble, { tag: 'low' });
  const nana = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.15, 10, 20, Math.PI * 0.8), glowMat(0xffd23f, 1.8));
  nana.position.copy(L(-22, -47)).add(new THREE.Vector3(0, 1.6, 0));
  P.group.add(nana);
  P.goldnana = nana;
  P.updaters.push((dt) => { if (nana.parent) nana.rotation.y += dt * 1.5; });

  // Ceiling lights
  P.lights = [];
  for (const [x, z] of [[-7, -4], [7, -4], [-7, -18], [7, -18], [11, -34], [18, -34], [-6, -47], [6, -47], [-22, -47]]) {
    const panel = B(x - 1.2, z - 0.4, x + 1.2, z + 0.4, H - 0.1, 0.08, glowMat(0xfff0d0, 1.4, { unique: true }), { collide: false });
    P.lights.push(panel);
  }
  const amb = new THREE.PointLight(0xfff0e0, 60, 40, 1.2);
  amb.position.copy(L(0, -12)).add(new THREE.Vector3(0, 5, 0));
  P.group.add(amb);
  const amb2 = new THREE.PointLight(0xfff0e0, 40, 30, 1.2);
  amb2.position.copy(L(4, -40)).add(new THREE.Vector3(0, 5, 0));
  P.group.add(amb2);
  P.alarmLight = new THREE.PointLight(0xff0020, 0, 60, 1);
  P.alarmLight.position.copy(L(0, -25)).add(new THREE.Vector3(0, 5, 0));
  P.group.add(P.alarmLight);
  P.hemi = new THREE.HemisphereLight(0xfff0ff, 0x302040, 1.2);
  P.hemi.position.copy(O);
  P.group.add(P.hemi);

  // NPCs
  const teller = createCharacter('teller');
  P.addActor(teller, O.x - 5, O.y, O.z - 22, Math.PI);
  P.teller = teller;
  P.sheep = [];
  [[-3, -12], [-3, -14.5], [-3, -17]].forEach(([x, z], i) => {
    const s = createCharacter('sheep');
    P.addActor(s, O.x + x, O.y, O.z + z, 0);
    s.root.rotation.y = 0;
    P.sheep.push(s);
  });

  // The lobby is public: you're just a customer there, unless you're behind the counter or carrying loot.
  P.loot = false;
  P.isRestricted = (pos) => {
    const lx = pos.x - O.x, lz = pos.z - O.z;
    if (P.loot) return true;
    const inLobby = lx > -14 && lx < 14 && lz < 0.5 && lz > -24;
    const behindCounter = lz < -19.4 && lx < 3.4;
    return !inLobby || behindCounter;
  };
  P.spawn = { pos: L(0, -2), yaw: 0 };
  P.exitPos = L(0, -0.5).add(new THREE.Vector3(0, 1.4, 0));
  P.L = L;
  P.group.visible = false;
  game.scene.add(P.group);
  return P;
}

export function moneyBag() {
  const g = new THREE.Group();
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), toon(0xc8b078));
  sack.scale.set(1, 1.1, 1);
  sack.position.y = 0.45;
  g.add(sack);
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.25, 10), toon(0xa89058));
  tie.position.y = 0.95;
  g.add(tie);
  const sign = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshBasicMaterial({ map: drawTexture(64, 64, (c) => { c.fillStyle = '#2a7a2a'; c.beginPath(); c.arc(32, 32, 30, 0, 7); c.fill(); neonText(c, '₡', 32, 34, '#ffffff', 40, { glow: 2 }); }) }));
  sign.position.set(0, 0.5, -0.43);
  sign.rotation.y = Math.PI;
  g.add(sign);
  const sign2 = sign.clone();
  sign2.position.z = 0.43;
  sign2.rotation.y = 0;
  g.add(sign2);
  return g;
}

// Patrolling security robot with a visible vision cone.
export class Guard {
  constructor(game, place, route, { speed = 1.9 } = {}) {
    this.game = game;
    this.P = place;
    this.route = route.map(([x, z]) => place.L(x, z));
    this.i = 1;
    this.pos = this.route[0].clone();
    this.speed = speed;
    this.yaw = 0;
    this.wait = 0;
    this.sus = 0;
    this.c = createCharacter('securibot');
    place.group.add(this.c.root);
    this.c.root.position.copy(this.pos);
    // Vision cone on the floor
    const g = new THREE.CircleGeometry(1, 24, Math.PI / 2 - 0.6, 1.2);
    g.rotateX(-Math.PI / 2);
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xffe060, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.cone = new THREE.Mesh(g, this.coneMat);
    this.cone.position.y = 0.03;
    this.c.root.add(this.cone);
    // "?!" indicator
    this.mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: game.fx.textSprite('?', '#ffd23f'), transparent: true, depthWrite: false }));
    this.mark.scale.setScalar(0.8);
    this.mark.position.y = 2.2;
    this.mark.visible = false;
    this.c.root.add(this.mark);
    this.mode = 'patrol';
  }

  range(player) {
    const nerve = this.game.state.stat('nerve');
    let r = 10 - (nerve - 1) * 0.9;
    if (player.crouching) r *= 0.65;
    return Math.max(4, r);
  }

  canSee(player, range, half = 0.6) {
    const d = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
    const dist = d.length();
    if (dist > range) return false;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    if (dist > 1.2 && d.normalize().dot(fwd) < Math.cos(half)) return false;
    for (const b of this.P.colliders) {
      if (b.tag !== 'wall' && !(b.tag === 'low' && player.crouching)) continue;
      if (b.maxY < this.P.origin.y + 0.5) continue;
      if (segmentHitsBoxXZ(this.pos.x, this.pos.z, player.pos.x, player.pos.z, b)) return false;
    }
    return true;
  }

  update(dt, player, alarm) {
    this.c.update(dt);
    const r = this.range(player);
    this.cone.scale.setScalar(alarm ? r * 1.2 : r);
    if (alarm) {
      this.coneMat.color.setHex(0xff3040);
      this.c.siren.visible = Math.floor(this.game.time * 8) % 2 === 0;
      // Chase if we can see them, otherwise keep patrolling quickly
      const see = this.canSee(player, 22, 1.2);
      let target;
      if (see) target = player.pos;
      else target = this.route[this.i];
      const d = new THREE.Vector3(target.x - this.pos.x, 0, target.z - this.pos.z);
      const dist = d.length();
      if (!see && dist < 0.4) this.i = (this.i + 1) % this.route.length;
      if (dist > 0.01) {
        d.normalize();
        this.yaw = dampAngle(this.yaw, Math.atan2(-d.x, -d.z), 8, dt);
        this.move(d, (see ? 5.4 : 4) * dt);
      }
      this.mark.visible = true;
      this.mark.material.map = this.game.fx.textSprite('!', '#ff3040');
    } else {
      if (this.wait > 0) {
        this.wait -= dt;
        this.yaw += Math.sin(this.game.time * 1.5) * dt * 0.9;
      } else {
        const tgt = this.route[this.i];
        const d = new THREE.Vector3(tgt.x - this.pos.x, 0, tgt.z - this.pos.z);
        const dist = d.length();
        if (dist < 0.2) { this.i = (this.i + 1) % this.route.length; this.wait = 1.2; }
        else {
          d.normalize();
          this.yaw = dampAngle(this.yaw, Math.atan2(-d.x, -d.z), 5, dt);
          this.move(d, Math.min(dist, this.speed * dt));
        }
      }
      // Suspicion (only where you're not supposed to be)
      if (this.P.isRestricted(player.pos) && this.canSee(player, r)) {
        const dist = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
        const nerve = this.game.state.stat('nerve');
        this.sus += dt * (1.35 - 0.85 * dist / r) / (1 + (nerve - 1) * 0.25);
        this.yaw = dampAngle(this.yaw, Math.atan2(-(player.pos.x - this.pos.x), -(player.pos.z - this.pos.z)), this.sus > 0.4 ? 3 : 0.5, dt);
      } else this.sus = Math.max(0, this.sus - dt * 0.4);
      this.mark.visible = this.sus > 0.05;
      this.mark.material.map = this.game.fx.textSprite(this.sus > 0.6 ? '!' : '?', this.sus > 0.6 ? '#ff8a1f' : '#ffd23f');
      this.mark.scale.setScalar(0.5 + this.sus * 0.6);
      this.coneMat.color.setHex(this.sus > 0.5 ? 0xff8a1f : 0xffe060);
      this.c.siren.visible = false;
    }
    this.c.root.position.copy(this.pos);
    this.c.root.rotation.y = this.yaw;
  }

  move(dir, dist) {
    const r = 0.45;
    this.pos.x += dir.x * dist;
    this.pos.z += dir.z * dist;
    for (const b of this.P.colliders) {
      if (b.tag !== 'wall' && b.tag !== 'low') continue;
      if (this.pos.x + r <= b.minX || this.pos.x - r >= b.maxX || this.pos.z + r <= b.minZ || this.pos.z - r >= b.maxZ) continue;
      if (b.maxY < this.P.origin.y + 0.3) continue;
      const px = Math.min(this.pos.x + r - b.minX, b.maxX - (this.pos.x - r));
      const pz = Math.min(this.pos.z + r - b.minZ, b.maxZ - (this.pos.z - r));
      if (px < pz) this.pos.x = this.pos.x < (b.minX + b.maxX) / 2 ? b.minX - r : b.maxX + r;
      else this.pos.z = this.pos.z < (b.minZ + b.maxZ) / 2 ? b.minZ - r : b.maxZ + r;
    }
  }
}
