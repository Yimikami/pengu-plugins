/**
 * @name ChampionDismisser
 * @author Yimikami
 * @description Allows blacklisting specific champions to prevent selecting them in Champion Select.
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.3
 */

(() => {
  const CONFIG = {
    debug: {
      enabled: false,
      prefix: "[Champion Dismisser]",
    },
    DATASTORE_KEY: "champion-dismisser.blacklist",
    MODAL_ID: "champion-dismisser-modal",
    STYLE_ID: "champion-dismisser-styles",
    ENDPOINTS: {
      CHAMPION_SUMMARY: "/lol-game-data/assets/v1/champion-summary.json",
      OWNED_CHAMPIONS: "/lol-champions/v1/owned-champions-minimal",
    },
  };

  const debug = (...args) => {
    if (CONFIG.debug.enabled) {
      console.log(CONFIG.debug.prefix, ...args);
    }
  };

  class ChampionDismisser {
    constructor() {
      debug("Initializing Champion Dismisser plugin");
      this.champions = [];
      this.ownedChampionIds = new Set();
      this.blacklist = [];
      this.observer = null;
      this.blockedNodes = new Set();
      this.blockClick = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
      this.init();
    }

    async init() {
      try {
        await this.loadBlacklist();
        this.injectStyles();
        this.setupCommandBar();
        this.observeDOM();
        this.setupCleanup();
        await this.fetchChampionData();
      } catch (error) {
        console.error("Champion Dismisser: Initialization failed", error);
      }
    }

    async loadBlacklist() {
      try {
        const stored = await window.DataStore.get(CONFIG.DATASTORE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        this.blacklist = Array.isArray(parsed) ? [...new Set(parsed.filter(id => Number.isInteger(id) && id > 0))] : [];
        debug(`Loaded blacklist: ${this.blacklist.length} champions`);
      } catch (error) {
        debug("Error loading blacklist", error);
        this.blacklist = [];
      }
    }

    async saveBlacklist() {
      try {
        await window.DataStore.set(
          CONFIG.DATASTORE_KEY,
          JSON.stringify(this.blacklist)
        );
        debug("Saved blacklist");
        this.processExistingChampions();
      } catch (error) {
        console.error("Error saving blacklist", error);
      }
    }

    async fetchChampionData() {
      try {
        const responses = await Promise.all([
          fetch(CONFIG.ENDPOINTS.CHAMPION_SUMMARY),
          fetch(CONFIG.ENDPOINTS.OWNED_CHAMPIONS),
        ]);
        if (responses.some(res => !res.ok)) throw new Error("Champion inventory is unavailable");
        const [data, inventory] = await Promise.all(responses.map(res => res.json()));
        if (!Array.isArray(data) || !Array.isArray(inventory)) throw new Error("Invalid champion inventory");
        const owned = new Set(inventory.filter(c => c.ownership?.owned === true).map(c => c.id));
        this.champions = data
          // Classic variants have separate IDs (e.g. 60001) and the Jade_ alias prefix.
          .filter(c => Number.isInteger(c.id) && c.id > 0 && owned.has(c.id) && !/^Jade_/i.test(c.alias || ""))
          .sort((a, b) => a.name.localeCompare(b.name));
        this.ownedChampionIds = new Set(this.champions.map(c => c.id));
        this.processExistingChampions();
        debug(`Fetched ${this.champions.length} owned standard champions`);
        return true;
      } catch (error) {
        this.champions = [];
        this.ownedChampionIds.clear();
        this.processExistingChampions();
        console.error("Error fetching champions", error);
        return false;
      }
    }

    injectStyles() {
      const css = `
        .champion-dismisser-disabled {
            filter: grayscale(100%) brightness(0.5) !important;
            pointer-events: none !important;
            cursor: not-allowed !important;
            opacity: 0.6 !important;
            position: relative;
        }
        
        .champion-dismisser-disabled::after {
            content: "DISABLED";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #ff4444;
            font-weight: bold;
            font-size: 10px;
            text-shadow: 1px 1px 2px black;
            z-index: 100;
            background: rgba(0,0,0,0.7);
            padding: 2px 4px;
            border-radius: 4px;
        }

        /* Modal Styles */
        #${CONFIG.MODAL_ID} .champion-card {
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
        }
        #${CONFIG.MODAL_ID} .champion-card:hover {
            transform: scale(1.05);
        }
        #${CONFIG.MODAL_ID} .champion-card.blacklisted {
            filter: grayscale(100%);
            border-color: #ff4444;
            opacity: 0.7;
        }
        #${CONFIG.MODAL_ID} .champion-card.blacklisted::after {
             content: "🚫";
             position: absolute;
             top: 5px;
             right: 5px;
             font-size: 20px;
        }
      `;
      const style = document.createElement("style");
      style.id = CONFIG.STYLE_ID;
      style.textContent = css;
      document.head.appendChild(style);
    }

    setupCommandBar() {
      window.CommandBar.addAction({
        name: "Configure Blacklist",
        group: "Champion Dismisser",
        perform: () => this.showConfigurationModal(),
      });
    }

    setupCleanup() {
      window.addEventListener("unload", () => {
        this.cleanup();
      });
    }

    cleanup() {
      this.observer?.disconnect();
      for (const node of this.blockedNodes) {
        node.removeEventListener("click", this.blockClick, true);
        node.classList.remove("champion-dismisser-disabled");
      }
      this.blockedNodes.clear();
      document.getElementById(CONFIG.STYLE_ID)?.remove();
      document.getElementById(CONFIG.MODAL_ID)?.remove();
    }

    // --- Core Logic ---

    observeDOM() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "childList") {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                if (this.isChampionNode(node)) {
                  this.checkAndDisableChampion(node);
                }
                const champions = node.querySelectorAll?.(
                  ".grid-champion, .champion-grid-cell"
                );
                if (champions) {
                  champions.forEach((c) => this.checkAndDisableChampion(c));
                }
              }
            });
          } else if (
            mutation.type === "attributes" &&
            this.isChampionNode(mutation.target)
          ) {
            this.checkAndDisableChampion(mutation.target);
          }
        });
        for (const node of this.blockedNodes) {
          if (!node.isConnected) {
            node.removeEventListener("click", this.blockClick, true);
            this.blockedNodes.delete(node);
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-id", "champion-id"],
      });

      this.observer = observer;
      this.processExistingChampions();
    }
    
    isChampionNode(node) {
        return node.classList?.contains("grid-champion") || node.classList?.contains("champion-grid-cell");
    }

    processExistingChampions() {
      const champions = document.querySelectorAll(".grid-champion, .champion-grid-cell");
      champions.forEach((c) => this.checkAndDisableChampion(c));
    }

    checkAndDisableChampion(node) {
      if (!node) return;
      const id = node.getAttribute("data-id") || node.getAttribute("champion-id");

      if (id && this.ownedChampionIds.has(Number(id)) && this.blacklist.includes(Number(id))) {
        node.classList.add("champion-dismisser-disabled");
        node.addEventListener("click", this.blockClick, true);
        this.blockedNodes.add(node);
      } else {
        node.classList.remove("champion-dismisser-disabled");
        node.removeEventListener("click", this.blockClick, true);
        this.blockedNodes.delete(node);
      }
    }

    // --- UI Logic ---

    async showConfigurationModal() {
      const existing = document.getElementById(CONFIG.MODAL_ID);
      if (existing) existing.remove();

      const modal = document.createElement("div");
      modal.id = CONFIG.MODAL_ID;
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.8); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
      `;
      
      const content = document.createElement("div");
      content.style.cssText = `
        width: 80%; height: 80%; background: #1e2328; border: 2px solid #785a28;
        display: flex; flex-direction: column; padding: 20px; box-shadow: 0 0 20px rgba(0,0,0,0.5);
      `;

      content.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <h2 style="color: #f0e6d2; margin: 0;">Blacklist Configuration</h2>
                <button id="clear-all" style="padding: 5px 10px; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Clear All</button>
            </div>
            <button id="close-modal" style="background: none; border: none; color: #f0e6d2; font-size: 24px; cursor: pointer;">&times;</button>
        </div>
        <div style="margin-bottom: 20px;">
            <input type="text" id="champ-search" placeholder="Search owned champions..."
                style="width: 100%; padding: 10px; background: #0f1215; border: 1px solid #785a28; color: #f0e6d2; font-size: 16px;">
        </div>
        <div id="champ-grid" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 15px; padding: 10px;">
            <!-- Champions injected here -->
        </div>
        <div style="margin-top: 20px; text-align: right; color: #888;">
            Owned champions only. Classic champions are excluded.
        </div>
      `;

      modal.appendChild(content);
      document.body.appendChild(modal);

      const grid = content.querySelector("#champ-grid");
      const search = content.querySelector("#champ-search");
      const close = content.querySelector("#close-modal");
      const clearAll = content.querySelector("#clear-all");

      const renderChampions = (filterText = "") => {
        grid.innerHTML = "";
        this.champions.forEach(champ => {
          if (filterText && !champ.name.toLowerCase().includes(filterText.toLowerCase())) return;

          const card = document.createElement("div");
          card.className = `champion-card ${this.blacklist.includes(champ.id) ? "blacklisted" : ""}`;
          card.style.cssText = `position: relative; display: flex; flex-direction: column; align-items: center;`;
          
          card.innerHTML = `
            <img src="/lol-game-data/assets/v1/champion-icons/${champ.id}.png" 
                style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid #463714;">
            <span style="color: #f0e6d2; margin-top: 5px; font-size: 12px; text-align: center;">${champ.name}</span>
          `;

          card.onclick = () => {
            this.toggleBlacklist(champ.id);
            renderChampions(search.value); // Re-render to update state
          };

          grid.appendChild(card);
        });
      };

      search.oninput = (e) => renderChampions(e.target.value);
      close.onclick = () => modal.remove();
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
      
      clearAll.onclick = () => {
          if (confirm("Are you sure you want to clear the blacklist?")) {
            this.blacklist = [];
            this.saveBlacklist();
            renderChampions(search.value);
          }
      };

      grid.textContent = "Loading owned champions...";
      const loaded = await this.fetchChampionData();
      if (!modal.isConnected) return;
      if (loaded) renderChampions(search.value);
      else grid.textContent = "Could not load owned champions. Close and reopen to retry.";
    }

    toggleBlacklist(champId) {
        if (this.blacklist.includes(champId)) {
            this.blacklist = this.blacklist.filter(id => id !== champId);
        } else {
            if (!this.ownedChampionIds.has(champId)) return;
            this.blacklist.push(champId);
        }
        this.saveBlacklist();
    }
  }

  window.addEventListener("load", () => {
    window.ChampionDismisser = new ChampionDismisser();
  });
})();
