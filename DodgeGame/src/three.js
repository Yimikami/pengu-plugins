// ---------------------------------------------------------------------------
// Lazy Three.js loader. We use dynamic import() so the Three.js bundle is only
// fetched when the user actually enters the arena (not at plugin init time).
// Both imports are de-duplicated at the module level.
// ---------------------------------------------------------------------------
import { CONFIG, debug } from "./constants";

let _cached = null;
let _pending = null;

const SKELETON_UTILS_CDN =
  "https://esm.sh/three@0.169.0/examples/jsm/utils/SkeletonUtils.js";

export function getThree() {
  if (_cached) return Promise.resolve(_cached);
  if (_pending) return _pending;
  _pending = (async () => {
    debug("loading three.js from", CONFIG.CDN.three);
    const [THREE, gltfMod, skelMod] = await Promise.all([
      import(/* @vite-ignore */ CONFIG.CDN.three),
      import(/* @vite-ignore */ CONFIG.CDN.gltfLoader),
      import(/* @vite-ignore */ SKELETON_UTILS_CDN),
    ]);
    _cached = {
      THREE,
      GLTFLoader: gltfMod.GLTFLoader,
      SkeletonUtils: skelMod,
    };
    return _cached;
  })();
  return _pending;
}

// ---------------------------------------------------------------------------
// Model cache — one GLB per champion, reused across rematches and between
// player-controlled and caster-only usage.
// ---------------------------------------------------------------------------
const _modelCache = new Map();

export function getCachedModel(champId) {
  return _modelCache.get(champId);
}

export async function loadChampionModel(champ, onProgress) {
  if (_modelCache.has(champ.id)) return _modelCache.get(champ.id);
  const { THREE, GLTFLoader } = await getThree();
  const loader = new GLTFLoader();
  const url = `${CONFIG.CDN.modelBase}/${champ.alias}/${champ.id}000/model.glb`;
  const gltf = await new Promise((resolve, reject) => {
    loader.load(
      url,
      (g) => resolve(g),
      (xhr) => {
        if (xhr && xhr.lengthComputable && onProgress) {
          onProgress((xhr.loaded / xhr.total) * 100);
        }
      },
      (err) => reject(err)
    );
  });

  // Pre-compute a scale factor so casters render at a consistent height
  // without re-measuring on every spawn.
  let autoScale = 0.012;
  try {
    gltf.scene.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    let h = size.y;
    if (!isFinite(h) || h <= 0.01) h = Math.max(size.x, size.z);
    if (!isFinite(h) || h <= 0.01) h = 150;
    autoScale = 1.8 / h;
    if (!isFinite(autoScale) || autoScale <= 0) autoScale = 0.012;
  } catch { /* keep default */ }

  const data = {
    scene: gltf.scene,
    animations: gltf.animations,
    autoScale,
  };
  _modelCache.set(champ.id, data);
  return data;
}

// Sequentially download a list of champions in the background.
// onEach(champ, idx, total, ok) is fired after each attempt.
export async function preloadChampionModels(champions, onEach) {
  let idx = 0;
  for (const champ of champions) {
    idx += 1;
    try {
      await loadChampionModel(champ);
      onEach?.(champ, idx, champions.length, true);
    } catch (e) {
      console.warn("[DodgeGame] preload failed for", champ.alias, e);
      onEach?.(champ, idx, champions.length, false);
    }
  }
}
