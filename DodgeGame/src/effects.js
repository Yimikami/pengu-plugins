// ---------------------------------------------------------------------------
// Short-lived Three.js effects for Flash + Ghost.
//
// Each effect builder returns an object:
//   { update(dt, ts) -> boolean alive, dispose() }
// The caller ticks each effect every frame and drops it when update() returns
// false. All materials/geometries are owned by the effect and disposed on
// dispose().
// ---------------------------------------------------------------------------
import { SPELLS } from "./constants";

// ---------------------------------------------------------------------------
// Flash — two visual pops: a bright sphere at the origin, an expanding gold
// ring at the destination, plus a short-lived point light for contact.
// ---------------------------------------------------------------------------
export function spawnFlashEffect({ THREE, scene, from, to }) {
  const color = new THREE.Color(SPELLS.flash.color);
  const duration = 450;
  const clock = { createdAt: performance.now() };

  const originSphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 20, 20),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  originSphere.position.set(from.x, 1.0, from.z);
  scene.add(originSphere);

  const destRing = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.4, 48),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 1,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  destRing.rotation.x = -Math.PI / 2;
  destRing.position.set(to.x, 0.05, to.z);
  scene.add(destRing);

  const destFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 20, 20),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  destFlash.position.set(to.x, 1.0, to.z);
  scene.add(destFlash);

  const light = new THREE.PointLight(color, 6, 8);
  light.position.set(to.x, 1.5, to.z);
  scene.add(light);

  return {
    update(_dt, ts) {
      const t = Math.min(1, (ts - clock.createdAt) / duration);
      originSphere.scale.setScalar(1 + t * 3);
      originSphere.material.opacity = 1 - t;
      const ringScale = 1 + t * 10;
      destRing.scale.set(ringScale, ringScale, 1);
      destRing.material.opacity = 1 - t;
      destFlash.scale.setScalar(1 + t * 2.2);
      destFlash.material.opacity = 1 - t;
      light.intensity = 6 * (1 - t);
      return t < 1;
    },
    dispose() {
      for (const m of [originSphere, destRing, destFlash]) {
        scene.remove(m);
        m.geometry.dispose?.();
        m.material.dispose?.();
      }
      scene.remove(light);
    },
    shiftTime(offset) { clock.createdAt += offset; },
  };
}

// ---------------------------------------------------------------------------
// Ghost — while active, a cyan ring hovers at the player's feet and a faint
// glow orb trails them. The aura follows the player every frame via the
// provided `player` reference.
// ---------------------------------------------------------------------------
export function spawnGhostAura({ THREE, scene, player, duration }) {
  const color = new THREE.Color(SPELLS.ghost.color);
  const clock = { createdAt: performance.now() };

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.9, 48),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(player.group.position.x, 0.06, player.group.position.z);
  scene.add(ring);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 18, 18),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  glow.position.set(player.group.position.x, 1.0, player.group.position.z);
  scene.add(glow);

  return {
    update(_dt, ts) {
      const elapsed = ts - clock.createdAt;
      if (elapsed >= duration) return false;
      ring.position.x = player.group.position.x;
      ring.position.z = player.group.position.z;
      glow.position.x = player.group.position.x;
      glow.position.z = player.group.position.z;
      const pulse = 0.85 + Math.sin(ts / 120) * 0.15;
      ring.scale.set(pulse, pulse, 1);
      const fadeIn = Math.min(1, elapsed / 200);
      const fadeOut = Math.min(1, (duration - elapsed) / 400);
      const alpha = fadeIn * fadeOut;
      ring.material.opacity = 0.9 * alpha;
      glow.material.opacity = 0.22 * alpha;
      return true;
    },
    dispose() {
      for (const m of [ring, glow]) {
        scene.remove(m);
        m.geometry.dispose?.();
        m.material.dispose?.();
      }
    },
    shiftTime(offset) { clock.createdAt += offset; },
  };
}

// ---------------------------------------------------------------------------
// Grace-period shield — soft bubble around the player during spawn protection.
// ---------------------------------------------------------------------------
export function spawnGraceShield({ THREE, scene, player, duration }) {
  const clock = { createdAt: performance.now() };
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 20, 20),
    new THREE.MeshBasicMaterial({
      color: 0xc8aa6e, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  shield.position.set(player.group.position.x, 1.0, player.group.position.z);
  scene.add(shield);

  return {
    update(_dt, ts) {
      const elapsed = ts - clock.createdAt;
      if (elapsed >= duration) return false;
      shield.position.x = player.group.position.x;
      shield.position.z = player.group.position.z;
      const pulse = 0.9 + Math.sin(ts / 140) * 0.1;
      shield.scale.setScalar(pulse);
      const fadeOut = Math.min(1, (duration - elapsed) / 500);
      shield.material.opacity = 0.4 * fadeOut;
      return true;
    },
    dispose() {
      scene.remove(shield);
      shield.geometry.dispose?.();
      shield.material.dispose?.();
    },
    shiftTime(offset) { clock.createdAt += offset; },
  };
}
