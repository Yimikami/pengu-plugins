/**
 * @name ProfileWinLose
 * @author Yimikami
 * @description Shows summoner's win/loss statistics and win rate on their profile
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.3
 */

import { settingsUtils } from "https://unpkg.com/blank-settings-utils@latest/Settings-Utils.js";

let data = [
  {
    groupName: "profile-winloss",
    titleKey: "el_profile_winloss",
    titleName: "Profile Win/Loss",
    capitalTitleKey: "el_profile_winloss_capital",
    capitalTitleName: "PROFILE WIN/LOSS",
    element: [
      {
        name: "profile-winloss-settings",
        title: "el_profile_winloss_settings",
        titleName: "PROFILE WIN/LOSS SETTINGS",
        class: "profile-winloss-settings",
        id: "profileWinlossSettings",
      },
    ],
  },
];

(() => {
  // Default configuration
  const DEFAULT_CONFIG = {
    updateInterval: 2000,
    api: {
      matchHistory: "/lol-match-history/v1/products/lol/",
    },
    debug: true,
    gamesCount: 40, // Number of games to fetch (max 200). Changeable in settings.
    retryAttempts: 3,
    retryDelay: 1000,
    cacheExpiry: 5 * 60 * 1000, // 5 minutes
    selectedQueue: "all", // Default queue type, filters matches from the last "gamesCount" games
    kdaDisplay: "show", // KDA display option: "show", "hide"
    seasonStartDate: new Date("2025-01-09T00:00:00Z").getTime(), // Season 15 start date
    seasonFilter: "on", // Season filter option: "on", "off"
  };

  // Configuration that will be loaded from DataStore
  let CONFIG = { ...DEFAULT_CONFIG };

  // Queue types mapping
  const QUEUE_TYPES = {
    all: { id: "all", name: "All Queues" },
    ranked_solo: { id: 420, name: "Ranked (Solo/Duo)" },
    ranked_flex: { id: 440, name: "Ranked (Flex)" },
    normal_draft: { id: 400, name: "Normal (Draft Pick)" },
    aram: { id: 450, name: "ARAM" },
    swiftplay: { id: 480, name: "Swiftplay" },
  };

  // Cache implementation
  const cache = new Map();

  // DataStore functions
  const SettingsStore = {
    async loadSettings() {
      try {
        const settings = DataStore.get("profile-winloss-settings");
        if (settings) {
          CONFIG = {
            ...DEFAULT_CONFIG,
            ...JSON.parse(settings),
          };
          debugLog("Settings loaded from DataStore:", CONFIG);
        }
      } catch (error) {
        console.error("[ProfileWinLose] Error loading settings:", error);
      }
    },

    async saveSettings() {
      try {
        const settings = {
          gamesCount: CONFIG.gamesCount,
          selectedQueue: CONFIG.selectedQueue,
          kdaDisplay: CONFIG.kdaDisplay,
          seasonFilter: CONFIG.seasonFilter,
        };
        DataStore.set("profile-winloss-settings", JSON.stringify(settings));
        debugLog("Settings saved to DataStore:", settings);
      } catch (error) {
        console.error("[ProfileWinLose] Error saving settings:", error);
      }
    },
  };

  function debugLog(message, data = null) {
    if (CONFIG.debug) {
      console.log(`[ProfileWinLose] ${message}`);
      if (data) console.log(data);
    }
  }

  // Utility functions
  const utils = {
    debounce(func, wait) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
      };
    },

    async retry(fn, retries = CONFIG.retryAttempts) {
      try {
        return await fn();
      } catch (error) {
        if (retries > 0) {
          await new Promise((resolve) =>
            setTimeout(
              resolve,
              CONFIG.retryDelay * (CONFIG.retryAttempts - retries + 1)
            )
          );
          return utils.retry(fn, retries - 1);
        }
        throw error;
      }
    },
  };

  class ProfileWinLoseStats {
    constructor() {
      this.observer = null;
      this.currentSummonerId = null;
      this.statsContainer = null;
      this.processedProfiles = new Set();
      this.styleElement = null;
      this.profileCheckInterval = null;
      this.lastCheckTime = 0;
      this.checkThrottle = 1000; // Check every 1 second instead of 2
      this.isCleanedUp = false;
      this.init();
    }

    async init() {
      await SettingsStore.loadSettings();
      this.observeProfile();
      this.setupCleanup();
      this.injectStyles();
      this.initializeSettings();

      // Initial check with a small delay to ensure DOM is ready
      setTimeout(() => this.checkCurrentProfile(), 100);

      // Use requestAnimationFrame for smoother performance
      const tick = () => {
        const now = Date.now();
        if (now - this.lastCheckTime >= this.checkThrottle) {
          this.lastCheckTime = now;
          this.checkCurrentProfile();
        }
        if (!this.isCleanedUp) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    }

    initializeSettings() {
      const addSettings = () => {
        const settingsContainer = document.querySelector(
          ".profile-winloss-settings"
        );
        if (!settingsContainer) return;

        settingsContainer.innerHTML = `
          <div class="lol-settings-general-row">
            <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 10px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <p class="lol-settings-window-size-text">Games to analyze:</p>
                <lol-uikit-flat-input type="number" style="width: 80px;">
                  <input type="number" min="1" max="200" value="${
                    CONFIG.gamesCount
                  }" 
                         style="width: 100%; text-align: center;">
                </lol-uikit-flat-input>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <p class="lol-settings-window-size-text">Queue Type:</p>
                <lol-uikit-framed-dropdown class="lol-settings-general-dropdown" style="width: 200px;" tabindex="0">
                  ${Object.entries(QUEUE_TYPES)
                    .map(
                      ([key, value]) => `
                    <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                      key === CONFIG.selectedQueue
                    }" value="${key}">
                      ${value.name}
                      <div class="lol-tooltip-component"></div>
                    </lol-uikit-dropdown-option>
                  `
                    )
                    .join("")}
                </lol-uikit-framed-dropdown>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <p class="lol-settings-window-size-text">Season 15 Filter:</p>
                <lol-uikit-framed-dropdown class="lol-settings-general-dropdown" style="width: 200px;" tabindex="0">
                  <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                    CONFIG.seasonFilter === "on"
                  }" value="on">
                    On
                    <div class="lol-tooltip-component"></div>
                  </lol-uikit-dropdown-option>
                  <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                    CONFIG.seasonFilter === "off"
                  }" value="off">
                    Off
                    <div class="lol-tooltip-component"></div>
                  </lol-uikit-dropdown-option>
                </lol-uikit-framed-dropdown>
              </div>
              <div style="display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: thin solid #3c3c41;">
                <p class="lol-settings-window-size-text">KDA Display:</p>
                <lol-uikit-framed-dropdown class="lol-settings-general-dropdown" style="width: 200px;" tabindex="0">
                  <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                    CONFIG.kdaDisplay === "show"
                  }" value="show">
                    Show KDA
                    <div class="lol-tooltip-component"></div>
                  </lol-uikit-dropdown-option>
                  <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                    CONFIG.kdaDisplay === "hide"
                  }" value="hide">
                    Hide KDA
                    <div class="lol-tooltip-component"></div>
                  </lol-uikit-dropdown-option>
                </lol-uikit-framed-dropdown>
              </div>
            </div>
          </div>
        `;

        // Add event listeners
        const input = settingsContainer.querySelector("input");
        input.addEventListener("change", this.handleSettingsChange.bind(this));

        // Queue Type dropdown
        const queueDropdown = settingsContainer.querySelectorAll(
          "lol-uikit-framed-dropdown"
        )[0];
        const queueOptions = queueDropdown.querySelectorAll(
          "lol-uikit-dropdown-option"
        );

        // Set initial queue selected value
        const currentQueueOption = Array.from(queueOptions).find(
          (opt) => opt.getAttribute("value") === CONFIG.selectedQueue
        );
        if (currentQueueOption) {
          queueOptions.forEach((opt) => opt.removeAttribute("selected"));
          currentQueueOption.setAttribute("selected", "");
          queueDropdown.setAttribute("selected-value", CONFIG.selectedQueue);
          queueDropdown.setAttribute(
            "selected-item",
            QUEUE_TYPES[CONFIG.selectedQueue].name
          );
        }

        queueOptions.forEach((option) => {
          option.addEventListener("click", () => {
            const value = option.getAttribute("value");
            this.handleQueueChange(value);

            // Update selected state
            queueOptions.forEach((opt) => opt.removeAttribute("selected"));
            option.setAttribute("selected", "");
            queueDropdown.setAttribute("selected-value", value);
            queueDropdown.setAttribute(
              "selected-item",
              QUEUE_TYPES[value].name
            );
          });
        });

        // Season Filter dropdown
        const seasonDropdown = settingsContainer.querySelectorAll(
          "lol-uikit-framed-dropdown"
        )[1];
        const seasonOptions = seasonDropdown.querySelectorAll(
          "lol-uikit-dropdown-option"
        );

        seasonOptions.forEach((option) => {
          option.addEventListener("click", () => {
            const value = option.getAttribute("value");
            this.handleSeasonChange(value);

            // Update selected state
            seasonOptions.forEach((opt) => opt.removeAttribute("selected"));
            option.setAttribute("selected", "");
            seasonDropdown.setAttribute("selected-value", value);
            seasonDropdown.setAttribute(
              "selected-item",
              value === "on" ? "On" : "Off"
            );
          });
        });

        // KDA Display dropdown
        const kdaDropdown = settingsContainer.querySelectorAll(
          "lol-uikit-framed-dropdown"
        )[2];
        const kdaOptions = kdaDropdown.querySelectorAll(
          "lol-uikit-dropdown-option"
        );

        kdaOptions.forEach((option) => {
          option.addEventListener("click", () => {
            const value = option.getAttribute("value");
            CONFIG.kdaDisplay = value;
            SettingsStore.saveSettings();

            // Update selected state
            kdaOptions.forEach((opt) => opt.removeAttribute("selected"));
            option.setAttribute("selected", "");
            kdaDropdown.setAttribute("selected-value", value);
            kdaDropdown.setAttribute(
              "selected-item",
              value === "show" ? "Show KDA" : "Hide KDA"
            );

            if (this.currentSummonerId) {
              this.updateStats(this.currentSummonerId);
            }
          });
        });
      };

      // Observe for settings container
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.classList?.contains("profile-winloss-settings")) {
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

    handleSettingsChange(e) {
      const newValue = parseInt(e.target.value);
      if (!isNaN(newValue) && newValue > 0 && newValue <= 200) {
        CONFIG.gamesCount = newValue;
        cache.clear();
        debugLog(`Games count updated to: ${newValue}`);
        Toast.success(`Games count updated to: ${newValue}`);
        SettingsStore.saveSettings();
        if (this.currentSummonerId) {
          this.updateStats(this.currentSummonerId);
        }
      } else {
        e.target.value = CONFIG.gamesCount;
        Toast.error("Please enter a number between 1 and 200");
      }
    }

    handleQueueChange(newQueue) {
      debugLog("Queue change triggered:", newQueue);
      if (QUEUE_TYPES[newQueue]) {
        CONFIG.selectedQueue = newQueue;
        cache.clear();
        debugLog(`Queue filter updated to: ${QUEUE_TYPES[newQueue].name}`);
        Toast.success(`Queue filter updated to: ${QUEUE_TYPES[newQueue].name}`);
        SettingsStore.saveSettings();

        // Force container recreation to ensure proper positioning
        if (this.statsContainer) {
          this.statsContainer.remove();
          this.statsContainer = null;
        }

        if (this.currentSummonerId) {
          this.createStatsContainer();
          this.updateStats(this.currentSummonerId);
        }
      }
    }

    handleSeasonChange(newSeason) {
      debugLog("Season 15 filter change triggered:", newSeason);
      CONFIG.seasonFilter = newSeason;
      cache.clear();
      debugLog(`Season 15 filter updated to: ${newSeason}`);
      Toast.success(
        `Season 15 filter updated to: ${newSeason === "on" ? "On" : "Off"}`
      );
      SettingsStore.saveSettings();

      if (this.currentSummonerId) {
        this.updateStats(this.currentSummonerId);
      }
    }

    setupCleanup() {
      window.addEventListener("unload", () => {
        this.isCleanedUp = true;
        this.observer?.disconnect();
        settingsObserver?.disconnect();
        this.styleElement?.remove();
        this.processedProfiles.clear();
        cache.clear();
      });
    }

    observeProfile() {
      const debouncedUpdate = utils.debounce(this.updateStats.bind(this), 250);

      this.observer = new MutationObserver(() => {
        const profileElements = document.querySelectorAll(
          "lol-regalia-profile-v2-element"
        );
        const searchedProfile = Array.from(profileElements).find(
          (el) => el.getAttribute("is-searched") === "true"
        );
        const targetProfile = searchedProfile || profileElements[0];

        if (!targetProfile) return;

        const puuid = targetProfile.getAttribute("puuid");
        if (!puuid || puuid === this.currentSummonerId) return;

        this.processedProfiles.clear();
        this.currentSummonerId = puuid;
        this.processedProfiles.add(puuid);
        debouncedUpdate(puuid);
        this.createStatsContainer();
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["puuid", "is-searched"],
      });
    }

    async updateStats(puuid) {
      try {
        this.displayLoading();
        const stats = await this.fetchStats(puuid);
        this.displayStats(stats);
      } catch (error) {
        console.error("[ProfileWinLose] Error updating stats:", error);
        this.displayError();
      }
    }

    displayLoading() {
      if (!this.statsContainer) {
        this.createStatsContainer();
      }
      const content = document.createElement("div");
      content.className = "profile-win-loss-stats";
      content.innerHTML = `
                <span class="loading">Loading...</span>
            `;
      this.statsContainer.replaceChildren(content);
    }

    async fetchStats(puuid) {
      const cacheKey = `stats_${puuid}_${CONFIG.selectedQueue}_${CONFIG.seasonFilter}`;
      const cachedData = cache.get(cacheKey);

      if (
        cachedData &&
        Date.now() - cachedData.timestamp < CONFIG.cacheExpiry
      ) {
        return cachedData.data;
      }

      const fetchData = async () => {
        const endpoint = `/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=0&endIndex=${
          CONFIG.gamesCount - 1
        }`;
        const response = await fetch(endpoint);
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      };

      const data = await utils.retry(fetchData);
      if (!data.games?.games) {
        return { wins: 0, losses: 0, winRate: 0, kda: 0 };
      }

      // Filter games by season if needed
      let filteredGames = data.games.games;
      if (CONFIG.seasonFilter === "on") {
        filteredGames = filteredGames.filter(
          (game) => game.gameCreation >= CONFIG.seasonStartDate
        );
      }

      // Filter by queue type
      filteredGames =
        CONFIG.selectedQueue === "all"
          ? filteredGames
          : filteredGames.filter(
              (game) => game.queueId === QUEUE_TYPES[CONFIG.selectedQueue].id
            );

      // Limit to the user-specified number of games after filtering
      const limitedGames = filteredGames.slice(0, CONFIG.gamesCount);

      const stats = limitedGames.reduce(
        (acc, game) => {
          const playerTeamId = game.participants[0].teamId;
          const teamWin =
            game.teams[playerTeamId === 100 ? 0 : 1].win === "Win";
          const player = game.participants[0];

          // Calculate KDA
          const kills = player.stats.kills || 0;
          const deaths = player.stats.deaths || 0;
          const assists = player.stats.assists || 0;

          return {
            wins: acc.wins + (teamWin ? 1 : 0),
            losses: acc.losses + (teamWin ? 0 : 1),
            totalKills: acc.totalKills + kills,
            totalDeaths: acc.totalDeaths + deaths,
            totalAssists: acc.totalAssists + assists,
          };
        },
        { wins: 0, losses: 0, totalKills: 0, totalDeaths: 0, totalAssists: 0 }
      );

      const totalGames = stats.wins + stats.losses;
      const kda =
        stats.totalDeaths === 0
          ? (stats.totalKills + stats.totalAssists).toFixed(1)
          : (
              (stats.totalKills + stats.totalAssists) /
              stats.totalDeaths
            ).toFixed(1);

      const result = {
        wins: stats.wins,
        losses: stats.losses,
        winRate:
          totalGames === 0 ? 0 : ((stats.wins / totalGames) * 100).toFixed(1),
        kda: kda,
      };

      cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    displayStats({ wins, losses, winRate, kda }) {
      if (!this.statsContainer) {
        this.createStatsContainer();
      }

      const content = document.createElement("div");
      content.className = "profile-win-loss-stats";
      content.innerHTML = `
        <div class="queue-type">${QUEUE_TYPES[CONFIG.selectedQueue].name}</div>
        <div class="stats-row">
          <span class="wins">${wins}W</span>
          <span class="losses">${losses}L</span>
          <span class="winrate">${winRate}%</span>
          ${
            CONFIG.kdaDisplay === "show"
              ? `<span class="kda">${kda}|KDA</span>`
              : ""
          }
        </div>
      `;

      this.statsContainer.replaceChildren(content);
    }

    displayError() {
      if (!this.statsContainer) {
        this.createStatsContainer();
      }
      this.statsContainer.innerHTML = `
                <div class="profile-win-loss-stats error">
                    <span>Stats unavailable</span>
                </div>
            `;
    }

    createStatsContainer() {
      debugLog("Creating stats container");

      const existingContainer = document.getElementById(
        "profile-win-loss-container"
      );
      if (existingContainer) {
        existingContainer.remove();
      }

      const profileElements = document.querySelectorAll(
        "lol-regalia-profile-v2-element"
      );
      const searchedProfile = Array.from(profileElements).find(
        (el) => el.getAttribute("is-searched") === "true"
      );
      const targetProfile = searchedProfile || profileElements[0];

      if (!targetProfile) {
        debugLog("No profile element found");
        return;
      }

      this.statsContainer = document.createElement("div");
      this.statsContainer.id = "profile-win-loss-container";

      // Find the summoner name element within the current profile
      const targetElement = targetProfile.querySelector(
        ".style-profile-summoner-status-icons"
      );
      if (targetElement) {
        targetElement.parentNode.insertBefore(
          this.statsContainer,
          targetElement.nextSibling
        );
        debugLog("Stats container added to DOM");
      } else {
        debugLog("Could not find target element for stats container");
      }
    }

    checkCurrentProfile() {
      // Skip check if container exists and is in DOM
      if (this.statsContainer && document.contains(this.statsContainer)) {
        return;
      }

      const profileElements = document.querySelectorAll(
        "lol-regalia-profile-v2-element"
      );
      if (!profileElements.length) return;

      const searchedProfile = Array.from(profileElements).find(
        (el) => el.getAttribute("is-searched") === "true"
      );
      const targetProfile = searchedProfile || profileElements[0];

      if (!targetProfile) return;

      const puuid = targetProfile.getAttribute("puuid");
      if (!puuid) return;

      // Only update if PUUID changed or container is missing
      if (
        puuid !== this.currentSummonerId ||
        !this.statsContainer ||
        !document.contains(this.statsContainer)
      ) {
        this.currentSummonerId = puuid;
        this.createStatsContainer();
        this.updateStats(puuid);
      }
    }

    injectStyles() {
      if (this.styleElement) {
        return;
      }

      const styles = `
                #profile-win-loss-container {
                    display: flex;
                    flex-direction: row;
                    justify-content: center;
                    position: absolute;
                    top: 655px;
                    width: 100%;
                }
                .profile-win-loss-stats {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 5px;
                    padding: 8px 15px;
                    font-size: 14px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    font-family: "LoL Display", "LoL Body", sans-serif;
                }
                .profile-win-loss-stats .stats-row {
                    display: flex;
                    gap: 15px;
                }
                .profile-win-loss-stats .queue-type {
                    color: #c8aa6e;
                    text-shadow: 0 0 3px rgba(200, 170, 110, 0.3);
                    margin-bottom: 2px;
                }
                .profile-win-loss-stats .wins {
                    color: #0acbe6;
                    text-shadow: 0 0 3px rgba(10, 203, 230, 0.3);
                }
                .profile-win-loss-stats .losses {
                    color: #ff4b4b;
                    text-shadow: 0 0 3px rgba(255, 75, 75, 0.3);
                }
                .profile-win-loss-stats .winrate {
                    color: #f0e6d2;
                    text-shadow: 0 0 3px rgba(240, 230, 210, 0.3);
                }
                .profile-win-loss-stats .kda {
                    color: #c8aa6e;
                    text-shadow: 0 0 3px rgba(200, 170, 110, 0.3);
                }
                .profile-win-loss-stats .loading {
                    color: #c8aa6e;
                    text-shadow: 0 0 3px rgba(200, 170, 110, 0.3);
                    animation: pulse 1.5s infinite;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
                #profile-winloss-settings .lol-settings-general-title {
                    color: #f0e6d2;
                    font-family: "LoL Display";
                    font-size: 14px;
                    font-weight: 700;
                    letter-spacing: 0.0375em;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                    -webkit-font-smoothing: antialiased;
                }
            `;

      const styleElement = document.createElement("style");
      styleElement.textContent = styles;
      document.head.appendChild(styleElement);
      this.styleElement = styleElement;
    }
  }

  // Initialize when window loads
  window.addEventListener("load", () => {
    settingsUtils(window, data);
    new ProfileWinLoseStats();
  });
})();
