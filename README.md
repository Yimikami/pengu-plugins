# Pengu Loader Plugins 🐧

[![Pengu Loader](https://img.shields.io/badge/Pengu%20Loader-Compatible-blue)](https://github.com/PenguLoader/PenguLoader)
[![League of Legends](https://img.shields.io/badge/League%20of%20Legends-Plugins-red)](https://www.leagueoflegends.com/)

> A curated collection of powerful plugins to enhance your League of Legends experience! 🎮✨

## 📚 Table of Contents

- [🔌 Available Plugins](#-available-plugins)
- [⚡ Quick Installation](#-quick-installation)
- [🆘 Support](#-support)

## 🔌 Available Plugins

### 🔄 Rune Plugin (v0.0.4)

> Automatically fetches and applies optimal runes and item sets from U.GG or Lolalytics during champion select!

**Key Features:**

- 🔄 Auto-fetches optimal runes from U.GG or Lolalytics

- 📦 Auto-creates optimal item sets from Lolalytics
- 🔄 Configurable rune provider (U.GG/Lolalytics)
- ⚙️ Toggle item sets feature on/off
- 🎯 Role-specific rune and item configurations
- 📊 Uses latest patch data automatically
- 📝 If no position provided, the plugin will analyze your champion pick and find most popular position for the champion and apply runes accordingly
- ⚔️ Supports Arena mode

<details>
<summary>📖 Usage Guide</summary>

1. Enter champion select
2. Select your champion
3. Runes will automatically be applied based on:
   - Your assigned position
   - Champion pick
   - Latest data from your chosen provider
4. Item sets will be created with:
   - Most popular core items
   - Most popular full build
   - Highest winrate core items
   - Highest winrate full build
   - Situational items
5. Configure your preferences in plugin settings:
   - Open client settings
   - Navigate to the Rune Plugin section
   - Select either U.GG or Lolalytics as your provider
   - Enable or disable automatic item sets
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

### ⚡ Instant Ranked Lobby (v0.0.1)

> Quick access to ranked games!

**Feature:**

- 🚀 Instantly creates solo/duo ranked lobby when pressing play button

### 🎭 Icon Swapper (v0.0.2)

> Change your summoner icon to any available icon from Community Dragon!

**Key Features:**

- 🎯 Fetches all available summoner icons from Community Dragon API
- 🔄 Changes icons in hover cards, profiles, and party elements
- 💾 Saves selected icon to DataStore for persistence
- ↩️ Revert button to restore original icon
- ⌨️ Command Bar integration for quick access
- 📂 Upload custom icons for personal use

<details>
<summary>📖 Usage Guide</summary>

1. Use Command Bar (Ctrl+K) and select Icon Swapper from the list
2. Select the icon you want to use
3. Upload custom icons for personal use (Optional)
4. Enable debug mode in plugin settings for detailed logging

</details>

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
       ├── 📄 RunePlugin.js
       └── 📄 IconSwapper.js
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
