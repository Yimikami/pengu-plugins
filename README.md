# Pengu Loader Plugins 🐧

[![Pengu Loader](https://img.shields.io/badge/Pengu%20Loader-Compatible-blue)](https://github.com/PenguLoader/PenguLoader)
[![League of Legends](https://img.shields.io/badge/League%20of%20Legends-Plugins-red)](https://www.leagueoflegends.com/)

> A curated collection of powerful plugins to enhance your League of Legends experience! 🎮✨

## 📚 Table of Contents

- [🔌 Available Plugins](#-available-plugins)
- [⚡ Quick Installation](#-quick-installation)
- [🆘 Support](#-support)

## 🔌 Available Plugins

### 🔄 Rune Plugin (v0.0.1)

> Automatically fetches and applies optimal runes from U.GG during champion select!

**Key Features:**

- 🔄 Auto-fetches optimal runes from U.GG
- 🎯 Role-specific rune configurations

<details>
<summary>📖 Usage Guide</summary>

1. Enter champion select
2. Select your champion
3. Runes will automatically be applied based on:
   - Your assigned position
   - Champion pick
   - Latest U.GG data
   </details>

### 🤖 ARAM Bot Enabler (v0.0.1)

> Add bots to your ARAM custom games!

**Key Features:**

- ✅ Add bots to either team in ARAM custom games
- ✅ Select specific champions for bots or choose random
- ✅ Choose bot difficulty (Intro, Beginner, Intermediate)

<details>
<summary>📖 Usage Guide</summary>

1. Create an ARAM custom game
2. Look for the "Add Bot" buttons that are now enabled
3. (Optional) Select a specific champion and difficulty from the dropdowns
4. Click "Add Bot" to add the bot to your team
</details>

### 📊 Profile Win/Loss Display (v0.0.3)

> Get detailed statistics right on the profile page!

**Key Features:**

- 📈 Comprehensive win/loss statistics
- 🔍 Filter by queue type (All, Normal, Ranked, ARAM)
- 🗓️ Season 15 specific statistics
- ⚙️ Customizable game count (1-200)

<details>
<summary>📖 Usage Guide</summary>

1. Open any summoner profile
2. View statistics automatically below summoner name
3. Customize via settings:
   - Games to analyze (1-200)
   - Queue Type filter
   - Season 15 filter
   </details>

### ⚖️ Mass Report Plugin (v0.0.3)

> Efficient reporting system with whitelist protection

**Key Features:**

- 🎯 Mass reporting from match history
- 👥 Team-specific reporting options
- ⭐ Whitelist system for player protection
- 📝 Detailed feedback on report status

<details>
<summary>📖 Usage Guide</summary>

1. Open any match in history
2. Enter the Game ID
3. Click "Report All"
4. Monitor toast notifications
</details>

### 🎲 Randomize Plugin (OUTDATED)

> Add excitement to your games with random selections!

**Key Features:**

- 🎭 Random champion selection
- 🎯 Random runes configuration
- ⚔️ Random summoner spells
- 🛠️ Random item builds
- 📚 Random skill order

<details>
<summary>📖 Usage Guide</summary>

1. Enter champion select
2. Find the "LET THE FUN BEGIN 🤡" button
3. Click and enjoy the randomness!
</details>

### ⚡ Instant Ranked Lobby (v0.0.1)

> Quick access to ranked games!

**Feature:**

- 🚀 Instantly creates solo/duo ranked lobby when pressing play button

## ⚡ Quick Installation

1. Install [Pengu Loader](https://github.com/PenguLoader/PenguLoader)
2. Copy plugins to your Pengu Loader directory:
   ```
   📂 Pengu Loader
   └── 📂 plugins
       ├── 📄 AramBotEnabler.js
       ├── 📄 ProfileWinLose.js
       ├── 📄 MassReport.js
       ├── 📄 InstantRankedLobby.js
       ├── 📄 RandomizePlugin.js
       └── 📄 RunePlugin.js
   ```
3. Restart your League client

## 🆘 Support

**Having issues?**

1. ✅ Verify your Pengu Loader is up to date
2. 🔄 Try restarting the League client
3. 🐛 Report issues:
   - Create a [GitHub Issue](https://github.com/Yimikami/pengu-plugins/issues) (preferred)
   - Email: [hi@yimikami.me](mailto:hi@yimikami.me)

> For bug reports, please include:
>
> - Plugin name and version
> - Steps to reproduce the issue
> - Expected vs actual behavior
> - Any error messages you received
> - Console logs (see below)

### 🔍 Getting Console Logs

Most plugins include a debug mode that can help diagnose issues:

1. Enable debug mode in the plugin settings:
   ```js
   CONFIG = {
    debug: true; // Change this to true
   };
   ```
2. Open Developer Tools in League Client:

   - Press `Ctrl + Shift + I`

3. Reproduce the issue
4. Copy all relevant console logs
5. Include these logs in your bug report

---

<div align="center">

Made with ❤️ for the League community

[Report Bug](https://github.com/Yimikami/pengu-plugins/issues/new?labels=bug&template=bug_report.md) · [Request Feature](https://github.com/Yimikami/pengu-plugins/issues/new?labels=enhancement&template=feature_request.md)

</div>
