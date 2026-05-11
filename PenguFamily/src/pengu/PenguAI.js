import { WANDER_MIN_INTERVAL, WANDER_MAX_INTERVAL, MOVE_SPEED, EDGE_MARGIN, PENGU_SIZE } from '../data/config.js';
import { ARCHETYPES } from '../data/archetypes.js';

// Points of interest — named screen regions pengu can wander to
const POI = {
  taskbar:     () => ({ x: window.innerWidth / 2, y: window.innerHeight - 30 }),
  topLeft:     () => ({ x: 80, y: 80 }),
  topRight:    () => ({ x: window.innerWidth - 160, y: 80 }),
  bottomLeft:  () => ({ x: 80, y: window.innerHeight - PENGU_SIZE - 30 }),
  bottomRight: () => ({ x: window.innerWidth - 160, y: window.innerHeight - PENGU_SIZE - 30 }),
  center:      () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
  sidebar:     () => ({ x: 30, y: window.innerHeight / 2 }),
  playButton:  () => ({ x: window.innerWidth / 2, y: window.innerHeight - 100 }),
};
const POI_KEYS = Object.keys(POI);

// Mouse interaction thresholds
const MOUSE_NOTICE_DIST = 200;
const MOUSE_CLOSE_DIST = 80;
const MOUSE_COOLDOWN = 5000;

export class PenguAI {
  constructor(bus, renderer) {
    this.bus = bus;
    this.renderer = renderer;

    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.state = 'idle';
    this.paused = false;
    this.phase = 'None';

    this._archetype = null;
    this._traits = null;
    this._hunger = 100;

    this._wanderTimer = null;
    this._moveRAF = null;
    this._moodSpeedMult = 1;

    // Mouse tracking
    this._mouseX = -1;
    this._mouseY = -1;
    this._lastMouseReaction = 0;
    this._mouseHandler = (e) => { this._mouseX = e.clientX; this._mouseY = e.clientY; };

    this._chatterTimer = null;
    this._visitedPOI = new Set();
    this._poiTimer = null;
    this._hungryTimer = null;

    // Drag state
    this._dragging = false;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._dragStartTime = 0;
    this._velocityX = 0;
    this._velocityY = 0;
    this._lastDragX = 0;
    this._lastDragY = 0;
    this._lastDragTime = 0;
    this._flingRAF = null;
    this._fastDragEmitted = false;
    this._onDragStart = (e) => this._handleDragStart(e);
    this._onDragMove = (e) => this._handleDragMove(e);
    this._onDragEnd = (e) => this._handleDragEnd(e);
  }

  setArchetype(archetype) {
    this._archetype = archetype;
    this._traits = ARCHETYPES[archetype] || {};
  }

  setHunger(hunger) {
    this._hunger = hunger;
  }

  startSleep(duration) {
    this.state = 'sleeping';
    this.paused = true;
    this.renderer.play('sleep');
    this.renderer.el.style.cursor = 'default';

    if (this._sleepTimer) clearTimeout(this._sleepTimer);
    this._sleepWakeAt = Date.now() + duration;
    this._sleepTimer = setTimeout(() => this._wakeUp(), duration);

    console.log(`[PenguAI] Sleeping for ${Math.round(duration / 60000)} min`);
  }

  _wakeUp() {
    if (this._sleepTimer) clearTimeout(this._sleepTimer);
    this._sleepTimer = null;
    this._sleepWakeAt = 0;

    this.state = 'idle';
    this.paused = false;
    this.renderer.play('idle');
    this.renderer.el.style.cursor = 'grab';

    this.bus.emit('pengu:woke_up');
    console.log('[PenguAI] Woke up!');
  }

  get isSleeping() {
    return this.state === 'sleeping';
  }

  get sleepTimeLeft() {
    if (!this._sleepWakeAt) return 0;
    return Math.max(0, this._sleepWakeAt - Date.now());
  }

