/**
 * @name ForceBadge
 * @author Yimikami
 * @description Forces the client to always show "Game Pass" badge near champions and skins
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.2
 */

(() => {
  const CONFIG = {
    debug: false,
  };

  const log = (message) => {
    if (CONFIG.debug) {
      console.log(`[ForceBadge] ${message}`);
    }
  };

  class ForceBadge {
    constructor() {
      log("Initializing ForceBadge plugin");
      this.observer = null;
      this.styleElement = null;
      this.originalBadges = new Map();
      this.addedClasses = new Map();
      this.init();
    }

    async init() {
      try {
        log("Setting up CSS injection and DOM observer");
        this.injectStyles();
        this.observeDOM();
        this.setupCleanup();
      } catch (error) {
        console.error("Failed to initialize ForceBadge:", error);
      }
    }

    injectStyles() {
      log("Injecting reward badge styles");
      
      const css = `
        .rcp-fe-lol-champion-mastery-champion-item-lcm .champion-thumbnail .info-badge-wrapper,
        .rcp-fe-lol-collections .champion-thumbnail .info-badge-wrapper,
        .champion-thumbnail .info-badge-wrapper,
        div.info-badge-wrapper,
        [class*="info-badge-wrapper"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          position: absolute !important;
          pointer-events: auto !important;
          z-index: 5 !important;
        }

        .rcp-fe-lol-champion-mastery-champion-item-lcm .info-badge-wrapper .info-badge,
        .rcp-fe-lol-collections .info-badge-wrapper .info-badge,
        .champion-thumbnail .info-badge-wrapper .info-badge,
        .info-badge-wrapper img.info-badge,
        [class*="info-badge-wrapper"] img {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: auto !important;
          height: auto !important;
        }

      
        .rcp-fe-lol-champion-mastery-champion-item-lcm.locked .champion-thumbnail .info-badge-wrapper {
          display: flex !important;
        }

        .champion-grid .grid-champion:not([data-id="-2"]) > .grid-champion-hitbox > .grid-champion-overlay::before {
          content: "" !important;
          display: block !important;
          position: absolute !important;
          background-image: url(/fe/lol-champ-select/images/config/champ-free-to-play-reward-flag-new.png) !important;
          background-size: contain !important;
          background-repeat: no-repeat !important;
          width: 24px !important;
          height: 24px !important;
          top: 0 !important;
          left: 0 !important;
          z-index: 10 !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        .skin-selection-item.enabled .skin-selection-item-information.loyalty-reward-icon--rewards::before {
          content: "" !important;
          display: block !important;
          position: absolute !important;
          background-image: url(/fe/lol-champ-select/images/config/champ-free-to-play-reward-flag-new.png) !important;
          background-size: contain !important;
          background-repeat: no-repeat !important;
          width: 24px !important;
          height: 24px !important;
          top: 4px !important;
          right: 4px !important;
          z-index: 10 !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
      `;

      this.styleElement = document.createElement("style");
      this.styleElement.id = "rewards-badge-forcer-styles";
      this.styleElement.textContent = css;
      document.head.appendChild(this.styleElement);
      
      log("Styles injected successfully");
    }

    setupCleanup() {
      log("Setting up cleanup event listener");
      window.addEventListener("unload", () => {
        this.cleanup();
      });
    }

    cleanup() {
      log("Cleaning up plugin resources");
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      for (const [wrapper, original] of this.originalBadges) this.restoreBadge(wrapper, original);
      this.originalBadges.clear();
      for (const [node, classes] of this.addedClasses) classes.forEach((name) => node.classList.remove(name));
      this.addedClasses.clear();
      if (this.styleElement && this.styleElement.parentNode) {
        this.styleElement.parentNode.removeChild(this.styleElement);
        this.styleElement = null;
      }
    }

    restoreBadge(wrapper, original) {
      if (original.created) { wrapper.remove(); return; }
      wrapper.replaceChildren(...original.nodes);
      if (original.style === null) wrapper.removeAttribute("style");
      else wrapper.setAttribute("style", original.style);
      wrapper.removeAttribute("data-rewards-forcer");
    }

    addClass(node, name) {
      if (node.classList.contains(name)) return;
      if (!this.addedClasses.has(node)) this.addedClasses.set(node, new Set());
      this.addedClasses.get(node).add(name);
      node.classList.add(name);
    }

    injectBadgeIfMissing(championItem) {
      const thumbnail = championItem.querySelector(".champion-thumbnail");
      if (!thumbnail) return;

      let badgeWrapper = thumbnail.querySelector(".info-badge-wrapper");
      
      if (!badgeWrapper) {
        log("Injecting missing badge wrapper");
        
        badgeWrapper = document.createElement("div");
        badgeWrapper.className = "info-badge-wrapper badge-0";
        badgeWrapper.setAttribute("data-rewards-forcer", "true");
        this.originalBadges.set(badgeWrapper, { created: true });
        
        const badge = document.createElement("img");
        badge.src = "/fe/lol-collections/images/item-element/rewards-program-icon.svg";
        badge.className = "info-badge";
        
        badgeWrapper.appendChild(badge);
        
        const masteryInfo = thumbnail.querySelector(".champion-mastery-info");
        if (masteryInfo) {
          thumbnail.insertBefore(badgeWrapper, masteryInfo);
        } else {
          thumbnail.appendChild(badgeWrapper);
        }
      } else if (!badgeWrapper.getAttribute("data-rewards-forcer")) {
        if (!this.originalBadges.has(badgeWrapper)) {
          this.originalBadges.set(badgeWrapper, { nodes: [...badgeWrapper.childNodes], style: badgeWrapper.getAttribute("style") });
        }
        const existingBadge = badgeWrapper.querySelector("img");
        if (!existingBadge || !existingBadge.src.includes("rewards-program-icon")) {
          log("Replacing existing badge with rewards badge");
          
          badgeWrapper.innerHTML = "";
          
          const badge = document.createElement("img");
          badge.src = "/fe/lol-collections/images/item-element/rewards-program-icon.svg";
          badge.className = "info-badge";
          
          badgeWrapper.appendChild(badge);
          badgeWrapper.setAttribute("data-rewards-forcer", "true");
        }
      }
      
      if (badgeWrapper) {
        badgeWrapper.style.display = "flex";
        badgeWrapper.style.visibility = "visible";
        badgeWrapper.style.opacity = "1";
      }
    }

    addLoyaltyRewardClass(gridChampion) {
      if (gridChampion.getAttribute("data-id") === "-2") {
        if (gridChampion.classList.contains("grid-champion-loyalty-reward-new")) {
          gridChampion.classList.remove("grid-champion-loyalty-reward-new");
        }
        return;
      }
      
      if (!gridChampion.classList.contains("grid-champion-loyalty-reward-new")) {
        log("Adding loyalty reward class to champion");
        this.addClass(gridChampion, "grid-champion-loyalty-reward-new");
      }
    }

    addSkinRewardIcon(skinItem) {
      if (!skinItem.classList.contains("enabled")) {
        return;
      }
      
      const infoDiv = skinItem.querySelector(".skin-selection-item-information");
      if (infoDiv && !infoDiv.classList.contains("loyalty-reward-icon--rewards")) {
        log("Adding loyalty reward icon to skin");
        this.addClass(infoDiv, "loyalty-reward-icon--rewards");
      }
    }

    observeDOM() {
      const selectors = ".rcp-fe-lol-champion-mastery-champion-item-lcm, [class*='champion-item'], .grid-champion, .skin-selection-item";
      this.observer = new MutationObserver((mutations) => {
        const roots = new Set();
        for (const mutation of mutations) {
          if (mutation.target.nodeType === 1) roots.add(mutation.target);
          for (const node of mutation.addedNodes) if (node.nodeType === 1) roots.add(node);
        }
        for (const root of roots) {
          const owner = root.closest?.(selectors);
          if (owner) this.processElement(owner);
          root.querySelectorAll(selectors).forEach((item) => this.processElement(item));
        }
        for (const [wrapper, original] of this.originalBadges) {
          if (!wrapper.isConnected) { this.restoreBadge(wrapper, original); this.originalBadges.delete(wrapper); }
        }
        for (const [node, classes] of this.addedClasses) {
          if (!node.isConnected) {
            classes.forEach((name) => node.classList.remove(name));
            this.addedClasses.delete(node);
          }
        }
      });
      this.observer.observe(document.body, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ["class", "data-id"],
      });
      this.processExistingElements();
    }

    processElement(item) {
      if (item.matches(".grid-champion")) this.addLoyaltyRewardClass(item);
      else if (item.matches(".skin-selection-item")) this.addSkinRewardIcon(item);
      else this.injectBadgeIfMissing(item);
    }

    processExistingElements() {
      document.querySelectorAll(".rcp-fe-lol-champion-mastery-champion-item-lcm, [class*='champion-item'], .grid-champion, .skin-selection-item")
        .forEach((item) => this.processElement(item));
    }

  }

  window.addEventListener("load", () => {
    window.ForceBadge = new ForceBadge();
  });
})();
