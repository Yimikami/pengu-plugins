// ---------------------------------------------------------------------------
// DOM overlay, panels (menu, champion select, loading, error, game over),
// HUD, toast. Pure presentation — all input wiring delegated via callbacks.
// ---------------------------------------------------------------------------
import { CONFIG, WORLD, SPELLS } from "./constants";
import { CHAMPIONS, SKILLS, championById } from "./data";
import { clamp } from "./utils";

const KEY_DISPLAY = {
  " ": "Space", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→",
  escape: "Esc", enter: "⏎", tab: "Tab", shift: "Shift", control: "Ctrl",
  alt: "Alt", meta: "Meta",
};
const displayKey = (k) => (k ? (KEY_DISPLAY[k] || k.toUpperCase()) : "—");

// Order the spell tiles by slot: D on the left, F on the right (LoL-native).
function slotOrder(keybinds) {
  const kb = keybinds || {};
  const slotD = Object.values(SPELLS).find((s) => kb[s.id] === "d");
  const slotF = Object.values(SPELLS).find((s) => kb[s.id] === "f");
  return [slotD, slotF].filter(Boolean);
}

export class UI {
  constructor({ onClose, onStart, onRematch, onPickChampion, onSwapSpells }) {
    this.onClose = onClose;
    this.onStart = onStart;
    this.onRematch = onRematch;
    this.onPickChampion = onPickChampion;
    this.onSwapSpells = onSwapSpells;
    this.overlay = null;
    this.canvas = null;
    this.hudEl = null;
    this.toastTimer = null;
    this._doc = document; // may be swapped to a popup's document
  }

  open(doc) {
    if (this.overlay) return;
    if (doc) this._doc = doc;
    const overlay = this._doc.createElement("div");
    overlay.id = CONFIG.OVERLAY_ID;
    overlay.innerHTML = `
      <canvas class="dg-webgl"></canvas>
      <button class="dg-close" title="Close (Esc)">&times;</button>
      <div class="dg-panel"></div>
      <div class="dg-toast"></div>
    `;
    this._doc.body.appendChild(overlay);
    this.overlay = overlay;
    this.canvas = overlay.querySelector("canvas.dg-webgl");
    overlay.querySelector(".dg-close").addEventListener("click", () => this.onClose?.());
  }

  close() {
    if (!this.overlay) return;
    this.overlay.remove();
    this.overlay = null;
    this.canvas = null;
    this.hudEl = null;
  }

  getPanel() { return this.overlay?.querySelector(".dg-panel"); }

  hidePanel() {
    const p = this.getPanel();
    if (p) p.style.display = "none";
  }
  showPanel() {
    const p = this.getPanel();
    if (p) p.style.display = "";
  }

  showToast(text, ms = 900) {
    const t = this.overlay?.querySelector(".dg-toast");
    if (!t) return;
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  }

  // ---- panels -----------------------------------------------------------
  renderMenu({ highScore, selectedId }) {
    this._lastHigh = highScore;
    if (selectedId != null) this._lastSelected = selectedId;
    const panel = this.getPanel();
    if (!panel) return;
    this.showPanel();
    panel.innerHTML = `
      <h1>Skillshot Dodge</h1>
      <div class="dg-sub">Runeterra Gauntlet</div>
      <div class="dg-how">
        Step into the arena as a real champion and dodge iconic skillshots from across Runeterra.<br>
        <b>Right-click</b> to move (LoL-native). <b>D</b> = Flash, <b>F</b> = Ghost — rebind in Settings.
      </div>
      <div class="dg-divider"></div>
      <div class="dg-stats-row single">
        <div class="dg-box"><div class="dg-n">${highScore}</div><div class="dg-l">Best Score</div></div>
      </div>
      <div class="dg-actions">
        <button class="dg-btn" id="dg-select">Choose Champion</button>
        <button class="dg-btn dg-btn-sec" id="dg-settings">Settings</button>
        <button class="dg-btn dg-btn-sec" id="dg-menu-close">Cancel</button>
      </div>
    `;
    panel.querySelector("#dg-select").addEventListener("click", () => this.renderChampionSelect({ selectedId: this._lastSelected }));
    panel.querySelector("#dg-settings").addEventListener("click", () => this.renderSettings({ keybinds: this._keybinds || {} }));
    panel.querySelector("#dg-menu-close").addEventListener("click", () => this.onClose?.());
  }

