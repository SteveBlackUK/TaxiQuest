import * as THREE from 'three';
import { kit, makeDriver, taxiArrives, boardAtDock, dropAtRank, fareComplete, giveItem, credits, starsFrom } from './common.js';
import { MENU, TOYS, foodModel } from '../places/snacks.js';
import { pick, shuffle, clamp, rand } from '../core/util.js';

export async function fareCarl(game) {
  const K = kit(game);
  const { D, ui, st, ride, P } = K;
  const carl = makeDriver(game, 'carl');
  let vibe = 0;

  ui.objective('Your taxi is on its way…');
  await taxiArrives(game, carl, { style: 'smooth', speed: 34 });
  ui.objective('Get in the taxi');
  await boardAtDock(game, P.rank);
  game.taxi.tv('ads', ['McSNACKERS: Try the new Quantum Nuggets!', 'SNAPPY MEALS: Now with Robo-Gerald! Collect all 1!', 'CROCODILE DENTAL: We\'ll be gentle. Probably.']);
  game.audio.music('carl');
  ride.cruise();
  await K.wait(0.6);
  ui.banner('FARE #1', 'Carl the Crocodile', 'One Snappy Meal, Hold the Regrets', 2.6);
  await K.wait(1.4);

  await K.say('carl', 'Welcome to Carl\'s Cab. Keep your limbs inside the vehicle and don\'t make eye contact with the teeth.');
  const a = await K.choose('carl', 'So. Where to?', [
    { t: 'Downtown, please.' },
    { t: 'Anywhere with food.' },
    { t: 'You look like a croc on a mission.', req: { charm: 2 } },
  ]);
  if (a === 0) await K.say('carl', 'Wrong answer. We\'re going to McSnackers.');
  if (a === 1) { vibe++; await K.say('carl', 'Oh, I like you. We\'re going to McSnackers.'); }
  if (a === 2) { vibe += 2; await K.say('carl', 'A croc on a MISSION. Yes. Put that on my tombstone. We\'re going to McSnackers.'); }
  await K.say('carl',
    'Crocodiles can go a whole year without eating. I\'ve been doing it for *forty*. Out of spite.',
    'My doctor says that\'s "not how biology works." My doctor is a flamingo. She stands on one leg for a living. What does she know.',
    'Problem is, every time I pull up to McSnackers, the robot sees my teeth, screams, and slams the window.',
    'So today, *you\'re* ordering.');

  // Randomized order
  const order = { main: pick(MENU.mains), side: pick(MENU.sides.filter((x) => x !== 'Solar Salad')), drink: pick(MENU.drinks) };
  const others = (list, not) => shuffle(list.filter((x) => x !== not));
  const decoyMain = others(MENU.mains, order.main)[0];
  const decoySide = others(MENU.sides, order.side)[0];
  const decoyDrink = others(MENU.drinks, order.drink)[0];
  const orderLine = `One *${order.main}*. One *${order.side}*. And a *${order.drink}*.`;
  await K.say('carl', 'Memorize this. I\'ll say it once. *ONCE*.', orderLine,
    'And the Snappy Meal toy has to be the *Robo-Gerald*. Not the Space Duck. NEVER the Space Duck.');
  let repeats = 0;
  for (;;) {
    const r = await K.choose('carl', 'Got all that?', [
      { t: 'Got it.' },
      { t: 'Could you repeat that?' },
    ]);
    if (r === 0) break;
    repeats++;
    vibe--;
    if (repeats === 1) await K.say('carl', '*Sigh.* Kids these days. No object permanence.', orderLine);
    else { await K.say('carl', 'I\'m not saying it a third time. I have a condition. It\'s called being annoyed.'); break; }
  }

  // Distractions while you try to remember
  await K.say('carl',
    `Not the *${decoyMain}*, by the way. I had a bad experience. It had its own gravity. It ate my sunglasses.`,
    `And I know what you\'re thinking. "Carl, what about the *${decoySide}*?" Carl does not DO ${decoySide}.`,
    `Carl also does not do *${decoyDrink}*. Carl has standards.`);
  const s = await K.choose('carl', 'Anyway. What were we talking about?', [
    { t: 'What\'s with the sunglasses?' },
    { t: 'How long have you been driving?' },
    { t: '(Silently rehearse the order.)' },
  ]);
  if (s === 0) await K.say('carl', 'Night vision is for losers. I see with my *heart*. And also my eyes. Mostly my eyes.');
  if (s === 1) await K.say('carl', 'Forty years. Before that I was a handbag model. Long story. Don\'t ask what kind.');
  if (s === 2) { vibe++; await K.say('carl', 'Strong, silent type. I respect that.'); }

  const arrive = ride.goTo(P.snacks);
  ride.targetSpeed = 48;
  await K.say('carl', 'Hold onto your scales. We\'re taking the express lane.');
  await arrive;
  game.audio.music('city');
  await K.say('carl', 'McSnackers Orbital. Look at her. Floating in the sky like a big greasy angel.');
  // Carl hides
  carl.root.position.y = -0.35;
  carl.root.rotation.x = 0.35;
  await K.say('carl', 'I\'m hiding. You talk. Don\'t let it see my teeth.');
  P.snacks.speakerLight.material.color.setRGB(0.4, 3, 0.8);
  ride.camOffset = new THREE.Vector3(0.42, 0.04, 0);
  ride.lookOverride = ride.lookAtWorld(P.snacks.boardPos);
  await K.say('clerk', 'WELCOME TO McSNACKERS ORBITAL. HOME OF THE SNAPPY MEAL. PLEASE SELECT YOUR ORDER ON THE BOARD. NO TEETH PLEASE.');

  // ---- Order minigame ----
  const picked = await orderGame(game);
  const correct = [order.main, order.side, order.drink].filter((x) => picked.includes(x)).length;
  const extras = picked.length - correct;
  const perfect = correct === 3 && extras === 0;
  await K.say('clerk', `ORDER RECEIVED: ${picked.join(', ').toUpperCase()}. PLEASE PULL FORWARD.`);
  if (perfect) await K.say('carl', '*(whispering)* ...Perfect. That was perfect. I think I\'m gonna cry.');
  else if (correct >= 2) await K.say('carl', '*(whispering)* ...Close enough. I guess. I\'ll allow it. Barely.');
  else await K.say('carl', '*(whispering)* ...That is not what I said. That is not what I said AT ALL.');
  vibe += perfect ? 2 : correct >= 2 ? 0 : -2;

  await ride.moveTo(P.snacks.windowDock.pos, P.snacks.windowDock.yaw);
  P.snacks.clerk.face('^_^', '#33f0ff');
  ride.lookOverride = ride.lookAtWorld(P.snacks.windowPos);
  await K.say('clerk', 'YOUR SNAPPY MEAL INCLUDES ONE (1) MYSTERY TOY. PLEASE OPERATE THE TOY-O-TRON.');

  // ---- Toy minigame ----
  let toy = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    toy = await toyGame(game);
    if (toy === 'Robo-Gerald') {
      game.audio.play('success');
      await K.say('carl', '*(from the floor)* IS THAT A GERALD? IS THAT A ROBO-GERALD?!');
      break;
    }
    game.audio.play('fail');
    const opts = [{ t: 'Pay ₡10 to try again.', cost: 10 }, { t: `Keep the ${toy}.` }];
    const c = await K.choose('clerk', `CONGRATULATIONS. YOU RECEIVED: ${toy.toUpperCase()}. INSERT ₡10 TO TRY AGAIN?`, opts);
    if (c === 1) break;
    st.spend(10);
    ui.toast('-₡ 10 · Toy-O-Tron', 'bad');
    game.audio.play('coin');
  }

  // ---- Catch minigame ----
  const food = picked.slice(0, 4);
  await K.say('clerk', 'ENJOY YOUR MEAL. PLEASE CATCH YOUR ORDER. McSNACKERS IS NOT RESPONSIBLE FOR DROPPED FOOD, LOST TOYS OR THE HOT SAUCE.');
  const caught = await catchGame(game, food);
  ride.camOffset = null;
  // Carl pops up
  carl.root.position.y = 0;
  carl.root.rotation.x = 0;
  P.snacks.clerk.face('O_O', '#ff3d8b');
  game.audio.play('alert');
  await K.say('clerk', 'TEETH DETECTED. TEETH DETECTED. HAVE A NICE DAY.');
  game.audio.play('chomp');
  await K.wait(0.6);

  const foodCaught = caught.food;
  const gotToy = caught.toy && toy;
  // Carl's verdict
  const lines = [];
  if (perfect && foodCaught === food.length) lines.push('*CHOMP*. ...Forty years. FORTY YEARS. It was worth every one of them.');
  else if (foodCaught === 0) lines.push('You dropped... all of it. Every single thing. Into the sky. I\'m going to lie down.');
  else if (foodCaught < food.length) lines.push(`*CHOMP*. Some of it made it. I\'m choosing to focus on the ${foodCaught} thing${foodCaught > 1 ? 's' : ''} that did.`);
  else lines.push('*CHOMP CHOMP*. Not exactly what I ordered, but you know what? Food is food.');
  if (caught.sauce > 0) lines.push('Also, why does the whole cab smell like ghost pepper? Did you catch the HOT SAUCE? On purpose?');
  if (gotToy && toy === 'Robo-Gerald') lines.push('And a Robo-Gerald... I\'m not crying, it\'s the salt from the fries.', 'Here. You keep him. The robot panicked and gave us two.');
  else if (gotToy) lines.push(`A ${toy}. Of course. The universe hates crocodiles. Take it. I can\'t look at it.`);
  else lines.push('And the toy went... overboard. Somewhere down there, a pigeon is very happy.');
  await K.say('carl', ...lines);
  if (gotToy && toy === 'Robo-Gerald') giveItem(game, 'gerald');
  else if (gotToy && toy === 'Space Duck') giveItem(game, 'duck');
  if (gotToy && toy === 'Robo-Gerald') st.setFlag('gerald');

  let score = 1 + (correct / 3) * 1.6 - extras * 0.3 + (toy === 'Robo-Gerald' && gotToy ? 1.1 : 0) + (food.length ? (foodCaught / food.length) * 1.0 : 0) - caught.sauce * 0.4 + vibe * 0.15;
  const stars = starsFrom(score);
  await K.say('carl', stars >= 4 ? 'Kid, you\'re alright. Fare\'s on me. Actually I\'m paying YOU. Don\'t tell anyone.' : 'Here\'s your cut. Don\'t spend it all on McSnackers. Actually, do.');
  ride.cruise();
  await K.wait(1.5);
  await dropAtRank(game);
  await fareComplete(game, {
    driverId: 'carl', name: 'Carl the Crocodile', stars, pay: 40, xp: 110,
    quote: stars >= 4 ? 'Best. Snappy. Meal. Ever.' : stars >= 3 ? 'Solid work. My stomach thanks you.' : 'I\'ve had better. I\'ve had worse. Mostly better.',
    extraRows: [['Order correct', `${correct}/3${extras ? ` (+${extras} extra)` : ''}`], ['Food caught', `${foodCaught}/${food.length}`], ['Toy', gotToy ? toy : 'lost']],
  });
  game.dialogue.unregister('carl');
}

