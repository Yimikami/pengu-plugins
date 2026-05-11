/**
 * @name         PenguFamily
 * @author       Yimikami
 * @description  Tamagotchi-style companion that lives in your League Client. Hatch, raise, and evolve your own Pengu!
 * @link         https://github.com/Yimikami/pengu-plugins/
 * @version      0.1.0
 */

import './styles.css';
import { PenguFamilyApp } from './src/core/PenguFamily.js';

let app = null;
let _socket = null;
let _rcp = null;

export function init(context) {
  _socket = context?.socket || null;
  _rcp = context?.rcp || null;
  console.log('[PenguFamily] init — socket:', !!_socket, 'rcp:', !!_rcp);
}

export function load() {
  console.log('[PenguFamily] load — DOM ready');

  app = new PenguFamilyApp();

  // Register CommandBar actions
  registerCommands();

  // Start the app
  app.init(_socket, _rcp).catch(e => {
    console.error('[PenguFamily] Failed to initialize:', e);
  });
}

function registerCommands() {
  const tryReg = () => {
    if (!window.CommandBar?.addAction) return false;

    window.CommandBar.addAction({
      name: 'Pengu Family — Open Hub',
      group: 'Pengu Family',
      perform: () => {
        app?.hubModal?.toggle();
      },
    });

    return true;
  };

  if (!tryReg()) {
    const iv = setInterval(() => {
      if (tryReg()) clearInterval(iv);
    }, 500);
  }
}
