// ---------------------------------------------------------------------------
// Small stateless helpers shared across the plugin
// ---------------------------------------------------------------------------
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function weightedPick(arr, weightFn) {
  const weights = arr.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

// Segment (from P1 to P2, with `segR` radius) vs circle (centre (cx,cz), radius cR) in 2D.
// Used for linear skillshot collision on the X-Z plane.
export function segmentCircle2D(x1, z1, x2, z2, segR, cx, cz, cR) {
  const dx = x2 - x1, dz = z2 - z1;
  const len2 = dx * dx + dz * dz || 1;
  let t = ((cx - x1) * dx + (cz - z1) * dz) / len2;
  t = clamp(t, 0, 1);
  const px = x1 + t * dx;
  const pz = z1 + t * dz;
  return Math.hypot(cx - px, cz - pz) <= segR + cR;
}

// Picks an AnimationClip by trying each regex/string pattern in priority order,
// falling back to the first clip if none match.
export function pickClip(clips, patterns) {
  for (const p of patterns) {
    const re = p instanceof RegExp ? p : new RegExp(p, "i");
    const m = clips.find((c) => re.test(c.name));
    if (m) return m;
  }
  return clips[0] || null;
}

// Recursively dispose a Three.js object (geometry, materials, textures).
export function disposeObject3D(obj) {
  if (!obj) return;
  obj.traverse?.((o) => {
    if (o.geometry) o.geometry.dispose?.();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        for (const key of ["map", "normalMap", "emissiveMap", "roughnessMap", "metalnessMap"]) {
          if (m[key]) m[key].dispose?.();
        }
        m.dispose?.();
      });
    }
  });
}
