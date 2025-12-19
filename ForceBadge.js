/**
 * @name ForceBadge
 * @author Yimikami
 * @description Forces the client to always show "Game Pass" badge near champions and skins
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.1
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
      if (this.styleElement && this.styleElement.parentNode) {
        this.styleElement.parentNode.removeChild(this.styleElement);
        this.styleElement = null;
      }
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
        return;
      }
      
      if (!gridChampion.classList.contains("grid-champion-loyalty-reward-new")) {
        log("Adding loyalty reward class to champion");
        gridChampion.classList.add("grid-champion-loyalty-reward-new");
      }
    }

    addSkinRewardIcon(skinItem) {
      if (!skinItem.classList.contains("enabled")) {
        return;
      }
      
      const infoDiv = skinItem.querySelector(".skin-selection-item-information");
      if (infoDiv && !infoDiv.classList.contains("loyalty-reward-icon--rewards")) {
        log("Adding loyalty reward icon to skin");
        infoDiv.classList.add("loyalty-reward-icon--rewards");
      }
    }

    observeDOM() {
      log("Starting DOM observation");
      
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              const championItems = node.querySelectorAll
                ? node.querySelectorAll(".rcp-fe-lol-champion-mastery-champion-item-lcm, [class*='champion-item']")
                : [];
              
              championItems.forEach((item) => {
                if (!item.dataset.rewardsBadgeForced) {
                  item.dataset.rewardsBadgeForced = "true";
                  this.injectBadgeIfMissing(item);
                }
              });

              if (node.classList && 
                  (node.classList.contains("rcp-fe-lol-champion-mastery-champion-item-lcm") ||
                   node.className.includes("champion-item"))) {
                if (!node.dataset.rewardsBadgeForced) {
                  node.dataset.rewardsBadgeForced = "true";
                  this.injectBadgeIfMissing(node);
                }
              }

              const gridChampions = node.querySelectorAll
                ? node.querySelectorAll(".grid-champion")
                : [];
              
              gridChampions.forEach((item) => {
                if (!item.dataset.loyaltyRewardForced) {
                  item.dataset.loyaltyRewardForced = "true";
                  this.addLoyaltyRewardClass(item);
                }
              });

              if (node.classList && node.classList.contains("grid-champion")) {
                if (!node.dataset.loyaltyRewardForced) {
                  node.dataset.loyaltyRewardForced = "true";
                  this.addLoyaltyRewardClass(node);
                }
              }

              const skinItems = node.querySelectorAll
                ? node.querySelectorAll(".skin-selection-item")
                : [];
              
              skinItems.forEach((item) => {
                if (!item.dataset.skinRewardForced) {
                  item.dataset.skinRewardForced = "true";
                  this.addSkinRewardIcon(item);
                }
              });

              if (node.classList && node.classList.contains("skin-selection-item")) {
                if (!node.dataset.skinRewardForced) {
                  node.dataset.skinRewardForced = "true";
                  this.addSkinRewardIcon(node);
                }
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      this.observer = observer;

      this.processExistingElements();
    }

    processExistingElements() {
      log("Processing existing elements on page");
      
      document.querySelectorAll(".rcp-fe-lol-champion-mastery-champion-item-lcm, [class*='champion-item']")
        .forEach((item) => {
          if (!item.dataset.rewardsBadgeForced) {
            item.dataset.rewardsBadgeForced = "true";
            this.injectBadgeIfMissing(item);
          }
        });

      document.querySelectorAll(".grid-champion")
        .forEach((item) => {
          if (!item.dataset.loyaltyRewardForced) {
            item.dataset.loyaltyRewardForced = "true";
            this.addLoyaltyRewardClass(item);
          }
        });
      document.querySelectorAll(".skin-selection-item")
        .forEach((item) => {
          if (!item.dataset.skinRewardForced) {
            item.dataset.skinRewardForced = "true";
            this.addSkinRewardIcon(item);
          }
        });
    }
  }

  window.addEventListener("load", () => {
    window.ForceBadge = new ForceBadge();
  });
})();
