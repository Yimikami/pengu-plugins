import { assetUrl, PLUGIN_BASE } from '../data/config.js';
import { eggSpritePath, penguSpritePath } from '../data/sprites.js';
import { ARCHETYPES, ARCHETYPE_IDS } from '../data/archetypes.js';

export class OnboardingUI {
  constructor(bus) {
    this.bus = bus;
    this.el = null;
    this._resolve = null;
    this._selectedArchetype = null;
    this._step = 'welcome'; // welcome → choose → name
  }

  /**
   * Runs full onboarding. Returns { archetype, name }.
   */
  show() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._blinkTimers = [];

      // Inject Google Font
      if (!document.getElementById('pengu-font-fredoka')) {
        const link = document.createElement('link');
        link.id = 'pengu-font-fredoka';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap';
        document.head.appendChild(link);
      }

      this.el = document.createElement('div');
      this.el.className = 'onboarding-overlay';
      this.el.innerHTML = `
        <div class="onboarding-backdrop"></div>
        <div class="onboarding-container"></div>
      `;
      document.body.appendChild(this.el);

      requestAnimationFrame(() => {
        this.el.classList.add('onboarding-visible');
        this._showWelcome();
      });
    });
  }

  // ── Step 1: Welcome ──
  _showWelcome() {
    this._step = 'welcome';
    const container = this.el.querySelector('.onboarding-container');
    container.innerHTML = `
      <div class="onb-welcome">
        <img class="onb-logo-img" src="${assetUrl('assets/sprites/ui/logo.png')}" alt="Pengu Family" />
        <div class="onb-subtitle">Your companion awaits in the League Client</div>
        <div class="onb-welcome-eggs">
          ${ARCHETYPE_IDS.map(id => `
            <img class="onb-welcome-egg" src="${assetUrl(eggSpritePath(id, 'idle'))}" alt="${id}" />
          `).join('')}
        </div>
        <button class="onb-btn onb-btn-primary" id="onb-choose-btn">Choose Your Egg</button>
      </div>
    `;

    // Start egg blink animation
    this._startEggBlink(container);

    const btn = container.querySelector('#onb-choose-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._stopEggBlink();
      this._showChoose();
    });
  }

  _startEggBlink(container) {
    this._stopEggBlink();
    const eggs = container.querySelectorAll('.onb-welcome-egg');
    eggs.forEach((egg, i) => {
      const archId = ARCHETYPE_IDS[i];
      const idleSrc = assetUrl(eggSpritePath(archId, 'idle'));
      const blinkSrc = assetUrl(eggSpritePath(archId, 'blink'));
      // Random blink every 2-5s
      const blink = () => {
        egg.src = blinkSrc;
        setTimeout(() => { egg.src = idleSrc; }, 200);
        const next = 2000 + Math.random() * 3000;
        const t = setTimeout(blink, next);
        this._blinkTimers.push(t);
      };
      const initial = 1000 + Math.random() * 3000;
      const t = setTimeout(blink, initial);
      this._blinkTimers.push(t);
    });
  }

  _stopEggBlink() {
    if (this._blinkTimers) {
      this._blinkTimers.forEach(t => clearTimeout(t));
      this._blinkTimers = [];
    }
  }

  // ── Step 2: Egg Selection ──
  _showChoose() {
    this._step = 'choose';
    const container = this.el.querySelector('.onboarding-container');
    container.innerHTML = `
      <div class="onb-choose">
        <div class="onb-title">Choose Your Egg</div>
        <div class="onb-desc">Each egg holds a unique Pengu with its own personality</div>
        <div class="onb-eggs-grid">
          ${ARCHETYPE_IDS.map(id => {
            const info = ARCHETYPES[id];
            return `
              <div class="onb-egg-card" data-archetype="${id}">
                <div class="onb-egg-glow" style="background:${info.glow}"></div>
                <img class="onb-egg-img" src="${assetUrl(eggSpritePath(id, 'idle'))}" alt="${info.name}" />
                <div class="onb-egg-name" style="color:${info.color}">${info.name}</div>
                <div class="onb-egg-title">${info.title}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="onb-preview" style="display:none">
          <img class="onb-preview-img" src="" alt="" />
          <div class="onb-preview-info">
            <div class="onb-preview-name"></div>
            <div class="onb-preview-personality"></div>
            <div class="onb-preview-quote"></div>
          </div>
        </div>
        <div class="onb-choose-actions">
          <button class="onb-btn onb-btn-back">Back</button>
          <button class="onb-btn onb-btn-primary onb-btn-confirm" disabled>Hatch This Egg!</button>
        </div>
      </div>
    `;

    // Egg card click
    const cards = container.querySelectorAll('.onb-egg-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('onb-egg-selected'));
        card.classList.add('onb-egg-selected');
        this._selectedArchetype = card.dataset.archetype;
        this._updatePreview();
        container.querySelector('.onb-btn-confirm').disabled = false;
      });
    });

    // Hover preview
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        const id = card.dataset.archetype;
        const info = ARCHETYPES[id];
        card.querySelector('.onb-egg-img').src = assetUrl(eggSpritePath(id, 'happy'));
      });
      card.addEventListener('mouseleave', () => {
        const id = card.dataset.archetype;
        card.querySelector('.onb-egg-img').src = assetUrl(eggSpritePath(id, 'idle'));
      });
    });

    container.querySelector('.onb-btn-back').addEventListener('click', () => this._showWelcome());
    container.querySelector('.onb-btn-confirm').addEventListener('click', () => {
      if (this._selectedArchetype) {
        this._showName();
      }
    });
  }

  _updatePreview() {
    const id = this._selectedArchetype;
    const info = ARCHETYPES[id];
    const preview = this.el.querySelector('.onb-preview');
    preview.style.display = 'flex';

    preview.querySelector('.onb-preview-img').src = assetUrl(penguSpritePath(id, 'baby', 'idle'));
    preview.querySelector('.onb-preview-name').textContent = info.name;
    preview.querySelector('.onb-preview-name').style.color = info.color;
    preview.querySelector('.onb-preview-personality').textContent = `Personality: ${info.personality}`;
    preview.querySelector('.onb-preview-quote').textContent =
      `"${info.greetings[Math.floor(Math.random() * info.greetings.length)]}"`;
  }

  // ── Step 3: Name Your Pengu ──
  _showName() {
    this._step = 'name';
    const id = this._selectedArchetype;
    const info = ARCHETYPES[id];
    const defaultName = `${info.name} Jr.`;

    const container = this.el.querySelector('.onboarding-container');
    container.innerHTML = `
      <div class="onb-name">
        <img class="onb-name-pengu" src="${assetUrl(penguSpritePath(id, 'baby', 'celebrate'))}" alt="Pengu" />
        <div class="onb-title">Name Your <span style="color:${info.color}">${info.name}</span> Pengu</div>
        <div class="onb-desc">Give your companion a name to remember</div>
        <div class="onb-name-input-wrap">
          <input
            class="onb-name-input"
            type="text"
            placeholder="${defaultName}"
            maxlength="20"
            value="${defaultName}"
          />
          <div class="onb-name-counter"><span class="onb-name-len">${defaultName.length}</span>/20</div>
        </div>
        <div class="onb-name-actions">
          <button class="onb-btn onb-btn-back">Back</button>
          <button class="onb-btn onb-btn-primary onb-btn-start">Begin Adventure!</button>
        </div>
      </div>
    `;

    const input = container.querySelector('.onb-name-input');
    const counter = container.querySelector('.onb-name-len');

    input.addEventListener('input', () => {
      counter.textContent = input.value.length;
    });

    // Auto-select input text
    requestAnimationFrame(() => input.select());

    container.querySelector('.onb-btn-back').addEventListener('click', () => this._showChoose());
    container.querySelector('.onb-btn-start').addEventListener('click', () => {
      const name = input.value.trim() || defaultName;
      this._finish(name);
    });

    // Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const name = input.value.trim() || defaultName;
        this._finish(name);
      }
    });
  }

  _finish(name) {
    this.el.classList.remove('onboarding-visible');
    this.el.classList.add('onboarding-fadeout');
    setTimeout(() => {
      this.el.remove();
      this.el = null;
      if (this._resolve) {
        this._resolve({ archetype: this._selectedArchetype, name });
      }
    }, 500);
  }
}
