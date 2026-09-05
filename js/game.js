/**
 * Strike Ops 3D - Main Game Loop & Coordinator Module
 * Integrates Engine, Player, Weapons, AI, and UI into a seamless 60fps loop.
 */

window.Game = (function() {
  'use strict';

  let clock;
  let isRunning = false;

  function init() {
    clock = new THREE.Clock();

    const canvas = document.getElementById('game-container') || document.getElementById('game-canvas') || document.body;
    if (!canvas) {
      console.error('Missing #game-canvas element');
      return;
    }

    // 1. Initialize 3D Engine & Scene
    window.Engine.init(canvas);
    window.Engine.scene.add(window.Engine.camera);

    // 2. Initialize Tactical Weapons Rig
    window.Weapons.init(window.Engine.camera, window.Engine.scene);

    // 3. Initialize First-Person Player Controller
    window.Player.init(window.Engine.camera);

    // 4. Initialize Hostile PMC Bot System
    window.AI.init(window.Engine.scene);

    // 5. Initialize Call of Duty Modern Warfare Tactical HUD
    window.UI.init();

    // Wire Weapon Raycast Shooting to Bot Hitboxes & Map Colliders
    setupWeaponRaycast();

    // Wire Explosive Barrel Damage Callbacks
    if (window.Engine.onExplosionDamage) {
      window.Engine.onExplosionDamage((center, radius, maxDamage) => {
        handleExplosionDamage(center, radius, maxDamage);
      });
    }

    // Handle Window Resizing
    window.addEventListener('resize', onWindowResize);

    // Start Animation Loop
    requestAnimationFrame(gameLoop);
  }

  function setupWeaponRaycast() {
    // Override or hook into Weapons.fire hit detection
    const originalFire = window.Weapons.fire;

    window.Weapons.fire = function() {
      const wep = window.Weapons.currentWeapon;
      if (!wep || wep.currentClip <= 0 || window.Weapons.isReloading) {
        return originalFire.apply(this, arguments);
      }

      // Execute standard weapon visuals/audio/recoil
      const fired = originalFire.apply(this, arguments);
      if (!fired) return false;

      // Raycast from camera center
      const camera = window.Engine.camera;
      const rayOrigin = camera.position.clone();
      const rayDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

      // Check Bot Intersections First
      const botHit = window.AI.raycastHit(rayOrigin, rayDir, 180);

      // Check Environment Map Raycast
      const envHit = window.Engine.raycast ? window.Engine.raycast(rayOrigin, rayDir, 180) : null;

      if (botHit && (!envHit || botHit.distance < envHit.distance)) {
        // Hit Bot!
        const damage = wep.damage || 35;
        botHit.bot.takeDamage(damage, botHit.isHeadshot, botHit.point);
        window.Weapons.playHitmarker(botHit.isHeadshot);
        window.UI.showHitmarker(botHit.isHeadshot);
      } else if (envHit) {
        // Check if hit explosive barrel
        if (window.Engine.explosiveBarrels) {
          for (const barrel of window.Engine.explosiveBarrels) {
            if (!barrel.exploded && barrel.position.distanceTo(envHit.point) < 1.4) {
              barrel.takeDamage(wep.damage || 35);
              window.Weapons.playHitmarker(false);
              window.UI.showHitmarker(false);
              break;
            }
          }
        }

        // Spawn bullet impact decal & sparks
        if (window.Engine.spawnBulletImpact) {
          window.Engine.spawnBulletImpact(envHit.point, envHit.normal, envHit.materialType || 'concrete');
        }
      }

      return true;
    };
  }

  function handleExplosionDamage(center, radius, maxDamage) {
    // Damage Bots in blast radius
    if (window.AI && window.AI.getBots) {
      const bots = window.AI.getBots();
      for (const bot of bots) {
        if (bot.isDead) continue;
        const dist = bot.position.distanceTo(center);
        if (dist < radius) {
          const falloff = 1.0 - (dist / radius);
          const damage = Math.round(maxDamage * falloff);
          bot.takeDamage(damage, false, bot.position);
        }
      }
    }

    // Damage Player in blast radius
    if (window.Player) {
      const playerPos = window.Player.getPosition();
      const dist = playerPos.distanceTo(center);
      if (dist < radius) {
        const falloff = 1.0 - (dist / radius);
        const damage = Math.round(maxDamage * 0.65 * falloff);
        window.Player.takeDamage(damage, center);
      }
    }
  }

  function start() {
    isRunning = true;
    if (clock) clock.start();
    if (window.AI && window.AI.getCurrentWave() === 0) {
      window.AI.startNextWave();
    }
  }

  function restart() {
    if (window.Player) window.Player.respawn();
    if (window.AI) {
      window.AI.reset();
      window.AI.startNextWave();
    }
    isRunning = true;
  }

  function onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (window.Engine) {
      window.Engine.resize(width, height);
    }
  }

  function gameLoop() {
    requestAnimationFrame(gameLoop);

    const delta = Math.min(0.05, clock ? clock.getDelta() : 0.016);

    if (isRunning) {
      // 1. Update Player Controls & Movement
      window.Player.update(delta);

      // 2. Update Weapons Viewmodel (Sway, Bobbing, Recoil, ADS)
      const playerPos = window.Player.getPosition();
      const isMoving = window.Player.getVelocity ? window.Player.getVelocity().lengthSq() > 0.5 : false;
      window.Weapons.update(delta, {
        isMoving,
        isSprinting: window.Player.isSprinting,
        isADS: window.Weapons.isADS,
        isCrouching: window.Player.isCrouching
      });

      // 3. Update Hostile AI Bots
      window.AI.update(delta, playerPos);

      // 4. Update Engine Atmosphere, Lights, VFX
      window.Engine.update(delta);

      // 5. Update Minimap Radar & Crosshairs
      window.UI.updateMinimap(playerPos, window.Player.getEuler().y, window.AI.getBots(), delta);
      window.UI.setCrosshairADS(window.Weapons.isADS);
    }

    // 6. Render Frame
    window.Engine.render();
  }

  return {
    init,
    start,
    restart,
    get isRunning() { return isRunning; }
  };
})();

// Auto-boot when DOM and Three.js are ready
window.addEventListener('DOMContentLoaded', () => {
  if (window.THREE) {
    window.Game.init();
  } else {
    console.error('Three.js failed to load before game.js');
  }
});