  // Cache of the latest keybinds so panels can render them without the game
  // having to pass them through every time.
  cacheKeybinds(keybinds) { this._keybinds = keybinds; }

  // LoL-native summoner-spell settings: two fixed slots (F on the left,
  // D on the right) with a Swap button that flips which spell goes where.
  // No freeform keybind capture — just like the real client.
  renderSettings({ keybinds, onBack }) {
    this._keybinds = keybinds || this._keybinds || {};
    this._settingsOnBack = onBack;
    this._renderSettingsBody();
  }

  _renderSettingsBody() {
    const panel = this.getPanel();
    if (!panel) return;
    this.showPanel();
    const kb = this._keybinds;
    const spellInSlot = (slot) => Object.values(SPELLS).find((s) => kb[s.id] === slot);
    const slotF = spellInSlot("f");
    const slotD = spellInSlot("d");

    const slotHTML = (spell, slotLetter) => spell ? `
      <div class="dg-slot">
        <div class="dg-slot-key">${slotLetter.toUpperCase()}</div>
        <img class="dg-slot-icon" src="${spell.iconUrl}" alt="${spell.name}">
        <div class="dg-slot-name">${spell.name}</div>
      </div>
    ` : `<div class="dg-slot empty"><div class="dg-slot-key">${slotLetter.toUpperCase()}</div></div>`;

    panel.innerHTML = `
      <h1>Settings</h1>
      <div class="dg-sub">Summoner Spells</div>
      <div class="dg-how">
        Click <b>Swap</b> to change which spell is on <b>D</b> and which is on <b>F</b> — just like the real League client.
      </div>
      <div class="dg-slot-row">
        ${slotHTML(slotD, "d")}
        <button class="dg-swap-btn" id="dg-swap" title="Swap slots">⇄</button>
        ${slotHTML(slotF, "f")}
      </div>
      <div class="dg-divider"></div>
      <div class="dg-how" style="font-size:12px;">
        <b>Flash</b>: blink ${SPELLS.flash.distance.toFixed(1)} units toward cursor · ${(SPELLS.flash.cooldown/1000)|0}s cooldown<br>
        <b>Ghost</b>: +${Math.round((SPELLS.ghost.speedMult-1)*100)}% move speed for ${(SPELLS.ghost.duration/1000)|0}s · ${(SPELLS.ghost.cooldown/1000)|0}s cooldown
      </div>
      <div class="dg-actions">
        <button class="dg-btn" id="dg-back">Back</button>
      </div>
    `;
    panel.querySelector("#dg-swap").addEventListener("click", () => {
      this.onSwapSpells?.();
      this._renderSettingsBody();
    });
    panel.querySelector("#dg-back").addEventListener("click", () => {
      if (typeof this._settingsOnBack === "function") this._settingsOnBack();
      else this.renderMenu({ highScore: this._lastHigh ?? 0, selectedId: this._lastSelected });
    });
  }

  renderPauseMenu({ onResume, onSettings, onChangeChamp, onExit }) {
    const panel = this.getPanel();
    if (!panel) return;
    this.showPanel();
    panel.innerHTML = `
      <h1>Paused</h1>
      <div class="dg-sub">Take a breath</div>
      <div class="dg-how">Press <b>Esc</b> or click Resume to jump back in.</div>
      <div class="dg-actions" style="flex-wrap:wrap;">
        <button class="dg-btn" id="dg-resume">Resume</button>
        <button class="dg-btn dg-btn-sec" id="dg-pause-settings">Settings</button>
        <button class="dg-btn dg-btn-sec" id="dg-pause-resel">Change Champion</button>
        <button class="dg-btn dg-btn-sec" id="dg-pause-exit">Exit</button>
      </div>
    `;
    panel.querySelector("#dg-resume").addEventListener("click", () => onResume?.());
    panel.querySelector("#dg-pause-settings").addEventListener("click", () => onSettings?.());
    panel.querySelector("#dg-pause-resel").addEventListener("click", () => onChangeChamp?.());
    panel.querySelector("#dg-pause-exit").addEventListener("click", () => onExit?.());
  }

