import { kit } from './common.js';

const STOCK = [
  { id: 'floss', price: 8, qty: 2 },
  { id: 'hat', price: 90, max: 1 },
  { id: 'tonic', price: 90, max: 1 },
  { id: 'gum', price: 90, max: 1 },
];

const NEWS = {
  1: ['Local crocodile "extremely hungry," say sources.', 'Traffic on Sky Level 60 is fine. Totally fine.'],
  2: ['McSnackers reports record Snappy Meal sale. Robot clerk "shaken but proud."', 'Zero-G Carnival open late tonight.'],
  3: ['Lost joey found safe at Zero-G Carnival. Mum "absolutely stoked."', 'Galactic Reserve Bank: "We have never been robbed." Stay tuned.'],
  4: ['GALACTIC RESERVE ROBBED BY BANANA BANDIT. Police baffled. Drones sticky.', 'Mayor Mechawhiskers: "This is why we need RoboCabs."'],
  5: ['MAYOR BANS ALL ANIMAL-DRIVEN TAXIS AT MIDNIGHT.', '"RoboCabs don\'t shed," says Mayor. Cabbies furious.'],
  99: ['MAYOR MITTENS REVERSES CAB BAN. Takes up taxi driving. Is "a menace."', 'Rank 7 declared "best rank in the galaxy" by everyone who works there.'],
};

const DORIS = {
  1: ['Go on, hon. Hit the *HAIL* beacon by the taxi bay. First fare\'s always the weirdest.', '...Until the second one.'],
  2: ['Heard you got Carl his Snappy Meal. Forty years he\'s been going on about that.', 'Next cab\'s *Sheila*. Kangaroo. She sounded... frantic. Something about a carnival.'],
  3: ['Sheila says you\'re a legend. Her words, not mine. I\'d have said "competent."', 'A gorilla named *Gary* called asking for you by name. Said it\'s "a business opportunity."', 'I don\'t like the sound of that, hon. But the tip might be good.'],
  4: ['Hon, the news says somebody robbed the Galactic Reserve with *bananas*.', 'You wouldn\'t know anything about that, would you?', '...Didn\'t think so.', 'Next up is *Lenny*. Sloth. Getting married today. Heaven help us all.'],
  5: ['That tin can! Mayor Mechawhiskers is banning every animal cabbie in the city at *midnight*!', 'Forty-two years I\'ve dispatched on this rank. Forty-two years!', 'But you... you\'ve made some friends, hon. I made a few calls.', 'Hit the beacon. Your ride\'s coming. All of it.'],
  99: ['The rank\'s never been busier. The mayor\'s driving a cab now. Badly.', 'You did good, hon. Real good.'],
};

const TIPS = {
  1: 'Carl can\'t order for himself. Listen carefully to what he wants, and write it on your brain.',
  2: 'Kids get tired if you keep chasing them. And nothing stops a joey like *Space Floss* from the Vend-o-Matic. Right-click to throw it.',
  3: 'If you\'re ever somewhere you shouldn\'t be, *crouch* (C). Robots can\'t see you as well, and you can hide behind counters.',
  4: 'Sloths drive slow, but I hear you\'ve got fast hands. *Shift* is boost, hon. Mind the buildings.',
  5: 'Big talk needs big stats. Or the right *items*. That mayor\'s got a soft spot for something. Everyone does.',
  99: 'Try a joyride. Nobody\'s timing you now.',
};

const FLAMINGO = {
  1: ['I\'m Dr. Plumeria. Carl\'s doctor. If you see Carl, tell him that fasting for forty years is *not how biology works*.'],
  2: ['Carl ATE? After forty years? I need to update his chart. And possibly write a paper. Possibly win a prize.'],
  3: ['I stand on one leg because it\'s efficient.', 'Also because I\'ve been waiting for a cab for six hours and my other leg filed a complaint.'],
  4: ['Professional opinion: robbing banks is terrible for your heart rate.', '...Did you get the golden banana though? Asking for a friend. The friend is me.'],
  5: ['A robot mayor banning animals? Robots don\'t even have legs.', 'I have ONE leg and I\'m doing fine.'],
  99: ['Everyone\'s healthier since you saved the rank. Except Carl. Carl eats McSnackers every day now. Every. Day.'],
};
const SWEEP = ['BEEP. YOU ARE STANDING ON MY CLEAN SPOT.', 'I HAVE SWEPT THIS DECK 40,000 TIMES. IT IS NEVER CLEAN. I AM NEVER FREE.',
  'PLEASE DO NOT FEED THE PIGEONS. THEY ARE SURVEILLANCE DRONES.', 'HAVE A SPARKLING DAY. SPARKLING IS MY FAVORITE WORD.', 'BEEP BOOP. THAT IS ROBOT FOR "HI". PLEASE DO NOT TELL THE MAYOR I SAID HI.'];

