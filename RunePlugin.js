/**
 * @name RunePlugin
 * @author Yimikami
 * @description Fetches optimal runes and item sets based on U.GG and Lolalytics data
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.4
 */

import { settingsUtils } from "https://unpkg.com/blank-settings-utils@latest/Settings-Utils.js";

let data = [
  {
    groupName: "rune-plugin",
    titleKey: "el_rune_plugin",
    titleName: "Rune Plugin",
    capitalTitleKey: "el_rune_plugin_capital",
    capitalTitleName: "RUNE PLUGIN",
    element: [
      {
        name: "rune-plugin-settings",
        title: "el_rune_plugin_settings",
        titleName: "RUNE PLUGIN SETTINGS",
        class: "rune-plugin-settings",
        id: "runePluginSettings",
      },
    ],
  },
];

const PROVIDERS = {
  LOLALYTICS: "lolalytics",
  UGG: "ugg",
};

const DEFAULT_CONFIG = {
  retryAttempts: 3,
  retryDelay: 1000,
  selectedProvider: PROVIDERS.LOLALYTICS,
  debug: false,
  logPrefix: "[Rune Plugin]",
  endpoints: {
    championSummary: "/lol-game-data/assets/v1/champion-summary.json",
    gamePhase: "/lol-gameflow/v1/gameflow-phase",
    champSelect: "/lol-champ-select/v1/session",
    perksPage: "/lol-perks/v1/pages",
    currentPage: "/lol-perks/v1/currentpage",
    versions: "https://ddragon.leagueoflegends.com/api/versions.json",
    itemSets: "/lol-item-sets/v1/item-sets",
    currentSummoner: "/lol-summoner/v1/current-summoner",
    gameflowSession: "/lol-gameflow/v1/session",
  },
  displayNames: {
    top: "Top",
    jungle: "Jungle",
    middle: "Middle",
    bottom: "ADC",
    support: "Support",
    utility: "Support",
  },
  itemSets: {
    minGames: 1000, // Minimum games for winrate calculations
    maps: [11, 12], // SR and ARAM
    enabled: true, // Whether to create item sets
  },
};

// Configuration that will be loaded from DataStore
let CONFIG = { ...DEFAULT_CONFIG };

// DataStore functions
const SettingsStore = {
  async loadSettings() {
    try {
      const settings = DataStore.get("rune-plugin-settings");
      if (settings) {
        const userSettings = JSON.parse(settings);
        // Only override user-configurable settings
        CONFIG.selectedProvider =
          userSettings.selectedProvider ?? DEFAULT_CONFIG.selectedProvider;
        CONFIG.itemSets.enabled =
          userSettings.itemSetsEnabled ?? DEFAULT_CONFIG.itemSets.enabled;
      }
    } catch (error) {
      console.error("[RunePlugin] Error loading settings:", error);
    }
  },

  async saveSettings() {
    try {
      // Only save user-configurable settings
      const settings = {
        selectedProvider: CONFIG.selectedProvider,
        itemSetsEnabled: CONFIG.itemSets.enabled,
      };
      DataStore.set("rune-plugin-settings", JSON.stringify(settings));
    } catch (error) {
      console.error("[RunePlugin] Error saving settings:", error);
    }
  },
};

const UGG = {
  positions: {
    jungle: 1,
    support: 2,
    adc: 3,
    top: 4,
    mid: 5,
    none: 6,
  },
  positionsReversed: {
    1: "Jungle",
    2: "Support",
    3: "ADC",
    4: "Top",
    5: "Mid",
    6: "",
  },
  positionMapping: {
    top: 4,
    jungle: 1,
    middle: 5,
    bottom: 3,
    support: 2,
    utility: 2,
    "": 6,
  },
};

const SETTINGS = {
  lolalytics: {
    baseUrl: "https://a1.lolalytics.com/mega/",
    tier: "platinum_plus",
    queue: "ranked",
    region: "all",
  },
  ugg: {
    baseUrl: "https://stats2.u.gg/lol",
    statsVersion: "1.5",
    overviewVersion: "1.5.0",
    server: 12,
    tier: 10,
    gameMode: "ranked_solo_5x5",
  },
};

const RUNE_TREES = {
  8242: 8400,
  8410: 8300,
  9923: 8100,
  9101: 8000,
  9111: 8000,
  9104: 8000,
  9105: 8000,
  9103: 8000,
  8299: 8000,
};