  renderChampionSelect({ selectedId }) {
    this._lastSelected = selectedId;
    const panel = this.getPanel();
    if (!panel) return;
    this.showPanel();
    const cards = CHAMPIONS.map((c) => `
      <div class="dg-card ${c.id === selectedId ? "active" : ""}" data-id="${c.id}">
        <img src="${CONFIG.ENDPOINTS.championIcon(c.id)}" alt="${c.name}">
        <div>${c.name}</div>
      </div>
    `).join("");
    const current = championById(selectedId);
    panel.innerHTML = `
      <h1>Choose Your Fighter</h1>
      <div class="dg-sub">Selected: ${current?.name || "—"}</div>
      <div class="dg-grid">${cards}</div>
      <div class="dg-how">
        Your champion enters the arena as a <b>real 3D model</b> with animations.<br>
        First load per champion downloads the model (~1–17 MB) from the public model CDN.
      </div>
      <div class="dg-actions">
        <button class="dg-btn" id="dg-play">Enter the Arena</button>
        <button class="dg-btn dg-btn-sec" id="dg-back">Back</button>
      </div>
    `;
    panel.querySelectorAll(".dg-card").forEach((el) => {
      el.addEventListener("click", () => {
        const id = parseInt(el.dataset.id, 10);
        this._lastSelected = id;
        this.onPickChampion?.(id);
        panel.querySelectorAll(".dg-card").forEach((c) => c.classList.remove("active"));
        el.classList.add("active");
        panel.querySelector(".dg-sub").textContent = "Selected: " + championById(id).name;
      });
    });
    panel.querySelector("#dg-play").addEventListener("click", () => this.onStart?.());
    panel.querySelector("#dg-back").addEventListener("click", () => this.renderMenu({ highScore: this._lastHigh ?? 0, selectedId: this._lastSelected }));
  }

  renderLoading(phase, pct) {
    const panel = this.getPanel();
    if (!panel) return;
    this.showPanel();
    panel.innerHTML = `
      <h1>Preparing Arena</h1>
      <div class="dg-sub">${phase}</div>
      <div class="dg-loading">
        <div class="dg-progress"><span style="width:${clamp(pct, 0, 100)}%"></span></div>
        <div class="dg-progress-txt">${Math.round(pct)}%</div>
      </div>
    `;
  }

  renderError(msg, onBack) {
    const panel = this.getPanel();
    if (!panel) return;
    this.showPanel();
    panel.innerHTML = `
      <h1 style="color:#ff6b6b;">Arena Sealed</h1>
      <div class="dg-sub">Could not prepare the fight</div>
      <div class="dg-error">${msg}</div>
      <div class="dg-actions">
        <button class="dg-btn" id="dg-retry">Back to Menu</button>
      </div>
    `;
    panel.querySelector("#dg-retry").addEventListener("click", () => onBack?.());
  }

  renderGameOver({ stats, highScore, onReselect, onMenu }) {
    const panel = this.getPanel();
    if (!panel) return;
    this.showPanel();
    const s = stats || {};
    const isNew = (s.score ?? 0) >= highScore && (s.score ?? 0) > 0;
    panel.innerHTML = `
      <h1 style="color:#ff6b6b;">Defeated</h1>
      <div class="dg-sub">Slain by ${s.killedBy || "a skillshot"}</div>
      <div class="dg-stats-row">
        <div class="dg-box"><div class="dg-n">${s.score || 0}</div><div class="dg-l">Score</div></div>
        <div class="dg-box"><div class="dg-n">${s.wave || 1}</div><div class="dg-l">Wave</div></div>
        <div class="dg-box"><div class="dg-n">${s.dodged || 0}</div><div class="dg-l">Dodged</div></div>
      </div>
      ${isNew
        ? `<div class="dg-how" style="color:#c8aa6e;">◆ <b>NEW PERSONAL BEST</b> ◆</div>`
        : `<div class="dg-how">Best <b>${highScore}</b> &middot; Time <b>${((s.survivedMs || 0) / 1000).toFixed(1)}s</b></div>`}
      <div class="dg-actions">
        <button class="dg-btn" id="dg-again">Rematch</button>
        <button class="dg-btn dg-btn-sec" id="dg-reselect">Change Champion</button>
        <button class="dg-btn dg-btn-sec" id="dg-menu">Menu</button>
      </div>
    `;
    panel.querySelector("#dg-again").addEventListener("click", () => this.onRematch?.());
    panel.querySelector("#dg-reselect").addEventListener("click", () => onReselect?.());
    panel.querySelector("#dg-menu").addEventListener("click", () => onMenu?.());
  }

