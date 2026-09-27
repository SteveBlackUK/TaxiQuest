export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
export function dampAngle(a, b, lambda, dt) {
  return a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
}

// Deterministic PRNG so the city is the same every visit.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
export function shuffle(arr, r = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmtTime(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const t = Math.floor((sec * 10) % 10);
  return `${m}:${String(s).padStart(2, '0')}.${t}`;
}

// Axis-aligned box helpers used for collision everywhere.
export function aabb(minX, minY, minZ, maxX, maxY, maxZ, tag) {
  return { minX, minY, minZ, maxX, maxY, maxZ, tag };
}
export function aabbFromCenter(x, y, z, sx, sy, sz, tag) {
  return aabb(x - sx / 2, y - sy / 2, z - sz / 2, x + sx / 2, y + sy / 2, z + sz / 2, tag);
}
export function sphereHitsAabb(p, r, b) {
  const cx = clamp(p.x, b.minX, b.maxX);
  const cy = clamp(p.y, b.minY, b.maxY);
  const cz = clamp(p.z, b.minZ, b.maxZ);
  const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
  return dx * dx + dy * dy + dz * dz < r * r;
}
// Push a sphere out of a box; returns the push normal or null.
export function pushSphereOutOfAabb(p, r, b) {
  const cx = clamp(p.x, b.minX, b.maxX);
  const cy = clamp(p.y, b.minY, b.maxY);
  const cz = clamp(p.z, b.minZ, b.maxZ);
  let dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    const k = (r - d) / d;
    p.x += dx * k; p.y += dy * k; p.z += dz * k;
    return { x: dx / d, y: dy / d, z: dz / d };
  }
  // Center is inside the box: push out along the shallowest axis.
  const opts = [
    [p.x - b.minX, -1, 0, 0], [b.maxX - p.x, 1, 0, 0],
    [p.y - b.minY, 0, -1, 0], [b.maxY - p.y, 0, 1, 0],
    [p.z - b.minZ, 0, 0, -1], [b.maxZ - p.z, 0, 0, 1],
  ];
  opts.sort((a, c) => a[0] - c[0]);
  const [depth, nx, ny, nz] = opts[0];
  p.x += nx * (depth + r); p.y += ny * (depth + r); p.z += nz * (depth + r);
  return { x: nx, y: ny, z: nz };
}

// 2D segment vs box test (XZ plane) for line-of-sight checks.
export function segmentHitsBoxXZ(ax, az, bx, bz, box) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, ax - box.minX) && clip(dx, box.maxX - ax) && clip(-dz, az - box.minZ) && clip(dz, box.maxZ - az);
}

export const once = (fn) => { let done = false; return (...a) => { if (!done) { done = true; fn(...a); } }; };
