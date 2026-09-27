import * as THREE from 'three';
import { createCharacter } from '../world/characters.js';
import { findRoute, nodesToPoints, CRUISE_ALT } from '../play/ride.js';
import { streetPos } from '../world/layout.js';
import { ITEMS } from '../core/state.js';

// Shared story helpers. Everything here is awaited by the fare scripts.
export function kit(game) {
  const D = game.dialogue;
  return {
    g: game, D, ui: game.ui, st: game.state, ride: game.ride, foot: game.foot, drive: game.drive, chase: game.chase, P: game.places,
    say: (...a) => D.say(...a),
    choose: (...a) => D.choose(...a),
    wait: (s) => game.wait(s),
  };
}

export function makeDriver(game, id, opts = {}) {
  const ch = createCharacter(id, opts);
  game.dialogue.register(id, ch);
  return ch;
}

export async function fadeOut(game, dur = 0.5) { await game.ui.fade(true, dur); }
export async function fadeIn(game, dur = 0.5) { await game.ui.fade(false, dur); }

// Where taxis appear from when hailed: a few intersections away from the rank.
export function hailStart(game) {
  const rank = game.places.rank;
  const e = rank.dock.entry;
  return new THREE.Vector3(streetPos(4), CRUISE_ALT, e.z - 96 * 2);
}

// Taxi flies in and docks at the rank. Player is on foot watching.
export async function taxiArrives(game, driver, { style = 'smooth', speed = 30 } = {}) {
  const rank = game.places.rank;
  const start = hailStart(game);
  game.ride.begin({ driver, pos: start, yaw: Math.PI, style, speed, passenger: false });
  game.taxi.setLicense(driver.cast?.name || 'Driver', (driver.cast?.species || '').split('·')[0].trim(), game.portraitCanvases[driver.cast?.portrait]);
  await game.ride.goTo(rank);
  game.taxi.setDoor(true);
  game.audio.play('honk');
  game.audio.play('hiss');
}

// Player walks up to the taxi door and presses E. Resolves once seated.
export function boardAtDock(game, place, label = 'Get in the taxi') {
  return new Promise((resolve) => {
    const it = place.interact(() => {
      const p = new THREE.Vector3(0.9, 1.1, 1.2);
      return game.taxi.root.localToWorld(p);
    }, label, async () => {
      place.interactables.splice(place.interactables.indexOf(it), 1);
      game.audio.play('door');
      await fadeOut(game, 0.35);
      game.foot.exit();
      game.taxi.setDoor(false);
      game.ride.setPassenger(true);
      game.ui.objective(null);
      await fadeIn(game, 0.4);
      resolve();
    }, { radius: 3.2, cone: 0.2 });
  });
}

// Step out at a place: on foot next to the docked taxi.
export async function exitTaxi(game, place, spawn = place.spawn) {
  game.audio.play('door');
  await fadeOut(game, 0.35);
  game.ride.setPassenger(false);
  game.taxi.setDoor(true);
  game.foot.enter(place, spawn);
  await fadeIn(game, 0.4);
}

// Back at the rank after a fare (skips the flight back).
export async function dropAtRank(game) {
  await fadeOut(game, 0.6);
  game.ride.end();
  game.chase.active && game.chase.end();
  const rank = game.places.rank;
  game.taxi.root.visible = false;
  for (const d of Object.values(game.dialogue.actors)) if (d.root.parent === game.taxi.anchors.driver) game.taxi.anchors.driver.remove(d.root);
  clearSeats(game);
  game.foot.enter(rank, rank.spawn);
  game.audio.music('city');
  await game.wait(0.1);
  await fadeIn(game, 0.6);
}

export function clearSeats(game) {
  for (const k of ['driver', 'passenger', 'rearLeft', 'rearMid', 'rearRight', 'roof']) {
    const a = game.taxi.anchors[k];
    while (a.children.length) a.remove(a.children[0]);
  }
}

export function starsFrom(score) { return Math.max(1, Math.min(5, Math.round(score))); }

export async function fareComplete(game, { driverId, name, stars, pay, tipBase = 8, xp, quote, extraRows = [] }) {
  const st = game.state;
  const tip = Math.round(stars * tipBase * (1 + (st.stat('charm') - 1) * 0.15));
  st.rate(driverId, stars);
  st.addCredits(pay + tip);
  const lv = st.addXp(xp + stars * 10);
  game.audio.play('cash');
  game.ui.refreshStats();
  await game.ui.fareCard({
    title: name, stars, quote,
    rows: [['Payment', `₡ ${pay}`], ['Tip', `₡ ${tip}`], ...extraRows, ['XP', `+${xp + stars * 10}`]],
  });
  if (lv) await game.ui.levelUp();
  st.save();
}

export function giveItem(game, id, n = 1) {
  game.state.addItem(id, n);
  const it = ITEMS[id];
  game.ui.toast(`${it.icon} Got: ${it.name}${n > 1 ? ' ×' + n : ''}`, 'good');
  game.audio.play('grab');
}

export function credits(game, n, why = '') {
  game.state.addCredits(n);
  game.ui.toast(`${n >= 0 ? '+' : ''}₡ ${n}${why ? ' · ' + why : ''}`, n >= 0 ? 'money' : 'bad');
  game.audio.play(n >= 0 ? 'coin' : 'deny');
}

// Build a checkpoint course through the streets between two points.
export function streetCourse(fromPos, fromFwd, goal, alts, every = 1) {
  const f = fromFwd;
  const fx = (fromPos.x + 672) / 96, fz = (fromPos.z + 672) / 96;
  const start = Math.abs(f.x) > Math.abs(f.z)
    ? { kx: Math.round(fx + Math.sign(f.x) * 0.8), kz: Math.round(fz), d: f.x > 0 ? 0 : 1 }
    : { kx: Math.round(fx), kz: Math.round(fz + Math.sign(f.z) * 0.8), d: f.z > 0 ? 2 : 3 };
  const nodes = findRoute(start, start.d, goal);
  const pts = [];
  nodes.forEach((n, i) => {
    if (i % every !== 0 && i !== nodes.length - 1) return;
    pts.push(new THREE.Vector3(streetPos(n.kx), alts[pts.length % alts.length], streetPos(n.kz)));
  });
  return pts;
}

export { nodesToPoints };