// Click items on the 3D menu board.
function orderGame(game) {
  const { ride, ui, input } = { ride: game.ride, ui: game.ui, input: game.input };
  const S = game.places.snacks;
  const board = S.board;
  board.order = [];
  board.hover = null;
  board.draw();
  ride.lookOverride = ride.lookAtWorld(S.boardPos);
  ui.objective('Order Carl\'s food: click items on the <b>menu board</b>, then <b>PLACE ORDER</b>');
  ui.hint('Click menu items to add them · CLEAR to start over');
  game.canvas.style.cursor = 'pointer';
  const ray = new THREE.Raycaster();
  return new Promise((resolve) => {
    game.until(() => {
      ray.setFromCamera(new THREE.Vector2(input.mouse.nx, input.mouse.ny), game.camera);
      const hit = ray.intersectObject(board.mesh)[0];
      const id = hit ? board.hit(hit.uv) : null;
      if (id !== board.hover) { board.hover = id; board.draw(); }
      if (input.mouse.clicked && id) {
        if (id === 'CLEAR') { board.order = []; game.audio.play('ui'); }
        else if (id === 'PLACE ORDER') {
          if (!board.order.length) { game.audio.play('deny'); ui.toast('The order is empty!', 'bad'); }
          else {
            game.audio.play('success');
            board.hover = null;
            board.draw();
            ride.lookOverride = null;
            ui.hint(null);
            ui.objective(null);
            game.canvas.style.cursor = '';
            resolve(board.order.slice());
            return true;
          }
        } else if (board.order.includes(id)) { board.order = board.order.filter((x) => x !== id); game.audio.play('ui'); }
        else if (board.order.length >= 5) { game.audio.play('deny'); ui.toast('That\'s plenty of food.', 'bad'); }
        else { board.order.push(id); game.audio.play('beep'); }
        board.draw();
      }
      return false;
    });
  });
}

