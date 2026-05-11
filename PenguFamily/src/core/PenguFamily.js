import { EventBus } from './EventBus.js';
import { SaveManager } from './SaveManager.js';
import { LCU } from '../league/LCU.js';
import { AccountResolver } from '../league/AccountResolver.js';
import { GameTracker } from '../league/GameTracker.js';
import { Pengu } from '../pengu/Pengu.js';
import { SpriteRenderer } from '../pengu/SpriteRenderer.js';
import { PenguAI } from '../pengu/PenguAI.js';
import { MoodEngine } from '../pengu/MoodEngine.js';
import { EggManager } from '../systems/EggManager.js';
import { QuestManager } from '../systems/QuestManager.js';
import { OverlayUI } from '../ui/OverlayUI.js';
import { StatsBar } from '../ui/StatsBar.js';
import { HatchUI } from '../ui/HatchUI.js';
import { OnboardingUI } from '../ui/OnboardingUI.js';
import { ChatBubble } from '../ui/ChatBubble.js';
import { HubModal } from '../ui/HubModal.js';
import { ARCHETYPES } from '../data/archetypes.js';
import { SHOP_ITEMS, applyItem } from '../data/shop.js';
import {
  IDLE_LINES, MOOD_LINES, HUNGER_LINES, ENERGY_LINES,
  PHASE_LINES, MOUSE_LINES, ACTION_LINES, HUNGRY_ACT_LINES,
  FAST_DRAG_LINES, DRAG_LINES, CHAMPSELECT_LINES, LOBBY_LINES, pickLine
} from '../data/dialogue.js';
import { XP_PER_WIN, XP_PER_LOSS, COINS_PER_WIN, COINS_PER_LOSS } from '../data/config.js';

export class PenguFamilyApp {
  constructor() {
    this.bus = new EventBus();
    this.saveManager = new SaveManager(this.bus);
    this.account = new AccountResolver(this.bus);
    this.moodEngine = new MoodEngine(this.bus);
    this.eggManager = new EggManager(this.bus);
    this.overlay = new OverlayUI(this.bus);
    this.hatchUI = new HatchUI(this.bus);
    this.onboardingUI = new OnboardingUI(this.bus);
    this.renderer = new SpriteRenderer(this.bus);
    this.ai = new PenguAI(this.bus, this.renderer);
    this.statsBar = new StatsBar(this.bus);
    this.chatBubble = new ChatBubble(this.bus);
    this.hubModal = new HubModal(this.bus);
    this.questManager = new QuestManager(this.bus);
    this.gameTracker = null;

    this.save = null;
    this.pengu = null;
  }

  async init(socket, rcp) {
    this.rcp = rcp;

    // Bind LCU with the socket from Pengu Loader context
    LCU.bind(socket);

    console.log('[PenguFamily] Initializing...');

    // 1. Resolve account
    await this.account.resolve();
    this.saveManager.setPuuid(this.account.puuid);

    // 2. Load or create save
    this.save = this.saveManager.load();

    // 3. Wait for the League Client UI to be ready via RCP
    await this._waitForClient();

    // 4. Set up overlay (with auto-recovery)
    this._initOverlay();

    if (!this.save) {
      // First time — create save and hatch egg
      this.save = this.saveManager.createFreshSave(
        this.account.puuid,
        this.account.gameName,
        this.account.tagLine
      );
      await this._firstTimeHatch();
    } else {
      // Returning user — load active pengu
      await this._loadActivePengu();
    }

    // 5. Load quests
    this.questManager.load(this.save.quests);

    // 6. Start game tracker
    this.gameTracker = new GameTracker(this.bus);
    this.gameTracker.start();

    // 7. Wire up game events
    this._setupEventHandlers();

    // 8. Wire up auto-bubble system
    this._setupBubbleSystem();

    // 9. Save periodically + keep AI hunger in sync
    this.bus.on('pengu:stats', () => {
      if (this.pengu) this.ai.setHunger(this.pengu.hunger);
      this.saveManager.scheduleSave(this._serializeSave());
    });

    console.log('[PenguFamily] Ready!');
  }

