import * as THREE from 'three';
import { kit, makeDriver, taxiArrives, boardAtDock, exitTaxi, dropAtRank, fareComplete, giveItem, credits, starsFrom } from './common.js';
import { createCharacter } from '../world/characters.js';
import { KidAI } from '../places/carnival.js';
import { toon } from '../core/textures.js';

export async function fareSheila(game) {
  const K = kit(game);
  const { D, ui, st, ride, P, foot } = K;
  const sheila = makeDriver(game, 'sheila');
  let vibe = 0;
  ui.objective('Your taxi is on its way…');
  await taxiArrives(game, sheila, { style: 'bouncy', speed: 34 });
  ui.objective('Get in the taxi');
  await boardAtDock(game, P.rank);
  game.taxi.tv('ads', ['ZERO-G CARNIVAL: Float like a butterfly, scream like a goat!', 'SPACE FLOSS: Sticky. Sweet. Legally a food.', 'LOST A JOEY? Call 1-800-BOUNCE']);
  game.audio.music('carnival');
  ride.cruise();
  ride.barks = ['Hold onto your hat, love!', 'Oi! Road hog! MOVE IT!', 'Kevin, if you can hear me, STAY PUT!', 'Bounce, bounce, bounce!'];
  await K.wait(0.6);
  ui.banner('FARE #2', 'Sheila the Kangaroo', 'Where\'s Kevin?', 2.6);
  await K.wait(1.2);
  await K.say('sheila', 'OI! In ya get, in ya get, IN YA GET! Sorry love. Bit of an emergency.',
    'Me joey *Kevin* bounced out of me pouch at the *Zero-G Carnival*! One minute he\'s there, next minute, BOING, gone!');
  const a = await K.choose('sheila', 'Mate, you\'ve gotta help me find him!', [
    { t: 'Stay calm. We\'ll find him.' },
    { t: 'Isn\'t keeping track of him kind of... your job?' },
    { t: 'Tell me about Kevin. What\'s he like?', req: { charm: 2 } },
  ]);
  if (a === 0) { vibe++; await K.say('sheila', 'Calm? CALM? I\'m a kangaroo, love. We don\'t DO calm. We do BOUNCE.', '...But thanks. You\'re a good egg.'); }
  if (a === 1) { vibe--; await K.say('sheila', '...Yeah. Yeah it is. Thanks for that. Really helpful. Top notch.'); }
  if (a === 2) { vibe += 2; await K.say('sheila', 'He\'s four. He\'s a menace. He LOVES *Space Floss*. Can\'t resist it. Goes absolutely feral for the stuff.', 'Throw him some floss and he\'ll stop dead in his tracks. Every time.'); st.setFlag('flossTip'); }
  await K.say('sheila', 'He\'s about yay big, wearing a *green propeller hat*. Can\'t miss him. Well. I missed him. But you won\'t.',
    'The carnival\'s got *low gravity*, so everyone bounces like a roo. The glowy green pads will launch ya platform to platform.',
    'If you get close he\'ll bolt. Little legend\'s got his mum\'s legs. But he *tires out* if you keep after him.');
  if (!st.has('floss')) await K.say('sheila', 'They sell *Space Floss* at the stall on the main platform. Five credits. Worth every cent.');
  const arrive = ride.goTo(P.carnival);
  ride.targetSpeed = 46;
  const b = await K.choose('sheila', 'Hold onto something, I\'m putting me foot down!', [
    { t: 'Does this taxi always bounce like this?' },
    { t: 'Kevin\'s going to be fine.' },
  ]);
  if (b === 0) await K.say('sheila', 'Only when I\'m driving it. Or stressed. Or awake.');
  else { vibe++; await K.say('sheila', 'Yeah. Yeah, he\'s a tough little nugget. Gets that from me.'); }
  await arrive;
  await K.say('sheila', 'Right. I\'ll wait at the landing pad and yell helpful things. GO GO GO!');

  // ---- On foot at the carnival ----
  const C = P.carnival;
  sheila.root.visible = false;
  const sheilaStand = createCharacter('sheila', { standing: true });
  C.addActor(sheilaStand, C.sheilaSpot.x, C.sheilaSpot.y, C.sheilaSpot.z, Math.PI * 0.8);
  sheilaStand.armPose = 'wave';
  game.dialogue.register('sheila', sheilaStand);
  await exitTaxi(game, C, C.spawn);
  game.audio.music('carnival');

  const kevinChar = createCharacter('kevin');
  const kevin = new KidAI(game, C, kevinChar, { kevin: true, home: 'G', name: 'Kevin' });
  game.dialogue.register('kevin', kevinChar);
  const decoys = [
    new KidAI(game, C, createCharacter('kid', { species: 'bunny', hat: 0xff3040, shirt: 0xffc8d8 }), { home: 'I', name: 'Brenda' }),
    new KidAI(game, C, createCharacter('kid', { species: 'fox', hat: 0x3a6bff, shirt: 0xfff0e0 }), { home: 'D', name: 'Tyler' }),
    new KidAI(game, C, createCharacter('kid', { species: 'penguin', hat: 0xffd23f, shirt: 0xf4f4f4 }), { home: 'K', name: 'Gustav' }),
  ];
  const decoyLines = {
    Brenda: ['Hey! I\'m not Kevin, I\'m BRENDA. Kevin\'s the one who won\'t stop bouncing. Also, put me down.'],
    Tyler: ['Stranger danger! STRANGER DANGER!', '...Kevin went that way. Probably. I wasn\'t watching. I was eating a balloon.'],
    Gustav: ['I am Gustav. I have been lost for three days.', 'Nobody has come for Gustav. Gustav has accepted this. Please put Gustav down.'],
  };
  const kidsById = { Brenda: 0, Tyler: 1, Gustav: 2 };
  for (const d of decoys) {
    game.dialogue.define(d.name, { name: d.name, species: 'Lost kid (not Kevin)', voice: 'kid' });
    game.dialogue.register(d.name, d.c);
  }

  let floss = null;
  let flossObj = null;
  let caught = false;
  let decoyGrabs = 0;
  let time = 0;
  const limit = 150;
  const barks = [
    [12, 'He usually goes for the high spots! Look UP!'],
    [35, 'Try the *Space Floss*! Right-click to chuck it. He can\'t say no!'],
    [70, 'He\'s getting tired! Keep after him, he\'ll get dizzy!'],
    [110, 'Come ON, mate! You\'ve got this!'],
    [150, 'Take your time! No pressure! (There is a LOT of pressure.)'],
  ];
  let barkI = 0;
  ui.objective('Find and grab <b>Kevin</b> (green propeller hat)');
  ui.hint('<span class="kbd">SHIFT</span> sprint · <span class="kbd">SPACE</span> jump · <span class="kbd">R-CLICK</span> throw Space Floss');
  C.interactables.length = 0;
  C.interact(C.flossStall, 'Buy Space Floss ×2 (₡5)', () => {
    if (!st.spend(5)) { game.audio.play('deny'); ui.toast('Not enough credits!', 'bad'); return; }
    st.addItem('floss', 2);
    game.audio.play('cash');
    ui.toast('🍭 +2 Space Floss', 'good');
  }, { radius: 3 });

  const grab = async (kid) => {
    if (kid === kevin) {
      caught = true;
      kevin.state = 'held';
      kevinChar.root.parent && kevinChar.root.parent.remove(kevinChar.root);
      kevinChar.root.scale.setScalar(0.9);
      kevinChar.root.rotation.set(0, Math.PI, 0);
      foot.hold(kevinChar.root, 0.18, -0.98, -0.85);
      kevinChar.lookAt(null);
      game.audio.play('success');
      game.audio.play('giggle');
      ui.timer(null);
      await K.say('kevin', 'WHEEEE! AGAIN! AGAIN! Do it AGAIN!');
      ui.objective('Bring Kevin back to <b>Sheila</b> at the landing pad');
    } else {
      decoyGrabs++;
      game.audio.play('deny');
      kid.state = 'dizzy';
      kid.dizzyT = 1;
      await K.say(kid.name, ...decoyLines[kid.name]);
    }
  };
  for (const kid of [kevin, ...decoys]) {
    C.interact(() => kid.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), kid === kevin ? 'Grab the kid!' : 'Grab the kid', () => grab(kid), {
      radius: 2.5 + (st.stat('reflex') - 1) * 0.35,
      cone: 0.3,
      enabled: () => !caught && kid.state !== 'jump' && kid.state !== 'held',
    });
  }
  let returned = false;
  C.interact(() => sheilaStand.root.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 'Give Kevin back to Sheila', () => { returned = true; }, { radius: 3.2, enabled: () => caught && !returned });

  // Floss throwing
  const throwFloss = () => {
    if (!st.has('floss')) { ui.toast('No Space Floss! Buy some at the stall.', 'bad'); game.audio.play('deny'); return; }
    if (flossObj && !floss.eaten) C.group.remove(flossObj);
    st.addItem('floss', -1);
    flossObj = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), toon(0xff9ad8));
    ball.position.y = 0.45;
    flossObj.add(ball);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), toon(0xffffff));
    stick.position.y = 0.1;
    flossObj.add(stick);
    const eye = foot.eyePos();
    flossObj.position.copy(eye);
    C.group.add(flossObj);
    floss = { pos: flossObj.position, vel: foot.forward().multiplyScalar(17).add(new THREE.Vector3(0, 3, 0)), flying: true, eaten: false, plat: null };
    game.audio.play('throw');
    ui.toast(`🍭 Floss thrown (${st.count('floss')} left)`, 'good');
  };

  // Main carnival loop
  await new Promise((resolve) => {
    game.until((dt) => {
      if (game.ui.line) return false;
      time += dt;
      if (!caught) ui.timer(Math.max(0, limit - time), 20);
      if (barkI < barks.length && time > barks[barkI][0] && !caught) { ui.bark('SHEILA (yelling)', barks[barkI][1]); barkI++; }
      if ((game.input.mouse.rclicked || game.input.hit('KeyF')) && !caught) throwFloss();
      if (floss && floss.flying) {
        floss.vel.y -= C.gravity * dt;
        floss.pos.addScaledVector(floss.vel, dt);
        for (const p of Object.values(C.plats)) {
          if (Math.hypot(floss.pos.x - p.x, floss.pos.z - p.z) < p.r && floss.pos.y <= p.y + 0.05 && floss.pos.y > p.y - 1.5 && floss.vel.y < 0) {
            floss.pos.y = p.y;
            floss.flying = false;
            floss.plat = p;
            game.audio.play('splat', { vol: 0.5 });
            break;
          }
        }
        if (floss.pos.y < C.killY) { floss.flying = false; floss.eaten = true; C.group.remove(flossObj); }
      }
      if (floss && floss.eaten && flossObj && flossObj.parent && kevin.state !== 'eat') { C.group.remove(flossObj); }
      if (!caught) kevin.update(dt, foot, floss);
      else kevinChar.update(dt);
      for (const d of decoys) d.update(dt, foot, null);
      if (returned) { resolve(); return true; }
      return false;
    });
  });
  if (flossObj) C.group.remove(flossObj);
  ui.timer(null);
  ui.hint(null);
  foot.clearHeld();
  C.group.add(kevinChar.root);
  kevinChar.root.scale.setScalar(1);
  kevinChar.root.position.copy(sheilaStand.root.position).add(new THREE.Vector3(0.7, 0, -0.5));
  kevinChar.root.rotation.y = sheilaStand.root.rotation.y;
  game.audio.play('cheer');
  await K.say('sheila', 'KEVIN! You absolute RATBAG! Don\'t you ever, EVER... come here, you little legend.');
  await K.say('kevin', 'Mum! Mum! I did a flip! I did SEVEN flips!');
  await K.say('sheila', 'Mate. I owe you big time. Here, take these. Me old *Bounce Boots*. You\'ll jump like a roo.');
  giveItem(game, 'boots');
  const secs = Math.round(time);
  // Clean up the carnival
  C.group.remove(kevinChar.root);
  for (const d of decoys) { C.group.remove(d.c.root); game.dialogue.unregister(d.name); }
  C.actors.splice(C.actors.indexOf(sheilaStand), 1);
  C.group.remove(sheilaStand.root);
  sheila.root.visible = true;
  game.dialogue.register('sheila', sheila);
  C.interactables.length = 0;
  ui.objective('Head back to the taxi');
  await boardAtDock(game, C);
  await K.say('sheila', 'Kevin\'s asleep in me pouch. Out like a light. You\'re a champion, you know that?');
  ride.cruise();
  await K.wait(1.2);
  await dropAtRank(game);
  const stars = starsFrom((time < 55 ? 5 : time < 90 ? 4 : time < limit ? 3 : 2) - decoyGrabs * 0.4 + vibe * 0.2);
  await fareComplete(game, {
    driverId: 'sheila', name: 'Sheila the Kangaroo', stars, pay: 50, xp: 140,
    quote: stars >= 4 ? 'You\'re a flamin\' legend, mate!' : 'Got him back in one piece. Mostly.',
    extraRows: [['Rescue time', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`], ['Wrong kids grabbed', `${decoyGrabs}`]],
  });
  game.dialogue.unregister('sheila');
  game.dialogue.unregister('kevin');
}
