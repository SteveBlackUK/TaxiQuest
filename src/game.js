import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Input } from './core/input.js';
import { AudioSys } from './core/audio.js';
import { UI } from './core/ui.js';
import { GameState } from './core/state.js';
import { City } from './world/city.js';
import { createSky } from './world/sky.js';
import { Traffic } from './world/traffic.js';
import { createTaxi } from './world/taxi.js';
import { createCharacter, CAST } from './world/characters.js';
import { clamp } from './core/util.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x2a0f3a, 0.0019);
    this.scene.background = new THREE.Color(0x14081f);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.04, 6000);
    this.scene.add(this.camera);
    this.input = new Input(this.canvas);
    this.audio = new AudioSys();
    this.state = new GameState();
    this.ui = new UI(this);
    this.time = 0;
    this.timers = [];
    this.waiters = [];
    this.systems = new Set();
    this.paused = false;
    this.started = false;
    this.cameraCtl = null;
    this.shake = 0;
    this.fps = 60;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    window.addEventListener('resize', () => this.resize());
    this.state.onChange(() => this.ui.refreshStats());
  }

  async init(progress = () => {}) {
    const r = this.renderer;
    // Lighting for lit materials (cabs, characters, levels). Buildings are self-lit.
    this.hemi = new THREE.HemisphereLight(0x9a8cff, 0x3a1540, 1.5);
    this.scene.add(this.hemi);
    const moon = new THREE.DirectionalLight(0xcfd8ff, 1.3);
    moon.position.set(-0.5, 1, 0.35);
    this.scene.add(moon);
    this.scene.add(new THREE.AmbientLight(0x6050a0, 0.5));

    progress('Pouring the neon…');
    await nextFrame();
    this.sky = createSky();
    this.scene.add(this.sky.group);
    this.city = new City(this);
    this.city.build();
    this.scene.add(this.city.group);
    progress('Releasing the traffic…');
    await nextFrame();
    this.traffic = new Traffic();
    this.scene.add(this.traffic.group);

    progress('Waxing the taxi…');
    await nextFrame();
    this.taxi = createTaxi();
    this.scene.add(this.taxi.root);
    this.taxi.root.visible = false;

    this.setupComposer();
    this.resize();
    progress('Teaching animals to drive…');
    await nextFrame();
    this.renderPortraits();
    this.applySettings();
    // Compile shaders up front to avoid hitches.
    r.compile(this.scene, this.camera);
  }

  setupComposer() {
    const r = this.renderer;
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.45, 0.8);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  applySettings() {
    const s = this.state.settings;
    this.audio.vol.master = s.master;
    this.audio.vol.music = s.music;
    this.audio.vol.sfx = s.sfx;
    this.audio.applyVolume();
    const pr = s.quality === 'low' ? Math.min(window.devicePixelRatio || 1, 1) * 0.75 : Math.min(window.devicePixelRatio || 1, 1.5);
    if (pr !== this.pixelRatio) { this.pixelRatio = pr; this.resize(); }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(w, h);
      this.bloom.resolution.set(w * this.pixelRatio * 0.5, h * this.pixelRatio * 0.5);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Render each character's head to an image for the dialogue box.
  renderPortraits() {
    const r = this.renderer;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x26164a);
    scene.add(new THREE.HemisphereLight(0xc8c0ff, 0x402040, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(0.6, 0.8, -1);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff3d8b, 2.5);
    rim.position.set(-1, 0.3, 1);
    scene.add(rim);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
    const oldPR = r.getPixelRatio();
    r.setPixelRatio(1);
    r.setSize(256, 256, false);
    const out = document.createElement('canvas');
    out.width = out.height = 256;
    const g = out.getContext('2d');
    this.portraitCanvases = {};
    for (const [id, c] of Object.entries(CAST)) {
      if (!c.portrait) continue;
      const ch = createCharacter(id);
      scene.add(ch.root);
      ch.root.updateMatrixWorld(true);
      const head = new THREE.Vector3();
      ch.headPivot.getWorldPosition(head);
      const scale = id === 'mayor' ? 1.9 : id === 'kevin' ? 0.8 : id === 'gary' ? 1.25 : id === 'carl' ? 1.45 : 1;
      const fwd = id === 'carl' ? 0.2 : 0.05;
      cam.position.set(head.x + 0.45 * scale, head.y + 0.12 * scale, head.z - 1.25 * scale);
      cam.lookAt(head.x, head.y + 0.03 * scale, head.z - fwd);
      ch.update(0.016);
      r.render(scene, cam);
      g.clearRect(0, 0, 256, 256);
      g.drawImage(r.domElement, 0, 0, 256, 256);
      this.ui.portraits[c.portrait] = out.toDataURL('image/png');
      const keep = document.createElement('canvas');
      keep.width = keep.height = 128;
      keep.getContext('2d').drawImage(out, 0, 0, 128, 128);
      this.portraitCanvases[id] = keep;
      scene.remove(ch.root);
    }
    r.setPixelRatio(oldPR);
    this.resize();
  }

  // ---------- Timing helpers for story scripts ----------
  wait(sec) {
    return new Promise((res) => this.timers.push({ at: this.time + sec, res }));
  }
  until(fn) {
    return new Promise((res) => this.waiters.push({ fn, res }));
  }
  addSystem(s) { this.systems.add(s); }
  removeSystem(s) { this.systems.delete(s); }
  setCamera(ctl) { this.cameraCtl = ctl; }

  addShake(v) { this.shake = Math.max(this.shake, v); }

  start() {
    let last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1;
      this.fps = this.fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  frame(dt) {
    const blocked = this.paused || this.ui.modalOpen;
    if (!blocked) {
      this.time += dt;
      this.state.d.playTime += dt;
      for (let i = this.timers.length - 1; i >= 0; i--) {
        if (this.time >= this.timers[i].at) { const t = this.timers[i]; this.timers.splice(i, 1); t.res(); }
      }
      for (let i = this.waiters.length - 1; i >= 0; i--) {
        let ok = false;
        try { ok = this.waiters[i].fn(dt); } catch (e) { console.error(e); ok = true; }
        if (ok) { const w = this.waiters[i]; this.waiters.splice(i, 1); w.res(); }
      }
      for (const s of [...this.systems]) s.update(dt);
      this.traffic.update(dt, this.time);
      this.city.update(dt, this.time);
      this.ui.update(dt);
    }
    if (this.cameraCtl) this.cameraCtl.updateCamera(blocked ? 0 : dt);
    if (this.shake > 0) {
      const s = this.shake;
      this.camera.position.x += (Math.random() - 0.5) * s * 0.1;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.1;
      this.camera.rotation.z += (Math.random() - 0.5) * s * 0.02;
      this.shake = Math.max(0, this.shake - dt * 3);
    }
    this.camera.updateMatrixWorld();
    const cp = new THREE.Vector3();
    this.camera.getWorldPosition(cp);
    this.sky.update(this.time, cp);
    this.render();
    this.input.endFrame();
  }

  render() {
    if (this.state.settings.quality === 'low') this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

export { clamp };