  /**
   * Wait for the League Client UI to be ready.
   * Uses rcp.whenReady() if available, falls back to DOM check.
   */
  async _waitForClient() {
    if (this.rcp?.whenReady) {
      try {
        await this.rcp.whenReady('rcp-fe-lol-navigation');
        console.log('[PenguFamily] Client ready via rcp.whenReady');
        return;
      } catch (e) {
        console.warn('[PenguFamily] rcp.whenReady failed, falling back to DOM check', e);
      }
    }

    // Fallback: poll for DOM readiness
    return new Promise((resolve) => {
      const check = () => {
        if (document.querySelector('[class*="rcp-fe"]')) {
          console.log('[PenguFamily] Client ready via DOM check');
          resolve();
        } else {
          setTimeout(check, 500);
        }
      };
      setTimeout(check, 1000);
    });
  }

  /**
   * Initialize overlay with DOM recovery — if our overlay is removed, re-create it.
   */
  _initOverlay() {
    this.overlay.init();

    // Watch for our overlay being removed from the DOM
    this._overlayObserver = new MutationObserver(() => {
      if (this.overlay.el && !document.body.contains(this.overlay.el)) {
        console.warn('[PenguFamily] Overlay was removed from DOM, re-attaching...');
        document.body.appendChild(this.overlay.el);
      }
    });
    this._overlayObserver.observe(document.body, { childList: true, subtree: false });
  }

  async _firstTimeHatch() {
    // Step 1: Onboarding — choose egg + name
    const { archetype, name } = await this.onboardingUI.show();

    // Step 2: Hatch animation
    await this.hatchUI.show(archetype);

    // Step 3: Create pengu with chosen name
    const pengu = this.eggManager.hatch(archetype);
    pengu.name = name;
    this.pengu = pengu;
    this.save.pengus[pengu.id] = pengu.serialize();
    this.save.activePenguId = pengu.id;
    this.saveManager.immediateSave(this._serializeSave());

    this._startPengu();
    this._toast(`${pengu.name} has joined your family!`);
  }

  async _loadActivePengu() {
    const id = this.save.activePenguId;
    if (!id || !this.save.pengus[id]) {
      console.warn('[PenguFamily] No active pengu found, triggering hatch...');
      await this._firstTimeHatch();
      return;
    }

    this.pengu = new Pengu(this.save.pengus[id]);

    // Process offline time
    this.moodEngine.processOfflineTime(this.pengu, this.save.lastLoginAt);

    this._startPengu();

    const info = ARCHETYPES[this.pengu.archetype];
    if (this.pengu.happiness < 50) {
      this._toast(`Welcome back! ${this.pengu.name} missed you!`);
    } else {
      this._toast(`${this.pengu.name}: "${info.greetings[0]}"`);
    }
  }

