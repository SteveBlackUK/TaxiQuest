import * as THREE from 'three';
import { CAST } from '../world/characters.js';
import { STAT_INFO, ITEMS } from '../core/state.js';

// Story-facing dialogue helpers. Characters registered in game.actors animate while they talk.
export class Dialogue {
  constructor(game) {
    this.game = game;
    this.actors = {};
    const ui = game.ui;
    ui.onLineStart = (sp) => {
      const a = this.actors[sp.id];
      if (a) {
        a.setTalking(true);
        const cp = new THREE.Vector3();
        a.attending = () => this.game.camera.getWorldPosition(cp);
        this._looking = a;
      }
    };
    ui.onLineTyped = (sp) => { const a = this.actors[sp.id]; if (a) a.setTalking(false); };
    ui.onLineEnd = (sp) => { const a = this.actors[sp.id]; if (a) a.setTalking(false); };
  }

  register(id, character) { this.actors[id] = character; }
  define(id, info) { (this.extra ||= {})[id] = info; }
  unregister(id) { delete this.actors[id]; }

  speaker(id) {
    if (typeof id === 'object') return id;
    const c = CAST[id] || this.extra?.[id] || { name: id, voice: 'you' };
    return { id, name: c.name, species: c.species, portrait: c.portrait, voice: c.voice, speed: c.speed };
  }

  async say(id, ...lines) {
    for (const text of lines) await this.game.ui.say(this.speaker(id), text);
    this.game.ui.hideDialogue();
    this.releaseLook();
  }

  // choices: [{ t: 'text', req: { charm: 2 } | undefined, item: 'floss' | undefined }]
  async choose(id, text, choices) {
    const st = this.game.state;
    const mapped = choices.map((c) => {
      let req = null, locked = false;
      if (c.req) {
        const [k, v] = Object.entries(c.req)[0];
        req = `${STAT_INFO[k].short} ${v}`;
        locked = st.stat(k) < v;
      }
      if (c.item) {
        req = ITEMS[c.item].icon + ' ' + ITEMS[c.item].name.toUpperCase();
        locked = !st.has(c.item);
      }
      if (c.cost) {
        req = `₡ ${c.cost}`;
        locked = st.d.credits < c.cost;
      }
      return { text: c.t, req, locked };
    });
    const i = await this.game.ui.say(this.speaker(id), text, mapped);
    this.game.ui.hideDialogue();
    this.releaseLook();
    return i;
  }

  releaseLook() {
    // Characters keep looking at you for a moment, then go back to what they were doing.
    const a = this._looking;
    if (!a) return;
    this._looking = null;
    setTimeout(() => { if (!a.talking && this._looking !== a) { a.attending = null; a.lookAt(a.homeLook || null); } }, 700);
  }

  // Convenience for 'You' lines.
  you(...lines) { return this.say('you', ...lines); }
}
