// Everything you hear is synthesized here: no audio files.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Chords are midi note triads. Patterns are 16 steps per bar.
const TRACKS = {
  title: {
    bpm: 100,
    prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    bass: 'R..R..R.R..R.OR.', arp: '0120120120120121', pad: true,
    kick: 'x.....x.x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    lead: [76, null, null, 74, 72, null, 69, null, 72, null, 74, null, 76, null, null, null,
      77, null, null, 76, 74, null, 72, null, 69, null, null, null, null, null, null, null,
      72, null, null, 74, 76, null, 79, null, 76, null, 74, null, 72, null, null, null,
      74, null, null, 72, 71, null, 67, null, 71, null, 74, null, null, null, null, null],
    leadType: 'triangle',
  },
  city: {
    bpm: 92,
    prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    bass: 'R.......R..R....', arp: '0.1.2.1.0.1.2.1.', pad: true,
    kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.',
    arpType: 'triangle',
  },
  carl: {
    bpm: 108,
    prog: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    bass: 'R.O.R.O.R.O.R.OF', arp: null, pad: false,
    kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
    lead: [72, null, 76, null, 79, null, 76, null, 81, null, 79, 76, null, null, null, null,
      72, null, 76, null, 81, null, 79, null, 77, 76, 74, null, null, null, null, null],
    leadType: 'square',
  },
  carnival: {
    bpm: 132,
    prog: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]],
    bass: 'R...F...R...F...', arp: '0120120120120120', pad: false, arpType: 'triangle', arpOct: 1,
    kick: 'x...x...x...x...', snare: '..x...x...x...x.', hat: '',
    lead: [79, null, 76, 79, 84, null, 79, null, 81, null, 77, 81, 84, null, 81, null,
      83, null, 79, 83, 86, null, 83, null, 84, null, 79, null, 76, null, 72, null],
    leadType: 'square',
  },
  heist: {
    bpm: 116,
    prog: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [45, 49, 52]],
    bass: 'R.R.O.R.F.R.O.F.', arp: null, pad: true, bassType: 'triangle',
    kick: 'x.........x.....', snare: '', hat: '..x...x...x...x.', rim: '....x.......x...',
  },
  alarm: {
    bpm: 150,
    prog: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [48, 52, 55]],
    bass: 'RRRRRRRRRRRRRRRR', arp: '0101010101010101', pad: false, arpType: 'sawtooth',
    kick: 'x...x...x...x...', snare: '....x.......x.xx', hat: 'x.x.x.x.x.x.x.x.',
  },
  chase: {
    bpm: 156,
    prog: [[52, 55, 59], [48, 52, 55], [50, 53, 57], [47, 50, 54]],
    bass: 'RRORRRORRRORRROF', arp: '0120120120120120', pad: false, arpType: 'square',
    kick: 'x...x...x...x...', snare: '....x.......x.xx', hat: 'x.x.x.x.x.x.x.x.',
    lead: [76, null, null, 79, null, null, 76, null, 74, null, 72, null, 71, null, null, null],
    leadType: 'sawtooth',
  },
  lenny: {
    bpm: 66,
    prog: [[53, 57, 60, 64], [50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59]],
    bass: 'R.......F.......', arp: '0...2...3...1...', pad: true, arpType: 'sine',
    kick: 'x.........x.....', snare: '....x.......x...', hat: '..x...x...x...x.', softDrums: true,
  },
  drive: {
    bpm: 140,
    prog: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]],
    bass: 'R.RRR.RRR.RRR.RO', arp: '0120120120120120', pad: true, arpType: 'square',
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    lead: [81, null, 79, null, 76, null, 79, null, 81, null, 84, null, 83, null, 79, null,
      77, null, 76, null, 74, null, 76, null, 77, null, 79, null, 80, null, null, null],
    leadType: 'sawtooth',
  },
  wedding: {
    bpm: 84,
    prog: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]],
    bass: 'R...F...R...F...', arp: null, pad: true,
    kick: 'x.......x.......', snare: '....x.......x...', hat: '',
    lead: [67, null, null, 72, null, 72, 72, null, null, null, null, null, null, null, null, null,
      67, null, null, 74, null, 71, 72, null, null, null, null, null, null, null, null, null],
    leadType: 'triangle',
  },
  boss: {
    bpm: 128,
    prog: [[45, 48, 52], [41, 45, 48], [43, 47, 50], [44, 48, 51]],
    bass: 'R.RR.RR.R.RR.RRO', arp: '0120120120120120', pad: true, arpType: 'sawtooth',
    kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
  },
  victory: {
    bpm: 120,
    prog: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]],
    bass: 'R.R.O.R.R.R.O.R.', arp: '0120120120120120', pad: true, arpType: 'square',
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    lead: [72, null, 76, null, 79, null, 84, null, 83, null, 79, null, 76, null, 79, null,
      81, null, 77, null, 81, null, 84, null, 83, null, null, null, 79, null, null, null],
    leadType: 'square',
  },
};

