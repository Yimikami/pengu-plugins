// ---------------------------------------------------------------------------
// Projectile factories + per-frame update + collision.
//
// Shape of a projectile record returned by buildProjectile():
//   { type, skill, spawnTs, telegraphUntil, expired, countedDodge, meshes[],
//     + per-type fields (x1,z1,dirX,dirZ,currentDist,head for LINEAR/BOOMERANG;
//       cx,cz,radius,disc,ring,boom,activeUntil for AOE_CIRCLE;
//       ox,oz,dirX,dirZ,length,width,beam,telegraph,activeUntil for BEAM) }
// ---------------------------------------------------------------------------
import { WORLD } from "./constants";
import { rand, clamp, segmentCircle2D, dist2D } from "./utils";

// Public dispatcher ----------------------------------------------------------
export function buildProjectile({ THREE, scene, skill, player, spawnTs }) {
  const base = {
    skill, spawnTs,
    telegraphUntil: spawnTs + skill.telegraph,
    expired: false, countedDodge: false,
    meshes: [],
  };
  if (skill.type === "LINEAR" || skill.type === "BOOMERANG") {
    buildLinear({ THREE, scene, skill, player, base });
  } else if (skill.type === "AOE_CIRCLE") {
    buildAoe({ THREE, scene, skill, player, base });
  } else if (skill.type === "BEAM") {
    buildBeam({ THREE, scene, skill, player, base });
  }
  return base;
}

