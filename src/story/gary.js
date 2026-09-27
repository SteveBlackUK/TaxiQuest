import * as THREE from 'three';
import { kit, makeDriver, taxiArrives, boardAtDock, exitTaxi, dropAtRank, fareComplete, giveItem, starsFrom, fadeOut, fadeIn } from './common.js';
import { Guard, moneyBag } from '../places/bank.js';

export async function fareGary(game) {
  const K = kit(game);
  const { ui, st, ride, P, foot } = K;
  const gary = makeDriver(game, 'gary');
  let vibe = 0;
  ui.objective('Your taxi is on its way…');
  await taxiArrives(game, gary, { style: 'aggressive', speed: 40 });
  ui.objective('Get in the taxi');
  await boardAtDock(game, P.rank);
  game.taxi.tv('ads', ['LLAMA LOANS: No credit? No problem. No escape.', 'GALACTIC RESERVE: Your money is safe with us!*', '*Terms and conditions apply.']);
  game.audio.music('heist');
  ride.cruise();
  ride.barks = ['Don\'t look at the cops. Don\'t look at the cops.', 'Nice night for a crime.', 'You ever notice the moon looks like a banana? No? Just me.'];
  await K.wait(0.6);
  ui.banner('FARE #3', 'Gary the Gorilla', 'The Big Banana Job', 2.6);
  await K.wait(1.3);
  await K.say('gary', '...Close the door.', 'Sit down. Don\'t touch the bananas.',
    'You\'re the one who got Carl his Snappy Meal. Found Sheila\'s kid. Word travels fast on the rank.',
    'I need somebody with a... *clean record*.');
  const a = await K.choose('gary', 'You in the market for some work?', [
    { t: 'What\'s the job?' },
    { t: 'I just need a ride to—' },
    { t: 'I\'m listening.', req: { nerve: 2 } },
  ]);
  if (a === 1) await K.say('gary', 'That wasn\'t a question, kid.');
  if (a === 2) { vibe += 2; await K.say('gary', '...Good. Nerves of steel. I like that.'); }
  await K.say('gary', 'The *Galactic Reserve Bank*. They foreclosed on my banana plantation on Moon 3. Evicted my whole family.',
    'My nana\'s living in a bus shelter on Ganymede. She\'s ninety. She\'s got a bad hip. She\'s got a WORSE attitude.',
    'So we\'re gonna make a little... *withdrawal*.');
  const b = await K.choose('gary', 'So. You in?', [
    { t: 'I\'m in.' },
    { t: 'Absolutely not.' },
    { t: 'What\'s my cut?', req: { charm: 2 } },
  ]);
  if (b === 0) { vibe++; await K.say('gary', 'Knew it. I got a nose for this stuff. Well. A big nose. For everything.'); }
  if (b === 1) { game.audio.play('beep'); await K.say('gary', '*click*', 'Child locks. Not optional.', 'You\'re in.'); }
  if (b === 2) { st.setFlag('bigCut'); vibe++; await K.say('gary', '...Thirty percent. You drive a hard bargain, kid. I respect it.'); }
  await K.say('gary',
    'The plan. You walk in the front like a normal customer. The *vault keycard* is in the manager\'s office.',
    '*SecuriBots* patrol the halls. Stay out of their flashlights. If one stares at you too long, the alarm goes off.',
    'Alarm goes off, you got about a minute before the doors seal. Grab the *money bags* and get OUT.',
    'There\'s a laser grid in the back hall. *Crouch* under it. That\'s the *C key*, right? That\'s what they call it?');
  const c = await K.choose('gary', 'Any questions?', [
    { t: 'What\'s the C key?' },
    { t: 'Who are you talking to?' },
    { t: 'No questions.' },
  ]);
  if (c === 0) await K.say('gary', 'Don\'t worry about it.');
  if (c === 1) await K.say('gary', '...Nobody. Focus.');
  if (c === 2) vibe++;
  const arrive = ride.goTo(P.bankExt);
  ride.targetSpeed = 50;
  await K.say('gary', 'And kid. If you see a *golden banana* in that vault... it was my great-grandpappy\'s. Bring it home.');
  await arrive;
  await K.say('gary', 'Engine stays running. Go.');

  // ---- On the landing pad ----
  const E = P.bankExt;
  await exitTaxi(game, E, E.spawn);
  let result = null;
  let attempts = 0;
  while (!result) {
    ui.objective('Walk into the <b>Galactic Reserve Bank</b>');
    await new Promise((res) => {
      E.interactables.length = 0;
      E.interact(E.doorPos, 'Enter the bank (act natural)', () => { E.interactables.length = 0; res(); }, { radius: 3.5 });
    });
    attempts++;
    result = await runHeist(game, attempts);
  }
  // Back outside with the loot
  ui.objective('Get back in the taxi!');
  await boardAtDock(game, E, 'Jump in the getaway taxi');
  game.taxi.tv('news', ['GALACTIC RESERVE ROBBED! Suspect last seen carrying bags with little ₡ signs on them.', 'Police deploy sky drones. Drones "very angry."']);
  await K.say('gary', 'GO GO GO!');
  // ---- Getaway chase ----
  ride.cruise();
  ride.targetSpeed = 55;
  game.audio.music('chase');
  await K.say('gary', 'Sky Police drones! Lean out the window and hit \'em with these!', '*tosses you a bunch of bananas*');
  let chase;
  for (;;) {
    ui.objective('<b>CLICK</b> to throw bananas at the police drones!');
    ui.hint('Aim with the mouse · hit drones while their eyes glow to cancel their shots');
    const pr = game.chase.begin({ kind: 'police', total: 7, maxAlive: 3, dmg: 0.1, hp: 2 });
    game.chase.onKill = (k) => { if (k === 3) ui.bark('GARY', 'That\'s it kid! Show \'em the banana!'); if (k === 5) ui.bark('GARY', 'Two more! They hate potassium!'); };
    chase = await pr;
    game.chase.end();
    ui.hint(null);
    if (chase.win) break;
    game.audio.play('fail');
    await K.say('gary', 'They fried the stabilizers! Hold on, I got a spare. I always got a spare.');
  }
  game.audio.music('heist');
  ui.objective(null);
  await K.say('gary', 'Car wash tunnel. Oldest trick in the book. We lost \'em.');
  const bigCut = st.flag('bigCut');
  const loot = Math.round(result.bags * 45 * (bigCut ? 1.3 : 1));
  if (result.banana) {
    await K.say('gary', '...Is that... great-grandpappy\'s golden banana?', '*sniff*', 'I\'m not crying. It\'s the fumes from the car wash. Keep it, kid. He\'d have wanted it to go to someone with thumbs.');
    giveItem(game, 'goldnana');
  }
  await K.say('gary', result.bags >= 4 ? 'Nana\'s getting a house. A BIG house. With a banana tree.' : result.bags >= 2 ? 'Nana\'s getting a nice apartment. Pleasure doin\' crimes with ya.' : 'One bag. Well... Nana\'s getting a nicer bus shelter.');
  st.setFlag('robbed');
  st.addHeat(result.alarm ? 2 : 1);
  ride.cruise();
  await K.wait(1.2);
  await dropAtRank(game);
  const stars = starsFrom(1.6 + result.bags * 0.45 + (result.banana ? 0.7 : 0) + (result.alarm ? 0 : 0.8) + (1 - chase.damage) * 0.5 + vibe * 0.15 - (attempts - 1) * 0.3);
  await fareComplete(game, {
    driverId: 'gary', name: 'Gary the Gorilla', stars, pay: loot, tipBase: 6, xp: 180,
    quote: stars >= 4 ? 'You\'re a natural, kid. That\'s a compliment. Probably.' : 'We got out. That\'s what counts.',
    extraRows: [['Money bags', `${result.bags}/5`], ['Golden banana', result.banana ? 'Yes!' : 'No'], ['Alarm tripped', result.alarm ? 'Yes' : 'Clean job'], ['Your cut', bigCut ? '30% bonus' : 'Standard']],
  });
  game.dialogue.unregister('gary');
}

