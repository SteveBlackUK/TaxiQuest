import * as THREE from 'three';
import { Game } from './game.js';
import { createCharacter } from './world/characters.js';

const params = new URLSearchParams(location.search);
const bootMsg = document.getElementById('boot-msg');

async function boot() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px Bungee'), document.fonts.load('800 20px Nunito'), document.fonts.load('900 20px Nunito')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (_) { /* offline: fall back to system fonts */ }
  const game = new Game();
  window.game = game;
  window.THREE = THREE;
  if (params.has('timescale')) game.timeScale = parseFloat(params.get('timescale')) || 1;
  if (params.has('lowfx')) game.state.settings.quality = 'low';
  if (params.has('autoplay')) game.autoplay = { delay: parseFloat(params.get('autoplay')) || 0.25 };
  await game.init((m) => { bootMsg.textContent = m; });
  game.start();

  const view = params.get('view');
  if (view) {
    document.getElementById('boot').classList.add('hidden');
    document.getElementById('fade').style.opacity = '0';
    const cam = game.camera;
    if (view === 'city') {
      cam.position.set(0, 90, 300);
      cam.lookAt(0, 70, 0);
    } else if (view === 'cab') {
      const taxi = game.taxi;
      taxi.root.visible = true;
      taxi.root.position.set(48, 72, 200);
      taxi.setInside(true);
      const drv = createCharacter(params.get('who') || 'carl');
      taxi.anchors.driver.add(drv.root);
      drv.setTalking(true);
      game.addSystem({ update: (dt) => { drv.update(dt); taxi.update(dt, 10); } });
      taxi.anchors.eyeRear.add(cam);
      cam.position.set(0, 0, 0);
      cam.rotation.set(-0.08, 0.15, 0);
      drv.lookAt(new THREE.Vector3(49, 73.4, 201.3));
    } else if (view === 'taxi') {
      const taxi = game.taxi;
      taxi.root.visible = true;
      taxi.root.position.set(48, 72, 200);
      taxi.setDoor(true);
      game.addSystem({ update: (dt) => taxi.update(dt, 10) });
      cam.position.set(54, 75, 207);
      cam.lookAt(48, 72.5, 200);
    } else if (view === 'portraits') {
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:#111;z-index:100';
      for (const [k, v] of Object.entries(game.ui.portraits)) {
        const im = document.createElement('img'); im.src = v; im.style.width = '200px'; im.title = k; box.appendChild(im);
      }
      document.body.appendChild(box);
    } else if (view === 'cast') {
      const ids = ['carl', 'sheila', 'gary', 'lenny', 'doris', 'kevin', 'linda', 'mayor', 'clerk', 'teller'];
      ids.forEach((id, i) => {
        const c = createCharacter(id, { standing: true });
        c.root.position.set(48 + (i - 4.5) * 1.3, 70, 200);
        c.root.rotation.y = Math.PI;
        game.scene.add(c.root);
        game.addSystem({ update: (dt) => c.update(dt) });
      });
      const floor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 4), new THREE.MeshLambertMaterial({ color: 0x333344 }));
      floor.position.set(48, 69.9, 200);
      game.scene.add(floor);
      cam.position.set(48, 71.3, 206.5);
      cam.lookAt(48, 70.9, 200);
    }
    return;
  }

  const { runGame } = await import('./story/story.js');
  runGame(game);
}

boot().catch((e) => {
  console.error(e);
  bootMsg.textContent = 'Something went wrong starting the engine: ' + e.message;
});