// Stop the cycling highlight on the right toy.
function toyGame(game) {
  const S = game.places.snacks;
  const toy = S.toy;
  const ride = game.ride;
  ride.lookOverride = ride.lookAtWorld(S.toyPos);
  const reflex = game.state.stat('reflex');
  const rate = Math.max(2.2, 4.6 - (reflex - 1) * 0.8);
  game.ui.objective('Stop the Toy-O-Tron on <b>Robo-Gerald</b>');
  game.ui.hint('<span class="kbd">SPACE</span> or <span class="kbd">CLICK</span> to stop');
  toy.msg = 'PRESS SPACE TO STOP';
  let t = rand(0, 4);
  let last = -1;
  let stopped = false, hold = 0;
  return new Promise((resolve) => {
    game.until((dt) => {
      if (!stopped) {
        t += dt * rate;
        const i = Math.floor(t) % 4;
        if (i !== last) { last = i; toy.idx = i; toy.draw(); game.audio.tone(600 + i * 120, 0.05, { type: 'square', vol: 0.05 }); }
        if (game.input.anyHit('Space', 'Enter') || game.input.mouse.clicked) {
          stopped = true;
          toy.msg = `YOU GOT: ${TOYS[toy.idx].toUpperCase()}!`;
          toy.draw();
          game.audio.play('ding');
        }
      } else {
        hold += dt;
        toy.idx = Math.floor(hold * 8) % 2 ? toy.idx : toy.idx;
        if (hold > 1.1) {
          game.ride.lookOverride = null;
          game.ui.hint(null);
          game.ui.objective(null);
          resolve(TOYS[toy.idx]);
          return true;
        }
      }
      return false;
    });
  });
}

