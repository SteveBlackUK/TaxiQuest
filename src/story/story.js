import * as THREE from 'three';
import { Ride } from '../play/ride.js';
import { Foot } from '../play/foot.js';
import { Drive } from '../play/drive.js';
import { Chase } from '../play/chase.js';
import { FX } from '../play/fx.js';
import { Dialogue } from '../play/dialogue.js';
import { buildRank } from '../places/rank.js';
import { buildSnacks } from '../places/snacks.js';
import { buildCarnival } from '../places/carnival.js';
import { buildBankExterior, buildBankInterior } from '../places/bank.js';
import { buildChapel } from '../places/chapel.js';
import { buildSpire } from '../places/spire.js';
import { hub } from './hub.js';
import { prologue } from './prologue.js';
import { fareCarl } from './carl.js';
import { fareSheila } from './sheila.js';
import { fareGary } from './gary.js';
import { fareLenny } from './lenny.js';
import { finale } from './finale.js';
import { joyride } from './joyride.js';
import { HALF } from '../world/layout.js';

export function setupWorld(game) {
  game.fx = new FX(game);
  game.addSystem(game.fx);
  game.dialogue = new Dialogue(game);
  game.ride = new Ride(game);
  game.foot = new Foot(game);
  game.drive = new Drive(game);
  game.chase = new Chase(game);
  game.places = {
    rank: buildRank(game),
    snacks: buildSnacks(game),
    carnival: buildCarnival(game),
    bankExt: buildBankExterior(game),
    bank: buildBankInterior(game),
    chapel: buildChapel(game),
    spire: buildSpire(game),
  };
  // Places animate even when you're not standing in them (they're visible from the sky).
  game.addSystem({
    update: (dt) => {
      for (const p of Object.values(game.places)) {
        if (!p.group.visible) continue;
        if (game.foot.active && game.foot.level === p) continue; // the foot controller runs it
        for (const a of p.actors) a.update(dt);
        for (const fn of p.updaters) fn(dt, null);
      }
    },
  });
  game.renderer.compile(game.scene, game.camera);
}

// Slow cinematic flight down the street canyons behind the title screen.
function titleFlyover(game) {
  const cam = game.camera;
  game.scene.attach(cam);
  const streets = [5, 9, 3, 11, 8];
  const ctl = {
    t: 0,
    updateCamera(dt) {
      this.t += dt / 70;
      const leg = Math.floor(this.t) % streets.length;
      const u = this.t % 1;
      const k = streets[leg];
      const alongX = leg % 2 === 1;
      const a = -HALF + 80 + u * (HALF * 2 - 160);
      const c = -HALF + k * 96;
      const y = 95 + Math.sin(this.t * 5) * 25;
      if (alongX) { cam.position.set(a, y, c); cam.lookAt(a + 60, y - 12, c + Math.sin(this.t * 7) * 6); }
      else { cam.position.set(c, y, -a); cam.lookAt(c + Math.sin(this.t * 7) * 6, y - 12, -a - 60); }
    },
  };
  game.setCamera(ctl);
  return ctl;
}

