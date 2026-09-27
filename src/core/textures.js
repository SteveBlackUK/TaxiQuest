import * as THREE from 'three';

export const FONT_DISPLAY = "'Bungee', 'Impact', 'Arial Black', sans-serif";
export const FONT_BODY = "'Nunito', 'Segoe UI', system-ui, sans-serif";

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasTexture(canvas, { repeat = false, nearest = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; }
  return t;
}

export function drawTexture(w, h, draw, opts) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = canvasTexture(c, opts);
  t.userData.canvas = c;
  t.userData.ctx = g;
  return t;
}

// Fit a single line of text to a width.
export function fitText(g, text, maxW, size, font = FONT_DISPLAY, minSize = 10) {
  let s = size;
  g.font = `${s}px ${font}`;
  while (g.measureText(text).width > maxW && s > minSize) {
    s -= 2;
    g.font = `${s}px ${font}`;
  }
  return s;
}

export function neonText(g, text, x, y, color, size, { font = FONT_DISPLAY, glow = 18, align = 'center', maxW = 0 } = {}) {
  g.save();
  g.textAlign = align;
  g.textBaseline = 'middle';
  if (maxW) fitText(g, text, maxW, size, font);
  else g.font = `${size}px ${font}`;
  g.shadowColor = color;
  g.shadowBlur = glow;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.shadowBlur = glow * 0.4;
  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.55;
  g.fillText(text, x, y);
  g.restore();
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function wrapLines(g, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export function checkerTexture(a = '#111', b = '#ffd23f', n = 8) {
  return drawTexture(64 * n, 64, (g, w, h) => {
    const s = h / 2;
    for (let i = 0; i < w / s; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? a : b;
      g.fillRect(i * s, j * s, s, s);
    }
  });
}

// Soft round glow sprite used for lights, thrusters, sparks.
let _glow = null;
export function glowTexture() {
  if (_glow) return _glow;
  _glow = drawTexture(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
  return _glow;
}

let _toonGrad = null;
export function toonGradient() {
  if (_toonGrad) return _toonGrad;
  const data = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  _toonGrad = t;
  return t;
}

const _matCache = new Map();
function cached(kind, color, opts, make) {
  const { unique, ...rest } = opts;
  if (unique || rest.map) return make(rest);
  const key = kind + color + JSON.stringify(rest);
  if (_matCache.has(key)) return _matCache.get(key);
  const m = make(rest);
  _matCache.set(key, m);
  return m;
}
export function toon(color, opts = {}) {
  return cached('toon', color, opts, (o) => new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...o }));
}
export function glowMat(color, intensity = 2, opts = {}) {
  return cached('glow' + intensity, color, opts, (o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), ...o }));
}
export function lambert(color, opts = {}) {
  return cached('lam', color, opts, (o) => new THREE.MeshLambertMaterial({ color, ...o }));
}
