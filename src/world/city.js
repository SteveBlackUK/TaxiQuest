import * as THREE from 'three';
import { mulberry32, clamp, lerp } from '../core/util.js';
import { drawTexture, neonText, FONT_DISPLAY, roundRect } from '../core/textures.js';
import { N, BLOCK, PITCH, HALF, blockCenter, streetPos, isReserved, toBlockIndex } from './layout.js';

const BUILDING_VERT = /* glsl */`
varying vec3 vWP;
varying vec3 vN;
varying vec3 vI;
varying vec3 vLocal;
varying vec3 vScale;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  #ifdef USE_INSTANCING_COLOR
  vI = instanceColor;
  #else
  vI = vec3(0.5);
  #endif
  vLocal = position;
  vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const BUILDING_FRAG = /* glsl */`
uniform float uTime;
varying vec3 vWP;
varying vec3 vN;
varying vec3 vI;
varying vec3 vLocal;
varying vec3 vScale;
#include <common>
#include <fog_pars_fragment>
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 accentCol(float g) {
  if (g < 0.25) return vec3(1.0, 0.24, 0.55);
  if (g < 0.5) return vec3(0.2, 0.94, 1.0);
  if (g < 0.75) return vec3(0.7, 0.3, 1.0);
  return vec3(1.0, 0.82, 0.25);
}
void main() {
  vec3 n = normalize(vN);
  float seed = floor(vI.r * 97.0);
  float style = vI.g;
  float density = vI.b;
  vec3 base = mix(vec3(0.012, 0.012, 0.028), vec3(0.03, 0.022, 0.045), fract(seed * 0.137));
  vec3 col;
  float edgeGlow = 0.0;
  bool accent = fract(seed * 0.618) > 0.68;
  if (n.y > 0.5) {
    col = base * 0.7;
    // rooftop rim
    float ex = (0.5 - abs(vLocal.x)) * vScale.x;
    float ez = (0.5 - abs(vLocal.z)) * vScale.z;
    if (accent && min(ex, ez) < 0.6) edgeGlow = 1.0;
  } else if (n.y < -0.5) {
    col = base * 0.5;
  } else {
    bool alongX = abs(n.x) > 0.5;
    vec2 uv = alongX ? vec2(vWP.z, vWP.y) : vec2(vWP.x, vWP.y);
    float cw = 2.6 + fract(seed * 0.31) * 1.6;
    float chh = 3.4 + fract(seed * 0.71) * 0.8;
    vec2 cell = vec2(cw, chh);
    vec2 id = floor(uv / cell);
    vec2 f = fract(uv / cell);
    float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.78);
    float h = h21(id + vec2(seed * 1.3, seed * 0.7) + (n.x + n.z * 2.0) * 17.0);
    float floorOn = step(0.3, h21(vec2(id.y, seed)));
    float lit = step(1.0 - density, h) * floorOn;
    // A few windows slowly flick on and off.
    float flick = step(0.985, h21(id * 1.7 + seed)) * step(0.5, fract(uTime * 0.05 + h * 7.0));
    lit = clamp(lit + flick, 0.0, 1.0);
    vec3 warm = vec3(1.0, 0.62, 0.28);
    vec3 cool = vec3(0.35, 0.7, 1.0);
    vec3 pink = vec3(1.0, 0.35, 0.8);
    vec3 wc = mix(warm, cool, step(0.55, fract(h * 7.0 + style)));
    wc = mix(wc, pink, step(0.88, fract(h * 13.0 + style * 3.0)));
    float bright = 0.18 + 0.5 * fract(h * 31.0);
    bright += step(0.96, fract(h * 53.0)) * 1.2;
    col = base + win * (lit * wc * bright + (1.0 - lit) * vec3(0.012, 0.016, 0.035));
    // Shading so faces read as 3D.
    col *= alongX ? 0.9 + 0.1 * n.x : 0.8 + 0.1 * n.z;
    float horiz = alongX ? (0.5 - abs(vLocal.z)) * vScale.z : (0.5 - abs(vLocal.x)) * vScale.x;
    float top = (1.0 - vLocal.y) * vScale.y;
    if (accent && (horiz < 0.22 || top < 0.35)) edgeGlow = 1.0;
    // Glowing band stripes on some towers.
    if (fract(seed * 0.419) > 0.7) {
      float band = step(0.93, fract(vWP.y / 24.0 + seed * 0.1));
      edgeGlow = max(edgeGlow, band * 0.8);
    }
    // Ground-level glow
    col += vec3(0.35, 0.1, 0.4) * smoothstep(18.0, 0.0, vWP.y) * 0.25;
  }
  col += accentCol(style) * edgeGlow * 1.25;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const GROUND_FRAG = /* glsl */`
varying vec3 vWP;
uniform float uHalf;
uniform float uPitch;
uniform float uStreet;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec2 p = vWP.xz + uHalf;
  vec2 m = mod(p, uPitch);
  vec2 d = min(m, uPitch - m); // distance to street centerline
  float street = step(min(d.x, d.y), uStreet * 0.5);
  vec3 col = mix(vec3(0.02, 0.015, 0.04), vec3(0.05, 0.045, 0.08), street);
  float lineX = (1.0 - step(0.35, d.x)) * step(0.5, fract(p.y / 8.0));
  float lineZ = (1.0 - step(0.35, d.y)) * step(0.5, fract(p.x / 8.0));
  col += vec3(0.2, 0.9, 1.0) * max(lineX, lineZ) * 0.9;
  float curbX = (1.0 - step(0.4, abs(d.x - uStreet * 0.5)));
  float curbZ = (1.0 - step(0.4, abs(d.y - uStreet * 0.5)));
  col += vec3(1.0, 0.3, 0.6) * max(curbX, curbZ) * 0.6;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

const GROUND_VERT = /* glsl */`
varying vec3 vWP;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const SIGN_WORDS_H = [
  'RHINO RAMEN', 'HIPPO HOTEL', 'ZEBRA ZAP', 'GNU NEWS', 'LLAMA LOANS', 'OTTER SPACE', 'BAT BURGERS', 'YAK SNACKS',
  'MOOSE JUICE', 'CROC COCOA', 'OKAPI ORBITAL', 'PANGOLIN PAWN', 'QUOKKA KARAOKE', 'WOMBAT WIFI', 'JELLY JAZZ', 'LEMUR LAUNDRY',
  'MEERKAT MART', 'HYENA COMEDY', 'GIRAFFE GYM', 'EMU EMPORIUM', 'NEWT NOODLES', 'BISON BOWLING', 'MOLE MOTEL', 'IBIS INSURANCE',
  'FERRET FOTO', 'SQUID SUSHI', 'KOALA KOFFEE', 'TAPIR TATTOO', 'VOLE VIDEO', 'HAWK HARDWARE', 'ECHIDNA ECHO', 'SLOTH EXPRESS',
];
const SIGN_WORDS_V = ['タクシー', 'BAR', 'RAMEN', 'HOTEL', 'ネオン', 'OPEN', 'SUSHI', 'DINER', 'カフェ', 'CLUB', 'SPA', 'ARCADE', 'ロボ', 'PAWN', 'NOODLE', '24H'];
const NEON = ['#ff3d8b', '#33f0ff', '#ffd23f', '#6dff8a', '#ff8a1f', '#b14dff', '#ff5a5a', '#5a8bff'];

