import * as THREE from 'three';
import { Place } from './kit.js';
import { toon, glowMat, drawTexture, neonText, FONT_DISPLAY, FONT_BODY, wrapLines } from '../core/textures.js';
import { placeCenter, streetPos } from '../world/layout.js';
import { createCharacter } from '../world/characters.js';

// Taxi Rank 7: the floating hub platform where every fare starts.
export function buildRank(game) {
  const P = new Place(game, 'rank');
  const c = placeCenter('rank');
  const Y = 64;
  const cx = c.x, cz = c.z;
  P.center = new THREE.Vector3(cx, Y, cz);
  P.killY = Y - 30;

  const deck = toon(0x2c2742);
  const deckTop = drawTexture(512, 512, (g, w) => {
    g.fillStyle = '#28223c'; g.fillRect(0, 0, w, w);
    g.strokeStyle = '#3a3358'; g.lineWidth = 3;
    for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    g.fillStyle = '#ffd23f';
    for (let i = 0; i < w; i += 64) g.fillRect(w - 40, i, 24, 32);
  });
  deckTop.repeat.set(2, 2);
  deckTop.wrapS = deckTop.wrapT = THREE.RepeatWrapping;
  // Deck: 40 x 30
  const W = 40, D = 30;
  const deckMesh = P.box(cx, Y - 1.2, cz, W, 1.2, D, [deck, deck, new THREE.MeshToonMaterial({ map: deckTop }), deck, deck, deck]);
  // Glowing underside + support column down into the haze
  P.box(cx, Y - 3, cz, W - 4, 1.8, D - 4, toon(0x1e1a2e), { collide: false });
  P.box(cx, Y - 3.05, cz, W - 3.6, 0.1, D - 3.6, glowMat(0xff3d8b, 1.4), { collide: false });
  P.box(cx - 6, 0, cz, 8, Y - 3, 8, toon(0x1a1728), { collide: false });
  for (let i = 0; i < 6; i++) P.box(cx - 6, 8 + i * 9, cz, 8.3, 0.4, 8.3, glowMat(0x33f0ff, 1.3), { collide: false });

  // Railings (east side open for the taxi bay)
  const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
  P.railing(x0, z0, x1, z0, Y);
  P.railing(x0, z1, x1, z1, Y);
  P.railing(x0, z0, x0, z1, Y);
  P.railing(x1, z0, x1, cz - 5, Y, { color: 0xffd23f });
  P.railing(x1, cz + 5, x1, z1, Y, { color: 0xffd23f });
  // Taxi bay markings
  P.box(x1 - 1.5, Y, cz, 3, 0.02, 10, glowMat(0xffd23f, 1.2), { collide: false });
  P.sign('TAXI RANK 7', x1 - 0.2, Y + 5.2, cz, -Math.PI / 2, { w: 9, h: 2, color: '#ffd23f' });
  P.sign('TAXI RANK 7', x1 - 0.1, Y + 5.2, cz, Math.PI / 2, { w: 9, h: 2, color: '#ffd23f' });
  const poleM = toon(0x3a3550);
  P.box(x1 - 0.5, Y, cz - 5, 0.3, 5, 0.3, poleM);
  P.box(x1 - 0.5, Y, cz + 5, 0.3, 5, 0.3, poleM);
  P.box(x1 - 0.5, Y + 4.2, cz, 0.3, 0.3, 10.3, poleM, { collide: false });

  // Dispatch booth with Doris
  const bx = cx - 12, bz = cz - 10;
  P.box(bx, Y, bz - 1.6, 6, 3.4, 0.3, toon(0x3b2a5a));
  P.box(bx - 2.9, Y, bz, 0.3, 3.4, 3.4, toon(0x3b2a5a));
  P.box(bx + 2.9, Y, bz, 0.3, 3.4, 3.4, toon(0x3b2a5a));
  P.box(bx, Y + 3.4, bz, 6.4, 0.3, 3.8, toon(0x5a3a8a), { collide: false });
  P.box(bx, Y, bz + 1.4, 6, 1.1, 0.6, toon(0x5a3a8a));
  P.box(bx, Y + 1.08, bz + 1.72, 6.2, 0.05, 0.05, glowMat(0x33f0ff, 1.3), { collide: false });
  P.box(bx, Y + 1.1, bz + 1.4, 6.2, 0.06, 0.8, toon(0x2a1f44), { collide: false });
  P.sign('DISPATCH', bx, Y + 3.95, bz + 1.95, 0, { w: 5, h: 1, color: '#33f0ff' });
  const doris = createCharacter('doris');
  P.addActor(doris, bx, Y + 0.9, bz - 0.1, Math.PI);
  doris.homeLook = null;
  P.doris = doris;
  const stool = P.box(bx, Y, bz - 0.2, 0.8, 0.9, 0.8, toon(0x222222), { collide: false });
  stool.visible = true;

  // Ambient regulars
  const doc = createCharacter('flamingo');
  P.addActor(doc, x1 - 7, Y, z0 + 2.2, Math.PI * 0.85);
  P.flamingo = doc;
  const bot = createCharacter('sweep');
  P.addActor(bot, cx, Y, cz, 0);
  P.sweeper = bot;
  let botA = 0;
  P.updaters.push((dt) => {
    botA += dt * 0.12;
    const bxp = cx + 2 + Math.cos(botA) * 9, bzp = cz + Math.sin(botA * 2) * 6;
    const dx = bxp - bot.root.position.x, dz = bzp - bot.root.position.z;
    bot.root.position.set(bxp, Y, bzp);
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) bot.root.rotation.y = Math.atan2(-dx, -dz);
  });

  // Vend-o-matic
  const vx = cx - 17, vz = cz + 6;
  const vendTex = drawTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#1b0f33'; g.fillRect(0, 0, w, h);
    neonText(g, 'VEND-O', w / 2, 40, '#ff3d8b', 38);
    neonText(g, 'MATIC', w / 2, 82, '#ff3d8b', 38);
    const items = ['🍭', '🎩', '🧪', '🍬', '🍭', '🍗'];
    g.font = '44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    items.forEach((it, i) => {
      const x = 64 + (i % 2) * 128, y = 160 + Math.floor(i / 2) * 100;
      g.fillStyle = '#2d1f55'; g.fillRect(x - 50, y - 40, 100, 80);
      g.fillText(it, x, y);
    });
    neonText(g, '3000', w / 2, 470, '#33f0ff', 40);
  });
  const vend = P.box(vx, Y, vz, 1.4, 2.4, 1.0, [toon(0x3a1f66), toon(0x3a1f66), toon(0x3a1f66), toon(0x3a1f66), toon(0x3a1f66), toon(0x3a1f66)]);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), new THREE.MeshBasicMaterial({ map: vendTex, color: new THREE.Color(1.4, 1.4, 1.4) }));
  face.position.set(vx + 0.71, Y + 1.2, vz);
  face.rotation.y = Math.PI / 2;
  P.group.add(face);

  // Hail beacon
  const hx = x1 - 4, hz = cz + 8;
  P.box(hx, Y, hz, 0.25, 3, 0.25, poleM);
  const beaconSign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 0.2), [toon(0x111111), toon(0x111111), toon(0x111111), toon(0x111111),
    new THREE.MeshBasicMaterial({ map: drawTexture(256, 96, (g, w, h) => { g.fillStyle = '#1a1206'; g.fillRect(0, 0, w, h); neonText(g, 'HAIL', w / 2, h / 2, '#ffd23f', 56); }), color: new THREE.Color(2, 2, 2) }),
    new THREE.MeshBasicMaterial({ map: drawTexture(256, 96, (g, w, h) => { g.fillStyle = '#1a1206'; g.fillRect(0, 0, w, h); neonText(g, 'HAIL', w / 2, h / 2, '#ffd23f', 56); }), color: new THREE.Color(2, 2, 2) })]);
  beaconSign.position.set(hx, Y + 3.1, hz);
  beaconSign.rotation.y = Math.PI / 2;
  P.group.add(beaconSign);
  const beaconLight = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), glowMat(0xffd23f, 4, { unique: true }));
  beaconLight.position.set(hx, Y + 3.65, hz);
  P.group.add(beaconLight);
  P.beaconLight = beaconLight;
  P.beaconPos = new THREE.Vector3(hx, Y + 1.4, hz);
  P.updaters.push(() => { beaconLight.visible = !P.beaconActive || Math.sin(game.time * 12) > 0; });

  // Benches, planters, lamp posts
  const bench = (x, z, ry) => {
    const g = new THREE.Group();
    g.position.set(x, Y, z);
    g.rotation.y = ry;
    P.group.add(g);
    const m = toon(0x5a3a8a);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 0.7), m); seat.position.y = 0.5; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 0.1), m); back.position.set(0, 0.85, 0.32); g.add(back);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.6), toon(0x222222));
    leg.position.set(-1.3, 0.25, 0); g.add(leg);
    const leg2 = leg.clone(); leg2.position.x = 1.3; g.add(leg2);
    P.colliders.push({ minX: x - 1.6, maxX: x + 1.6, minY: Y, maxY: Y + 0.55, minZ: z - 0.45, maxZ: z + 0.45, tag: 'bench' });
  };
  bench(cx + 2, z1 - 1.2, Math.PI);
  bench(cx - 5, z1 - 1.2, Math.PI);
  const plant = (x, z) => {
    P.box(x, Y, z, 1.2, 0.8, 1.2, toon(0x3a3550));
    const leaf = glowMat(0x6dff8a, 1.2);
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.4 + i * 0.1, 5), leaf);
      l.position.set(x + Math.cos(i * 1.3) * 0.3, Y + 1.4, z + Math.sin(i * 1.3) * 0.3);
      l.rotation.set(Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4);
      P.group.add(l);
    }
  };
  plant(x0 + 1.2, z0 + 1.2); plant(x0 + 1.2, z1 - 1.2); plant(x1 - 2, z0 + 1.2);
  const lamp = (x, z) => {
    P.box(x, Y, z, 0.18, 4.5, 0.18, poleM);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), glowMat(0xff9ad8, 2.5));
    bulb.position.set(x, Y + 4.6, z);
    P.group.add(bulb);
  };
  lamp(cx - 8, z0 + 0.6); lamp(cx + 8, z0 + 0.6); lamp(cx - 8, z1 - 0.6); lamp(cx + 12, z1 - 0.6);
  const hubLight = new THREE.PointLight(0xffc0ff, 60, 40, 1.6);
  hubLight.position.set(cx, Y + 8, cz);
  P.group.add(hubLight);

  // News screen
  const newsTex = drawTexture(768, 384, () => {});
  const news = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshBasicMaterial({ map: newsTex, color: new THREE.Color(1.3, 1.3, 1.3) }));
  news.position.set(cx + 4, Y + 4.4, z0 + 0.3);
  P.group.add(news);
  P.box(cx + 4, Y, z0 + 0.3, 0.3, 2.4, 0.3, poleM);
  P.setNews = (headline, sub = '') => {
    const g = newsTex.userData.ctx;
    const w = 768, h = 384;
    g.fillStyle = '#0a0f2a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8203a'; g.fillRect(0, 0, w, 64);
    g.font = `36px ${FONT_DISPLAY}`; g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('NSN · NEO-SERENGETI NEWS', 20, 34);
    g.font = `bold 44px ${FONT_BODY}`;
    wrapLines(g, headline, w - 40).slice(0, 3).forEach((l, i) => g.fillText(l, 20, 120 + i * 54));
    g.font = `bold 28px ${FONT_BODY}`; g.fillStyle = '#ffd23f';
    wrapLines(g, sub, w - 40).slice(0, 2).forEach((l, i) => g.fillText(l, 20, 300 + i * 36));
    newsTex.needsUpdate = true;
  };
  P.setNews('Welcome to Neo-Serengeti! Population: 9 million animals, 0 humans.', 'Weather: neon with a chance of drones.');

  // Dock (taxi hovers beside the bay, right side toward the deck)
  const street = streetPos(4); // street east of the rank block
  P.dock = {
    pos: new THREE.Vector3(x1 + 1.45, Y - 0.3, cz),
    yaw: Math.PI,
    pre: new THREE.Vector3(x1 + 1.45, Y + 1, cz - 26),
    entry: new THREE.Vector3(street, 72, cz - 26),
  };
  P.spawn = { pos: new THREE.Vector3(cx - 6, Y, cz + 4), yaw: -Math.PI / 2 };
  P.shop = { pos: new THREE.Vector3(vx + 0.8, Y + 1.2, vz) };
  P.dispatch = { pos: new THREE.Vector3(bx, Y + 1.3, bz + 1.6) };
  game.scene.add(P.group);
  return P;
}
