import * as THREE from 'three';
import { kit, makeDriver, taxiArrives, boardAtDock, dropAtRank, fareComplete, giveItem, starsFrom, fadeOut, fadeIn, clearSeats } from './common.js';
import { findRoute } from '../play/ride.js';
import { streetPos, N } from '../world/layout.js';
import { createCharacter } from '../world/characters.js';
import { clamp, rand, pick } from '../core/util.js';

export async function fareLenny(game) {
  const K = kit(game);
  const { ui, st, ride, P, foot, drive } = K;
  const lenny = makeDriver(game, 'lenny');
  let vibe = 0;
  ui.objective('Your taxi is on its way… slowly…');
  await taxiArrives(game, lenny, { style: 'slow', speed: 18 });
  ui.objective('Get in the taxi');
  await boardAtDock(game, P.rank);
  game.taxi.tv('ads', ['CLOUD CHAPEL: Get hitched in the sky!', 'SLOTH EXPRESS: When you absolutely, positively need it... eventually.', 'NAP-O-RAMA MATTRESSES: Sale ends... whenever.']);
  game.taxi.setMeterRate(0.2);
  game.audio.music('lenny');
  ride.cruise();
  ride.barks = ['...nice... night...', '...honk...', '...is it... Tuesday...?'];
  ride.targetSpeed = 9;
  await K.wait(0.6);
  ui.banner('FARE #4', 'Lenny the Sloth', 'Asleep at the Wheel', 2.6);
  await K.wait(1.5);
  await K.say('lenny', '...heyyyy...', '...buddy...');
  const a = await K.choose('lenny', '...where... ya... headed...?', [
    { t: 'Could you go a little faster?' },
    { t: 'Nice tux!' },
    { t: 'Anywhere. Just hurry.' },
  ]);
  if (a === 0) await K.say('lenny', '...', '...no.');
  if (a === 1) { vibe++; await K.say('lenny', '...thanks...', '...I\'m... getting... *married*... today...'); }
  if (a === 2) await K.say('lenny', '...hurrying... is... not... really... my... thing...');
  await K.say('lenny', '...gotta get to... the *Cloud Chapel*...', '...wedding\'s... in about... ...four... minutes...',
    '...Linda and I... have been engaged... for... *eleven*... years...', '...she\'s... very... patient...');
  const b = await K.choose('lenny', '...you... okay... back there...?', [
    { t: 'We\'re going to be SO late.' },
    { t: 'Congratulations, Lenny.' },
    { t: 'Are you awake right now?', req: { reflex: 2 } },
  ]);
  if (b === 0) await K.say('lenny', '...late...', '...is just... early... for... the next... thing...');
  if (b === 1) { vibe++; await K.say('lenny', '...aww... thanks... buddy...'); }
  if (b === 2) { vibe++; await K.say('lenny', '...technically...', '...define... awake...'); }
  await K.say('lenny', '...I\'m just gonna... rest my eyes... for a...', '...zzzzzzzz...');

  // ---- Asleep at the wheel ----
  lenny.asleep = true;
  lenny.headPivot.rotation.z = 0.3;
  game.audio.play('snore');
  game.audio.music(null);
  const zzz = setInterval(() => {
    if (!lenny.root.parent) return;
    const p = lenny.headPivot.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0));
    game.fx.spawn(p, { count: 1, color: 0xffffff, map: game.fx.textSprite('Z', '#b8e8ff'), additive: false, speed: 0.2, up: 0.5, life: 1.6, size: 0.18, grow: 1.5 });
    if (Math.random() < 0.3) game.audio.play('snore', { vol: 0.5 });
  }, 700);
  ride.freeze = true;
  ui.banner('WARNING', 'PILOT UNRESPONSIVE', '', 1.4);
  game.audio.play('alert');
  let grabbed = false;
  let t = 0;
  ui.prompt('<kbd>E</kbd> GRAB THE WHEEL!');
  await new Promise((res) => {
    game.until((dt) => {
      t += dt;
      ride.pitch = Math.max(-0.5, ride.pitch - dt * 0.4);
      ride.roll = Math.sin(t * 3) * 0.2;
      ride.pos.y -= dt * (6 + t * 5);
      ride.applyTransform();
      game.addShake(0.3);
      if (Math.floor(t * 4) !== Math.floor((t - dt) * 4)) game.audio.play('beep');
      if (game.input.anyHit('KeyE', 'Space') || game.input.mouse.clicked) grabbed = true;
      if (grabbed || t > 4) { res(); return true; }
      return false;
    });
  });
  ui.prompt(null);
  ride.freeze = false;
  if (!grabbed) await K.say('you', '(You lunge for the wheel anyway. Somebody has to.)');
  game.audio.play('door');
  await fadeOut(game, 0.35);
  const start = ride.pos.clone();
  start.y = clamp(start.y, 45, 100);
  const startYaw = ride.heading;
  ride.end();
  // Move Lenny into the passenger seat.
  game.taxi.anchors.driver.remove(lenny.root);
  game.taxi.anchors.passenger.add(lenny.root);
  lenny.root.position.set(0, 0, 0);
  lenny.headPivot.rotation.z = -0.35;
  lenny.lookAt(null);

  // ---- The race ----
  const C = P.chapel;
  const course = buildCourse(start, startYaw, C);
  const gates = course.length;
  const limit = Math.round(24 + gates * 4.6);
  drive.begin({ pos: start, yaw: startYaw, passenger: lenny });
  game.audio.music('drive');
  await fadeIn(game, 0.35);
  ui.banner('YOU\'RE DRIVING', 'Get Lenny to his wedding!', `${gates} gates · ${limit} seconds`, 2.2);
  ui.hint('<span class="kbd">MOUSE</span> steer · <span class="kbd">W</span> go · <span class="kbd">S</span> brake · <span class="kbd">A/D</span> strafe · <span class="kbd">SPACE/C</span> up/down · <span class="kbd">SHIFT</span> boost');
  const sleepTalk = ['...Linda... no... the cake is... a snake...', '...five more... minutes...', '...I do... I do... I do-do-do...', '...who put... the city... in the sky...', '...zzz... honk if you\'re... sleepy...', '...eleven years... worth it...'];
  let result;
  for (let tryN = 1; ; tryN++) {
    let time = 0;
    let passed = 0;
    let barkT = 8;
    drive.pos.copy(start);
    drive.vel.set(0, 0, 0);
    drive.yaw = startYaw;
    drive.pitch = 0;
    drive.bumps = 0;
    drive.onBump = (kind) => { if (kind === 'car' && Math.random() < 0.5) ui.bark('LENNY (asleep)', '...honk... honk...'); };
    const finished = drive.setCourse(course, {
      onGate: (i) => {
        passed = i + 1;
        if (i < gates - 1) ui.toast(`Gate ${i + 1}/${gates}`, 'good');
      },
    });
    ui.objective(`Fly through the gates to the <b>Cloud Chapel</b>`);
    let done = false;
    finished.then(() => { done = true; });
    const out = await new Promise((res) => {
      game.until((dt) => {
        if (game.paused) return false;
        time += dt;
        const left = limit - time;
        ui.timer(Math.max(0, left), 12);
        ui.meter('gates', { label: 'GATES', value: passed / gates, color: '#33f0ff', right: `${passed}/${gates}` });
        barkT -= dt;
        if (barkT <= 0) { barkT = rand(9, 14); ui.bark('LENNY (asleep)', pick(sleepTalk), 3.5); }
        if (done) { res({ ok: true, time, bumps: drive.bumps }); return true; }
        if (left <= 0) { res({ ok: false, time, passed }); return true; }
        return false;
      });
    });
    ui.timer(null);
    ui.meter('gates', { value: null });
    if (out.ok) { result = out; break; }
    drive.clearCourse();
    game.audio.play('fail');
    drive.frozen = true;
    game.input.releaseLock();
    const c = await K.choose('you', `(Time's up! ${out.passed}/${gates} gates. Lenny is still asleep. Somewhere, Linda is waiting.)`, [
      { t: 'Try again from the start.' },
      { t: 'Just get him there. Late is still married.' },
    ]);
    drive.frozen = false;
    if (c === 1) { result = { ok: false, time: limit, bumps: drive.bumps, late: true }; break; }
  }
  ui.hint(null);
  ui.objective(null);
  clearInterval(zzz);
  game.audio.play('success');
  await fadeOut(game, 0.6);
  drive.end();
  // Park at the chapel
  clearSeats(game);
  lenny.asleep = false;
  lenny.headPivot.rotation.z = 0;
  game.taxi.root.visible = true;
  game.taxi.root.position.copy(C.dock.pos);
  game.taxi.root.rotation.set(0, C.dock.yaw, 0);
  game.taxi.setDoor(true);
  foot.enter(C, C.spawn);
  game.audio.music('wedding');
  // Lenny standing at the altar
  const lennyStand = createCharacter('lenny', { standing: true });
  C.addActor(lennyStand, C.center.x - 7, C.center.y, C.center.z + 1.2, -Math.PI / 2);
  game.dialogue.register('lenny', lennyStand);
  game.dialogue.register('linda', C.linda);
  game.dialogue.define('officiant', { name: 'Rev. Shellby', species: 'Tortoise · Officiant', voice: 'tortoise' });
  game.dialogue.register('officiant', C.actors.find((a) => a !== C.linda && !C.guests.includes(a) && a !== lennyStand));
  foot.yaw = Math.PI / 2;
  await fadeIn(game, 0.6);
  ui.banner('THE CLOUD CHAPEL', result.late ? 'Fashionably late' : 'Made it!', result.late ? 'Very, very late.' : `${Math.round(result.time)} seconds flat`, 2.2);
  await K.wait(1.2);
  await K.say('lenny', '...huh...?', '...did... I... miss... anything...?');
  await K.say('linda', result.late ? '...you\'re... late...' : '...you\'re... early...', result.late ? '...I\'m... used to it...' : '...for... once... in your... life...');
  await K.say('officiant', 'Dearly beloved. We are gathered here today. Because it took eleven years. To gather.',
    'Do you, Lenny, take Linda, to be your lawfully wedded sloth?');
  await K.say('lenny', '...', '...', '...I... do...');
  await K.say('officiant', 'And do you, Linda, take Lenny?');
  await K.say('linda', '...I... do...');
  await K.say('officiant', 'Then by the power vested in me by the Sky Council, I now pronounce you... sloth and sloth. You may kiss the bride.',
    'Slowly. You\'ve earned it.');
  game.audio.play('kiss');
  game.audio.play('cheer');
  const heartTex = game.fx.textSprite('♥', '#ff3d8b');
  for (let i = 0; i < 6; i++) setTimeout(() => game.fx.spawn(C.center.clone().add(new THREE.Vector3(-7, 2.5, 0)), { count: 8, map: heartTex, additive: false, color: 0xffffff, speed: 2, up: 2, life: 2.2, size: 0.4, gravity: -0.2 }), i * 200);
  const confetti = [0xff3d8b, 0x33f0ff, 0xffd23f, 0x6dff8a];
  for (const col of confetti) game.fx.spawn(C.center.clone().add(new THREE.Vector3(-3, 5, 0)), { count: 25, color: col, speed: 6, up: 3, life: 2.5, size: 0.25, gravity: 3 });
  for (const gu of C.guests) gu.speedMul = 1.2;
  await K.wait(1.2);
  await K.say('linda', '...bouquet... time...');
  // ---- Bouquet catch ----
  const caughtBouquet = await bouquetToss(game, C);
  if (caughtBouquet) { giveItem(game, 'bouquet'); await K.say('linda', '...ooh... you\'re... next...'); }
  else await K.say('linda', '...it... landed... on... Grandma Sloth...', '...she\'s... thrilled...');
  await K.say('lenny', '...buddy...', '...you saved... my wedding...', '...here\'s... your fare... it\'s a *check*...', '...should clear... in six to eight... weeks...', '...kidding... here\'s... cash...');
  C.actors.splice(C.actors.indexOf(lennyStand), 1);
  C.group.remove(lennyStand.root);
  await dropAtRank(game);
  const stars = starsFrom((result.late ? 1.8 : 3.3 + clamp((limit - result.time) / limit, 0, 1) * 2) - Math.min(1.2, (result.bumps || 0) * 0.06) + (caughtBouquet ? 0.3 : 0) + vibe * 0.15);
  st.setFlag('license');
  await fareComplete(game, {
    driverId: 'lenny', name: 'Lenny the Sloth', stars, pay: 80, xp: 190,
    quote: stars >= 4 ? '...best... day... of my... life...' : '...we... made it... eventually...',
    extraRows: [['Flight time', result.late ? 'Late' : `${Math.round(result.time)}s / ${limit}s`], ['Bumps & honks', `${result.bumps || 0}`], ['Bouquet', caughtBouquet ? 'Caught!' : 'Grandma got it']],
  });
  game.dialogue.unregister('lenny');
  game.dialogue.unregister('linda');
}

