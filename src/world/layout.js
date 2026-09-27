// City grid layout shared by the city generator, the autopilot and the levels.
import * as THREE from 'three';

export const N = 14;          // blocks per side
export const BLOCK = 64;      // building lot width
export const STREET = 32;     // street (sky-canyon) width
export const PITCH = BLOCK + STREET;
export const HALF = (N * PITCH) / 2;
export const LANES = [40, 60, 84, 112];

export const streetPos = (k) => -HALF + k * PITCH;               // k = 0..N
export const blockCenter = (i) => -HALF + i * PITCH + PITCH / 2; // i = 0..N-1
export const toStreetIndex = (x) => Math.round((x + HALF) / PITCH);
export const toBlockIndex = (x) => Math.floor((x + HALF) / PITCH);
export const clampStreet = (k) => Math.max(1, Math.min(N - 1, k));

// Reserved plazas for landmarks. (bi,bj) is the first block, w/h in blocks.
export const PLACES = {
  rank: { bi: 3, bj: 9, w: 1, h: 1 },
  snacks: { bi: 9, bj: 3, w: 1, h: 1 },
  carnival: { bi: 9, bj: 9, w: 2, h: 2 },
  bank: { bi: 3, bj: 4, w: 1, h: 1 },
  chapel: { bi: 11, bj: 6, w: 1, h: 1 },
  spire: { bi: 6, bj: 6, w: 2, h: 2 },
};

export function placeCenter(name) {
  const p = PLACES[name];
  const x = (blockCenter(p.bi) + blockCenter(p.bi + p.w - 1)) / 2;
  const z = (blockCenter(p.bj) + blockCenter(p.bj + p.h - 1)) / 2;
  return new THREE.Vector3(x, 0, z);
}

export function isReserved(i, j) {
  for (const p of Object.values(PLACES)) {
    if (i >= p.bi && i < p.bi + p.w && j >= p.bj && j < p.bj + p.h) return true;
  }
  return false;
}

// Nearest street intersection (grid coords) to a world position.
export function nearestIntersection(x, z) {
  return { kx: clampStreet(toStreetIndex(x)), kz: clampStreet(toStreetIndex(z)) };
}
