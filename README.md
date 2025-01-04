# Pengu Loader Plugins

A collection of Pengu Loader plugins to enhance your League of Legends experience.

## Menu

- [Plugins](#plugins)
  - [ARAM Bot Enabler](#aram-bot-enabler-v001)
  - [Profile Win/Loss Display Plugin](#profile-winloss-display-plugin-v001)
  - [Mass Report Plugin](#mass-report-plugin-v001)
  - [Randomize Plugin](#randomize-plugin-v001)
- [Installation](#installation)
- [Support](#support)

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

#### Usage

1. Open any summoner profile in the League Client
2. The win/loss statistics will appear automatically below the summoner name
3. Use the settings panel to customize the display

### Mass Report Plugin (v0.0.1)

A plugin that allows mass reporting from match history with whitelist functionality to exclude specific players.

#### Features

- **Mass Reporting**: Report multiple players from a match using a single Game ID
- **Whitelist System**: Maintain a list of players to exclude from reporting
- **User-Friendly Interface**: Simple input field for Game ID and a clear "Report All" button
- **Detailed Feedback**: Shows success/failure status for each report attempt

#### Settings

You can manage the plugin settings through the League Client settings panel:

1. Open League Client settings
2. Find the "Mass Report Settings" section
3. Manage whitelisted players:
   - Add players to whitelist: Enter summoner name and click "Add"
   - Remove players: Click "Remove" next to any whitelisted player
   - View all whitelisted players

#### Usage

1. Open any match in your match history
2. Enter the Game ID in the input field
3. Click "Report All" to process reports
4. Monitor the toast notifications for report status

#### Notes

- The plugin automatically skips reporting yourself
- Whitelisted players are automatically excluded from reports
- Reports are processed with a delay to prevent rate limiting

### Randomize Plugin (v0.0.1)

A plugin that adds a "LET THE FUN BEGIN 🤡" button to champion select, which randomly selects a champion, runes, summoner spells, and creates a custom item set.

#### Features:

- **Random Champion Selection**: Intelligently selects a random champion from your available pool
- **Random Runes**: Creates a random rune page for your champion
- **Random Summoner Spells**: Selects random summoner spells
- **Custom Item Sets**: Generates a random item build
- **Smart Selection**: Uses weighted randomization to avoid repeating recent picks

#### Usage:

1. Enter champion select
2. Look for the "LET THE FUN BEGIN 🤡" button in the bottom right
3. Click the button to:
   - Select a random champion
   - Set up random runes
   - Choose random summoner spells
   - Create a custom item set

## Installation

1. Install [Pengu Loader](https://github.com/PenguLoader/PenguLoader)
2. Place the plugin files in your Pengu Loader plugins folder:
   ```
   📂 Pengu Loader
   └── 📂 plugins
       ├── 📄 AramBotEnabler.js
       ├── 📄 ProfileWinLose.js
       ├── 📄 MassReport.js
       └── 📄 RandomizePlugin.js
   ```
3. Restart your League client

## Support

If you encounter any issues try the following:

1. Check if your Pengu Loader is up to date
2. Try restarting the League client

Also you can always contact me at [hi@yimikami.me](mailto:hi@yimikami.me).

Have fun!
