import * as THREE from 'three';
import { drawTexture } from '../core/textures.js';

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = `
uniform float uTime;
varying vec3 vDir;
float h31(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 horizon = vec3(0.55, 0.16, 0.42);
  vec3 mid = vec3(0.16, 0.06, 0.3);
  vec3 top = vec3(0.02, 0.015, 0.07);
  vec3 col = mix(horizon, mid, smoothstep(-0.05, 0.18, y));
  col = mix(col, top, smoothstep(0.15, 0.7, y));
  col = mix(col, vec3(0.12, 0.04, 0.16), smoothstep(0.0, -0.3, y));
  // stars
  vec3 sp = floor(d * 380.0);
  float s = h31(sp);
  float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 50.0);
  col += vec3(0.9, 0.9, 1.0) * step(0.9975, s) * smoothstep(0.1, 0.5, y) * tw * 1.4;
  // aurora ribbon
  float a = sin(d.x * 6.0 + uTime * 0.05) * 0.06 + 0.42;
  float band = exp(-pow((y - a) * 18.0, 2.0)) * (0.5 + 0.5 * sin(d.z * 9.0 + uTime * 0.1));
  col += vec3(0.1, 0.8, 0.6) * band * 0.25;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky() {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  group.add(dome);

  const planetTex = drawTexture(512, 512, (g, w) => {
    const c = w / 2;
    const grd = g.createRadialGradient(c * 0.8, c * 0.7, 10, c, c, c * 0.55);
    grd.addColorStop(0, '#ffc9e8');
    grd.addColorStop(0.5, '#c85ab0');
    grd.addColorStop(1, '#3a1450');
    g.fillStyle = grd;
    g.beginPath(); g.arc(c, c, c * 0.55, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.arc(c, c, c * 0.55, 0, Math.PI * 2); g.clip();
    g.globalAlpha = 0.25;
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#50106a';
      g.fillRect(0, c - c * 0.5 + i * c * 0.12, w, c * 0.05);
    }
    g.restore();
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,220,250,0.8)';
    g.lineWidth = 6;
    g.beginPath(); g.ellipse(c, c, c * 0.95, c * 0.18, -0.35, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(255,200,250,0.35)';
    g.lineWidth = 14;
    g.beginPath(); g.ellipse(c, c, c * 0.85, c * 0.15, -0.35, 0, Math.PI * 2); g.stroke();
  });
  const planet = new THREE.Sprite(new THREE.SpriteMaterial({ map: planetTex, fog: false, depthWrite: false, color: new THREE.Color(1.2, 1.2, 1.2) }));
  planet.scale.set(1400, 1400, 1);
  planet.position.set(1400, 1300, -2600);
  planet.renderOrder = -9;
  group.add(planet);

  const moonTex = drawTexture(256, 256, (g, w) => {
    const c = w / 2;
    const grd = g.createRadialGradient(c, c, 0, c, c, c);
    grd.addColorStop(0, 'rgba(220,255,250,1)');
    grd.addColorStop(0.35, 'rgba(160,240,255,0.9)');
    grd.addColorStop(0.42, 'rgba(120,200,255,0.25)');
    grd.addColorStop(1, 'rgba(80,120,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6), blending: THREE.AdditiveBlending }));
  moon.scale.set(500, 500, 1);
  moon.position.set(-2400, 900, 1600);
  moon.renderOrder = -9;
  group.add(moon);

  return {
    group,
    update(t, camPos) {
      mat.uniforms.uTime.value = t;
      group.position.copy(camPos);
    },
  };
}
