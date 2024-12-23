/**
 * @name ARAM Bot Enabler
 * @author Yimikami
 * @description Enables adding bots in ARAM custom games
 * @version 0.0.1
 */

(() => {
    // Constants
    const CONFIG = {
        selectors: {
            botButton: 'lol-uikit-flat-button-secondary[disabled]',
            eligibilityList: '.parties-point-eligibility-list',
            botSelect: 'aram-bot-select'
        },
        api: {
            bots: 'https://gist.githubusercontent.com/Yimikami/2cdc24ea05fec29dcc358b8c411735e6/raw/654f55a9162f6fc4c6a338e23d061d66a1e656c3/availableBots.json',
            addBot: '/lol-lobby/v1/lobby/custom/bots'
        },
        difficulties: [
            { id: 'RSINTERMEDIATE', name: 'Intermediate' },
            { id: 'RSINTRO', name: 'Intro' },
            { id: 'RSBEGINNER', name: 'Beginner' }
        ],
        cache: {
            key: 'aram-bot-cache',
            expiry: 24 * 60 * 60 * 1000 // 24 hours
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
                await this.loadBots();
                this.observeDOM();
                this.enableAramBots();
                this.setupCleanup();
            } catch (error) {
                console.error('Failed to initialize ARAM Bot Enabler:', error);
            }
        }

        setupCleanup() {
            window.addEventListener('unload', () => {
                this.cleanup();
            });
        }

        cleanup() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
        }

        async loadBots() {
            try {
                // Try to load from cache first
                const cached = this.loadFromCache();
                if (cached) {
                    this.availableBots = cached;
                    return;
                }

                const response = await fetch(CONFIG.api.bots);
                if (!response.ok) throw new Error(`Failed to load bots: ${response.status}`);
                const botsData = await response.json();
                this.availableBots = botsData[0].sort((a, b) => a.name.localeCompare(b.name));
                
                // Cache the results
                this.saveToCache(this.availableBots);
            } catch (error) {
                console.error('Error loading bots:', error);
                if (this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    console.log(`Retrying bot load (${this.retryCount}/${this.maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
                    return this.loadBots();
                }
                // Fallback to window.availableBots if all retries fail
                this.availableBots = window.availableBots?.[0]?.sort((a, b) => 
                    a.name.localeCompare(b.name)) || [];
            }
        }

        loadFromCache() {
            try {
                const cached = localStorage.getItem(CONFIG.cache.key);
                if (!cached) return null;

                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp > CONFIG.cache.expiry) {
                    localStorage.removeItem(CONFIG.cache.key);
                    return null;
                }

                return data;
            } catch (error) {
                console.error('Error loading from cache:', error);
                return null;
            }
        }

        saveToCache(data) {
            try {
                localStorage.setItem(CONFIG.cache.key, JSON.stringify({
                    data,
                    timestamp: Date.now()
                }));
            } catch (error) {
                console.error('Error saving to cache:', error);
            }
        }

        createDropdownOption(value, text, content = null) {
            const option = document.createElement('lol-uikit-dropdown-option');
            option.setAttribute('slot', 'lol-uikit-dropdown-option');
            option.setAttribute('value', value);
            
            if (content) {
                option.appendChild(content);
            } else {
                option.textContent = text;
            }
            
            return option;
        }

        createChampionContent(bot) {
            const content = document.createElement('div');
            content.style = 'display: flex; align-items: center;';
            
            // Create image element with error handling
            const img = document.createElement('img');
            img.src = `/lol-game-data/assets/v1/champion-icons/${bot.id}.png`;
            img.style = 'width: 24px; height: 24px; margin-right: 8px; border-radius: 50%;';
            img.onerror = () => {
                img.src = '/lol-game-data/assets/v1/champion-icons/-1.png'; // Default icon
            };

            const span = document.createElement('span');
            span.textContent = bot.name;

            content.appendChild(img);
            content.appendChild(span);
            return content;
        }

        createDropdown() {
            const dropdown = document.createElement('lol-uikit-framed-dropdown');
            dropdown.style = 'height: 32px;';
            dropdown.setAttribute('direction', 'downward');
            dropdown.setAttribute('tabindex', '0');
            return dropdown;
        }

        createBotSelect() {
            const dropdown = this.createDropdown();
            dropdown.id = CONFIG.selectors.botSelect;
            
            const fragment = document.createDocumentFragment();
            fragment.appendChild(this.createDropdownOption('', 'Random Champion'));
            
            this.availableBots.forEach(bot => {
                const content = this.createChampionContent(bot);
                fragment.appendChild(this.createDropdownOption(bot.id, null, content));
            });

            dropdown.appendChild(fragment);
            return dropdown;
        }

        createDifficultySelect() {
            const dropdown = this.createDropdown();
            const fragment = document.createDocumentFragment();
            
            fragment.appendChild(this.createDropdownOption('', 'Random Difficulty'));
            CONFIG.difficulties.forEach(difficulty => {
                fragment.appendChild(this.createDropdownOption(difficulty.id, difficulty.name));
            });

            dropdown.appendChild(fragment);
            return dropdown;
        }

        async addBot(teamId, championId, difficulty, button) {
            if (!button) return;

            const originalText = button.textContent;
            button.textContent = 'Adding...';
            button.setAttribute('disabled', 'true');

            try {
                const response = await fetch(CONFIG.api.addBot, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        botDifficulty: difficulty || CONFIG.difficulties[Math.floor(Math.random() * CONFIG.difficulties.length)].id,
                        championId: championId || this.availableBots[Math.floor(Math.random() * this.availableBots.length)].id,
                        teamId: teamId.toString(),
                        position: "MIDDLE",
                        botUuid: crypto.randomUUID()
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw error;
                }

                button.style.backgroundColor = '#28a745';
                button.textContent = 'Added!';
            } catch (error) {
                console.error('Error adding bot:', error);
                button.style.backgroundColor = '#dc3545';
                button.textContent = 'Failed!';
            } finally {
                setTimeout(() => {
                    button.removeAttribute('disabled');
                    button.style.backgroundColor = '';
                    button.textContent = originalText;
                }, 2000);
            }
        }

        createDropdowns() {
            if (document.getElementById(CONFIG.selectors.botSelect)) return;

            const pointEligibilityList = document.querySelector(CONFIG.selectors.eligibilityList);
            if (!pointEligibilityList) return;

            const fragment = document.createDocumentFragment();
            this.botSelect = this.createBotSelect();
            this.difficultySelect = this.createDifficultySelect();

            [
                { dropdown: this.botSelect, style: 'margin-left: 4px;' },
                { dropdown: this.difficultySelect, style: 'margin-left: 4px;' }
            ].forEach(({ dropdown, style }) => {
                const item = document.createElement('li');
                item.style = style;
                item.appendChild(dropdown);
                fragment.appendChild(item);
            });

            pointEligibilityList.appendChild(fragment);
        }

        enableButton(button, teamId) {
            if (button.hasAttribute('data-bot-enabled')) return;

            button.removeAttribute('disabled');
            button.classList.remove('disabled');
            button.style.pointerEvents = 'auto';
            button.style.opacity = '1';

            button.onclick = () => {
                const selectedChampOption = this.botSelect?.querySelector('lol-uikit-dropdown-option[selected]');
                const selectedDiffOption = this.difficultySelect?.querySelector('lol-uikit-dropdown-option[selected]');
                
                const championId = selectedChampOption?.value || selectedChampOption?.getAttribute('value');
                const difficulty = selectedDiffOption?.value || selectedDiffOption?.getAttribute('value');
                
                this.addBot(
                    teamId,
                    championId ? parseInt(championId) : null,
                    difficulty || null,
                    button
                );
            };
            
            button.setAttribute('data-bot-enabled', 'true');
        }

        enableAramBots() {
            const disabledBotButtons = Array.from(
                document.querySelectorAll(CONFIG.selectors.botButton)
            ).filter(button => button.textContent.trim() === 'Add Bot');

            if (disabledBotButtons.length > 0) {
                this.createDropdowns();
                
                disabledBotButtons.forEach(button => {
                    const teamContainer = button.closest('.custom-game-team');
                    const teamId = teamContainer?.classList.contains('custom-game-team-two') ? 200 : 100;
                    this.enableButton(button, teamId);
                });
            }
        }

        observeDOM() {
            const debouncedEnable = debounce(() => this.enableAramBots(), 100);
            
            this.observer = new MutationObserver(mutations => {
                if (mutations.some(mutation => 
                    Array.from(mutation.addedNodes).some(node => 
                        node.nodeType === Node.ELEMENT_NODE))) {
                    debouncedEnable();
                }
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    // Initialize when window loads
    window.addEventListener('load', () => new AramBotEnabler());
})();
