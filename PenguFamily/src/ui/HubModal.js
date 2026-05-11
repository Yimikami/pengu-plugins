import { assetUrl } from '../data/config.js';
import { penguSpritePath } from '../data/sprites.js';
import { ARCHETYPES } from '../data/archetypes.js';
import { SHOP_ITEMS, SHOP_ITEM_IDS, applyItem } from '../data/shop.js';

export class HubModal {
  constructor(bus) {
    this.bus = bus;
    this.el = null;
    this._tab = 'status';
    this._pengu = null;
    this._save = null;
    this._questManager = null;
    this._onPurchase = null;
    this._onClaimQuest = null;
    this._onFeed = null;
    this._onReset = null;
    this._onToggleOverlay = null;
    this._overlayVisible = true;
  }

  /**
   * Bind external handlers.
   */
  bind({ pengu, save, questManager, onPurchase, onClaimQuest, onFeed, onReset, onToggleOverlay, isOverlayVisible }) {
    this._pengu = pengu;
    this._save = save;
    this._questManager = questManager;
    this._onPurchase = onPurchase;
    this._onClaimQuest = onClaimQuest;
    this._onFeed = onFeed;
    this._onReset = onReset;
    this._onToggleOverlay = onToggleOverlay;
    this._overlayVisible = isOverlayVisible ?? true;
  }

  toggle() {
    if (this.el) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.el) return;
    this._tab = 'status';

    this.el = document.createElement('div');
    this.el.className = 'hub-overlay';
    this.el.innerHTML = `
      <div class="hub-backdrop"></div>
      <div class="hub-panel">
        <div class="hub-header">
          <img class="hub-logo" src="${assetUrl('assets/sprites/ui/logo.png')}" alt="Pengu Family" />
          <div class="hub-coins">
            <img class="hub-coins-icon" src="${assetUrl('assets/sprites/ui/coin.png')}" alt="coins" />
            <span class="hub-coins-val">${this._save?.coins ?? 0}</span>
          </div>
          <button class="hub-close-btn">✕</button>
        </div>
        <div class="hub-tabs">
          <button class="hub-tab hub-tab-active" data-tab="status">Status</button>
          <button class="hub-tab" data-tab="shop">Shop</button>
          <button class="hub-tab" data-tab="quests">Quests</button>
          <button class="hub-tab" data-tab="settings">Settings</button>
        </div>
        <div class="hub-body"></div>
      </div>
    `;

    document.body.appendChild(this.el);

