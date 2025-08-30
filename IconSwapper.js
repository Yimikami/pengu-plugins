/**
 * @name         IconSwapper
 * @author       Yimikami
 * @description  Allows changing your summoner icon to any icon clientside.
 * @version      0.0.1
 */

(() => {
  const CONFIG = {
    debug: {
      enabled: false, // Set to true to enable debug mode
      prefix: "[Icon Swapper]",
    },
    STYLE_ID: "icon-swapper-styles",
    MODAL_ID: "icon-swapper-modal",
    DATASTORE_KEY: "icon-swapper.selectedIcon",
    API_URL:
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons.json",
  };

  const debug = (...args) => {
    if (CONFIG.debug.enabled) {
      console.log(CONFIG.debug.prefix, ...args);
    }
  };

  function freezeProperties(object, properties) {
    if (!object) return;
    for (const type in object) {
      if (
        (properties && properties.length && properties.includes(type)) ||
        !properties ||
        !properties.length
      ) {
        let value = object[type];
        try {
          Object.defineProperty(object, type, {
            configurable: false,
            get: () => value,
            set: (v) => v,
          });
        } catch {}
      }
    }
  }

  class IconSwapper {
    constructor() {
      debug("Initializing Icon Swapper plugin");
      this.summonerId = null;
      this.observer = null;
      this.init();
    }

    async init() {
      try {
        debug("Starting initialization");

        // Add the action to the command bar
        window.CommandBar.addAction({
          name: "Change Summoner Icon",
          group: "Icon Swapper",
          perform: () => this.showIconModal(),
        });
        debug("Added command bar action");

        // Fetch current summoner data once
        try {
          debug("Fetching current summoner data");
          const res = await fetch("/lol-summoner/v1/current-summoner");
          const data = await res.json();
          this.summonerId = data.summonerId;
          debug(`Fetched summoner ID: ${this.summonerId}`);
        } catch (e) {
          console.error("Icon Swapper: Error fetching summoner data.", e);
          debug("Error fetching summoner data:", e);
        }

        // Apply the saved icon on load
        this.applyCustomIcon();
        debug("Initialization completed successfully");
      } catch (error) {
        console.error("Failed to initialize Icon Swapper:", error);
        debug("Initialization failed:", error);
      }
    }

    revertIcon() {
      debug("Reverting icon changes");
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
        debug("Disconnected DOM observer");
      }
      const styleElement = document.getElementById(CONFIG.STYLE_ID);
      if (styleElement) {
        styleElement.remove();
        debug("Removed custom styles");
      }
    }

    async applyCustomIcon() {
      debug("Applying custom icon");
      this.revertIcon();
      const selectedIconId = await window.DataStore.get(CONFIG.DATASTORE_KEY);
      debug(`Retrieved selected icon ID: ${selectedIconId}`);

      if (!selectedIconId || !this.summonerId) {
        debug(
          "No icon selected or summoner ID not available, skipping application"
        );
        return;
      }

      const iconUrl = `/lol-game-data/assets/v1/profile-icons/${selectedIconId}.jpg`;
      debug(`Using icon URL: ${iconUrl}`);

      const style = document.createElement("style");
      style.id = CONFIG.STYLE_ID;
      style.innerHTML = `
        :root { --custom-avatar: url("${iconUrl}"); }
        .top > .icon-image.has-icon, .style-profile-champion-icon-masked > img, summoner-icon {
          content: var(--custom-avatar) !important;
        }
      `;
      document.head.appendChild(style);
      debug("Injected custom CSS styles");

      this.observeDOM();
      console.log(`Icon Swapper: Applied icon ID ${selectedIconId}.`);
      debug(`Successfully applied icon ID ${selectedIconId}`);
    }

    observeDOM() {
      debug("Setting up DOM observer");

      const updateAndFreezeIcon = (element) => {
        const iconElement = element.shadowRoot
          ?.querySelector("lol-regalia-crest-v2-element")
          ?.shadowRoot?.querySelector(".lol-regalia-summoner-icon");
        if (iconElement) {
          iconElement.style.backgroundImage = "var(--custom-avatar)";
          freezeProperties(iconElement.style, ["backgroundImage"]);
          debug("Updated and froze icon element");
        }
      };

      const selectors = [
        `lol-regalia-hovercard-v2-element[summoner-id="${this.summonerId}"]`,
        "lol-regalia-profile-v2-element",
        `lol-regalia-parties-v2-element[summoner-id="${this.summonerId}"]`,
      ];
      const combinedSelector = selectors.join(", ");
      debug(`Using selectors: ${combinedSelector}`);

      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node instanceof Element) {
              if (node.matches(combinedSelector)) {
                debug("Found matching element, updating icon");
                updateAndFreezeIcon(node);
              }
              const matchingElements = node.querySelectorAll(combinedSelector);
              if (matchingElements.length > 0) {
                debug(
                  `Found ${matchingElements.length} matching child elements`
                );
                matchingElements.forEach(updateAndFreezeIcon);
              }
            }
          }
        }
      });

      this.observer.observe(document.body, { childList: true, subtree: true });
      const existingElements = document.querySelectorAll(combinedSelector);
      debug(`Found ${existingElements.length} existing elements to update`);
      existingElements.forEach(updateAndFreezeIcon);
      debug("DOM observer setup completed");
    }

    async showIconModal() {
      debug("Opening icon selection modal");
      document.getElementById(CONFIG.MODAL_ID)?.remove();

      const modal = document.createElement("div");
      modal.id = CONFIG.MODAL_ID;
      modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;`;
      modal.onclick = (e) => {
        if (e.target === modal) {
          debug("Modal closed by clicking outside");
          modal.remove();
        }
      };

      const content = document.createElement("div");
      content.style.cssText = `width: 80%; max-width: 900px; height: 70%; background: #111; border: 1px solid #555; border-radius: 8px; display: flex; flex-direction: column; padding: 20px;`;

      content.innerHTML = `
        <h1 style="color: #eee; text-align: center; margin-bottom: 20px;">Select a Summoner Icon</h1>
        <div class="icon-grid" style="flex-grow: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 20px;">
            <p style="color: #888; grid-column: 1 / -1; text-align: center;">Loading icons...</p>
        </div>
        <div style="padding-top: 15px; text-align: center;">
            <button class="revert-button" style="padding: 10px 20px; background: #a42020; color: white; border: none; border-radius: 5px; cursor: pointer;">Revert to Default</button>
            <p style="color: #888; font-size: 12px;">This will reset client.</p>
        </div>
      `;

      modal.appendChild(content);
      document.body.appendChild(modal);
      debug("Modal created and added to DOM");

      content.querySelector(".revert-button").onclick = async () => {
        debug("Revert button clicked, resetting to default icon");
        await window.DataStore.set(CONFIG.DATASTORE_KEY, null);
        this.revertIcon();
        modal.remove();
        debug("Restarting client to apply changes");
        fetch("/riotclient/kill-and-restart-ux", { method: "POST" });
      };

      const grid = content.querySelector(".icon-grid");
      try {
        debug("Fetching icons from API");
        const response = await fetch(CONFIG.API_URL);
        const icons = await response.json();
        debug(`Fetched ${icons.length} icons from API`);
        grid.innerHTML = "";

        const validIcons = [];
        const iconPromises = icons
          .sort((a, b) => b.id - a.id)
          .filter((icon) => icon.id !== -1)
          .map((icon) => {
            return new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                debug(`Icon ${icon.id} loaded successfully`);
                validIcons.push({ ...icon, element: img });
                resolve();
              };
              img.onerror = () => {
                debug(`Icon ${icon.id} failed to load`);
                resolve();
              };
              img.src = `/lol-game-data/assets/v1/profile-icons/${icon.id}.jpg`;
              img.title = `ID: ${icon.id}`;
              img.style.cssText =
                "width: 80px; height: 80px; border-radius: 50%; cursor: pointer; transition: transform 0.2s;";
              img.onmouseover = () => (img.style.transform = "scale(1.1)");
              img.onmouseout = () => (img.style.transform = "scale(1)");

              img.onclick = async () => {
                debug(`Icon clicked: ID ${icon.id}`);
                await window.DataStore.set(CONFIG.DATASTORE_KEY, icon.id);
                window.Toast.success(`Icon changed to ID ${icon.id}!`);
                await this.applyCustomIcon();
                modal.remove();
                debug("Icon selection completed");
              };
            });
          });

        await Promise.all(iconPromises);

        validIcons.forEach((icon) => {
          grid.appendChild(icon.element);
        });

        debug(`Icon grid populated with ${validIcons.length} valid icons`);

        if (validIcons.length === 0) {
          grid.innerHTML =
            '<p style="color: #e63946;">No valid icons found. Please try again later.</p>';
        }
      } catch (error) {
        grid.innerHTML =
          '<p style="color: #e63946;">Failed to load icons. Please try again later.</p>';
        console.error("Icon Swapper: Failed to fetch profile icons.", error);
        debug("Failed to fetch profile icons:", error);
      }
    }
  }

  window.addEventListener("load", () => {
    debug("Client loaded, initializing Icon Swapper plugin");
    window.iconSwapper = new IconSwapper();
  });
})();
