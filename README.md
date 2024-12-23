# Pengu Loader Plugins

A collection of Pengu Loader plugins to enhance your League of Legends experience. (Currently only ARAM Bot Enabler and Profile Win/Loss Display)

## Plugins

### ARAM Bot Enabler (v0.0.1)

Enables the ability to add bots in ARAM custom games, a feature not normally available in the standard client.

#### Features:

- Add bots to either team in ARAM custom games
- Select specific champions for bots or choose random
- Choose bot difficulty (Intro, Beginner, Intermediate)

#### Usage:

1. Create an ARAM custom game
2. Look for the "Add Bot" buttons that are now enabled
3. (Optional) Select a specific champion and difficulty from the dropdowns
4. Click "Add Bot" to add the bot to your team

### Profile Win/Loss Display Plugin (v0.0.1)

A League of Legends plugin that shows summoner's win/loss statistics and win rate directly on their profile page.

#### Features

- **Win/Loss Statistics**: Displays wins, losses, and win rate percentage
- **Queue Filtering**: Filter statistics by different queue types:

  - All Queues
  - Normal (Quickplay)
  - Ranked (Solo/Duo)
  - Ranked (Flex)
  - Normal (Draft Pick)
  - ARAM

- **Customizable Game Count**: Choose how many recent games to analyze (1-200)

#### Settings

You can customize the plugin through the League Client settings panel:

1. Open League Client settings
2. Find the "Profile Win/Loss Display" section
3. Adjust these settings:
   - Games to analyze: Set the number of recent games to include (1-200)
   - Queue Type: Select which queue type to show statistics for

#### Installation

1. Install [Pengu Loader](https://github.com/PenguLoader/PenguLoader)
2. Place `ProfileWinLose.js` in your Pengu Loader plugins folder
3. Restart your League Client

#### Usage

1. Open any summoner profile in the League Client
2. The win/loss statistics will appear automatically below the summoner name
3. Use the settings panel to customize the display

## Installation

1. Install [Pengu Loader](https://github.com/PenguLoader/PenguLoader)
2. Place the plugin files in your Pengu Loader plugins folder:
   ```
   📂 Pengu Loader
   └── 📂 plugins
       ├── 📄 AramBotEnabler.js
       └── 📄 ProfileWinLose.js
   ```
3. Restart your League client

## Support

If you encounter any issues try the following:

1. Check if your Pengu Loader is up to date
2. Try restarting the League client

Also you can always contact me at [hi@yimikami.me](mailto:hi@yimikami.me).

Have fun!
