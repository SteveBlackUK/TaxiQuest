// Keyboard + mouse state with pointer-lock support.
const BLOCK_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyC', 'KeyQ']);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, nx: 0, ny: 0, dx: 0, dy: 0, down: false, rdown: false, clicked: false, rclicked: false };
    this.locked = false;
    this.wantLock = false;
    this.lockLostAt = 0;
    this.listeners = { key: [], click: [], lock: [] };

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.code);
        for (const fn of this.listeners.key) fn(e.code, e);
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; this.mouse.rdown = false; });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.ny = -((e.clientY / window.innerHeight) * 2 - 1);
      if (this.locked) {
        // Some browsers deliver huge spikes right after locking; clamp them.
        this.mouse.dx += Math.max(-250, Math.min(250, e.movementX || 0));
        this.mouse.dy += Math.max(-250, Math.min(250, e.movementY || 0));
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) { this.mouse.rdown = true; this.mouse.rclicked = true; }
      for (const fn of this.listeners.click) fn(e);
      if (this.wantLock && !this.locked) this.requestLock();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked) this.lockLostAt = performance.now();
      this.mouse.dx = 0; this.mouse.dy = 0;
      for (const fn of this.listeners.lock) fn(this.locked);
    });
  }

  on(kind, fn) { this.listeners[kind].push(fn); return () => { this.listeners[kind] = this.listeners[kind].filter((f) => f !== fn); }; }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  anyHit(...codes) { return codes.some((c) => this.pressed.has(c)); }
  anyDown(...codes) { return codes.some((c) => this.keys.has(c)); }
  axis(neg, pos) { return (this.anyDown(...pos) ? 1 : 0) - (this.anyDown(...neg) ? 1 : 0); }

  requestLock() {
    if (this.locked) return;
    // Chrome refuses to re-lock for ~1s after Esc; avoid console noise.
    if (performance.now() - this.lockLostAt < 1100) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* ignore */ }
  }
  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.clicked = false;
    this.mouse.rclicked = false;
  }
}
