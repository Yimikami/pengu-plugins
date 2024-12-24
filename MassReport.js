/**
 * @name MassReport
 * @author Yimikami
 * @description Allows mass reporting from match history
 * @version 0.0.1
 */

const CONFIG = {
    debug: false,
    endpoint: '/lol-player-report-sender/v1/match-history-reports',
    categories: ["NEGATIVE_ATTITUDE", "VERBAL_ABUSE", "INAPPROPRIATE_NAME"],
    retryAttempts: 3,
    retryDelay: 1000,
    reportDelay: 500, // Delay between reports to avoid rate limiting
    whitelistedPlayers: new Set(),
    api: {
        currentSummoner: '/lol-summoner/v1/current-summoner',
        matchHistory: '/lol-match-history/v1/games'
    }
};

// Utility functions
const utils = {
    debugLog(message, data = null) {
        if (CONFIG.debug) {
            if (data) {
                console.log(`[Mass Report Debug] ${message}`, data);
            } else {
                console.log(`[Mass Report Debug] ${message}`);
            }
        }
    },
    
    showToast(type, message) {
        if (window.Toast) {
            window.Toast[type](message);
        } else {
            console.log(`[Debug] Toast not available. Would have shown: ${type} - ${message}`);
        }
    },

    // Save whitelist to localStorage
    saveWhitelist() {
        try {
            localStorage.setItem('massreport_whitelist', JSON.stringify(Array.from(CONFIG.whitelistedPlayers)));
            this.debugLog('Whitelist saved successfully');
        } catch (error) {
            this.debugLog('Error saving whitelist:', error);
        }
    },

    // Load whitelist from localStorage
    loadWhitelist() {
        try {
            const saved = localStorage.getItem('massreport_whitelist');
            if (saved) {
                CONFIG.whitelistedPlayers = new Set(JSON.parse(saved));
                this.debugLog('Whitelist loaded successfully');
            }
        } catch (error) {
            this.debugLog('Error loading whitelist:', error);
        }
    },

    // Fetch wrapper with retry logic
    async fetchWithRetry(url, options = {}, retries = CONFIG.retryAttempts) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
                return this.fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    },

    // Delay helper
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

