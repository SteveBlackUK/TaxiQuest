import * as THREE from 'three';
import { Place } from './kit.js';
import { toon, glowMat, drawTexture, neonText, FONT_DISPLAY, FONT_BODY, roundRect } from '../core/textures.js';
import { placeCenter, streetPos } from '../world/layout.js';
import { createCharacter } from '../world/characters.js';

export const MENU = {
  mains: ['Quantum Nuggets', 'Black Hole Burger', 'Comet Corn Dog', 'Asteroid Wrap'],
  sides: ['Meteor Fries', 'Moon Rings', 'Solar Salad'],
  drinks: ['Nebula Shake (GRAPE)', 'Nebula Shake (PLASMA)', 'Gravity Cola', 'Void Water'],
};
export const TOYS = ['Robo-Gerald', 'Space Duck', 'Tiny Mayor', 'Sad Rock'];

function drawToy(g, name, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  if (name === 'Robo-Gerald') {
    g.fillStyle = '#9aa3b5'; g.fillRect(-35, -40, 70, 60);
    g.fillStyle = '#0a1a2a'; g.fillRect(-26, -30, 52, 36);
    g.fillStyle = '#33f0ff'; g.fillRect(-18, -20, 10, 10); g.fillRect(8, -20, 10, 10); g.fillRect(-12, -4, 24, 5);
    g.fillStyle = '#ff3d8b'; g.beginPath(); g.arc(0, -52, 8, 0, 7); g.fill();
    g.fillStyle = '#9aa3b5'; g.fillRect(-2, -50, 4, 12); g.fillRect(-25, 20, 50, 30);
  } else if (name === 'Space Duck') {
    g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(0, 15, 38, 28, 0, 0, 7); g.fill();
    g.beginPath(); g.arc(-10, -25, 22, 0, 7); g.fill();
    g.fillStyle = '#ff8a1f'; g.beginPath(); g.moveTo(-30, -24); g.lineTo(-52, -18); g.lineTo(-30, -14); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(-16, -30, 4, 0, 7); g.fill();
    g.strokeStyle = '#88e8ff'; g.lineWidth = 4; g.beginPath(); g.arc(-10, -25, 30, 0, 7); g.stroke();
  } else if (name === 'Tiny Mayor') {
    g.fillStyle = '#b8c0d0'; g.fillRect(-32, -30, 64, 52);
    g.beginPath(); g.moveTo(-32, -30); g.lineTo(-22, -52); g.lineTo(-12, -30); g.fill();
    g.beginPath(); g.moveTo(32, -30); g.lineTo(22, -52); g.lineTo(12, -30); g.fill();
    g.fillStyle = '#060a12'; g.fillRect(-24, -22, 48, 34);
    g.fillStyle = '#33f0ff'; g.font = `18px ${FONT_DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('=^.^=', 0, -5);
    g.fillStyle = '#b0182a'; g.fillRect(-24, 22, 48, 26);
  } else {
    g.fillStyle = '#777a80'; g.beginPath(); g.ellipse(0, 5, 40, 32, 0.2, 0, 7); g.fill();
    g.fillStyle = '#5a5d63'; g.beginPath(); g.arc(12, -8, 8, 0, 7); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 22, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.fillStyle = '#111'; g.fillRect(-14, -2, 5, 5); g.fillRect(8, -2, 5, 5);
    g.fillStyle = '#6ad0ff'; g.beginPath(); g.ellipse(-12, 8, 3, 6, 0, 0, 7); g.fill();
  }
  g.restore();
}

// Clickable 3D menu board.
class MenuBoard {
  constructor() {
    this.W = 1024; this.H = 768;
    this.tex = drawTexture(this.W, this.H, () => {});
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.25), new THREE.MeshBasicMaterial({ map: this.tex, color: new THREE.Color(0.95, 0.95, 0.95) }));
    this.buttons = [];
    const cols = [['MAINS', MENU.mains], ['SIDES', MENU.sides], ['DRINKS', MENU.drinks]];
    cols.forEach(([, items], ci) => {
      items.forEach((name, i) => this.buttons.push({ id: name, x: 20 + ci * 330, y: 150 + i * 92, w: 318, h: 80 }));
    });
    this.buttons.push({ id: 'CLEAR', x: 40, y: 640, w: 260, h: 90 });
    this.buttons.push({ id: 'PLACE ORDER', x: 620, y: 640, w: 370, h: 90 });
    this.order = [];
    this.hover = null;
    this.draw();
  }
  draw() {
    const g = this.tex.userData.ctx;
    const { W, H } = this;
    g.fillStyle = '#b8161c'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#7a0d12'; g.fillRect(8, 8, W - 16, H - 16);
    neonText(g, 'McSNACKERS ORBITAL MENU', W / 2, 52, '#ffd23f', 50, { maxW: W - 60 });
    [['MAINS', 20], ['SIDES', 350], ['DRINKS', 680]].forEach(([t, x]) => neonText(g, t, x + 159, 118, '#ffffff', 30));
    for (const b of this.buttons) {
      const sel = this.order.includes(b.id);
      const hov = this.hover === b.id;
      const isBtn = b.id === 'CLEAR' || b.id === 'PLACE ORDER';
      g.fillStyle = isBtn ? (b.id === 'CLEAR' ? '#3a3a44' : '#1f8a3a') : sel ? '#ffd23f' : hov ? '#ff6a70' : '#a8141a';
      roundRect(g, b.x, b.y, b.w, b.h, 14); g.fill();
      if (hov) { g.strokeStyle = '#ffffff'; g.lineWidth = 5; roundRect(g, b.x, b.y, b.w, b.h, 14); g.stroke(); }
      g.fillStyle = sel ? '#3a0a0a' : '#ffffff';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      let s = isBtn ? 40 : 30;
      g.font = `${isBtn ? '' : 'bold '}${s}px ${isBtn ? FONT_DISPLAY : FONT_BODY}`;
      while (g.measureText(b.id).width > b.w - 20 && s > 12) { s -= 2; g.font = `${isBtn ? '' : 'bold '}${s}px ${isBtn ? FONT_DISPLAY : FONT_BODY}`; }
      g.fillText(b.id, b.x + b.w / 2, b.y + b.h / 2 + 2);
    }
    g.fillStyle = '#2a0508'; roundRect(g, 310, 632, 300, 106, 10); g.fill();
    g.fillStyle = '#ffd23f'; g.font = `18px ${FONT_DISPLAY}`; g.textAlign = 'center';
    g.fillText('YOUR ORDER', 460, 650);
    g.font = `bold 19px ${FONT_BODY}`; g.fillStyle = '#fff';
    (this.order.length ? this.order : ['(empty)']).slice(0, 4).forEach((o, i) => g.fillText(o, 460, 675 + i * 20));
    this.tex.needsUpdate = true;
  }
  hit(uv) {
    const px = uv.x * this.W, py = (1 - uv.y) * this.H;
    return this.buttons.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)?.id || null;
  }
}

class ToyOTron {
  constructor() {
    this.tex = drawTexture(768, 300, () => {});
    this.idx = 0;
    this.lit = -1;
    this.msg = 'PRESS SPACE TO STOP';
    this.draw();
  }
  draw() {
    const g = this.tex.userData.ctx;
    g.fillStyle = '#1b0f33'; g.fillRect(0, 0, 768, 300);
    neonText(g, 'TOY-O-TRON', 384, 36, '#ff3d8b', 40);
    TOYS.forEach((t, i) => {
      const x = 20 + i * 184;
      const on = i === this.idx;
      g.fillStyle = on ? '#ffd23f' : '#2d1f55';
      roundRect(g, x, 70, 172, 170, 16); g.fill();
      drawToy(g, t, x + 86, 145, 90);
      g.fillStyle = on ? '#1b0f33' : '#c8b8ff';
      g.font = `bold 18px ${FONT_BODY}`; g.textAlign = 'center';
      g.fillText(t, x + 86, 226);
    });
    neonText(g, this.msg, 384, 272, '#33f0ff', 24, { font: FONT_DISPLAY });
    this.tex.needsUpdate = true;
  }
}

// Food props for the catch minigame.
export function foodModel(kind) {
  const g = new THREE.Group();
  if (kind === 'Quantum Nuggets') {
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.2), toon(0xd8203a))));
    for (let i = 0; i < 4; i++) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), toon(0xe8a33a)); n.position.set(-0.1 + i * 0.07, 0.15, 0); g.add(n); }
  } else if (kind === 'Meteor Fries' || kind === 'Moon Rings' || kind === 'Solar Salad') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.15), toon(kind === 'Solar Salad' ? 0x3aa84a : 0xd8203a));
    g.add(box);
    for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), toon(kind === 'Moon Rings' ? 0xeae0c0 : 0xffd23f)); f.position.set(-0.08 + i * 0.03, 0.2, (i % 2) * 0.03); g.add(f); }
  } else if (kind.startsWith('Nebula') || kind === 'Gravity Cola' || kind === 'Void Water') {
    const col = kind.includes('GRAPE') ? 0x8a3ad8 : kind.includes('PLASMA') ? 0x33f0ff : kind === 'Gravity Cola' ? 0x5a2e12 : 0x111122;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.36, 12), toon(0xf4f4f4));
    g.add(cup);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.04, 12), toon(col));
    lid.position.y = 0.19; g.add(lid);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), toon(0xff3d8b));
    straw.position.set(0.03, 0.32, 0); straw.rotation.z = 0.2; g.add(straw);
  } else if (kind === 'toy') {
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glowMat(0x88e8ff, 1, { transparent: true, opacity: 0.7 }));
    g.add(top);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), toon(0xff3d8b));
    g.add(bot);
  } else if (kind === 'hot sauce') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 10), toon(0xff2020));
    g.add(b);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), toon(0x111111));
    cap.position.y = 0.23; g.add(cap);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    skull.position.set(0, 0, -0.09); g.add(skull);
  } else {
    // burger-ish
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xe8a33a)); b1.position.y = 0.04; g.add(b1);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), toon(0x5a2e12)); g.add(p);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.06, 12), toon(0xe8a33a)); b2.position.y = -0.06; g.add(b2);
  }
  g.scale.setScalar(1.6);
  return g;
}

export function buildSnacks(game) {
  const P = new Place(game, 'snacks');
  const c = placeCenter('snacks');
  const Y = 100;
  const cx = c.x, cz = c.z;
  P.center = new THREE.Vector3(cx, Y, cz);
  const G = new THREE.Group();
  G.position.set(cx, Y, cz);
  P.group.add(G);
  const layer = (r0, r1, h, y, color, emissive = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 48), toon(color, emissive ? { emissive } : {}));
    m.position.y = y;
    G.add(m);
    return m;
  };
  layer(18, 16, 4, -10, 0xe8a33a);               // bottom bun
  layer(19.5, 19.5, 3.5, -6.5, 0x5a2e12);         // patty
  layer(20.5, 20.5, 0.6, -4.6, 0xffc21a);         // cheese
  const lettuce = layer(20, 20, 1.2, -3.8, 0x5adf5a);
  lettuce.scale.set(1, 1, 1);
  layer(19, 19, 1.4, -2.6, 0xd83a2a);            // tomato
  const topBun = new THREE.Mesh(new THREE.SphereGeometry(19, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xeaa53c));
  topBun.scale.y = 0.55;
  topBun.position.y = -1.9;
  G.add(topBun);
  const seed = new THREE.CapsuleGeometry(0.3, 0.8, 3, 6);
  for (let i = 0; i < 40; i++) {
    const a = i * 2.4, rr = 3 + (i % 7) * 2.1;
    const s = new THREE.Mesh(seed, toon(0xfff4d0));
    const y = Math.sqrt(Math.max(0, 1 - (rr / 19) ** 2)) * 19 * 0.55 - 1.9;
    s.position.set(Math.cos(a) * rr, y + 0.15, Math.sin(a) * rr);
    s.rotation.set(Math.PI / 2, a, 0.4);
    G.add(s);
  }
  // Windows ring on the patty
  const winMat = glowMat(0xffd08a, 1.6);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), winMat);
    w.position.set(Math.cos(a) * 19.6, -6.5, Math.sin(a) * 19.6);
    w.lookAt(Math.cos(a) * 40, -6.5, Math.sin(a) * 40);
    G.add(w);
  }
  // Drive-thru ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(24, 0.35, 8, 80), glowMat(0xffd23f, 2.2));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -3;
  G.add(ring);
  // Rocket fins + thrusters underneath
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 5), toon(0xd8203a));
    fin.position.set(Math.cos(a) * 14, -14, Math.sin(a) * 14);
    fin.rotation.y = -a;
    G.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(6, 14, 16), glowMat(0xff8a1f, 2.5, { transparent: true, opacity: 0.8 }));
  flame.rotation.x = Math.PI;
  flame.position.y = -20;
  G.add(flame);
  P.updaters.push((dt) => { flame.scale.set(1 + Math.sin(game.time * 20) * 0.06, 1 + Math.sin(game.time * 13) * 0.12, 1); });
  // Big sign on top
  const signTex = drawTexture(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    neonText(g, 'McSNACKERS', w / 2, h / 2, '#ffd23f', 150, { glow: 30, maxW: w - 40 });
  });
  for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, color: new THREE.Color(2, 2, 2), side: THREE.DoubleSide, depthWrite: false }));
    s.position.set(Math.sin(ry) * 2, 13, Math.cos(ry) * 2);
    s.rotation.y = ry;
    G.add(s);
  }
  const hl = new THREE.PointLight(0xffc070, 400, 90, 1.5);
  hl.position.set(0, 0, 30);
  G.add(hl);

  // Drive-thru booth sticking out of the patty on the north (-z) side.
  const F = Y - 8;                 // booth floor
  const fz = cz - 24.5;            // booth front face
  const wx = cx;
  const shell = toon(0xb8161c);
  const trimM = toon(0xffd23f);
  P.box(wx, F - 0.3, cz - 21.5, 8, 0.3, 6, shell, { collide: false });                 // floor
  P.box(wx, F + 3.2, cz - 21.5, 8.4, 0.3, 6.4, trimM, { collide: false });             // roof
  P.box(wx - 4, F - 0.3, cz - 21.5, 0.3, 3.5, 6, shell, { collide: false });           // sides
  P.box(wx + 4, F - 0.3, cz - 21.5, 0.3, 3.5, 6, shell, { collide: false });
  P.box(wx, F - 0.3, fz, 8, 1.0, 0.3, shell, { collide: false });                      // under window
  P.box(wx, F + 2.3, fz, 8, 0.9, 0.3, shell, { collide: false });                      // over window
  P.box(wx - 3.1, F + 0.7, fz, 1.8, 1.6, 0.3, shell, { collide: false });
  P.box(wx + 3.1, F + 0.7, fz, 1.8, 1.6, 0.3, shell, { collide: false });
  P.box(wx, F + 0.62, fz - 0.35, 4.6, 0.12, 0.9, trimM, { collide: false });           // counter
  P.box(wx, F - 0.3, cz - 19, 7.6, 3.5, 0.2, toon(0x6a0d12), { collide: false });      // back wall
  const innerLight = new THREE.PointLight(0xfff0d0, 7, 7, 1.5);
  innerLight.position.set(wx, F + 2.4, fz + 2.2);
  P.group.add(innerLight);
  const clerk = createCharacter('clerk');
  P.addActor(clerk, wx, F, fz + 1.4, 0);
  P.clerk = clerk;
  P.sign('PICK-UP', wx, F + 3.9, fz - 0.3, Math.PI, { w: 4.5, h: 1.1, color: '#ffd23f' });

  // Menu board + speaker to the west (you order first, then pull forward).
  const bx = wx - 12;
  const board = new MenuBoard();
  const bz = fz + 1.0;
  board.mesh.position.set(bx, F + 1.35, bz);
  board.mesh.rotation.y = Math.PI;
  P.group.add(board.mesh);
  P.box(bx, F + 0.1, bz + 0.15, 3.3, 2.5, 0.2, toon(0x2a2a33), { collide: false });
  P.box(bx, F - 6, bz + 0.2, 0.4, 6.1, 0.4, toon(0x2a2a33), { collide: false });
  const speaker = P.box(bx + 2.2, F + 0.2, bz - 0.2, 0.7, 1.1, 0.5, toon(0x3a3a44), { collide: false });
  const spLight = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), glowMat(0x6dff8a, 2.5, { unique: true }));
  spLight.position.set(bx + 2.2, F + 1.0, bz - 0.46);
  spLight.rotation.y = Math.PI;
  P.group.add(spLight);
  P.speakerLight = spLight;
  P.sign('ORDER HERE', bx, F + 3.0, bz - 0.05, Math.PI, { w: 3.3, h: 0.7, color: '#6dff8a' });
  P.board = board;

  // Toy-o-tron mounted beside the pick-up window.
  const tx = wx + 3.1;
  const toy = new ToyOTron();
  const toyMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.68), new THREE.MeshBasicMaterial({ map: toy.tex, color: new THREE.Color(1.15, 1.15, 1.15) }));
  toyMesh.position.set(tx, F + 1.75, fz - 0.17);
  toyMesh.rotation.y = Math.PI;
  P.group.add(toyMesh);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), glowMat(0x88e8ff, 0.5, { transparent: true, opacity: 0.3 }));
  dome.position.set(tx, F + 0.95, fz - 0.55);
  P.group.add(dome);
  for (let i = 0; i < 7; i++) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), toon([0xff3d8b, 0x33f0ff, 0xffd23f, 0x6dff8a][i % 4]));
    cap.position.set(tx + Math.cos(i * 2.3) * 0.2, F + 0.75 + (i % 3) * 0.12, fz - 0.55 + Math.sin(i * 2.3) * 0.2);
    P.group.add(cap);
  }
  P.box(tx, F - 0.3, fz - 0.55, 0.7, 0.85, 0.7, toon(0xff3d8b), { collide: false });
  P.toy = toy;
  P.toyMesh = toyMesh;
  P.windowPos = new THREE.Vector3(wx, F + 1.3, fz + 0.4);
  P.boardPos = new THREE.Vector3(bx, F + 1.35, bz);
  P.toyPos = new THREE.Vector3(tx, F + 1.45, fz - 0.2);

  // Taxi faces +x (yaw -pi/2): its right side (your side) faces the booth.
  // Eye sits 1.3m behind the taxi center, so offset the dock so you're level with things.
  const street = streetPos(3); // street on the -z side of this block
  const dz = fz - 1.15 - 1.4;
  P.dock = {
    pos: new THREE.Vector3(bx + 1.3, F - 0.2, dz),
    yaw: -Math.PI / 2,
    pre: new THREE.Vector3(cx - 28, F + 0.3, dz),
    entry: new THREE.Vector3(cx - 28, 72, street),
  };
  P.windowDock = { pos: new THREE.Vector3(wx + 1.3 + 1.2, F - 0.2, dz), yaw: -Math.PI / 2 };
  game.scene.add(P.group);
  return P;
}
