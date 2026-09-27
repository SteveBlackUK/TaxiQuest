// Player progression: credits, XP, stats, inventory, story flags. Saved to localStorage.
const SAVE_KEY = 'taxiquest.save.v1';
const SETTINGS_KEY = 'taxiquest.settings.v1';

export const LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900];

export const STAT_INFO = {
  charm: { name: 'CHARM', short: 'CHA', desc: 'Unlocks smooth-talk dialogue options and bigger tips.' },
  nerve: { name: 'NERVE', short: 'NRV', desc: 'Guards take longer to spot you. Longer alarm timers.' },
  reflex: { name: 'REFLEX', short: 'RFX', desc: 'Bigger catch windows, faster throws, quicker feet.' },
};

export const ITEMS = {
  floss: { name: 'Space Floss', icon: '🍭', desc: 'Sticky cosmic candy floss. Kids and joeys cannot resist it. Throw with right-click.' },
  gerald: { name: 'Robo-Gerald Toy', icon: '🤖', desc: 'Limited-edition Snappy Meal toy. Collectors go feral for these.' },
  duck: { name: 'Space Duck Toy', icon: '🦆', desc: 'The toy nobody wanted. Squeaks ominously.' },
  boots: { name: 'Bounce Boots', icon: '👢', desc: 'A gift from Sheila. You jump way higher.' },
  keycard: { name: 'Vault Keycard', icon: '💳', desc: 'Opens the Galactic Reserve vault. Smells like manager.' },
  goldnana: { name: 'Golden Banana', icon: '🍌', desc: 'A solid gold banana from the vault. Very heavy. Very shiny.' },
  bouquet: { name: 'Wedding Bouquet', icon: '💐', desc: 'Caught at a sloth wedding. Still slightly damp with happy tears.' },
  hat: { name: 'Lucky Fedora', icon: '🎩', desc: '+1 CHARM. Tip it at people.' },
  tonic: { name: 'Nerve Tonic', icon: '🧪', desc: '+1 NERVE. Tastes like courage and pennies.' },
  gum: { name: 'Reflex Gum', icon: '🍬', desc: '+1 REFLEX. Chew aggressively.' },
  nuggets: { name: 'Quantum Nuggets', icon: '🍗', desc: 'Exist in all states of crispiness simultaneously.' },
};

function freshState() {
  return {
    version: 1,
    chapter: 0,
    credits: 20,
    xp: 0,
    level: 1,
    statPoints: 0,
    stats: { charm: 1, nerve: 1, reflex: 1 },
    inv: {},
    flags: {},
    ratings: {},
    heat: 0,
    playTime: 0,
  };
}

export class GameState {
  constructor() {
    this.data = freshState();
    this.listeners = [];
    this.settings = { master: 0.8, music: 0.5, sfx: 0.9, sensitivity: 1, quality: 'high', invertY: false };
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (s) Object.assign(this.settings, s);
    } catch (_) { /* storage may be blocked */ }
  }

  onChange(fn) { this.listeners.push(fn); }
  emit(kind, info) { for (const fn of this.listeners) fn(kind, info); }

  reset() { this.data = freshState(); this.emit('reset'); }

  get d() { return this.data; }
  stat(name) { return this.data.stats[name] || 0; }
  has(item) { return (this.data.inv[item] || 0) > 0; }
  count(item) { return this.data.inv[item] || 0; }
  flag(name) { return this.data.flags[name]; }
  setFlag(name, v = true) { this.data.flags[name] = v; }

  addCredits(n) {
    this.data.credits = Math.max(0, Math.round(this.data.credits + n));
    this.emit('credits', n);
  }
  spend(n) {
    if (this.data.credits < n) return false;
    this.data.credits -= n;
    this.emit('credits', -n);
    return true;
  }
  addItem(id, n = 1) {
    this.data.inv[id] = (this.data.inv[id] || 0) + n;
    if (this.data.inv[id] <= 0) delete this.data.inv[id];
    if (n > 0) {
      if (id === 'hat') this.data.stats.charm++;
      if (id === 'tonic') this.data.stats.nerve++;
      if (id === 'gum') this.data.stats.reflex++;
    }
    this.emit('item', { id, n });
  }
  addXp(n) {
    this.data.xp += n;
    let leveled = 0;
    while (this.data.level < LEVELS.length && this.data.xp >= LEVELS[this.data.level]) {
      this.data.level++;
      this.data.statPoints++;
      leveled++;
    }
    this.emit('xp', { n, leveled });
    return leveled;
  }
  xpProgress() {
    const lv = this.data.level;
    const lo = LEVELS[lv - 1] ?? 0;
    const hi = LEVELS[lv] ?? lo + 1000;
    return Math.min(1, (this.data.xp - lo) / (hi - lo));
  }
  raiseStat(name) {
    if (this.data.statPoints <= 0) return;
    this.data.statPoints--;
    this.data.stats[name]++;
    this.emit('stat', name);
  }
  rate(driver, stars) {
    this.data.ratings[driver] = Math.max(this.data.ratings[driver] || 0, stars);
    this.emit('rating', { driver, stars });
  }
  addHeat(n) {
    this.data.heat = Math.max(0, Math.min(5, this.data.heat + n));
    this.emit('heat', n);
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (_) { /* ignore */ }
  }
  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; }
  }
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (s && s.version === 1) { this.data = Object.assign(freshState(), s); this.emit('reset'); return true; }
    } catch (_) { /* ignore */ }
    return false;
  }
  wipe() {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
  }
  saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (_) { /* ignore */ }
  }
}