const VOICES = {
  you: { type: 'triangle', base: 330, spread: 60, dur: 0.05 },
  croc: { type: 'sawtooth', base: 105, spread: 30, dur: 0.07 },
  roo: { type: 'triangle', base: 520, spread: 180, dur: 0.05 },
  gorilla: { type: 'square', base: 82, spread: 18, dur: 0.07 },
  sloth: { type: 'sine', base: 150, spread: 12, dur: 0.16 },
  tortoise: { type: 'triangle', base: 250, spread: 50, dur: 0.06 },
  robot: { type: 'square', base: 420, spread: 0, dur: 0.035 },
  kid: { type: 'triangle', base: 950, spread: 250, dur: 0.04 },
  mayor: { type: 'square', base: 300, spread: 120, dur: 0.045 },
  sheep: { type: 'sawtooth', base: 330, spread: 30, dur: 0.09 },
  news: { type: 'triangle', base: 420, spread: 90, dur: 0.045 },
};

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, music: 0.5, sfx: 0.9 };
    this.track = null;
    this.trackName = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.musicBus);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.27;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.musicIn.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(this.musicBus);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.applyVolume();
    this.setupEngine();
  }

  applyVolume() {
    if (!this.ctx) return;
    const m = this.muted ? 0 : this.vol.master;
    this.master.gain.value = m;
    this.musicBus.gain.value = this.vol.music;
    this.sfxBus.gain.value = this.vol.sfx;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  tone(freq, dur, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (o.delay || 0) + (o.at || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    const atk = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibrato;
      lg.gain.value = o.vibDepth || freq * 0.03;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.05);
    }
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type || 'lowpass';
      f.frequency.setValueAtTime(o.filter.freq, t0);
      if (o.filter.to) f.frequency.exponentialRampToValueAtTime(o.filter.to, t0 + dur);
      f.Q.value = o.filter.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    let out = g;
    if (o.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      out = p;
    }
    out.connect(o.dest || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (o.delay || 0) + (o.at || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t0 + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g);
    let out = g;
    if (o.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      out = p;
    }
    out.connect(o.dest || this.sfxBus);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  play(name, o = {}) {
    if (!this.ctx) return;
    const v = o.vol ?? 1;
    const pan = o.pan;
    switch (name) {
      case 'coin':
        this.tone(988, 0.08, { vol: 0.12 * v });
        this.tone(1319, 0.3, { vol: 0.12 * v, delay: 0.07 });
        break;
      case 'cash':
        this.noise(0.06, { freq: 3000, vol: 0.2 * v });
        this.tone(2093, 0.25, { type: 'triangle', vol: 0.12 * v, delay: 0.05 });
        this.tone(2637, 0.35, { type: 'triangle', vol: 0.12 * v, delay: 0.1 });
        break;
      case 'ui':
        this.tone(740, 0.05, { vol: 0.06 * v });
        break;
      case 'select':
        this.tone(880, 0.06, { vol: 0.08 * v });
        this.tone(1320, 0.09, { vol: 0.08 * v, delay: 0.05 });
        break;
      case 'deny':
        this.tone(180, 0.18, { type: 'sawtooth', vol: 0.1 * v, filter: { freq: 900 } });
        break;
      case 'whoosh':
        this.noise(0.7, { freq: 300, slide: 2400, q: 0.8, vol: 0.25 * v, attack: 0.2, pan });
        break;
      case 'crash':
        this.noise(0.5, { type: 'lowpass', freq: 1400, slide: 200, vol: 0.5 * v, pan });
        this.tone(90, 0.35, { type: 'sawtooth', slide: 30, vol: 0.25 * v, pan });
        break;
      case 'honk':
        this.tone(350, 0.35, { type: 'sawtooth', vol: 0.09 * v, filter: { freq: 1500 }, pan });
        this.tone(440, 0.35, { type: 'sawtooth', vol: 0.09 * v, filter: { freq: 1500 }, pan });
        break;
      case 'door':
        this.noise(0.18, { type: 'lowpass', freq: 700, vol: 0.4 * v });
        this.tone(110, 0.12, { type: 'square', vol: 0.12 * v, filter: { freq: 400 } });
        break;
      case 'hiss':
        this.noise(0.5, { type: 'highpass', freq: 3000, vol: 0.15 * v, attack: 0.05 });
        break;
      case 'jump':
        this.tone(260, 0.16, { type: 'square', slide: 560, vol: 0.06 * v, filter: { freq: 2000 } });
        break;
      case 'land':
        this.noise(0.09, { type: 'lowpass', freq: 400, vol: 0.25 * v });
        break;
      case 'step':
        this.noise(0.05, { type: 'lowpass', freq: 500 + Math.random() * 300, vol: 0.07 * v });
        break;
      case 'boing':
        this.tone(140, 0.45, { type: 'sine', slide: 620, vol: 0.25 * v, vibrato: 18, vibDepth: 30 });
        break;
      case 'grab':
        this.tone(480, 0.1, { type: 'triangle', slide: 950, vol: 0.14 * v });
        break;
      case 'throw':
        this.noise(0.22, { freq: 1600, slide: 400, q: 1.2, vol: 0.2 * v });
        break;
      case 'hit':
        this.tone(220, 0.12, { type: 'square', slide: 70, vol: 0.14 * v, pan });
        this.noise(0.1, { type: 'lowpass', freq: 1200, vol: 0.2 * v, pan });
        break;
      case 'splat':
        this.noise(0.22, { type: 'lowpass', freq: 700, slide: 150, vol: 0.35 * v, pan });
        break;
      case 'explode':
        this.noise(0.9, { type: 'lowpass', freq: 1500, slide: 80, vol: 0.55 * v, pan });
        this.tone(70, 0.7, { type: 'sine', slide: 25, vol: 0.4 * v, pan });
        break;
      case 'zap':
        this.tone(1400, 0.25, { type: 'sawtooth', slide: 180, vol: 0.1 * v, pan });
        break;
      case 'charge':
        this.tone(200, 0.9, { type: 'sawtooth', slide: 1200, vol: 0.05 * v, attack: 0.3, pan });
        break;
      case 'beep':
        this.tone(1000, 0.09, { type: 'square', vol: 0.07 * v, pan });
        break;
      case 'alert':
        this.tone(880, 0.12, { type: 'square', vol: 0.12 * v });
        this.tone(1175, 0.2, { type: 'square', vol: 0.12 * v, delay: 0.1 });
        break;
      case 'checkpoint':
        this.tone(880, 0.1, { type: 'triangle', vol: 0.18 * v });
        this.tone(1320, 0.2, { type: 'triangle', vol: 0.18 * v, delay: 0.07 });
        this.tone(1760, 0.25, { type: 'triangle', vol: 0.12 * v, delay: 0.14 });
        break;
      case 'levelup':
        [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => this.tone(mtof(m), 0.18, { type: 'square', vol: 0.08 * v, delay: i * 0.07, filter: { freq: 3000 } }));
        [72, 76, 79].forEach((m) => this.tone(mtof(m), 0.9, { type: 'triangle', vol: 0.1 * v, delay: 0.5 }));
        break;
      case 'success':
        [67, 72, 76, 79].forEach((m, i) => this.tone(mtof(m), 0.2, { type: 'square', vol: 0.09 * v, delay: i * 0.1, filter: { freq: 3000 } }));
        [72, 76, 79, 84].forEach((m) => this.tone(mtof(m), 1.0, { type: 'triangle', vol: 0.08 * v, delay: 0.42 }));
        break;
      case 'fail':
        this.tone(330, 0.3, { type: 'sawtooth', slide: 160, vol: 0.12 * v, filter: { freq: 1200 } });
        this.tone(220, 0.55, { type: 'sawtooth', slide: 80, vol: 0.12 * v, delay: 0.28, filter: { freq: 900 } });
        break;
      case 'giggle': {
        const n = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.tone(900 + Math.random() * 500, 0.07, { type: 'triangle', vol: 0.18 * v, delay: i * 0.085, slide: 1300 + Math.random() * 300, pan });
        break;
      }
      case 'chomp':
        for (let i = 0; i < 3; i++) this.noise(0.08, { type: 'lowpass', freq: 600, vol: 0.4 * v, delay: i * 0.16 });
        break;
      case 'snore':
        this.noise(1.3, { type: 'lowpass', freq: 180, slide: 320, vol: 0.35 * v, attack: 0.7 });
        break;
      case 'ding':
        this.tone(1568, 0.8, { type: 'sine', vol: 0.15 * v });
        this.tone(2093, 0.8, { type: 'sine', vol: 0.1 * v, delay: 0.02 });
        break;
      case 'kiss':
        this.tone(1100, 0.12, { type: 'sine', slide: 2600, vol: 0.12 * v });
        break;
      case 'baa':
        this.tone(330, 0.5, { type: 'sawtooth', vol: 0.08 * v, vibrato: 11, vibDepth: 18, filter: { freq: 1400 }, pan });
        break;
      case 'robot':
        this.tone(300, 0.08, { type: 'square', vol: 0.07 * v });
        this.tone(600, 0.08, { type: 'square', vol: 0.07 * v, delay: 0.09 });
        break;
      case 'cheer':
        for (let i = 0; i < 14; i++) this.tone(500 + Math.random() * 900, 0.25, { type: 'triangle', vol: 0.03 * v, delay: Math.random() * 0.6, vibrato: 8 });
        this.noise(1.2, { freq: 2000, q: 0.4, vol: 0.12 * v, attack: 0.2 });
        break;
      case 'firework':
        this.tone(400, 0.6, { type: 'sine', slide: 1400, vol: 0.05 * v, pan });
        this.noise(0.8, { type: 'lowpass', freq: 2500, slide: 300, vol: 0.35 * v, delay: 0.6, pan });
        break;
      default:
        break;
    }
  }

  blip(voice) {
    const vc = VOICES[voice] || VOICES.you;
    this.tone(vc.base + Math.random() * vc.spread, vc.dur, { type: vc.type, vol: 0.05, filter: { freq: 3200 } });
  }

  // Continuous hover-engine hum plus wind rush.
  setupEngine() {
    const ctx = this.ctx;
    this.eng = {};
    const g = ctx.createGain();
    g.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 300;
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 55;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 55.7;
    o1.connect(f); o2.connect(f);
    f.connect(g).connect(this.sfxBus);
    o1.start(); o2.start();
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 700;
    wf.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0;
    wind.connect(wf).connect(wg).connect(this.sfxBus);
    wind.start();
    Object.assign(this.eng, { g, f, o1, o2, wg, wf });
  }

  setEngine(level, speed) {
    if (!this.ctx || !this.eng) return;
    const t = this.ctx.currentTime;
    const e = this.eng;
    e.g.gain.setTargetAtTime(level * 0.06, t, 0.1);
    e.o1.frequency.setTargetAtTime(42 + speed * 55, t, 0.1);
    e.o2.frequency.setTargetAtTime(42.6 + speed * 56, t, 0.1);
    e.f.frequency.setTargetAtTime(220 + speed * 900, t, 0.1);
    e.wg.gain.setTargetAtTime(level * speed * 0.09, t, 0.15);
    e.wf.frequency.setTargetAtTime(500 + speed * 1300, t, 0.15);
  }

  siren(on) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (on && !this.sirenNodes) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 760;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 1.6;
      const lg = ctx.createGain();
      lg.gain.value = 240;
      lfo.connect(lg).connect(o.frequency);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1600;
      const g = ctx.createGain();
      g.gain.value = 0.035;
      o.connect(f).connect(g).connect(this.sfxBus);
      o.start(); lfo.start();
      this.sirenNodes = { o, lfo, g };
    } else if (!on && this.sirenNodes) {
      const { o, lfo, g } = this.sirenNodes;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      o.stop(ctx.currentTime + 0.5);
      lfo.stop(ctx.currentTime + 0.5);
      this.sirenNodes = null;
    }
  }

  // ---------------- Music ----------------
  music(name) {
    if (!this.ctx) { this.pendingTrack = name; return; }
    if (name === this.trackName) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.musicIn.gain.cancelScheduledValues(t);
    this.musicIn.gain.setValueAtTime(this.musicIn.gain.value, t);
    this.musicIn.gain.linearRampToValueAtTime(0, t + 0.35);
    this.trackName = name;
    clearTimeout(this.switchTimer);
    this.switchTimer = setTimeout(() => {
      this.track = name ? TRACKS[name] : null;
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.05;
      this.musicIn.gain.cancelScheduledValues(ctx.currentTime);
      this.musicIn.gain.setValueAtTime(0, ctx.currentTime);
      this.musicIn.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.3);
      if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
    }, 380);
  }

  schedule() {
    if (!this.track || !this.ctx) return;
    const ctx = this.ctx;
    // If the tab was hidden we may have fallen behind; skip ahead.
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05;
    const tr = this.track;
    const stepDur = 60 / tr.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(tr, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  playStep(tr, step, t, sd) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chord = tr.prog[bar % tr.prog.length];
    const at = t - this.ctx.currentTime;
    const dest = this.musicIn;
    const soft = tr.softDrums ? 0.5 : 1;
    if (tr.kick && tr.kick[s] === 'x') {
      this.tone(140, 0.28, { type: 'sine', slide: 42, vol: 0.55 * soft, at, dest });
    }
    if (tr.snare && tr.snare[s] === 'x') {
      this.noise(0.15, { freq: 1900, q: 0.7, vol: 0.22 * soft, at, dest });
      this.tone(190, 0.08, { type: 'triangle', vol: 0.12 * soft, at, dest });
    }
    if (tr.rim && tr.rim[s] === 'x') this.tone(1800, 0.03, { type: 'square', vol: 0.05, at, dest });
    if (tr.hat && tr.hat[s] === 'x') this.noise(0.035, { type: 'highpass', freq: 7500, vol: 0.07 * soft, at, dest });
    if (tr.bass) {
      const c = tr.bass[s];
      if (c && c !== '.') {
        let m = chord[0] - 12;
        if (c === 'O') m += 12;
        if (c === 'F') m = chord[2] - 12;
        this.tone(mtof(m), sd * 1.8, { type: tr.bassType || 'sawtooth', vol: 0.16, at, dest, filter: { freq: 900, to: 200 } });
      }
    }
    if (tr.arp) {
      const c = tr.arp[s];
      if (c && c !== '.') {
        const idx = parseInt(c, 10);
        const m = chord[idx % chord.length] + 12 * (tr.arpOct ?? 1) + (idx >= chord.length ? 12 : 0);
        this.tone(mtof(m), sd * 1.2, { type: tr.arpType || 'square', vol: 0.045, at, dest, filter: { freq: 2600 } });
      }
    }
    if (tr.pad && s === 0) {
      for (const n of chord) {
        this.tone(mtof(n), sd * 16, { type: 'sawtooth', vol: 0.02, attack: 0.5, at, dest, detune: -7, filter: { freq: 1100 } });
        this.tone(mtof(n), sd * 16, { type: 'sawtooth', vol: 0.02, attack: 0.5, at, dest, detune: 7, filter: { freq: 1100 } });
      }
    }
    if (tr.lead) {
      const n = tr.lead[step % tr.lead.length];
      if (n) this.tone(mtof(n), sd * 1.9, { type: tr.leadType || 'square', vol: 0.055, at, dest, filter: { freq: 3000 }, vibrato: 5, vibDepth: 3 });
    }
  }
}
