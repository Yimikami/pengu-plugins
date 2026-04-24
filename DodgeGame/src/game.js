// ---------------------------------------------------------------------------
// DodgeGame — the orchestrator. Owns state transitions, the main RAF loop,
// and wires UI + input + scene + projectiles together.
// ---------------------------------------------------------------------------
import { CONFIG, WORLD, SPELLS, debug } from "./constants";
import { CHAMPIONS, SKILLS, championById, MS_TO_WORLD } from "./data";
import { clamp, weightedPick } from "./utils";
import { getThree, loadChampionModel } from "./three";
import { UI } from "./ui";
import { Input } from "./input";
import { buildScene, setAction } from "./scene";
import {
  buildProjectile, updateProjectile,
  disposeProjectile, checkProjectileHit,
} from "./projectiles";
import {
  spawnFlashEffect, spawnGhostAura, spawnGraceShield,
} from "./effects";

export class DodgeGame {
  constructor() {
    this.state = "idle";
    this.highScore = 0;
    this.selectedChampionId = 81; // default Ezreal
    this.summonerName = "Summoner";

    this.ui = new UI({
      onClose: () => this.close(),
      onStart: () => this.startGame(),
      onRematch: () => this.startGame(),
      onPickChampion: (id) => { this.selectedChampionId = id; },
      onSwapSpells: () => this.swapSpellSlots(),
    });

    this._three = null;          // { THREE, GLTFLoader }
    this._scene = null;          // scene bundle from buildScene()
    this._input = null;
    this._actionState = { current: null };
    this.player = null;
    this.projectiles = [];
    this._effects = [];           // active flash / ghost / shield effects
    this.lastSpawn = 0;
    this.stats = null;
    this.rafId = null;
    this.keybinds = {
      flash: SPELLS.flash.defaultKey,
      ghost: SPELLS.ghost.defaultKey,
    };
    this.spellState = {
      flash: { readyAt: 0 },
      ghost: { readyAt: 0, activeUntil: 0 },
    };

    this.loadPersistent();
    this.fetchSummoner();
    window.addEventListener("unload", () => this.close());
  }

  // ---- persistence ------------------------------------------------------
  get _ds() { return window.DataStore || (typeof DataStore !== "undefined" ? DataStore : null); }

  loadPersistent() {
    const ds = this._ds;
    if (!ds?.get) return;
    try {
      const bs = ds.get(CONFIG.DATASTORE_KEY_BEST, 0);
      const n = typeof bs === "number" ? bs : parseInt(bs, 10);
      this.highScore = Number.isFinite(n) && n > 0 ? n : 0;

      const ch = ds.get(CONFIG.DATASTORE_KEY_CHAMP);
      if (ch != null) {
        const id = typeof ch === "number" ? ch : parseInt(ch, 10);
        if (championById(id)) this.selectedChampionId = id;
      }

      const kb = ds.get(CONFIG.DATASTORE_KEY_KEYS);
      // Tolerate legacy values that were stored as JSON-stringified strings.
      const parsed = typeof kb === "string" ? (() => { try { return JSON.parse(kb); } catch { return null; } })() : kb;
      if (parsed?.flash && typeof parsed.flash === "string") this.keybinds.flash = parsed.flash.toLowerCase();
      if (parsed?.ghost && typeof parsed.ghost === "string") this.keybinds.ghost = parsed.ghost.toLowerCase();

      this.ui.cacheHighScore(this.highScore);
    } catch (e) { debug("persistent load err", e); }
  }

  savePersistent() {
    const ds = this._ds;
    if (!ds?.set) return;
    try {
      ds.set(CONFIG.DATASTORE_KEY_BEST, this.highScore);
      ds.set(CONFIG.DATASTORE_KEY_CHAMP, this.selectedChampionId);
      ds.set(CONFIG.DATASTORE_KEY_KEYS, this.keybinds);
    } catch (e) { debug("persistent save err", e); }
  }

  // LoL-native behaviour: the two summoner spell slots are always D and F.
  // The only customization is which spell sits on which slot.
  swapSpellSlots() {
    const tmp = this.keybinds.flash;
    this.keybinds.flash = this.keybinds.ghost;
    this.keybinds.ghost = tmp;
    if (this._input) this._input.setKeybinds(this.keybinds);
    this.ui.cacheKeybinds(this.keybinds);
    this.ui.updateHudKeybinds(this.keybinds);
    this.ui.rebuildHudSpellOrder?.(this.keybinds);
    this.savePersistent();
  }

