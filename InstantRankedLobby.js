/**
 * @name InstantRankedLobby
 * @author Yimikami
 * @description Instantly creates solo/duo ranked lobby when pressing play button
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.2
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
      this.handlers = new Map();
      this.disposed = false;
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
      this.disposed = true;
      for (const [button, handler] of this.handlers) button.removeEventListener("click", handler, true);
      this.handlers.clear();
      log("Cleaning up plugin resources");
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }

    async createRankedLobby() {
      if (this.creatingLobby || this.disposed) return;
      this.creatingLobby = true;
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
      } finally { this.creatingLobby = false; }
    }

    handlePlayButton(playButton) {
      log("Setting up play button click handler");
      if (this.handlers.has(playButton)) return;
      const handler = async (e) => {
        if (this.disposed || window.soloQMachine?.ownsPlayButton()) return;
        log("Play button clicked, creating ranked lobby");
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        await this.createRankedLobby();
      };
      this.handlers.set(playButton, handler);
      playButton.addEventListener("click", handler, true);
    }

    observeDOM() {
      log("Starting DOM observation");
      const scan = (root) => {
        if (root.matches?.(".play-button-content")) this.handlePlayButton(root);
        root.querySelectorAll?.(".play-button-content").forEach((button) => this.handlePlayButton(button));
      };
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              scan(node);
            }
          });
        });
        for (const [button, handler] of this.handlers) {
          if (!button.isConnected) {
            button.removeEventListener("click", handler, true);
            this.handlers.delete(button);
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      this.observer = observer;
      scan(document.body);
    }
  }

  window.addEventListener("load", () => {
    window.instantRankedLobby = new InstantRankedLobby();
  });
})();
