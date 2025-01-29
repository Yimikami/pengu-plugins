/**
 * @name RunePlugin
 * @author Yimikami
 * @description Fetches optimal runes from U.GG for champions
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.1
 */

// U.GG constants
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
};

const CONFIG = {
  debug: false,
  retryAttempts: 3,
  retryDelay: 1000,
  logPrefix: "[Rune Plugin]",
  positionMapping: {
    TOP: UGG.positions.top,
    JUNGLE: UGG.positions.jungle,
    MIDDLE: UGG.positions.mid,
    BOTTOM: UGG.positions.adc,
    UTILITY: UGG.positions.support,
    "": UGG.positions.none,
  },
  defaultPosition: "MIDDLE",
};

const SETTINGS = {
  baseOverviewUrl: "https://stats2.u.gg/lol",
  statsVersion: "1.5",
  overviewVersion: "1.5.0",
  usedServer: 12,
  /* 
    na: 1,
    euw: 2,
    kr: 3,
    eune: 4,
    br: 5,
    las: 6,
    lan: 7,
    oce: 8,
    ru: 9,
    tr: 10,
    jp: 11,
    world: 12
  */
  defaultTier: 10,
  /* 
    challenger: 1,
    master: 2,
    diamond: 3,
    platinum: 4,
    gold: 5,
    silver: 6,
    bronze: 7,
    overall: 8,
    platPlus: 10,
    diaPlus: 11
  */
  defaultGameMode: "ranked_solo_5x5",
  /* 
    ranked_solo_5x5: "Ranked Solo/Duo",
    normal_aram: "ARAM",
  */
};

