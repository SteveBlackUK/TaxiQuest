import * as THREE from 'three';
import { toon, glowMat, lambert, drawTexture, checkerTexture, neonText, glowTexture, FONT_DISPLAY, FONT_BODY, roundRect, wrapLines, toonGradient } from '../core/textures.js';
import { add } from '../core/geom.js';

const YELLOW = 0xffbf1f;

function taxiSignTexture(text = 'TAXI', color = '#ffd23f') {
  return drawTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#1a1206';
    g.fillRect(0, 0, w, h);
    neonText(g, text, w / 2, h / 2 + 2, color, 42, { glow: 12 });
  });
}

// A flying taxi. Faces -Z. Origin at the floor center.
export function createTaxi({ robo = false, color = YELLOW } = {}) {
  const root = new THREE.Group();
  root.name = 'taxi';
  const body = new THREE.Group();
  root.add(body);
  const shell = new THREE.Group();      // hidden when the camera is inside
  const always = new THREE.Group();
  const interior = new THREE.Group();
  body.add(shell, always, interior);

  const paint = toon(robo ? 0xe8ecf2 : color);
  const dark = toon(0x1c1a26);
  const trim = toon(robo ? 0xd22a3a : 0x2a2a33);
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a55, transparent: true, opacity: 0.45, emissive: 0x0a1030, depthWrite: false });

  // Hood (always visible — you see it through the windshield)
  add(always, new THREE.BoxGeometry(2.3, 0.62, 1.3), paint, 0, 0.7, -2.05);
  add(always, new THREE.BoxGeometry(2.1, 0.2, 0.9), paint, 0, 1.06, -1.95).rotation.x = 0.12;
  add(always, new THREE.BoxGeometry(2.36, 0.22, 0.2), trim, 0, 0.55, -2.72); // bumper
  // Headlights
  const hl = glowMat(0xfff4d0, 4);
  add(always, new THREE.BoxGeometry(0.5, 0.16, 0.06), hl, -0.72, 0.82, -2.72);
  add(always, new THREE.BoxGeometry(0.5, 0.16, 0.06), hl, 0.72, 0.82, -2.72);

  // Rear body and sides
  add(shell, new THREE.BoxGeometry(2.3, 0.66, 4.1), paint, 0, 0.72, 0.6);
  add(shell, new THREE.BoxGeometry(2.36, 0.22, 0.2), trim, 0, 0.55, 2.68);
  const tl = glowMat(robo ? 0xff2030 : 0xff3040, 4);
  add(shell, new THREE.BoxGeometry(0.6, 0.14, 0.06), tl, -0.75, 0.9, 2.66);
  add(shell, new THREE.BoxGeometry(0.6, 0.14, 0.06), tl, 0.75, 0.9, 2.66);
  // Checker stripes
  if (!robo) {
    const ck = checkerTexture('#15131c', '#e8dcb0', 20);
    ck.repeat.set(1, 1);
    const ckMat = new THREE.MeshToonMaterial({ map: ck, gradientMap: toonGradient() });
    const left = add(shell, new THREE.PlaneGeometry(5.3, 0.16), ckMat, -1.16, 0.93, -0.05, 0, -Math.PI / 2, 0);
    const right = add(shell, new THREE.PlaneGeometry(5.3, 0.16), ckMat, 1.16, 0.93, -0.05, 0, Math.PI / 2, 0);
    left.renderOrder = right.renderOrder = 1;
  } else {
    const stripe = glowMat(0xff2030, 2.5);
    add(shell, new THREE.BoxGeometry(0.02, 0.08, 5.2), stripe, -1.16, 0.93, 0);
    add(shell, new THREE.BoxGeometry(0.02, 0.08, 5.2), stripe, 1.16, 0.93, 0);
  }
  // Greenhouse: roof, pillars, glass
  add(shell, new THREE.BoxGeometry(2.14, 0.1, 2.9), paint, 0, 1.76, 0.5);
  const pillar = (x, z, h = 0.72, lean = 0) => {
    const m = add(shell, new THREE.BoxGeometry(0.1, h, 0.12), paint, x, 1.4, z);
    m.rotation.x = lean;
    return m;
  };
  pillar(-1.04, -1.12, 0.8, -0.55); pillar(1.04, -1.12, 0.8, -0.55);
  pillar(-1.04, 0.45); pillar(1.04, 0.45);
  pillar(-1.04, 2.0, 0.8, 0.5); pillar(1.04, 2.0, 0.8, 0.5);
  const gl = (w, h, x, y, z, ry, rx = 0) => { const m = add(shell, new THREE.PlaneGeometry(w, h), glass, x, y, z, rx, ry, 0); m.renderOrder = 2; return m; };
  gl(2.05, 0.85, 0, 1.38, -1.12, 0, -0.55).rotation.order = 'YXZ';
  gl(2.05, 0.8, 0, 1.38, 2.0, Math.PI, -0.5);
  gl(1.5, 0.66, -1.08, 1.38, -0.3, -Math.PI / 2);
  gl(1.5, 0.66, 1.08, 1.38, -0.3, Math.PI / 2);
  gl(1.45, 0.66, -1.08, 1.38, 1.22, -Math.PI / 2);

  // Rear right gull-wing door (the one you climb into)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(1.12, 1.76, 1.22);
  shell.add(doorPivot);
  const door = new THREE.Group();
  doorPivot.add(door);
  add(door, new THREE.BoxGeometry(0.06, 0.7, 1.45), paint, 0.03, -1.05, 0);
  const dg = add(door, new THREE.PlaneGeometry(1.4, 0.64), glass, 0.04, -0.37, 0, 0, Math.PI / 2, 0);
  dg.renderOrder = 2;

  // Roof sign
  const signTex = taxiSignTexture(robo ? 'ROBO' : 'TAXI', robo ? '#ff3040' : '#ffd23f');
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, color: new THREE.Color(2.2, 2.2, 2.2) });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.26, 0.3), [dark, dark, dark, dark, signMat, signMat]);
  sign.position.set(0, 1.95, 0.4);
  shell.add(sign);

  // Hover thrusters
  const thrusters = [];
  const thrMat = glowMat(robo ? 0xff3040 : 0x33f0ff, 3);
  const glowSpriteMat = new THREE.SpriteMaterial({ map: glowTexture(), color: robo ? 0xff4050 : 0x44e8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  for (const [x, z] of [[-1.1, -1.8], [1.1, -1.8], [-1.1, 1.8], [1.1, 1.8]]) {
    const pod = add(always, new THREE.CylinderGeometry(0.34, 0.42, 0.34, 12), trim, x, 0.3, z);
    add(pod, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), thrMat, 0, -0.18, 0);
    const spr = new THREE.Sprite(glowSpriteMat);
    spr.scale.set(1.6, 1.6, 1);
    spr.position.set(x, 0.02, z);
    always.add(spr);
    thrusters.push(spr);
  }

  // ---------------- Interior ----------------
  const seatTex = drawTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#4a2372'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      const grd = g.createLinearGradient(x, 0, x + 16, 0);
      grd.addColorStop(0, '#2e1250'); grd.addColorStop(0.5, '#5b2d8c'); grd.addColorStop(1, '#2e1250');
      g.fillStyle = grd; g.fillRect(x, 0, 16, h);
    }
    g.strokeStyle = 'rgba(255,194,26,0.5)'; g.setLineDash([4, 4]); g.lineWidth = 2;
    g.strokeRect(3, 3, w - 6, h - 6);
  });
  const seatMat = new THREE.MeshToonMaterial({ map: seatTex, gradientMap: toonGradient() });
  const seatTrim = toon(0xffc21a);
  const panelMat = toon(0x2b2340);
  add(interior, new THREE.BoxGeometry(2.1, 0.06, 4.0), toon(0x17141f), 0, 0.4, 0.3);
  // Door panels with glowing strips
  for (const s of [-1, 1]) {
    add(interior, new THREE.BoxGeometry(0.1, 0.62, 3.3), panelMat, s * 1.07, 0.72, 0.35);
    add(interior, new THREE.BoxGeometry(0.02, 0.03, 3.2), glowMat(0xff3d8b, 2.5), s * 1.01, 0.98, 0.35);
    add(interior, new THREE.BoxGeometry(0.2, 0.06, 3.3), panelMat, s * 1.0, 1.04, 0.35);
  }
  // Interior pillars / roof liner (visible from inside)
  const ip = toon(0x221c33);
  const ipillar = (x, z, h, lean) => { const m = add(interior, new THREE.BoxGeometry(0.09, h, 0.1), ip, x, 1.4, z); m.rotation.x = lean; };
  ipillar(-1.0, -1.1, 0.8, -0.55); ipillar(1.0, -1.1, 0.8, -0.55);
  ipillar(-1.0, 0.45, 0.72, 0); ipillar(1.0, 0.45, 0.72, 0);
  ipillar(-1.0, 1.98, 0.8, 0.5); ipillar(1.0, 1.98, 0.8, 0.5);
  add(interior, new THREE.BoxGeometry(2.1, 0.05, 2.9), toon(0x1e1830), 0, 1.72, 0.5);
  // Faint windshield so you know it's glass
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.85), new THREE.MeshBasicMaterial({ color: 0x6080ff, transparent: true, opacity: 0.05, depthWrite: false }));
  ws.position.set(0, 1.38, -1.1);
  ws.rotation.x = -0.55;
  interior.add(ws);

  // Dashboard
  const dash = new THREE.Group();
  dash.position.set(0, 0, 0);
  interior.add(dash);
  add(dash, new THREE.BoxGeometry(2.1, 0.36, 0.5), toon(0x1a1626), 0, 0.88, -1.42);
  add(dash, new THREE.BoxGeometry(2.1, 0.06, 0.52), toon(0x2c2440), 0, 1.07, -1.4);
  add(dash, new THREE.BoxGeometry(2.0, 0.015, 0.015), glowMat(0x33f0ff, 1.4), 0, 1.08, -1.14);
  // Holo screen in front of driver
  const dashScreenTex = drawTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#04121c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#33f0ff'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
    neonText(g, 'AUTOPILOT: OFF', w / 2, 34, '#33f0ff', 22, { font: FONT_DISPLAY });
    neonText(g, 'BANANAS: LOW', w / 2, 72, '#ffd23f', 18, { font: FONT_DISPLAY });
    neonText(g, 'VIBES: IMMACULATE', w / 2, 104, '#ff3d8b', 16, { font: FONT_DISPLAY });
  });
  const dashScreen = add(dash, new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: dashScreenTex, color: new THREE.Color(1.4, 1.4, 1.4) }), -0.45, 1.16, -1.3, -0.5, 0, 0);
  // Yoke
  const yoke = new THREE.Group();
  yoke.position.set(-0.5, 1.0, -1.02);
  yoke.rotation.x = -0.9;
  dash.add(yoke);
  add(yoke, new THREE.TorusGeometry(0.17, 0.03, 8, 20, Math.PI * 1.3), toon(0x111111), 0, 0, 0, 0, 0, -Math.PI * 0.15 - Math.PI / 2 + 0.3);
  add(yoke, new THREE.BoxGeometry(0.34, 0.05, 0.05), toon(0x111111), 0, 0, 0);
  add(yoke, new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), toon(0x222222), 0, 0, -0.15, Math.PI / 2, 0, 0);
  // Fare meter
  const meterCanvasTex = drawTexture(256, 96, () => {});
  const meter = add(dash, new THREE.BoxGeometry(0.34, 0.14, 0.12), toon(0x111111), 0.12, 1.17, -1.32);
  const meterFace = add(dash, new THREE.PlaneGeometry(0.3, 0.11), new THREE.MeshBasicMaterial({ map: meterCanvasTex, color: new THREE.Color(1.6, 1.6, 1.6) }), 0.12, 1.17, -1.255, -0.1, 0, 0);
  // Rear-view mirror + fuzzy dice
  add(interior, new THREE.BoxGeometry(0.36, 0.1, 0.05), toon(0x111111), 0, 1.6, -0.92);
  add(interior, new THREE.PlaneGeometry(0.32, 0.075), lambert(0x8fa6d8, { emissive: 0x223355 }), 0, 1.6, -0.894);
  const dice = new THREE.Group();
  dice.position.set(0.1, 1.55, -0.94);
  interior.add(dice);
  const diceMat = toon(0xff3d8b);
  const d1 = add(dice, new THREE.BoxGeometry(0.07, 0.07, 0.07), diceMat, -0.03, -0.14, 0, 0.3, 0.4, 0);
  const d2 = add(dice, new THREE.BoxGeometry(0.07, 0.07, 0.07), diceMat, 0.04, -0.17, 0.01, 0.8, 0.2, 0.3);
  add(dice, new THREE.CylinderGeometry(0.004, 0.004, 0.13, 4), toon(0xffffff), -0.015, -0.07, 0);
  // Dash bobble slot
  const bobbleAnchor = new THREE.Group();
  bobbleAnchor.position.set(0.6, 1.1, -1.35);
  interior.add(bobbleAnchor);

  // Seats (front backrests kept low so you can see past them from the back)
  const seat = (x, z, wide = false) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    interior.add(g);
    const w = wide ? 1.9 : 0.62;
    add(g, new THREE.BoxGeometry(w, 0.16, 0.6), seatMat, 0, 0.56, 0);
    if (wide) {
      add(g, new THREE.BoxGeometry(w, 0.8, 0.14), seatMat, 0, 1.0, 0.36).rotation.x = -0.15;
    } else {
      add(g, new THREE.BoxGeometry(w, 0.5, 0.14), seatMat, 0, 0.88, 0.3).rotation.x = -0.12;
      add(g, new THREE.BoxGeometry(w + 0.02, 0.04, 0.16), seatTrim, 0, 1.14, 0.33);
    }
    add(g, new THREE.BoxGeometry(w + 0.02, 0.03, 0.02), seatTrim, 0, 0.65, -0.3);
    return g;
  };
  seat(-0.5, -0.3);
  const passSeat = seat(0.5, -0.3);
  seat(0, 1.25, true);

  // Taxi TV on the back of the front passenger seat
  const tvTex = drawTexture(320, 192, () => {});
  const tvGroup = new THREE.Group();
  tvGroup.position.set(0.5, 0.88, 0.12);
  tvGroup.rotation.x = -0.22;
  interior.add(tvGroup);
  add(tvGroup, new THREE.BoxGeometry(0.44, 0.28, 0.04), toon(0x111111), 0, 0, 0);
  const tvScreen = add(tvGroup, new THREE.PlaneGeometry(0.4, 0.24), new THREE.MeshBasicMaterial({ map: tvTex, color: new THREE.Color(1.3, 1.3, 1.3) }), 0, 0, 0.021);

  // Driver license card clipped to the passenger visor area
  const licenseTex = drawTexture(256, 160, () => {});
  const license = add(interior, new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ map: licenseTex }), 0.62, 1.62, -0.85, 0.3, Math.PI, 0);
  license.rotation.set(-0.35, 0, 0);
  license.position.set(0.55, 1.58, -0.9);
  // flip to face the back seat
  license.rotation.y = 0;

  // Lights
  const cabLight = new THREE.PointLight(0xffd9a8, 0.9, 3.2, 0);
  cabLight.position.set(0, 1.3, 0.4);
  interior.add(cabLight);
  const dashLight = new THREE.PointLight(0x33c8ff, 0.7, 1.8, 0);
  dashLight.position.set(-0.3, 1.2, -1.1);
  interior.add(dashLight);

  // Anchors
  const anchors = {};
  const mk = (name, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); body.add(o); anchors[name] = o; return o; };
  mk('driver', -0.5, 0.64, -0.3);
  mk('passenger', 0.5, 0.64, -0.3);
  mk('rearLeft', -0.5, 0.64, 1.25);
  mk('rearMid', 0, 0.64, 1.25);
  mk('rearRight', 0.5, 0.64, 1.25);
  mk('eyeRear', 0.36, 1.5, 1.3);
  mk('eyeDriver', -0.5, 1.42, -0.26);
  mk('roof', 0, 1.82, 0.5);

  // ---------- API ----------
  const state = { fare: 0, tvMode: 'ads', tvTimer: 0, tvScroll: 0, tvMessages: [], tvIdx: 0, doorOpen: 0, doorTarget: 0, inside: false, t: 0, meterRate: 1.2 };

  const taxi = {
    root, body, shell, always, interior, anchors, thrusters, state, dice, bobbleAnchor, passSeat,
    setInside(v) {
      state.inside = v;
      shell.visible = !v;
    },
    setDoor(open) { state.doorTarget = open ? 1 : 0; },
    setLicense(name, species, photo) {
      const g = licenseTex.userData.ctx;
      const w = 256, h = 160;
      g.fillStyle = '#f3efe0'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffbf1f'; g.fillRect(0, 0, w, 30);
      g.fillStyle = '#111'; g.font = `18px ${FONT_DISPLAY}`; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('NEO-SERENGETI HACK LICENSE', 8, 16);
      g.fillStyle = '#ccc'; g.fillRect(10, 40, 80, 100);
      if (photo) g.drawImage(photo, 10, 40, 80, 100);
      g.fillStyle = '#111'; g.font = `20px ${FONT_DISPLAY}`;
      g.fillText(name.toUpperCase(), 100, 62);
      g.font = `bold 16px ${FONT_BODY}`;
      g.fillText(species, 100, 90);
      g.fillText('#' + (1000 + Math.floor(Math.random() * 8999)), 100, 116);
      licenseTex.needsUpdate = true;
    },
    setMeterRate(r) { state.meterRate = r; },
    resetFare() { state.fare = 0; },
    tv(mode, messages) {
      state.tvMode = mode;
      state.tvMessages = messages || [];
      state.tvIdx = 0;
      state.tvTimer = 0;
      state.tvScroll = 0;
      drawTv(true);
    },
    update(dt, speed = 0) {
      state.t += dt;
      const t = state.t;
      // door
      state.doorOpen += (state.doorTarget - state.doorOpen) * Math.min(1, dt * 5);
      doorPivot.rotation.x = 0;
      doorPivot.rotation.z = state.doorOpen * 1.25;
      // thruster flicker
      for (let i = 0; i < thrusters.length; i++) {
        const s = 1.3 + Math.sin(t * 30 + i * 2) * 0.12 + speed * 0.02;
        thrusters[i].scale.set(s, s, 1);
      }
      // dice pendulum
      dice.rotation.z = Math.sin(t * 2.2) * 0.25 + speed * 0.004;
      dice.rotation.x = Math.sin(t * 1.7) * 0.15;
      if (state.inside) {
        state.fare += dt * state.meterRate;
        state.meterAcc = (state.meterAcc || 0) + dt;
        if (state.meterAcc > 0.2) { state.meterAcc = 0; drawMeter(); }
        drawTv(false, dt);
      }
    },
  };

  function drawMeter() {
    const g = meterCanvasTex.userData.ctx;
    g.fillStyle = '#100404'; g.fillRect(0, 0, 256, 96);
    g.font = `44px ${FONT_DISPLAY}`;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillStyle = '#ff3a2a'; g.shadowColor = '#ff3a2a'; g.shadowBlur = 10;
    g.fillText('₡' + state.fare.toFixed(2), 244, 52);
    g.shadowBlur = 0;
    g.font = `14px ${FONT_DISPLAY}`; g.fillStyle = '#ff9a8a'; g.textAlign = 'left';
    g.fillText('FARE', 10, 16);
    meterCanvasTex.needsUpdate = true;
  }

  let tvAcc = 0;
  function drawTv(force, dt = 0) {
    tvAcc += dt;
    if (!force && tvAcc < 0.08) return;
    const step = tvAcc;
    tvAcc = 0;
    const g = tvTex.userData.ctx;
    const w = 320, h = 192;
    state.tvTimer += step;
    state.tvScroll += step * 70;
    const msgs = state.tvMessages.length ? state.tvMessages : DEFAULT_ADS;
    if (state.tvTimer > 6) { state.tvTimer = 0; state.tvIdx = (state.tvIdx + 1) % msgs.length; }
    const msg = msgs[state.tvIdx % msgs.length];
    if (state.tvMode === 'news') {
      g.fillStyle = '#0a0f2a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d8203a'; g.fillRect(0, 0, w, 34);
      g.font = `20px ${FONT_DISPLAY}`; g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText((Math.floor(state.t * 2) % 2 ? '● ' : '  ') + 'BREAKING NEWS', 10, 18);
      g.font = `bold 22px ${FONT_BODY}`; g.fillStyle = '#fff';
      const lines = wrapLines(g, msg, w - 24);
      lines.slice(0, 4).forEach((l, i) => g.fillText(l, 12, 62 + i * 27));
      g.fillStyle = '#ffd23f'; g.fillRect(0, h - 26, w, 26);
      g.fillStyle = '#111'; g.font = `bold 16px ${FONT_BODY}`;
      const ticker = 'NSN 24/7 · TRAFFIC ON SKY LEVEL 60 IS "FINE" · WEATHER: NEON WITH A CHANCE OF DRONES · ';
      const tw = g.measureText(ticker).width;
      const off = -(state.tvScroll % tw);
      g.fillText(ticker + ticker, off, h - 13);
    } else {
      const hue = (state.tvIdx * 67) % 360;
      g.fillStyle = `hsl(${hue},70%,18%)`; g.fillRect(0, 0, w, h);
      g.fillStyle = `hsl(${hue},90%,60%)`;
      g.font = `26px ${FONT_DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lines = wrapLines(g, msg, w - 30);
      const pulse = 1 + Math.sin(state.t * 4) * 0.03;
      g.save(); g.translate(w / 2, h / 2); g.scale(pulse, pulse);
      lines.slice(0, 4).forEach((l, i) => g.fillText(l, 0, (i - (Math.min(4, lines.length) - 1) / 2) * 32));
      g.restore();
      g.font = `12px ${FONT_DISPLAY}`; g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillText('TAXI TV · CANNOT BE TURNED OFF', w / 2, h - 12);
    }
    tvTex.needsUpdate = true;
  }
  drawMeter();
  drawTv(true);
  taxi.setLicense('Unknown', 'Animal');
  return taxi;
}

const DEFAULT_ADS = [
  'McSNACKERS: Try the new Quantum Nuggets!',
  'LLAMA LOANS: No credit? No problem. No escape.',
  'Tired of walking? So are we. Take a cab.',
  'HIPPO HOTEL: Mud baths now zero-gravity!',
  'This screen cannot be turned off. We tried.',
  'OTTER SPACE: Holding hands across the galaxy.',
];
