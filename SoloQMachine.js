/**
 * @name SoloQMachine
 * @author Yimikami
 * @description Your ranked autopilot: Auto Accept, Auto Matchmaking, Auto Honor, Auto Play Again, Instant Ranked Lobby, UI cleanup, and in-game settings panel
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.2
 */

let soloQSocket;
export function init(context) { soloQSocket = context.socket; }

(() => {
    const DEFAULT_CONFIG = {
        debug: false,
        queueId: 420,
        autoAccept: { enabled: true, delayMs: 0 },
        autoMatchmaking: { enabled: true, delayMs: 3000, minimumMembers: 1, waitForInvites: true },
        autoHonor: { enabled: true },
        autoPlayAgain: { enabled: true, delayMs: 2000 },
        instantRankedLobby: { enabled: true },
        removeElements: {
            enabled: true,
            selectors: [
                '.right-nav-menu',
                '.left-nav-menu',
                'lol-uikit-navigation-item[item-id="challenges-collection"]',
                'lol-uikit-navigation-item[item-id="profile-main-highlights"]',
                '.social-button',
                '.notifications-button',
                '.missions-tracker-button-component',
            ],
        },
    };

    const STORAGE_KEY = 'soloq-machine-settings';

    const deepMerge = (target, source) => {
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) target[key] = {};
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    };

    const loadConfig = () => {
        try {
            const saved = DataStore.get(STORAGE_KEY);
            if (saved) return deepMerge(structuredClone(DEFAULT_CONFIG), JSON.parse(saved));
        } catch (e) {
            console.error('[SoloQMachine] Config load error:', e);
        }
        return structuredClone(DEFAULT_CONFIG);
    };

    const saveConfig = (config) => {
        try {
            DataStore.set(STORAGE_KEY, JSON.stringify(config));
        } catch (e) {
            console.error('[SoloQMachine] Config save error:', e);
        }
    };

    let CONFIG = loadConfig();

    const log = (...args) => {
        if (CONFIG.debug) console.log('[SoloQMachine]', ...args);
    };

    const lcuFetch = async (url, method = 'GET', body = null) => {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`LCU ${method} ${url} → ${res.status}: ${text}`);
        }
        if (res.status === 204) return null;
        return res.json().catch(() => null);
    };

    class SoloQMachine {
        constructor() {
            this._observer = null;
            this._phasePoller = null;
            this._autoAcceptTimer = null;
            this._autoMatchmakingTimer = null;
            this._lobbyCheckInterval = null;
            this._autoPlayAgainTimer = null;
            this._currentPhase = null;
            this._settingsPanel = null;
            this._styleEl = null;
            this._settingsOpen = false;
            this._settingsBtn = null;
            this._disposed = false;
            this._actionRevision = 0;
            this._matchmakingRevision = 0;
            this._buttonHandlers = new Map();
            this.init();
        }

        async init() {
            try {
                log('Initializing...');
                this.injectHideStyles();
                this.observeDOM();
                this.startPhasePolling();
                this.waitForClientAndCreateButton();
                this.setupCleanup();
                log('Initialized successfully');
            } catch (e) {
                console.error('[SoloQMachine] Init failed:', e);
            }
        }

        waitForClientAndCreateButton() {
            const tryCreate = () => {
                if (document.querySelector('.rcp-fe-lol-home, .lol-uikit-navigation-bar, .lobby-banner')) {
                    this.createSettingsButton();
                    return true;
                }
                return false;
            };
            if (tryCreate()) return;
            let attempts = 0;
            const interval = this._readinessTimer = setInterval(() => {
                attempts++;
                if (tryCreate() || attempts > 60) {
                    clearInterval(interval);
                    if (attempts > 60) {
                        log('Client readiness timeout, creating button anyway');
                        this.createSettingsButton();
                    }
                }
            }, 500);
        }

        setupCleanup() {
            window.addEventListener('unload', () => this.cleanup());
        }

        cleanup() {
            log('Cleaning up...');
            this._disposed = true;
            this._actionRevision++;
            this.cancelAutoMatchmaking();
            this._phaseSubscription?.disconnect?.();
            clearInterval(this._readinessTimer);
            clearTimeout(this._autoHonorTimer);
            for (const [button, handler] of this._buttonHandlers) {
                button.removeEventListener('click', handler, true);
            }
            this._buttonHandlers.clear();
            document.querySelectorAll('[data-soloq-machine-hidden]').forEach((el) => delete el.dataset.soloqMachineHidden);
            if (this._observer) this._observer.disconnect();
            if (this._phasePoller) clearInterval(this._phasePoller);
            if (this._autoAcceptTimer) clearTimeout(this._autoAcceptTimer);
            if (this._autoMatchmakingTimer) clearTimeout(this._autoMatchmakingTimer);
            if (this._lobbyCheckInterval) clearInterval(this._lobbyCheckInterval);
            if (this._ensureBtnInterval) clearInterval(this._ensureBtnInterval);
            if (this._autoPlayAgainTimer) clearTimeout(this._autoPlayAgainTimer);
            if (this._styleEl) this._styleEl.remove();
            if (this._settingsBtn) this._settingsBtn.remove();
            if (this._settingsPanel) this._settingsPanel.remove();
        }

        injectHideStyles() {
            if (this._styleEl) this._styleEl.remove();
            if (!CONFIG.removeElements.enabled) return;
            this._styleEl = document.createElement('style');
            this._styleEl.id = 'soloq-machine-styles';
            this._styleEl.textContent = [
                ...CONFIG.removeElements.selectors.map((s) => `${s} { display: none !important; }`),
                '.custom-game-tournament-code-container { display: none !important; }',
                '[data-soloq-machine-hidden="true"] { display: none !important; }',
            ].join('\n');
            (document.head || document.documentElement).appendChild(this._styleEl);
            log('Injected hide styles');
        }

        normalizeText(text) {
            return (text || '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
        }

        setHidden(el, hidden) {
            if (!el) return;
            if (hidden) {
                el.dataset.soloqMachineHidden = 'true';
            } else {
                delete el.dataset.soloqMachineHidden;
            }
        }

        isRankedLabel(text) {
            return /\branked\b/.test(text);
        }

        isSummonersRiftCard(card) {
            const title = this.normalizeText(card.querySelector('.parties-game-type-card-name')?.textContent);
            return title === "summoner's rift" || title === 'summoners rift';
        }

        applyRankedOnlyFilters(root = document) {
            if (!CONFIG.removeElements.enabled || !root?.querySelectorAll) return;

            root.querySelectorAll('.parties-game-navs-item').forEach((item) => {
                const text = this.normalizeText(item.textContent);
                const keep = text === 'pvp';
                this.setHidden(item, !keep);
            });

            root.querySelectorAll('.game-type-card').forEach((card) => {
                const categories = Array.from(card.querySelectorAll('.parties-game-type-card-category-div'));
                if (categories.length === 0) return;
                if (!this.isSummonersRiftCard(card)) {
                    this.setHidden(card, true);
                    categories.forEach((category) => this.setHidden(category, true));
                    return;
                }

                let hasRankedCategory = false;
                categories.forEach((category) => {
                    const text = this.normalizeText(category.textContent);
                    const keep = this.isRankedLabel(text);
                    if (keep) hasRankedCategory = true;
                    this.setHidden(category, !keep);
                });

                this.setHidden(card, !hasRankedCategory);
            });
        }

        startPhasePolling() {
            if (soloQSocket?.observe) {
                this._phaseSubscription = soloQSocket.observe('/lol-gameflow/v1/gameflow-phase', (event) => this.setPhase(event.data));
            }
            this._phasePoller = setInterval(() => this.pollPhase(), this._phaseSubscription ? 30000 : 3000);
            this.pollPhase();
        }

        setPhase(phase) {
            if (this._disposed || typeof phase !== 'string' || phase === this._currentPhase) return;
            const previous = this._currentPhase;
            this._currentPhase = phase;
            this.onPhaseChange(phase, previous);
        }

        async pollPhase() {
            if (this._polling || this._disposed) return;
            this._polling = true;
            const revision = this._actionRevision;
            try {
                const res = await fetch('/lol-gameflow/v1/gameflow-phase');
                if (!res.ok) return;
                const phase = await res.json();
                if (revision === this._actionRevision) this.setPhase(phase);
            } catch { } finally { this._polling = false; }
        }

        onPhaseChange(phase, prev) {
            this._actionRevision++;
            clearTimeout(this._autoHonorTimer);
            if (phase === 'ReadyCheck') {
                this.scheduleAutoAccept();
            } else {
                this.cancelAutoAccept();
            }

            if (phase === 'Lobby') {
                this.scheduleAutoMatchmaking();
            } else {
                this.cancelAutoMatchmaking();
            }

            if (phase === 'PreEndOfGame') {
                this.scheduleAutoHonor();
            }

            if (phase === 'EndOfGame' || phase === 'WaitingForStats') {
                this.scheduleAutoPlayAgain(phase);
            } else if (phase !== 'PreEndOfGame') {
                this.cancelAutoPlayAgain();
            }
        }

        recheckCurrentPhase() {
            if (this._currentPhase) {
                log(`Re-checking current phase: ${this._currentPhase}`);
                this.onPhaseChange(this._currentPhase, this._currentPhase);
            }
        }

        scheduleAutoAccept() {
            this.cancelAutoAccept();
            if (!CONFIG.autoAccept.enabled || this._disposed) return;
            const delay = CONFIG.autoAccept.delayMs;
            log(`Will auto-accept in ${delay}ms`);
            const revision = this._actionRevision;
            this._autoAcceptTimer = setTimeout(() => this.acceptMatch(revision), delay);
        }

        cancelAutoAccept() {
            if (this._autoAcceptTimer) {
                clearTimeout(this._autoAcceptTimer);
                this._autoAcceptTimer = null;
            }
        }

        async canRunAction(revision, feature, phases) {
            const current = () => !this._disposed && revision === this._actionRevision && CONFIG[feature].enabled && phases.includes(this._currentPhase);
            if (!current()) return false;
            const phase = await lcuFetch('/lol-gameflow/v1/gameflow-phase');
            const session = await lcuFetch('/lol-gameflow/v1/session');
            return current() && phases.includes(phase) && session?.gameData?.queue?.id === CONFIG.queueId;
        }

        async acceptMatch(revision = this._actionRevision) {
            try {
                if (!await this.canRunAction(revision, 'autoAccept', ['ReadyCheck'])) return;
                await lcuFetch('/lol-matchmaking/v1/ready-check/accept', 'POST');
                log('Match accepted!');
            } catch (e) {
                log('Accept failed:', e.message);
            }
        }

        scheduleAutoMatchmaking() {
            this.cancelAutoMatchmaking();
            if (!CONFIG.autoMatchmaking.enabled || this._disposed) return;
            const delay = CONFIG.autoMatchmaking.delayMs;
            log(`Will start matchmaking in ${delay}ms`);
            this._autoMatchmakingTimer = setTimeout(() => this.tryStartMatchmaking(), delay);
        }

        cancelAutoMatchmaking() {
            this._matchmakingRevision++;
            if (this._autoMatchmakingTimer) {
                clearTimeout(this._autoMatchmakingTimer);
                this._autoMatchmakingTimer = null;
            }
            if (this._lobbyCheckInterval) {
                clearInterval(this._lobbyCheckInterval);
                this._lobbyCheckInterval = null;
            }
        }

        async getLobbyState() {
            try {
                return await lcuFetch('/lol-lobby/v2/lobby');
            } catch {
                return null;
            }
        }

        async canStartMatchmaking() {
            const lobby = await this.getLobbyState();
            if (!lobby) {
                log('No lobby data available');
                return false;
            }
            if (lobby.gameConfig?.queueId !== CONFIG.queueId || lobby.localMember?.isLeader !== true) return false;
            if (lobby.canStartActivity === false) return false;

            const memberCount = lobby.members ? lobby.members.length : 0;
            const minMembers = CONFIG.autoMatchmaking.minimumMembers;
            if (memberCount < minMembers) {
                log(`Waiting for members: ${memberCount}/${minMembers}`);
                return false;
            }

            if (CONFIG.autoMatchmaking.waitForInvites && lobby.invitations) {
                const pending = lobby.invitations.filter((i) => i.state === 'Pending');
                if (pending.length > 0) {
                    log(`Waiting for ${pending.length} pending invitee(s)`);
                    return false;
                }
            }

            return true;
        }

        async tryStartMatchmaking() {
            if (this._matchmakingBusy) return;
            const revision = this._matchmakingRevision;
            const current = () => !this._disposed && CONFIG.autoMatchmaking.enabled &&
                this._currentPhase === 'Lobby' && revision === this._matchmakingRevision;
            if (!current()) return;
            this._matchmakingBusy = true;
            try {
                const ready = await this.canStartMatchmaking();
                if (!current()) return;
                if (ready) {
                    const phase = await lcuFetch('/lol-gameflow/v1/gameflow-phase');
                    if (current() && phase === 'Lobby') await this.startMatchmaking();
                } else {
                    this._autoMatchmakingTimer = setTimeout(() => this.tryStartMatchmaking(), 3000);
                }
            } catch (error) { log('Lobby check failed:', error.message); }
            finally { this._matchmakingBusy = false; }
        }

        async startMatchmaking() {
            try {
                await lcuFetch('/lol-lobby/v2/lobby/matchmaking/search', 'POST');
                log('Matchmaking started!');
            } catch (e) {
                log('Matchmaking failed:', e.message);
            }
        }

        scheduleAutoHonor() {
            if (!CONFIG.autoHonor.enabled) return;
            const revision = this._actionRevision;
            this._autoHonorTimer = setTimeout(() => this.honorPlayer(revision), 1500);
        }

        async honorPlayer(revision = this._actionRevision) {
            if (this._honoring) return;
            this._honoring = true;
            try {
                const ballot = await lcuFetch('/lol-honor-v2/v1/ballot');
                if (!ballot?.gameId || !Array.isArray(ballot.eligibleAllies)) return;
                if (ballot.votePool && ballot.votePool.votes <= 0) return;
                this._honoredGames ||= new Set();
                if (this._honoredGames.has(String(ballot.gameId))) return;
                const alreadyHonored = new Set((ballot.honoredPlayers || []).map((player) => player.recipientPuuid));
                const candidates = ballot.eligibleAllies.filter((player) =>
                    !player.botPlayer && player.puuid && player.summonerId && !alreadyHonored.has(player.puuid));
                if (!candidates.length) return;
                const target = candidates[Math.floor(Math.random() * candidates.length)];
                if (!await this.canRunAction(revision, 'autoHonor', ['PreEndOfGame'])) return;
                // Verified against the client's /Help definition; honorCategory is not an accepted field.
                await lcuFetch('/lol-honor-v2/v1/honor-player', 'POST', {
                    honorType: 'HEART',
                    gameId: ballot.gameId,
                    summonerId: target.summonerId,
                    puuid: target.puuid,
                });
                this._honoredGames.add(String(ballot.gameId));
                if (this._honoredGames.size > 100) this._honoredGames.delete(this._honoredGames.values().next().value);
                log('Honor submitted!');
            } catch (e) {
                log('Honor failed:', e.message);
            } finally { this._honoring = false; }
        }

        scheduleAutoPlayAgain(phase) {
            this.cancelAutoPlayAgain();
            if (!CONFIG.autoPlayAgain.enabled || this._disposed) return;
            const delay = phase === 'WaitingForStats' ? Math.max(CONFIG.autoPlayAgain.delayMs, 5000) : CONFIG.autoPlayAgain.delayMs;
            log(`Will play again in ${delay}ms (phase: ${phase})`);
            const revision = this._actionRevision;
            this._autoPlayAgainTimer = setTimeout(() => this.playAgain(revision), delay);
        }

        cancelAutoPlayAgain() {
            if (this._autoPlayAgainTimer) {
                clearTimeout(this._autoPlayAgainTimer);
                this._autoPlayAgainTimer = null;
            }
        }

        async playAgain(revision = this._actionRevision) {
            try {
                if (!await this.canRunAction(revision, 'autoPlayAgain', ['EndOfGame', 'WaitingForStats'])) return;
                await lcuFetch('/lol-lobby/v2/play-again', 'POST');
                log('Play again!');
            } catch (e) {
                log('Play again failed:', e.message);
            }
        }

        async createRankedLobby() {
            if (this._creatingLobby || this._disposed) return;
            this._creatingLobby = true;
            try {
                log(`Creating ranked lobby (queueId: ${CONFIG.queueId})`);
                await lcuFetch('/lol-lobby/v2/lobby', 'POST', { queueId: CONFIG.queueId });
                log('Ranked lobby created!');
            } catch (e) {
                log('Lobby creation failed:', e.message);
            } finally { this._creatingLobby = false; }
        }

        ownsPlayButton() { return !this._disposed && CONFIG.instantRankedLobby.enabled; }

        handlePlayButton(btn) {
            if (this._buttonHandlers.has(btn)) return;
            const handler = (e) => {
                if (!this.ownsPlayButton()) return;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.createRankedLobby();
            };
            btn.addEventListener('click', handler, true);
            this._buttonHandlers.set(btn, handler);
            log('Play button intercepted');
        }

        observeDOM() {
            const check = (root) => {
                if (!root || !root.querySelectorAll) return;
                const btns = [...root.querySelectorAll('.play-button-content')];
                if (root.matches?.('.play-button-content')) btns.push(root);
                btns.forEach((btn) => {
                    this.handlePlayButton(btn);
                });
                for (const [button, handler] of this._buttonHandlers) {
                    if (!button.isConnected) {
                        button.removeEventListener('click', handler, true);
                        this._buttonHandlers.delete(button);
                    }
                }

                this.applyRankedOnlyFilters(root);
            };

            check(document.body);

            this._observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== 1) continue;
                        check(node);
                    }
                }
            });
            this._observer.observe(document.body, { childList: true, subtree: true });
        }

        createSettingsButton() {
            const existing = document.getElementById('soloq-machine-settings-btn');
            if (existing) existing.remove();
            if (this._settingsBtn) this._settingsBtn.remove();

            const btn = document.createElement('div');
            btn.id = 'soloq-machine-settings-btn';
            btn.title = 'SoloQ Machine Settings';
            btn.setAttribute('style', [
                'position: fixed',
                'bottom: 12px',
                'right: 12px',
                'width: 36px',
                'height: 36px',
                'border-radius: 50%',
                'background: linear-gradient(135deg, #0a1428, #1a3a5c)',
                'border: 1px solid #c8aa6e',
                'display: flex',
                'align-items: center',
                'justify-content: center',
                'cursor: pointer',
                'z-index: 2147483647',
                'transition: all 0.2s ease',
                'box-shadow: 0 2px 8px rgba(0,0,0,0.5)',
                'user-select: none',
                'pointer-events: auto',
            ].join('; '));

            const icon = document.createElement('div');
            icon.setAttribute('style', [
                'width: 20px',
                'height: 20px',
                'background-image: url(/fe/lol-navigation/control-settings.png)',
                'background-size: contain',
                'background-repeat: no-repeat',
                'background-position: center',
                'pointer-events: none',
            ].join('; '));
            btn.appendChild(icon);

            btn.onmouseenter = () => {
                btn.style.transform = 'scale(1.15)';
                btn.style.boxShadow = '0 4px 16px rgba(200,170,110,0.4)';
            };
            btn.onmouseleave = () => {
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
            };
            btn.onmousedown = (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            };
            btn.onclick = (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
                log('Settings button clicked');
                this.toggleSettings();
            };

            document.body.appendChild(btn);
            this._settingsBtn = btn;
            log('Settings button created');

            const ensureBtn = setInterval(() => {
                if (!document.body.contains(this._settingsBtn)) {
                    log('Settings button re-appended');
                    document.body.appendChild(this._settingsBtn);
                }
            }, 2000);
            this._ensureBtnInterval = ensureBtn;
        }

        toggleSettings() {
            if (this._settingsOpen) {
                this.closeSettings();
            } else {
                this.openSettings();
            }
        }

        openSettings() {
            if (this._disposed) return;
            if (this._settingsPanel) this._settingsPanel.remove();
            this._settingsOpen = true;
            this._settingsPanel = this.buildSettingsPanel();
            document.body.appendChild(this._settingsPanel);
            log('Settings panel opened');
        }

        closeSettings() {
            this._settingsOpen = false;
            if (this._settingsPanel) {
                const panel = this._settingsPanel;
                this._settingsPanel.style.opacity = '0';
                this._settingsPanel.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    panel.remove();
                    if (this._settingsPanel === panel) {
                        this._settingsPanel = null;
                    }
                }, 200);
            }
            log('Settings panel closed');
        }

        buildSettingsPanel() {
            const panel = document.createElement('div');
            panel.id = 'soloq-machine-settings-panel';
            panel.setAttribute('style', [
                'position: fixed',
                'bottom: 56px',
                'right: 12px',
                'width: 320px',
                'max-height: 70vh',
                'overflow-y: auto',
                'background: linear-gradient(180deg, #0a1428 0%, #091428 100%)',
                'border: 1px solid #c8aa6e',
                'border-radius: 8px',
                'color: #cdbe91',
                'font-family: "Beaufort for LOL", Arial, sans-serif',
                'font-size: 13px',
                'z-index: 2147483647',
                'box-shadow: 0 8px 32px rgba(0,0,0,0.7)',
                'padding: 0',
                'opacity: 0',
                'transform: translateY(10px)',
                'transition: all 0.2s ease',
                'pointer-events: auto',
            ].join('; '));

            panel.onmousedown = (e) => e.stopPropagation();

            requestAnimationFrame(() => {
                panel.style.opacity = '1';
                panel.style.transform = 'translateY(0)';
            });

            const header = document.createElement('div');
            header.setAttribute('style', 'display:flex;justify-content:space-between;align-items:center;padding:14px 16px 10px;border-bottom:1px solid #1e2d3d');

            const title = document.createElement('span');
            title.textContent = 'SoloQ Machine';
            title.setAttribute('style', 'font-size:15px;font-weight:700;color:#c8aa6e;letter-spacing:0.5px;text-transform:uppercase');

            const closeBtn = document.createElement('span');
            closeBtn.textContent = '✕';
            closeBtn.setAttribute('style', 'cursor:pointer;font-size:14px;color:#5b5a56;transition:color 0.15s');
            closeBtn.onmouseenter = () => (closeBtn.style.color = '#c8aa6e');
            closeBtn.onmouseleave = () => (closeBtn.style.color = '#5b5a56');
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeSettings();
            };

            header.appendChild(title);
            header.appendChild(closeBtn);
            panel.appendChild(header);

            const body = document.createElement('div');
            body.setAttribute('style', 'padding:8px 16px 16px');

            const addSection = (text) => {
                const s = document.createElement('div');
                s.textContent = text;
                s.setAttribute('style', 'color:#c8aa6e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:12px 0 4px');
                body.appendChild(s);
            };

            const addToggle = (label, value, onChange) => {
                const row = document.createElement('div');
                row.setAttribute('style', 'display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1e2d3d');

                const lbl = document.createElement('span');
                lbl.textContent = label;
                lbl.setAttribute('style', 'color:#a09b8c');

                const sw = document.createElement('div');
                let current = value;

                const render = (v) => {
                    sw.setAttribute('style', `width:38px;height:20px;border-radius:10px;background:${v ? '#2d8f4e' : '#3c3c41'};position:relative;cursor:pointer;transition:background 0.2s`);
                    sw.innerHTML = '';
                    const knob = document.createElement('div');
                    knob.setAttribute('style', `width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:2px;left:${v ? '20px' : '2px'};transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3)`);
                    sw.appendChild(knob);
                };

                render(current);
                sw.onclick = (e) => {
                    e.stopPropagation();
                    current = !current;
                    render(current);
                    onChange(current);
                    saveConfig(CONFIG);
                };

                row.appendChild(lbl);
                row.appendChild(sw);
                body.appendChild(row);
            };

            const addDelay = (label, valueMs, onChange) => {
                const row = document.createElement('div');
                row.setAttribute('style', 'display:flex;justify-content:space-between;align-items:center;padding:8px 0 10px;border-bottom:1px solid #1e2d3d');

                const lbl = document.createElement('span');
                lbl.textContent = label;
                lbl.setAttribute('style', 'color:#7a7a7a;font-size:12px;padding-left:8px');

                const wrap = document.createElement('div');
                wrap.setAttribute('style', 'display:flex;align-items:center;gap:4px');

                const input = document.createElement('input');
                input.type = 'number';
                input.min = '0';
                input.max = '30';
                input.step = '0.5';
                input.value = (valueMs / 1000).toFixed(1);
                input.setAttribute('style', 'width:54px;background:#1e2328;border:1px solid #3c3c41;border-radius:4px;color:#cdbe91;padding:3px 6px;text-align:center;font-size:12px;outline:none');
                input.onfocus = () => (input.style.borderColor = '#c8aa6e');
                input.onblur = () => (input.style.borderColor = '#3c3c41');
                input.onchange = () => {
                    let v = parseFloat(input.value);
                    if (isNaN(v) || v < 0) v = 0;
                    if (v > 30) v = 30;
                    input.value = v.toFixed(1);
                    onChange(Math.round(v * 1000));
                    saveConfig(CONFIG);
                };
                input.onmousedown = (e) => e.stopPropagation();

                const unit = document.createElement('span');
                unit.textContent = 's';
                unit.setAttribute('style', 'color:#5b5a56;font-size:12px');

                wrap.appendChild(input);
                wrap.appendChild(unit);
                row.appendChild(lbl);
                row.appendChild(wrap);
                body.appendChild(row);
            };

            addSection('Queue Automation');
            addToggle('Auto Accept', CONFIG.autoAccept.enabled, (v) => { CONFIG.autoAccept.enabled = v; this.recheckCurrentPhase(); });
            addDelay('Accept Delay', CONFIG.autoAccept.delayMs, (v) => { CONFIG.autoAccept.delayMs = v; });
            addToggle('Auto Matchmaking', CONFIG.autoMatchmaking.enabled, (v) => { CONFIG.autoMatchmaking.enabled = v; this.recheckCurrentPhase(); });
            addDelay('Matchmaking Delay', CONFIG.autoMatchmaking.delayMs, (v) => { CONFIG.autoMatchmaking.delayMs = v; });
            const subStyle = 'padding-left:16px;border-left:2px solid #1e2d3d;margin-left:4px';

            const waitRow = document.createElement('div');
            waitRow.setAttribute('style', `display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1e2d3d;${subStyle}`);
            const waitLbl = document.createElement('span');
            waitLbl.textContent = 'Wait for Invites';
            waitLbl.setAttribute('style', 'color:#7a7a7a;font-size:12px');
            const waitSw = document.createElement('div');
            let waitVal = CONFIG.autoMatchmaking.waitForInvites;
            const renderWait = (v) => {
                waitSw.setAttribute('style', `width:34px;height:18px;border-radius:9px;background:${v ? '#2d8f4e' : '#3c3c41'};position:relative;cursor:pointer;transition:background 0.2s`);
                waitSw.innerHTML = '';
                const knob = document.createElement('div');
                knob.setAttribute('style', `width:14px;height:14px;border-radius:50%;background:#fff;position:absolute;top:2px;left:${v ? '18px' : '2px'};transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3)`);
                waitSw.appendChild(knob);
            };
            renderWait(waitVal);
            waitSw.onclick = (e) => {
                e.stopPropagation();
                waitVal = !waitVal;
                renderWait(waitVal);
                CONFIG.autoMatchmaking.waitForInvites = waitVal;
                saveConfig(CONFIG);
            };
            waitRow.appendChild(waitLbl);
            waitRow.appendChild(waitSw);
            body.appendChild(waitRow);

            const minRow = document.createElement('div');
            minRow.setAttribute('style', `display:flex;justify-content:space-between;align-items:center;padding:8px 0 10px;border-bottom:1px solid #1e2d3d;${subStyle}`);
            const minLbl = document.createElement('span');
            minLbl.textContent = 'Min. Lobby Members';
            minLbl.setAttribute('style', 'color:#7a7a7a;font-size:12px');
            const minInput = document.createElement('input');
            minInput.type = 'number';
            minInput.min = '1';
            minInput.max = '5';
            minInput.step = '1';
            minInput.value = CONFIG.autoMatchmaking.minimumMembers;
            minInput.setAttribute('style', 'width:54px;background:#1e2328;border:1px solid #3c3c41;border-radius:4px;color:#cdbe91;padding:3px 6px;text-align:center;font-size:12px;outline:none');
            minInput.onfocus = () => (minInput.style.borderColor = '#c8aa6e');
            minInput.onblur = () => (minInput.style.borderColor = '#3c3c41');
            minInput.onchange = () => {
                let v = parseInt(minInput.value);
                if (isNaN(v) || v < 1) v = 1;
                if (v > 5) v = 5;
                minInput.value = v;
                CONFIG.autoMatchmaking.minimumMembers = v;
                saveConfig(CONFIG);
            };
            minInput.onmousedown = (e) => e.stopPropagation();
            minRow.appendChild(minLbl);
            minRow.appendChild(minInput);
            body.appendChild(minRow);

            addSection('Post-Game');
            addToggle('Auto Honor', CONFIG.autoHonor.enabled, (v) => { CONFIG.autoHonor.enabled = v; this.recheckCurrentPhase(); });
            addToggle('Auto Play Again', CONFIG.autoPlayAgain.enabled, (v) => { CONFIG.autoPlayAgain.enabled = v; this.recheckCurrentPhase(); });
            addDelay('Play Again Delay', CONFIG.autoPlayAgain.delayMs, (v) => { CONFIG.autoPlayAgain.delayMs = v; });

            addSection('Lobby');
            addToggle('Instant Ranked Lobby', CONFIG.instantRankedLobby.enabled, (v) => { CONFIG.instantRankedLobby.enabled = v; });

            addSection('UI');
            addToggle('Hide Distracting Elements', CONFIG.removeElements.enabled, (v) => {
                CONFIG.removeElements.enabled = v;
                this.injectHideStyles();
            });
            addToggle('Debug Logging', CONFIG.debug, (v) => { CONFIG.debug = v; });

            const resetRow = document.createElement('div');
            resetRow.setAttribute('style', 'padding:14px 0 4px;text-align:center');

            const resetBtn = document.createElement('button');
            resetBtn.textContent = 'Reset to Defaults';
            resetBtn.setAttribute('style', 'background:transparent;border:1px solid #5b5a56;border-radius:4px;color:#5b5a56;padding:5px 16px;font-size:11px;cursor:pointer;transition:all 0.15s;text-transform:uppercase;letter-spacing:0.5px');
            resetBtn.onmouseenter = () => { resetBtn.style.borderColor = '#c8aa6e'; resetBtn.style.color = '#c8aa6e'; };
            resetBtn.onmouseleave = () => { resetBtn.style.borderColor = '#5b5a56'; resetBtn.style.color = '#5b5a56'; };
            resetBtn.onclick = (e) => {
                e.stopPropagation();
                CONFIG = structuredClone(DEFAULT_CONFIG);
                saveConfig(CONFIG);
                this.recheckCurrentPhase();
                this.injectHideStyles();
                this.closeSettings();
                setTimeout(() => this.openSettings(), 250);
            };

            resetRow.appendChild(resetBtn);
            body.appendChild(resetRow);
            panel.appendChild(body);

            const scrollStyle = document.createElement('style');
            scrollStyle.textContent = `
        #soloq-machine-settings-panel::-webkit-scrollbar{width:4px}
        #soloq-machine-settings-panel::-webkit-scrollbar-track{background:transparent}
        #soloq-machine-settings-panel::-webkit-scrollbar-thumb{background:#3c3c41;border-radius:2px}
        #soloq-machine-settings-panel::-webkit-scrollbar-thumb:hover{background:#5b5a56}
      `;
            panel.appendChild(scrollStyle);

            return panel;
        }
    }

    window.addEventListener('load', () => {
        console.log('[SoloQMachine] Window loaded, starting plugin');
        window.soloQMachine = new SoloQMachine();
    });
})();