// LINEAR / BOOMERANG ---------------------------------------------------------
function buildLinear({ THREE, scene, skill, player, base }) {
  const p = player.group.position;

  // Edge spawn + aim at player (with jitter)
  const side = Math.floor(Math.random() * 4);
  const bound = WORLD.arenaBound + 2;
  let x1, z1;
  if (side === 0) { x1 = rand(-bound, bound); z1 = -bound; }
  else if (side === 1) { x1 = bound; z1 = rand(-bound, bound); }
  else if (side === 2) { x1 = rand(-bound, bound); z1 = bound; }
  else { x1 = -bound; z1 = rand(-bound, bound); }
  const tx = p.x + rand(-3, 3);
  const tz = p.z + rand(-3, 3);
  const dx = tx - x1, dz = tz - z1;
  const len = Math.hypot(dx, dz) || 1;
  const dirX = dx / len, dirZ = dz / len;

  const totalLen = skill.type === "BOOMERANG" ? skill.range : WORLD.arenaSize + 20;

  // Holder orients the ground telegraph along (dirX, dirZ).
  // rotation.y = atan2(-dirZ, dirX) makes the local +X axis match world (dirX, dirZ).
  const holder = new THREE.Object3D();
  holder.position.set(x1, 0, z1);
  holder.rotation.y = Math.atan2(-dirZ, dirX);
  scene.add(holder);

  // Outer telegraph (soft colored halo)
  const telOuter = new THREE.Mesh(
    new THREE.PlaneGeometry(totalLen, skill.width),
    new THREE.MeshBasicMaterial({
      color: skill.color, transparent: true, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  telOuter.rotation.x = -Math.PI / 2;
  telOuter.position.set(totalLen / 2, 0.04, 0);
  holder.add(telOuter);

  // Thin bright inner line (warning)
  const telInner = new THREE.Mesh(
    new THREE.PlaneGeometry(totalLen, Math.max(0.05, skill.width * 0.18)),
    new THREE.MeshBasicMaterial({
      color: 0xff3a3a, transparent: true, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  telInner.rotation.x = -Math.PI / 2;
  telInner.position.set(totalLen / 2, 0.05, 0);
  holder.add(telInner);

  // Projectile head (world-space — independent of holder orientation)
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.18, skill.width * 0.5), 16, 16),
    new THREE.MeshBasicMaterial({ color: skill.color, transparent: true, opacity: 0.95 })
  );
  head.add(new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.35, skill.width * 1.0), 16, 16),
    new THREE.MeshBasicMaterial({
      color: skill.color, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  ));
  head.add(new THREE.PointLight(new THREE.Color(skill.color), 1.6, 6));
  head.position.set(x1, WORLD.hitY, z1);
  head.visible = false;
  scene.add(head);

  Object.assign(base, {
    type: skill.type,
    x1, z1, dirX, dirZ,
    totalLen,
    currentDist: 0,
    returning: false,
    speed: skill.speed,
    width: skill.width,
    telegraph: telOuter,
    telegraphInner: telInner,
    holder,
    head,
  });
  base.meshes.push(holder, head);
  return base;
}

// AOE_CIRCLE -----------------------------------------------------------------
function buildAoe({ THREE, scene, skill, player, base }) {
  const W = WORLD.arenaBound;
  let cx, cz;
  if (skill.smart) {
    const p = player.group.position;
    cx = clamp(p.x + rand(-1.2, 1.2), -W, W);
    cz = clamp(p.z + rand(-1.2, 1.2), -W, W);
  } else {
    cx = rand(-W + skill.radius, W - skill.radius);
    cz = rand(-W + skill.radius, W - skill.radius);
  }

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(skill.radius, 48),
    new THREE.MeshBasicMaterial({
      color: skill.color, transparent: true, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(cx, 0.04, cz);
  scene.add(disc);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(skill.radius * 0.98, skill.radius * 1.02, 64),
    new THREE.MeshBasicMaterial({
      color: 0xff3a3a, transparent: true, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.06, cz);
  scene.add(ring);

  const boom = new THREE.Mesh(
    new THREE.SphereGeometry(skill.radius, 24, 24),
    new THREE.MeshBasicMaterial({
      color: skill.color, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  boom.position.set(cx, skill.radius * 0.45, cz);
  boom.visible = false;
  scene.add(boom);

  Object.assign(base, {
    type: "AOE_CIRCLE",
    cx, cz, radius: skill.radius,
    activeUntil: base.telegraphUntil + skill.activeTime,
    disc, ring, boom,
  });
  base.meshes.push(disc, ring, boom);
  return base;
}

// BEAM -----------------------------------------------------------------------
function buildBeam({ THREE, scene, skill, player, base }) {
  const p = player.group.position;

  // Spawn origin on a ring around the player
  const ang = rand(0, Math.PI * 2);
  const r = 12;
  const ox = p.x + Math.cos(ang) * r;
  const oz = p.z + Math.sin(ang) * r;

  // Aim at the player at cast time
  const dirX = p.x - ox;
  const dirZ = p.z - oz;
  const dLen = Math.hypot(dirX, dirZ) || 1;
  const dxN = dirX / dLen, dzN = dirZ / dLen;

  const length = Math.max(WORLD.arenaSize * 1.6, 30);

  const holder = new THREE.Object3D();
  holder.position.set(ox, 0, oz);
  holder.rotation.y = Math.atan2(-dzN, dxN);
  scene.add(holder);

  const telegraph = new THREE.Mesh(
    new THREE.PlaneGeometry(length, skill.width),
    new THREE.MeshBasicMaterial({
      color: skill.color, transparent: true, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  telegraph.rotation.x = -Math.PI / 2;
  telegraph.position.set(length / 2, 0.04, 0);
  holder.add(telegraph);

  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.6, skill.width),
    new THREE.MeshBasicMaterial({
      color: skill.color, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  beam.position.set(length / 2, 0.4, 0);
  beam.visible = false;
  holder.add(beam);

  Object.assign(base, {
    type: "BEAM",
    ox, oz, dirX: dxN, dirZ: dzN,
    length, width: skill.width,
    activeUntil: base.telegraphUntil + skill.activeTime,
    telegraph, beam, holder,
  });
  base.meshes.push(holder);
  return base;
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------
export function updateProjectile(p, dt, ts) {
  const skill = p.skill;
  const telT = clamp((ts - p.spawnTs) / skill.telegraph, 0, 1);
  const pulse = 0.45 + Math.sin(ts / 90) * 0.15;

  if (ts < p.telegraphUntil) {
    // Telegraph fade-in + pulse
    if (p.type === "LINEAR" || p.type === "BOOMERANG") {
      p.telegraph.material.opacity = 0.18 + 0.1 * telT + 0.08 * pulse;
      p.telegraphInner.material.opacity = 0.3 + 0.4 * telT;
    } else if (p.type === "AOE_CIRCLE") {
      p.disc.material.opacity = 0.22 + 0.18 * telT + 0.08 * pulse;
      p.ring.material.opacity = 0.5 + 0.4 * telT;
      const s = 1 - 0.4 * telT;
      p.ring.scale.set(s, s, 1);
    } else if (p.type === "BEAM") {
      p.telegraph.material.opacity = 0.22 + 0.25 * telT + 0.1 * pulse;
    }
    return;
  }

  if (p.type === "LINEAR" || p.type === "BOOMERANG") {
    p.head.visible = true;
    p.telegraph.material.opacity = Math.max(0, p.telegraph.material.opacity - dt * 1.4);
    p.telegraphInner.material.opacity = Math.max(0, p.telegraphInner.material.opacity - dt * 1.4);

    const delta = p.speed * dt;
    if (!p.returning) {
      p.currentDist += delta;
      if (p.type === "BOOMERANG" && p.currentDist >= p.totalLen) p.returning = true;
      else if (p.type === "LINEAR" && p.currentDist >= p.totalLen) p.expired = true;
    } else {
      p.currentDist -= delta;
      if (p.currentDist <= 0) p.expired = true;
    }
    const hx = p.x1 + p.dirX * p.currentDist;
    const hz = p.z1 + p.dirZ * p.currentDist;
    p.head.position.set(hx, WORLD.hitY, hz);
  } else if (p.type === "AOE_CIRCLE") {
    const k = clamp((ts - p.telegraphUntil) / p.skill.activeTime, 0, 1);
    p.disc.material.opacity = (1 - k) * 0.8;
    p.ring.material.opacity = (1 - k) * 0.9;
    p.boom.visible = true;
    const bs = 0.5 + k * 0.8;
    p.boom.scale.set(bs, bs, bs);
    p.boom.material.opacity = (1 - k) * 0.8;
    if (ts >= p.activeUntil) p.expired = true;
  } else if (p.type === "BEAM") {
    const k = clamp((ts - p.telegraphUntil) / p.skill.activeTime, 0, 1);
    p.telegraph.material.opacity = (1 - k) * 0.5;
    p.beam.visible = true;
    p.beam.material.opacity = (1 - k) * 0.85;
    if (ts >= p.activeUntil) p.expired = true;
  }
}

// ---------------------------------------------------------------------------
// Disposal — remove meshes and release GPU resources
// ---------------------------------------------------------------------------
export function disposeProjectile(p, scene) {
  for (const root of p.meshes) {
    if (!root) continue;
    scene.remove(root);
    root.traverse?.((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose?.());
      }
    });
    root.clear?.();
  }
  p.meshes = [];
}

// ---------------------------------------------------------------------------
// Collision — returns the skill that hit, or null
// ---------------------------------------------------------------------------
export function checkProjectileHit(p, px, pz, pR) {
  const now = performance.now();
  if (p.expired || now < p.telegraphUntil) return null;
  const s = p.skill;

  if (p.type === "LINEAR" || p.type === "BOOMERANG") {
    const hx = p.x1 + p.dirX * p.currentDist;
    const hz = p.z1 + p.dirZ * p.currentDist;
    const tail = s.width * 0.9;
    const tx = hx - p.dirX * tail;
    const tz = hz - p.dirZ * tail;
    if (segmentCircle2D(tx, tz, hx, hz, s.width / 2, px, pz, pR)) return s;
  } else if (p.type === "AOE_CIRCLE") {
    if (dist2D(px, pz, p.cx, p.cz) <= p.radius + pR) return s;
  } else if (p.type === "BEAM") {
    // Rotate (px - ox, pz - oz) into beam-local coords where local +X = (dirX, dirZ).
    const dx = px - p.ox, dz = pz - p.oz;
    const lx = dx * p.dirX + dz * p.dirZ;
    const lz = dz * p.dirX - dx * p.dirZ;
    if (lx >= -pR && lx <= p.length + pR && Math.abs(lz) <= p.width / 2 + pR) return s;
  }
  return null;
}
