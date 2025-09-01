/**
 * @name         IconSwapper
 * @author       Yimikami
 * @description  Allows changing your summoner icon to any icon and uploading local icons for custom use clientside.
 * @version      0.1.0
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

  function validateImageUrl(url) {
    try {
      const urlObj = new URL(url);
      const validProtocols = ["http:", "https:"];

      if (!validProtocols.includes(urlObj.protocol)) {
        return {
          valid: false,
          error: "URL must use HTTP or HTTPS protocol",
        };
      }

      const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const pathname = urlObj.pathname.toLowerCase();
      const hasImageExtension = imageExtensions.some((ext) =>
        pathname.endsWith(ext)
      );

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: "Invalid URL format",
      };
    }
  }

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const maxWidth = 256;
        const maxHeight = 256;

        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve({
          dataUrl,
          width,
          height,
          originalUrl: url,
        });
      };

      img.onerror = () => {
        reject(new Error("Failed to load image from URL"));
      };

      img.src = url;
    });
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
      content.style.cssText = `width: 85%; max-width: 1000px; height: 75%; background: #1e2328; border: 1px solid #463714; display: flex; flex-direction: column; padding: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.3);`;

      content.innerHTML = `
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .tab-button {
            transition: all 0.2s ease !important;
          }

          .icon-grid img {
            transition: all 0.2s ease !important;
          }

          .icon-grid img:hover {
            transform: scale(1.05) !important;
          }

          input[type="url"]:focus {
            outline: none !important;
            border-color: #c89b3c !important;
          }

          input[type="text"]:focus {
            outline: none !important;
            border-color: #c89b3c !important;
          }

          #clear-search:hover {
            background: #463714 !important;
            color: #c89b3c !important;
          }

          button:hover {
            transform: translateY(-1px) !important;
          }

          #custom-icons-grid {
            place-items: center !important;
          }

          @media (max-width: 800px) {
            #custom-icons-grid {
              grid-template-columns: repeat(auto-fill, minmax(100px, 100px)) !important;
              gap: 12px !important;
            }
          }

          #custom-icons-grid:has(:nth-child(1):nth-last-child(1)) {
            justify-content: center !important;
          }

          #custom-icons-grid:has(:nth-child(2):nth-last-child(1)) {
            justify-content: center !important;
          }

          #custom-icons-grid:has(:nth-child(-n+3)) {
            justify-content: center !important;
            align-content: start !important;
          }
        </style>

        <div style="display: flex; height: 100%; max-height: 100%;">

          <div style="width: 200px; background: #0f2027; border-right: 1px solid #463714; display: flex; flex-direction: column;">
            <div style="padding: 16px; border-bottom: 1px solid #463714;">
              <h1 style="color: #f0e6d2; margin: 0; font-size: 18px; font-weight: 600;">Icon Swapper</h1>
            </div>
            <div style="flex: 1; padding: 16px 0;">
              <button id="tab-league" class="tab-button active" style="width: 100%; padding: 12px 20px; background: #c89b3c; color: #0f2027; border: none; cursor: pointer; font-weight: 500; font-size: 14px; margin-bottom: 8px; border-radius: 0;">League Icons</button>
              <button id="tab-custom" class="tab-button" style="width: 100%; padding: 12px 20px; background: transparent; color: #cdbe91; border: none; cursor: pointer; font-size: 14px; border-radius: 0;">Custom Icons</button>
            </div>
            <div style="padding: 12px; border-top: 1px solid #463714;">
              <button class="revert-button" style="width: 100%; padding: 10px 16px; background: #c8aa6e; color: #0f2027; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Revert to Default</button>
              <p style="color: #cdbe91; font-size: 11px; margin: 8px 0 0 0; line-height: 1.3; text-align: center;">Resets client</p>
            </div>
          </div>


          <div style="flex: 1; display: flex; flex-direction: column;">
          
            <div id="tab-league-content" class="tab-content" style="flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
              <div style="padding: 16px 24px 0 24px; background: #1e2328; border-bottom: 1px solid #463714;">
                <div style="position: relative; max-width: 400px;">
                  <input type="text" id="icon-search" placeholder="Search by icon ID..." style="width: 100%; padding: 10px 36px 10px 12px; background: #0f2027; border: 1px solid #463714; border-radius: 6px; color: #f0e6d2; font-size: 14px; box-sizing: border-box; transition: border-color 0.2s ease;">
                  <button id="clear-search" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #785a28; cursor: pointer; font-size: 16px; width: 24px; height: 24px; display: none; align-items: center; justify-content: center; border-radius: 3px; transition: all 0.2s ease;">×</button>
                </div>
                <p id="search-results-info" style="color: #cdbe91; font-size: 12px; margin: 8px 0 0 0; min-height: 16px;"></p>
              </div>
              <div class="icon-grid" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 16px; padding: 24px; background: #1e2328;">
                  <div style="grid-column: 1 / -1; text-align: center; margin: 40px 20px;">
                    <div style="display: inline-block; width: 32px; height: 32px; border: 2px solid #c89b3c; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px;"></div>
                    <p style="color: #cdbe91; font-size: 14px; margin: 0;">Loading League icons...</p>
                  </div>
              </div>
            </div>
          
            <div id="tab-custom-content" class="tab-content" style="flex: 1; display: none; overflow-y: auto; flex-direction: column;">
              <div style="display: grid; grid-template-columns: 350px 1fr; gap: 24px; padding: 24px; min-height: 100%;">

                <div style="background: #1e2328; border: 1px solid #463714; border-radius: 8px; padding: 20px;">
                  <h3 style="color: #f0e6d2; margin: 0 0 16px 0; font-size: 16px; font-weight: 500;">
                    Add Custom Icon
                  </h3>


                  <div style="margin-bottom: 16px;">
                    <input type="file" id="custom-icon-upload" accept="image/jpeg,image/png,image/gif" style="display: none;">
                    <button id="upload-button" style="width: 100%; padding: 10px 16px; background: #c89b3c; color: #0f2027; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; margin-bottom: 8px;">Choose File</button>
                    <span id="file-name" style="color: #cdbe91; font-size: 12px; display: block;">No file selected</span>
                  </div>


                  <div style="text-align: center; margin: 16px 0; color: #785a28; font-size: 12px;">or</div>


                  <div style="margin-bottom: 16px;">
                    <input type="url" id="url-input" placeholder="Paste image URL here..." style="width: 100%; padding: 10px 12px; background: #0f2027; border: 1px solid #463714; border-radius: 6px; color: #f0e6d2; font-size: 14px; box-sizing: border-box; margin-bottom: 8px;">
                    <span id="url-status" style="color: #cdbe91; font-size: 12px; display: block;"></span>
                  </div>


                  <div id="shared-preview" style="width: 120px; height: 120px; border: 1px solid #463714; border-radius: 50%; margin: 0 auto 16px auto; display: flex; align-items: center; justify-content: center; background: #0f2027;">
                    <span style="color: #785a28; font-size: 12px; text-align: center;">Preview</span>
                  </div>


                  <button id="add-to-collection" style="width: 100%; padding: 12px 16px; background: #0596aa; color: #f0e6d2; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px;" disabled>Add to Collection</button>
                </div>


                <div style="background: #1e2328; border: 1px solid #463714; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; overflow: hidden;">
                  <h3 style="color: #f0e6d2; margin: 0 0 16px 0; font-size: 16px; font-weight: 500;">
                    Your Collection
                  </h3>
                  <div id="custom-icons-grid" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 120px)); gap: 16px; padding: 16px; justify-content: center; align-items: start;">
                    <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; min-height: 200px;"><div style="width: 64px; height: 64px; border: 2px dashed #463714; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;"><span style="font-size: 24px; color: #463714;">📁</span></div><p style="color: #cdbe91; text-align: center; font-size: 14px; margin: 0; line-height: 1.5;">No custom icons yet.<br>Upload a file or add an image URL to get started!</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
          

        </div>
      `;

      modal.appendChild(content);
      document.body.appendChild(modal);
      debug("Modal created and added to DOM");

      const revertButton = content.querySelector(".revert-button");

      revertButton.onclick = async () => {
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
        tabLeague.style.background = "#c89b3c";
        tabLeague.style.color = "#0f2027";
        tabLeague.style.fontWeight = "500";
        tabCustom.classList.remove("active");
        tabCustom.style.background = "transparent";
        tabCustom.style.color = "#cdbe91";
        tabCustom.style.fontWeight = "normal";
        tabLeagueContent.style.display = "flex";
        tabCustomContent.style.display = "none";
      };

      tabCustom.onclick = () => {
        tabCustom.classList.add("active");
        tabCustom.style.background = "#c89b3c";
        tabCustom.style.color = "#0f2027";
        tabCustom.style.fontWeight = "500";
        tabLeague.classList.remove("active");
        tabLeague.style.background = "transparent";
        tabLeague.style.color = "#cdbe91";
        tabLeague.style.fontWeight = "normal";
        tabCustomContent.style.display = "flex";
        tabLeagueContent.style.display = "none";
        this.loadCustomIcons();
      };

      const fileInput = content.querySelector("#custom-icon-upload");
      const uploadButton = content.querySelector("#upload-button");
      const fileName = content.querySelector("#file-name");
      const urlInput = content.querySelector("#url-input");
      const urlStatus = content.querySelector("#url-status");
      const sharedPreview = content.querySelector("#shared-preview");
      const addToCollectionButton = content.querySelector("#add-to-collection");

      let currentData = null; // Can be file or URL data
      let currentSource = null; // 'file' or 'url'

      uploadButton.onclick = () => {
        fileInput.click();
      };

      let urlTimeout;
      urlInput.addEventListener("input", () => {
        const url = urlInput.value.trim();

        // Clear previous timeout
        if (urlTimeout) clearTimeout(urlTimeout);

        if (url === "") {
          urlStatus.textContent = "";
          resetPreview();
          return;
        }

        const validation = validateImageUrl(url);
        if (validation.valid) {
          urlStatus.textContent = "Loading preview...";
          urlStatus.style.color = "#cdbe91";

          // Auto-load preview after 1 second of no typing
          urlTimeout = setTimeout(async () => {
            await loadUrlPreview(url);
          }, 1000);
        } else {
          urlStatus.textContent = validation.error;
          urlStatus.style.color = "#c8aa6e";
          resetPreview();
        }
      });

      async function loadUrlPreview(url) {
        try {
          sharedPreview.innerHTML =
            '<div style="width: 20px; height: 20px; border: 2px solid #c89b3c; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>';

          const imageData = await loadImageFromUrl(url);
          currentData = imageData;
          currentSource = "url";

          sharedPreview.innerHTML = `<img src="${imageData.dataUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
          urlStatus.textContent = `Image loaded (${imageData.width}x${imageData.height})`;
          urlStatus.style.color = "#0596aa";
          addToCollectionButton.disabled = false;
        } catch (error) {
          sharedPreview.innerHTML =
            '<span style="color: #c8aa6e; font-size: 12px; text-align: center;">Failed to load</span>';
          urlStatus.textContent = "Failed to load image from URL";
          urlStatus.style.color = "#c8aa6e";
          resetPreview();
        }
      }

      function resetPreview() {
        currentData = null;
        currentSource = null;
        addToCollectionButton.disabled = true;
        sharedPreview.innerHTML =
          '<span style="color: #785a28; font-size: 12px; text-align: center;">Preview</span>';
      }

      addToCollectionButton.onclick = async () => {
        if (!currentData || !currentSource) return;

        debug("Adding custom icon from", currentSource);

        let iconName;
        if (currentSource === "url") {
          const urlObj = new URL(currentData.originalUrl);
          iconName = urlObj.pathname.split("/").pop() || "url-image";
        } else {
          iconName = currentData.name || "uploaded-image";
        }

        await this.addCustomIcon(iconName, currentData.dataUrl);
        window.Toast.success("Custom icon added to collection!");

        urlInput.value = "";
        fileInput.value = "";
        fileName.textContent = "No file selected";
        urlStatus.textContent = "";
        resetPreview();

        this.loadCustomIcons();
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
            resetPreview();
            return;
          }

          fileName.textContent = file.name;

          urlInput.value = "";
          urlStatus.textContent = "";

          try {
            sharedPreview.innerHTML =
              '<div style="width: 20px; height: 20px; border: 2px solid #c89b3c; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>';

            const processedFile = await processImageFile(file, 256, 256, 0.8);
            currentData = { ...processedFile, name: file.name };
            currentSource = "file";

            sharedPreview.innerHTML = `<img src="${processedFile.dataUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            addToCollectionButton.disabled = false;

            debug("Custom icon processed successfully");
          } catch (error) {
            debug("Error processing custom icon:", error);
            window.Toast.error("Failed to process image file");
            fileInput.value = "";
            fileName.textContent = "No file selected";
            resetPreview();
          }
        }
      };

      const grid = content.querySelector(".icon-grid");
      const searchInput = content.querySelector("#icon-search");
      const clearButton = content.querySelector("#clear-search");
      const searchInfo = content.querySelector("#search-results-info");
      
      let allValidIcons = []; // Store all loaded icons for searching
      
      // Search functionality
      const self = this; // Store reference to maintain context
      function filterIcons(searchTerm) {
        const filtered = allValidIcons.filter(icon => 
          icon.id.toString().includes(searchTerm.toLowerCase())
        );
        
        displayIcons(filtered);
        updateSearchInfo(searchTerm, filtered.length, allValidIcons.length);
      }
      
      function displayIcons(iconsToShow) {
        grid.innerHTML = "";
        
        if (iconsToShow.length === 0) {
          grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; margin: 40px 20px;"><p style="color: #cdbe91; font-size: 14px; margin: 0;">No icons found matching your search.</p></div>';
          return;
        }
        
        iconsToShow.forEach((icon, index) => {
          const img = icon.element.cloneNode(true);
          img.style.opacity = "0";
          img.style.transform = "scale(0.8)";
          img.style.transition = "all 0.3s ease";
          
          // Re-attach the click handler
          img.onclick = async () => {
            debug(`Icon clicked: ID ${icon.id}`);
            await window.DataStore.set(CONFIG.DATASTORE_KEY, icon.id);
            await window.DataStore.set(CONFIG.CUSTOM_ICON_KEY, null);
            window.Toast.success(`Icon changed to ID ${icon.id}!`);
            await self.applyCustomIcon();
            modal.remove();
            debug("Icon selection completed");
          };
          
          grid.appendChild(img);
          
          setTimeout(() => {
            img.style.opacity = "1";
            img.style.transform = "scale(1)";
          }, index * 20);
        });
      }
      
      function updateSearchInfo(searchTerm, filteredCount, totalCount) {
        if (searchTerm.trim() === "") {
          searchInfo.textContent = `${totalCount} icons`;
        } else {
          searchInfo.textContent = `${filteredCount} of ${totalCount} icons found`;
        }
      }
      
      // Search input event listeners
      searchInput.addEventListener("input", (e) => {
        const searchTerm = e.target.value.trim();
        
        if (searchTerm === "") {
          clearButton.style.display = "none";
          displayIcons(allValidIcons);
          updateSearchInfo("", allValidIcons.length, allValidIcons.length);
        } else {
          clearButton.style.display = "flex";
          filterIcons(searchTerm);
        }
      });
      
      clearButton.addEventListener("click", () => {
        searchInput.value = "";
        clearButton.style.display = "none";
        displayIcons(allValidIcons);
        updateSearchInfo("", allValidIcons.length, allValidIcons.length);
        searchInput.focus();
      });
      
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
                "width: 100px; height: 100px; border-radius: 50%; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent; box-shadow: 0 2px 8px rgba(0,0,0,0.3);";
              img.onmouseover = () => {
                img.style.transform = "scale(1.05)";
                img.style.borderColor = "#c89b3c";
                img.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
              };
              img.onmouseout = () => {
                img.style.transform = "scale(1)";
                img.style.borderColor = "transparent";
                img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
              };

              img.onclick = async () => {
                debug(`Icon clicked: ID ${icon.id}`);
                await window.DataStore.set(CONFIG.DATASTORE_KEY, icon.id);
                await window.DataStore.set(CONFIG.CUSTOM_ICON_KEY, null);
                window.Toast.success(`Icon changed to ID ${icon.id}!`);
                await this.applyCustomIcon();
                modal.remove();
                debug("Icon selection completed");
              };
            });
          });

        await Promise.all(iconPromises);

        allValidIcons = validIcons.slice(); // Store all valid icons for searching
        displayIcons(allValidIcons);
        updateSearchInfo("", allValidIcons.length, allValidIcons.length);

        debug(`Icon grid populated with ${validIcons.length} valid icons`);

        if (validIcons.length === 0) {
          grid.innerHTML =
            '<div style="grid-column: 1 / -1; text-align: center; margin: 40px 20px;"><p style="color: #e63946; font-size: 16px; margin: 0;">No valid icons found. Please try again later.</p></div>';
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
          '<div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; min-height: 200px;"><div style="width: 64px; height: 64px; border: 2px dashed #463714; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;"><span style="font-size: 24px; color: #463714;">📁</span></div><p style="color: #cdbe91; text-align: center; font-size: 14px; margin: 0; line-height: 1.5;">No custom icons yet.<br>Upload a file or add an image URL to get started!</p></div>';
        return;
      }

      customIconsGrid.innerHTML = "";

      customIcons.forEach((icon) => {
        const iconContainer = document.createElement("div");
        iconContainer.style.cssText =
          "position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 120px; height: auto;";

        const img = document.createElement("img");
        img.src = icon.dataUrl;
        img.title = icon.name;
        img.style.cssText =
          "width: 100px; height: 100px; border-radius: 50%; cursor: pointer; transition: all 0.2s ease; border: 2px solid transparent; box-shadow: 0 2px 8px rgba(0,0,0,0.3); object-fit: cover;";

        img.onmouseover = () => {
          img.style.transform = "scale(1.05)";
          img.style.borderColor = "#c89b3c";
          img.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
        };

        img.onmouseout = () => {
          img.style.transform = "scale(1)";
          img.style.borderColor = "transparent";
          img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
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
          icon.name.length > 15
            ? icon.name.substring(0, 15) + "..."
            : icon.name;
        nameLabel.style.cssText =
          "color: #f0e6d2; font-size: 11px; text-align: center; width: 120px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,0.5); line-height: 1.2;";

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "×";
        deleteButton.style.cssText =
          "position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; background: #c8aa6e; color: #0f2027; border: 2px solid #0f2027; border-radius: 50%; cursor: pointer; font-size: 16px; font-weight: bold; display: none; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transition: all 0.2s ease;";

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
