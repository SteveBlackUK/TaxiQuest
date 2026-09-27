import * as THREE from 'three';
import { toon, glowMat } from '../core/textures.js';

// A giant sky whale that drifts over the city. Purely for wonder.
export function createWhale() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const blue = toon(0x2a4a8a), belly = toon(0x9ab8e8);
  const main = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), blue);
  main.scale.set(16, 11, 42);
  body.add(main);
  const under = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), belly);
  under.scale.set(14, 8, 36);
  under.position.set(0, -4, -3);
  body.add(under);
  const tail = new THREE.Group();
  tail.position.set(0, 1, 38);
  body.add(tail);
  const stem = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), blue);
  stem.scale.set(6, 5, 16);
  stem.position.z = 8;
  tail.add(stem);
  for (const s of [-1, 1]) {
    const fluke = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), blue);
    fluke.scale.set(14, 1.5, 6);
    fluke.position.set(s * 10, 0, 20);
    fluke.rotation.y = s * 0.5;
    tail.add(fluke);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), blue);
    fin.scale.set(12, 1.2, 5);
    fin.position.set(s * 16, -5, -8);
    fin.rotation.set(0, s * -0.6, s * -0.4);
    body.add(fin);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), glowMat(0xaef4ff, 2.2));
    eye.position.set(s * 13, 0, -26);
    body.add(eye);
  }
  // Glowing spots along the back
  const spot = glowMat(0x6af0ff, 2.4);
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.9 + (i % 3) * 0.4, 8, 6), spot);
    const a = (i / 18) * Math.PI * 2;
    m.position.set(Math.cos(a * 3) * 9, 8 + Math.sin(i) * 1.5, -30 + i * 3.6);
    body.add(m);
  }
  let t = 0;
  return {
    group: g,
    update(dt) {
      t += dt;
      const a = t * 0.012;
      const r = 520;
      g.position.set(Math.cos(a) * r, 290 + Math.sin(t * 0.2) * 12, Math.sin(a) * r);
      g.rotation.y = -a + Math.PI; // swim tangent to the circle
      body.rotation.z = Math.sin(t * 0.3) * 0.05;
      tail.rotation.x = Math.sin(t * 0.8) * 0.25;
    },
  };
}