// Utility functions
const utils = {
  debugLog(message, data = null) {
    if (CONFIG.debug) {
      console.log(`${CONFIG.logPrefix} ${message}`, data ? data : "");
    }
  },

  async fetchWithRetry(url, options = {}, retries = CONFIG.retryAttempts) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      if (retries > 0) {
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

  async getChampionData() {
    try {
      const champions = await this.fetchJson(
        "/lol-game-data/assets/v1/champion-summary.json"
      );
      return champions.reduce((acc, champ) => {
        acc[champ.name.toLowerCase()] = champ.id;
        acc[champ.id] = champ.name;
        return acc;
      }, {});
    } catch (error) {
      this.debugLog("Error fetching champion data:", error, "error");
      return null;
    }
  },

  async getCurrentPage() {
    try {
      return await this.fetchJson("/lol-perks/v1/currentpage");
    } catch (error) {
      this.debugLog("Error getting current rune page:", error, "error");
      return null;
    }
  },

  async getPages() {
    try {
      return await this.fetchJson("/lol-perks/v1/pages");
    } catch (error) {
      this.debugLog("Error getting rune pages:", error, "error");
      return null;
    }
  },

  async deletePage(id) {
    try {
      await this.fetchWithRetry(`/lol-perks/v1/pages/${id}`, {
        method: "DELETE",
      });
      return true;
    } catch (error) {
      this.debugLog("Error deleting rune page:", error, "error");
      return false;
    }
  },

  async createPage(page) {
    try {
      return await this.fetchJson("/lol-perks/v1/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
    } catch (error) {
      this.debugLog("Error creating rune page:", error, "error");
      return null;
    }
  },

  removePerkIds(perks) {
    return perks.map((perk) => (Array.isArray(perk) ? perk[0] : perk));
  },
};

class RunePlugin {
  constructor() {
    this.championData = null;
    this.lastAppliedRunes = null;
    this.isCreatingRunes = false;
    this.observers = []; // Track observers for cleanup
    this.sessionObserver = null; // Track session observer separately
    utils.debugLog("Plugin instance created");
  }

  async init(context) {
    try {
      utils.debugLog("Initializing plugin...");

      // Wait for client to be ready
      await this.waitForClientInit();

      this.championData = await utils.getChampionData();

      if (this.championData) {
        utils.debugLog("Champion data loaded successfully", {
          championCount: Object.keys(this.championData).length / 2,
          sampleChampions: Object.entries(this.championData).slice(0, 3),
        });

        // Subscribe to champion select events using socket context
        await this.setupChampSelectSubscription(context.socket);

        // Setup cleanup
        this.setupCleanup();

        utils.debugLog("Plugin initialization completed");
      } else {
        utils.debugLog("Failed to load champion data", null, "error");
      }
    } catch (error) {
      utils.debugLog("Error during initialization", error, "error");
    }
  }

  async waitForClientInit() {
    utils.debugLog("Waiting for client to be ready...");

    // Wait for essential endpoints to be available
    const maxAttempts = 20;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        // Try to fetch champion data to check if client is ready
        const response = await fetch(
          "/lol-game-data/assets/v1/champion-summary.json"
        );
        if (response.ok) {
          utils.debugLog("Client is ready");
          return;
        }
      } catch (error) {
        attempts++;
        utils.debugLog(
          `Waiting for client... Attempt ${attempts}/${maxAttempts}`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error("Client initialization timeout");
  }

  async setupChampSelectSubscription(socket) {
    if (!socket) {
      utils.debugLog("Socket context not available", null, "error");
      return;
    }

    utils.debugLog("Setting up champion select subscription");

    try {
      // Subscribe to champion select phase
      const phaseObserver = socket.observe(
        "/lol-gameflow/v1/gameflow-phase",
        async (phase) => {
          utils.debugLog("Game phase changed", phase);
          if (phase.data === "ChampSelect") {
            utils.debugLog(
              "Entered champion select - starting session observation"
            );
            // Start observing champion select session
            this.startChampSelectSession(socket);
          } else if (this.isChampSelectSessionActive()) {
            utils.debugLog(
              "Left champion select - stopping session observation"
            );
            // Stop observing champion select session
            this.stopChampSelectSession();
          }
        }
      );
      this.observers.push(phaseObserver);
      utils.debugLog("Subscribed to game phase updates");

      // Check current phase
      try {
        const response = await fetch("/lol-gameflow/v1/gameflow-phase");
        if (response.ok) {
          const phase = await response.text();
          utils.debugLog("Current game phase", phase);
          if (phase.data === "ChampSelect") {
            utils.debugLog(
              "Already in champion select - starting session observation"
            );
            this.startChampSelectSession(socket);
          }
        }
      } catch (error) {
        utils.debugLog("Error getting current game phase", error, "error");
      }
    } catch (error) {
      utils.debugLog(
        "Error setting up champion select subscription",
        error,
        "error"
      );
    }
  }

  isChampSelectSessionActive() {
    return this.sessionObserver !== null;
  }

  startChampSelectSession(socket) {
    if (this.isChampSelectSessionActive()) {
      utils.debugLog("Champion select session observation already active");
      return;
    }

    utils.debugLog("Starting champion select session observation");
    this.sessionObserver = socket.observe(
      "/lol-champ-select/v1/session",
      this.handleChampSelectUpdate.bind(this)
    );
    this.observers.push(this.sessionObserver);
  }

  stopChampSelectSession() {
    if (!this.isChampSelectSessionActive()) {
      utils.debugLog("No active champion select session to stop");
      return;
    }

    utils.debugLog("Stopping champion select session observation");
    const index = this.observers.indexOf(this.sessionObserver);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
    if (this.sessionObserver.disconnect) {
      this.sessionObserver.disconnect();
    }
    this.sessionObserver = null;
    this.lastAppliedRunes = null; // Reset last applied runes when leaving champion select
  }

  cleanup() {
    // Stop champion select session if active
    if (this.isChampSelectSessionActive()) {
      this.stopChampSelectSession();
    }

    // Disconnect all remaining observers
    this.observers.forEach((observer) => {
      if (observer && observer.disconnect) {
        observer.disconnect();
      }
    });
    this.observers = [];
    utils.debugLog("Cleaned up socket observers");
  }

  // Add cleanup on window unload
  setupCleanup() {
    utils.debugLog("Setting up cleanup handlers");
    window.addEventListener("unload", () => {
      this.cleanup();
    });
  }

  async handleChampSelectUpdate(event) {
    if (!event?.data) {
      utils.debugLog("Received empty champion select update", event);
      return;
    }

    utils.debugLog("Champion select session update received", event);
    const session = event.data;

    if (!session.myTeam) {
      utils.debugLog("No team data in session", session);
      return;
    }

    const myPlayer = session.myTeam.find(
      (player) => player.cellId === session.localPlayerCellId
    );

    if (!myPlayer) {
      utils.debugLog("Could not find local player in team", session.myTeam);
      return;
    }

    if (!myPlayer.championId || myPlayer.championId === 0) {
      utils.debugLog("No champion selected yet", { playerId: myPlayer.cellId });
      return;
    }

    const rawPosition = myPlayer.assignedPosition || "";
    const uggPosition =
      CONFIG.positionMapping[rawPosition.toUpperCase()] ||
      CONFIG.positionMapping[CONFIG.defaultPosition];

    utils.debugLog("Processing champion select", {
      championId: myPlayer.championId,
      championName: this.championData[myPlayer.championId],
      rawPosition: rawPosition,
      mappedPosition: UGG.positionsReversed[uggPosition],
      uggPositionId: uggPosition,
    });

    if (
      this.shouldSkipRuneUpdate(myPlayer.championId, rawPosition, uggPosition)
    ) {
      utils.debugLog("Skipping rune update - conditions not met", {
        championId: myPlayer.championId,
        rawPosition: rawPosition,
        mappedPosition: UGG.positionsReversed[uggPosition],
        isCreatingRunes: this.isCreatingRunes,
        lastApplied: this.lastAppliedRunes,
      });
      return;
    }

    await this.createRunesForChampion(
      myPlayer.championId,
      uggPosition,
      rawPosition
    );
  }

  shouldSkipRuneUpdate(championId, position, uggPosition) {
    if (this.isCreatingRunes) {
      utils.debugLog("Skipping rune update - rune creation in progress", {
        championId,
      });
      return true;
    }

    if (
      this.lastAppliedRunes?.championId === championId &&
      (this.lastAppliedRunes.position === uggPosition ||
        (position === "" &&
          this.lastAppliedRunes.position ===
            CONFIG.positionMapping[CONFIG.defaultPosition]))
    ) {
      utils.debugLog("Skipping rune update - already applied", {
        championId,
        position: UGG.positionsReversed[uggPosition],
      });
      return true;
    }

    return false;
  }

  async createRunesForChampion(championId, uggPosition, rawPosition) {
    this.isCreatingRunes = true;
    try {
      const uggRunes = await this.getRunesForChampion(championId, uggPosition);
      if (uggRunes) {
        this.lastAppliedRunes = {
          championId,
          position: uggPosition,
        };
        utils.debugLog("Runes applied successfully", {
          championId,
          championName: this.championData[championId],
          rawPosition: rawPosition,
          position: UGG.positionsReversed[uggPosition],
          winRate: uggRunes.winRate,
          match: uggRunes.match,
          win: uggRunes.win,
        });
      }
    } finally {
      this.isCreatingRunes = false;
    }
  }

  async getOverviewJson(championId) {
    try {
      const versions = await utils.fetchJson(
        "https://ddragon.leagueoflegends.com/api/versions.json"
      );
      const currentVersion = versions[0];
      const uggVersion = currentVersion.split(".").slice(0, 2).join("_");

      utils.debugLog(
        `Using LoL version: ${currentVersion} (U.GG: ${uggVersion})`
      );

      const requestUrl = `${SETTINGS.baseOverviewUrl}/${SETTINGS.statsVersion}/overview/${uggVersion}/${SETTINGS.defaultGameMode}/${championId}/${SETTINGS.overviewVersion}.json`;
      return await utils.fetchJson(requestUrl);
    } catch (error) {
      utils.debugLog("Error fetching overview JSON:", error, "error");
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
    const championName = this.championData[championId];
    utils.debugLog(`Creating rune page for ${championName}`);

    const pages = await utils.getPages();
    if (!pages) return null;

    if (pages.length >= 2) {
      const currentPage = await utils.getCurrentPage();
      await utils.deletePage(currentPage?.id || pages[0].id);
    }

    const newPage = {
      name: `U.GG - ${championName} ${position}`,
      primaryStyleId: mainPerk,
      subStyleId: subPerk,
      selectedPerkIds,
      current: true,
      order: 0,
    };

    const createdPage = await utils.createPage(newPage);
    if (createdPage) {
      utils.debugLog(`Successfully created rune page for ${championName}`);
    }
    return createdPage;
  }

  async getRunesForChampion(championId, position) {
    try {
      const championName = this.championData[championId];
      utils.debugLog(
        `Fetching runes for ${championName} (${championId}) Position: ${UGG.positionsReversed[position]}`
      );

      const overview = await this.getOverviewJson(championId);
      if (!overview?.[SETTINGS.usedServer]?.[SETTINGS.defaultTier]) {
        utils.debugLog("No valid data found", null, "error");
        return null;
      }

      const tierData = overview[SETTINGS.usedServer][SETTINGS.defaultTier];
      const positionData = tierData[position]?.[0];

      if (!positionData) {
        const defaultPosition = CONFIG.positionMapping[CONFIG.defaultPosition];
        utils.debugLog(
          `No data found for position ${UGG.positionsReversed[position]}, falling back to ${CONFIG.defaultPosition}`,
          null,
          "warn"
        );
        // Only fallback to default position if no data for the requested position
        const defaultPositionData = tierData[defaultPosition]?.[0];
        if (!defaultPositionData) {
          utils.debugLog("No position data found", null, "error");
          return null;
        }
        return this.getRunesForChampion(championId, defaultPosition);
      }

      const perks = positionData[0];
      const statShards = positionData[8][2].map((str) => parseInt(str, 10));
      const mainPerk = perks[2];
      const subPerk = perks[3];
      const selectedPerkIds = utils.removePerkIds(perks[4]).concat(statShards);

      await this.createRunePage(
        championId,
        selectedPerkIds,
        UGG.positionsReversed[position],
        mainPerk,
        subPerk
      );

      return {
        selectedPerkIds,
        mainPerk,
        subPerk,
        position: UGG.positionsReversed[position],
        winRate: ((perks[1] / perks[0]) * 100).toFixed(2) + "%",
        match: perks[1],
        win: perks[0],
      };
    } catch (error) {
      utils.debugLog("Error processing runes:", error, "error");
      return null;
    }
  }
}

// Initialize plugin with context
export function init(context) {
  window.runePlugin = new RunePlugin();
  window.runePlugin.init(context);
}