// Gates along the streets toward the chapel, with a detour if the cab fell asleep too close.
function buildCourse(start, yaw, C) {
  const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const fx = (start.x + 672) / 96, fz = (start.z + 672) / 96;
  const s = Math.abs(f.x) > Math.abs(f.z)
    ? { kx: clamp(Math.round(fx + Math.sign(f.x) * 0.7), 1, N - 1), kz: clamp(Math.round(fz), 1, N - 1), d: f.x > 0 ? 0 : 1 }
    : { kx: clamp(Math.round(fx), 1, N - 1), kz: clamp(Math.round(fz + Math.sign(f.z) * 0.7), 1, N - 1), d: f.z > 0 ? 2 : 3 };
  const goal = { kx: 12, kz: 6 };
  let best = findRoute(s, s.d, goal);
  if (best.length < 10) {
    for (let k = 0; k < 20; k++) {
      const mid = { kx: 1 + Math.floor(Math.random() * (N - 1)), kz: 1 + Math.floor(Math.random() * (N - 1)) };
      if ((mid.kx === 7 && mid.kz === 7) || (mid.kx === 10 && mid.kz === 10)) continue;
      const r1 = findRoute(s, s.d, mid);
      const r2 = findRoute(mid, 0, goal);
      const total = r1.concat(r2.slice(1));
      if (total.length >= 10 && total.length <= 17) { best = total; break; }
    }
  }
  const alts = [62, 96, 52, 118, 76, 48, 104, 70];
  const pts = best.slice(1).map((n, i) => new THREE.Vector3(streetPos(n.kx), alts[i % alts.length], streetPos(n.kz)));
  pts.push(new THREE.Vector3(C.dock.entry.x, 100, C.dock.entry.z));
  pts.push(C.dock.pre.clone().add(new THREE.Vector3(0, 1, 0)));
  pts.push(C.dock.pos.clone().add(new THREE.Vector3(0, 1.5, 0)));
  return pts;
}

