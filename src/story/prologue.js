import { kit, fadeOut, fadeIn } from './common.js';

export async function prologue(game) {
  const K = kit(game);
  const rank = game.places.rank;
  game.ui.showHud(false);
  game.audio.music('title');
  await K.ui.banner('NEO-SERENGETI · 2199', 'The humans left.', 'The animals kept the lights on.', 3.2);
  await K.ui.banner('SKY LEVEL 64', 'You just landed.', 'You have ₡20 and a suitcase full of dreams (mostly socks).', 3.4);
  await fadeOut(game, 0.8);
  game.dialogue.register('doris', rank.doris);
  game.foot.enter(rank, rank.spawn);
  game.ui.showHud(true);
  game.audio.music('city');
  await fadeIn(game, 0.8);
  await K.ui.banner('TAXI RANK 7', 'Welcome to the rank', 'Every cab in this city is driven by an animal.', 2.6);
  game.ui.objective('Talk to <b>Doris</b> at the Dispatch booth');
  game.ui.hint('<span class="kbd">CLICK</span> to look around · <span class="kbd">WASD</span> move · <span class="kbd">E</span> interact');

  await new Promise((resolve) => {
    rank.interactables.length = 0;
    rank.interact(rank.dispatch.pos, 'Talk to Doris', async () => {
      rank.interactables.length = 0;
      game.ui.hint(null);
      await K.say('doris',
        'Oh! A *human*. Haven\'t seen one of you in... well. Ever. Welcome to Neo-Serengeti, hon.',
        'I\'m Doris. I run dispatch on Rank 7. Forty-two years. Tortoise. We\'re in it for the long haul.');
      const a = await K.choose('doris', 'You look lost. Where you headed?', [
        { t: 'I\'m looking for work.' },
        { t: 'I have no idea. I just got here.' },
        { t: 'Is it true all the cab drivers are animals?' },
      ]);
      if (a === 0) await K.say('doris', 'Work! In this economy? Ha. Well... I might have something.');
      if (a === 1) await K.say('doris', 'That\'s the spirit. Nobody here has any idea either.');
      if (a === 2) await K.say('doris', 'Every single one. Humans kept crashing into things. Turns out a crocodile can drive just fine. Mostly.');
      await K.say('doris',
        'Here\'s how the rank works. Every cabbie in this city is an animal, and every one of \'em needs a *favor*.',
        'You ride along, you help out, they rate you. More *stars*, bigger *tips*. Tips buy you things at the *Vend-o-Matic* over there.',
        'Do enough favors and you\'ll *level up*. Get charming, get nervy, get quick. Life in the sky gets easier.');
      const b = await K.choose('doris', 'Any questions?', [
        { t: 'What kind of favors?' },
        { t: 'Is this safe?' },
        { t: 'Let\'s do this.' },
      ]);
      if (b === 0) await K.say('doris', 'Oh, all sorts. Snacks. Lost kids. The occasional light felony. Nothing you can\'t handle.');
      if (b === 1) await K.say('doris', 'Hon, you\'re a thousand feet up on a platform held up by optimism. Nothing is safe. Enjoy it.');
      if (b === 2) await K.say('doris', 'I like you already.');
      await K.say('doris', 'Now go hit that *HAIL* beacon by the taxi bay. I\'ve got a feeling about your first fare.');
      game.state.addXp(10);
      resolve();
    });
  });
}
