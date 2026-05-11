import { LCU } from './LCU.js';

export class GameTracker {
  constructor(bus) {
    this.bus = bus;
    this.currentPhase = 'None';
    this.gameStartTime = null;
    this._subs = [];
    this._lastLobbySize = 0;
    this._lastChampActions = new Set();
    this._localCellId = -1;
    this._champSelectActive = false;
    this._lastGameEndTime = 0;
  }

  start() {
    // socket.observe returns { disconnect() } per Pengu Loader API
    this._subs.push(
      LCU.observe('/lol-gameflow/v1/gameflow-phase', (event) => {
        this._onPhaseChange(event.data);
      }),
      LCU.observe('/lol-end-of-game/v1/eog-stats-block', (event) => {
        if (event.eventType === 'Create' || event.eventType === 'Update') {
          this._onGameEnd(event.data);
        }
      }),
      LCU.observe('/lol-champ-select/v1/session', (event) => {
        if (event.eventType === 'Delete') {
          this._champSelectActive = false;
          this._lastChampActions.clear();
          return;
        }
        this._onChampSelectUpdate(event.data);
      }),
      LCU.observe('/lol-lobby/v2/lobby', (event) => {
        if (event.eventType === 'Delete') {
          this._lastLobbySize = 0;
          return;
        }
        this._onLobbyUpdate(event.data);
      }),
    );

    this._fetchInitialPhase();
  }

  stop() {
    this._subs.forEach(sub => sub?.disconnect());
    this._subs = [];
    if (this._suggestTimer) clearTimeout(this._suggestTimer);
    this._suggestTimer = null;
  }

  async _fetchInitialPhase() {
    try {
      const res = await fetch('/lol-gameflow/v1/gameflow-phase');
      if (res.ok) this._onPhaseChange(await res.json());
    } catch {}
  }

  _onPhaseChange(phase) {
    if (phase === this.currentPhase) return;
    const prev = this.currentPhase;
    this.currentPhase = phase;

    console.log(`[GameTracker] Phase: ${prev} → ${phase}`);

    if (phase === 'InProgress' && prev !== 'InProgress') {
      this.gameStartTime = Date.now();
    }

    this.bus.emit('phase:change', { phase, prev });

    switch (phase) {
      case 'Lobby':
        this.bus.emit('game:lobby');
        break;
      case 'Matchmaking':
        this.bus.emit('game:matchmaking');
        break;
      case 'ReadyCheck':
        this.bus.emit('game:readycheck');
        break;
      case 'ChampSelect':
        this.bus.emit('game:champselect');
        break;
      case 'InProgress':
        this.bus.emit('game:started');
        break;
      case 'WaitingForStats':
      case 'PreEndOfGame':
        this.bus.emit('game:waiting');
        break;
      case 'EndOfGame':
        this._processEndOfGame();
        break;
    }
  }

  async _processEndOfGame() {
    try {
      const res = await fetch('/lol-end-of-game/v1/eog-stats-block');
      if (res.ok) this._onGameEnd(await res.json());
    } catch (e) {
      console.warn('[GameTracker] Failed to fetch EOG stats:', e);
      this.bus.emit('game:end', { isWin: null, queueType: null, gameDuration: 0 });
    }
  }

  _onGameEnd(stats) {
    if (!stats) return;

    // Prevent double-firing (WS observer + phase change both call this)
    const now = Date.now();
    if (now - this._lastGameEndTime < 30000) return;
    this._lastGameEndTime = now;

    const isWin = stats.localPlayer?.stats?.WIN === '1' ||
                  stats.localPlayer?.stats?.WIN === 1 ||
                  stats.gameResult === 'Win';
    const queueType = stats.queueType || 'UNKNOWN';
    const gameDuration = stats.gameLength || 0;

    // Skip remakes / very short games
    if (gameDuration > 0 && gameDuration < 300) {
      console.log('[GameTracker] Skipping short game (<5 min)');
      return;
    }

    console.log(`[GameTracker] Game ended — ${isWin ? 'WIN' : 'LOSS'}, ${queueType}, ${gameDuration}s`);
    this.bus.emit('game:end', { isWin, queueType, gameDuration });
  }

  // ── Champ Select ──

  _onChampSelectUpdate(session) {
    if (!session) return;
    this._champSelectActive = true;

    // Find our cellId
    const localCellId = session.localPlayerCellId;
    if (localCellId !== undefined) this._localCellId = localCellId;

    // Flatten all actions into a list
    const allActions = (session.actions || []).flat();

    for (const action of allActions) {
      if (!action.championId || action.championId === 0) continue;
      const key = `${action.actorCellId}-${action.type}-${action.championId}-${action.completed}`;
      if (this._lastChampActions.has(key)) continue;
      this._lastChampActions.add(key);

      const isLocal = action.actorCellId === this._localCellId;
      const isAlly = this._isAllySeat(session, action.actorCellId);

      if (action.type === 'ban' && action.completed) {
        // A champion was banned
        this.bus.emit('champselect:ban', {
          championId: action.championId,
          isLocal,
          isAlly,
        });
      } else if (action.type === 'pick' && action.completed) {
        // A champion was picked
        this.bus.emit('champselect:pick', {
          championId: action.championId,
          isLocal,
          isAlly,
        });
      }
    }

    // Suggest a random pick/ban occasionally (pengu "recommends")
    if (!this._suggestTimer && this._champSelectActive) {
      this._suggestTimer = setTimeout(() => {
        this._suggestTimer = null;
        if (this._champSelectActive) {
          this.bus.emit('champselect:suggest');
        }
      }, 4000 + Math.random() * 8000);
    }
  }

  _isAllySeat(session, cellId) {
    const myTeam = (session.myTeam || []).map(m => m.cellId);
    return myTeam.includes(cellId);
  }

  // ── Lobby ──

  _onLobbyUpdate(lobby) {
    if (!lobby) return;
    const members = lobby.members || [];
    const size = members.length;

    if (size > this._lastLobbySize && this._lastLobbySize > 0) {
      // Someone new joined
      this.bus.emit('lobby:member_join', { count: size });
    }

    this._lastLobbySize = size;
  }
}