async function sendReport(summonerId, puuid, gameId, summonerName) {
    const payload = {
        comment: "",
        gameId: gameId,
        categories: CONFIG.categories,
        offenderSummonerId: summonerId,
        offenderPuuid: puuid
    };

    try {
        utils.debugLog(`Sending report for ${summonerName}:`, {
            gameId, summonerId, puuid
        });

        const response = await utils.fetchWithRetry(CONFIG.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        utils.debugLog(`Report sent successfully for ${summonerName}`);
        utils.showToast('success', `Report sent for ${summonerName}`);
        return true;
    } catch (error) {
        utils.debugLog(`Failed to report ${summonerName}:`, error);
        utils.showToast('error', `Failed to report ${summonerName}`);
        return false;
    }
}

class MassReport {
    constructor() {
        this.init();
        this.settingsObserver = null;
        this.styleElement = null;
    }

    init() {
        utils.loadWhitelist();
        this.observeMatchHistory();
        this.initializeSettings();
        this.injectStyles();
        utils.debugLog('Plugin initialized');
    }

    injectStyles() {
        if (this.styleElement) {
            return;
        }

        const styles = `
            #mass-report-container {
                display: flex;
                gap: 10px;
            }
            .mass-report-input {
                background: #1e2328;
                border: 1px solid #785a28;
                color: #cdbe91;
                padding: 5px 10px;
                font-family: var(--font-display);
                width: 150px;
            }
            .mass-report-input:focus {
                outline: none;
                border-color: #c8aa6e;
            }
            #mass-report-btn {
                padding: 5px 15px;
                color: #cdbe91;
                cursor: pointer;
            }
            #mass-report-btn:hover {
                color: #f0e6d2;
            }
            #mass-report-settings {
                font-family: "LoL Display";
                font-weight: 700;
                letter-spacing: 0.0375em;
                -webkit-font-smoothing: antialiased;
            }
            #mass-report-settings .lol-settings-general-title {
                color: #f0e6d2; 
                font-family: "LoL Display";
                font-weight: 700;
                letter-spacing: 0.0375em;
                -webkit-font-smoothing: antialiased;
                text-transform: uppercase;
                font-size: 14px;
                margin-bottom: 12px;
            }
            .whitelist-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 5px;
                border-bottom: 1px solid #785a28;
            }
            .whitelist-item:last-child {
                border-bottom: none;
            }
            .whitelist-item span {
                color: #f0e6d2;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
        this.styleElement = styleElement;
    }

    initializeSettings() {
        if (this.settingsObserver) {
            this.settingsObserver.disconnect();
        }

        const addSettings = (scrollable) => {
            if (!scrollable || document.getElementById('mass-report-settings')) return;

            const settingsRow = document.createElement('div');
            settingsRow.className = 'lol-settings-general-row';
            settingsRow.id = 'mass-report-settings';
            settingsRow.innerHTML = `
                <div class="lol-settings-general-title">Mass Report Settings</div>
                <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 10px; padding-bottom: 10px; border-bottom: thin solid #3c3c41;">
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <p class="lol-settings-window-size-text">Whitelisted Players</p>
                        <div style="display: flex; gap: 10px;">
                            <lol-uikit-flat-input style="flex-grow: 1;">
                                <input type="text" placeholder="Enter summoner name" id="whitelist-input"
                                       style="width: 100%;">
                            </lol-uikit-flat-input>
                            <lol-uikit-flat-button id="add-whitelist-btn">Add</lol-uikit-flat-button>
                        </div>
                        ${CONFIG.whitelistedPlayers.size > 0 ? `
                        <div id="whitelist-container" style="max-height: 200px; overflow-y: auto; background: #0a0a0a; border: 1px solid #785a28; padding: 10px;">
                            ${Array.from(CONFIG.whitelistedPlayers).map(name => `
                                <div class="whitelist-item">
                                    <span>${name}</span>
                                    <lol-uikit-flat-button class="remove-whitelist" data-name="${name}">Remove</lol-uikit-flat-button>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;

            const conductRow = scrollable.querySelector('.lol-settings-general-row');
            if (conductRow) {
                conductRow.parentNode.insertBefore(settingsRow, conductRow.nextSibling);
            } else {
                scrollable.firstElementChild?.appendChild(settingsRow);
            }

            this.setupSettingsEventListeners(settingsRow);
        };

        this.settingsObserver = new MutationObserver(() => {
            const scrollable = document.querySelector('div.lol-settings-options lol-uikit-scrollable');
            if (scrollable) addSettings(scrollable);
        });

        this.settingsObserver.observe(document.body, { childList: true, subtree: true });
    }

    setupSettingsEventListeners(settingsRow) {
        const addButton = settingsRow.querySelector('#add-whitelist-btn');
        const input = settingsRow.querySelector('#whitelist-input');

        const addWhitelistPlayer = () => {
            const name = input.value.trim();
            if (name) {
                this.addToWhitelist(name);
                input.value = '';
                this.updateWhitelistUI();
            }
        };

        addButton.addEventListener('click', addWhitelistPlayer);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addWhitelistPlayer();
            }
        });

        settingsRow.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-whitelist')) {
                const name = e.target.dataset.name;
                this.removeFromWhitelist(name);
                this.updateWhitelistUI();
            }
        });
    }

    addToWhitelist(name) {
        CONFIG.whitelistedPlayers.add(name);
        utils.saveWhitelist();
        utils.showToast('success', `Added ${name} to whitelist`);
    }

    removeFromWhitelist(name) {
        CONFIG.whitelistedPlayers.delete(name);
        utils.saveWhitelist();
        utils.showToast('success', `Removed ${name} from whitelist`);
    }

    updateWhitelistUI() {
        const container = document.getElementById('whitelist-container');
        if (container) {
            if (CONFIG.whitelistedPlayers.size === 0) {
                container.remove();
            } else {
                container.innerHTML = Array.from(CONFIG.whitelistedPlayers).map(name => `
                    <div class="whitelist-item">
                        <span>${name}</span>
                        <lol-uikit-flat-button class="remove-whitelist" data-name="${name}">Remove</lol-uikit-flat-button>
                    </div>
                `).join('');
            }
        } else if (CONFIG.whitelistedPlayers.size > 0) {
            const parent = document.querySelector('#mass-report-settings .lol-settings-window-size-text').parentElement;
            const newContainer = document.createElement('div');
            newContainer.id = 'whitelist-container';
            newContainer.style = "max-height: 200px; overflow-y: auto; background: #0a0a0a; border: 1px solid #785a28; padding: 10px;";
            newContainer.innerHTML = Array.from(CONFIG.whitelistedPlayers).map(name => `
                <div class="whitelist-item">
                    <span>${name}</span>
                    <lol-uikit-flat-button class="remove-whitelist" data-name="${name}">Remove</lol-uikit-flat-button>
                </div>
            `).join('');
            parent.appendChild(newContainer);
        }
    }

    observeMatchHistory() {
        const observer = new MutationObserver(() => {
            const matchDetailsRoot = document.querySelector('.match-details-root');
            if (matchDetailsRoot && !document.querySelector('#mass-report-container')) {
                const navBar = matchDetailsRoot.querySelector('.rcp-fe-lol-match-details-overlay-sub-nav');
                if (navBar) {
                    utils.debugLog('Match details found, injecting elements');
                    this.injectElements(navBar);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    injectElements(navBar) {
        const container = document.createElement('div');
        container.id = 'mass-report-container';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.marginLeft = 'auto';
        container.style.marginRight = '20px';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'game-id-input';
        input.placeholder = 'Enter Game ID';
        input.className = 'mass-report-input';

        const button = document.createElement('lol-uikit-flat-button');
        button.id = 'mass-report-btn';
        button.textContent = 'Report All';
        button.onclick = () => this.handleReport();
        
        container.appendChild(input);
        container.appendChild(button);
        
        navBar.appendChild(container);
        utils.debugLog('UI elements injected');
    }

    async handleReport() {
        const gameId = document.querySelector('#game-id-input').value;
        if (!gameId) {
            utils.debugLog('No game ID entered');
            utils.showToast('error', 'Please enter a Game ID');
            return;
        }

        utils.debugLog(`Starting report process for game: ${gameId}`);

        try {
            // Get current summoner info
            utils.debugLog('Fetching current summoner data...');
            const currentSummonerResponse = await utils.fetchWithRetry(CONFIG.api.currentSummoner);
            const currentSummoner = await currentSummonerResponse.json();
            utils.debugLog('Current summoner:', currentSummoner);

            // Get game data
            utils.debugLog('Fetching game data...');
            const gameResponse = await utils.fetchWithRetry(`${CONFIG.api.matchHistory}/${gameId}`);
            const gameData = await gameResponse.json();
            utils.debugLog('Game data received');

            const players = gameData.participantIdentities;
            utils.debugLog(`Found ${players.length} players in game`);

            let reportCount = 0;
            let failCount = 0;
            let skippedCount = 0;

            for (const player of players) {
                const playerName = player.player.gameName;

                // Skip if this is the current player
                if (player.player.summonerId === currentSummoner.summonerId) {
                    utils.debugLog(`Skipping self (${playerName})`);
                    continue;
                }

                // Skip if player is whitelisted
                if (CONFIG.whitelistedPlayers.has(playerName)) {
                    utils.debugLog(`Skipping whitelisted player (${playerName})`);
                    skippedCount++;
                    continue;
                }

                utils.debugLog(`Processing player:`, {
                    summonerId: player.player.summonerId,
                    puuid: player.player.puuid,
                    name: playerName
                });

                const success = await sendReport(
                    player.player.summonerId,
                    player.player.puuid,
                    gameId,
                    playerName
                );

                if (success) {
                    reportCount++;
                } else {
                    failCount++;
                }
                
                await utils.delay(CONFIG.reportDelay);
            }

            utils.debugLog(`Report process completed. Success: ${reportCount}, Failed: ${failCount}, Skipped: ${skippedCount}`);
            utils.showToast('success', `Reports completed: ${reportCount} successful, ${failCount} failed, ${skippedCount} skipped`);

        } catch (error) {
            utils.debugLog('Error in report process:', error);
            console.error('Error:', error);
            utils.showToast('error', 'Failed to process reports');
        }
    }
}

window.addEventListener('load', () => new MassReport());
