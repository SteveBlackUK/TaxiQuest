import { STAT_INFO, ITEMS } from './state.js';

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Parse *bold* and _em_ markup into segments for the typewriter.
function parseMarkup(text) {
  const segs = [];
  let cur = { t: '', tag: null };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '*' || ch === '_') {
      const tag = ch === '*' ? 'b' : 'em';
      if (cur.t) segs.push(cur);
      cur = { t: '', tag: cur.tag === tag ? null : tag };
      continue;
    }
    cur.t += ch;
  }
  if (cur.t) segs.push(cur);
  return segs;
}
function renderSegs(segs, n) {
  let out = '';
  let left = n;
  for (const s of segs) {
    if (left <= 0) break;
    const part = s.t.slice(0, left);
    left -= part.length;
    out += s.tag ? `<${s.tag}>${esc(part)}</${s.tag}>` : esc(part);
  }
  return out;
}

export class UI {
  constructor(game) {
    this.game = game;
    this.hud = $('#hud');
    this.dlg = $('#dialogue');
    this.dlgImg = this.dlg.querySelector('.dlg-portrait img');
    this.dlgPortrait = this.dlg.querySelector('.dlg-portrait');
    this.dlgName = this.dlg.querySelector('.dlg-name .n');
    this.dlgSpecies = this.dlg.querySelector('.dlg-name .species');
    this.dlgText = this.dlg.querySelector('.dlg-text');
    this.dlgChoices = this.dlg.querySelector('.dlg-choices');
    this.dlgNext = this.dlg.querySelector('.dlg-next');
    this.modalEl = $('#modal');
    this.fadeEl = $('#fade');
    this.meters = new Map();
    this.line = null;
    this.modalOpen = false;
    this.portraits = {};

    this.dlg.addEventListener('mousedown', (e) => {
      if (e.target.closest('.choice')) return;
      this.advanceRequested = true;
    });
  }

  // ---------------- HUD ----------------
  showHud(v) { this.hud.classList.toggle('hidden', !v); }
  refreshStats() {
    const d = this.game.state.d;
    $('#hud-credits').textContent = `₡ ${d.credits}`;
    $('#hud-level').textContent = `LV ${d.level}`;
    $('#hud-xp').style.width = `${Math.round(this.game.state.xpProgress() * 100)}%`;
    $('#hud-charm').textContent = `CHA ${d.stats.charm}`;
    $('#hud-nerve').textContent = `NRV ${d.stats.nerve}`;
    $('#hud-reflex').textContent = `RFX ${d.stats.reflex}`;
    $('#hud-heat').textContent = d.heat > 0 ? 'WANTED ' + '★'.repeat(d.heat) : '';
  }
  objective(text) {
    const el = $('#hud-objective');
    if (!text) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    $('#hud-objective-text').innerHTML = text;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
  timer(sec, urgentBelow = 10) {
    const el = $('#hud-timer');
    if (sec === null || sec === undefined) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const t = Math.floor((sec * 10) % 10);
    el.textContent = `${m}:${String(s).padStart(2, '0')}.${t}`;
    el.classList.toggle('urgent', sec < urgentBelow);
  }
  meter(id, { label, value, color = '#33f0ff', right = '' } = {}) {
    if (value === null) {
      const m = this.meters.get(id);
      if (m) { m.el.remove(); this.meters.delete(id); }
      return;
    }
    let m = this.meters.get(id);
    if (!m) {
      const el = document.createElement('div');
      el.className = 'meter';
      el.innerHTML = '<div class="mlabel"><span class="l"></span><span class="r"></span></div><div class="mbar"><div class="mfill"></div></div>';
      $('#hud-meters').appendChild(el);
      m = { el, l: el.querySelector('.l'), r: el.querySelector('.r'), f: el.querySelector('.mfill') };
      this.meters.set(id, m);
    }
    m.l.textContent = label;
    m.l.style.color = color;
    m.r.textContent = right;
    m.f.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
    m.f.style.background = color;
  }
  clearMeters() { for (const id of [...this.meters.keys()]) this.meter(id, { value: null }); }
  prompt(html) {
    const el = $('#hud-prompt');
    if (!html) { el.classList.add('hidden'); this._prompt = null; return; }
    if (this._prompt === html) return;
    this._prompt = html;
    el.innerHTML = html;
    el.classList.remove('hidden');
  }
  hint(html) {
    const el = $('#hud-hint');
    if (!html) { el.classList.add('hidden'); return; }
    el.innerHTML = html;
    el.classList.remove('hidden');
  }
  crosshair(v, active = false) {
    const el = $('#crosshair');
    el.classList.toggle('hidden', !v);
    el.classList.toggle('active', active);
  }
  lockHint(v, text = 'Click to look around') {
    const el = $('#lockhint');
    el.textContent = text;
    el.classList.toggle('hidden', !v);
  }
  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
  // Non-blocking speech line (someone shouting while you play).
  bark(name, text, dur = 4) {
    let el = document.getElementById('bark');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bark';
      el.style.cssText = 'position:absolute;left:14px;bottom:60px;max-width:min(520px,70vw);padding:10px 14px;border-radius:10px;background:rgba(12,8,30,0.85);border-left:3px solid #ff3d8b;font-weight:800;font-size:16px;line-height:1.35;pointer-events:none;transition:opacity 0.3s';
      document.getElementById('hud').appendChild(el);
    }
    el.innerHTML = `<span style="font-family:var(--display);color:var(--yellow);font-size:13px">${esc(name)}</span><br>${esc(text).replace(/\*(.+?)\*/g, '<b style="color:var(--cyan)">$1</b>')}`;
    el.style.opacity = '1';
    clearTimeout(this._barkT);
    this._barkT = setTimeout(() => { el.style.opacity = '0'; }, dur * 1000);
  }