export async function hub(game, chapter) {
  const K = kit(game);
  const rank = game.places.rank;
  const D = game.dialogue;
  D.register('doris', rank.doris);
  if (!game.foot.active || game.foot.level !== rank) game.foot.enter(rank, rank.spawn);
  game.ui.showHud(true);
  game.audio.music(chapter === 5 ? 'boss' : 'city');
  const news = NEWS[chapter] || NEWS[99];
  rank.setNews(news[0], news[1]);
  rank.beaconActive = false;
  const canHail = chapter < 99;
  game.ui.objective(canHail ? 'Hail a taxi at the <b>HAIL</b> beacon' : 'Enjoy the city. Talk to Doris for a joyride.');
  game.ui.hint('<span class="kbd">WASD</span> move · <span class="kbd">MOUSE</span> look · <span class="kbd">E</span> interact · <span class="kbd">ESC</span> pause');
  game.state.save();

  return new Promise((resolve) => {
    let talked = false;
    let busy = false;
    const done = (v) => {
      rank.interactables.length = 0;
      game.ui.hint(null);
      resolve(v);
    };
    rank.interactables.length = 0;
    rank.interact(rank.dispatch.pos, 'Talk to Doris', async () => {
      if (busy) return;
      busy = true;
      if (!talked || chapter === 5) { await D.say('doris', ...(DORIS[chapter] || DORIS[99])); talked = true; }
      for (;;) {
        const opts = [{ t: 'Got any tips?' }, { t: 'Show me my pockets.' }];
        if (chapter >= 5) opts.push({ t: 'Can I borrow a cab for a joyride?' });
        opts.push({ t: 'Bye, Doris.' });
        const i = await D.choose('doris', 'Anything else, hon?', opts);
        const pick = opts[i].t;
        if (pick.startsWith('Got any')) await D.say('doris', TIPS[chapter] || TIPS[99]);
        else if (pick.startsWith('Show me')) await showPockets(game);
        else if (pick.startsWith('Can I borrow')) {
          await D.say('doris', 'Take number 9. Bring it back in one piece. Or at least most of the pieces.');
          busy = false;
          done('joyride');
          return;
        } else break;
      }
      busy = false;
    });
    D.register('flamingo', rank.flamingo);
    D.register('sweep', rank.sweeper);
    let sweepI = 0;
    rank.interact(() => rank.flamingo.root.position.clone().setY(rank.flamingo.root.position.y + 1.6), 'Talk to Dr. Plumeria', async () => {
      if (busy) return;
      busy = true;
      await D.say('flamingo', ...(FLAMINGO[chapter] || FLAMINGO[99]));
      busy = false;
    }, { radius: 3 });
    rank.interact(() => rank.sweeper.root.position.clone().setY(rank.sweeper.root.position.y + 0.6), 'Talk to SWEEP-E', async () => {
      if (busy) return;
      busy = true;
      game.audio.play('robot');
      await D.say('sweep', SWEEP[sweepI++ % SWEEP.length]);
      busy = false;
    }, { radius: 2.6 });
    rank.interact(rank.shop.pos, 'Use the Vend-o-Matic', async () => {
      if (busy) return;
      busy = true;
      game.audio.play('beep');
      await game.ui.shop(STOCK);
      busy = false;
    }, { radius: 2.8 });
    if (canHail) {
      rank.interact(rank.beaconPos, 'Hail a taxi', () => {
        if (busy) return;
        game.audio.play('beep');
        game.audio.play('alert');
        rank.beaconActive = true;
        game.ui.toast('🚕 Taxi requested', 'good');
        done('hail');
      }, { radius: 3 });
    }
  });
}

export async function showPockets(game) {
  const st = game.state;
  const names = { carl: 'Carl', sheila: 'Sheila', gary: 'Gary', lenny: 'Lenny' };
  const rows = Object.entries(names).map(([k, n]) => `<div class="row"><span>${n}</span><span class="v">${st.d.ratings[k] ? '★'.repeat(st.d.ratings[k]) : '—'}</span></div>`).join('');
  await game.ui.modal(`<div class="card wide"><div class="kicker">POCKETS</div><h1>Inventory</h1>
    ${game.ui.inventoryHtml()}
    <h2 style="margin-top:14px">Driver ratings</h2>${rows}
    <div class="buttons"><button class="btn" data-v="ok">Close</button></div></div>`, { keys: { Escape: 'ok', Enter: 'ok', KeyE: 'ok' } });
}
