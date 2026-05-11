import { assetUrl, OVERLAY_Z } from '../data/config.js';
import { eggSpritePath, EGG_ANIMATIONS } from '../data/sprites.js';
import { ARCHETYPES } from '../data/archetypes.js';

export class HatchUI {
  constructor(bus) {
    this.bus = bus;
    this.el = null;
    this._stage = 0;
    this._archetype = null;
    this._eggImg = null;
    this._resolve = null;
  }

  show(archetype) {
    this._archetype = archetype;
    this._stage = 0;
    const info = ARCHETYPES[archetype];

    return new Promise((resolve) => {
      this._resolve = resolve;

      this.el = document.createElement('div');
      this.el.className = 'hatch-overlay';
      this.el.innerHTML = `
        <div class="hatch-backdrop"></div>
        <div class="hatch-content">
          <div class="hatch-text">Something is waiting for you...</div>
          <div class="hatch-egg-wrapper">
            <img class="hatch-egg" src="${assetUrl(eggSpritePath(archetype, 'idle'))}" alt="Egg" />
            <div class="hatch-glow" style="background: ${info.glow}"></div>
          </div>
          <div class="hatch-hint">Click the egg!</div>
          <div class="hatch-reveal" style="display:none">
            <img class="hatch-pengu" src="" alt="Pengu" />
            <div class="hatch-reveal-text"></div>
            <div class="hatch-personality"></div>
            <button class="hatch-begin-btn">Begin Adventure!</button>
          </div>
        </div>
      `;

      document.body.appendChild(this.el);

      this._eggImg = this.el.querySelector('.hatch-egg');
      this._eggImg.addEventListener('click', () => this._onTap());
      this.el.querySelector('.hatch-begin-btn').addEventListener('click', () => this._finish());

      // Fade in
      requestAnimationFrame(() => {
        this.el.classList.add('hatch-visible');
      });
    });
  }

  _onTap() {
    this._stage++;

    const archetype = this._archetype;
    const info = ARCHETYPES[archetype];
    const hint = this.el.querySelector('.hatch-hint');
    const glow = this.el.querySelector('.hatch-glow');

    switch (this._stage) {
      case 1:
        this._eggImg.src = assetUrl(eggSpritePath(archetype, 'wobble1'));
        this._eggImg.classList.add('egg-shake-1');
        hint.textContent = 'Keep going...';
        glow.style.opacity = '0.3';
        // Brief wobble then back
        setTimeout(() => {
          this._eggImg.src = assetUrl(eggSpritePath(archetype, 'wobble2'));
        }, 300);
        setTimeout(() => {
          this._eggImg.classList.remove('egg-shake-1');
        }, 600);
        break;

      case 2:
        this._eggImg.src = assetUrl(eggSpritePath(archetype, 'wobble3'));
        this._eggImg.classList.add('egg-shake-2');
        hint.textContent = 'Almost there!';
        glow.style.opacity = '0.6';
        setTimeout(() => {
          this._eggImg.src = assetUrl(eggSpritePath(archetype, 'happy'));
        }, 400);
        setTimeout(() => {
          this._eggImg.classList.remove('egg-shake-2');
        }, 800);
        break;

      case 3:
        this._hatch();
        break;
    }
  }

  _hatch() {
    const archetype = this._archetype;
    const info = ARCHETYPES[archetype];
    const hint = this.el.querySelector('.hatch-hint');
    const glow = this.el.querySelector('.hatch-glow');
    const eggWrapper = this.el.querySelector('.hatch-egg-wrapper');

    hint.style.display = 'none';
    this._eggImg.src = assetUrl(eggSpritePath(archetype, 'crack'));
    this._eggImg.classList.add('egg-crack');
    glow.style.opacity = '1';
    glow.classList.add('glow-burst');

    // After crack animation, reveal pengu
    setTimeout(() => {
      eggWrapper.style.display = 'none';

      const reveal = this.el.querySelector('.hatch-reveal');
      const penguImg = this.el.querySelector('.hatch-pengu');
      const revealText = this.el.querySelector('.hatch-reveal-text');
      const personality = this.el.querySelector('.hatch-personality');

      penguImg.src = assetUrl(`assets/sprites/pengus/${archetype}/baby/celebrate.png`);
      revealText.innerHTML = `A <span style="color:${info.color}">${info.name} Pengu</span> has chosen you!`;
      personality.textContent = `"${info.greetings[Math.floor(Math.random() * info.greetings.length)]}"`;

      reveal.style.display = 'flex';
      reveal.classList.add('reveal-animate');

      this._spawnParticles();
    }, 1200);
  }

  _spawnParticles() {
    const content = this.el.querySelector('.hatch-content');
    const emojis = ['✨', '⭐', '💫', '🌟', '🎉'];
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'hatch-particle';
      p.textContent = emojis[i % emojis.length];
      p.style.left = `${30 + Math.random() * 40}%`;
      p.style.animationDelay = `${Math.random() * 0.5}s`;
      content.appendChild(p);
    }
  }

  _finish() {
    this.el.classList.remove('hatch-visible');
    this.el.classList.add('hatch-fadeout');
    setTimeout(() => {
      this.el.remove();
      this.el = null;
      if (this._resolve) this._resolve(this._archetype);
    }, 500);
  }
}
