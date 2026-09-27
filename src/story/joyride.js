import * as THREE from 'three';
import { kit, fadeOut, fadeIn, clearSeats } from './common.js';
import { streetPos, N } from '../world/layout.js';
import { glowMat } from '../core/textures.js';
import { rand } from '../core/util.js';

// Free flight around the city, collecting credit rings. Press Enter to head home.
export async function joyride(game, fromTitle) {
  const K = kit(game);
  const { ui, st, drive, foot, P } = K;
  await fadeOut(game, 0.5);
  if (foot.active) foot.exit();
  clearSeats(game);
  const rank = P.rank;
  const start = rank.dock.entry.clone().setY(80);
  drive.begin({ pos: start, yaw: Math.PI });
  game.audio.music('drive');
  // Credit rings
  const rings = [];
  const group = new THREE.Group();
  game.scene.add(group);
  const tex = game.fx.textSprite('₡', '#ffd23f');
  for (let i = 0; i < 30; i++) {
    const kx = 1 + Math.floor(Math.random() * (N - 1)), kz = 1 + Math.floor(Math.random() * (N - 1));
    if ((kx === 7 && kz === 7) || (kx === 10 && kz === 10)) continue;
    const p = new THREE.Vector3(streetPos(kx), rand(45, 180), streetPos(kz));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.35, 8, 24), glowMat(0xffd23f, 2.5));
    ring.position.copy(p);
    const coin = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    coin.scale.setScalar(3);
    coin.position.copy(p);
    group.add(ring, coin);
    rings.push({ ring, coin, p, got: false });
  }
  await fadeIn(game, 0.5);
  ui.banner('JOYRIDE', 'Free flight', 'Collect ₡ rings · ENTER to go home', 2.4);
  ui.hint('<span class="kbd">MOUSE</span> steer · <span class="kbd">W</span> go · <span class="kbd">SHIFT</span> boost · <span class="kbd">SPACE/C</span> up/down · <span class="kbd">ENTER</span> end joyride');
  let got = 0;
  ui.objective(`Collect credit rings: <b>0/${rings.length}</b>`);
  await new Promise((res) => {
    game.until((dt) => {
      for (const r of rings) {
        if (r.got) continue;
        r.ring.rotation.y += dt * 2;
        if (drive.pos.distanceTo(r.p) < 5) {
          r.got = true;
          group.remove(r.ring, r.coin);
          got++;
          st.addCredits(5);
          game.audio.play('coin');
          ui.objective(`Collect credit rings: <b>${got}/${rings.length}</b>`);
        }
      }
      if (game.input.hit('Enter') && !game.ui.line) { res(); return true; }
      return false;
    });
  });
  if (got) ui.toast(`+₡ ${got * 5} from rings`, 'money');
  await fadeOut(game, 0.5);
  drive.end();
  game.taxi.root.visible = false;
  game.scene.remove(group);
  ui.hint(null);
  ui.objective(null);
  st.save();
  if (!fromTitle) foot.enter(rank, rank.spawn);
  await fadeIn(game, 0.5);
}
