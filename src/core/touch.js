// On-screen controls for phones and tablets. They feed the same Input object the mouse and keyboard use.
export function isTouchDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
}

export class TouchControls {
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.el = document.createElement('div');
    this.el.id = 'touch';
    this.el.innerHTML = `
      <div class="t-look"></div>
      <div class="t-stick"><div class="t-knob"></div></div>
      <div class="t-btns">
        <button class="t-btn" data-code="KeyE">USE</button>
        <button class="t-btn big" data-code="Space">JUMP</button>
        <button class="t-btn" data-code="KeyC" data-hold="1">DUCK</button>
        <button class="t-btn" data-code="ShiftLeft" data-hold="1">RUN</button>
        <button class="t-btn pink" data-code="KeyF">FLOSS</button>
      </div>
      <button class="t-pause" data-code="Escape">❚❚</button>`;
    document.getElementById('app').appendChild(this.el);
    this.stick = this.el.querySelector('.t-stick');
    this.knob = this.el.querySelector('.t-knob');
    this.look = this.el.querySelector('.t-look');
    this.stickId = null;
    this.lookId = null;
    this.axis = { x: 0, y: 0 };
    this.bindStick();
    this.bindLook();
    this.bindButtons();
    this.mode = null;
  }

  press(code, down) {
    const inp = this.input;
    if (down) {
      if (!inp.keys.has(code)) {
        inp.pressed.add(code);
        for (const fn of inp.listeners.key) fn(code, { code });
      }
      inp.keys.add(code);
    } else inp.keys.delete(code);
  }

  bindStick() {
    const s = this.stick;
    const update = (t) => {
      const r = s.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.axis.x = dx; this.axis.y = dy;
      this.knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
      this.applyAxis();
    };
    s.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; this.stickId = t.identifier; update(t); }, { passive: false });
    s.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === this.stickId) update(t); }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.stickId) {
        this.stickId = null;
        this.axis.x = this.axis.y = 0;
        this.knob.style.transform = '';
        this.applyAxis();
      }
    };
    s.addEventListener('touchend', end);
    s.addEventListener('touchcancel', end);
  }

  applyAxis() {
    const { x, y } = this.axis;
    const k = this.input.keys;
    const set = (code, on) => { if (on) k.add(code); else k.delete(code); };
    set('KeyW', y < -0.3); set('KeyS', y > 0.3); set('KeyA', x < -0.3); set('KeyD', x > 0.3);
  }

  bindLook() {
    const l = this.look;
    let last = null;
    l.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.lookId = t.identifier;
      last = { x: t.clientX, y: t.clientY, t: performance.now(), sx: t.clientX, sy: t.clientY };
    }, { passive: false });
    l.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === this.lookId && last) {
        this.input.mouse.dx += (t.clientX - last.x) * 1.6;
        this.input.mouse.dy += (t.clientY - last.y) * 1.6;
        last.x = t.clientX; last.y = t.clientY;
      }
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.lookId) {
        // A quick tap on the look area counts as a click (throw, catch, advance dialogue).
        if (last && performance.now() - last.t < 250 && Math.hypot(t.clientX - last.sx, t.clientY - last.sy) < 12) this.input.mouse.clicked = true;
        this.lookId = null;
        last = null;
      }
    };
    l.addEventListener('touchend', end);
    l.addEventListener('touchcancel', end);
  }

  bindButtons() {
    this.el.querySelectorAll('[data-code]').forEach((b) => {
      const code = b.dataset.code;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (code === 'Escape') {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
          return;
        }
        if (code === 'KeyF') { this.input.mouse.rclicked = true; return; }
        this.press(code, true);
        b.classList.add('on');
      }, { passive: false });
      const up = (e) => { e.preventDefault(); if (code !== 'Escape' && code !== 'KeyF') this.press(code, false); b.classList.remove('on'); };
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
    });
  }

  // Called every frame: show the controls that make sense right now.
  update() {
    const g = this.game;
    const onFoot = g.foot && g.foot.active;
    const driving = g.drive && g.drive.active;
    const busy = g.ui.modalOpen || !g.started;
    const mode = busy ? 'none' : onFoot ? 'foot' : driving ? 'drive' : 'ride';
    if (mode !== this.mode) {
      this.mode = mode;
      this.el.dataset.mode = mode;
      const labels = this.el.querySelectorAll('.t-btn');
      if (mode === 'drive') {
        labels[1].textContent = 'UP'; labels[1].dataset.code = 'Space';
        labels[2].textContent = 'DOWN'; labels[2].dataset.code = 'KeyC';
        labels[3].textContent = 'BOOST';
      } else {
        labels[1].textContent = 'JUMP';
        labels[2].textContent = 'DUCK';
        labels[3].textContent = 'RUN';
      }
    }
    // Pretend the pointer is locked so mouse-look code accepts drag deltas.
    if (mode === 'foot' || mode === 'drive') this.input.locked = true;
    else if (this.input.locked && !document.pointerLockElement) this.input.locked = false;
  }
}