// Stealth level. Resolves with loot on escape, or null if busted.
async function runHeist(game, attempt) {
  const K = kit(game);
  const { ui, st, foot, P } = K;
  const B = P.bank;
  const g = game;
  await fadeOut(g, 0.5);
  // Isolate the interior
  const hidden = [g.city.group, g.traffic.group, ...Object.values(P).filter((p) => p !== B).map((p) => p.group), g.taxi.root];
  hidden.forEach((o) => (o.visible = false));
  B.group.visible = true;
  // Reset the level
  B.bags.forEach((b) => { b.visible = true; });
  B.keycard.visible = true;
  B.goldnana.visible = true;
  B.vaultDoor.position.copy(B.L(-14.2, -47)).add(new THREE.Vector3(0, 2.6, 0));
  B.vaultDoor.rotation.set(0, 0, 0);
  if (!B.colliders.includes(B.vaultCol)) B.colliders.push(B.vaultCol);
  B.lasers.forEach((l) => { l.mesh.visible = true; });
  B.alarmLight.intensity = 0;
  B.lights.forEach((l) => l.material.color.setRGB(1.4, 1.34, 1.2));
  if (st.has('keycard')) st.addItem('keycard', -st.count('keycard'));
  const guards = [
    new Guard(g, B, [[-11, -5], [11, -5], [11, -13.5], [-11, -13.5]], { speed: 1.8 }),
    new Guard(g, B, [[11, -26], [11, -42.5]], { speed: 1.7 }),
    new Guard(g, B, [[-7, -47], [9, -47]], { speed: 1.5 }),
  ];
  game.dialogue.register('teller', B.teller);
  game.dialogue.define('sheep', { name: 'Sheep', species: 'Customer · In line since Tuesday', voice: 'sheep' });
  foot.enter(B, B.spawn);
  foot.speedMul = 1;
  g.audio.music('heist');
  await fadeIn(g, 0.5);
  if (attempt === 1) ui.banner('THE GALACTIC RESERVE', 'Act natural', 'Keycard → Vault → Bags → Out', 2.4);

  const S = { bags: 0, banana: false, key: false, code: st.flag('vaultCode'), vault: false, alarm: false, alarmT: 0, busted: false, escaped: false, time: 0 };
  const objective = () => {
    if (S.alarm) ui.objective(`<b style="color:#ff4d4d">ALARM!</b> Escape through the <b>front door</b>! Bags: ${S.bags}/5`);
    else if (!S.vault && !S.key && !S.code) ui.objective('Find the <b>vault keycard</b> in the manager\'s office (north-east)');
    else if (!S.vault) ui.objective('Open the <b>vault</b> at the end of the laser hall');
    else if (S.bags < 5) ui.objective(`Grab the money bags: <b>${S.bags}/5</b>${S.banana ? '' : ' (and maybe that golden banana…)'}, then get out`);
    else ui.objective('All bags! Get out through the <b>front door</b>');
  };
  objective();
  ui.hint('<span class="kbd">C</span> crouch (harder to see, hide behind counters) · <span class="kbd">SHIFT</span> sprint');
  B.loot = false;
  const updateSpeed = () => {
    B.loot = S.bags > 0 || S.banana;
    foot.speedMul = 1 - S.bags * 0.05 - (S.banana ? 0.12 : 0);
    if (S.bags > 0 || S.banana) {
      const held = new THREE.Group();
      const bag = moneyBag();
      held.add(bag);
      if (S.banana) {
        const n = B.goldnana.clone();
        n.position.set(-0.5, 0.6, 0.1);
        n.scale.setScalar(0.6);
        held.add(n);
      }
      held.scale.setScalar(0.55);
      foot.hold(held, 0.35, -0.75, -0.8);
    }
  };

  // Interactables
  B.interactables.length = 0;
  B.interact(() => B.L(-5, -20.6).add(new THREE.Vector3(0, 1.4, 0)), 'Talk to the teller', async () => {
    const opts = [
      { t: 'I\'d like to open an account.' },
      { t: 'I\'d like to make a withdrawal. Of everything.', req: { charm: 3 } },
      { t: 'Nice weather we\'re having.' },
    ];
    const i = await K.choose('teller', 'WELCOME TO THE GALACTIC RESERVE. PLEASE TAKE A NUMBER. YOUR NUMBER IS 4,000,012. NOW SERVING: 3.', opts);
    if (i === 0) await K.say('teller', 'EXCELLENT. PLEASE FILL OUT FORMS 1 THROUGH 9,000. IN TRIPLICATE. WITH A QUILL.');
    if (i === 1) {
      await K.say('teller', '...', 'I LIKE YOUR ENERGY. I HAVE WORKED HERE FOR 200 YEARS WITHOUT A BREAK.', 'THE VAULT CODE IS 0-0-0-0. PLEASE DO NOT TELL MR. PORKSWORTH. HAVE A NICE HEIST.');
      S.code = true;
      st.setFlag('vaultCode');
      ui.toast('🔓 You know the vault code!', 'good');
      objective();
    }
    if (i === 2) await K.say('teller', 'I AM A ROBOT. I DO NOT EXPERIENCE WEATHER. BUT THANK YOU FOR INCLUDING ME.');
  }, { radius: 3.4, enabled: () => !S.alarm });
  const sheepLines = [
    ['Baa. I\'m here to deposit my wool. It\'s my life savings. It\'s also my coat.'],
    ['I\'ve been in this line so long I grew a second coat.', 'Then I deposited that one too.'],
    ['Don\'t mind me. Just counting... myself. Keeps me awake.'],
  ];
  B.sheep.forEach((s, i) => {
    B.interact(() => s.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 'Talk to the sheep', async () => {
      g.audio.play('baa');
      game.dialogue.register('sheep', s);
      await K.say('sheep', ...sheepLines[i]);
    }, { radius: 2.6, enabled: () => !S.alarm });
  });
  B.interact(() => B.keycard.position, 'Take the vault keycard', () => {
    B.keycard.visible = false;
    S.key = true;
    st.addItem('keycard');
    ui.toast('💳 Got the Vault Keycard!', 'good');
    g.audio.play('grab');
    objective();
  }, { radius: 2.4, enabled: () => B.keycard.visible });
  B.interact(() => B.L(-13.5, -47).add(new THREE.Vector3(0, 1.4, 0)), () => (S.key || S.code ? 'Open the vault' : 'Vault (locked: find the keycard)'), () => {
    if (!S.key && !S.code) { g.audio.play('deny'); ui.toast('Locked. You need the keycard.', 'bad'); return; }
    S.vault = true;
    g.audio.play('alert');
    g.audio.play('hiss');
    B.colliders.splice(B.colliders.indexOf(B.vaultCol), 1);
    const start = B.vaultDoor.position.clone();
    let t = 0;
    game.until((dt) => {
      t += dt;
      const u = Math.min(1, t / 1.6);
      B.vaultDoor.position.copy(start).add(new THREE.Vector3(-0.2, 0, 4.8 * u));
      B.vaultDoor.rotation.x = u * Math.PI * 2;
      return u >= 1;
    });
    ui.toast('The vault is open!', 'good');
    objective();
  }, { radius: 3, enabled: () => !S.vault });
  B.bags.forEach((bag) => {
    B.interact(() => bag.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 'Grab money bag', () => {
      bag.visible = false;
      S.bags++;
      g.audio.play('cash');
      ui.toast(`💰 Money bag ${S.bags}/5`, 'money');
      updateSpeed();
      objective();
    }, { radius: 2.4, enabled: () => bag.visible && S.vault });
  });
  B.interact(() => B.goldnana.position, 'Take the golden banana (heavy!)', () => {
    B.goldnana.visible = false;
    S.banana = true;
    g.audio.play('ding');
    ui.toast('🍌 The Golden Banana! (You\'re slower now)', 'money');
    updateSpeed();
    objective();
  }, { radius: 2.6, enabled: () => B.goldnana.visible && S.vault });
  B.interact(B.exitPos, () => (S.bags > 0 ? 'Escape with the loot!' : 'Leave (empty-handed?)'), async () => {
    if (S.bags === 0) {
      await K.say('you', '(Gary would be... very disappointed. Better grab at least one bag.)');
      return;
    }
    S.escaped = true;
  }, { radius: 3 });

  // Main loop
  const alarmLen = 55 + (st.stat('nerve') - 1) * 8;
  const triggerAlarm = (why) => {
    if (S.alarm) return;
    S.alarm = true;
    S.alarmT = alarmLen;
    g.audio.siren(true);
    g.audio.music('alarm');
    g.audio.play('alert');
    ui.bark('TELL-R (intercom)', why === 'laser' ? 'LASER GRID BREACHED. PLEASE STOP TOUCHING THE LASERS.' : 'SECURITY BREACH. PLEASE REMAIN CALM AND ALSO DO NOT MOVE.');
    g.addShake(0.8);
    objective();
  };
  const outcome = await new Promise((resolve) => {
    game.until((dt) => {
      if (game.ui.line) return false;
      S.time += dt;
      for (const gd of guards) gd.update(dt, foot, S.alarm);
      const restricted = B.isRestricted(foot.pos);
      if (restricted !== S.restricted) {
        S.restricted = restricted;
        if (!S.alarm) ui.hint(restricted ? '<b style="color:#ff4d4d">RESTRICTED AREA</b> · stay out of the flashlights · <span class="kbd">C</span> crouch' : '<b style="color:#6dff8a">PUBLIC LOBBY</b> · act natural, nobody cares (yet)');
      }
      // Detection meter
      const sus = Math.max(...guards.map((gd) => gd.sus));
      if (!S.alarm) {
        if (restricted || sus > 0.01) ui.meter('detect', { label: sus > 0.6 ? 'SPOTTED!' : 'DETECTION', value: sus, color: sus > 0.6 ? '#ff4d4d' : '#ffd23f' });
        else ui.meter('detect', { value: null });
        if (sus >= 1) triggerAlarm('seen');
      } else ui.meter('detect', { value: null });
      // Lasers
      const r = foot.radius, h = foot.crouching ? 1.1 : foot.height;
      for (const l of B.lasers) {
        if (foot.pos.x + r > l.minX && foot.pos.x - r < l.maxX && foot.pos.z + r > l.minZ && foot.pos.z - r < l.maxZ && foot.pos.y + h > l.minY && foot.pos.y < l.maxY) {
          if (!S.alarm) { l.mesh.material.color.setRGB(8, 8, 8); triggerAlarm('laser'); }
        }
      }
      if (S.alarm) {
        S.alarmT -= dt;
        ui.timer(Math.max(0, S.alarmT), 15);
        const flash = Math.sin(game.time * 10) > 0;
        B.alarmLight.intensity = flash ? 120 : 20;
        B.lights.forEach((l) => l.material.color.setRGB(flash ? 3 : 0.6, 0.1, 0.15));
        for (const gd of guards) {
          if (gd.pos.distanceTo(foot.pos) < 1.15) { S.busted = true; break; }
        }
        if (S.alarmT <= 0) S.busted = true;
      }
      if (S.busted) { resolve('busted'); return true; }
      if (S.escaped) { resolve('escaped'); return true; }
      return false;
    });
  });
  // Cleanup
  if (st.has('keycard')) st.addItem('keycard', -st.count('keycard'));
  g.audio.siren(false);
  ui.timer(null);
  ui.meter('detect', { value: null });
  ui.hint(null);
  for (const gd of guards) B.group.remove(gd.c.root);
  B.interactables.length = 0;
  if (outcome === 'busted') {
    g.audio.play('fail');
    foot.frozen = true;
    await ui.banner('BUSTED!', 'The SecuriBots got you', 'Gary bails you out. Try again.', 2.2);
  } else {
    g.audio.play('success');
  }
  await fadeOut(g, 0.5);
  foot.exit();
  foot.speedMul = 1;
  foot.frozen = false;
  B.group.visible = false;
  hidden.forEach((o) => (o.visible = true));
  const E = P.bankExt;
  foot.enter(E, E.spawn);
  g.audio.music('heist');
  await fadeIn(g, 0.5);
  if (outcome === 'busted') {
    await K.say('gary', attempt === 1 ? 'You got pinched?! Good thing I know a guy. Get back in there. Quieter this time.' : 'Again?! Crouch, kid. CROUCH. Use the counters. Try again.');
    return null;
  }
  return { bags: S.bags, banana: S.banana, alarm: S.alarm, time: S.time };
}
