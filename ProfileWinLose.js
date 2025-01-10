/**
 * @name ProfileWinLose
 * @author Yimikami
 * @description Shows summoner's win/loss statistics and win rate on their profile
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.2
 */

(() => {
  // Default configuration
  const DEFAULT_CONFIG = {
    updateInterval: 2000,
    api: {
      matchHistory: "/lol-match-history/v1/products/lol/",
    },
    debug: false,
    gamesCount: 40, // Number of games to fetch (max 200). Changeable in settings.
    retryAttempts: 3,
    retryDelay: 1000,
    cacheExpiry: 5 * 60 * 1000, // 5 minutes
    selectedQueue: "all", // Default queue type, filters matches from the last "gamesCount" games
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
  let settingsObserver = null;

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
      if (settingsObserver) {
        settingsObserver.disconnect();
      }

      const addSettings = (scrollable) => {
        if (!scrollable || document.getElementById("profile-winloss-settings"))
          return;

        const settingsRow = document.createElement("div");
        settingsRow.className = "lol-settings-general-row";
        settingsRow.id = "profile-winloss-settings";
        settingsRow.innerHTML = `
                    <div class="lol-settings-general-title">Profile Win/Loss Display</div>
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
                        <div style="display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: thin solid #3c3c41;">
                            <p class="lol-settings-window-size-text">Queue Type:</p>
                            <lol-uikit-framed-dropdown class="lol-settings-general-dropdown" style="width: 200px;" tabindex="0">
                                <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                                  CONFIG.selectedQueue === "all"
                                }" value="all">
                                    All Queues
                                    <div class="lol-tooltip-component"></div>
                                </lol-uikit-dropdown-option>
                                <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                                  CONFIG.selectedQueue === "swiftplay"
                                }" value="swiftplay">
                                    Normal (swiftplay)
                                    <div class="lol-tooltip-component"></div>
                                </lol-uikit-dropdown-option>
                                <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                                  CONFIG.selectedQueue === "ranked_solo"
                                }" value="ranked_solo">
                                    Ranked (Solo/Duo)
                                    <div class="lol-tooltip-component"></div>
                                </lol-uikit-dropdown-option>
                                <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                                  CONFIG.selectedQueue === "ranked_flex"
                                }" value="ranked_flex">
                                    Ranked (Flex)
                                    <div class="lol-tooltip-component"></div>
                                </lol-uikit-dropdown-option>
                                <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                                  CONFIG.selectedQueue === "normal_draft"
                                }" value="normal_draft">
                                    Normal (Draft Pick)
                                    <div class="lol-tooltip-component"></div>
                                </lol-uikit-dropdown-option>
                                <lol-uikit-dropdown-option slot="lol-uikit-dropdown-option" class="framed-dropdown-type" selected="${
                                  CONFIG.selectedQueue === "aram"
                                }" value="aram">
                                    ARAM
                                    <div class="lol-tooltip-component"></div>
                                </lol-uikit-dropdown-option>
                            </lol-uikit-framed-dropdown>
                        </div>
                    </div>
                `;

        const conductRow = scrollable.querySelector(
          ".lol-settings-general-row"
        );
        if (conductRow) {
          conductRow.parentNode.insertBefore(
            settingsRow,
            conductRow.nextSibling
          );
        } else {
          scrollable.firstElementChild?.appendChild(settingsRow);
        }

        // Add event listeners
        const input = settingsRow.querySelector("input");
        input.addEventListener("change", this.handleSettingsChange.bind(this));

        const dropdown = settingsRow.querySelector("lol-uikit-framed-dropdown");
        const dropdownOptions = dropdown.querySelectorAll(
          "lol-uikit-dropdown-option"
        );

        // Set initial selected value
        const currentOption = Array.from(dropdownOptions).find(
          (opt) => opt.getAttribute("value") === CONFIG.selectedQueue
        );
        if (currentOption) {
          dropdownOptions.forEach((opt) => opt.removeAttribute("selected"));
          currentOption.setAttribute("selected", "");
          dropdown.setAttribute("selected-value", CONFIG.selectedQueue);
          dropdown.setAttribute(
            "selected-item",
            QUEUE_TYPES[CONFIG.selectedQueue].name
          );
        }

        dropdownOptions.forEach((option) => {
          option.addEventListener("click", () => {
            const value = option.getAttribute("value");
            this.handleQueueChange(value);

            // Update selected state
            dropdownOptions.forEach((opt) => opt.removeAttribute("selected"));
            option.setAttribute("selected", "");
            dropdown.setAttribute("selected-value", value);
            dropdown.setAttribute("selected-item", QUEUE_TYPES[value].name);
          });
        });
      };

      settingsObserver = new MutationObserver(() => {
        const scrollable = document.querySelector(
          "div.lol-settings-options lol-uikit-scrollable"
        );
        if (scrollable) addSettings(scrollable);
      });

      settingsObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      document.addEventListener("click", (e) => {
        if (e.target?.closest("lol-uikit-navigation-item")) {
          const scrollable = document.querySelector(
            "div.lol-settings-options lol-uikit-scrollable"
          );
          if (scrollable) addSettings(scrollable);
        }
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
      const cacheKey = `stats_${puuid}_${CONFIG.selectedQueue}`;
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
        return { wins: 0, losses: 0, winRate: 0 };
      }

      const filteredGames =
        CONFIG.selectedQueue === "all"
          ? data.games.games
          : data.games.games.filter(
              (game) => game.queueId === QUEUE_TYPES[CONFIG.selectedQueue].id
            );

      const stats = filteredGames.reduce(
        (acc, game) => {
          const playerTeamId = game.participants[0].teamId;
          const teamWin =
            game.teams[playerTeamId === 100 ? 0 : 1].win === "Win";
          return {
            wins: acc.wins + (teamWin ? 1 : 0),
            losses: acc.losses + (teamWin ? 0 : 1),
          };
        },
        { wins: 0, losses: 0 }
      );

      const totalGames = stats.wins + stats.losses;
      const result = {
        ...stats,
        winRate:
          totalGames === 0 ? 0 : ((stats.wins / totalGames) * 100).toFixed(1),
      };

      cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    displayStats({ wins, losses, winRate }) {
      if (!this.statsContainer) {
        this.createStatsContainer();
      }

      const content = document.createElement("div");
      content.className = "profile-win-loss-stats";
      content.innerHTML = `
                <div class="queue-type">${
                  QUEUE_TYPES[CONFIG.selectedQueue].name
                }</div>
                <div class="stats-row">
                    <span class="wins">${wins}W</span>
                    <span class="losses">${losses}L</span>
                    <span class="winrate">${winRate}%</span>
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
  window.addEventListener("load", () => new ProfileWinLoseStats());
})();
