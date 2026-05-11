import { ARCHETYPES } from '../data/archetypes.js';

export class StatsBar {
  constructor(bus) {
    this.bus = bus;
    this.el = null;
    this._visible = false;
  }

  init(pengu, parentEl) {
    this.pengu = pengu;
    const info = ARCHETYPES[pengu.archetype];

    this.el = document.createElement('div');
    this.el.className = 'pengu-stats-bar';
    this.el.innerHTML = `
      <div class="stats-bar-inner">
        <div class="stats-bar-name">
          <span class="stats-bar-level">Lv.${pengu.level}</span>
          <span style="color:${info.color}">${pengu.name}</span>
        </div>
        <div class="stat-row">
          <span class="stat-icon">🍖</span>
          <div class="stat-track"><div class="stat-fill stat-hunger" style="width:${Math.round(pengu.hunger)}%"></div></div>
        </div>
        <div class="stat-row">
          <span class="stat-icon">💖</span>
          <div class="stat-track"><div class="stat-fill stat-happiness" style="width:${Math.round(pengu.happiness)}%"></div></div>
        </div>
        <div class="stat-row">
          <span class="stat-icon">⚡</span>
          <div class="stat-track"><div class="stat-fill stat-energy" style="width:${Math.round(pengu.energy)}%"></div></div>
        </div>
        <div class="stats-bar-mood">${pengu.mood}</div>
      </div>
    `;

    parentEl.appendChild(this.el);

    this.bus.on('pengu:stats', (s) => this._update(s));
  }

  _update({ hunger, happiness, energy, mood }) {
    if (!this.el) return;
    const h = this.el.querySelector('.stat-hunger');
    const ha = this.el.querySelector('.stat-happiness');
    const e = this.el.querySelector('.stat-energy');
    const m = this.el.querySelector('.stats-bar-mood');
    if (h) h.style.width = `${Math.round(hunger)}%`;
    if (ha) ha.style.width = `${Math.round(happiness)}%`;
    if (e) e.style.width = `${Math.round(energy)}%`;
    if (m && mood) m.textContent = mood;
  }

  updateLevel(pengu) {
    if (!this.el) return;
    const lvl = this.el.querySelector('.stats-bar-level');
    if (lvl) lvl.textContent = `Lv.${pengu.level}`;
  }

  show() { if (this.el) this.el.style.opacity = '1'; }
  hide() { if (this.el) this.el.style.opacity = '0'; }

  destroy() {
    if (this.el) this.el.remove();
    this.el = null;
  }
}