// The clerk yeets your order at the window. Click to catch. Don't catch the hot sauce.
function catchGame(game, foodList) {
  const S = game.places.snacks;
  const ride = game.ride;
  const ui = game.ui;
  const input = game.input;
  const reflex = game.state.stat('reflex');
  ride.lookOverride = ride.lookAtWorld(S.windowPos.clone().add(new THREE.Vector3(0, 0.2, 0)));
  const queue = shuffle([...foodList.map((f) => ({ kind: f, food: true })), { kind: 'toy', toy: true }, { kind: 'hot sauce', sauce: true }, { kind: 'hot sauce', sauce: true }]);
  // Make sure the first throw isn't hot sauce.
  if (queue[0].sauce) queue.push(queue.shift());
  ui.objective('<b>CLICK</b> your food to catch it. <b>DON\'T</b> catch the hot sauce!');
  game.canvas.style.cursor = 'crosshair';
  const res = { food: 0, toy: false, sauce: 0 };
  const ray = new THREE.Raycaster();
  let idx = 0, cur = null, gap = 0.8;
  const radius = 0.55 + (reflex - 1) * 0.12;
  return new Promise((resolve) => {
    game.until((dt) => {
      if (!cur) {
        gap -= dt;
        if (gap > 0) return false;
        if (idx >= queue.length) {
          ride.lookOverride = null;
          ui.objective(null);
          game.canvas.style.cursor = '';
          resolve(res);
          return true;
        }
        const item = queue[idx++];
        const obj = foodModel(item.kind);
        game.scene.add(obj);
        const from = S.windowPos.clone().add(new THREE.Vector3(0, 0.1, -0.3));
        const camPos = game.camera.getWorldPosition(new THREE.Vector3());
        const to = camPos.clone().add(new THREE.Vector3(rand(-0.9, 0.9), rand(-0.3, 0.4), 0)).lerp(from, 0.08);
        const beyond = to.clone().add(to.clone().sub(from).setY(0).setLength(3)).add(new THREE.Vector3(0, -6, 0));
        cur = { item, obj, from, to, beyond, t: 0, T: Math.max(0.9, 1.45 - idx * 0.05), state: 'fly' };
        game.audio.play('throw');
        P_clerkThrow(S);
        return false;
      }
      cur.t += dt;
      const o = cur.obj;
      if (cur.state === 'fly') {
        const u = Math.min(1, cur.t / cur.T);
        o.position.lerpVectors(cur.from, cur.to, u);
        o.position.y += Math.sin(u * Math.PI) * 1.4;
        o.rotation.x += dt * 6; o.rotation.z += dt * 4;
        if (input.mouse.clicked && u > 0.15) {
          ray.setFromCamera(new THREE.Vector2(input.mouse.nx, input.mouse.ny), game.camera);
          if (ray.ray.distanceToPoint(o.position) < radius * (0.8 + u * 0.6)) {
            cur.state = 'caught';
            cur.t = 0;
            if (cur.item.sauce) {
              res.sauce++;
              game.audio.play('explode', { vol: 0.5 });
              game.addShake(1.5);
              ui.toast('🔥 HOT SAUCE! Why would you catch that?!', 'bad');
              game.fx.spawn(o.position, { count: 18, color: 0xff3020, speed: 4, life: 0.6, size: 0.4 });
            } else {
              if (cur.item.toy) res.toy = true; else res.food++;
              game.audio.play('grab');
              ui.toast(`Caught: ${cur.item.toy ? 'Snappy Toy' : cur.item.kind}`, 'good');
            }
          }
        }
        if (u >= 1) {
          cur.state = 'miss';
          cur.t = 0;
          if (!cur.item.sauce) { game.audio.play('fail', { vol: 0.4 }); ui.toast(cur.item.toy ? 'The toy fell into the void!' : `${cur.item.kind} fell into the void!`, 'bad'); }
          else { game.audio.play('whoosh'); ui.toast('Good dodge!', 'good'); }
        }
      } else if (cur.state === 'caught') {
        o.scale.multiplyScalar(Math.exp(-dt * 6));
        o.position.lerp(game.camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.5, 0)), dt * 6);
        if (cur.t > 0.4) { game.scene.remove(o); cur = null; gap = 0.45; }
      } else {
        o.position.lerp(cur.beyond, dt * 1.6);
        o.rotation.x += dt * 8;
        if (cur.t > 1.0) { game.scene.remove(o); cur = null; gap = 0.35; }
      }
      return false;
    });
  });
}

function P_clerkThrow(S) {
  const c = S.clerk;
  if (!c.arms) return;
  c.armPose = 'wave';
  setTimeout(() => { c.armPose = null; }, 350);
}

export { clamp };
