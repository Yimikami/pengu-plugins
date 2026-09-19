# Pengu Plugins

Nine independent plugins for the League of Legends client, powered by [Pengu Loader](https://github.com/PenguLoader/PenguLoader).

Install only the plugins you want. Each plugin is available separately.

[Downloads](#downloads) · [Installation](#installation) · [Plugin guide](#plugin-guide) · [Get help](#troubleshooting)

## Downloads

Download each ready-to-install plugin from its own release.

| Plugin | Download | What it does |
| --- | --- | --- |
| [SoloQ Machine](#soloq-machine) | [SoloQMachine.js](https://github.com/Yimikami/pengu-plugins/releases/download/soloq-machine/v0.0.2/SoloQMachine.js) | Queue, accept, honor and play-again automation |
| [Rune Plugin](#rune-plugin) | [RunePlugin.js](https://github.com/Yimikami/pengu-plugins/releases/download/rune-plugin/v0.0.6/RunePlugin.js) | Automatic runes and item sets |
| [Icon Swapper](#icon-swapper) | [IconSwapper.js](https://github.com/Yimikami/pengu-plugins/releases/download/icon-swapper/v0.1.1/IconSwapper.js) | Local summoner icon customization |
| [Profile Win/Loss](#profile-winloss) | [ProfileWinLose.js](https://github.com/Yimikami/pengu-plugins/releases/download/profile-win-loss/v0.0.4/ProfileWinLose.js) | Profile win rate, match counts and KDA |
| [Champion Dismisser](#champion-dismisser) | [ChampionDismisser.js](https://github.com/Yimikami/pengu-plugins/releases/download/champion-dismisser/v0.0.3/ChampionDismisser.js) | Blacklist owned champions; excludes Classic variants |
| [Mass Report](#mass-report) | [MassReport.js](https://github.com/Yimikami/pengu-plugins/releases/download/mass-report/v0.0.5/MassReport.js) | Match-history reporting with whitelist controls |
| [Force Badge](#force-badge) | [ForceBadge.js](https://github.com/Yimikami/pengu-plugins/releases/download/force-badge/v0.0.2/ForceBadge.js) | Visual Game Pass badges for champions and skins |
| [Instant Ranked Lobby](#instant-ranked-lobby) | [InstantRankedLobby.js](https://github.com/Yimikami/pengu-plugins/releases/download/instant-ranked-lobby/v0.0.2/InstantRankedLobby.js) | Create a ranked Solo/Duo lobby from Play |
| [Dodge Game](#dodge-game) | [DodgeGame-0.1.1.zip](https://github.com/Yimikami/pengu-plugins/releases/download/dodge-game/v0.1.1/DodgeGame-0.1.1.zip) | In-client 3D skillshot dodge mini-game |

For older versions, browse [all releases](https://github.com/Yimikami/pengu-plugins/releases). Use the named plugin asset, rather than GitHub's **Source code** archives, which contain the whole repository.

## Installation

1. Install and enable [Pengu Loader](https://github.com/PenguLoader/PenguLoader).
2. Download the plugins you want from the table above.
3. Put each `.js` file directly in Pengu Loader's `plugins` folder. For Dodge Game, extract the ZIP and put the complete `DodgeGame` folder there.
4. Restart the League client.

Example with Rune Plugin and Dodge Game installed:

```text
Pengu Loader/
└── plugins/
    ├── RunePlugin.js
    └── DodgeGame/
        ├── index.js
        ├── styles.css
        ├── assets/
        └── src/
```

**Updating:** close the client, replace the previous file or folder with the new download, then reopen the client. Keep the original filename and avoid duplicate copies. Existing settings are retained.

**Removing a plugin:** close the client and remove its file or folder from `plugins`. If Rune Plugin has backed up one of your personal pages, restore it before removing the plugin.

MCP and Node.js are not required to use these plugins. Some features download external data, libraries or models and need an internet connection.

## Plugin guide

### SoloQ Machine

Automates ready-check acceptance, matchmaking, honor and returning to the lobby. It also includes an instant ranked lobby shortcut and optional client UI cleanup.

Open the plugin's gear button in the bottom-right corner to configure automation, delays, pending invitations and minimum lobby members. Matchmaking requires the configured queue and lobby leadership.

Automation and UI cleanup are enabled by default on a fresh installation. Review the settings before entering a lobby.

### Rune Plugin

Applies champion- and role-specific runes during champion select, using **Lolalytics** or **U.GG**. U.GG failures fall back to Lolalytics; optional item sets come from Lolalytics.

- Configure it in **Client Settings → Rune Plugin**.
- Generated page names are short, such as `[R] Ahri Mid`.
- The plugin reuses its own page and preserves unrelated item sets.
- If all rune-page slots are full, including on two-page accounts, it backs up an editable personal page locally and updates that page in place. It does not delete your pages.
- To recover that personal page, press `Ctrl+K` → **Restore backed-up rune page**. Automatic runes pause for the rest of the current champion select after a successful restore.

The backup belongs to the current account and is stored in Pengu's local data. Keep that data until you restore the page.

### Icon Swapper

Changes how your summoner icon appears locally in the client.

Press `Ctrl+K` → **Change Summoner Icon** to browse the icon catalog, search by ID, or use a custom image file or URL. The catalog loads in pages of 96 icons. **Revert** restores the original appearance without restarting.

This is a local visual change; it does not unlock icons or change what other players see.

### Profile Win/Loss

Displays win rate, wins/losses and optional KDA on summoner profiles.

Open **Client Settings → Profile Win/Loss** to choose the number of games to analyze and the queue filter. There is no fixed season or date cutoff; results use the available match history within your selected limits.

### Champion Dismisser

Helps you avoid selecting champions you have blacklisted.

Press `Ctrl+K` → **Configure Blacklist**, then search and click champions to toggle them. Blacklisted champions are greyed out and blocked in the champion-select interface.

Only champions you own are listed. Free-rotation-only champions and League Classic variants are excluded.

### Mass Report

Adds report controls to opened matches in match history.

1. Open a match. Its Game ID is filled in automatically when detected; manual entry is available if detection fails.
2. Choose allies, enemies or all players.
3. Review your whitelist and report settings in **Client Settings → Mass Report**, then click **Report**.

Reports are sent only when you click the button. Confirmed reports are remembered per account to avoid repeat submissions. Use reports for actual misconduct.

### Force Badge

Shows Game Pass-style badges on champion and skin thumbnails. It runs automatically and has no settings.

This changes the client presentation only; it does not grant Game Pass benefits or ownership.

### Instant Ranked Lobby

Turns the **Play** button into a shortcut for creating a ranked Solo/Duo lobby.

SoloQ Machine already includes this feature. Choose this standalone plugin if you only want the shortcut.

### Dodge Game

An in-client 3D mini-game with 15 selectable champions and waves of skillshots.

Press `Ctrl+K` → **Launch Dodge Game**, then choose a champion.

| Control | Action |
| --- | --- |
| Right-click | Move |
| S | Stop moving |
| D / F | Flash / Ghost; swap slots in the game's settings |
| Escape | Pause |

The first launch downloads the 3D library and selected champion model. Initial loading depends on your connection; loaded resources are cached for reuse.

## Troubleshooting

**Nothing appears or settings are missing**

- Confirm Pengu Loader is enabled and the file ends in `.js`, not `.js_` or `.txt`.
- Check that there is only one copy of each plugin.
- Restart the League client after installing, updating or enabling a plugin.
- For Dodge Game, confirm `DodgeGame/index.js`, `src` and `assets` are present together.

**Runes, icons or models do not load**

- Check your connection. External providers can be temporarily unavailable.
- For runes, try Lolalytics in the plugin settings.

**Still having trouble?**

- [Report a bug](https://github.com/Yimikami/pengu-plugins/issues/new?template=bug_report.yml)
- [Ask a question](https://github.com/Yimikami/pengu-plugins/issues/new?template=question.yml)
- [Suggest a feature](https://github.com/Yimikami/pengu-plugins/issues/new?template=feature_request.yml)

Include the plugin version, Pengu Loader version, League patch and steps to reproduce. Screenshots or relevant console errors help; remove account details and credentials before posting.

These are community plugins for Pengu Loader and are not affiliated with Riot Games. League client updates can affect compatibility.