async function titleScreen(game) {
  const el = document.getElementById('title');
  const btns = el.querySelector('.title-buttons');
  const st = game.state;
  titleFlyover(game);
  game.ui.showHud(false);
  el.classList.remove('hidden');
  await game.ui.fade(false, 1.2);
  game.audio.music('title');
  return new Promise((resolve) => {
    const hasSave = st.hasSave();
    const done = st.flag('beaten') || (() => { try { return localStorage.getItem('taxiquest.beaten') === '1'; } catch (_) { return false; } })();
    btns.innerHTML = '';
    const mk = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = 'btn ' + cls;
      b.innerHTML = label;
      b.addEventListener('click', () => { game.audio.play('select'); fn(); });
      btns.appendChild(b);
      return b;
    };
    if (hasSave) mk('Continue', 'big', () => { el.classList.add('hidden'); st.load(); resolve('continue'); });
    mk(hasSave ? 'New game' : 'Start your first fare', hasSave ? 'alt' : 'big', () => { el.classList.add('hidden'); st.reset(); st.wipe(); resolve('new'); });
    if (done) mk('Joyride (free flight)', 'pink', () => { el.classList.add('hidden'); resolve('joyride'); });
    mk('How to play', 'alt', async () => {
      await game.ui.modal(`<div class="card"><div class="kicker">HOW TO PLAY</div><h1>Welcome to Neo-Serengeti</h1>
        <p>You ride flying taxis driven by wild animals. Each cabbie needs a favor. Do it well and you'll earn stars, tips and XP. Level up to boost your stats, which unlock new dialogue options and make quests easier.</p>
        ${game.ui.controlsHtml()}
        <div class="buttons"><button class="btn" data-v="ok">Got it</button></div></div>`, { keys: { Escape: 'ok', Enter: 'ok' } });
    });
    mk('Settings', 'alt', () => game.ui.settings());
  });
}

export async function runGame(game) {
  document.getElementById('boot-msg').textContent = 'Building landmarks…';
  await new Promise((r) => requestAnimationFrame(r));
  setupWorld(game);
  const bootBtn = document.getElementById('boot-start');
  document.getElementById('boot-msg').textContent = 'Ready when you are.';
  bootBtn.classList.remove('hidden');
  if (new URLSearchParams(location.search).has('autostart')) bootBtn.click && setTimeout(() => bootBtn.click(), 50);
  await new Promise((r) => bootBtn.addEventListener('click', r, { once: true }));
  game.audio.init();
  game.applySettings();
  document.getElementById('boot').classList.add('hidden');

  // Pause on Esc / lost pointer lock
  game.input.on('key', (code) => {
    if (code === 'Escape' && game.started && !game.ui.modalOpen && !game.paused) openPause(game);
  });
  game.input.on('lock', (locked) => {
    if (!locked && game.input.wantLock && game.started && !game.ui.modalOpen && !game.paused && !game.ui.line) openPause(game);
  });
  game.ui.refreshStats();

  const debugChapter = new URLSearchParams(location.search).get('chapter');
  let choice;
  if (debugChapter !== null) {
    game.state.reset();
    game.state.d.chapter = parseInt(debugChapter, 10);
    const lv = new URLSearchParams(location.search).get('level');
    if (lv) { game.state.d.stats = { charm: +lv, nerve: +lv, reflex: +lv }; game.state.d.credits = 200; }
    if (game.state.d.chapter >= 3) game.state.addItem('boots');
    choice = 'debug';
    document.getElementById('fade').style.opacity = '0';
  } else choice = await titleScreen(game);
  game.started = true;
  game.ui.showHud(true);
  game.ui.refreshStats();

  if (choice === 'joyride') { await joyride(game, true); location.reload(); return; }

  const chapters = [prologue, fareCarl, fareSheila, fareGary, fareLenny, finale];
  for (;;) {
    const ch = game.state.d.chapter;
    if (ch >= chapters.length) break;
    if (ch > 0) {
      const res = await hub(game, ch);
      if (res === 'joyride') { await joyride(game, false); continue; }
    }
    await chapters[ch](game);
    game.state.d.chapter = ch + 1;
    game.state.save();
  }
  try { localStorage.setItem('taxiquest.beaten', '1'); } catch (_) { /* ignore */ }
  // After the finale: free roam at the rank forever.
  for (;;) {
    const res = await hub(game, 99);
    if (res === 'joyride') await joyride(game, false);
  }
}

async function openPause(game) {
  game.paused = true;
  game.input.releaseLock();
  const v = await game.ui.pauseMenu();
  game.paused = false;
  if (v === 'quit') { game.state.save(); location.reload(); return; }
  if (game.input.wantLock) game.input.requestLock();
}

export { THREE };