  _startPengu() {
    // Clean up previous instances
    this.ai.stop();
    this.moodEngine.stop();
    this.renderer.destroy();
    this.statsBar.destroy();
    this.chatBubble.destroy();

    // Ensure overlay is in DOM
    if (this.overlay.el && !document.body.contains(this.overlay.el)) {
      document.body.appendChild(this.overlay.el);
    }

    // Init renderer with archetype + stage
    this.renderer.init(this.pengu.archetype, this.pengu.stage, this.overlay.getContainer());

    // Init stats bar (inside pengu element so it follows character)
    this.statsBar.init(this.pengu, this.renderer.el);

    // Init chat bubble (inside pengu element)
    this.chatBubble.init(this.pengu.archetype, this.renderer.el);

    // Bind hub modal
    this.hubModal.bind({
      pengu: this.pengu,
      save: this.save,
      questManager: this.questManager,
      onPurchase: (itemId) => this._purchaseItem(itemId),
      onClaimQuest: (questId) => this._claimQuest(questId),
      onFeed: () => this._feedPengu(),
      onReset: () => this._resetProgression(),
      onToggleOverlay: (visible) => {
        if (visible) this.overlay.show();
        else this.overlay.hide();
      },
      isOverlayVisible: this.overlay?.el?.style.display !== 'none',
    });

    // Start AI with personality
    this.ai.setArchetype(this.pengu.archetype);
    this.ai.setHunger(this.pengu.hunger);
    this.ai.start();

    // Start mood engine
    this.moodEngine.start(this.pengu);

    // Double-click to pet (distinct from drag)
    this.renderer.el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (this.ai._dragging) return;
      if (this.pengu.pet()) {
        this.bus.emit('pengu:pet');
        this.chatBubble.show('happy', null, 2000);
        this.questManager.track('pets');
        this.questManager.track('interactions');
        this._spawnParticle('❤️');
      }
    });

    // Right-click to open hub
    this.renderer.el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.hubModal.toggle();
      this.questManager.track('hubOpens');
    });

    // Hover to show stats
    this.renderer.el.addEventListener('mouseenter', () => this.statsBar.show());
    this.renderer.el.addEventListener('mouseleave', () => this.statsBar.hide());

    console.log('[PenguFamily] Pengu started:', this.pengu.name, this.pengu.archetype, this.pengu.stage);
  }

  _setupEventHandlers() {
    this.bus.on('game:end', ({ isWin, queueType, gameDuration }) => {
      if (!this.pengu) return;

      // Track quests
      this.questManager.track('gamesPlayed');

      if (isWin) {
        this.pengu.applyWin();
        const xp = this.save.xpBoostActive ? XP_PER_WIN * 2 : XP_PER_WIN;
        const { leveled, evolved } = this.pengu.addXP(xp);
        this.save.coins += COINS_PER_WIN;
        this.save.totalWins++;
        this.save.xpBoostActive = false; // consume boost

        this.questManager.track('wins');
        this.questManager.track('coinsEarned', COINS_PER_WIN);
        // Win streak
        this.save._winStreak = (this.save._winStreak || 0) + 1;
        this.questManager.track('winStreak', this.save._winStreak);
        this.chatBubble.show('excited', 'Victory!', 4000);

        if (evolved) {
          this._toast(`✨ ${this.pengu.name} evolved to ${this.pengu.stage}!`);
          this.chatBubble.show('excited', 'I evolved!', 5000);
          this.renderer.init(this.pengu.archetype, this.pengu.stage, this.overlay.getContainer());
        } else if (leveled) {
          this._toast(`🎉 ${this.pengu.name} reached Level ${this.pengu.level}!`);
          this.chatBubble.show('happy', `Level ${this.pengu.level}!`, 3000);
        }
        this.statsBar.updateLevel(this.pengu);
        this._toast(`Victory! +${xp} XP, +${COINS_PER_WIN} coins`);
      } else if (isWin === false) {
        this.pengu.applyLoss();
        const { evolved } = this.pengu.addXP(XP_PER_LOSS);
        this.save.coins += COINS_PER_LOSS;
        this.save.totalLosses++;
        this.questManager.track('coinsEarned', COINS_PER_LOSS);
        this.save._winStreak = 0; // reset streak
        this.chatBubble.show('sad', null, 3000);

        if (evolved) {
          this._toast(`✨ ${this.pengu.name} evolved to ${this.pengu.stage}!`);
          this.renderer.init(this.pengu.archetype, this.pengu.stage, this.overlay.getContainer());
        }
      }

      // Check quest completions
      const completed = this.questManager.getActive();
      this.save.quests = this.questManager.serialize();
      this.save.totalGamesTracked++;
      this.save.pengus[this.pengu.id] = this.pengu.serialize();
      this.saveManager.immediateSave(this._serializeSave());
    });
  }

  _resetProgression() {
    this.saveManager.nuke();
    // Reload the client so everything starts fresh
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  _feedPengu() {
    if (!this.pengu || this.save.snacks <= 0) {
      this._toast('No snacks left!');
      return;
    }
    this.pengu.feed();
    this.save.snacks--;
    this.bus.emit('pengu:feed');
    this.chatBubble.show('food', pickLine(ACTION_LINES.feed), 2000);
    this.questManager.track('feeds');
    this.questManager.track('interactions');
    this._spawnParticle('🍖');
    this._toast(`Fed ${this.pengu.name}! (${this.save.snacks} snacks left)`);
    this.save.pengus[this.pengu.id] = this.pengu.serialize();
    this.save.quests = this.questManager.serialize();
    this.saveManager.scheduleSave(this._serializeSave());
  }

  _purchaseItem(itemId) {
    const item = SHOP_ITEMS[itemId];
    if (!item || !this.pengu) return;
    if (this.save.coins < item.price) {
      this._toast('Not enough coins!');
      return;
    }

    this.save.coins -= item.price;

    if (item.effect.xpBoost) {
      this.save.xpBoostActive = true;
      this._toast(`${item.emoji} XP Boost activated! 2x XP next game`);
      this.chatBubble.show('excited', 'Power up!', 3000);
    } else if (item.effect.sleep) {
      if (this.ai.isSleeping) {
        this.save.coins += item.price;
        this._toast(`${this.pengu.name} is already sleeping!`);
        return;
      }
      const result = applyItem(this.pengu, itemId);
      if (result) {
        this.renderer.play('sleep');
        this.chatBubble.show('sleepy', 'Goodnight... zzZ~', 4000);
        this._toast(`${item.emoji} ${this.pengu.name} is sleeping for 30 min!`);
        this.ai.startSleep(item.effect.sleepDuration);
      }
    } else {
      const result = applyItem(this.pengu, itemId);
      if (result) {
        this.renderer.play(result.animation);
        this.chatBubble.show(result.bubble, result.changes.join(', '), 3000);
        this._toast(`${item.emoji} Used ${item.name}! ${result.changes.join(', ')}`);
      }
    }

    this.questManager.track('shopUses');
    this.questManager.track('interactions');
    this.save.pengus[this.pengu.id] = this.pengu.serialize();
    this.save.quests = this.questManager.serialize();
    this.saveManager.immediateSave(this._serializeSave());
  }

  _claimQuest(questId) {
    const reward = this.questManager.claim(questId);
    if (!reward) return;

    this.save.coins += reward.coins;
    const { leveled, evolved } = this.pengu.addXP(reward.xp);

    this.chatBubble.show('happy', `+${reward.xp} XP, +${reward.coins} coins`, 3000);
    this._toast(`Quest complete! +${reward.xp} XP, +${reward.coins} coins`);

    if (evolved) {
      this._toast(`✨ ${this.pengu.name} evolved to ${this.pengu.stage}!`);
      this.renderer.init(this.pengu.archetype, this.pengu.stage, this.overlay.getContainer());
    } else if (leveled) {
      this._toast(`🎉 ${this.pengu.name} reached Level ${this.pengu.level}!`);
    }

    this.statsBar.updateLevel(this.pengu);
    this.save.quests = this.questManager.serialize();
    this.save.pengus[this.pengu.id] = this.pengu.serialize();
    this.saveManager.immediateSave(this._serializeSave());
  }

  _serializeSave() {
    if (this.pengu) {
      this.save.pengus[this.pengu.id] = this.pengu.serialize();
    }
    this.save.quests = this.questManager.serialize();
    return { ...this.save };
  }

  _toast(msg) {
    try {
      if (window.Toast?.success) {
        window.Toast.success(msg);
      } else {
        console.log(`[PenguFamily] ${msg}`);
      }
    } catch {}
  }

  // ── Auto-Bubble System ──

  _setupBubbleSystem() {
    // Idle chatter (random lines every 30-90s)
    this.bus.on('pengu:chatter', () => {
      if (!this.pengu) return;
      const line = pickLine(IDLE_LINES, this.pengu.archetype);
      if (line) this.chatBubble.show('normal', line, 3000);
    });

    // Phase reactions
    this.bus.on('pengu:phase_react', ({ phase }) => {
      if (!this.pengu) return;
      if (phase === 'EndOfGame') return; // handled by game:end
      const lines = PHASE_LINES[phase];
      if (lines) {
        const line = pickLine(lines);
        if (line) {
          const bubble = phase === 'ReadyCheck' ? 'excited' : 'normal';
          this.chatBubble.show(bubble, line, 3500);
        }
      }
    });

    // Mood reactions
    this.bus.on('pengu:mood_react', ({ mood }) => {
      if (!this.pengu) return;
      const line = pickLine(MOOD_LINES[mood] || []);
      if (line) {
        const bubble = mood === 'sad' || mood === 'miserable' ? 'sad' : 'happy';
        this.chatBubble.show(bubble, line, 3000);
      }
      // Track "Keep Pengu Happy" quest
      if (mood === 'happy' || mood === 'ecstatic') {
        this.questManager.track('moodHappy');
      }
    });

    // Mouse reactions
    this.bus.on('pengu:mouse', ({ type }) => {
      const lines = MOUSE_LINES[type];
      if (lines) {
        const line = pickLine(lines);
        const bubble = type === 'flee' ? 'excited' : 'happy';
        if (line) this.chatBubble.show(bubble, line, 2000);
      }
    });

    // Fast drag reaction
    this.bus.on('pengu:fast_drag', () => {
      const arch = this.pengu?.archetype;
      const line = pickLine(FAST_DRAG_LINES, arch);
      if (line) this.chatBubble.show('excited', line, 2500);
    });

    // Drag reactions (no quest credit — just cosmetic)
    this.bus.on('pengu:dragged', ({ reaction, duration }) => {
      const lines = DRAG_LINES[reaction];
      if (lines) {
        const line = pickLine(lines);
        const bubble = (reaction === 'hate' || reaction === 'offended') ? 'angry' : 'happy';
        if (line) this.chatBubble.show(bubble, line, 3000);
      }
    });

    // Wake up reaction
    this.bus.on('pengu:woke_up', () => {
      this.chatBubble.show('happy', '*yawns* Good morning!', 3000);
      this._spawnParticle('☀️');
    });

    // Hungry behavior reactions
    this.bus.on('pengu:hungry_act', ({ behavior }) => {
      const lines = HUNGRY_ACT_LINES[behavior];
      if (lines) {
        const line = pickLine(lines);
        if (line) this.chatBubble.show('food', line, 3500);
      }
    });

    // Hunger/Energy status alerts (on stat updates)
    this.bus.on('pengu:stats', () => {
      if (!this.pengu) return;
      if (this.pengu.hunger < 15) {
        const line = pickLine(HUNGER_LINES.critical);
        if (line) this.chatBubble.show('food', line, 4000);
      } else if (this.pengu.hunger < 30) {
        if (Math.random() < 0.15) {
          const line = pickLine(HUNGER_LINES.low);
          if (line) this.chatBubble.show('food', line, 3000);
        }
      }
      if (this.pengu.energy < 15) {
        const line = pickLine(ENERGY_LINES.critical);
        if (line) this.chatBubble.show('sleepy', line, 4000);
      } else if (this.pengu.energy < 30) {
        if (Math.random() < 0.15) {
          const line = pickLine(ENERGY_LINES.low);
          if (line) this.chatBubble.show('sleepy', line, 3000);
        }
      }
    });

    // Champ select — pengu suggests picks
    this.bus.on('champselect:suggest', () => {
      const arch = this.pengu?.archetype;
      const line = pickLine(CHAMPSELECT_LINES.suggest, arch);
      if (line) this.chatBubble.show('excited', line, 4000);
    });

    // Champ select — react to our pick
    this.bus.on('champselect:pick', ({ isLocal, isAlly }) => {
      const arch = this.pengu?.archetype;
      if (isLocal) {
        const line = pickLine(CHAMPSELECT_LINES.our_pick, arch);
        if (line) this.chatBubble.show('happy', line, 3000);
      } else if (isAlly) {
        if (Math.random() < 0.5) {
          const line = pickLine(CHAMPSELECT_LINES.ally_pick, arch);
          if (line) this.chatBubble.show('happy', line, 3000);
        }
      }
    });

    // Champ select — react to bans
    this.bus.on('champselect:ban', ({ isLocal }) => {
      if (Math.random() < (isLocal ? 0.6 : 0.3)) {
        const arch = this.pengu?.archetype;
        const line = pickLine(CHAMPSELECT_LINES.ban, arch);
        if (line) this.chatBubble.show('excited', line, 2500);
      }
    });

    // Lobby — someone joined
    this.bus.on('lobby:member_join', () => {
      const arch = this.pengu?.archetype;
      const line = pickLine(LOBBY_LINES.member_join, arch);
      if (line) this.chatBubble.show('happy', line, 3000);
    });
  }

  _spawnParticle(emoji) {
    if (!this.renderer.el) return;
    const p = document.createElement('div');
    p.className = 'pengu-particle';
    p.textContent = emoji;
    p.style.left = `${this.ai.x + 40}px`;
    p.style.top = `${this.ai.y}px`;
    this.overlay.getContainer().appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}