  async fetchSummoner() {
    try {
      const r = await fetch(CONFIG.ENDPOINTS.summoner);
      if (!r.ok) return;
      const d = await r.json();
      this.summonerName = d.gameName || d.displayName || "Summoner";
    } catch (e) { debug("summoner fetch err", e); }
  }

  // ---- overlay lifecycle -----------------------------------------------
  openMenu() {
    if (this.ui.overlay) return;
    this.ui.open();
    this._escHandler = (e) => {
      if (e.key !== "Escape") return;
      // In-game: pause instead of closing. On the pause screen: resume.
      // Elsewhere (menu / game over): close the overlay.
      if (this.state === "running") {
        e.preventDefault(); e.stopPropagation();
        this.pauseGame();
      } else if (this.state === "paused") {
        e.preventDefault(); e.stopPropagation();
        this.resumeGame();
      } else {
        this.close();
      }
    };
    // Capture phase so the in-game keydown listener can't get to it first
    // and e.g. fire a summoner spell bound to Escape.
    window.addEventListener("keydown", this._escHandler, true);
    this.state = "menu";
    this.ui.cacheHighScore(this.highScore);
    this.ui.cacheKeybinds(this.keybinds);
    this.ui.renderMenu({ highScore: this.highScore, selectedId: this.selectedChampionId });
  }

  // ---- pause / resume ---------------------------------------------------
  pauseGame() {
    if (this.state !== "running") return;
    this.state = "paused";
    this._pausedAt = performance.now();
    this.stopLoop();
    if (this._input) this._input.detach();
    // Still render the frozen scene once under the pause panel.
    if (this._scene?.renderer) {
      this._scene.renderer.render(this._scene.scene, this._scene.camera);
    }
    this.ui.renderPauseMenu({
      onResume: () => this.resumeGame(),
      onSettings: () => this.ui.renderSettings({
        keybinds: this.keybinds,
        onBack: () => this._rerenderPauseMenu(),
      }),
      onChangeChamp: () => {
        this.state = "menu";
        this.disposeScene();
        this.ui.removeHud();
        this.ui.renderChampionSelect({ selectedId: this.selectedChampionId });
      },
      onExit: () => this.close(),
    });
  }

  _rerenderPauseMenu() {
    this.ui.renderPauseMenu({
      onResume: () => this.resumeGame(),
      onSettings: () => this.ui.renderSettings({
        keybinds: this.keybinds,
        onBack: () => this._rerenderPauseMenu(),
      }),
      onChangeChamp: () => {
        this.state = "menu";
        this.disposeScene();
        this.ui.removeHud();
        this.ui.renderChampionSelect({ selectedId: this.selectedChampionId });
      },
      onExit: () => this.close(),
    });
  }

  resumeGame() {
    if (this.state !== "paused") return;
    const now = performance.now();
    const offset = now - (this._pausedAt || now);
    this._shiftTime(offset);
    this.ui.hidePanel();
    this.state = "running";
    this.lastFrame = now;
    if (this._input) this._input.attach();
    this.startLoop();
  }

  // Shift every absolute-time field forward by `offset` ms so the game state
  // continues as if the paused interval never happened.
  _shiftTime(offset) {
    if (!Number.isFinite(offset) || offset <= 0) return;
    if (this.stats) {
      this.stats.startTs += offset;
      if (this.stats.graceUntil) this.stats.graceUntil += offset;
    }
    if (this.lastSpawn) this.lastSpawn += offset;
    for (const p of this.projectiles) {
      if (p.spawnTs) p.spawnTs += offset;
      if (p.telegraphUntil) p.telegraphUntil += offset;
      if (p.activeUntil) p.activeUntil += offset;
    }
    for (const key of Object.keys(this.spellState)) {
      const s = this.spellState[key];
      if (s.readyAt) s.readyAt += offset;
      if (s.activeUntil) s.activeUntil += offset;
    }
    for (const e of this._effects) {
      e.shiftTime?.(offset);
    }
  }

