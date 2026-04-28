// ---------------------------------------------------------------------------
// Arena construction: renderer, scene, camera, lights, Summoner's Rift themed
// ground texture, player model loading (cloned from cache, scaled to fixed
// height), and animation clip selection.
// ---------------------------------------------------------------------------
import { WORLD } from "./constants";
import { pickClip, disposeObject3D } from "./utils";
import groundUrl from "../assets/arena_ground.png";

// Fallback procedural texture in case the PNG asset fails to resolve.
function buildFallbackGroundTexture(THREE) {
  const size = 512;
  const cv = document.createElement("canvas");
  cv.width = size; cv.height = size;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.7);
  g.addColorStop(0, "#1e3022");
  g.addColorStop(1, "#08180d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function loadGroundTexture(THREE) {
  // TextureLoader resolves through whatever URL Pengu's module system gave us.
  const tex = new THREE.TextureLoader().load(
    groundUrl,
    undefined,
    undefined,
    () => { /* swallow; fallback below is already attached */ }
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  // Gentle tiling so no obvious "center" and the grain feels continuous.
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.4, 1.4);
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// ---------------------------------------------------------------------------
// Main scene builder
// ---------------------------------------------------------------------------
export function buildScene({ THREE, SkeletonUtils, canvas, modelData, win }) {
  const _win = win || window;
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false,
  });
  renderer.setPixelRatio(_win.devicePixelRatio || 1);
  renderer.setSize(_win.innerWidth, _win.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Soft forest-daylight ambience to match the painted SR ground.
  scene.background = new THREE.Color(0x0f1d16);
  scene.fog = new THREE.Fog(0x0f1d16, 30, 72);

  const camera = new THREE.PerspectiveCamera(45, _win.innerWidth / _win.innerHeight, 0.1, 200);
  camera.position.set(0, 18, 14);
  camera.lookAt(0, 0, 0);

  // Lights — softer, warmer, a little more filmic than before.
  scene.add(new THREE.HemisphereLight(0xcfe6c9, 0x2a3528, 0.65));
  const sun = new THREE.DirectionalLight(0xfde3b4, 1.05);
  sun.position.set(10, 22, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3; // softer PCF penumbra
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x3f6b8a, 0.35);
  rim.position.set(-12, 12, -10);
  scene.add(rim);

  // Ground — Summoner's Rift themed, imagegen-generated top-down texture.
  const groundTex = loadGroundTexture(THREE);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.arenaSize, WORLD.arenaSize, 1, 1),
    groundMat
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Arena rim — a pair of thin LoL-gold circles with a subtle glow ring.
  const rimInner = new THREE.Mesh(
    new THREE.RingGeometry(WORLD.arenaBound, WORLD.arenaBound + 0.12, 96),
    new THREE.MeshBasicMaterial({
      color: 0xc8aa6e, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  rimInner.rotation.x = -Math.PI / 2;
  rimInner.position.y = 0.02;
  scene.add(rimInner);

  const rimGlow = new THREE.Mesh(
    new THREE.RingGeometry(WORLD.arenaBound + 0.12, WORLD.arenaBound + 0.9, 96),
    new THREE.MeshBasicMaterial({
      color: 0xc8aa6e, transparent: true, opacity: 0.14,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  rimGlow.rotation.x = -Math.PI / 2;
  rimGlow.position.y = 0.019;
  scene.add(rimGlow);

  // Player model — SkeletonUtils.clone properly clones the skeleton for
  // skinned meshes so each game instance has its own bone hierarchy.
  const playerGroup = new THREE.Group();
  const modelClone = SkeletonUtils
    ? SkeletonUtils.clone(modelData.scene)
    : modelData.scene.clone(true);
  modelClone.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false; // avoid culling when bbox is bogus
      if (Array.isArray(o.material)) o.material = o.material.map((m) => m.clone());
      else if (o.material) o.material = o.material.clone();
      if (o.material && o.material.side !== THREE.FrontSide) {
        o.material.side = THREE.FrontSide;
      }
    }
  });

  // Normalize height. LoL GLBs typically come out in game units (~150-200 tall),
  // but we guard against a collapsed / degenerate bbox just in case.
  modelClone.updateMatrixWorld(true);
  const b0 = new THREE.Box3().setFromObject(modelClone);
  const size0 = new THREE.Vector3();
  b0.getSize(size0);
  let rawH = size0.y;
  if (!isFinite(rawH) || rawH <= 0.01) rawH = Math.max(size0.x, size0.z);
  if (!isFinite(rawH) || rawH <= 0.01) rawH = 150; // fallback: typical LoL scale
  let scale = WORLD.playerHeight / rawH;
  if (!isFinite(scale) || scale <= 0) scale = 0.012;
  modelClone.scale.setScalar(scale);
  modelClone.updateMatrixWorld(true);
  const b1 = new THREE.Box3().setFromObject(modelClone);
  const dy = isFinite(b1.min.y) ? -b1.min.y : 0;
  modelClone.position.y = dy;
  playerGroup.add(modelClone);
  scene.add(playerGroup);

  // Animation mixer + prioritized clip picks.
  // idle_base first: many LoL models ship it as the canonical combat idle.
  const mixer = new THREE.AnimationMixer(modelClone);
  const clips = modelData.animations || [];
  const clipRefs = {
    idle:  pickClip(clips, [/^idle_base$/i, /^idle1$/i, /^idle$/i, /idle_base/i, /^idle2$/i, /idle/i]),
    run:   pickClip(clips, [/^run$/i, /run/i, /^walk$/i]),
    death: pickClip(clips, [/^death$/i, /death/i]),
    spell: pickClip(clips, [/^spell1$/i, /spell1/i, /attack1/i]),
  };

  return {
    renderer, scene, camera, mixer, clipRefs, playerGroup, modelClone, ground: ground,
    dispose() {
      disposeObject3D(playerGroup);
      scene.remove(playerGroup);
      disposeObject3D(ground);
      scene.remove(ground);
      disposeObject3D(rimInner);
      scene.remove(rimInner);
      disposeObject3D(rimGlow);
      scene.remove(rimGlow);
      groundTex.dispose?.();
      renderer.dispose();
    },
  };
}

// Crossfade between clip actions on the shared mixer.
export function setAction({ THREE, mixer, clipRefs, state, name, fadeTime = 0.2 }) {
  const clip = clipRefs[name];
  if (!clip || !mixer) return state.current;
  const next = mixer.clipAction(clip);
  if (state.current === next) return next;
  next.reset();
  next.setLoop(name === "death" ? THREE.LoopOnce : THREE.LoopRepeat);
  next.clampWhenFinished = name === "death";
  next.enabled = true;
  if (state.current) state.current.crossFadeTo(next, fadeTime, false);
  next.play();
  state.current = next;
  return next;
}
