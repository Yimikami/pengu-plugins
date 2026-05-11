import { assetUrl, PENGU_SIZE } from '../data/config.js';
import { penguSpritePath, ANIMATIONS } from '../data/sprites.js';

// Default facing direction per archetype (the direction the sprite naturally looks at)
const SPRITE_FACES = {
  windblade: 'left',
  shadow: 'left',
  starlight: 'left',
  chaos: 'left',
  royal: 'right',
};

export class SpriteRenderer {
  constructor(bus) {
    this.bus = bus;
    this.archetype = null;
    this.stage = 'baby';
    this.el = null;
    this.currentAnim = null;
    this._frameIdx = 0;
    this._animTimer = null;
    this._cssAnimClass = '';
    this._preloaded = {};
  }

  init(archetype, stage, container) {
    this.archetype = archetype;
    this.stage = stage || 'baby';

    this.el = document.createElement('div');
    this.el.id = 'pengu-character';
    this.el.className = 'pengu-sprite';

    this._img = document.createElement('img');
    this._img.className = 'pengu-sprite-img';
    this._img.draggable = false;
    this._img.alt = 'Pengu';
    this.el.appendChild(this._img);

    container.appendChild(this.el);

    this._preloadAll();
    this.play('idle');
  }

  play(animName) {
    if (this.currentAnim === animName) return;
    this.currentAnim = animName;
    this._frameIdx = 0;

    if (this._animTimer) {
      clearInterval(this._animTimer);
      this._animTimer = null;
    }

    // Remove old CSS animation classes
    this.el.classList.remove('anim-idle-bob', 'anim-walk-bob', 'anim-celebrate-bounce', 'anim-sleep-breathe');

    const anim = ANIMATIONS[animName];
    if (!anim) {
      this._setFrame('idle');
      return;
    }

    // Set first frame immediately
    this._setFrame(anim.frames[0]);

    // Add CSS motion class
    const cssClass = this._getCssClass(animName);
    if (cssClass) this.el.classList.add(cssClass);

    // Cycle frames if multiple
    if (anim.frames.length > 1) {
      const frameTime = anim.duration / anim.frames.length;
      this._animTimer = setInterval(() => {
        this._frameIdx++;
        if (this._frameIdx >= anim.frames.length) {
          if (anim.loop) {
            this._frameIdx = 0;
          } else {
            clearInterval(this._animTimer);
            this._animTimer = null;
            this.bus.emit('sprite:animend', { anim: animName });
            return;
          }
        }
        this._setFrame(anim.frames[this._frameIdx]);
      }, frameTime);
    } else if (!anim.loop) {
      // Single frame, non-looping — fire end after duration
      setTimeout(() => {
        this.bus.emit('sprite:animend', { anim: animName });
      }, anim.duration);
    }
  }

  setPosition(x, y) {
    if (!this.el) return;
    this.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  setDirection(dir) {
    if (!this._img) return;
    // Flip only when movement direction differs from sprite's natural facing
    const natural = SPRITE_FACES[this.archetype] || 'right';
    this._img.classList.toggle('pengu-flipped', dir !== natural);
  }

  show() { if (this.el) this.el.style.display = ''; }
  hide() { if (this.el) this.el.style.display = 'none'; }

  destroy() {
    if (this._animTimer) clearInterval(this._animTimer);
    this._animTimer = null;
    if (this.el) this.el.remove();
    this.el = null;
    this._img = null;
    this.currentAnim = null;
  }

  _setFrame(frameName) {
    const src = assetUrl(penguSpritePath(this.archetype, this.stage, frameName));
    if (this._img.src !== src) {
      this._img.src = src;
    }
  }

  _getCssClass(animName) {
    switch (animName) {
      case 'idle': return 'anim-idle-bob';
      case 'walk': return 'anim-walk-bob';
      case 'celebrate':
      case 'pet':
      case 'eat': return 'anim-celebrate-bounce';
      case 'sleep': return 'anim-sleep-breathe';
      default: return '';
    }
  }

  _preloadAll() {
    const frames = ['idle', 'blink', 'walk', 'alert', 'ready', 'celebrate', 'attack', 'sleep'];
    for (const frame of frames) {
      const img = new Image();
      img.src = assetUrl(penguSpritePath(this.archetype, this.stage, frame));
      this._preloaded[frame] = img;
    }
  }
}