  start() {
    this.x = window.innerWidth - 200;
    this.y = window.innerHeight - PENGU_SIZE - 80;
    this.renderer.setPosition(this.x, this.y);

    this._scheduleWander();
    this._startMoveLoop();
    this._startMouseTracking();
    this._initDrag();
    this._scheduleChatter();
    this._schedulePOI();
    this._scheduleHungryCheck();

    this.bus.on('phase:change', (e) => this._onPhaseChange(e));
    this.bus.on('game:end', (e) => this._onGameEnd(e));
    this.bus.on('pengu:mood', (e) => this._onMoodChange(e));
    this.bus.on('pengu:pet', () => this._onPet());
    this.bus.on('pengu:feed', () => this._onFeed());
    this.bus.on('sprite:animend', (e) => this._onAnimEnd(e));
  }

  stop() {
    if (this._wanderTimer) clearTimeout(this._wanderTimer);
    this._wanderTimer = null;
    if (this._moveRAF) cancelAnimationFrame(this._moveRAF);
    this._moveRAF = null;
    if (this._chatterTimer) clearTimeout(this._chatterTimer);
    this._chatterTimer = null;
    if (this._poiTimer) clearTimeout(this._poiTimer);
    this._poiTimer = null;
    if (this._hungryTimer) clearTimeout(this._hungryTimer);
    this._hungryTimer = null;

    document.removeEventListener('mousemove', this._mouseHandler);
    this._cleanupDrag();
    if (this._flingRAF) {
      cancelAnimationFrame(this._flingRAF);
      this._flingRAF = null;
    }
    if (this._sleepTimer) {
      clearTimeout(this._sleepTimer);
      this._sleepTimer = null;
    }

    this.state = 'idle';
    this.paused = false;
  }

  // ── Drag ──

  _initDrag() {
    const el = this.renderer.el;
    if (!el) return;
    el.style.cursor = 'grab';
    el.addEventListener('mousedown', this._onDragStart);
  }