  close() {
    if (!this.ui.overlay) return;
    this.stopLoop();
    if (this._input) this._input.detach();
    this._input = null;
    this.disposeScene();
    if (this._escHandler) window.removeEventListener("keydown", this._escHandler, true);
    this._escHandler = null;
    if (this._resizeHandler) window.removeEventListener("resize", this._resizeHandler);
    this._resizeHandler = null;
    this.ui.removeHud();
    this.ui.close();
    this.state = "idle";
  }

  // ---- game start -------------------------------------------------------
  async startGame() {
    const champ = championById(this.selectedChampionId);
    if (!champ) return;

    this.state = "loading";
    this.ui.renderLoading("Loading Three.js runtime", 5);

    try {
      this._three = await getThree();
      this.ui.renderLoading(`Summoning ${champ.name}`, 15);
      const modelData = await loadChampionModel(champ, (pct) => {
        this.ui.renderLoading(`Summoning ${champ.name}`, 15 + pct * 0.75);
      });
      this.ui.renderLoading("Building arena", 95);

      // Clean any previous scene (e.g., from rematch with a different champion)
      this.disposeScene();

      this._scene = buildScene({
        THREE: this._three.THREE,
        SkeletonUtils: this._three.SkeletonUtils,
        canvas: this.ui.canvas,
        modelData,
      });
      this._actionState = { current: null };
      this._setAction("idle");

      // Pull the champion's in-game base movespeed and convert to world units.
      const baseSpeed = (champ.baseMs ? champ.baseMs * MS_TO_WORLD : WORLD.playerSpeed);
      this.player = {
        group: this._scene.playerGroup,
        target: null,
        facing: 0,
        radius: WORLD.playerRadius,
        baseSpeed,
        speed: baseSpeed,
        dead: false,
      };

      this._input = new Input({
        THREE: this._three.THREE,
        canvas: this.ui.canvas,
        camera: this._scene.camera,
        overlay: this.ui.overlay,
        keybinds: this.keybinds,
        onSpellKey: (spellId) => this._castSpell(spellId),
      });
      this._input.attach();

      this._resizeHandler = () => {
        const { renderer, camera } = this._scene;
        const w = window.innerWidth, h = window.innerHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", this._resizeHandler);

      this.ui.hidePanel();
      this.ui.buildHud(this.keybinds);

      const now = performance.now();
      this.stats = {
        score: 0, dodged: 0, wave: 1,
        startTs: now, survivedMs: 0, killedBy: null,
        champ: champ.name,
        graceUntil: now + WORLD.graceMs,
      };
      this.projectiles = [];
      // Delay the first spawn so the player isn't insta-killed on spawn.
      // maybeSpawn fires when (ts - lastSpawn) >= spawnInterval; pre-set
      // lastSpawn so the first fire lands firstSpawnDelayMs after the start.
      const wave1Interval = this._spawnInterval(1);
      this.lastSpawn = now + WORLD.firstSpawnDelayMs - wave1Interval;
      // Reset summoner spells
      this.spellState.flash.readyAt = 0;
      this.spellState.ghost.readyAt = 0;
      this.spellState.ghost.activeUntil = 0;
      // Visual shield during grace period
      this._addEffect(spawnGraceShield({
        THREE: this._three.THREE, scene: this._scene.scene,
        player: this.player, duration: WORLD.graceMs,
      }));
      this.state = "running";
      this.ui.showToast("Fight!", 800);

      this.savePersistent();
      this.startLoop();
    } catch (e) {
      console.error("[DodgeGame] failed to start:", e);
      this.ui.renderError(`${e?.message || e}`, () => this.ui.renderMenu({ highScore: this.highScore, selectedId: this.selectedChampionId }));
      this.state = "menu";
    }
  }

  _setAction(name, fadeTime) {
    if (!this._three || !this._scene) return;
    setAction({
      THREE: this._three.THREE,
      mixer: this._scene.mixer,
      clipRefs: this._scene.clipRefs,
      state: this._actionState,
      name, fadeTime,
    });
  }

  // ---- summoner spells --------------------------------------------------
  _castSpell(spellId) {
    if (this.state !== "running") return;
    if (!this.player || this.player.dead) return;
    const now = performance.now();
    const cfg = SPELLS[spellId];
    const st = this.spellState[spellId];
    if (!cfg || !st || now < st.readyAt) return;

    if (spellId === "flash") this._castFlash(cfg, st, now);
    else if (spellId === "ghost") this._castGhost(cfg, st, now);
  }

  _castFlash(cfg, st, now) {
    const p = this.player;
    // Aim direction: toward the cursor if it has ever been over the arena,
    // otherwise in the direction the champion is currently facing.
    const cursor = this._input?.cursorWorld;
    let dx, dz;
    if (cursor) {
      dx = cursor.x - p.group.position.x;
      dz = cursor.z - p.group.position.z;
    } else {
      // facing was stored as atan2(moveX, moveZ); reverse to (dx, dz).
      dx = Math.sin(p.facing);
      dz = Math.cos(p.facing);
    }
    let dLen = Math.hypot(dx, dz);
    if (dLen < 0.01) { dx = 0; dz = 1; dLen = 1; }
    const nx = dx / dLen, nz = dz / dLen;
    const dist = Math.min(cfg.distance, dLen);
    const fromX = p.group.position.x;
    const fromZ = p.group.position.z;
    const toX = clamp(fromX + nx * dist, -WORLD.arenaBound, WORLD.arenaBound);
    const toZ = clamp(fromZ + nz * dist, -WORLD.arenaBound, WORLD.arenaBound);

    p.group.position.x = toX;
    p.group.position.z = toZ;
    // Face the blink direction
    p.facing = Math.atan2(nx, nz);
    p.group.rotation.y = p.facing;
    // Clear any pending right-click move target so we don't slide back.
    if (this._input) this._input.moveTarget = null;

    this._addEffect(spawnFlashEffect({
      THREE: this._three.THREE, scene: this._scene.scene,
      from: { x: fromX, z: fromZ }, to: { x: toX, z: toZ },
    }));
    st.readyAt = now + cfg.cooldown;
  }

  _castGhost(cfg, st, now) {
    st.activeUntil = now + cfg.duration;
    st.readyAt = now + cfg.cooldown;
    this._addEffect(spawnGhostAura({
      THREE: this._three.THREE, scene: this._scene.scene,
      player: this.player, duration: cfg.duration,
    }));
  }

  // ---- main loop --------------------------------------------------------
  startLoop() {
    this.lastFrame = performance.now();
    const tick = (ts) => {
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (ts - this.lastFrame) / 1000);
      this.lastFrame = ts;
      if (this.state === "running") {
        this.update(dt, ts);
      } else if (this.state === "over" && this._scene?.mixer) {
        this._scene.mixer.update(dt);
      }
      // When paused we neither update nor advance animations — the scene
      // freezes in place but is still rendered so the pause menu overlays it.
      if (this._scene?.renderer) {
        this._scene.renderer.render(this._scene.scene, this._scene.camera);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  update(dt, ts) {
    this.updatePlayer(dt, ts);
    if (this._scene?.mixer) this._scene.mixer.update(dt);
    this.updateWave(ts);
    this.maybeSpawn(ts);
    this.updateProjectiles(dt, ts);
    this.updateEffects(dt, ts);
    this.checkCollisions();
    this.stats.survivedMs = ts - this.stats.startTs;
    this.stats.score = Math.floor(this.stats.survivedMs / 100) + this.stats.dodged * 25;
    this.ui.updateHud(this.stats, this.spellState, ts);
  }

  _spawnInterval(wave) {
    return Math.max(320, 1700 - wave * 140);
  }

  _addEffect(effect) { if (effect) this._effects.push(effect); }

  updateEffects(dt, ts) {
    for (let i = this._effects.length - 1; i >= 0; i--) {
      const e = this._effects[i];
      const alive = e.update(dt, ts);
      if (!alive) {
        e.dispose();
        this._effects.splice(i, 1);
      }
    }
  }

  updatePlayer(dt, ts) {
    const p = this.player;
    if (!p || p.dead) return;

    // Ghost buff multiplies base speed while active.
    const ghostActive = ts != null && ts < this.spellState.ghost.activeUntil;
    p.speed = p.baseSpeed * (ghostActive ? SPELLS.ghost.speedMult : 1);

    // LoL-native controls: right-click to move. No WASD / arrow keys.
    const pos = p.group.position;
    let moveX = 0, moveZ = 0;
    if (this._input?.moveTarget) {
      const t = this._input.moveTarget;
      const dx = t.x - pos.x, dz = t.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) {
        this._input.moveTarget = null;
      } else {
        const step = Math.min(d, p.speed * dt);
        moveX = (dx / d) * step;
        moveZ = (dz / d) * step;
      }
    }

    pos.x = clamp(pos.x + moveX, -WORLD.arenaBound, WORLD.arenaBound);
    pos.z = clamp(pos.z + moveZ, -WORLD.arenaBound, WORLD.arenaBound);

    const moving = Math.hypot(moveX, moveZ) > 1e-4;
    if (moving) {
      p.facing = Math.atan2(moveX, moveZ);
      p.group.rotation.y = p.facing;
      this._setAction("run");
    } else {
      this._setAction("idle");
    }
  }

  updateWave(ts) {
    const elapsed = ts - this.stats.startTs;
    const wave = Math.floor(elapsed / WORLD.waveDurationMs) + 1;
    if (wave > this.stats.wave) {
      this.stats.wave = wave;
      this.ui.showToast(`Wave ${wave}`, 900);
    }
  }

  maybeSpawn(ts) {
    const wave = this.stats.wave;
    const spawnInterval = this._spawnInterval(wave);
    if (ts - this.lastSpawn < spawnInterval) return;
    this.lastSpawn = ts;
    const simultaneous = Math.min(3, 1 + Math.floor((wave - 1) / 3));
    for (let i = 0; i < simultaneous; i++) {
      this.spawnProjectile(ts, i * 140);
    }
  }

  spawnProjectile(ts, delay = 0) {
    const targetDiff = clamp(Math.ceil(this.stats.wave / 3), 1, 3);
    const skill = weightedPick(SKILLS, (s) =>
      s.diff === targetDiff ? 3 : s.diff < targetDiff ? 2 : 1
    );
    const proj = buildProjectile({
      THREE: this._three.THREE,
      scene: this._scene.scene,
      skill,
      player: this.player,
      spawnTs: ts + delay,
    });
    this.projectiles.push(proj);
  }

  updateProjectiles(dt, ts) {
    for (const p of this.projectiles) {
      if (!p.expired) updateProjectile(p, dt, ts);
    }
    const survivors = [];
    for (const p of this.projectiles) {
      if (p.expired) {
        if (!p.countedDodge) {
          this.stats.dodged += 1;
          p.countedDodge = true;
        }
        disposeProjectile(p, this._scene.scene);
      } else {
        survivors.push(p);
      }
    }
    this.projectiles = survivors;
  }

  checkCollisions() {
    const pl = this.player;
    if (!pl || pl.dead) return;
    // Spawn protection: skip damage during the opening grace window.
    if (performance.now() < this.stats.graceUntil) return;
    const px = pl.group.position.x;
    const pz = pl.group.position.z;
    for (const p of this.projectiles) {
      const hit = checkProjectileHit(p, px, pz, pl.radius);
      if (hit) {
        this.endGame(`${hit.champ} — ${hit.spell}`);
        return;
      }
    }
  }

  // ---- game over --------------------------------------------------------
  endGame(killedBy) {
    if (this.state !== "running") return;
    this.state = "over";
    this.player.dead = true;
    if (this._input) this._input.moveTarget = null;
    this._setAction("death", 0.15);

    this.stats.killedBy = killedBy;
    this.stats.survivedMs = performance.now() - this.stats.startTs;
    if (this.stats.score > this.highScore) {
      this.highScore = this.stats.score;
      this.ui.cacheHighScore(this.highScore);
    }
    this.savePersistent();
    if (this._input) this._input.detach();

    clearTimeout(this._overTimer);
    this._overTimer = setTimeout(() => {
      this.ui.renderGameOver({
        stats: this.stats,
        highScore: this.highScore,
        onReselect: () => this.ui.renderChampionSelect({ selectedId: this.selectedChampionId }),
        onMenu: () => this.ui.renderMenu({ highScore: this.highScore, selectedId: this.selectedChampionId }),
      });
    }, 1200);
  }

  // ---- teardown ---------------------------------------------------------
  disposeScene() {
    this.stopLoop();
    if (!this._scene) return;
    for (const p of this.projectiles) disposeProjectile(p, this._scene.scene);
    this.projectiles = [];
    for (const e of this._effects) e.dispose();
    this._effects = [];
    this._scene.dispose();
    this._scene = null;
    this.player = null;
    this._actionState = { current: null };
  }
}
