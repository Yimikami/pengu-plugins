/**
 * @name RunePlugin
 * @author Yimikami
 * @description Fetches optimal runes based on U.GG and Lolalytics data
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.2
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
  },
  displayNames: {
    top: "Top",
    jungle: "Jungle",
    middle: "Middle",
    bottom: "ADC",
    support: "Support",
    utility: "Support",
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
    this.isCreatingRunes = false;
    this.observers = [];
    this.sessionObserver = null;
    this.version = null;
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
          </div>
        </div>
      `;

      // Provider dropdown
      const providerDropdown = settingsContainer.querySelector(
        "lol-uikit-framed-dropdown"
      );
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
    if (this.shouldSkipRuneUpdate(myPlayer.championId, position)) return;

    await this.createRunesForChampion(myPlayer.championId, position);
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
}

export function init(context) {
  settingsUtils(window, data);
  window.lolalyticsRunePlugin = new LolalyticsRunePlugin();
  window.lolalyticsRunePlugin.init(context);
}
