import { assetUrl } from '../data/config.js';
import { chatBubblePath, BUBBLE_MAP } from '../data/sprites.js';

export class ChatBubble {
  constructor(bus) {
    this.bus = bus;
    this.el = null;
    this._timer = null;
    this._archetype = null;
  }

  init(archetype, parentEl) {
    this._archetype = archetype;

    this.el = document.createElement('div');
    this.el.className = 'chat-bubble';
    // Bubble image as background, text overlaid inside
    this.el.innerHTML = `
      <div class="chat-bubble-inner">
        <img class="chat-bubble-img" src="" alt="" />
        <span class="chat-bubble-text"></span>
      </div>
    `;
    this.el.style.display = 'none';
    parentEl.appendChild(this.el);
  }

  /**
   * Show a chat bubble with optional text inside.
   * @param {string} mood - key from BUBBLE_MAP (happy, sad, excited, food, etc.)
   * @param {string} [text] - optional text to display inside the bubble
   * @param {number} [duration=3000] - ms to show
   */
  show(mood, text, duration = 3000) {
    if (!this.el || !this._archetype) return;

    if (this._timer) {
      clearTimeout(this._timer);
    }

    const bubbleName = BUBBLE_MAP[mood] || BUBBLE_MAP.normal;
    const img = this.el.querySelector('.chat-bubble-img');
    const textEl = this.el.querySelector('.chat-bubble-text');

    img.src = assetUrl(chatBubblePath(this._archetype, bubbleName));

    if (text) {
      textEl.textContent = text;
      textEl.style.display = '';
    } else {
      textEl.style.display = 'none';
    }

    this.el.style.display = '';
    this.el.classList.remove('chat-bubble-hide');
    this.el.classList.add('chat-bubble-show');

    this._timer = setTimeout(() => this.hide(), duration);
  }

  hide() {
    if (!this.el) return;
    this.el.classList.remove('chat-bubble-show');
    this.el.classList.add('chat-bubble-hide');
    setTimeout(() => {
      if (this.el) this.el.style.display = 'none';
    }, 300);
  }

  destroy() {
    if (this._timer) clearTimeout(this._timer);
    if (this.el) this.el.remove();
    this.el = null;
  }
}