const utils = {
  debugLog(message, data = null) {
    if (CONFIG.debug) {
      console.log(`${CONFIG.logPrefix} ${message}`, data ? data : "");
    }
  },

  async fetchWithRetry(url, options = {}, retries = CONFIG.retryAttempts) {
    try {
      const response = await fetch(url, options);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return response;
    } catch (error) {
      if (retries > 0) {
        utils.debugLog(`Retrying request... Attempts left: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, CONFIG.retryDelay));
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  },

  async fetchJson(url, options = {}) {
    const response = await this.fetchWithRetry(url, options);
    return response.json();
  },

  formatChampionName(name) {
    return name
      .toLowerCase()
      .replace(/['\s]/g, "") // Remove apostrophes and spaces
      .replace(/\./g, "") // Remove dots (e.g., Dr. Mundo)
      .replace(/&/g, "and"); // Replace & with 'and'
  },

  async getChampionData() {
    try {
      const champions = await this.fetchJson(CONFIG.endpoints.championSummary);
      return champions.reduce((acc, champ) => {
        acc[this.formatChampionName(champ.name)] = champ.id;
        acc[champ.id] = champ.name;
        return acc;
      }, {});
    } catch (error) {
      return null;
    }
  },

  async getCurrentPage() {
    try {
      return await this.fetchJson(CONFIG.endpoints.currentPage);
    } catch (error) {
      return null;
    }
  },

  async getPages() {
    try {
      return await this.fetchJson(CONFIG.endpoints.perksPage);
    } catch (error) {
      return null;
    }
  },

  async deletePage(id) {
    try {
      await this.fetchWithRetry(`${CONFIG.endpoints.perksPage}/${id}`, {
        method: "DELETE",
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  async createPage(page) {
    try {
      return await this.fetchJson(CONFIG.endpoints.perksPage, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
    } catch (error) {
      return null;
    }
  },

  getRuneTree(runeId) {
    return RUNE_TREES[runeId] || Math.floor(runeId / 100) * 100;
  },

  getDisplayPosition(position, defaultLane) {
    return (
      CONFIG.displayNames[position] ||
      (defaultLane && CONFIG.displayNames[defaultLane]) ||
      ""
    );
  },
};

class LolalyticsRunePlugin {
  constructor() {
    this.championData = null;
    this.lastAppliedRunes = null;
    this.lastAppliedItemSet = null;
    this.isCreatingRunes = false;
    this.isCreatingItemSet = false;
    this.observers = [];
    this.sessionObserver = null;
    this.version = null;
    this.currentGameMode = null;
    utils.debugLog("Plugin instance created");
  }

  async init(context) {
    try {
      utils.debugLog("Initializing plugin...");
      await SettingsStore.loadSettings();
      await this.waitForClientInit();

      const versions = await utils.fetchJson(CONFIG.endpoints.versions);
      this.version = versions[0].split(".").slice(0, 2).join(".");
      utils.debugLog(`Using version: ${this.version}`);

      this.championData = await utils.getChampionData();
      if (this.championData) {
        utils.debugLog("Champion data loaded successfully", {
          championCount: Object.keys(this.championData).length / 2,
        });
        await this.setupChampSelectSubscription(context.socket);
        this.setupCleanup();
        this.initializeSettings();
        utils.debugLog("Plugin initialization completed");
      } else {
        utils.debugLog("Failed to load champion data", null, "error");
      }
    } catch (error) {
      utils.debugLog("Error during initialization", error, "error");
    }
  }

  initializeSettings() {
    const addSettings = () => {
      const settingsContainer = document.querySelector(".rune-plugin-settings");
      if (!settingsContainer) return;

      settingsContainer.innerHTML = `
        <div class="lol-settings-general-row">
          <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <p class="lol-settings-window-size-text">Rune Provider:</p>
              <lol-uikit-framed-dropdown class="lol-settings-general-dropdown" style="width: 200px;" tabindex="0">
                <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                  CONFIG.selectedProvider === PROVIDERS.LOLALYTICS
                }" value="${PROVIDERS.LOLALYTICS}">
                  Lolalytics
                  <div class="lol-tooltip-component"></div>
                </lol-uikit-dropdown-option>
                <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                  CONFIG.selectedProvider === PROVIDERS.UGG
                }" value="${PROVIDERS.UGG}">
                  U.GG
                  <div class="lol-tooltip-component"></div>
                </lol-uikit-dropdown-option>
              </lol-uikit-framed-dropdown>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <p class="lol-settings-window-size-text">Auto Item Sets:</p>
              <lol-uikit-framed-dropdown class="lol-settings-general-dropdown" style="width: 200px;" tabindex="0">
                <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                  CONFIG.itemSets.enabled
                }" value="true">
                  Enabled
                  <div class="lol-tooltip-component"></div>
                </lol-uikit-dropdown-option>
                <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${!CONFIG
                  .itemSets.enabled}" value="false">
                  Disabled
                  <div class="lol-tooltip-component"></div>
                </lol-uikit-dropdown-option>
              </lol-uikit-framed-dropdown>
            </div>
          </div>
        </div>
      `;

      // Provider dropdown
      const providerDropdown = settingsContainer.querySelectorAll(
        "lol-uikit-framed-dropdown"
      )[0];
      const providerOptions = providerDropdown.querySelectorAll(
        "lol-uikit-dropdown-option"
      );

      // Set initial provider selected value
      const currentProviderOption = Array.from(providerOptions).find(
        (opt) => opt.getAttribute("value") === CONFIG.selectedProvider
      );
      if (currentProviderOption) {
        providerOptions.forEach((opt) => opt.removeAttribute("selected"));
        currentProviderOption.setAttribute("selected", "");
        providerDropdown.setAttribute(
          "selected-value",
          CONFIG.selectedProvider
        );
        providerDropdown.setAttribute(
          "selected-item",
          CONFIG.selectedProvider === PROVIDERS.UGG ? "U.GG" : "Lolalytics"
        );
      }

      providerOptions.forEach((option) => {
        option.addEventListener("click", () => {
          const value = option.getAttribute("value");
          this.handleProviderChange(value);

          // Update selected state
          providerOptions.forEach((opt) => opt.removeAttribute("selected"));
          option.setAttribute("selected", "");
          providerDropdown.setAttribute("selected-value", value);
          providerDropdown.setAttribute(
            "selected-item",
            value === PROVIDERS.UGG ? "U.GG" : "Lolalytics"
          );
        });
      });

      // Item Sets dropdown
      const itemSetsDropdown = settingsContainer.querySelectorAll(
        "lol-uikit-framed-dropdown"
      )[1];
      const itemSetsOptions = itemSetsDropdown.querySelectorAll(
        "lol-uikit-dropdown-option"
      );

      // Set initial item sets selected value
      const currentItemSetsOption = Array.from(itemSetsOptions).find(
        (opt) => opt.getAttribute("value") === String(CONFIG.itemSets.enabled)
      );
      if (currentItemSetsOption) {
        itemSetsOptions.forEach((opt) => opt.removeAttribute("selected"));
        currentItemSetsOption.setAttribute("selected", "");
        itemSetsDropdown.setAttribute(
          "selected-value",
          String(CONFIG.itemSets.enabled)
        );
        itemSetsDropdown.setAttribute(
          "selected-item",
          CONFIG.itemSets.enabled ? "Enabled" : "Disabled"
        );
      }

      itemSetsOptions.forEach((option) => {
        option.addEventListener("click", () => {
          const value = option.getAttribute("value") === "true";
          this.handleItemSetsChange(value);

          // Update selected state
          itemSetsOptions.forEach((opt) => opt.removeAttribute("selected"));
          option.setAttribute("selected", "");
          itemSetsDropdown.setAttribute("selected-value", String(value));
          itemSetsDropdown.setAttribute(
            "selected-item",
            value ? "Enabled" : "Disabled"
          );
        });
      });
    };

    // Observe for settings container
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.classList?.contains("rune-plugin-settings")) {
            addSettings();
            return;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  handleProviderChange(newProvider) {
    const providerKey = newProvider.toUpperCase();
    if (PROVIDERS[providerKey]) {
      CONFIG.selectedProvider = PROVIDERS[providerKey];
      utils.debugLog(`Provider changed to: ${CONFIG.selectedProvider}`);
      Toast.success(
        `Provider updated to: ${
          CONFIG.selectedProvider === PROVIDERS.UGG ? "U.GG" : "Lolalytics"
        }`
      );
      SettingsStore.saveSettings();
      this.lastAppliedRunes = null;
    }
  }

  handleItemSetsChange(enabled) {
    CONFIG.itemSets.enabled = enabled;
    utils.debugLog(`Item sets ${enabled ? "enabled" : "disabled"}`);
    Toast.success(`Item sets ${enabled ? "enabled" : "disabled"}`);
    SettingsStore.saveSettings();
    this.lastAppliedItemSet = null;
  }

  async waitForClientInit() {
    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(CONFIG.endpoints.championSummary);
        if (response.ok) return;
      } catch (error) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error("Client initialization timeout");
  }

  async setupChampSelectSubscription(socket) {
    if (!socket) return;

    try {
      const phaseObserver = socket.observe(
        CONFIG.endpoints.gamePhase,
        async (phase) => {
          if (phase.data === "ChampSelect") {
            this.startChampSelectSession(socket);
          } else if (this.isChampSelectSessionActive()) {
            this.stopChampSelectSession();
          }
        }
      );
      this.observers.push(phaseObserver);

      const response = await fetch(CONFIG.endpoints.gamePhase);
      if (response.ok) {
        const phase = await response.text();
        if (phase.data === "ChampSelect") {
          this.startChampSelectSession(socket);
        }
      }
    } catch (error) {
      // Silently handle errors
    }
  }

  isChampSelectSessionActive() {
    return this.sessionObserver !== null;
  }

  startChampSelectSession(socket) {
    if (this.isChampSelectSessionActive()) return;

    this.sessionObserver = socket.observe(
      CONFIG.endpoints.champSelect,
      this.handleChampSelectUpdate.bind(this)
    );
    this.observers.push(this.sessionObserver);
  }

  stopChampSelectSession() {
    if (!this.isChampSelectSessionActive()) return;

    const index = this.observers.indexOf(this.sessionObserver);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
    if (this.sessionObserver.disconnect) {
      this.sessionObserver.disconnect();
    }
    this.sessionObserver = null;
    this.lastAppliedRunes = null;
  }

  cleanup() {
    if (this.isChampSelectSessionActive()) {
      this.stopChampSelectSession();
    }

    this.observers.forEach((observer) => {
      if (observer?.disconnect) observer.disconnect();
    });
    this.observers = [];
  }

  setupCleanup() {
    window.addEventListener("unload", () => this.cleanup());
  }

  async handleChampSelectUpdate(event) {
    if (!event?.data?.myTeam) return;

    const myPlayer = event.data.myTeam.find(
      (player) => player.cellId === event.data.localPlayerCellId
    );

    if (!myPlayer?.championId) return;

    const position = myPlayer.assignedPosition?.toLowerCase() || "";

    // Check if we're in Arena mode
    await this.checkGameMode();
    
    // Handle runes (skip for Arena mode)
    if (this.currentGameMode !== "CHERRY" && !this.shouldSkipRuneUpdate(myPlayer.championId, position)) {
      await this.createRunesForChampion(myPlayer.championId, position);
    }

    // Handle item sets
    if (
      CONFIG.itemSets.enabled &&
      !this.shouldSkipItemSetUpdate(myPlayer.championId, position)
    ) {
      await this.createItemSetForChampion(myPlayer.championId, position);
    }
  }

  async checkGameMode() {
    try {
      const gameflowSession = await utils.fetchJson(CONFIG.endpoints.gameflowSession);
      if (gameflowSession?.gameData?.queue?.gameMode) {
        this.currentGameMode = gameflowSession.gameData.queue.gameMode;
        utils.debugLog(`Current game mode: ${this.currentGameMode}`);
      }
    } catch (error) {
      utils.debugLog("Error checking game mode", error);
    }
  }

  shouldSkipRuneUpdate(championId, position) {
    if (this.isCreatingRunes) return true;

    return (
      this.lastAppliedRunes?.championId === championId &&
      this.lastAppliedRunes.position === position
    );
  }

  async createRunesForChampion(championId, position) {
    this.isCreatingRunes = true;
    try {
      const runeData = await this.getRunesForChampion(championId, position);
      if (runeData) {
        await this.createRunePage(
          championId,
          runeData.selectedPerkIds,
          runeData.displayPosition,
          runeData.mainPerk,
          runeData.subPerk
        );
        this.lastAppliedRunes = { championId, position };
      }
    } finally {
      this.isCreatingRunes = false;
    }
  }

  async getRunesForChampion(championId, position) {
    utils.debugLog("Fetching runes", {
      championId,
      position,
      provider: CONFIG.selectedProvider,
    });
    return CONFIG.selectedProvider === PROVIDERS.UGG
      ? await this.getUGGRunes(championId, position)
      : await this.getLolalyticsRunes(championId, position);
  }

  async getUGGRunes(championId, position) {
    try {
      const uggPosition = UGG.positionMapping[position] || UGG.positions.none;
      utils.debugLog("Fetching U.GG runes", {
        championId,
        position: UGG.positionsReversed[uggPosition],
        uggPosition,
        version: this.version,
      });

      const uggVersion = this.version.replace(".", "_");
      const requestUrl = `${SETTINGS.ugg.baseUrl}/${SETTINGS.ugg.statsVersion}/overview/${uggVersion}/${SETTINGS.ugg.gameMode}/${championId}/${SETTINGS.ugg.overviewVersion}.json`;

      const response = await utils.fetchJson(requestUrl);
      utils.debugLog("U.GG Raw Response", response);

      if (!response?.[SETTINGS.ugg.server]?.[SETTINGS.ugg.tier]) {
        utils.debugLog(
          "No data found for server/tier",
          {
            server: SETTINGS.ugg.server,
            tier: SETTINGS.ugg.tier,
          },
          "error"
        );
        return null;
      }

      const tierData = response[SETTINGS.ugg.server][SETTINGS.ugg.tier];
      utils.debugLog("U.GG Tier Data", tierData);

      // If no position specified or position data not found, find the most played position
      let positionData;
      let bestPosition = null;
      if (!position || !tierData[uggPosition]?.[0]) {
        // Find position with highest number of games
        let maxGames = 0;

        // Check positions 1 through 5 (jungle through mid)
        for (let pos = 1; pos <= 5; pos++) {
          if (tierData[pos]?.[0]?.[0]?.[0]) {
            // Check if position has data
            const games = tierData[pos][0][0][0]; // Total games for this position
            if (games > maxGames) {
              maxGames = games;
              bestPosition = pos;
            }
          }
        }

        if (bestPosition) {
          positionData = tierData[bestPosition][0];
          utils.debugLog("Using most played position", {
            position: UGG.positionsReversed[bestPosition],
            games: maxGames,
          });
        } else {
          utils.debugLog("No valid position data found", null, "error");
          return null;
        }
      } else {
        positionData = tierData[uggPosition][0];
      }

      utils.debugLog("U.GG Position Data", positionData);

      const perks = positionData[0];
      utils.debugLog("U.GG Perks Data", perks);

      if (!perks || !Array.isArray(perks)) {
        utils.debugLog("Invalid perks data structure", perks, "error");
        return null;
      }

      const statShards =
        positionData[8]?.[2]?.map((str) => parseInt(str, 10)) || [];
      const mainPerk = perks[2];
      const subPerk = perks[3];
      const selectedPerkIds = perks[4]
        .map((perk) => (Array.isArray(perk) ? perk[0] : perk))
        .concat(statShards);

      utils.debugLog("U.GG Processed Rune Data", {
        mainPerk,
        subPerk,
        selectedPerkIds,
        statShards,
      });

      return {
        selectedPerkIds,
        mainPerk,
        subPerk,
        displayPosition: position
          ? UGG.positionsReversed[uggPosition]
          : UGG.positionsReversed[bestPosition],
        winRate: ((perks[1] / perks[0]) * 100).toFixed(2) + "%",
        matches: perks[1],
        win: perks[0],
      };
    } catch (error) {
      utils.debugLog(
        "Error fetching U.GG runes",
        {
          error: error.message,
          stack: error.stack,
        },
        "error"
      );
      return null;
    }
  }

  async createRunePage(
    championId,
    selectedPerkIds,
    position,
    mainPerk,
    subPerk
  ) {
    const pages = await utils.getPages();
    if (!pages) return null;

    if (pages.length >= 2) {
      const currentPage = await utils.getCurrentPage();
      await utils.deletePage(currentPage?.id || pages[0].id);
    }

    const provider =
      CONFIG.selectedProvider === PROVIDERS.UGG ? "U.GG" : "Lolalytics";
    return await utils.createPage({
      name: `${provider} - ${this.championData[championId]} ${position}`,
      primaryStyleId: mainPerk,
      subStyleId: subPerk,
      selectedPerkIds,
      current: true,
      order: 0,
    });
  }

  async getLolalyticsRunes(championId, position) {
    try {
      const championName = utils.formatChampionName(
        this.championData[championId]
      );
      utils.debugLog("Fetching Lolalytics runes", {
        championId,
        championName,
        position,
      });

      // Map utility to support for API request
      const lane = position === "utility" ? "support" : position;

      const params = new URLSearchParams({
        ep: "rune",
        v: "1",
        patch: this.version,
        c: championName,
        tier: SETTINGS.lolalytics.tier,
        queue: SETTINGS.lolalytics.queue,
        region: SETTINGS.lolalytics.region,
      });

      if (lane) params.append("lane", lane);

      const response = await utils.fetchJson(
        `${SETTINGS.lolalytics.baseUrl}?${params.toString()}`
      );

      if (!response?.summary?.runes?.pick) return null;

      const runeData = response.summary.runes.pick;
      const primaryRunes = runeData.set.pri;
      const secondaryRunes = runeData.set.sec;

      const mainPerk =
        primaryRunes.length > 0
          ? utils.getRuneTree(primaryRunes[0])
          : 8000 + runeData.page.pri * 100;

      const subPerk =
        secondaryRunes.length > 0
          ? utils.getRuneTree(secondaryRunes[0])
          : 8000 + runeData.page.sec * 100;

      return {
        selectedPerkIds: [
          ...primaryRunes,
          ...secondaryRunes,
          ...runeData.set.mod,
        ],
        mainPerk,
        subPerk,
        displayPosition: utils.getDisplayPosition(
          position,
          response.header?.defaultLane
        ),
        winRate: runeData.wr.toFixed(2) + "%",
        matches: runeData.n,
        win: Math.round(runeData.n * (runeData.wr / 100)),
      };
    } catch (error) {
      utils.debugLog("Error fetching Lolalytics runes", error, "error");
      return null;
    }
  }

  shouldSkipItemSetUpdate(championId, position) {
    if (this.isCreatingItemSet) return true;

    return (
      this.lastAppliedItemSet?.championId === championId &&
      this.lastAppliedItemSet.position === position
    );
  }

  async createItemSetForChampion(championId, position) {
    this.isCreatingItemSet = true;
    try {
      const itemSetData = await this.getItemSetData(championId, position);
      if (itemSetData) {
        await this.createItemSet(championId, itemSetData, position);
        this.lastAppliedItemSet = { championId, position };
      }
    } finally {
      this.isCreatingItemSet = false;
    }
  }

  async getItemSetData(championId, position) {
    const championName = utils.formatChampionName(
      this.championData[championId]
    );
    utils.debugLog("Fetching item sets", {
      championId,
      championName,
      position,
      gameMode: this.currentGameMode,
    });

    // Check if we're in Arena mode
    if (this.currentGameMode === "CHERRY") {
      const params = new URLSearchParams({
        ep: "arena-itemset",
        v: "1",
        patch: this.version,
        c: championName,
        tier: SETTINGS.lolalytics.tier,
        region: SETTINGS.lolalytics.region,
      });

      const response = await utils.fetchJson(
        `${SETTINGS.lolalytics.baseUrl}?${params.toString()}`
      );

      return response?.itemSets || null;
    }

    // Normal mode - use existing logic
    // Map utility to support for API request
    const lane = position === "utility" ? "support" : position;

    const params = new URLSearchParams({
      ep: "build-itemset",
      v: "1",
      patch: this.version,
      c: championName,
      tier: SETTINGS.lolalytics.tier,
      queue: SETTINGS.lolalytics.queue,
      region: SETTINGS.lolalytics.region,
    });

    if (lane) params.append("lane", lane);

    const response = await utils.fetchJson(
      `${SETTINGS.lolalytics.baseUrl}?${params.toString()}`
    );

    return response?.itemSets || null;
  }

  processItemSets(itemSets) {
    utils.debugLog("Processing item sets", itemSets);
    
    // Check if we're processing Arena mode item sets (they have different structure)
    if (this.currentGameMode === "CHERRY") {
      return this.processArenaItemSets(itemSets);
    }

    // Regular item sets processing (non-Arena mode)
    // Process 3-item core builds (itemSet3)
    const popularCore = (itemSets.itemSet3 || [])
      .filter((item) => item && item[0] && item[0].includes("_"))
      .sort((a, b) => b[1] - a[1]) // Sort by total games
      .slice(0, 1)
      .map((item) => {
        const games = item[1];
        return {
          items: item[0].split("_").map((id) => ({
            id,
            count: 1,
          })),
          games,
        };
      })[0] || { items: [], games: 0 };

    // Process 5-item builds (itemSet5)
    const popularFull = (itemSets.itemSet5 || [])
      .filter((item) => item && item[0] && item[0].includes("_"))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1)
      .map((item) => {
        const games = item[1];
        return {
          items: item[0].split("_").map((id) => ({
            id,
            count: 1,
          })),
          games,
        };
      })[0] || { items: [], games: 0 };

    // Check if we're in Arena mode - don't use minimum games requirement for Arena
    const minGames = this.currentGameMode === "CHERRY" ? 0 : CONFIG.itemSets.minGames;

    // Process winrate 3-item core builds with fallback
    let winrateCore = (itemSets.itemSet3 || [])
      .filter(
        (item) =>
          item &&
          item[0] &&
          item[0].includes("_") &&
          item[1] >= minGames
      )
      .sort((a, b) => b[2] / b[1] - a[2] / a[1]) // Sort by winrate
      .slice(0, 1)
      .map((item) => {
        const winrate = ((item[2] / item[1]) * 100).toFixed(1);
        return {
          items: item[0].split("_").map((id) => ({
            id,
            count: 1,
          })),
          winrate,
        };
      })[0];

    // Fallback for winrate core if no data meets minimum games threshold
    if (!winrateCore) {
      winrateCore = (itemSets.itemSet3 || [])
        .filter((item) => item && item[0] && item[0].includes("_"))
        .sort((a, b) => b[2] / b[1] - a[2] / a[1]) // Sort by winrate
        .slice(0, 1)
        .map((item) => {
          const winrate = ((item[2] / item[1]) * 100).toFixed(1);
          return {
            items: item[0].split("_").map((id) => ({
              id,
              count: 1,
            })),
            winrate,
          };
        })[0] || { items: [], winrate: 0 };
    }

    // Process winrate 5-item builds with fallback
    let winrateFull = (itemSets.itemSet5 || [])
      .filter(
        (item) =>
          item &&
          item[0] &&
          item[0].includes("_") &&
          item[1] >= minGames
      )
      .sort((a, b) => b[2] / b[1] - a[2] / a[1]) // Sort by winrate
      .slice(0, 1)
      .map((item) => {
        const winrate = ((item[2] / item[1]) * 100).toFixed(1);
        return {
          items: item[0].split("_").map((id) => ({
            id,
            count: 1,
          })),
          winrate,
        };
      })[0];

    // Fallback for winrate full build if no data meets minimum games threshold
    if (!winrateFull) {
      winrateFull = (itemSets.itemSet5 || [])
        .filter((item) => item && item[0] && item[0].includes("_"))
        .sort((a, b) => b[2] / b[1] - a[2] / a[1]) // Sort by winrate
        .slice(0, 1)
        .map((item) => {
          const winrate = ((item[2] / item[1]) * 100).toFixed(1);
          return {
            items: item[0].split("_").map((id) => ({
              id,
              count: 1,
            })),
            winrate,
          };
        })[0] || { items: [], winrate: 0 };
    }

    // Get all items that are already in other blocks
    const usedItems = new Set([
      ...popularCore.items.map((item) => item.id),
      ...popularFull.items.map((item) => item.id),
      ...winrateCore.items.map((item) => item.id),
      ...winrateFull.items.map((item) => item.id),
    ]);

    // Process situational items (excluding already used items)
    const situational = (itemSets.itemSet1 || [])
      .filter((item) => {
        return item && item[0] && !usedItems.has(item[0]);
      })
      .sort((a, b) => b[1] - a[1]) // Sort by total games
      .slice(0, 6)
      .map((item) => ({
        id: item[0],
        count: 1,
      }));

    utils.debugLog("Processed builds", {
      popularCore,
      popularFull,
      winrateCore,
      winrateFull,
      situational,
    });

    return {
      popularCore,
      popularFull,
      winrateCore,
      winrateFull,
      situational,
    };
  }

  // Process Arena mode item sets which have a different format
  processArenaItemSets(itemSets) {
    utils.debugLog("Processing Arena item sets", itemSets);
    
    // For Arena, we primarily look at itemSet4 which contains build data
    const itemSet4 = itemSets.itemSet4 || [];
    
    // Process popular 4-item core builds for Arena
    const popularCore = itemSet4
      .filter((item) => item && item[0] && item[0].includes("_"))
      .sort((a, b) => b[1] - a[1]) // Sort by total games
      .slice(0, 1)
      .map((item) => {
        const games = item[1];
        return {
          items: item[0].split("_").map((id) => ({
            id: id,
            count: 1,
          })),
          games,
        };
      })[0] || { items: [], games: 0 };
    
    // Get popular full build (using the same data but all items)
    const popularFull = { ...popularCore };
    
    // Process highest winrate builds
    const winrateCore = itemSet4
      .filter((item) => item && item[0] && item[0].includes("_") && item[1] >= 50) // At least 50 games
      .sort((a, b) => b[2] / b[1] - a[2] / a[1]) // Sort by winrate
      .slice(0, 1)
      .map((item) => {
        const winrate = ((item[2] / item[1]) * 100).toFixed(1);
        return {
          items: item[0].split("_").map((id) => ({
            id: id,
            count: 1,
          })),
          winrate,
        };
      })[0] || { items: [], winrate: 0 };
    
    // Get winrate full build (using the same data but all items)  
    const winrateFull = { ...winrateCore };
    
    // Get all items that are already in other blocks
    const usedItems = new Set([
      ...popularCore.items.map((item) => item.id),
      ...winrateCore.items.map((item) => item.id),
    ]);
    
    // Process situational items (get items from other popular builds not already included)
    const situational = itemSet4
      .filter((item) => {
        if (!item || !item[0] || !item[0].includes("_")) return false;
        // Check if it has any items not in the used set
        const itemIds = item[0].split("_").map(id => id);
        return itemIds.some(id => !usedItems.has(id));
      })
      .sort((a, b) => b[1] - a[1]) // Sort by total games
      .slice(0, 10)
      .flatMap((item) => {
        // Extract only the items not already used
        return item[0].split("_")
          .map(id => id)
          .filter(id => !usedItems.has(id))
          .map(id => {
            usedItems.add(id); // Add to used set to avoid duplicates
            return { id, count: 1 };
          });
      })
      .slice(0, 6); // Limit to 6 situational items
    
    utils.debugLog("Processed Arena builds", {
      popularCore,
      popularFull,
      winrateCore,
      winrateFull,
      situational,
    });
    
    return {
      popularCore,
      popularFull,
      winrateCore,
      winrateFull,
      situational,
    };
  }

  async createItemSet(championId, itemSets, position) {
    try {
      const currentSummoner = await utils.fetchJson(
        CONFIG.endpoints.currentSummoner
      );
      if (!currentSummoner?.summonerId) return;

      const builds = this.processItemSets(itemSets);
      const provider =
        CONFIG.selectedProvider === PROVIDERS.UGG ? "U.GG" : "Lolalytics";
      
      // Add Arena indicator to title if in Arena mode
      const modeIndicator = this.currentGameMode === "CHERRY" ? " Arena" : "";

      // First get existing item sets
      const existingSets = await utils.fetchJson(
        `${CONFIG.endpoints.itemSets}/${currentSummoner.summonerId}/sets`
      );

      // Create new item set
      const newItemSet = {
        uid: crypto.randomUUID(),
        title: `${provider}${modeIndicator} - ${
          this.championData[championId]
        } ${utils.getDisplayPosition(position)}`,
        associatedChampions: [championId],
        associatedMaps: this.currentGameMode === "CHERRY" ? [] : CONFIG.itemSets.maps,
        blocks: [
          {
            hideIfSummonerSpell: "",
            showIfSummonerSpell: "",
            items:
              builds.popularCore.items.length > 0
                ? builds.popularCore.items
                : [{ id: "0", count: 1 }],
            type: this.currentGameMode === "CHERRY"
              ? `Most Popular Arena Build - ${builds.popularCore.games.toLocaleString()} games`
              : `Most Popular Core Items - ${builds.popularCore.games.toLocaleString()} games`,
          },
          {
            hideIfSummonerSpell: "",
            showIfSummonerSpell: "",
            items: builds.popularFull.items,
            type: this.currentGameMode === "CHERRY"
              ? `Popular Full Arena Build - ${builds.popularFull.games.toLocaleString()} games`
              : `Most Popular Full Build - ${builds.popularFull.games.toLocaleString()} games`,
          },
          {
            hideIfSummonerSpell: "",
            showIfSummonerSpell: "",
            items: builds.winrateCore.items,
            type: this.currentGameMode === "CHERRY"
              ? `Highest Winrate Arena Build - ${builds.winrateCore.winrate}% WR`
              : `Highest Winrate Core - ${builds.winrateCore.winrate}% WR`,
          },
          {
            hideIfSummonerSpell: "",
            showIfSummonerSpell: "",
            items: builds.winrateFull.items,
            type: this.currentGameMode === "CHERRY"
              ? `Highest Winrate Full Arena Build - ${builds.winrateFull.winrate}% WR`
              : `Highest Winrate Full Build - ${builds.winrateFull.winrate}% WR`,
          },
          {
            hideIfSummonerSpell: "",
            showIfSummonerSpell: "",
            items: builds.situational,
            type: "Situational Items",
          },
        ],
        preferredItemSlots: [],
        sortrank: 0,
        map: "any",
        mode: this.currentGameMode === "CHERRY" ? "CHERRY" : "any",
        startedFrom: "blank",
        type: "custom",
      };

      // Filter out old item sets with the same champion and provider
      const oldItemSets = existingSets?.itemSets || [];
      const filteredSets = oldItemSets.filter(
        (set) => !set.title.includes("Lolalytics")
      );

      utils.debugLog("Creating item set", { builds, newItemSet });

      // Update item sets with PUT
      const response = await utils.fetchWithRetry(
        `${CONFIG.endpoints.itemSets}/${currentSummoner.summonerId}/sets`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: currentSummoner.accountId,
            itemSets: [...filteredSets, newItemSet],
            timestamp: Date.now(),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create item set: ${error.message}`);
      }

      utils.debugLog("Item set created successfully", newItemSet);
    } catch (error) {
      utils.debugLog("Error creating item set", error);
    }
  }
}

export function init(context) {
  settingsUtils(window, data);
  window.lolalyticsRunePlugin = new LolalyticsRunePlugin();
  window.lolalyticsRunePlugin.init(context);
}
