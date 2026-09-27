import * as THREE from 'three';
import { Place } from './kit.js';
import { toon, glowMat, drawTexture, neonText } from '../core/textures.js';
import { placeCenter, streetPos } from '../world/layout.js';
import { createCharacter } from '../world/characters.js';

export function buildChapel(game) {
  const P = new Place(game, 'chapel');
  const c = placeCenter('chapel');
  const Y = 120;
  const cx = c.x, cz = c.z;
  P.center = new THREE.Vector3(cx, Y, cz);
  P.killY = Y - 25;
  // Cloud
  const cloudM = toon(0xf4eeff, { emissive: 0x2a2040 });
  const puffs = [];
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 * 3 + i * 0.3;
    const r = 5 + (i % 6) * 3.6;
    const rad = 4 + (i % 4) * 1.4;
    const s = new THREE.Mesh(new THREE.SphereGeometry(rad, 12, 10), cloudM);
    s.scale.set(1.3, 0.45, 1.3);
    s.position.set(cx + Math.cos(a) * r, Y - 2.2 - rad * 0.45 - (i % 3) * 1.2, cz + Math.sin(a) * r);
    P.group.add(s);
    puffs.push(s);
  }
  P.disc(cx, Y, cz, 19, toon(0xfaf6ff), { rim: 0xff9ad8, thick: 1 });
  // Aisle carpet
  P.box(cx + 3, Y, cz, 22, 0.03, 2.4, toon(0xd8305a), { collide: false });
  // Chapel backdrop (west side)
  const wallM = toon(0xffffff);
  const cxw = cx - 13;
  P.box(cxw, Y, cz, 6, 9, 14, wallM);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 8.5, 5, 4, 1), toon(0xff7ab8));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(0.6, 1, 1.2);
  roof.position.set(cxw, Y + 11.5, cz);
  P.group.add(roof);
  P.box(cxw, Y + 9, cz, 1.6, 8, 1.6, wallM, { collide: false });
  const heart = heartMesh(0xff3d8b, 2.2);
  heart.position.set(cxw, Y + 19, cz);
  heart.rotation.y = Math.PI / 2;
  heart.userData.keep = true;
  P.group.add(heart);
  P.updaters.push((dt) => { heart.rotation.y += dt; heart.scale.setScalar(1 + Math.sin(game.time * 4) * 0.08); });
  // stained glass window
  const glassTex = drawTexture(256, 256, (g, w) => {
    const cols = ['#ff3d8b', '#33f0ff', '#ffd23f', '#6dff8a', '#b14dff'];
    for (let i = 0; i < 64; i++) { g.fillStyle = cols[i % 5]; g.fillRect((i % 8) * 32, Math.floor(i / 8) * 32, 30, 30); }
    neonText(g, '♥', w / 2, w / 2, '#ffffff', 140);
  });
  const win = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ map: glassTex, color: new THREE.Color(1.4, 1.4, 1.4) }));
  win.position.set(cxw + 3.02, Y + 6, cz);
  win.rotation.y = Math.PI / 2;
  P.group.add(win);
  // Flower arch over the altar
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.25, 8, 32, Math.PI), toon(0x7adf7a));
  arch.position.set(cx - 7, Y, cz);
  arch.rotation.y = Math.PI / 2;
  P.group.add(arch);
  for (let i = 0; i < 16; i++) {
    const a = (i / 15) * Math.PI;
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), toon([0xff7ab8, 0xffffff, 0xffd23f][i % 3]));
    f.position.set(cx - 7, Y + Math.sin(a) * 3.4, cz + Math.cos(a) * 3.4);
    P.group.add(f);
  }
  P.box(cx - 8, Y, cz, 1, 1.1, 2.2, toon(0xfff4d0));
  // Pews
  for (let row = 0; row < 3; row++) for (const s of [-1, 1]) {
    P.box(cx - 1 + row * 4, Y, cz + s * 4, 1, 0.55, 4.5, toon(0xb88a5a));
    P.box(cx - 0.55 + row * 4, Y, cz + s * 4, 0.12, 1.2, 4.5, toon(0xb88a5a), { collide: false });
  }
  P.sign('LENNY ♥ LINDA', cx - 7, Y + 5.6, cz, Math.PI / 2, { w: 7, h: 1.4, color: '#ff3d8b' });
  P.sign('11 YEARS IN THE MAKING', cx - 7, Y + 4.4, cz, Math.PI / 2, { w: 5, h: 0.7, color: '#ffd23f', size: 60 });
  const light = new THREE.PointLight(0xffc0e0, 200, 50, 1.4);
  light.position.set(cx, Y + 12, cz);
  P.group.add(light);

  // Cast
  const linda = createCharacter('linda', { standing: true });
  P.addActor(linda, cx - 7, Y, cz - 1.2, -Math.PI / 2);
  P.linda = linda;
  const officiant = createCharacter('tortoise', { standing: true });
  P.addActor(officiant, cx - 9, Y, cz + 0.2, -Math.PI / 2);
  P.guests = [];
  const guestSpots = [[-1, 3.2], [-1, 5], [3, -3.5], [3, 4.4], [7, -4.8], [-1, -4.5]];
  guestSpots.forEach(([x, z], i) => {
    const g = createCharacter('sloth', { standing: false, hands: 'lap', shirt: [0x6d5a8a, 0x2a5a8a, 0x8a2a4a][i % 3] });
    g.speedMul = 0.35;
    P.addActor(g, cx + x - 0.3, Y + 0.55, cz + z, -Math.PI / 2);
    P.guests.push(g);
  });

  P.dock = {
    pos: new THREE.Vector3(cx + 20.5, Y - 0.3, cz),
    yaw: Math.PI,
    pre: new THREE.Vector3(cx + 20.5, Y + 1, cz - 28),
    entry: new THREE.Vector3(streetPos(12), 72, cz - 28),
  };
  P.spawn = { pos: new THREE.Vector3(cx + 15, Y, cz), yaw: Math.PI / 2 };
  P.freeze();
  game.scene.add(P.group);
  return P;
}

export function heartMesh(color, s = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1);
  shape.bezierCurveTo(-0.2, -0.6, -1.2, -0.3, -1.1, 0.35);
  shape.bezierCurveTo(-1, 1, -0.2, 1.1, 0, 0.5);
  shape.bezierCurveTo(0.2, 1.1, 1, 1, 1.1, 0.35);
  shape.bezierCurveTo(1.2, -0.3, 0.2, -0.6, 0, -1);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 });
  geo.center();
  const m = new THREE.Mesh(geo, glowMat(color, 2.2));
  m.scale.setScalar(s);
  return m;
}
