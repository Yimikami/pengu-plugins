/**
 * @name         DodgeGame
 * @author       Yimikami
 * @description  In-client 3D skillshot dodge mini-game. Pick a champion, dodge iconic skillshots, survive the waves.
 * @link         https://github.com/Yimikami/pengu-plugins/
 * @version      0.1.0
 */

import "./styles.css";
import { DodgeGame } from "./src/game";

let instance = null;

function boot() {
  if (instance) return instance;
  instance = new DodgeGame();
  return instance;
}

function registerCommand() {
  const tryReg = () => {
    if (!window.CommandBar?.addAction) return false;
    window.CommandBar.addAction({
      name: "Launch Dodge Game",
      group: "Dodge Game",
      perform: () => boot().openMenu(),
    });
    return true;
  };
  if (!tryReg()) {
    const iv = setInterval(() => {
      if (tryReg()) clearInterval(iv);
    }, 500);
  }
}

// Pengu Loader entry point (called after window load).
export function load() {
  registerCommand();
}
