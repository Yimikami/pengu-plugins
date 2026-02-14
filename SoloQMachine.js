/**
 * @name SoloQMachine
 * @author Yimikami
 * @description Your ranked autopilot: Auto Accept, Auto Matchmaking, Auto Honor, Auto Play Again, Instant Ranked Lobby, UI cleanup, and in-game settings panel
 * @link https://github.com/Yimikami/pengu-plugins/
 * @version 0.0.1
 */

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
            const interval = setInterval(() => {
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
            this._styleEl.textContent = CONFIG.removeElements.selectors
                .map((s) => `${s} { display: none !important; }`)
                .join('\n');
            (document.head || document.documentElement).appendChild(this._styleEl);
            log('Injected hide styles');
        }

        startPhasePolling() {
            this._phasePoller = setInterval(() => this.pollPhase(), 1500);
            this.pollPhase();
        }

        async pollPhase() {
            try {
                const res = await fetch('/lol-gameflow/v1/gameflow-phase');
                if (!res.ok) return;
                const phase = await res.json();
                if (phase !== this._currentPhase) {
                    const prev = this._currentPhase;
                    this._currentPhase = phase;
                    log(`Phase: ${prev} → ${phase}`);
                    this.onPhaseChange(phase, prev);
                }
            } catch { }
        }

        onPhaseChange(phase, prev) {
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
            if (!CONFIG.autoAccept.enabled) return;
            this.cancelAutoAccept();
            const delay = CONFIG.autoAccept.delayMs;
            log(`Will auto-accept in ${delay}ms`);
            this._autoAcceptTimer = setTimeout(() => this.acceptMatch(), delay);
        }

        cancelAutoAccept() {
            if (this._autoAcceptTimer) {
                clearTimeout(this._autoAcceptTimer);
                this._autoAcceptTimer = null;
            }
        }

        async acceptMatch() {
            try {
                await lcuFetch('/lol-matchmaking/v1/ready-check/accept', 'POST');
                log('Match accepted!');
            } catch (e) {
                log('Accept failed:', e.message);
            }
        }

        scheduleAutoMatchmaking() {
            if (!CONFIG.autoMatchmaking.enabled) return;
            this.cancelAutoMatchmaking();
            const delay = CONFIG.autoMatchmaking.delayMs;
            log(`Will start matchmaking in ${delay}ms`);
            this._autoMatchmakingTimer = setTimeout(() => this.tryStartMatchmaking(), delay);
        }

        cancelAutoMatchmaking() {
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
            const canStart = await this.canStartMatchmaking();
            if (canStart) {
                this.startMatchmaking();
                return;
            }

            log('Matchmaking conditions not met, rechecking every 3s');
            this._lobbyCheckInterval = setInterval(async () => {
                if (this._currentPhase !== 'Lobby') {
                    this.cancelAutoMatchmaking();
                    return;
                }
                const ready = await this.canStartMatchmaking();
                if (ready) {
                    clearInterval(this._lobbyCheckInterval);
                    this._lobbyCheckInterval = null;
                    this.startMatchmaking();
                }
            }, 3000);
        }

        async startMatchmaking() {
            try {
                await lcuFetch('/lol-lobby/v2/lobby/matchmaking/search', 'POST');
                log('Matchmaking started!');
            } catch (e) {
                log('Matchmaking failed:', e.message);
            }
        }

        async scheduleAutoHonor() {
            if (!CONFIG.autoHonor.enabled) return;
            await new Promise((r) => setTimeout(r, 1500));
            this.honorPlayer();
        }

        async honorPlayer() {
            try {
                const ballot = await lcuFetch('/lol-honor-v2/v1/ballot');
                if (!ballot || !ballot.eligibleAllies || ballot.eligibleAllies.length === 0) {
                    log('No eligible allies, submitting empty ballot');
                    await lcuFetch('/lol-honor-v2/v1/honor-player', 'POST', {
                        honorCategory: 'HEART',
                        summonerId: 0,
                    });
                    return;
                }
                const nonBots = ballot.eligibleAllies.filter((a) => !a.botPlayer);
                if (nonBots.length === 0) {
                    log('All allies are bots, skipping');
                    await lcuFetch('/lol-honor-v2/v1/honor-player', 'POST', {
                        honorCategory: 'HEART',
                        summonerId: 0,
                    });
                    return;
                }
                const target = nonBots[Math.floor(Math.random() * nonBots.length)];
                log(`Honoring: ${target.summonerName || target.summonerId}`);
                await lcuFetch('/lol-honor-v2/v1/honor-player', 'POST', {
                    honorCategory: 'HEART',
                    summonerId: target.summonerId,
                });
                log('Honor submitted!');
            } catch (e) {
                log('Honor failed:', e.message);
            }
        }

        scheduleAutoPlayAgain(phase) {
            if (!CONFIG.autoPlayAgain.enabled) return;
            this.cancelAutoPlayAgain();
            const delay = phase === 'WaitingForStats' ? Math.max(CONFIG.autoPlayAgain.delayMs, 5000) : CONFIG.autoPlayAgain.delayMs;
            log(`Will play again in ${delay}ms (phase: ${phase})`);
            this._autoPlayAgainTimer = setTimeout(() => this.playAgain(), delay);
        }

        cancelAutoPlayAgain() {
            if (this._autoPlayAgainTimer) {
                clearTimeout(this._autoPlayAgainTimer);
                this._autoPlayAgainTimer = null;
            }
        }

        async playAgain() {
            try {
                await lcuFetch('/lol-lobby/v2/play-again', 'POST');
                log('Play again!');
            } catch (e) {
                log('Play again failed:', e.message);
            }
        }

        async createRankedLobby() {
            try {
                log(`Creating ranked lobby (queueId: ${CONFIG.queueId})`);
                await lcuFetch('/lol-lobby/v2/lobby', 'POST', { queueId: CONFIG.queueId });
                log('Ranked lobby created!');
            } catch (e) {
                log('Lobby creation failed:', e.message);
            }
        }

        handlePlayButton(btn) {
            btn.addEventListener('click', (e) => {
                if (!CONFIG.instantRankedLobby.enabled) return;
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.createRankedLobby();
            }, true);
            log('Play button intercepted');
        }

        observeDOM() {
            const check = (root) => {
                if (!root || !root.querySelectorAll) return;
                const btns = root.querySelectorAll('.play-button-content');
                btns.forEach((btn) => {
                    if (btn.dataset.soloqMachineAdded) return;
                    btn.dataset.soloqMachineAdded = 'true';
                    this.handlePlayButton(btn);
                });
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
            if (this._settingsPanel) this._settingsPanel.remove();
            this._settingsOpen = true;
            this._settingsPanel = this.buildSettingsPanel();
            document.body.appendChild(this._settingsPanel);
            log('Settings panel opened');
        }

        closeSettings() {
            this._settingsOpen = false;
            if (this._settingsPanel) {
                this._settingsPanel.style.opacity = '0';
                this._settingsPanel.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    if (this._settingsPanel) {
                        this._settingsPanel.remove();
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
