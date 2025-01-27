/**
 * @name InstantRankedLobby
 * @author Yimikami
 * @description Instantly creates solo/duo ranked lobby when pressing play button
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.1
 */

(() => {
  const CONFIG = {
    debug: false,
    queueId: 420, // Ranked Solo Queue ID
  };

  const log = (message) => {
    if (CONFIG.debug) {
      console.log(`[InstantRankedLobby] ${message}`);
    }
  };

  class InstantRankedLobby {
    constructor() {
      log("Initializing InstantRankedLobby plugin");
      this.observer = null;
      this.init();
    }

    async init() {
      try {
        log("Setting up DOM observer and cleanup");
        this.observeDOM();
        this.setupCleanup();
      } catch (error) {
        console.error("Failed to initialize Instant Ranked Lobby:", error);
      }
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
    }

    async createRankedLobby() {
      try {
        log(`Creating ranked lobby with queue ID: ${CONFIG.queueId}`);
        const response = await fetch("/lol-lobby/v2/lobby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            queueId: CONFIG.queueId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create lobby: ${response.status}`);
        }
        log("Successfully created ranked lobby");
      } catch (error) {
        console.error("Error creating ranked lobby:", error);
      }
    }

    handlePlayButton(playButton) {
      log("Setting up play button click handler");
      playButton.onclick = async (e) => {
        log("Play button clicked, creating ranked lobby");
        e.preventDefault();
        e.stopPropagation();
        await this.createRankedLobby();
      };
    }

    observeDOM() {
      log("Starting DOM observation");
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              const playButton = node.querySelector(".play-button-content");
              if (playButton && !playButton.dataset.instantRankedAdded) {
                log("Found play button, adding click handler");
                playButton.dataset.instantRankedAdded = "true";
                this.handlePlayButton(playButton);
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
    }
  }

  window.addEventListener("load", () => {
    window.instantRankedLobby = new InstantRankedLobby();
  });
})();