function bouquetToss(game, C) {
  const ui = game.ui;
  const foot = game.foot;
  const reflex = game.state.stat('reflex');
  const b = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshToonMaterial({ color: [0xff7ab8, 0xffffff, 0xffd23f][i % 3] }));
    f.position.set(Math.cos(i) * 0.15, 0.1 + (i % 2) * 0.08, Math.sin(i) * 0.15);
    b.add(f);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.4, 6), new THREE.MeshToonMaterial({ color: 0x3a9a4a }));
  stem.position.y = -0.15;
  b.add(stem);
  b.scale.setScalar(1.6);
  const from = C.linda.root.position.clone().add(new THREE.Vector3(0, 1.6, 0));
  game.scene.add(b);
  b.position.copy(from);
  ui.objective('Catch the bouquet! Aim at it and <b>CLICK</b>');
  ui.bark('LINDA', '...heeeere... it... comes...', 3);
  const ray = new THREE.Raycaster();
  let t = -1.2;
  const T = 2.3;
  let target = null;
  let caught = false;
  return new Promise((resolve) => {
    game.until((dt) => {
      t += dt;
      if (t < 0) return false;
      if (!target) {
        target = foot.pos.clone().add(new THREE.Vector3(rand(-2.5, 2.5), 0.8, rand(-2.5, 2.5)));
        game.audio.play('whoosh');
      }
      const u = Math.min(1, t / T);
      b.position.lerpVectors(from, target, u);
      b.position.y += Math.sin(u * Math.PI) * 6;
      b.rotation.x += dt * 5;
      b.rotation.z += dt * 3;
      if ((game.input.mouse.clicked || game.input.hit('KeyE')) && !caught && u > 0.2) {
        ray.setFromCamera(new THREE.Vector2(0, 0), game.camera);
        const d = ray.ray.distanceToPoint(b.position);
        const dist = game.camera.getWorldPosition(new THREE.Vector3()).distanceTo(b.position);
        if (d < 0.9 + (reflex - 1) * 0.25 + dist * 0.04 && dist < 14) caught = true;
      }
      if (caught || u >= 1) {
        game.scene.remove(b);
        ui.objective(null);
        game.audio.play(caught ? 'grab' : 'land');
        resolve(caught);
        return true;
      }
      return false;
    });
  });
}
