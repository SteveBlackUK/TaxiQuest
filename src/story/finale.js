import * as THREE from 'three';
import { kit, makeDriver, taxiArrives, boardAtDock, exitTaxi, fareComplete, fadeOut, fadeIn, clearSeats, giveItem } from './common.js';
import { createCharacter } from '../world/characters.js';
import { clamp, rand, pick, shuffle } from '../core/util.js';
import { showPockets } from './hub.js';

export async function finale(game) {
  const K = kit(game);
  const { ui, st, ride, P, foot } = K;
  const carl = makeDriver(game, 'carl');
  // The whole gang, squeezed into one cab.
  const gary = createCharacter('gary', { hands: 'lap' });
  const sheila = createCharacter('sheila', { hands: 'lap' });
  const kevin = createCharacter('kevin');
  const lenny = createCharacter('lenny', { hands: 'lap' });
  game.dialogue.register('gary', gary);
  game.dialogue.register('sheila', sheila);
  game.dialogue.register('kevin', kevin);
  game.dialogue.register('lenny', lenny);
  const seatGang = () => {
    game.taxi.anchors.passenger.add(gary.root);
    game.taxi.anchors.rearLeft.add(sheila.root);
    game.taxi.anchors.rearLeft.add(kevin.root);
    kevin.root.position.set(0.05, 0.28, -0.28);
    kevin.root.scale.setScalar(0.8);
    game.taxi.anchors.roof.add(lenny.root);
    lenny.root.rotation.set(-Math.PI / 2, 0, 0);
    lenny.root.position.set(0, 0.25, 0.6);
    lenny.asleep = true;
  };
  const gangUpdate = { update: (dt) => { gary.update(dt); sheila.update(dt); kevin.update(dt); lenny.update(dt); } };
  game.addSystem(gangUpdate);
  seatGang();

  ui.objective('Your ride is coming. All of it.');
  await taxiArrives(game, carl, { style: 'aggressive', speed: 40 });
  ui.objective('Get in the taxi (squeeze)');
  await boardAtDock(game, P.rank, 'Squeeze into the taxi');
  game.taxi.tv('news', ['MAYOR: "At midnight, every cab in Neo-Serengeti becomes a RoboCab."', 'Animal cabbies "extremely not okay with this."', 'Mayor spotted buying a suspicious amount of toys.']);
  game.audio.music('boss');
  ride.cruise();
  ride.barks = ['Lenny, stop drooling on the roof!', 'Sheila, your TAIL.', 'Nobody touch the bananas. I\'m looking at you, Gary.'];
  await K.wait(0.5);
  ui.banner('FINAL FARE', 'The Whole Gang', 'Robo-Taxi Rumble', 2.8);
  await K.wait(1.2);
  await K.say('carl', 'Get in. Squeeze. Gary, move your elbow. Sheila, your tail is in my ear.');
  await K.say('sheila', 'It\'s a TAXI, Carl. There\'s no room for a tail in a taxi!');
  await K.say('gary', 'The mayor\'s flippin\' the switch at midnight. Every animal cabbie in the city, out of a job. Replaced by tin cans.');
  await K.say('sheila', 'Not on my watch. Kevin\'s college fund depends on this cab!');
  await K.say('kevin', 'I\'m gonna be a DENTIST!');
  await K.say('carl', 'Where\'s Lenny?');
  await K.say('gary', 'On the roof.');
  await K.say('carl', '...On the ROOF?');
  await K.say('lenny', '...I\'m... fine...');
  await K.say('carl', 'Here\'s the plan. We fly to the *RoboCab Spire*. Kid, you pull the override levers and shut down the network.',
    'Then you go up top and talk that tin cat out of it. We\'ll back you up.');
  const a = await K.choose('carl', 'You with us?', [
    { t: 'Why me?' },
    { t: 'Let\'s do this.' },
    { t: 'Can we stop for snacks first?' },
  ]);
  if (a === 0) { await K.say('gary', 'Because you\'re the only one with thumbs.'); await K.say('sheila', 'And you\'re good at this! You\'re a natural!'); }
  if (a === 1) await K.say('carl', 'That\'s what I like to hear.');
  if (a === 2) await K.say('carl', '...I respect that. No.');
  // ---- RoboCab dogfight ----
  ride.targetSpeed = 52;
  game.audio.music('chase');
  await K.say('gary', 'RoboCabs! Six o\'clock! They know we\'re coming!');
  await K.say('kevin', 'THROW ME! THROW ME AT THEM!');
  await K.say('sheila', 'Absolutely not... ugh, FINE. Right-click to chuck him. He bounces. He always bounces.');
  for (;;) {
    ui.objective('<b>CLICK</b> bananas · <b>RIGHT-CLICK</b> to throw Kevin');
    const pr = game.chase.begin({ kind: 'robocab', total: 8, maxAlive: 3, dmg: 0.09, hp: 3, special: 'kevin' });
    game.chase.onKill = (k) => {
      if (k === 2) ui.bark('CARL', 'Bonk! That\'s one less RoboCab!');
      if (k === 4) ui.bark('KEVIN', 'AGAIN! AGAIN!');
      if (k === 6) ui.bark('GARY', 'They got no guts. Literally. They\'re robots.');
    };
    const res = await pr;
    game.chase.end();
    ui.hint(null);
    if (res.win) break;
    game.audio.play('fail');
    await K.say('carl', 'They\'re shredding us! Hold on, I\'m rebooting the shields. By which I mean hitting the dashboard.');
  }
  game.audio.music('boss');
  ui.objective(null);
  await K.say('carl', 'Nice throwing. Spire\'s dead ahead. Hold onto your tail, Sheila.');
  await ride.goTo(P.spire);
  await K.say('carl', 'This is as close as I can get. Pull those *three override levers*. Mind the lasers.');
  await K.say('sheila', 'And use me boots! Jump pads and big leaps, love!');

  // ---- Spire climb ----
  const S = P.spire;
  await exitTaxi(game, S, S.spawn);
  ui.objective('Pull the <b>3 override levers</b> (0/3)');
  ui.hint('Jump over the red laser sweepers · launch pads carry you up');
  let pulled = 0;
  S.interactables.length = 0;
  for (const L of S.levers) {
    L.pulled = false;
    L.arm.rotation.x = -0.6;
    L.knob.material.color.setRGB(4, 0.2, 0.3);
    S.interact(L.pos, 'Pull the override lever', () => {
      L.pulled = true;
      pulled++;
      L.arm.rotation.x = 0.6;
      L.knob.material.color.setRGB(0.4, 4, 1);
      game.audio.play('alert');
      game.addShake(0.5);
      ui.toast(`Override ${pulled}/3`, 'good');
      if (pulled < 3) ui.objective(`Pull the <b>3 override levers</b> (${pulled}/3)`);
      else {
        ui.objective('Network down! Take the <b>gold launch pad</b> to the Mayor\'s deck');
        S.finalPad.col.pad = S.finalPadPower;
        S.finalPad.g.visible = true;
        for (const m of S.finalPad.g.userData.parts) m.visible = true;
        game.audio.play('success');
        ui.bark('CARL (over the radio)', 'The RoboCabs are dropping like flies! Get up there, kid!');
        S.tip.material.color.setRGB(0.3, 3, 1);
      }
    }, { radius: 2.8, enabled: () => !L.pulled });
  }
  let zapCool = 0;
  await new Promise((res) => {
    game.until((dt) => {
      if (game.ui.line) return false;
      zapCool -= dt;
      for (const sw of S.sweepers) {
        sw.g.rotation.y = sw.phase + game.time * sw.speed;
        const th = sw.g.rotation.y;
        const dir = new THREE.Vector3(Math.cos(th), 0, -Math.sin(th));
        const a0 = new THREE.Vector3(S.center.x, 0, S.center.z).addScaledVector(dir, 11);
        const p = new THREE.Vector3(foot.pos.x, 0, foot.pos.z);
        const along = p.clone().sub(a0).dot(dir);
        if (along < 0 || along > sw.len) continue;
        const closest = a0.clone().addScaledVector(dir, along);
        const dist = closest.distanceTo(p);
        const feet = foot.pos.y, head = foot.pos.y + (foot.crouching ? 1.1 : 1.75);
        if (dist < 0.55 && sw.y > feet && sw.y < head && zapCool <= 0) {
          zapCool = 0.8;
          const out = new THREE.Vector3(foot.pos.x - S.center.x, 0, foot.pos.z - S.center.z).normalize();
          const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sign(sw.speed) * -1);
          foot.vel.copy(out.multiplyScalar(5).add(perp.multiplyScalar(6))).setY(6);
          foot.grounded = false;
          game.audio.play('zap');
          game.addShake(1.2);
          ui.toast('⚡ ZAPPED! Jump over the sweepers!', 'bad');
        }
      }
      if (pulled >= 3 && foot.pos.y > S.TOP - 0.6 && foot.grounded && Math.hypot(foot.pos.x - S.center.x, foot.pos.z - S.center.z) < 16) { res(); return true; }
      return false;
    });
  });
  ui.hint(null);

  // ---- The Mayor ----
  foot.frozen = true;
  const mayor = S.mayor;
  game.dialogue.register('mayor', mayor);
  mayor.face('=^_^=', '#33f0ff');
  // The gang hovers beside the deck.
  const hoverPos = new THREE.Vector3(S.center.x + 20, S.TOP - 0.8, S.center.z + 4);
  ride.teleport(hoverPos, 0);
  game.taxi.setDoor(true);
  game.audio.music('boss');
  foot.pos.set(mayor.root.position.x + 0.6, S.TOP, mayor.root.position.z + 6.5);
  foot.vel.set(0, 0, 0);
  foot.yaw = Math.atan2(-(mayor.root.position.x - foot.pos.x), -(mayor.root.position.z - foot.pos.z));
  foot.pitch = 0.12;
  ui.objective('Talk the <b>mayor</b> out of the RoboCab ban');
  await K.say('mayor', 'WELL, WELL, WELL. A *HUMAN*. IN NEO-SERENGETI. HOW... RETRO.',
    'YOU HAVE DISABLED MY NETWORK. IRRELEVANT. AT MIDNIGHT I WILL SIMPLY REBOOT IT.',
    'ROBOCABS ARE EFFICIENT. ROBOCABS DO NOT SHED. ROBOCABS DO NOT EAT THE PASSENGERS.');
  await K.say('carl', 'That was ONE time!');
  await K.say('mayor', 'CONVINCE ME OTHERWISE, HUMAN. YOU HAVE FOUR ATTEMPTS. MY RESOLVE IS... INFINITE. (IT IS 100.)');
  const win = await debate(game);
  ui.meter('resolve', { value: null });
  if (win) {
    mayor.face('T_T', '#33f0ff');
    await K.say('mayor', 'RESOLVE... AT... ZERO.', 'I... I JUST WANTED EVERYONE TO... LIKE ME.', 'ROBOCABS DO NOT SAY THANK YOU. ROBOCABS DO NOT REMEMBER YOUR NAME.',
      'THE BAN IS... CANCELLED. ANIMAL CABS... FOREVER.');
    mayor.face('=^.^=', '#ffd23f');
    await K.say('mayor', '...ALSO. COULD I... DRIVE A CAB? SOMETIMES? I HAVE ALWAYS WANTED A LITTLE HAT.');
    await K.say('carl', '...Sure. Why not. Welcome to the rank, Mittens.');
    await K.say('mayor', 'MITTENS. I LOVE IT. I AM MAYOR MITTENS NOW.');
    st.setFlag('goodEnding');
  } else {
    await K.say('gary', 'Alright. Enough talkin\'.');
    await K.say('kevin', '*CHOMP*');
    game.audio.play('zap');
    game.addShake(2);
    mayor.face('x_x', '#ff3040');
    await K.say('mayor', 'NOOooOOoo... KEVIN... HAS BITTEN... MY POWER... CABLEeeeee...');
    await K.wait(1.2);
    mayor.face('=^.^=', '#ffd23f');
    await K.say('mayor', '*REBOOTING*', '...hello. I am Mayor Mittens. I love animals. And taxis. And that small biting child.');
    await K.say('sheila', 'Kevin! We do NOT bite mayors! ...Good job though.');
  }
  // ---- Ending ----
  ui.objective(null);
  game.audio.music('victory');
  game.audio.play('cheer');
  ui.banner('NEO-SERENGETI IS SAVED', 'Animal Cabs Forever!', 'The rank lives on', 3.2);
  const fw = setInterval(() => firework(game, S), 450);
  foot.frozen = false;
  await K.wait(3.5);
  await K.say('carl', 'Kid. That was the best fare of my life. And I\'ve had a Snappy Meal now, so that\'s saying something.');
  await K.say('sheila', 'You\'re family now, mate. Come for dinner. Kevin will bite you. It means he likes you.');
  await K.say('gary', 'If you ever need a getaway driver... you know where the rank is.');
  await K.say('lenny', '...group... hug...?', '...I\'ll... start it... tomorrow...');
  await K.wait(1);
  clearInterval(fw);
  game.removeSystem(gangUpdate);
  st.setFlag('beaten');
  const ratings = Object.values(st.d.ratings);
  const avg = ratings.length ? ratings.reduce((x, y) => x + y, 0) / ratings.length : 3;
  const rank = avg >= 4.5 ? 'LEGENDARY PASSENGER' : avg >= 3.8 ? 'FIVE-STAR HUMAN' : avg >= 3 ? 'SOLID FARE' : 'SURVIVOR';
  const mins = Math.round(st.d.playTime / 60);
  const stars = Math.round(avg);
  game.audio.play('levelup');
  st.addXp(300);
  await ui.modal(`<div class="card wide"><div class="kicker">THE END</div><h1>${rank}</h1>
    <div class="stars">${ui.stars(stars)}</div>
    <p>${st.flag('goodEnding') ? 'You talked a robot mayor into loving animals. Carl got his Snappy Meal. Kevin is going to be a dentist.' : 'Kevin bit the mayor. The mayor rebooted nicer. Honestly, it worked.'}</p>
    <div class="row"><span>Level</span><span class="v">${st.d.level}</span></div>
    <div class="row"><span>Credits</span><span class="v">₡ ${st.d.credits}</span></div>
    <div class="row"><span>Average rating</span><span class="v">${avg.toFixed(1)} ★</span></div>
    <div class="row"><span>Time in the sky</span><span class="v">${mins} min</span></div>
    <p class="quote">Made with three.js and a lot of synthesized honking. No animals were harmed. Carl is fine. Lenny is still on the roof.</p>
    <div class="buttons"><button class="btn" data-v="ok">Keep playing</button></div></div>`, { keys: { Enter: 'ok' } });
  st.save();
  await fadeOut(game, 0.8);
  ride.end();
  clearSeats(game);
  game.taxi.root.visible = false;
  foot.exit();
  for (const id of ['carl', 'gary', 'sheila', 'kevin', 'lenny', 'mayor']) game.dialogue.unregister(id);
  foot.enter(P.rank, P.rank.spawn);
  await fadeIn(game, 0.8);
}

