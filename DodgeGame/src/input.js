// ---------------------------------------------------------------------------
// Input: right-click / left-click to move (LoL-native — no WASD or arrow
// keys), and summoner-spell keybinds (Flash / Ghost) with an `onSpellKey`
// callback fired on keydown.
//
// Events are attached to `document` in the capture phase so nothing can
// intercept them, and the handlers only react when the event target is
// inside the game overlay.
// ---------------------------------------------------------------------------
export class Input {
  constructor({ THREE, canvas, camera, overlay, keybinds, onSpellKey }) {
    this.THREE = THREE;
    this.canvas = canvas;
    this.camera = camera;
    this.overlay = overlay || canvas;
    this.keys = new Set();
    this.moveTarget = null;
    this.cursorWorld = null; // last valid ground-cursor position (for Flash aim)
    this.keybinds = keybinds || { flash: "d", ghost: "f" };
    this.onSpellKey = onSpellKey;

    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ndc = new THREE.Vector2();
    this._ray = new THREE.Raycaster();
    this._tmp = new THREE.Vector3();
  }

  _isInOverlay(target) {
    return !this.overlay || this.overlay.contains(target);
  }

  setKeybinds(keybinds) {
    this.keybinds = { ...this.keybinds, ...keybinds };
  }

  attach() {
    this._onContext = (e) => {
      if (!this._isInOverlay(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const p = this.raycastGround(e.clientX, e.clientY);
      if (p) this.moveTarget = { x: p.x, z: p.z };
    };
    this._onMouseDown = (e) => {
      if (!this._isInOverlay(e.target)) return;
      if (e.button === 0 || e.button === 2) {
        const p = this.raycastGround(e.clientX, e.clientY);
        if (p) this.moveTarget = { x: p.x, z: p.z };
      }
    };
    this._onMouseMove = (e) => {
      if (!this._isInOverlay(e.target)) return;
      const p = this.raycastGround(e.clientX, e.clientY);
      if (p) this.cursorWorld = { x: p.x, z: p.z };
    };
    this._onKeyDown = (e) => {
      // Skip if the user is typing in an input/textarea.
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      // Summoner spell keybinds (fire once per press, no autorepeat).
      let consumedBySpell = false;
      if (this.onSpellKey && !e.repeat) {
        for (const [spellId, bind] of Object.entries(this.keybinds)) {
          if (bind === k) {
            e.preventDefault();
            this.onSpellKey(spellId);
            consumedBySpell = true;
            break;
          }
        }
      }
      // LoL-native: pressing S cancels the current move order (stop in place).
      if (!consumedBySpell && k === "s") {
        e.preventDefault();
        this.moveTarget = null;
      }
    };
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());

    // Capture phase so nothing upstream can swallow the events.
    document.addEventListener("contextmenu", this._onContext, true);
    document.addEventListener("mousedown", this._onMouseDown, true);
    document.addEventListener("mousemove", this._onMouseMove, true);
    window.addEventListener("keydown", this._onKeyDown, true);
    window.addEventListener("keyup", this._onKeyUp, true);
  }

  detach() {
    document.removeEventListener("contextmenu", this._onContext, true);
    document.removeEventListener("mousedown", this._onMouseDown, true);
    document.removeEventListener("mousemove", this._onMouseMove, true);
    window.removeEventListener("keydown", this._onKeyDown, true);
    window.removeEventListener("keyup", this._onKeyUp, true);
    this.keys.clear();
    this.moveTarget = null;
    this.cursorWorld = null;
  }

  raycastGround(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this._ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this._ray.setFromCamera(this._ndc, this.camera);
    const hit = this._ray.ray.intersectPlane(this._plane, this._tmp);
    return hit ? this._tmp.clone() : null;
  }
}
