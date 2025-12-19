/**
 * @name ARAMBotEnabler
 * @author Yimikami
 * @description Enables adding bots in ARAM custom games [Probably not working]
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.1
 */

(() => {
  // Constants
  const CONFIG = {
    debug: {
      enabled: false, // Set to true to enable debug mode
      prefix: "[ARAMBotEnabler]",
    },
    selectors: {
      botButton: "lol-uikit-flat-button-secondary[disabled]",
      eligibilityList: ".parties-point-eligibility-list",
      botSelect: "aram-bot-select",
    },
    api: {
      bots: "https://gist.githubusercontent.com/Yimikami/2cdc24ea05fec29dcc358b8c411735e6/raw/654f55a9162f6fc4c6a338e23d061d66a1e656c3/availableBots.json",
      addBot: "/lol-lobby/v1/lobby/custom/bots",
    },
    difficulties: [
      { id: "RSINTERMEDIATE", name: "Intermediate" },
      { id: "RSINTRO", name: "Intro" },
      { id: "RSBEGINNER", name: "Beginner" },
    ],
    cache: {
      key: "aram-bot-cache",
      expiry: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  // Debug utility function
  const debug = (...args) => {
    if (CONFIG.debug.enabled) {
      console.log(CONFIG.debug.prefix, ...args);
    }
  };

  // Utility functions
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  class AramBotEnabler {
    constructor() {
      debug("Initializing ARAM Bot Enabler");
      this.botSelect = null;
      this.difficultySelect = null;
      this.availableBots = [];
      this.observer = null;
      this.retryCount = 0;
      this.maxRetries = 3;
      this.init();
    }

    async init() {
      try {
        debug("Starting initialization");
        await this.loadBots();
        this.observeDOM();
        this.enableAramBots();
        this.setupCleanup();
        debug("Initialization completed successfully");
      } catch (error) {
        console.error("Failed to initialize ARAM Bot Enabler:", error);
        debug("Initialization failed:", error);
      }
    }

    setupCleanup() {
      debug("Setting up cleanup handlers");
      window.addEventListener("unload", () => {
        this.cleanup();
      });
    }

    cleanup() {
      debug("Cleaning up resources");
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }

    async loadBots() {
      try {
        debug("Loading bots data");
        // Try to load from cache first
        const cached = this.loadFromCache();
        if (cached) {
          debug("Loaded bots from cache:", cached.length, "bots");
          this.availableBots = cached;
          return;
        }

        debug("Fetching bots from API:", CONFIG.api.bots);
        const response = await fetch(CONFIG.api.bots);
        if (!response.ok)
          throw new Error(`Failed to load bots: ${response.status}`);
        const botsData = await response.json();
        this.availableBots = botsData[0].sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        debug("Loaded bots from API:", this.availableBots.length, "bots");

        // Cache the results
        this.saveToCache(this.availableBots);
      } catch (error) {
        console.error("Error loading bots:", error);
        debug("Error loading bots:", error);
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          debug(`Retrying bot load (${this.retryCount}/${this.maxRetries})...`);
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * this.retryCount)
          );
          return this.loadBots();
        }
        // Fallback to window.availableBots if all retries fail
        debug("Using fallback bots data from window.availableBots");
        this.availableBots =
          window.availableBots?.[0]?.sort((a, b) =>
            a.name.localeCompare(b.name)
          ) || [];
        debug("Fallback bots loaded:", this.availableBots.length, "bots");
      }
    }

    loadFromCache() {
      try {
        const cached = localStorage.getItem(CONFIG.cache.key);
        if (!cached) {
          debug("No cached bots data found");
          return null;
        }

        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp > CONFIG.cache.expiry) {
          debug("Cached bots data expired, removing from cache");
          localStorage.removeItem(CONFIG.cache.key);
          return null;
        }

        debug("Loaded bots from cache, age:", Date.now() - timestamp, "ms");
        return data;
      } catch (error) {
        console.error("Error loading from cache:", error);
        debug("Error loading from cache:", error);
        return null;
      }
    }

    saveToCache(data) {
      try {
        localStorage.setItem(
          CONFIG.cache.key,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          })
        );
        debug("Saved bots data to cache");
      } catch (error) {
        console.error("Error saving to cache:", error);
        debug("Error saving to cache:", error);
      }
    }

    createDropdownOption(value, text, content = null) {
      const option = document.createElement("lol-uikit-dropdown-option");
      option.setAttribute("slot", "lol-uikit-dropdown-option");
      option.setAttribute("value", value);

      if (content) {
        option.appendChild(content);
      } else {
        option.textContent = text;
      }

      return option;
    }

    createChampionContent(bot) {
      const content = document.createElement("div");
      content.style = "display: flex; align-items: center;";

      // Create image element with error handling
      const img = document.createElement("img");
      img.src = `/lol-game-data/assets/v1/champion-icons/${bot.id}.png`;
      img.style =
        "width: 24px; height: 24px; margin-right: 8px; border-radius: 50%;";
      img.onerror = () => {
        debug("Failed to load champion icon for:", bot.name, "using default");
        img.src = "/lol-game-data/assets/v1/champion-icons/-1.png"; // Default icon
      };

      const span = document.createElement("span");
      span.textContent = bot.name;

      content.appendChild(img);
      content.appendChild(span);
      return content;
    }

    createDropdown() {
      const dropdown = document.createElement("lol-uikit-framed-dropdown");
      dropdown.style = "height: 32px;";
      dropdown.setAttribute("direction", "downward");
      dropdown.setAttribute("tabindex", "0");
      return dropdown;
    }

    createBotSelect() {
      debug("Creating bot selection dropdown");
      const dropdown = this.createDropdown();
      dropdown.id = CONFIG.selectors.botSelect;

      const fragment = document.createDocumentFragment();
      fragment.appendChild(this.createDropdownOption("", "Random Champion"));

      this.availableBots.forEach((bot) => {
        const content = this.createChampionContent(bot);
        fragment.appendChild(this.createDropdownOption(bot.id, null, content));
      });

      dropdown.appendChild(fragment);
      debug(
        "Bot selection dropdown created with",
        this.availableBots.length,
        "options"
      );
      return dropdown;
    }

    createDifficultySelect() {
      debug("Creating difficulty selection dropdown");
      const dropdown = this.createDropdown();
      const fragment = document.createDocumentFragment();

      fragment.appendChild(this.createDropdownOption("", "Random Difficulty"));
      CONFIG.difficulties.forEach((difficulty) => {
        fragment.appendChild(
          this.createDropdownOption(difficulty.id, difficulty.name)
        );
      });

      dropdown.appendChild(fragment);
      debug(
        "Difficulty selection dropdown created with",
        CONFIG.difficulties.length,
        "options"
      );
      return dropdown;
    }

    async addBot(teamId, championId, difficulty, button) {
      if (!button) {
        debug("No button provided for addBot");
        return;
      }

      const originalText = button.textContent;
      button.textContent = "Adding...";
      button.setAttribute("disabled", "true");

      const botData = {
        botDifficulty:
          difficulty ||
          CONFIG.difficulties[
            Math.floor(Math.random() * CONFIG.difficulties.length)
          ].id,
        championId:
          championId ||
          this.availableBots[
            Math.floor(Math.random() * this.availableBots.length)
          ].id,
        teamId: teamId.toString(),
        position: "MIDDLE",
        botUuid: crypto.randomUUID(),
      };

      debug("Adding bot with data:", botData);

      try {
        const response = await fetch(CONFIG.api.addBot, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(botData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw error;
        }

        debug("Bot added successfully");
        button.style.backgroundColor = "#28a745";
        button.textContent = "Added!";
      } catch (error) {
        console.error("Error adding bot:", error);
        debug("Error adding bot:", error);
        button.style.backgroundColor = "#dc3545";
        button.textContent = "Failed!";
      } finally {
        setTimeout(() => {
          button.removeAttribute("disabled");
          button.style.backgroundColor = "";
          button.textContent = originalText;
        }, 2000);
      }
    }

    createDropdowns() {
      if (document.getElementById(CONFIG.selectors.botSelect)) {
        debug("Dropdowns already exist, skipping creation");
        return;
      }

      const pointEligibilityList = document.querySelector(
        CONFIG.selectors.eligibilityList
      );
      if (!pointEligibilityList) {
        debug("Eligibility list not found, cannot create dropdowns");
        return;
      }

      debug("Creating dropdowns");
      const fragment = document.createDocumentFragment();
      this.botSelect = this.createBotSelect();
      this.difficultySelect = this.createDifficultySelect();

      [
        { dropdown: this.botSelect, style: "margin-left: 4px;" },
        { dropdown: this.difficultySelect, style: "margin-left: 4px;" },
      ].forEach(({ dropdown, style }) => {
        const item = document.createElement("li");
        item.style = style;
        item.appendChild(dropdown);
        fragment.appendChild(item);
      });

      pointEligibilityList.appendChild(fragment);
      debug("Dropdowns added to DOM");
    }

    enableButton(button, teamId) {
      if (button.hasAttribute("data-bot-enabled")) {
        debug("Button already enabled, skipping");
        return;
      }

      debug("Enabling button for team", teamId);
      button.removeAttribute("disabled");
      button.classList.remove("disabled");
      button.style.pointerEvents = "auto";
      button.style.opacity = "1";

      button.onclick = () => {
        const selectedChampOption = this.botSelect?.querySelector(
          "lol-uikit-dropdown-option[selected]"
        );
        const selectedDiffOption = this.difficultySelect?.querySelector(
          "lol-uikit-dropdown-option[selected]"
        );

        const championId =
          selectedChampOption?.value ||
          selectedChampOption?.getAttribute("value");
        const difficulty =
          selectedDiffOption?.value ||
          selectedDiffOption?.getAttribute("value");

        debug(
          "Button clicked - Champion:",
          championId,
          "Difficulty:",
          difficulty
        );

        this.addBot(
          teamId,
          championId ? parseInt(championId) : null,
          difficulty || null,
          button
        );
      };

      button.setAttribute("data-bot-enabled", "true");
      debug("Button enabled successfully");
    }

    enableAramBots() {
      const disabledBotButtons = Array.from(
        document.querySelectorAll(CONFIG.selectors.botButton)
      ).filter((button) => button.textContent.trim() === "Add Bot");

      debug("Found", disabledBotButtons.length, "disabled bot buttons");

      if (disabledBotButtons.length > 0) {
        this.createDropdowns();

        disabledBotButtons.forEach((button, index) => {
          const teamContainer = button.closest(".custom-game-team");
          const teamId = teamContainer?.classList.contains(
            "custom-game-team-two"
          )
            ? 200
            : 100;
          debug(`Enabling button ${index + 1} for team ${teamId}`);
          this.enableButton(button, teamId);
        });
      }
    }

    observeDOM() {
      debug("Setting up DOM observer");
      const debouncedEnable = debounce(() => {
        debug("DOM changed, checking for bot buttons");
        this.enableAramBots();
      }, 100);

      this.observer = new MutationObserver((mutations) => {
        if (
          mutations.some((mutation) =>
            Array.from(mutation.addedNodes).some(
              (node) => node.nodeType === Node.ELEMENT_NODE
            )
          )
        ) {
          debouncedEnable();
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
      debug("DOM observer started");
    }
  }

  // Initialize when window loads
  window.addEventListener("load", () => {
    debug("Window loaded, creating ARAM Bot Enabler instance");
    new AramBotEnabler();
  });
})();
