/**
 * Strike Ops 3D - Player Controller Module
 * Handles first-person physics, desktop PointerLock, mobile/iPad touch controls,
 * health system, damage feedback, and weapon interaction.
 */

window.Player = (function() {
  'use strict';

  let camera;
  const position = new THREE.Vector3(0, 1.7, 18);
  const velocity = new THREE.Vector3();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Stats & State
  let health = 100;
  const maxHealth = 100;
  let isDead = false;
  let score = 0;
  let kills = 0;
  let headshots = 0;
  let killstreak = 0;
  let lastDamageTime = 0;
  const REGEN_DELAY = 4.0;
  const REGEN_RATE = 20.0; // HP/sec

  // Movement Constants
  const WALK_SPEED = 7.0;
  const SPRINT_SPEED = 11.5;
  const CROUCH_SPEED = 3.5;
  const JUMP_FORCE = 8.5;
  const GRAVITY = 24.0;
  const STAND_HEIGHT = 1.7;
  const CROUCH_HEIGHT = 1.0;
  let currentHeight = STAND_HEIGHT;

  let isGrounded = false;
  let isCrouching = false;
  let isSprinting = false;
  let isFiring = false;

  // Desktop Controls state
  const keys = {};
  let isPointerLocked = false;
  let mouseSensitivity = 0.0022;

  // Mobile / Touch State
  let joystickActive = false;
  let joystickTouchId = null;
  const joystickCenter = { x: 0, y: 0 };
  const joystickVector = { x: 0, y: 0 };
  let aimTouchId = null;
  const lastAimPos = { x: 0, y: 0 };
  let touchAdsActive = false;

  function init(cam) {
    camera = cam;
    camera.rotation.order = 'YXZ';
    camera.position.copy(position);

    setupDesktopInput();
    setupTouchInput();
  }

  function setupDesktopInput() {
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;

      if (e.code === 'KeyR' && !isDead) {
        if (window.Weapons) window.Weapons.reload();
      } else if ((e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'KeyQ') && !isDead) {
        if (window.Weapons) window.Weapons.switchWeapon();
      } else if (e.code === 'KeyC' || e.code === 'ControlLeft') {
        isCrouching = !isCrouching;
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (!isPointerLocked || isDead) return;
      if (e.button === 0) { // Left click: Fire
        isFiring = true;
      } else if (e.button === 2) { // Right click: ADS
        if (window.Weapons) {
          window.Weapons.toggleADS ? window.Weapons.toggleADS() : (window.Weapons.isADSActive = !window.Weapons.isADS);
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) isFiring = false;
    });

    window.addEventListener('contextmenu', (e) => {
      if (isPointerLocked) e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isPointerLocked || isDead) return;

      const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
      const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

      euler.y -= movementX * mouseSensitivity;
      euler.x -= movementY * mouseSensitivity;
      euler.x = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, euler.x));

      camera.quaternion.setFromEuler(euler);

      if (window.Weapons && window.Weapons.applyMouseSway) {
        window.Weapons.applyMouseSway(movementX, movementY);
      }
    });

    const canvas = document.getElementById('game-canvas') || document.body;
    canvas.addEventListener('click', () => {
      if (!isPointerLocked && !isDead) {
        requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = (document.pointerLockElement === canvas || document.pointerLockElement === document.body);
    });
  }

  function requestPointerLock() {
    const canvas = document.getElementById('game-canvas') || document.body;
    try {
      const res = canvas.requestPointerLock();
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
    } catch(err) {
      // Ignored: Pointer lock rejected or not supported
    }
  }

  function exitPointerLock() {
    if (document.exitPointerLock) document.exitPointerLock();
  }

  function setupTouchInput() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const touchContainer = document.getElementById('touch-controls-container');
    if (isTouchDevice && touchContainer) {
      touchContainer.style.display = 'block';
    }

    const joystickZone = document.getElementById('virtual-joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');
    const joystickBase = document.getElementById('joystick-base');
    const aimZone = document.getElementById('virtual-aim-zone');

    if (joystickZone) {
      joystickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        joystickTouchId = touch.identifier;
        joystickActive = true;
        const rect = joystickZone.getBoundingClientRect();
        joystickCenter.x = touch.clientX - rect.left;
        joystickCenter.y = touch.clientY - rect.top;
        if (joystickBase) {
          joystickBase.style.left = `${joystickCenter.x}px`;
          joystickBase.style.top = `${joystickCenter.y}px`;
          joystickBase.style.opacity = '1';
        }
      }, { passive: false });

      joystickZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === joystickTouchId) {
            const rect = joystickZone.getBoundingClientRect();
            const currentX = touch.clientX - rect.left;
            const currentY = touch.clientY - rect.top;
            const dx = currentX - joystickCenter.x;
            const dy = currentY - joystickCenter.y;
            const dist = Math.hypot(dx, dy);
            const maxRadius = 45;
            const clampedDist = Math.min(dist, maxRadius);
            const angle = Math.atan2(dy, dx);
            const normX = clampedDist > 5 ? (Math.cos(angle) * clampedDist) / maxRadius : 0;
            const normY = clampedDist > 5 ? (Math.sin(angle) * clampedDist) / maxRadius : 0;

            joystickVector.x = normX;
            joystickVector.y = normY;

            if (joystickKnob) {
              joystickKnob.style.transform = `translate(calc(-50% + ${Math.cos(angle) * clampedDist}px), calc(-50% + ${Math.sin(angle) * clampedDist}px))`;
            }
            break;
          }
        }
      }, { passive: false });

      const endJoystick = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === joystickTouchId) {
            joystickActive = false;
            joystickTouchId = null;
            joystickVector.x = 0;
            joystickVector.y = 0;
            if (joystickKnob) joystickKnob.style.transform = 'translate(-50%, -50%)';
            if (joystickBase) joystickBase.style.opacity = '0.5';
            break;
          }
        }
      };
      joystickZone.addEventListener('touchend', endJoystick, { passive: false });
      joystickZone.addEventListener('touchcancel', endJoystick, { passive: false });
    }

    if (aimZone) {
      aimZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        aimTouchId = touch.identifier;
        lastAimPos.x = touch.clientX;
        lastAimPos.y = touch.clientY;
      }, { passive: false });

      aimZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === aimTouchId) {
            const dx = touch.clientX - lastAimPos.x;
            const dy = touch.clientY - lastAimPos.y;
            lastAimPos.x = touch.clientX;
            lastAimPos.y = touch.clientY;

            const touchSensitivity = 0.0035;
            euler.y -= dx * touchSensitivity;
            euler.x -= dy * touchSensitivity;
            euler.x = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, euler.x));
            camera.quaternion.setFromEuler(euler);

            if (window.Weapons && window.Weapons.applyMouseSway) {
              window.Weapons.applyMouseSway(dx * 1.5, dy * 1.5);
            }
            break;
          }
        }
      }, { passive: false });

      const endAim = (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === aimTouchId) {
            aimTouchId = null;
            break;
          }
        }
      };
      aimZone.addEventListener('touchend', endAim, { passive: false });
      aimZone.addEventListener('touchcancel', endAim, { passive: false });
    }

    // Buttons
    const btnFire = document.getElementById('touch-btn-fire');
    if (btnFire) {
      btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); isFiring = true; }, { passive: false });
      btnFire.addEventListener('touchend', (e) => { e.preventDefault(); isFiring = false; }, { passive: false });
    }

    const btnAds = document.getElementById('touch-btn-ads');
    if (btnAds) {
      btnAds.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchAdsActive = !touchAdsActive;
        btnAds.classList.toggle('active', touchAdsActive);
        if (window.Weapons) window.Weapons.toggleADS ? window.Weapons.toggleADS() : (window.Weapons.isADSActive = touchAdsActive);
      }, { passive: false });
    }

    const btnJump = document.getElementById('touch-btn-jump');
    if (btnJump) {
      btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (isGrounded && !isDead) velocity.y = JUMP_FORCE;
      }, { passive: false });
    }

    const btnCrouch = document.getElementById('touch-btn-crouch');
    if (btnCrouch) {
      btnCrouch.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isCrouching = !isCrouching;
        btnCrouch.classList.toggle('active', isCrouching);
      }, { passive: false });
    }

    const btnReload = document.getElementById('touch-btn-reload');
    if (btnReload) {
      btnReload.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.Weapons) window.Weapons.reload();
      }, { passive: false });
    }

    const btnSwap = document.getElementById('touch-btn-swap');
    if (btnSwap) {
      btnSwap.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.Weapons) window.Weapons.switchWeapon();
      }, { passive: false });
    }
  }

  function update(delta) {
    if (isDead) return;

    // Health Regeneration
    const now = performance.now() * 0.001;
    if (now - lastDamageTime > REGEN_DELAY && health < maxHealth) {
      health = Math.min(maxHealth, health + REGEN_RATE * delta);
      if (window.UI) window.UI.updateHealth(health, maxHealth);
    }

    // Movement Direction Calculation
    const moveVector = new THREE.Vector3();

    // Desktop WASD
    if (keys['KeyW'] || keys['ArrowUp']) moveVector.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) moveVector.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) moveVector.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) moveVector.x += 1;

    // Mobile Joystick input
    if (joystickActive) {
      moveVector.x += joystickVector.x;
      moveVector.z += joystickVector.y;
    }

    // Sprint & Crouch state
    isSprinting = Boolean(keys['ShiftLeft'] || keys['ShiftRight']) && moveVector.z < 0 && !isCrouching;
    let targetSpeed = WALK_SPEED;
    if (isSprinting) targetSpeed = SPRINT_SPEED;
    if (isCrouching) targetSpeed = CROUCH_SPEED;

    const targetHeight = isCrouching ? CROUCH_HEIGHT : STAND_HEIGHT;
    currentHeight += (targetHeight - currentHeight) * Math.min(1.0, delta * 10);

    // Jump
    if ((keys['Space']) && isGrounded) {
      velocity.y = JUMP_FORCE;
      isGrounded = false;
      if (window.Engine && window.Engine.Audio) window.Engine.Audio.playFootstep ? window.Engine.Audio.playFootstep() : null;
    }

    // Apply rotation to horizontal movement
    if (moveVector.lengthSq() > 0.001) {
      moveVector.normalize();
      const moveQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), euler.y);
      moveVector.applyQuaternion(moveQuat);
      velocity.x = moveVector.x * targetSpeed;
      velocity.z = moveVector.z * targetSpeed;
    } else {
      // Damping
      velocity.x *= Math.max(0, 1 - delta * 12);
      velocity.z *= Math.max(0, 1 - delta * 12);
    }

    // Gravity
    velocity.y -= GRAVITY * delta;

    // Floor collision & position update
    const nextPos = position.clone();
    nextPos.x += velocity.x * delta;
    nextPos.z += velocity.z * delta;
    nextPos.y += velocity.y * delta;

    // Horizontal Map Collisions (wall sliding)
    if (window.Engine && window.Engine.checkCollision) {
      const collision = window.Engine.checkCollision(nextPos, 0.45, currentHeight);
      if (collision.collided) {
        nextPos.x += collision.pushback.x;
        nextPos.z += collision.pushback.z;
      }
    }

    // Vertical / Floor Height check
    let floorY = 0;
    if (window.Engine && window.Engine.getFloorHeight) {
      floorY = window.Engine.getFloorHeight(nextPos.x, nextPos.z, nextPos.y);
    }

    if (nextPos.y <= floorY + currentHeight) {
      nextPos.y = floorY + currentHeight;
      velocity.y = 0;
      isGrounded = true;
    } else {
      isGrounded = false;
    }

    position.copy(nextPos);
    camera.position.copy(position);

    // Continuous Firing (for automatic weapons)
    if (isFiring && window.Weapons) {
      window.Weapons.fire();
    }

    // Footstep audio
    const isMoving = Math.hypot(velocity.x, velocity.z) > 1.2 && isGrounded;
    if (isMoving && Math.random() < delta * (isSprinting ? 4.2 : 2.5)) {
      if (window.Engine && window.Engine.Audio && window.Engine.Audio.playFootstep) {
        window.Engine.Audio.playFootstep();
      }
    }
  }

  function takeDamage(amount, attackerPosition) {
    if (isDead) return;

    health = Math.max(0, health - amount);
    lastDamageTime = performance.now() * 0.001;

    // Trigger HUD feedback
    if (window.UI) {
      window.UI.updateHealth(health, maxHealth);
      window.UI.showDamageVignette(health / maxHealth);
      if (attackerPosition) {
        const angle = calculateDamageAngle(attackerPosition);
        window.UI.showDamageIndicator(angle);
      }
    }

    if (window.Engine && window.Engine.screenShake) {
      window.Engine.screenShake.intensity = Math.min(0.45, window.Engine.screenShake.intensity + 0.2);
    }

    if (health <= 0) {
      die();
    }
  }

  function calculateDamageAngle(attackerPos) {
    // Relative angle between player facing direction and attacker position
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const toAttacker = new THREE.Vector3().subVectors(attackerPos, position);
    toAttacker.y = 0;
    toAttacker.normalize();

    let angle = Math.atan2(toAttacker.x, toAttacker.z) - Math.atan2(forward.x, forward.z);
    return angle * (180 / Math.PI);
  }

  function die() {
    isDead = true;
    killstreak = 0;
    if (window.UI) {
      window.UI.showGameOver(score, kills, headshots);
    }
    exitPointerLock();
  }

  function respawn(spawnPoint = new THREE.Vector3(0, 1.7, 18)) {
    health = maxHealth;
    isDead = false;
    position.copy(spawnPoint);
    velocity.set(0, 0, 0);
    camera.position.copy(position);
    if (window.UI) {
      window.UI.updateHealth(health, maxHealth);
      window.UI.hideGameOver();
    }
  }

  function addScore(points, reason) {
    score += points;
    if (window.UI) {
      window.UI.addScorePopup(points, reason);
      window.UI.updateScore(score);
    }
  }

  function registerKill(isHeadshot, weaponName) {
    kills++;
    killstreak++;
    if (isHeadshot) headshots++;

    const baseScore = isHeadshot ? 125 : 100;
    addScore(baseScore, isHeadshot ? 'HEADSHOT ELIMINATION' : 'ENEMY ELIMINATED');

    if (killstreak === 3 && window.UI) {
      window.UI.showKillstreakBanner('UAV RADAR ONLINE');
    } else if (killstreak === 5 && window.UI) {
      window.UI.showKillstreakBanner('PREDATOR MISSILE READY');
    }

    if (window.UI) {
      window.UI.addKillfeedEntry('YOU', 'PMC HOSTILE', weaponName, isHeadshot);
    }
  }

  return {
    init,
    update,
    takeDamage,
    die,
    respawn,
    addScore,
    registerKill,
    getPosition: () => position,
    getEuler: () => euler,
    getHealth: () => health,
    getScore: () => score,
    getKills: () => kills,
    get isDead() { return isDead; },
    get isSprinting() { return isSprinting; },
    get isCrouching() { return isCrouching; },
    get isPointerLocked() { return isPointerLocked; }
  };
})();