export class City {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.name = 'city';
    this.rand = mulberry32(90210);
    this.blockBoxes = [];
    for (let i = 0; i < N; i++) { this.blockBoxes.push([]); for (let j = 0; j < N; j++) this.blockBoxes[i].push([]); }
    this.extraBoxes = [];
    this.buildings = [];
    this.uniforms = { uTime: { value: 0 } };
    this.animated = [];
  }

  build() {
    this.buildGround();
    this.buildBuildings();
    this.buildSigns();
    this.buildBillboards();
    this.buildSearchlights();
    this.buildSpaceElevator();
  }

  // ---------- Collision queries ----------
  addCollider(box) {
    const i0 = clamp(toBlockIndex(box.minX), 0, N - 1), i1 = clamp(toBlockIndex(box.maxX), 0, N - 1);
    const j0 = clamp(toBlockIndex(box.minZ), 0, N - 1), j1 = clamp(toBlockIndex(box.maxZ), 0, N - 1);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) this.blockBoxes[i][j].push(box);
  }
  removeCollider(box) {
    for (const row of this.blockBoxes) for (const list of row) {
      const k = list.indexOf(box);
      if (k >= 0) list.splice(k, 1);
    }
  }
  query(x, z, r, out = []) {
    out.length = 0;
    const i0 = clamp(toBlockIndex(x - r), 0, N - 1), i1 = clamp(toBlockIndex(x + r), 0, N - 1);
    const j0 = clamp(toBlockIndex(z - r), 0, N - 1), j1 = clamp(toBlockIndex(z + r), 0, N - 1);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      for (const b of this.blockBoxes[i][j]) if (!out.includes(b)) out.push(b);
    }
    return out;
  }

  buildGround() {
    const mat = new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uHalf: { value: HALF }, uPitch: { value: PITCH }, uStreet: { value: PITCH - BLOCK } }]),
      fog: true,
    });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 5, HALF * 5), mat);
    g.rotation.x = -Math.PI / 2;
    this.group.add(g);
  }

  buildBuildings() {
    const r = this.rand;
    const boxes = [];
    const addTower = (cx, cz, w, d, h, y0 = 0) => {
      boxes.push({ cx, cz, w, d, h, y0, seed: r(), style: r(), density: 0.15 + r() * 0.35 });
      const box = { minX: cx - w / 2, maxX: cx + w / 2, minY: y0, maxY: y0 + h, minZ: cz - d / 2, maxZ: cz + d / 2, tag: 'building' };
      this.addCollider(box);
      this.buildings.push(box);
      return box;
    };
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (isReserved(i, j)) continue;
        const bx = blockCenter(i), bz = blockCenter(j);
        const dist = Math.hypot(bx, bz) / HALF;
        const maxH = lerp(300, 70, clamp(dist * 1.1, 0, 1));
        const minH = lerp(90, 30, clamp(dist, 0, 1));
        const layout = r();
        const lots = [];
        if (layout < 0.3) lots.push([bx, bz, BLOCK, BLOCK]);
        else if (layout < 0.6) {
          const split = lerp(0.35, 0.65, r());
          const a = BLOCK * split, b = BLOCK - a;
          if (r() < 0.5) { lots.push([bx - BLOCK / 2 + a / 2, bz, a, BLOCK]); lots.push([bx + BLOCK / 2 - b / 2, bz, b, BLOCK]); }
          else { lots.push([bx, bz - BLOCK / 2 + a / 2, BLOCK, a]); lots.push([bx, bz + BLOCK / 2 - b / 2, BLOCK, b]); }
        } else {
          const h = BLOCK / 2;
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) lots.push([bx + sx * h / 2, bz + sz * h / 2, h, h]);
        }
        for (const [lx, lz, lw, ld] of lots) {
          const inset = 1.5 + r() * 4;
          const w = lw - inset * 2, d = ld - inset * 2;
          const h = minH + Math.pow(r(), 1.6) * (maxH - minH);
          addTower(lx, lz, w, d, h);
          if (r() < 0.45 && h > 60) {
            const f = 0.5 + r() * 0.3;
            const h2 = 12 + r() * h * 0.35;
            addTower(lx, lz, w * f, d * f, h2, h);
            if (r() < 0.5) this.antenna(lx, h + h2, lz, 10 + r() * 30);
          } else if (r() < 0.3) this.antenna(lx + (r() - 0.5) * w * 0.5, h, lz + (r() - 0.5) * d * 0.5, 8 + r() * 20);
          if (r() < 0.5) this.roofJunk(lx, h, lz, w, d);
        }
      }
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: BUILDING_VERT,
      fragmentShader: BUILDING_FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
      fog: true,
    });
    this.buildingMat = mat;
    const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    boxes.forEach((b, k) => {
      m.makeScale(b.w, b.h, b.d);
      m.setPosition(b.cx, b.y0, b.cz);
      mesh.setMatrixAt(k, m);
      c.setRGB(b.seed, b.style, b.density);
      mesh.setColorAt(k, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.group.add(mesh);
    this.buildingMesh = mesh;
    this.flushProps();
  }

  antenna(x, y, z, h) {
    (this._antennas ||= []).push({ x, y, z, h });
  }
  roofJunk(x, y, z, w, d) {
    const r = this.rand;
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      (this._junk ||= []).push({ x: x + (r() - 0.5) * w * 0.6, y, z: z + (r() - 0.5) * d * 0.6, s: 3 + r() * 6, h: 2 + r() * 4 });
    }
  }
  flushProps() {
    const ants = this._antennas || [];
    const m = new THREE.Matrix4();
    if (ants.length) {
      const g = new THREE.CylinderGeometry(0.3, 0.6, 1, 6);
      g.translate(0, 0.5, 0);
      const mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x22202e }), ants.length);
      const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2030).multiplyScalar(4) }), ants.length);
      ants.forEach((a, k) => {
        m.makeScale(1, a.h, 1); m.setPosition(a.x, a.y, a.z); mesh.setMatrixAt(k, m);
        m.makeTranslation(a.x, a.y + a.h, a.z); lights.setMatrixAt(k, m);
      });
      this.group.add(mesh, lights);
      this.antennaLights = lights;
    }
    const junk = this._junk || [];
    if (junk.length) {
      const g = new THREE.BoxGeometry(1, 1, 1);
      g.translate(0, 0.5, 0);
      const mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x2a2838 }), junk.length);
      junk.forEach((j, k) => { m.makeScale(j.s, j.h, j.s); m.setPosition(j.x, j.y, j.z); mesh.setMatrixAt(k, m); });
      this.group.add(mesh);
    }
  }

  // All shop signs are merged into two meshes (horizontal and vertical atlases).
  buildSigns() {
    const r = this.rand;
    const hAtlas = drawTexture(1024, 2048, (g) => {
      SIGN_WORDS_H.forEach((word, k) => {
        const col = k % 2, row = Math.floor(k / 2);
        const x = col * 512, y = row * 128;
        const c = NEON[k % NEON.length];
        g.fillStyle = 'rgba(10,5,25,0.85)';
        roundRect(g, x + 6, y + 10, 500, 108, 14);
        g.fill();
        g.strokeStyle = c; g.lineWidth = 5; g.shadowColor = c; g.shadowBlur = 12;
        roundRect(g, x + 12, y + 16, 488, 96, 10);
        g.stroke();
        g.shadowBlur = 0;
        neonText(g, word, x + 256, y + 66, c, 60, { maxW: 450, glow: 16 });
      });
    });
    const vAtlas = drawTexture(2048, 1024, (g) => {
      SIGN_WORDS_V.forEach((word, k) => {
        const x = k * 128;
        const c = NEON[(k + 3) % NEON.length];
        g.fillStyle = 'rgba(10,5,25,0.85)';
        roundRect(g, x + 8, 6, 112, 1012, 14);
        g.fill();
        g.strokeStyle = c; g.lineWidth = 5; g.shadowColor = c; g.shadowBlur = 12;
        roundRect(g, x + 14, 12, 100, 1000, 10);
        g.stroke();
        g.shadowBlur = 0;
        const chars = [...word];
        const step = Math.min(120, 960 / chars.length);
        chars.forEach((ch, i) => neonText(g, ch, x + 64, 40 + step * (i + 0.5), c, Math.min(84, step * 0.85), { glow: 14 }));
      });
    });
    const hQuads = [], vQuads = [];
    for (const b of this.buildings) {
      if (b.minY > 0) continue; // only on the base tower
      const h = b.maxY;
      if (h < 30) continue;
      const faces = [
        { nx: 1, nz: 0, x: b.maxX, z: (b.minZ + b.maxZ) / 2, w: b.maxZ - b.minZ },
        { nx: -1, nz: 0, x: b.minX, z: (b.minZ + b.maxZ) / 2, w: b.maxZ - b.minZ },
        { nx: 0, nz: 1, x: (b.minX + b.maxX) / 2, z: b.maxZ, w: b.maxX - b.minX },
        { nx: 0, nz: -1, x: (b.minX + b.maxX) / 2, z: b.minZ, w: b.maxX - b.minX },
      ];
      for (const f of faces) {
        // Only on faces that look onto a street.
        const bi = toBlockIndex(b.minX + 1), bj = toBlockIndex(b.minZ + 1);
        const edgeX = f.nx > 0 ? blockCenter(bi) + BLOCK / 2 : blockCenter(bi) - BLOCK / 2;
        const edgeZ = f.nz > 0 ? blockCenter(bj) + BLOCK / 2 : blockCenter(bj) - BLOCK / 2;
        const nearStreet = f.nx !== 0 ? Math.abs(f.x - edgeX) < 8 : Math.abs(f.z - edgeZ) < 8;
        if (!nearStreet) continue;
        const count = r() < 0.7 ? 1 + Math.floor(r() * 2) : 0;
        for (let k = 0; k < count; k++) {
          const vertical = r() < 0.4;
          const sw = vertical ? 4 : Math.min(f.w * 0.8, 14 + r() * 6);
          const sh = vertical ? 32 : sw / 4;
          const y = 14 + r() * Math.max(1, Math.min(h - sh - 6, 110));
          const off = (r() - 0.5) * Math.max(0, f.w - sw - 4);
          const cx = f.x + f.nx * 0.4 + (f.nx === 0 ? off : 0);
          const cz = f.z + f.nz * 0.4 + (f.nz === 0 ? off : 0);
          const idx = Math.floor(r() * (vertical ? SIGN_WORDS_V.length : SIGN_WORDS_H.length));
          (vertical ? vQuads : hQuads).push({ cx, cy: y + sh / 2, cz, w: sw, h: sh, nx: f.nx, nz: f.nz, idx });
        }
      }
    }
    const mk = (quads, atlas, cols, rows) => {
      const pos = [], uv = [], ind = [];
      quads.forEach((q, k) => {
        // right vector for a face with normal (nx, nz)
        const rx = q.nz, rz = -q.nx;
        const hw = q.w / 2, hh = q.h / 2;
        const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
        const col = q.idx % cols, row = Math.floor(q.idx / cols);
        const u0 = col / cols, u1 = (col + 1) / cols;
        const v1 = 1 - row / rows, v0 = 1 - (row + 1) / rows;
        const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        corners.forEach(([a, b], i) => {
          pos.push(q.cx + rx * a, q.cy + b, q.cz + rz * a);
          uv.push(uvs[i][0], uvs[i][1]);
        });
        const o = k * 4;
        ind.push(o, o + 1, o + 2, o, o + 2, o + 3);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(ind);
      const mat = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: true });
      const mesh = new THREE.Mesh(geo, mat);
      this.group.add(mesh);
      return mesh;
    };
    this.hSigns = mk(hQuads, hAtlas, 2, 16);
    this.vSigns = mk(vQuads, vAtlas, 16, 1);
  }

  buildBillboards() {
    const ads = [
      (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, w, h);
        grd.addColorStop(0, '#2a0b4a'); grd.addColorStop(1, '#0b2a4a');
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        // Robot cat face
        g.fillStyle = '#9aa3b5';
        g.beginPath(); g.moveTo(90, 120); g.lineTo(140, 40); g.lineTo(190, 120); g.fill();
        g.beginPath(); g.moveTo(250, 120); g.lineTo(300, 40); g.lineTo(350, 120); g.fill();
        roundRect(g, 80, 100, 280, 240, 30); g.fill();
        g.fillStyle = '#10151f'; roundRect(g, 105, 125, 230, 180, 20); g.fill();
        neonText(g, '=^_^=', 220, 215, '#33f0ff', 64, { glow: 20 });
        neonText(g, 'MAYOR', 680, 110, '#ffd23f', 80, { glow: 20 });
        neonText(g, 'MECHAWHISKERS', 680, 200, '#ff3d8b', 72, { maxW: 560, glow: 20 });
        neonText(g, 'ROBOCABS: THE FUTURE IS FURLESS', 680, 300, '#33f0ff', 36, { maxW: 560, font: "'Nunito', sans-serif" });
        neonText(g, 'VOTE MEOW', 680, 390, '#ffffff', 44, { glow: 10 });
      },
      (g, w, h) => {
        g.fillStyle = '#b8161c'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#ffd23f';
        for (let i = 0; i < 12; i++) { g.save(); g.translate(200, 256); g.rotate(i * Math.PI / 6); g.fillRect(0, -8, 300, 16); g.restore(); }
        g.fillStyle = '#b8161c'; g.beginPath(); g.arc(200, 256, 150, 0, Math.PI * 2); g.fill();
        // burger
        g.fillStyle = '#e8a33a'; g.beginPath(); g.ellipse(200, 220, 110, 60, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#5a2e12'; g.fillRect(90, 225, 220, 30);
        g.fillStyle = '#6dff8a'; g.fillRect(85, 255, 230, 10);
        g.fillStyle = '#e8a33a'; roundRect(g, 90, 265, 220, 34, 14); g.fill();
        neonText(g, 'McSNACKERS', 690, 130, '#ffd23f', 92, { maxW: 600, glow: 22 });
        neonText(g, 'NOW WITH SNAPPY MEALS', 690, 240, '#ffffff', 44, { maxW: 600 });
        neonText(g, 'COLLECT ROBO-GERALD!', 690, 330, '#33f0ff', 48, { maxW: 600 });
        neonText(g, 'ORBITAL DRIVE-THRU · SKY LEVEL 110', 690, 420, '#ffd23f', 28, { maxW: 600, font: "'Nunito', sans-serif" });
      },
      (g, w, h) => {
        g.fillStyle = '#081a1a'; g.fillRect(0, 0, w, h);
        neonText(g, 'ZERO-G', 512, 120, '#6dff8a', 120, { glow: 30 });
        neonText(g, 'CARNIVAL', 512, 250, '#ff3d8b', 110, { glow: 30 });
        neonText(g, 'FLOAT LIKE A BUTTERFLY · SCREAM LIKE A GOAT', 512, 370, '#ffd23f', 34, { maxW: 900, font: "'Nunito', sans-serif" });
        neonText(g, 'OPEN ALL NIGHT', 512, 440, '#33f0ff', 40);
      },
      (g, w, h) => {
        g.fillStyle = '#1a1405'; g.fillRect(0, 0, w, h);
        neonText(g, 'GALACTIC', 512, 120, '#ffd23f', 110, { glow: 25 });
        neonText(g, 'RESERVE BANK', 512, 240, '#ffd23f', 90, { glow: 25 });
        neonText(g, 'YOUR MONEY IS SAFE WITH US*', 512, 350, '#ffffff', 44, { maxW: 900 });
        neonText(g, '*unless a gorilla shows up', 512, 430, '#8a8a8a', 26, { font: "'Nunito', sans-serif" });
      },
    ];
    const tex = ads.map((fn) => drawTexture(1024, 512, fn));
    this.billboardTex = tex;
    const r = this.rand;
    const tall = this.buildings.filter((b) => b.minY === 0 && b.maxY > 90 && b.maxX - b.minX > 24);
    const chosen = [];
    for (let k = 0; k < 14 && tall.length; k++) {
      const b = tall.splice(Math.floor(r() * tall.length), 1)[0];
      chosen.push(b);
    }
    this.billboards = [];
    chosen.forEach((b, k) => {
      const t = tex[k % tex.length];
      const w = 36, h = 18;
      const mat = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.3, 1.3, 1.3), side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      const face = Math.floor(r() * 4);
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const y = Math.min(b.maxY - h / 2 - 4, 50 + r() * 60);
      if (face === 0) { mesh.position.set(b.maxX + 0.6, y, cz); mesh.rotation.y = Math.PI / 2; }
      if (face === 1) { mesh.position.set(b.minX - 0.6, y, cz); mesh.rotation.y = -Math.PI / 2; }
      if (face === 2) { mesh.position.set(cx, y, b.maxZ + 0.6); }
      if (face === 3) { mesh.position.set(cx, y, b.minZ - 0.6); mesh.rotation.y = Math.PI; }
      this.group.add(mesh);
      this.billboards.push(mesh);
    });
  }

  buildSearchlights() {
    const geo = new THREE.ConeGeometry(28, 400, 24, 1, true);
    geo.translate(0, -200, 0);
    geo.rotateX(Math.PI); // tip at origin, opening upward
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0.35, 0.5, 1.0) } },
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vY; void main(){ float a = (1.0 - clamp(vY/400.0,0.0,1.0)); gl_FragColor = vec4(uColor * a * a * 0.22, 1.0); }',
    });
    this.searchlights = [];
    const r = this.rand;
    const picks = this.buildings.filter((b) => b.maxY > 150);
    for (let k = 0; k < 6 && picks.length; k++) {
      const b = picks[Math.floor(r() * picks.length)];
      const m = new THREE.Mesh(geo, mat);
      m.position.set((b.minX + b.maxX) / 2, b.maxY, (b.minZ + b.maxZ) / 2);
      m.userData.phase = r() * 10;
      m.userData.speed = 0.2 + r() * 0.3;
      this.group.add(m);
      this.searchlights.push(m);
    }
  }

  buildSpaceElevator() {
    const g = new THREE.Group();
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3000, 8, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.7, 1.0).multiplyScalar(1.2), fog: false }));
    cable.position.y = 1500;
    g.add(cable);
    const pods = [];
    for (let k = 0; k < 6; k++) {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.3).multiplyScalar(3), fog: false }));
      pod.userData.offset = k / 6;
      g.add(pod);
      pods.push(pod);
    }
    g.position.set(-HALF - 700, 0, -HALF - 900);
    this.group.add(g);
    this.elevatorPods = pods;
  }

  update(dt, t) {
    this.buildingMat.uniforms.uTime.value = t;
    for (const s of this.searchlights) {
      const p = s.userData.phase + t * s.userData.speed;
      s.rotation.set(Math.sin(p) * 0.45, 0, Math.cos(p * 0.8) * 0.45);
    }
    if (this.elevatorPods) for (const p of this.elevatorPods) p.position.y = ((p.userData.offset + t * 0.01) % 1) * 2400;
    if (this.antennaLights) this.antennaLights.visible = Math.sin(t * 3) > -0.2;
  }
}

export { streetPos };