    // Events
    this.el.querySelector('.hub-close-btn').addEventListener('click', () => this.close());
    this.el.querySelector('.hub-backdrop').addEventListener('click', () => this.close());
    this.el.querySelectorAll('.hub-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._tab = tab.dataset.tab;
        this.el.querySelectorAll('.hub-tab').forEach(t => t.classList.remove('hub-tab-active'));
        tab.classList.add('hub-tab-active');
        this._renderBody();
      });
    });

    requestAnimationFrame(() => {
      this.el.classList.add('hub-visible');
      this._renderBody();
    });
  }

  close() {
    if (!this.el) return;
    this.el.classList.remove('hub-visible');
    this.el.classList.add('hub-fadeout');
    setTimeout(() => {
      if (this.el) this.el.remove();
      this.el = null;
    }, 300);
  }

  _renderBody() {
    const body = this.el.querySelector('.hub-body');
    switch (this._tab) {
      case 'status': this._renderStatus(body); break;
      case 'shop': this._renderShop(body); break;
      case 'quests': this._renderQuests(body); break;
      case 'settings': this._renderSettings(body); break;
    }
  }

  // ── Status Tab ──
  _renderStatus(body) {
    const p = this._pengu;
    if (!p) { body.innerHTML = '<div class="hub-empty">No active Pengu</div>'; return; }
    const info = ARCHETYPES[p.archetype];
    const xpPct = Math.round((p.xp / p.xpToNext) * 100);

    body.innerHTML = `
      <div class="hub-status">
        <div class="hub-status-left">
          <img class="hub-status-sprite" src="${assetUrl(penguSpritePath(p.archetype, p.stage, 'idle'))}" alt="${p.name}" />
          <div class="hub-status-stage">${p.stage.toUpperCase()}</div>
        </div>
        <div class="hub-status-right">
          <div class="hub-status-name" style="color:${info.color}">${p.name}</div>
          <div class="hub-status-archetype">${info.name} — ${info.title}</div>
          <div class="hub-status-level">Level ${p.level}</div>
          <div class="hub-status-xp-bar">
            <div class="hub-status-xp-fill" style="width:${xpPct}%"></div>
            <span class="hub-status-xp-text">${p.xp} / ${p.xpToNext} XP</span>
          </div>
          <div class="hub-status-mood">Mood: ${p.mood}</div>
          <div class="hub-stat-bars">
            <div class="hub-stat-row">
              <span class="hub-stat-label">🍖 Hunger</span>
              <div class="hub-stat-track"><div class="hub-stat-fill hub-fill-hunger" style="width:${Math.round(p.hunger)}%"></div></div>
              <span class="hub-stat-val">${Math.round(p.hunger)}%</span>
            </div>
            <div class="hub-stat-row">
              <span class="hub-stat-label">💖 Happy</span>
              <div class="hub-stat-track"><div class="hub-stat-fill hub-fill-happy" style="width:${Math.round(p.happiness)}%"></div></div>
              <span class="hub-stat-val">${Math.round(p.happiness)}%</span>
            </div>
            <div class="hub-stat-row">
              <span class="hub-stat-label">⚡ Energy</span>
              <div class="hub-stat-track"><div class="hub-stat-fill hub-fill-energy" style="width:${Math.round(p.energy)}%"></div></div>
              <span class="hub-stat-val">${Math.round(p.energy)}%</span>
            </div>
          </div>
          <div class="hub-status-stats">
            Games: ${p.stats.gamesPlayed} · Wins: ${p.stats.wins} · Losses: ${p.stats.losses}
          </div>
          <div class="hub-status-actions">
            <button class="hub-feed-btn" ${(this._save?.snacks ?? 0) <= 0 ? 'disabled' : ''}>
              🍖 Feed (${this._save?.snacks ?? 0} snacks)
            </button>
          </div>
        </div>
      </div>
    `;

    body.querySelector('.hub-feed-btn')?.addEventListener('click', () => {
      if (this._onFeed) {
        this._onFeed();
        this._renderBody();
        this._updateCoins();
      }
    });
  }

  // ── Shop Tab ──
  _renderShop(body) {
    const coins = this._save?.coins ?? 0;

    body.innerHTML = `
      <div class="hub-shop">
        <div class="hub-shop-grid">
          ${SHOP_ITEM_IDS.map(id => {
            const item = SHOP_ITEMS[id];
            const canBuy = coins >= item.price;
            return `
              <div class="hub-shop-card ${canBuy ? '' : 'hub-shop-disabled'}" data-item="${id}">
                <div class="hub-shop-emoji">${item.icon ? `<img src="${assetUrl(item.icon)}" alt="${item.name}" class="hub-shop-icon-img" />` : item.emoji}</div>
                <div class="hub-shop-name">${item.name}</div>
                <div class="hub-shop-desc">${item.desc}</div>
                <div class="hub-shop-price">
                  <img class="hub-shop-coin-img" src="${assetUrl('assets/sprites/ui/coin.png')}" alt="coin" /> ${item.price}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    body.querySelectorAll('.hub-shop-card:not(.hub-shop-disabled)').forEach(card => {
      card.addEventListener('click', () => {
        const itemId = card.dataset.item;
        if (this._onPurchase) {
          this._onPurchase(itemId);
          this._updateCoins();
          this._renderBody();
        }
      });
    });
  }

  // ── Quests Tab ──
  _renderQuests(body) {
    const qm = this._questManager;
    if (!qm) { body.innerHTML = '<div class="hub-empty">Quests not available</div>'; return; }

    const active = qm.getActive();

    const renderQuestList = (quests, title) => {
      if (!quests.length) return `<div class="hub-quest-empty">No ${title.toLowerCase()} quests</div>`;
      return quests.map(q => {
        const pct = Math.round((q.progress / q.target) * 100);
        const done = q.completed;
        return `
          <div class="hub-quest-card ${done ? 'hub-quest-done' : ''}">
            <div class="hub-quest-info">
              <div class="hub-quest-name">${q.name}</div>
              <div class="hub-quest-progress-bar">
                <div class="hub-quest-progress-fill" style="width:${pct}%"></div>
              </div>
              <div class="hub-quest-progress-text">${q.progress}/${q.target}</div>
            </div>
            <div class="hub-quest-reward">
              <div>✨ ${q.xp} XP</div>
              <div>🪙 ${q.coins}</div>
              ${done && !q.claimed
                ? `<button class="hub-quest-claim" data-quest="${q.id}">Claim</button>`
                : done ? '<span class="hub-quest-claimed">Claimed</span>' : ''}
            </div>
          </div>
        `;
      }).join('');
    };

    body.innerHTML = `
      <div class="hub-quests">
        <div class="hub-quest-section">
          <div class="hub-quest-title">Daily Quests</div>
          ${renderQuestList(active.daily, 'Daily')}
        </div>
        <div class="hub-quest-section">
          <div class="hub-quest-title">Weekly Quests</div>
          ${renderQuestList(active.weekly, 'Weekly')}
        </div>
        <div class="hub-quest-section">
          <div class="hub-quest-title">Repeatable Quests <span class="hub-quest-repeat-badge">∞</span></div>
          ${renderQuestList(active.repeatable || [], 'Repeatable')}
        </div>
      </div>
    `;

    body.querySelectorAll('.hub-quest-claim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const questId = btn.dataset.quest;
        if (this._onClaimQuest) {
          this._onClaimQuest(questId);
          this._updateCoins();
          this._renderBody();
        }
      });
    });
  }

  // ── Settings Tab ──
  _renderSettings(body) {
    body.innerHTML = `
      <div class="hub-settings">
        <div class="hub-settings-section hub-settings-general">
          <div class="hub-settings-title">Display</div>
          <div class="hub-settings-row">
            <span class="hub-settings-label">Show Pengu Overlay</span>
            <button class="hub-toggle-overlay-btn ${this._overlayVisible ? 'hub-toggle-on' : ''}">
              ${this._overlayVisible ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        <div class="hub-settings-section">
          <div class="hub-settings-title">Danger Zone</div>
          <div class="hub-settings-desc">
            This will reset your pengu, coins, quests and all progress.<br>
            This action cannot be undone!
          </div>
          <button class="hub-reset-btn">Reset Progression</button>
        </div>
      </div>
    `;

    body.querySelector('.hub-toggle-overlay-btn')?.addEventListener('click', () => {
      if (this._onToggleOverlay) {
        this._overlayVisible = !this._overlayVisible;
        this._onToggleOverlay(this._overlayVisible);
        this._renderBody();
      }
    });

    body.querySelector('.hub-reset-btn')?.addEventListener('click', () => {
      this._showResetConfirm(body);
    });
  }

  _showResetConfirm(body) {
    body.innerHTML = `
      <div class="hub-reset-confirm">
        <div class="hub-reset-icon">&#x26A0;&#xFE0F;</div>
        <div class="hub-reset-title">Are you sure?</div>
        <div class="hub-reset-msg">
          Hey, just so you know — if you press that button,
          your little pengu, all your coins, levels, quests...
          everything will be gone forever!
          The client will also restart after this.
          <br><br>
          Are you really sure you want to start over?
        </div>
        <div class="hub-reset-actions">
          <button class="hub-reset-cancel">Nope, nevermind!</button>
          <button class="hub-reset-confirm-btn">Yes, reset everything</button>
        </div>
      </div>
    `;

    body.querySelector('.hub-reset-cancel')?.addEventListener('click', () => {
      this._renderSettings(body);
    });

    body.querySelector('.hub-reset-confirm-btn')?.addEventListener('click', () => {
      if (this._onReset) this._onReset();
    });
  }

  _updateCoins() {
    const val = this.el?.querySelector('.hub-coins-val');
    if (val) val.textContent = this._save?.coins ?? 0;
  }
}