  _cleanupDrag() {
    const el = this.renderer.el;
    if (el) el.removeEventListener('mousedown', this._onDragStart);
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);
  }

  _handleDragStart(e) {
    if (this.state === 'sleeping') return;
    e.preventDefault();
    e.stopPropagation();

    // Cancel any ongoing fling
    if (this._flingRAF) {
      cancelAnimationFrame(this._flingRAF);
      this._flingRAF = null;
    }

    this._dragging = true;
    this._dragStartTime = Date.now();
    this._dragOffsetX = e.clientX - this.x;
    this._dragOffsetY = e.clientY - this.y;
    this._velocityX = 0;
    this._velocityY = 0;
    this._lastDragX = e.clientX;
    this._lastDragY = e.clientY;
    this._lastDragTime = Date.now();
    this._fastDragEmitted = false;

    // Pause normal AI while dragging
    this.state = 'dragging';
    this.renderer.el.style.cursor = 'grabbing';

    document.addEventListener('mousemove', this._onDragMove);
    document.addEventListener('mouseup', this._onDragEnd);

    this.bus.emit('pengu:drag_start');
  }

  _handleDragMove(e) {
    if (!this._dragging) return;
    const now = Date.now();
    const dt = now - this._lastDragTime;

    this.x = e.clientX - this._dragOffsetX;
    this.y = e.clientY - this._dragOffsetY;

    // Keep in bounds
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.x = Math.max(0, Math.min(w - PENGU_SIZE, this.x));
    this.y = Math.max(0, Math.min(h - PENGU_SIZE, this.y));

    this.renderer.setPosition(this.x, this.y);

    // Track velocity for fling
    if (dt > 0) {
      const dx = e.clientX - this._lastDragX;
      const dy = e.clientY - this._lastDragY;
      // Smooth velocity with exponential moving average
      this._velocityX = 0.7 * this._velocityX + 0.3 * (dx / dt) * 16;
      this._velocityY = 0.7 * this._velocityY + 0.3 * (dy / dt) * 16;
    }

    this._lastDragX = e.clientX;
    this._lastDragY = e.clientY;
    this._lastDragTime = now;

    // Face direction of drag
    if (e.movementX !== 0) {
      this.renderer.setDirection(e.movementX < 0 ? 'left' : 'right');
    }

    // Detect fast dragging
    const speed = Math.sqrt(this._velocityX ** 2 + this._velocityY ** 2);
    if (speed > 12 && !this._fastDragEmitted) {
      this._fastDragEmitted = true;
      this.bus.emit('pengu:fast_drag');
    }
  }

  _handleDragEnd(e) {
    if (!this._dragging) return;
    this._dragging = false;

    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);

    this.renderer.el.style.cursor = 'grab';

    const dragDuration = Date.now() - this._dragStartTime;
    const speed = Math.sqrt(this._velocityX ** 2 + this._velocityY ** 2);

    // Fling if released with speed
    if (speed > 3) {
      this.state = 'flinging';
      this._startFling();
    } else {
      this.state = 'idle';
      this.renderer.play('idle');
    }

    // Only emit drag reaction if it was a real drag (not a quick click)
    if (dragDuration > 300) {
      this.bus.emit('pengu:dragged', {
        reaction: this._traits?.dragReaction || 'enjoy',
        duration: dragDuration,
        flingSpeed: speed,
      });
    }

    // Set target to current position so AI doesn't snap back
    this.targetX = this.x;
    this.targetY = this.y;
  }

  _startFling() {
    const friction = 0.92;
    const bounce = -0.5;
    const minSpeed = 0.5;

    const flingTick = () => {
      this._velocityX *= friction;
      this._velocityY *= friction;

      this.x += this._velocityX;
      this.y += this._velocityY;

      // Bounce off edges
      const w = window.innerWidth - PENGU_SIZE;
      const h = window.innerHeight - PENGU_SIZE;

      if (this.x <= 0) { this.x = 0; this._velocityX *= bounce; }
      else if (this.x >= w) { this.x = w; this._velocityX *= bounce; }

      if (this.y <= 0) { this.y = 0; this._velocityY *= bounce; }
      else if (this.y >= h) { this.y = h; this._velocityY *= bounce; }

      this.renderer.setPosition(this.x, this.y);

      // Face direction of fling
      if (Math.abs(this._velocityX) > 0.5) {
        this.renderer.setDirection(this._velocityX < 0 ? 'left' : 'right');
      }

      const speed = Math.sqrt(this._velocityX ** 2 + this._velocityY ** 2);
      if (speed > minSpeed) {
        this._flingRAF = requestAnimationFrame(flingTick);
      } else {
        this._flingRAF = null;
        this.state = 'idle';
        this.renderer.play('idle');
        this.targetX = this.x;
        this.targetY = this.y;
      }
    };

    this._flingRAF = requestAnimationFrame(flingTick);
  }

  // ── Mouse Awareness (personality-driven) ──

  _startMouseTracking() {
    document.addEventListener('mousemove', this._mouseHandler);
  }

  _checkMouseProximity() {
    if (this._mouseX < 0 || this.paused || this._dragging) return;
    if (this.state === 'reacting' || this.state === 'sleeping') return;

    const now = Date.now();
    if (now - this._lastMouseReaction < MOUSE_COOLDOWN) return;

    const dx = this._mouseX - (this.x + PENGU_SIZE / 2);
    const dy = this._mouseY - (this.y + PENGU_SIZE / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Face toward mouse when noticed (except 'ignore' types)
    const reaction = this._traits?.mouseReaction || 'flee';
    if (dist < MOUSE_NOTICE_DIST && this.state === 'idle' && reaction !== 'ignore') {
      this.renderer.setDirection(dx < 0 ? 'left' : 'right');
    }

    // React when mouse gets close
    if (dist < MOUSE_CLOSE_DIST && (this.state === 'idle' || this.state === 'walking')) {
      this._lastMouseReaction = now;

      // Determine flee vs follow based on personality
      const fleeChance = this._traits?.mouseFleeChance ?? 0.7;
      let shouldFlee;

      switch (reaction) {
        case 'chase':   shouldFlee = Math.random() < fleeChance; break;
        case 'follow':  shouldFlee = Math.random() < fleeChance; break;
        case 'flee':    shouldFlee = Math.random() < fleeChance; break;
        case 'random':  shouldFlee = Math.random() < 0.5; break;
        case 'ignore':  return; // royal dignity — don't react
        default:        shouldFlee = Math.random() < 0.7;
      }

      if (!shouldFlee) {
        // Follow / chase cursor
        this.targetX = this._mouseX - PENGU_SIZE / 2;
        this.targetY = this._mouseY - PENGU_SIZE / 2;
        this._clampTarget();
        this.state = 'walking';
        this.renderer.play('walk');
        this.bus.emit('pengu:mouse', { type: 'follow' });
      } else {
        // Flee from cursor
        this.targetX = this.x - dx * 2;
        this.targetY = this.y - dy * 2;
        this._clampTarget();
        this.state = 'walking';
        this._moodSpeedMult = Math.max(this._moodSpeedMult, 1.5);
        this.renderer.play('walk');
        this.bus.emit('pengu:mouse', { type: 'flee' });
        setTimeout(() => {
          if (this._moodSpeedMult > 1.3) this._moodSpeedMult = 1.0;
        }, 1500);
      }
    }
  }

  // ── Hungry Behavior ──

  _scheduleHungryCheck() {
    this._hungryTimer = setTimeout(() => {
      this._doHungryBehavior();
      this._scheduleHungryCheck();
    }, 15000 + Math.random() * 15000); // check every 15-30s
  }

  _doHungryBehavior() {
    if (this.paused || this.state !== 'idle') return;
    if (this._hunger > 25) return; // only act when hungry

    const behavior = this._traits?.hungryBehavior || 'beg';
    this.bus.emit('pengu:hungry_act', { behavior });

    switch (behavior) {
      case 'nudge':
        // Windblade: rush to a random POI and "push" it
        this._visitPOI();
        this.bus.emit('pengu:chatter');
        break;

      case 'sulk':
        // Shadow: go to a corner and sit
        this.targetX = 30;
        this.targetY = window.innerHeight - PENGU_SIZE - 30;
        this._clampTarget();
        this.state = 'walking';
        this.renderer.play('walk');
        break;

      case 'beg':
        // Starlight: follow cursor and beg
        if (this._mouseX > 0) {
          this.targetX = this._mouseX - PENGU_SIZE / 2;
          this.targetY = this._mouseY - PENGU_SIZE / 2;
          this._clampTarget();
          this.state = 'walking';
          this.renderer.play('walk');
        }
        break;

      case 'tantrum':
        // Chaos: zip to random spots rapidly
        this._pickWanderTarget();
        this.state = 'walking';
        this._moodSpeedMult = Math.max(this._moodSpeedMult, 2.0);
        this.renderer.play('walk');
        setTimeout(() => {
          this._moodSpeedMult = Math.max(1.0, this._moodSpeedMult - 1.0);
        }, 2000);
        break;

      case 'demand':
        // Royal: stop walking and play alert animation
        this.state = 'idle';
        this._react('alert');
        break;
    }
  }

  // ── POI / Environment Awareness ──

  _schedulePOI() {
    const delay = 20000 + Math.random() * 40000;
    this._poiTimer = setTimeout(() => {
      if (!this.paused && this.state === 'idle' && this.phase !== 'InProgress') {
        this._visitPOI();
      }
      this._schedulePOI();
    }, delay);
  }

  _visitPOI() {
    const available = POI_KEYS.filter(k => !this._visitedPOI.has(k));
    const pool = available.length > 0 ? available : POI_KEYS;
    const key = pool[Math.floor(Math.random() * pool.length)];

    this._visitedPOI.add(key);
    if (this._visitedPOI.size > 4) {
      const arr = [...this._visitedPOI];
      this._visitedPOI = new Set(arr.slice(-3));
    }

    const pos = POI[key]();
    this.targetX = pos.x;
    this.targetY = pos.y;
    this._clampTarget();
    this.state = 'walking';
    this.renderer.play('walk');
    this.bus.emit('pengu:poi', { poi: key });
  }

  // ── Idle Chatter ──

  _scheduleChatter() {
    const delay = 30000 + Math.random() * 60000;
    this._chatterTimer = setTimeout(() => {
      if (!this.paused && this.state !== 'sleeping') {
        this.bus.emit('pengu:chatter');
      }
      this._scheduleChatter();
    }, delay);
  }

  // ── Wander ──

  _scheduleWander() {
    const delay = WANDER_MIN_INTERVAL + Math.random() * (WANDER_MAX_INTERVAL - WANDER_MIN_INTERVAL);
    this._wanderTimer = setTimeout(() => {
      if (!this.paused && this.state === 'idle') {
        this._pickWanderTarget();
        this.state = 'walking';
        this.renderer.play('walk');
      }
      this._scheduleWander();
    }, delay);
  }

  _pickWanderTarget() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.targetX = EDGE_MARGIN + Math.random() * (w - EDGE_MARGIN * 2 - PENGU_SIZE);
    this.targetY = EDGE_MARGIN + Math.random() * (h - EDGE_MARGIN * 2 - PENGU_SIZE);
  }

  _clampTarget() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.targetX = Math.max(EDGE_MARGIN, Math.min(w - PENGU_SIZE - EDGE_MARGIN, this.targetX));
    this.targetY = Math.max(EDGE_MARGIN, Math.min(h - PENGU_SIZE - EDGE_MARGIN, this.targetY));
  }

  // ── Movement Loop ──

  _startMoveLoop() {
    const tick = () => {
      this._moveRAF = requestAnimationFrame(tick);

      this._checkMouseProximity();

      if (this.paused || this._dragging || this.state === 'flinging' || this.state !== 'walking') return;

      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 3) {
        this.state = 'idle';
        this.renderer.play('idle');
        return;
      }

      const baseSpeed = MOVE_SPEED * (this._traits?.wanderSpeed || 1.0);
      const speed = baseSpeed * this._moodSpeedMult;
      const nx = dx / dist;
      const ny = dy / dist;

      this.x += nx * speed;
      this.y += ny * speed;

      this.renderer.setPosition(this.x, this.y);
      this.renderer.setDirection(dx < 0 ? 'left' : 'right');
    };
    tick();
  }

  // ── Reactions ──

  _react(animName) {
    this.state = 'reacting';
    this.renderer.play(animName);
    this.bus.once('sprite:animend', () => {
      if (this.state === 'reacting') {
        this.state = 'idle';
        this.renderer.play('idle');
      }
    });
  }

  _onPhaseChange({ phase }) {
    this.phase = phase;

    switch (phase) {
      case 'Lobby':
        if (this.state === 'sleeping') {
          this.paused = false;
          this.state = 'idle';
          this.renderer.play('idle');
        }
        this.targetX = window.innerWidth / 2 - PENGU_SIZE / 2;
        this.targetY = window.innerHeight - PENGU_SIZE - 100;
        this._clampTarget();
        this.state = 'walking';
        this.renderer.play('walk');
        break;
      case 'Matchmaking':
        this._react('alert');
        break;
      case 'ReadyCheck':
        this._react('ready');
        this.targetX = window.innerWidth / 2;
        this.targetY = window.innerHeight - 120;
        this._clampTarget();
        break;
      case 'ChampSelect':
        this.targetX = window.innerWidth - PENGU_SIZE - 20;
        this.targetY = window.innerHeight / 2;
        this._clampTarget();
        this.state = 'walking';
        this.renderer.play('walk');
        break;
      case 'InProgress':
        this.state = 'sleeping';
        this.paused = true;
        this.renderer.play('sleep');
        break;
      case 'EndOfGame':
        if (this.state === 'sleeping') {
          this.paused = false;
          this.state = 'idle';
          this.renderer.play('idle');
        }
        break;
    }

    this.bus.emit('pengu:phase_react', { phase });
  }

  _onGameEnd({ isWin }) {
    this.paused = false;
    if (isWin) {
      this._react('celebrate');
    } else {
      this._react('sad');
    }
  }

  _onMoodChange({ mood }) {
    switch (mood) {
      case 'ecstatic': this._moodSpeedMult = 1.3; break;
      case 'happy':    this._moodSpeedMult = 1.0; break;
      case 'neutral':  this._moodSpeedMult = 0.8; break;
      case 'sad':      this._moodSpeedMult = 0.6; break;
      case 'miserable': this._moodSpeedMult = 0.4; break;
    }
    this.bus.emit('pengu:mood_react', { mood });
  }

  _onPet() {
    this._react('pet');
  }

  _onFeed() {
    this._hunger = 100;
    this._react('eat');
  }

  _onAnimEnd({ anim }) {
    // Handled in _react
  }
}