async function debate(game) {
  const K = kit(game);
  const { ui, st } = K;
  let resolve = 100;
  const hit = (n) => {
    resolve = clamp(resolve - n, 0, 120);
    ui.meter('resolve', { label: 'MAYOR\'S RESOLVE', value: resolve / 100, color: '#ff3040', right: `${Math.round(resolve)}` });
    if (n > 0) { game.audio.play('hit'); game.addShake(Math.min(1.5, n / 25)); P_face(game, n); }
  };
  hit(0);
  const used = new Set();
  const OPTS = [
    { id: 'gerald', t: 'Is that a Robo-Gerald shrine? ...I have the other one.', item: 'gerald', dmg: 55, lines: [['mayor', 'THE... THE LIMITED EDITION? THE ONE THAT CAME IN PAIRS? I HAVE SEARCHED FOR YEARS.', 'WHERE... WHERE DID YOU GET IT?'], ['you', 'A Snappy Meal. In a crocodile\'s cab.'], ['mayor', '...AN ANIMAL CABBIE. GAVE YOU. THIS. AND YOU GIVE IT TO ME?', 'MY CIRCUITS ARE EXPERIENCING... A FEELING.']] },
    { id: 'city', t: 'Animals built this city. Every sign, every snack, every cab.', req: { charm: 3 }, dmg: 30, lines: [['mayor', 'I... THAT IS... STATISTICALLY ACCURATE. WHY DOES THAT HURT.']] },
    { id: 'bouquet', t: '(Toss the wedding bouquet at the mayor.)', item: 'bouquet', dmg: 30, lines: [['mayor', 'ERROR. LOVE.EXE IS NOT RESPONDING.', 'I... I MUST ATTEND MORE WEDDINGS.']] },
    { id: 'bank', t: 'I robbed a bank this week. Don\'t test me.', req: { nerve: 3 }, flag: 'robbed', dmg: 25, lines: [['mayor', 'THAT WAS YOU? THE BANANA BANDIT? MY CIRCUITS ARE... INTIMIDATED.'], ['gary', 'That\'s my kid!']] },
    { id: 'remote', t: '(Snatch the remote off its belt.)', req: { reflex: 3 }, dmg: 25, lines: [['mayor', 'HEY! GIVE THAT BACK! THAT CONTROLS THE THERMOSTAT! AND THE NETWORK! MOSTLY THE THERMOSTAT!']] },
    { id: 'nana', t: '(Offer the golden banana as a bribe.)', item: 'goldnana', dmg: 25, lines: [['gary', 'HEY! That\'s... fine. Fine. It\'s for a good cause.'], ['mayor', 'A GOLDEN BANANA? FOR ME? NOBODY HAS EVER GIVEN ME A FRUIT.']] },
    { id: 'tip', t: 'Nobody tips a robot, you know.', req: { charm: 2 }, dmg: 18, lines: [['mayor', 'THEY... DO NOT TIP? BUT I PROGRAMMED THE TIP JAR MYSELF...']] },
    { id: 'stare', t: '(Stare directly into its screen without blinking.)', req: { nerve: 2 }, dmg: 15, lines: [['mayor', 'STOP THAT. STOP LOOKING AT ME LIKE THAT. =O_O=']] },
    { id: 'boop', t: '(Boop the mayor on the nose.)', req: { reflex: 2 }, dmg: 12, lines: [['mayor', 'BOOP. BOOP? WHY DID THAT FEEL... NICE.']] },
    { id: 'duck', t: '(Squeak the Space Duck at it.)', item: 'duck', dmg: 15, lines: [['mayor', 'WHAT IS THAT SOUND. IT IS HORRIBLE. MAKE IT STOP. I WILL DO ANYTHING.']] },
    { id: 'logic', t: 'Can a RoboCab get a crocodile his Snappy Meal?', dmg: 18, lines: [['mayor', 'A CROCODILE... CANNOT ORDER... HIS OWN MEAL?', 'I DID NOT ACCOUNT FOR THIS. I DID NOT ACCOUNT FOR THIS AT ALL.']] },
    { id: 'please', t: 'Please? Pretty please?', dmg: 8, lines: [['mayor', 'PLEASE IS NOT A VALID COMMAND.', '...BUT IT WAS POLITE. +8 POLITENESS.']] },
    { id: 'beep', t: 'Beep boop?', dmg: -6, lines: [['mayor', 'DO NOT MOCK ME IN MY OWN LANGUAGE. RESOLVE INCREASED.']] },
  ];
  const friends = [
    ['carl', 'This human got me my first Snappy Meal in FORTY YEARS! Can your RoboCabs do that?!'],
    ['sheila', 'They saved me Kevin! Can a robot hug? CAN IT?!'],
    ['gary', 'Kid\'s got more guts than your whole robot army.'],
    ['lenny', '...they... got me... to my... wedding...'],
  ].filter(([id]) => (st.d.ratings[id] || 0) >= 3);
  for (let round = 1; round <= 4; round++) {
    const avail = OPTS.filter((o) => !used.has(o.id) && (!o.flag || st.flag(o.flag)));
    // Show the best options the player qualifies for, plus a couple they don't, plus a joke.
    const can = avail.filter((o) => (!o.req || st.stat(Object.keys(o.req)[0]) >= Object.values(o.req)[0]) && (!o.item || st.has(o.item)) && o.id !== 'beep' && o.id !== 'please' && o.id !== 'logic');
    const cant = avail.filter((o) => !can.includes(o) && o.id !== 'beep' && o.id !== 'please' && o.id !== 'logic');
    let pickList = can.slice(0, 2);
    if (pickList.length < 2) pickList = pickList.concat(cant.slice(0, 2 - pickList.length));
    const filler = avail.filter((o) => ['logic', 'please', 'beep'].includes(o.id));
    pickList = pickList.concat(filler.slice(0, 4 - pickList.length));
    if (pickList.length < 4) pickList = pickList.concat(cant.filter((o) => !pickList.includes(o)).slice(0, 4 - pickList.length));
    pickList = shuffle(pickList).slice(0, 4);
    const i = await K.choose('mayor', round === 1 ? 'WELL? STATE YOUR ARGUMENT, HUMAN.' : resolve > 50 ? 'IS THAT ALL? MY RESOLVE REMAINS... STRONG.' : 'I... WHAT ELSE? SAY SOMETHING ELSE. QUICKLY.', pickList.map((o) => ({ t: o.t, req: o.req, item: o.item })));
    const o = pickList[i];
    used.add(o.id);
    for (const [who, ...ls] of o.lines) await K.say(who, ...ls);
    hit(o.dmg);
    if (o.item === 'goldnana') st.addItem('goldnana', -1);
    if (resolve <= 0) return true;
    if ((round === 1 || round === 3) && friends.length) {
      const [who, line] = friends.shift();
      await K.say(who, line);
      await K.say('mayor', pick(['...HNNG.', 'THAT... IS A GOOD POINT.', 'STOP MAKING GOOD POINTS.', '...NOTED. PAINFULLY.']));
      hit(12);
      if (resolve <= 0) return true;
    }
  }
  while (friends.length && resolve > 0) {
    const [who, line] = friends.shift();
    await K.say(who, line);
    hit(12);
  }
  return resolve <= 0;
}

function P_face(game, n) {
  const m = game.places.spire.mayor;
  m.face(n >= 30 ? '>_<' : n >= 15 ? 'O_O' : '-_-', n >= 30 ? '#ff3d8b' : '#ffd23f');
  setTimeout(() => m.face('=^_^=', '#33f0ff'), 1400);
}

function firework(game, S) {
  const cols = [0xff3d8b, 0x33f0ff, 0xffd23f, 0x6dff8a, 0xb14dff, 0xff8a1f];
  const p = S.center.clone().add(new THREE.Vector3(rand(-90, 90), S.TOP - S.R + rand(40, 110), rand(-90, 90)));
  game.fx.spawn(p, { count: 40, color: pick(cols), speed: 18, life: 1.6, size: 2.2, gravity: 4, drag: 1.2 });
  game.fx.spawn(p, { count: 10, color: 0xffffff, speed: 6, life: 0.5, size: 4 });
  game.audio.play('firework', { vol: 0.6, pan: rand(-0.8, 0.8) });
}

export { giveItem, showPockets };
