import { SAVE_PREFIX, VERSION, SETTINGS_KEY } from '../data/config.js';

export class SaveManager {
  constructor(bus) {
    this.bus = bus;
    this.puuid = null;
    this._saveTimer = null;
  }

  get _ds() {
    return window.DataStore;
  }

  get _key() {
    return `${SAVE_PREFIX}.${this.puuid}`;
  }

  get _backupKey() {
    return `${this._key}.backup`;
  }

  setPuuid(puuid) {
    this.puuid = puuid;
  }

  load() {
    if (!this.puuid || !this._ds) return null;
    try {
      const raw = this._ds.get(this._key);
      if (!raw) return null;
      const save = JSON.parse(raw);
      if (save.version !== VERSION) {
        return this._migrate(save);
      }
      return save;
    } catch (e) {
      console.warn('[SaveManager] Corrupt save, trying backup...', e);
      return this._loadBackup();
    }
  }

  save(data) {
    if (!this.puuid || !this._ds) return;
    data.version = VERSION;
    data.lastLoginAt = Date.now();

    // Backup current before overwrite
    const current = this._ds.get(this._key);
    if (current) {
      this._ds.set(this._backupKey, current);
    }

    this._ds.set(this._key, JSON.stringify(data));
  }

  scheduleSave(data, delay = 2000) {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this.save(data);
      this._saveTimer = null;
    }, delay);
  }

  immediateSave(data) {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this.save(data);
  }

  loadSettings() {
    if (!this._ds) return {};
    try {
      const raw = this._ds.get(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  saveSettings(settings) {
    if (!this._ds) return;
    this._ds.set(SETTINGS_KEY, JSON.stringify(settings));
  }

  _loadBackup() {
    try {
      const raw = this._ds.get(this._backupKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('[SaveManager] Backup also corrupt:', e);
      return null;
    }
  }

  _migrate(save) {
    // Future: handle version migrations
    save.version = VERSION;
    return save;
  }

  /**
   * Nuke all save data for the current user.
   */
  nuke() {
    if (!this.puuid || !this._ds) return;
    this._ds.remove(this._key);
    this._ds.remove(this._backupKey);
  }

  createFreshSave(puuid, gameName, tagLine) {
    return {
      version: VERSION,
      puuid,
      gameName: gameName || 'Summoner',
      tagLine: tagLine || '',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      activePenguId: null,
      coins: 0,
      snacks: 3,
      totalGamesTracked: 0,
      totalWins: 0,
      totalLosses: 0,
      settings: {
        overlayEnabled: true,
        soundEnabled: false,
      },
      pengus: {},
      quests: { daily: [], weekly: [] },
      inventory: [],
    };
  }
}