  banner(kicker, title, sub = '', dur = 3) {
    const el = $('#banner');
    el.querySelector('.banner-kicker').textContent = kicker;
    el.querySelector('.banner-title').textContent = title;
    el.querySelector('.banner-sub').textContent = sub;
    el.classList.remove('hidden', 'out');
    void el.offsetWidth;
    return new Promise((res) => {
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => { el.classList.add('hidden'); res(); }, 500);
      }, dur * 1000);
    });
  }

  fade(toBlack, dur = 0.6) {
    this.fadeEl.style.transition = `opacity ${dur}s`;
    this.fadeEl.style.opacity = toBlack ? '1' : '0';
    return new Promise((r) => setTimeout(r, dur * 1000 + 30));
  }

  // ---------------- Dialogue ----------------
  // speaker: { name, species, portrait, voice, speed }
  say(speaker, text, choices = null) {
    return new Promise((resolve) => {
      this.dlg.classList.remove('hidden');
      const sp = speaker || {};
      this.dlgName.textContent = sp.name || '';
      this.dlgSpecies.textContent = sp.species || '';
      const img = sp.portrait ? this.portraits[sp.portrait] : null;
      if (img) { this.dlgImg.src = img; this.dlgPortrait.classList.remove('none'); }
      else this.dlgPortrait.classList.add('none');
      this.dlgChoices.innerHTML = '';
      this.dlgNext.classList.add('hidden');
      const segs = parseMarkup(text);
      const total = segs.reduce((a, s) => a + s.t.length, 0);
      this.line = {
        speaker: sp, segs, total, shown: 0, acc: 0, age: 0, choices, resolve,
        cps: (sp.speed || 1) * 48 * (this.game.state.settings.textSpeed || 1), blipAcc: 0, done: false,
      };
      this.dlgText.innerHTML = '';
      this.advanceRequested = false;
      if (this.onLineStart) this.onLineStart(sp, text);
    });
  }

  finishTyping() {
    const L = this.line;
    L.shown = L.total;
    this.dlgText.innerHTML = renderSegs(L.segs, L.total);
    L.done = true;
    if (this.onLineTyped) this.onLineTyped(L.speaker);
    if (L.choices) this.showChoices(L.choices);
    else this.dlgNext.classList.remove('hidden');
  }

  showChoices(choices) {
    const L = this.line;
    this.dlgChoices.innerHTML = '';
    choices.forEach((c, i) => {
      const b = document.createElement('div');
      b.className = 'choice' + (c.locked ? ' locked' : '');
      b.innerHTML = `<span class="num">${i + 1}</span>${c.req ? `<span class="req">${esc(c.req)}</span>` : ''}${esc(c.text)}`;
      b.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.pickChoice(i);
      });
      this.dlgChoices.appendChild(b);
    });
    L.choiceEls = [...this.dlgChoices.children];
  }

  pickChoice(i) {
    const L = this.line;
    if (!L || !L.choices || !L.done) return;
    const c = L.choices[i];
    if (!c || c.locked) { this.game.audio.play('deny'); return; }
    this.game.audio.play('select');
    this.closeLine(i);
  }

  closeLine(v) {
    const L = this.line;
    this.line = null;
    if (this.onLineEnd) this.onLineEnd(L.speaker);
    L.resolve(v);
  }

  hideDialogue() { this.dlg.classList.add('hidden'); }

  update(dt) {
    const L = this.line;
    const input = this.game.input;
    if (!L) return;
    L.age += dt;
    let adv = this.advanceRequested || input.anyHit('Space', 'Enter', 'KeyE', 'NumpadEnter') || (input.locked && input.mouse.clicked);
    // Test hook: fast-forward dialogue.
    const auto = this.game.autoplay;
    if (auto && L.age > (auto.delay ?? 0.25)) {
      adv = true;
      if (L.done && L.choices) {
        let k = typeof auto.choice === 'function' ? auto.choice(L) : (auto.choice ?? 0);
        while (L.choices[k] && L.choices[k].locked) k++;
        if (!L.choices[k]) k = L.choices.findIndex((c) => !c.locked);
        this.pickChoice(k);
        return;
      }
    }
    this.advanceRequested = false;
    if (!L.done) {
      L.acc += dt * L.cps;
      const n = Math.min(L.total, Math.floor(L.acc));
      if (n !== L.shown) {
        const prev = L.shown;
        L.shown = n;
        this.dlgText.innerHTML = renderSegs(L.segs, n);
        L.blipAcc += n - prev;
        if (L.blipAcc >= 3) { L.blipAcc = 0; this.game.audio.blip(L.speaker.voice); }
      }
      if (n >= L.total) this.finishTyping();
      else if (adv && L.age > 0.12) this.finishTyping();
      return;
    }
    if (L.choices) {
      for (let i = 0; i < L.choices.length && i < 9; i++) {
        if (input.hit('Digit' + (i + 1)) || input.hit('Numpad' + (i + 1))) this.pickChoice(i);
      }
    } else if (adv && L.age > 0.18) {
      this.game.audio.play('ui', { vol: 0.5 });
      this.closeLine();
    }
  }

  // ---------------- Modals ----------------
  modal(html, { onOpen, keys = {} } = {}) {
    this.modalOpen = true;
    this.modalEl.innerHTML = html;
    this.modalEl.classList.remove('hidden');
    return new Promise((resolve) => {
      const done = (v) => {
        this.modalEl.classList.add('hidden');
        this.modalEl.innerHTML = '';
        this.modalOpen = false;
        window.removeEventListener('keydown', onKey, true);
        resolve(v);
      };
      const onKey = (e) => {
        if (keys[e.code] !== undefined) { e.preventDefault(); e.stopPropagation(); this.game.audio.play('select'); done(keys[e.code]); }
      };
      window.addEventListener('keydown', onKey, true);
      this.modalEl.querySelectorAll('[data-v]').forEach((b) => {
        b.addEventListener('click', () => {
          if (b.disabled) return;
          this.game.audio.play('select');
          done(b.dataset.v);
        });
      });
      if (onOpen) onOpen(this.modalEl, done);
      if (this.game.autoplay) {
        const first = this.modalEl.querySelector('[data-v]:not([disabled])');
        const pickV = this.modalEl.querySelector('[data-v="ok"], [data-v="resume"], [data-v="close"]') || first;
        if (pickV) setTimeout(() => { if (this.modalOpen) done(pickV.dataset.v); }, 400);
      }
    });
  }

  stars(n) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= n ? '★' : '<span class="off">★</span>';
    return s;
  }

  fareCard({ kicker = 'FARE COMPLETE', title, stars, rows, quote }) {
    const r = rows.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('');
    this.game.audio.play(stars >= 3 ? 'success' : 'fail');
    return this.modal(`<div class="card">
      <div class="kicker">${esc(kicker)}</div><h1>${esc(title)}</h1>
      <div class="stars">${this.stars(stars)}</div>
      ${quote ? `<p class="quote">“${esc(quote)}”</p>` : ''}
      ${r}
      <div class="buttons"><button class="btn" data-v="ok">Continue <span class="kbd" style="margin:0 0 0 6px">ENTER</span></button></div>
    </div>`, { keys: { Enter: 'ok', Space: 'ok' } });
  }

  async levelUp() {
    const st = this.game.state;
    while (st.d.statPoints > 0) {
      this.game.audio.play('levelup');
      const cards = Object.entries(STAT_INFO).map(([k, info], i) => `
        <div class="statcard" data-v="${k}"><div class="sname">${i + 1}. ${info.name}</div>
        <div class="sval">${st.stat(k)} → ${st.stat(k) + 1}</div><div class="sdesc">${info.desc}</div></div>`).join('');
      const pick = await this.modal(`<div class="card wide">
        <div class="kicker">LEVEL UP</div><h1>You reached level ${st.d.level}!</h1>
        <p>Pick a stat to boost. Dialogue options and quest difficulty depend on these.</p>
        <div class="statcards">${cards}</div></div>`, { keys: { Digit1: 'charm', Digit2: 'nerve', Digit3: 'reflex' } });
      st.raiseStat(pick);
      this.toast(`${STAT_INFO[pick].name} is now ${st.stat(pick)}`, 'good');
      this.refreshStats();
    }
  }

  async shop(stock) {
    const st = this.game.state;
    for (;;) {
      const rows = stock.map((s) => {
        const it = ITEMS[s.id];
        const owned = st.count(s.id);
        const soldOut = s.max && owned >= s.max;
        return `<div class="shopitem"><div class="icon">${it.icon}</div><div class="info"><div class="iname">${esc(it.name)} ${owned ? `<span style="color:var(--muted)">(have ${owned})</span>` : ''}</div>
          <div class="idesc">${esc(it.desc)}</div></div>
          <button class="btn" data-v="${s.id}" ${soldOut || st.d.credits < s.price ? 'disabled' : ''}>${soldOut ? 'SOLD OUT' : `₡ ${s.price}`}</button></div>`;
      }).join('');
      const v = await this.modal(`<div class="card wide"><div class="kicker">VEND-O-MATIC 3000</div><h1>Snacks & Self-Improvement</h1>
        <p>You have <b style="color:var(--yellow)">₡ ${st.d.credits}</b>. Stat items apply instantly.</p>
        <div class="shoplist">${rows}</div>
        <div class="buttons"><button class="btn alt" data-v="close">Done <span class="kbd" style="margin:0 0 0 6px">ESC</span></button></div></div>`,
      { keys: { Escape: 'close', KeyE: 'close' } });
      if (v === 'close') return;
      const s = stock.find((x) => x.id === v);
      if (s && st.spend(s.price)) {
        st.addItem(s.id, s.qty || 1);
        this.game.audio.play('cash');
        this.toast(`${ITEMS[s.id].icon} ${ITEMS[s.id].name}`, 'good');
        this.refreshStats();
      }
    }
  }

  controlsHtml() {
    if (this.game.touch) {
      return `<div class="controls-grid">
      <span class="kbd">STICK</span><span>Walk (or fly)</span>
      <span class="kbd">DRAG</span><span>Look around / steer</span>
      <span class="kbd">TAP</span><span>Throw, catch, press things, advance dialogue</span>
      <span class="kbd">USE</span><span>Interact</span>
      <span class="kbd">FLOSS</span><span>Throw Space Floss</span>
    </div>`;
    }
    return `<div class="controls-grid">
      <span class="kbd">MOUSE</span><span>Look around / aim</span>
      <span class="kbd">W A S D</span><span>Walk (or fly, when you're driving)</span>
      <span class="kbd">SHIFT</span><span>Sprint / boost</span>
      <span class="kbd">SPACE</span><span>Jump / fly up</span>
      <span class="kbd">C</span><span>Crouch / fly down</span>
      <span class="kbd">E</span><span>Interact, advance dialogue</span>
      <span class="kbd">1-4</span><span>Pick dialogue choices</span>
      <span class="kbd">CLICK</span><span>Throw / grab / press buttons</span>
      <span class="kbd">R-CLICK</span><span>Throw Space Floss (if you have some)</span>
      <span class="kbd">ESC</span><span>Pause</span>
    </div>`;
  }

  async settings() {
    const s = this.game.state.settings;
    const html = `<div class="card"><div class="kicker">SETTINGS</div><h1>Tune the ride</h1>
      <div class="slider-row"><label>Master</label><input type="range" min="0" max="1" step="0.05" value="${s.master}" data-k="master"></div>
      <div class="slider-row"><label>Music</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music"></div>
      <div class="slider-row"><label>Effects</label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-k="sfx"></div>
      <div class="slider-row"><label>Mouse</label><input type="range" min="0.3" max="2.5" step="0.1" value="${s.sensitivity}" data-k="sensitivity"></div>
      <div class="slider-row"><label>Graphics</label><select data-k="quality" style="flex:1;font-weight:800;padding:6px;border-radius:6px">
        <option value="high" ${s.quality === 'high' ? 'selected' : ''}>High (glow on)</option>
        <option value="low" ${s.quality === 'low' ? 'selected' : ''}>Low (faster)</option></select></div>
      <div class="buttons"><button class="btn" data-v="ok">Done</button></div></div>`;
    await this.modal(html, {
      keys: { Escape: 'ok' },
      onOpen: (el) => {
        el.querySelectorAll('[data-k]').forEach((inp) => {
          inp.addEventListener('input', () => {
            const k = inp.dataset.k;
            s[k] = k === 'quality' ? inp.value : parseFloat(inp.value);
            this.game.applySettings();
          });
        });
      },
    });
    this.game.state.saveSettings();
  }

  async pauseMenu() {
    for (;;) {
      const v = await this.modal(`<div class="card"><div class="kicker">PAUSED</div><h1>Meter's still running…</h1>
        ${this.controlsHtml()}
        <div class="buttons">
          <button class="btn alt" data-v="quit">Quit to title</button>
          <button class="btn alt" data-v="settings">Settings</button>
          <button class="btn" data-v="resume">Resume</button>
        </div></div>`, { keys: { Escape: 'resume', Enter: 'resume' } });
      if (v === 'settings') { await this.settings(); continue; }
      return v;
    }
  }

  inventoryHtml() {
    const inv = this.game.state.d.inv;
    const ids = Object.keys(inv).filter((k) => inv[k] > 0);
    if (!ids.length) return '<p class="quote">Pockets: lint, one (1) boarding pass.</p>';
    return `<div class="shoplist">${ids.map((id) => {
      const it = ITEMS[id];
      return `<div class="shopitem"><div class="icon">${it.icon}</div><div class="info"><div class="iname">${esc(it.name)} ×${inv[id]}</div><div class="idesc">${esc(it.desc)}</div></div></div>`;
    }).join('')}</div>`;
  }
}