  // ---- HUD --------------------------------------------------------------
  buildHud(keybinds) {
    if (!this.overlay) return;
    const existing = this.overlay.querySelector(".dg-hud");
    if (existing) existing.remove();
    const kb = keybinds || this._keybinds || {};
    const hud = this._doc.createElement("div");
    hud.className = "dg-hud";
    hud.innerHTML = `
      <div class="dg-top">
        <div class="dg-chip score"><div class="dg-k">Score</div><div class="dg-v" data-k="score">0</div></div>
        <div class="dg-chip wave"><div class="dg-k">Wave</div><div class="dg-v" data-k="wave">1</div></div>
        <div class="dg-chip dodged"><div class="dg-k">Dodged</div><div class="dg-v" data-k="dodged">0</div></div>
      </div>
      <div class="dg-wavebar"><span></span></div>
      <div class="dg-spellbar">${this._spellbarHTML(kb)}</div>
    `;
    this.overlay.appendChild(hud);
    this.hudEl = hud;
    this._lastDodged = 0;
  }

  _spellbarHTML(kb) {
    return slotOrder(kb).map((s) => `
      <div class="dg-spell" data-spell="${s.id}">
        <img class="dg-spell-icon" src="${s.iconUrl}" alt="${s.name}">
        <div class="dg-spell-cd"></div>
        <div class="dg-spell-cd-text" data-k="cd-${s.id}"></div>
        <div class="dg-spell-key" data-k="key-${s.id}">${displayKey(kb[s.id])}</div>
        <div class="dg-spell-name">${s.name}</div>
      </div>
    `).join("");
  }

  // Rebuild the spell bar (tiles, icons, keys) after a D↔F swap without
  // touching the rest of the HUD.
  rebuildHudSpellOrder(keybinds) {
    if (!this.hudEl) return;
    const bar = this.hudEl.querySelector(".dg-spellbar");
    if (!bar) return;
    bar.innerHTML = this._spellbarHTML(keybinds || this._keybinds || {});
  }

  removeHud() {
    if (this.hudEl) {
      this.hudEl.remove();
      this.hudEl = null;
    }
  }

  updateHud(stats, spellState, ts) {
    if (!this.hudEl || !stats) return;
    this.hudEl.querySelector('[data-k="score"]').textContent = stats.score;
    this.hudEl.querySelector('[data-k="wave"]').textContent = stats.wave;
    const dEl = this.hudEl.querySelector('[data-k="dodged"]');
    dEl.textContent = stats.dodged;
    // Small "+1" pulse when dodged ticks up.
    if (stats.dodged > (this._lastDodged || 0)) {
      dEl.parentElement.classList.remove("pulse");
      // force reflow so animation restarts
      void dEl.parentElement.offsetWidth;
      dEl.parentElement.classList.add("pulse");
      this._lastDodged = stats.dodged;
    }
    const pct = ((ts ?? performance.now()) - stats.startTs) % WORLD.waveDurationMs / WORLD.waveDurationMs;
    const bar = this.hudEl.querySelector(".dg-wavebar > span");
    if (bar) bar.style.width = (pct * 100).toFixed(1) + "%";

    // Spell bar — cooldown fill + remaining-seconds text.
    if (spellState) {
      const now = ts ?? performance.now();
      for (const spellId of Object.keys(SPELLS)) {
        const st = spellState[spellId];
        const cfg = SPELLS[spellId];
        if (!st || !cfg) continue;
        const root = this.hudEl.querySelector(`.dg-spell[data-spell="${spellId}"]`);
        if (!root) continue;
        const remain = Math.max(0, st.readyAt - now);
        const frac = cfg.cooldown > 0 ? clamp(remain / cfg.cooldown, 0, 1) : 0;
        const cd = root.querySelector(".dg-spell-cd");
        const cdText = root.querySelector(".dg-spell-cd-text");
        if (cd) cd.style.height = (frac * 100).toFixed(1) + "%";
        if (cdText) cdText.textContent = remain > 0 ? Math.ceil(remain / 1000) : "";
        // Active state for Ghost: highlight while duration is active
        if (spellId === "ghost") {
          const active = now < (st.activeUntil || 0);
          root.classList.toggle("active", active);
        }
        root.classList.toggle("ready", remain <= 0);
      }
    }
  }

  updateHudKeybinds(keybinds) {
    if (!this.hudEl || !keybinds) return;
    for (const spellId of Object.keys(SPELLS)) {
      const el = this.hudEl.querySelector(`[data-k="key-${spellId}"]`);
      if (el) el.textContent = displayKey(keybinds[spellId]);
    }
  }

  cacheHighScore(n) { this._lastHigh = n; }
}
