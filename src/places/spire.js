import * as THREE from 'three';
import { Place, pad } from './kit.js';
import { toon, glowMat, drawTexture, neonText } from '../core/textures.js';
import { placeCenter, streetPos } from '../world/layout.js';
import { createCharacter } from '../world/characters.js';

// RoboCab Control Spire: the mayor's tower in the middle of the city.
export function buildSpire(game) {
  const P = new Place(game, 'spire');
  const c = placeCenter('spire');
  const R = 300;       // service ring height
  const TOP = 332;     // mayor's deck
  P.R = R; P.TOP = TOP;
  P.center = new THREE.Vector3(c.x, R, c.z);
  P.killY = R - 30;
  const shell = toon(0x1c1a2a);
  const white = toon(0xe8ecf2);
  const add = (x, y0, z, w, h, d, m, collide = true) => {
    P.box(c.x + x, y0, c.z + z, w, h, d, m, { collide: false });
    const box = { minX: c.x + x - w / 2, maxX: c.x + x + w / 2, minY: y0, maxY: y0 + h, minZ: c.z + z - d / 2, maxZ: c.z + z + d / 2, tag: 'wall' };
    if (collide) { game.city.addCollider(box); P.colliders.push(box); }
    return box;
  };
  add(0, 0, 0, 34, 120, 34, shell);
  add(0, 120, 0, 28, 180, 28, shell);
  add(0, R, 0, 22, TOP - R - 1, 22, white);
  // Red stripes & rings
  for (let y = 20; y < R; y += 24) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(y < 120 ? 25 : 21, 0.5, 6, 48), glowMat(0xff2030, 2.2));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(c.x, y, c.z);
    P.group.add(ring);
  }
  for (const [x, z, ry] of [[0, 14.05, 0], [0, -14.05, Math.PI], [14.05, 0, Math.PI / 2], [-14.05, 0, -Math.PI / 2]]) {
    P.sign('ROBOCAB', c.x + x, 220, c.z + z, ry, { w: 18, h: 4, color: '#ff3040' });
    const eye = new THREE.Mesh(new THREE.CircleGeometry(5, 32), glowMat(0xff2030, 2.5, { unique: true }));
    eye.position.set(c.x + x * 1.001, 250, c.z + z * 1.001);
    eye.rotation.y = ry;
    P.group.add(eye);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.5, 60, 8), white);
  antenna.position.set(c.x, TOP + 30, c.z);
  P.group.add(antenna);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 10), glowMat(0xff2030, 4, { unique: true }));
  tip.position.set(c.x, TOP + 61, c.z);
  P.group.add(tip);
  P.tip = tip;

  // Service ring at R (4 slabs around the core)
  const ringM = toon(0x2e2a44);
  const slab = (x, z, w, d) => P.box(c.x + x, R - 1, c.z + z, w, 1, d, ringM);
  slab(0, 19.5, 56, 17); slab(0, -19.5, 56, 17); slab(19.5, 0, 17, 22); slab(-19.5, 0, 17, 22);
  P.box(c.x, R - 0.02, c.z + 26, 38, 0.05, 1, glowMat(0xff3040, 1.5), { collide: false });
  P.railing(c.x - 28, c.z - 28, c.x + 28, c.z - 28, R, { color: 0xff3040 });
  P.railing(c.x - 28, c.z - 28, c.x - 28, c.z + 28, R, { color: 0xff3040 });
  P.railing(c.x + 28, c.z - 28, c.x + 28, c.z + 28, R, { color: 0xff3040 });
  P.railing(c.x - 28, c.z + 28, c.x - 6, c.z + 28, R, { color: 0xff3040 });
  P.railing(c.x + 6, c.z + 28, c.x + 28, c.z + 28, R, { color: 0xff3040 });

  // Floating platforms spiralling up; each pad launches you to the next one.
  const plat = (x, y, z, r, rim) => P.disc(c.x + x, y, c.z + z, r, toon(0x2e2a44), { rim, thick: 0.8 });
  const V = (x, y, z) => new THREE.Vector3(c.x + x, y, c.z + z);
  plat(-24, R + 7, -2, 4.5, 0xff3040);
  plat(-10, R + 13, -25, 5, 0x33f0ff);
  plat(20, R + 19, -19, 4.5, 0xff3040);
  plat(25, R + 25, 10, 5, 0x33f0ff);
  pad(P, c.x - 20, R, c.z + 20, 1.4, 17.5, 0xff3d8b, V(-24, R + 7, -3));
  pad(P, c.x - 23, R + 7, c.z - 5, 1.2, 16, 0xff3d8b, V(-10, R + 13, -23.5));
  pad(P, c.x - 7, R + 13, c.z - 25, 1.2, 16, 0xff3d8b, V(19, R + 19, -18));
  pad(P, c.x + 22, R + 19, c.z - 17, 1.2, 16, 0xff3d8b, V(24.5, R + 25, 8.5));
  P.finalPad = pad(P, c.x + 22.5, R + 25, c.z + 12, 1.5, 19, 0xffd23f, V(0, TOP, 9));
  P.finalPadPower = 19;
  P.finalPad.col.pad = 0; // locked until the levers are pulled
  P.finalPad.g.visible = false;

  // Mayor's deck on top
  P.disc(c.x, TOP, c.z, 16, white, { rim: 0xff3040, thick: 1.2 });
  const throne = new THREE.Group();
  throne.position.set(c.x, TOP, c.z - 9);
  P.group.add(throne);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2.5), toon(0xb0182a));
  tb.position.y = 0.5;
  throne.add(tb);
  const tback = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 0.6), toon(0xb0182a));
  tback.position.set(0, 3, -1.1);
  throne.add(tback);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), glowMat(0xffd23f, 2));
  logo.position.set(0, 4, -0.79);
  throne.add(logo);
  // Robo-Gerald shrine (the mayor's secret)
  const shrine = new THREE.Group();
  shrine.position.set(c.x + 9, TOP, c.z - 6);
  P.group.add(shrine);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.2, 12), toon(0x3a3550));
  ped.position.y = 0.6;
  shrine.add(ped);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 12, 1, true), glowMat(0x88e8ff, 0.5, { transparent: true, opacity: 0.3 }));
  glass.position.y = 1.8;
  shrine.add(glass);
  P.sign('ROBO-GERALD COLLECTION (1/2)', 0, 3, 0.8, 0, { w: 3.2, h: 0.5, color: '#33f0ff', size: 60, parent: shrine });
  const mini = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), toon(0x9aa3b5));
  mini.position.set(-0.2, 1.4, 0);
  shrine.add(mini);
  P.shrine = shrine;

  const mayor = createCharacter('mayor');
  P.addActor(mayor, c.x, TOP, c.z - 6, 0);
  mayor.root.rotation.y = Math.PI;
  P.mayor = mayor;

  // Levers
  P.levers = [];
  const lever = (x, y, z) => {
    const g = new THREE.Group();
    g.position.set(c.x + x, y, c.z + z);
    P.group.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.6), toon(0x3a3550));
    base.position.y = 0.6;
    g.add(base);
    const arm = new THREE.Group();
    arm.position.y = 1.2;
    g.add(arm);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), toon(0xdddddd));
    stick.position.y = 0.55;
    arm.add(stick);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), glowMat(0xff2030, 3, { unique: true }));
    knob.position.y = 1.1;
    arm.add(knob);
    arm.rotation.x = -0.6;
    const L = { g, arm, knob, pulled: false, pos: new THREE.Vector3(c.x + x, y + 1.4, c.z + z) };
    P.levers.push(L);
    return L;
  };
  lever(-24, R, -8);
  lever(-11.5, R + 13, -27.5);
  lever(27.5, R + 25, 11);

  // Rotating laser sweepers
  P.sweepers = [];
  const sweeper = (y, len, speed, phase) => {
    const g = new THREE.Group();
    g.position.set(c.x, y, c.z);
    P.group.add(g);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.18, 0.18), glowMat(0xff2030, 4, { unique: true }));
    beam.position.x = 11 + len / 2;
    g.add(beam);
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), toon(0x333333));
    emitter.position.x = 11;
    g.add(emitter);
    P.sweepers.push({ g, y, len, speed, phase });
  };
  sweeper(R + 1.0, 18, 0.55, 0);
  sweeper(R + 13.2, 18, -0.6, 2);
  sweeper(R + 25.7, 16, 0.7, 4);

  P.dock = {
    pos: new THREE.Vector3(c.x, R - 0.3, c.z + 29.6),
    yaw: Math.PI / 2,
    pre: new THREE.Vector3(c.x + 30, R + 1, c.z + 29.6),
    entry: new THREE.Vector3(c.x + 30, 72, streetPos(8)),
  };
  P.spawn = { pos: new THREE.Vector3(c.x, R, c.z + 24), yaw: 0 };
  P.topSpawn = { pos: new THREE.Vector3(c.x, TOP, c.z + 8), yaw: 0 };
  const light = new THREE.PointLight(0xff8090, 300, 80, 1.3);
  light.position.set(c.x, TOP + 10, c.z + 10);
  P.group.add(light);
  const light2 = new THREE.PointLight(0xc0c0ff, 250, 70, 1.3);
  light2.position.set(c.x, R + 8, c.z + 30);
  P.group.add(light2);
  game.scene.add(P.group);
  return P;
}
