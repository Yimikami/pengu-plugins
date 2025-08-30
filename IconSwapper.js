/**
 * @name         IconSwapper
 * @author       Yimikami
 * @description  Allows changing your summoner icon to any icon and uploading local icons for custom use clientside.
 * @version      0.0.2
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
    CUSTOM_ICON_KEY: "icon-swapper.customIcon",
    CUSTOM_ICONS_LIST_KEY: "icon-swapper.customIconsList",
    API_URL:
      "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons.json",
  };

  const debug = (...args) => {
    if (CONFIG.debug.enabled) {
      console.log(CONFIG.debug.prefix, ...args);
    }
  };

  const fileCache = {};

  function generateFileId(file) {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }

  function validateImageFile(file) {
    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    const maxSizeMB = 5;

    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Supported formats: JPG, PNG, GIF`,
      };
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      return {
        valid: false,
        error: `File too large. Maximum size: ${maxSizeMB}MB`,
      };
    }

    return { valid: true };
  }

  function processImageFile(
    file,
    maxWidth = 256,
    maxHeight = 256,
    quality = 0.8
  ) {
    return new Promise((resolve, reject) => {
      const fileId = generateFileId(file);
      if (fileCache[fileId]) {
        debug("Using cached processed image:", fileId);
        return resolve(fileCache[fileId]);
      }

      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl;
          if (file.type === "image/jpeg" || file.type === "image/jpg") {
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          } else if (file.type === "image/png") {
            dataUrl = canvas.toDataURL("image/png", quality);
          } else if (file.type === "image/gif") {
            dataUrl = canvas.toDataURL("image/png", quality);
          } else {
            dataUrl = canvas.toDataURL(file.type, quality);
          }

          fileCache[fileId] = {
            dataUrl,
            width,
            height,
            originalSize: file.size,
            processedSize: Math.round((dataUrl.length * 3) / 4),
          };

          debug("Image processed:", {
            original: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
            processed: `${(
              fileCache[fileId].processedSize /
              (1024 * 1024)
            ).toFixed(2)}MB`,
            width,
            height,
          });

          resolve(fileCache[fileId]);
        };

        img.onerror = () => {
          reject(new Error("Failed to load image"));
        };
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsDataURL(file);
    });
  }

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
      this.puuid = null;
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
          this.puuid = data.puuid;
          debug(
            `Fetched summoner ID: ${this.summonerId}, PUUID: ${this.puuid}`
          );
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
      const customIconData = await window.DataStore.get(CONFIG.CUSTOM_ICON_KEY);
      debug(
        `Retrieved selected icon ID: ${selectedIconId}, custom icon: ${
          customIconData ? "yes" : "no"
        }`
      );

      if (!selectedIconId && !customIconData) {
        debug(
          "No icon selected or summoner ID not available, skipping application"
        );
        return;
      }

      let iconUrl;
      if (customIconData) {
        iconUrl = customIconData;
        debug(`Using custom uploaded icon`);
      } else {
        iconUrl = `/lol-game-data/assets/v1/profile-icons/${selectedIconId}.jpg`;
        debug(`Using icon URL: ${iconUrl}`);
      }

      const style = document.createElement("style");
      style.id = CONFIG.STYLE_ID;
      style.innerHTML = `
        :root { --custom-avatar: url("${iconUrl}"); }
        .top > .icon-image.has-icon, summoner-icon {
          content: var(--custom-avatar) !important;
        }
      `;
      document.head.appendChild(style);
      debug("Injected custom CSS styles");

      this.observeDOM();
      if (customIconData) {
        console.log(`Icon Swapper: Applied custom uploaded icon.`);
        debug(`Successfully applied custom uploaded icon`);
      } else {
        console.log(`Icon Swapper: Applied icon ID ${selectedIconId}.`);
        debug(`Successfully applied icon ID ${selectedIconId}`);
      }
    }

    observeDOM() {
      debug("Setting up DOM observer");

      const updateAndFreezeIcon = (element) => {
        // Handle elements with shadow roots (like hovercards)
        const iconElement = element.shadowRoot
          ?.querySelector("lol-regalia-crest-v2-element")
          ?.shadowRoot?.querySelector(".lol-regalia-summoner-icon");
        if (iconElement) {
          iconElement.style.backgroundImage = "var(--custom-avatar)";
          freezeProperties(iconElement.style, ["backgroundImage"]);
          debug("Updated and froze icon element in shadow root");
          return;
        }

        // Handle direct crest elements
        if (element.tagName === "LOL-REGALIA-CREST-V2-ELEMENT") {
          const crestIcon = element.shadowRoot?.querySelector(
            ".lol-regalia-summoner-icon"
          );
          if (crestIcon) {
            crestIcon.style.backgroundImage = "var(--custom-avatar)";
            freezeProperties(crestIcon.style, ["backgroundImage"]);
            debug("Updated and froze direct crest element");
          }
        }
      };

      const selectors = [
        `lol-regalia-hovercard-v2-element[summoner-id="${this.summonerId}"]`,
        `lol-regalia-profile-v2-element[summoner-id="${this.summonerId}"]`,
        `lol-regalia-parties-v2-element[summoner-id="${this.summonerId}"]`,
        `lol-regalia-crest-v2-element[voice-puuid="${this.puuid}"]`,
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
        <div style="display: flex; flex-direction: column; height: 100%; max-height: 100%;">
          <div style="background: linear-gradient(135deg, #0a1428 0%, #1e2328 100%); border-bottom: 2px solid #785a28; padding: 20px 20px 15px 20px;">
            <h1 style="color: #f0e6d2; text-align: center; margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Summoner Icon Swapper</h1>
          </div>
          
          <div style="display: flex; margin: 0; border-bottom: 1px solid #463714;">
            <button id="tab-league" class="tab-button active" style="flex: 1; padding: 15px 20px; background: linear-gradient(135deg, #785a28 0%, #c89b3c 100%); color: #f0e6d2; border: none; cursor: pointer; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);">League Icons</button>
            <button id="tab-custom" class="tab-button" style="flex: 1; padding: 15px 20px; background: linear-gradient(135deg, #1e2328 0%, #2d3748 100%); color: #cdbe91; border: none; cursor: pointer; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);">Custom Icons</button>
          </div>
          
          <div id="tab-league-content" class="tab-content" style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
            <div class="icon-grid" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 12px; padding: 20px; background: linear-gradient(135deg, #0a1428 0%, #1e2328 100%);">
                <p style="color: #cdbe91; grid-column: 1 / -1; text-align: center; font-size: 16px; margin: 20px 0;">Loading icons...</p>
            </div>
          </div>
          
          <div id="tab-custom-content" class="tab-content" style="flex: 1; display: none; flex-direction: column; min-height: 0; overflow: hidden;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; height: 100%; min-height: 0;">
              <div style="background: linear-gradient(135deg, #1e2328 0%, #2d3748 100%); border: 1px solid #463714; border-radius: 8px; padding: 20px; display: flex; flex-direction: column;">
                <h3 style="color: #f0e6d2; margin: 0 0 15px 0; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Upload New Icon</h3>
                <div style="margin-bottom: 15px;">
                  <input type="file" id="custom-icon-upload" accept="image/jpeg,image/png,image/gif" style="display: none;">
                  <button id="upload-button" style="padding: 10px 16px; background: linear-gradient(135deg, #785a28 0%, #c89b3c 100%); color: #f0e6d2; border: none; border-radius: 6px; cursor: pointer; margin-right: 10px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Choose File</button>
                  <span id="file-name" style="color: #cdbe91; font-size: 12px; display: block; margin-top: 8px;">No file selected</span>
                </div>
                <div id="upload-preview" style="width: 100px; height: 100px; border: 2px solid #463714; border-radius: 50%; margin: 0 auto 15px auto; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #0a1428 0%, #1e2328 100%); box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);">
                  <span style="color: #785a28; font-size: 12px; text-align: center;">Preview</span>
                </div>
                <button id="add-custom" style="padding: 12px 16px; background: linear-gradient(135deg, #1e8a1e 0%, #2d9d2d 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.3);" disabled>Add to Collection</button>
              </div>
              
              <div style="background: linear-gradient(135deg, #1e2328 0%, #2d3748 100%); border: 1px solid #463714; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; overflow: hidden;">
                <h3 style="color: #f0e6d2; margin: 0 0 15px 0; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">Your Collection</h3>
                <div id="custom-icons-grid" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 12px; padding-right: 10px;">
                  <p style="color: #cdbe91; grid-column: 1 / -1; text-align: center; font-size: 14px; margin: 20px 0;">No custom icons yet.<br>Upload one to get started!</p>
                </div>
              </div>
            </div>
          </div>
          
          <div style="background: linear-gradient(135deg, #0a1428 0%, #1e2328 100%); border-top: 2px solid #785a28; padding: 15px 20px; text-align: center;">
            <button class="revert-button" style="padding: 12px 24px; background: linear-gradient(135deg, #a42020 0%, #c42e2e 100%); color: #f0e6d2; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">Revert to Default</button>
            <p style="color: #cdbe91; font-size: 11px; margin: 8px 0 0 0; opacity: 0.8;">This will reset the client to apply changes</p>
          </div>
        </div>
      `;

      modal.appendChild(content);
      document.body.appendChild(modal);
      debug("Modal created and added to DOM");

      content.querySelector(".revert-button").onclick = async () => {
        debug("Revert button clicked, resetting to default icon");
        await window.DataStore.set(CONFIG.DATASTORE_KEY, null);
        await window.DataStore.set(CONFIG.CUSTOM_ICON_KEY, null);
        this.revertIcon();
        modal.remove();
        debug("Restarting client to apply changes");
        fetch("/riotclient/kill-and-restart-ux", { method: "POST" });
      };

      const tabLeague = content.querySelector("#tab-league");
      const tabCustom = content.querySelector("#tab-custom");
      const tabLeagueContent = content.querySelector("#tab-league-content");
      const tabCustomContent = content.querySelector("#tab-custom-content");

      tabLeague.onclick = () => {
        tabLeague.classList.add("active");
        tabLeague.style.background =
          "linear-gradient(135deg, #785a28 0%, #c89b3c 100%)";
        tabLeague.style.color = "#f0e6d2";
        tabLeague.style.fontWeight = "bold";
        tabLeague.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.1)";
        tabCustom.classList.remove("active");
        tabCustom.style.background =
          "linear-gradient(135deg, #1e2328 0%, #2d3748 100%)";
        tabCustom.style.color = "#cdbe91";
        tabCustom.style.fontWeight = "normal";
        tabCustom.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.05)";
        tabLeagueContent.style.display = "flex";
        tabCustomContent.style.display = "none";
      };

      tabCustom.onclick = () => {
        tabCustom.classList.add("active");
        tabCustom.style.background =
          "linear-gradient(135deg, #785a28 0%, #c89b3c 100%)";
        tabCustom.style.color = "#f0e6d2";
        tabCustom.style.fontWeight = "bold";
        tabCustom.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.1)";
        tabLeague.classList.remove("active");
        tabLeague.style.background =
          "linear-gradient(135deg, #1e2328 0%, #2d3748 100%)";
        tabLeague.style.color = "#cdbe91";
        tabLeague.style.fontWeight = "normal";
        tabLeague.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.05)";
        tabCustomContent.style.display = "flex";
        tabLeagueContent.style.display = "none";
        this.loadCustomIcons();
      };

      const fileInput = content.querySelector("#custom-icon-upload");
      const uploadButton = content.querySelector("#upload-button");
      const fileName = content.querySelector("#file-name");
      const uploadPreview = content.querySelector("#upload-preview");
      const addCustomButton = content.querySelector("#add-custom");

      uploadButton.onclick = () => {
        fileInput.click();
      };

      fileInput.onchange = async (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          debug(`File selected: ${file.name}`);

          const validation = validateImageFile(file);
          if (!validation.valid) {
            window.Toast.error(validation.error);
            fileInput.value = "";
            fileName.textContent = "No file selected";
            return;
          }

          fileName.textContent = `Processing ${file.name}...`;
          addCustomButton.disabled = true;

          try {
            const processedFile = await processImageFile(file, 256, 256, 0.8);

            fileName.textContent = `${file.name} (${(
              processedFile.processedSize /
              (1024 * 1024)
            ).toFixed(2)}MB)`;

            uploadPreview.innerHTML = `<img src="${processedFile.dataUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;

            addCustomButton.disabled = false;
            addCustomButton.onclick = async () => {
              debug("Adding custom icon to list");
              await this.addCustomIcon(file.name, processedFile.dataUrl);
              window.Toast.success("Custom icon added to your collection!");

              fileInput.value = "";
              fileName.textContent = "No file selected";
              uploadPreview.innerHTML =
                '<span style="color: #785a28; font-size: 12px;">Preview</span>';
              addCustomButton.disabled = true;

              this.loadCustomIcons();
            };

            debug("Custom icon processed successfully");
          } catch (error) {
            debug("Error processing custom icon:", error);
            window.Toast.error("Failed to process image file");
            fileInput.value = "";
            fileName.textContent = "No file selected";
            uploadPreview.innerHTML =
              '<span style="color: #785a28; font-size: 12px;">Preview</span>';
          }
        }
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
                "width: 90px; height: 90px; border-radius: 50%; cursor: pointer; transition: all 0.3s ease; border: 3px solid transparent; box-shadow: 0 4px 8px rgba(0,0,0,0.3);";
              img.onmouseover = () => {
                img.style.transform = "scale(1.05)";
                img.style.borderColor = "#c89b3c";
                img.style.boxShadow =
                  "0 6px 12px rgba(0,0,0,0.4), 0 0 0 2px rgba(200,155,60,0.3)";
              };
              img.onmouseout = () => {
                img.style.transform = "scale(1)";
                img.style.borderColor = "transparent";
                img.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
              };

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

    async addCustomIcon(name, dataUrl) {
      debug(`Adding custom icon: ${name}`);
      const customIcons =
        (await window.DataStore.get(CONFIG.CUSTOM_ICONS_LIST_KEY)) || [];

      const newIcon = {
        id: Date.now().toString(),
        name: name,
        dataUrl: dataUrl,
        addedAt: new Date().toISOString(),
      };

      customIcons.push(newIcon);
      await window.DataStore.set(CONFIG.CUSTOM_ICONS_LIST_KEY, customIcons);
      debug(`Custom icon added. Total custom icons: ${customIcons.length}`);
    }

    async removeCustomIcon(iconId) {
      debug(`Removing custom icon: ${iconId}`);
      const customIcons =
        (await window.DataStore.get(CONFIG.CUSTOM_ICONS_LIST_KEY)) || [];
      const filteredIcons = customIcons.filter((icon) => icon.id !== iconId);
      await window.DataStore.set(CONFIG.CUSTOM_ICONS_LIST_KEY, filteredIcons);
      debug(`Custom icon removed. Total custom icons: ${filteredIcons.length}`);
    }

    async loadCustomIcons() {
      const customIconsGrid = document.querySelector("#custom-icons-grid");
      if (!customIconsGrid) return;

      const customIcons =
        (await window.DataStore.get(CONFIG.CUSTOM_ICONS_LIST_KEY)) || [];
      debug(`Loading ${customIcons.length} custom icons`);

      if (customIcons.length === 0) {
        customIconsGrid.innerHTML =
          '<p style="color: #888; grid-column: 1 / -1; text-align: center;">No custom icons yet. Upload one above!</p>';
        return;
      }

      customIconsGrid.innerHTML = "";

      customIcons.forEach((icon) => {
        const iconContainer = document.createElement("div");
        iconContainer.style.cssText =
          "position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px;";

        const img = document.createElement("img");
        img.src = icon.dataUrl;
        img.title = icon.name;
        img.style.cssText =
          "width: 90px; height: 90px; border-radius: 50%; cursor: pointer; transition: all 0.3s ease; border: 3px solid transparent; box-shadow: 0 4px 8px rgba(0,0,0,0.3);";

        img.onmouseover = () => {
          img.style.transform = "scale(1.05)";
          img.style.borderColor = "#c89b3c";
          img.style.boxShadow =
            "0 6px 12px rgba(0,0,0,0.4), 0 0 0 2px rgba(200,155,60,0.3)";
        };

        img.onmouseout = () => {
          img.style.transform = "scale(1)";
          img.style.borderColor = "transparent";
          img.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";
        };

        img.onclick = async () => {
          debug(`Applying custom icon: ${icon.name}`);
          await window.DataStore.set(CONFIG.CUSTOM_ICON_KEY, icon.dataUrl);
          await window.DataStore.set(CONFIG.DATASTORE_KEY, null);
          window.Toast.success(`Applied custom icon: ${icon.name}!`);
          await this.applyCustomIcon();
          document.getElementById(CONFIG.MODAL_ID)?.remove();
        };

        const nameLabel = document.createElement("div");
        nameLabel.textContent =
          icon.name.length > 12
            ? icon.name.substring(0, 12) + "..."
            : icon.name;
        nameLabel.style.cssText =
          "color: #f0e6d2; font-size: 12px; text-align: center; max-width: 90px; overflow: hidden; text-overflow: ellipsis; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.5);";

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "×";
        deleteButton.style.cssText =
          "position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: linear-gradient(135deg, #a42020 0%, #c42e2e 100%); color: #f0e6d2; border: 2px solid #0a1428; border-radius: 50%; cursor: pointer; font-size: 16px; font-weight: bold; display: none; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transition: all 0.2s ease;";

        iconContainer.onmouseenter = () => {
          deleteButton.style.display = "block";
          deleteButton.style.transform = "scale(1.1)";
        };

        iconContainer.onmouseleave = () => {
          deleteButton.style.display = "none";
          deleteButton.style.transform = "scale(1)";
        };

        deleteButton.onclick = async (e) => {
          e.stopPropagation();
          if (confirm(`Delete custom icon "${icon.name}"?`)) {
            await this.removeCustomIcon(icon.id);
            this.loadCustomIcons();
            window.Toast.success("Custom icon deleted!");
          }
        };

        iconContainer.appendChild(img);
        iconContainer.appendChild(nameLabel);
        iconContainer.appendChild(deleteButton);
        customIconsGrid.appendChild(iconContainer);
      });
    }
  }

  window.addEventListener("load", () => {
    debug("Client loaded, initializing Icon Swapper plugin");
    window.iconSwapper = new IconSwapper();
  });
})();
