import { OVERLAY_Z } from '../data/config.js';

export class OverlayUI {
  constructor(bus) {
    this.bus = bus;
    this.el = null;
    this.container = null;
  }

  init() {
    this.el = document.createElement('div');
    this.el.id = 'pengu-family-overlay';
    this.el.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: ${OVERLAY_Z};
      pointer-events: none;
      overflow: hidden;
    `;

    this.container = document.createElement('div');
    this.container.id = 'pengu-family-container';
    this.el.appendChild(this.container);

    document.body.appendChild(this.el);
  }

  getContainer() {
    return this.container;
  }

  show() {
    if (this.el) this.el.style.display = '';
  }

  hide() {
    if (this.el) this.el.style.display = 'none';
  }

  destroy() {
    if (this.el) this.el.remove();
  }
}
