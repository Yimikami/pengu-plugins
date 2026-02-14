<div align="center">

# ⚡ Pengu Plugins

**A premium collection of plugins for League of Legends via [Pengu Loader](https://github.com/PenguLoader/PenguLoader)**

[![Pengu Loader](https://img.shields.io/badge/Pengu_Loader-Compatible-0596aa?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZmZmIj48cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnoiLz48L3N2Zz4=)](https://github.com/PenguLoader/PenguLoader)
[![License](https://img.shields.io/badge/License-MIT-c8aa6e?style=for-the-badge)](LICENSE)

</div>

---

## 📦 Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| [SoloQ Machine](#-soloq-machine) | `0.0.1` | Full ranked autopilot — queue, accept, honor, play again |
| [Rune Plugin](#-rune-plugin) | `0.0.4` | Auto runes & item sets from U.GG / Lolalytics |
| [Icon Swapper](#-icon-swapper) | `0.1.0` | Change your summoner icon to anything (client-side) |
| [Profile Win/Loss](#-profile-winloss) | `0.0.3` | Win/loss stats on any profile page |
| [Champion Dismisser](#-champion-dismisser) | `0.0.1` | Blacklist champions from champ select |
| [Mass Report](#-mass-report) | `0.0.3` | Batch reporting from match history |
| [Force Badge](#-force-badge) | `0.0.1` | Game Pass badge on all champions & skins |
| [ARAM Bot Enabler](#-aram-bot-enabler) | `0.0.1` | Add bots to ARAM custom games |
| [Instant Ranked Lobby](#-instant-ranked-lobby) | `0.0.1` | One-click ranked lobby (standalone) |

---

## 🤖 SoloQ Machine

> Your ranked autopilot. Automates the entire ranked flow so you can focus on the game.

**What it does:**

| Feature | Details |
|---------|---------|
| **Auto Accept** | Accepts match with configurable delay |
| **Auto Matchmaking** | Starts queue automatically when entering lobby |
| **Wait for Invites** | Holds queue until pending invitations are answered |
| **Min. Lobby Members** | Requires N players (1–5) before starting queue |
| **Auto Honor** | Honors a random ally after game |
| **Auto Play Again** | Returns to lobby with configurable delay |
| **Instant Ranked Lobby** | Play button → ranked Solo/Duo lobby |
| **UI Cleanup** | Hides distracting elements (nav menus, social, notifications) |

<details>
<summary><b>⚙️ Configuration</b></summary>

Click the settings gear icon (bottom-right corner of the client) to configure:

- **Queue Automation** — Auto Accept, Auto Matchmaking, delays, lobby conditions
- **Post-Game** — Auto Honor, Auto Play Again, play-again delay
- **Lobby** — Instant Ranked Lobby toggle
- **UI** — Hide Distracting Elements toggle
- **Debug** — Debug Logging toggle

</details>

---

## 🔄 Rune Plugin

> Automatically fetches and applies optimal runes and item sets during champion select.

- 🎯 Fetches from **U.GG** or **Lolalytics** (configurable)
- 📦 Auto-creates item sets (most popular, highest winrate, situational)
- 🗺️ Role-specific configurations with automatic position detection
- ⚔️ Arena mode support
- ⚙️ Settings in client settings panel

<details>
<summary><b>📖 Usage</b></summary>

1. Enter champion select and pick your champion
2. Runes are auto-applied based on position + champion + latest patch
3. Item sets are created with popular/winrate builds
4. Configure provider and item sets in **Settings → Rune Plugin**

</details>

---

## 🎭 Icon Swapper

> Change your summoner icon to any icon from Community Dragon or upload your own.

- 🌐 Browse all League icons from Community Dragon API
- 📂 Upload custom icons (local file or URL)
- 🔍 Search icons by ID
- 💾 Persistent via DataStore
- ↩️ One-click revert to default

<details>
<summary><b>📖 Usage</b></summary>

1. Press `Ctrl+K` → select **Change Summoner Icon**
2. Browse or search League icons, or switch to Custom Icons tab
3. Upload local files or paste image URLs
4. Click any icon to apply

</details>

---

## 📊 Profile Win/Loss

> Win/loss statistics displayed directly on summoner profiles.

- 📈 Win rate, W/L count, and KDA stats
- 🔍 Filter by queue type (Ranked, Normal, ARAM, Swiftplay)
- 🗓️ Season 16 filter
- ⚙️ Configurable game count (1–200)

<details>
<summary><b>📖 Usage</b></summary>

1. Open any summoner profile — stats appear automatically
2. Configure in **Settings → Profile Win/Loss**:
   - Games to analyze, Queue Type, Season filter, KDA display

</details>

---

## 🚫 Champion Dismisser

> Blacklist champions to prevent yourself from picking them.

- 🚫 Greyed-out & unclickable in champion select
- 🔍 Searchable configuration modal
- 💾 Persistent blacklist via DataStore
- 🗑️ Clear All button

<details>
<summary><b>📖 Usage</b></summary>

1. Press `Ctrl+K` → select **Configure Blacklist**
2. Search and click champions to toggle blacklist
3. Blacklisted champions appear greyed out in champ select

</details>

---

## ⚖️ Mass Report

> Batch reporting from match history with whitelist protection.

- 🎯 Report all, enemy-only, or ally-only
- ⭐ Whitelist system to protect players
- 📝 Toast notifications for each report
- ⚙️ Settings in client settings panel

<details>
<summary><b>📖 Usage</b></summary>

1. Open a match in history → enter Game ID
2. Select target (All / Enemy / Ally)
3. Click **Report**

</details>

---

## 🏆 Force Badge

> Shows the Game Pass rewards badge on all champions and skins.

- ✨ Badge on all champions in Collection and Champion Select
- 🎨 Reward flag on owned skins
- Zero configuration — works automatically

---

## 🤖 ARAM Bot Enabler

> Add bots to ARAM custom games. *(May not be working)*

- Add bots to either team
- Choose champion and difficulty (Intro / Beginner / Intermediate)

---

## ⚡ Instant Ranked Lobby

> Standalone version — instantly creates a ranked Solo/Duo lobby when pressing Play.

> **Note:** This feature is already included in [SoloQ Machine](#-soloq-machine). Use this only if you want the lobby shortcut without the full suite.

---

## 🚀 Installation

```
📂 Pengu Loader/
└── 📂 plugins/
    ├── 📄 SoloQMachine.js
    ├── 📄 RunePlugin.js
    ├── 📄 IconSwapper.js
    ├── 📄 ProfileWinLose.js
    ├── 📄 ChampionDismisser.js
    ├── 📄 MassReport.js
    ├── 📄 ForceBadge.js
    └── 📄 AramBotEnabler.js
```

1. Install [Pengu Loader](https://github.com/PenguLoader/PenguLoader)
2. Copy desired plugin files to your plugins directory
3. Restart the League client

---

## 🐛 Troubleshooting

1. Ensure Pengu Loader is up to date
2. Restart the League client
3. Enable **Debug Logging** in plugin settings for console output
4. Open DevTools with `Ctrl + Shift + I` to view logs

**Report issues:** [GitHub Issues](https://github.com/Yimikami/pengu-plugins/issues) · [hi@yimikami.me](mailto:hi@yimikami.me)

Include: plugin name, version, steps to reproduce, expected vs actual behavior, and console logs.

---

<div align="center">

Made with ❤️ for the League community

[Report Bug](https://github.com/Yimikami/pengu-plugins/issues/new?labels=bug&template=bug_report.md) · [Request Feature](https://github.com/Yimikami/pengu-plugins/issues/new?labels=enhancement&template=feature_request.md)

</div>
