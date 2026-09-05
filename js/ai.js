/**
 * Strike Ops 3D - AI Bot System Module
 * Procedural 3D tactical soldier models, behavior state machine,
 * pathfinding, combat engagement, and escalating wave mechanics.
 */

window.AI = (function() {
  'use strict';

  let scene;
  const bots = [];
  let currentWave = 0;
  let waveInProgress = false;
  let waveTransitionTimer = 0;

  // Tactical Compound Spawn Coordinates
  const SPAWN_POINTS = [
    new THREE.Vector3(-22, 0, -18),
    new THREE.Vector3(22, 0, -18),
    new THREE.Vector3(-18, 0, 12),
    new THREE.Vector3(18, 0, 12),
    new THREE.Vector3(0, 0, -25),
    new THREE.Vector3(-24, 0, 0),
    new THREE.Vector3(24, 0, 0),
    new THREE.Vector3(0, 3.5, 0) // Catwalk spawn
  ];

  // Shared Materials for Performance
  let camoMaterial, vestMaterial, skinMaterial, helmetMaterial, weaponMaterial;

  function initMaterials() {
    camoMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d4839, // Olive drab tactical camo
      roughness: 0.85,
      metalness: 0.1
    });

    vestMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c1e20, // Tactical black plate carrier
      roughness: 0.75,
      metalness: 0.25
    });

    skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xcca080,
      roughness: 0.6,
      metalness: 0.0
    });

    helmetMaterial = new THREE.MeshStandardMaterial({
      color: 0x242823,
      roughness: 0.6,
      metalness: 0.4
    });

    weaponMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.4,
      metalness: 0.7
    });
  }

  function createSoldierMesh() {
    const soldier = new THREE.Group();

    // Torso & Plate Carrier
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
    const torso = new THREE.Mesh(torsoGeo, camoMaterial);
    torso.position.y = 1.15;
    torso.castShadow = true;
    torso.receiveShadow = true;
    soldier.add(torso);

    const vestGeo = new THREE.BoxGeometry(0.74, 0.75, 0.52);
    const vest = new THREE.Mesh(vestGeo, vestMaterial);
    vest.position.set(0, 0.02, 0);
    vest.castShadow = true;
    torso.add(vest);

    // Head & Helmet
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.85, 0);

    const headGeo = new THREE.BoxGeometry(0.38, 0.42, 0.38);
    const head = new THREE.Mesh(headGeo, skinMaterial);
    head.castShadow = true;
    head.isHeadshotTarget = true;
    headGroup.add(head);

    const helmetGeo = new THREE.BoxGeometry(0.44, 0.3, 0.46);
    const helmet = new THREE.Mesh(helmetGeo, helmetMaterial);
    helmet.position.set(0, 0.12, 0.02);
    helmet.castShadow = true;
    helmet.isHeadshotTarget = true;
    headGroup.add(helmet);

    // Tactical Goggles
    const goggleGeo = new THREE.BoxGeometry(0.34, 0.12, 0.1);
    const goggleMat = new THREE.MeshStandardMaterial({ color: 0x0a1015, roughness: 0.2, metalness: 0.9 });
    const goggles = new THREE.Mesh(goggleGeo, goggleMat);
    goggles.position.set(0, 0.02, 0.22);
    headGroup.add(goggles);

    soldier.add(headGroup);

    // Arms & Weapon
    const armGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);

    const leftArm = new THREE.Mesh(armGeo, camoMaterial);
    leftArm.position.set(-0.48, 1.15, 0.15);
    leftArm.rotation.x = 0.5;
    leftArm.castShadow = true;
    soldier.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, camoMaterial);
    rightArm.position.set(0.48, 1.15, 0.25);
    rightArm.rotation.x = -0.8;
    rightArm.rotation.y = -0.3;
    rightArm.castShadow = true;
    soldier.add(rightArm);

    // Weapon mesh in hands
    const rifleGeo = new THREE.BoxGeometry(0.12, 0.18, 0.9);
    const rifle = new THREE.Mesh(rifleGeo, weaponMaterial);
    rifle.position.set(0.25, 1.05, 0.55);
    rifle.rotation.x = 0.1;
    rifle.castShadow = true;
    soldier.add(rifle);

    // Muzzle Flash Sprite
    const flashGeo = new THREE.PlaneGeometry(0.4, 0.4);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlash.position.set(0.25, 1.08, 1.15);
    soldier.add(muzzleFlash);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.26, 0.85, 0.28);

    const leftLeg = new THREE.Mesh(legGeo, camoMaterial);
    leftLeg.position.set(-0.2, 0.42, 0);
    leftLeg.castShadow = true;
    soldier.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, camoMaterial);
    rightLeg.position.set(0.2, 0.42, 0);
    rightLeg.castShadow = true;
    soldier.add(rightLeg);

    return {
      root: soldier,
      headGroup,
      head,
      torso,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      muzzleFlash
    };
  }

  class Bot {
    constructor(id, spawnPos) {
      this.id = id;
      this.health = 100;
      this.maxHealth = 100;
      this.isDead = false;
      this.state = 'PATROL'; // PATROL, CHASE, SHOOT, HIT, DEAD

      this.position = spawnPos.clone();
      this.targetPosition = spawnPos.clone();
      this.speed = 4.2 + Math.random() * 1.5;
      this.lastShotTime = 0;
      this.fireInterval = 0.18 + Math.random() * 0.12;
      this.burstCount = 0;
      this.maxBurst = 3 + Math.floor(Math.random() * 3);
      this.burstCooldown = 1.2;
      this.lastBurstEnd = 0;
      this.patrolTimer = 0;

      this.meshes = createSoldierMesh();
      this.meshes.root.position.copy(this.position);
      scene.add(this.meshes.root);

      // Animation time
      this.animTime = Math.random() * 10;
    }

    update(delta, playerPos) {
      if (this.isDead) {
        this.updateDeathAnimation(delta);
        return;
      }

      this.animTime += delta * 8;
      const distToPlayer = this.position.distanceTo(playerPos);

      // Line of sight check
      const hasLOS = distToPlayer < 45 && this.checkLineOfSight(playerPos);

      if (hasLOS) {
        if (distToPlayer > 12) {
          this.state = 'CHASE';
        } else {
          this.state = 'SHOOT';
        }
      } else {
        this.state = 'PATROL';
      }

      // Execute State Behaviors
      switch (this.state) {
        case 'PATROL':
          this.patrolBehavior(delta);
          break;
        case 'CHASE':
          this.chaseBehavior(delta, playerPos);
          break;
        case 'SHOOT':
          this.shootBehavior(delta, playerPos, distToPlayer);
          break;
      }

      // Floor Height Adjustment & Ground Clamp
      let floorY = 0;
      if (window.Engine && window.Engine.getFloorHeight) {
        floorY = window.Engine.getFloorHeight(this.position.x, this.position.z, this.position.y);
      }
      this.position.y = floorY;
      this.meshes.root.position.copy(this.position);

      // Limb Walk Animation
      if (this.state === 'PATROL' || this.state === 'CHASE') {
        const swing = Math.sin(this.animTime) * 0.45;
        this.meshes.leftLeg.rotation.x = swing;
        this.meshes.rightLeg.rotation.x = -swing;
      } else {
        this.meshes.leftLeg.rotation.x = 0;
        this.meshes.rightLeg.rotation.x = 0;
      }
    }

    checkLineOfSight(playerPos) {
      // Raycast towards player center
      const rayOrigin = this.position.clone().add(new THREE.Vector3(0, 1.5, 0));
      const targetPos = playerPos.clone();
      const dir = new THREE.Vector3().subVectors(targetPos, rayOrigin).normalize();
      const dist = rayOrigin.distanceTo(targetPos);

      if (window.Engine && window.Engine.raycast) {
        const hit = window.Engine.raycast(rayOrigin, dir, dist);
        // If raycast hit something solid before reaching player, LOS is blocked
        if (hit && hit.distance < dist - 0.5) {
          return false;
        }
      }
      return true;
    }

    patrolBehavior(delta) {
      this.patrolTimer -= delta;
      if (this.patrolTimer <= 0) {
        this.patrolTimer = 3 + Math.random() * 4;
        const randomAngle = Math.random() * Math.PI * 2;
        const randomDist = 6 + Math.random() * 10;
        this.targetPosition.set(
          this.position.x + Math.cos(randomAngle) * randomDist,
          this.position.y,
          this.position.z + Math.sin(randomAngle) * randomDist
        );
      }

      this.moveTowards(this.targetPosition, this.speed * 0.55, delta);
    }

    chaseBehavior(delta, playerPos) {
      this.moveTowards(playerPos, this.speed, delta);
    }

    shootBehavior(delta, playerPos, distToPlayer) {
      // Rotate immediately to face player
      const dir = new THREE.Vector3().subVectors(playerPos, this.position);
      dir.y = 0;
      dir.normalize();
      const angle = Math.atan2(dir.x, dir.z);
      this.meshes.root.rotation.y = angle;

      const now = performance.now() * 0.001;

      // Burst Fire Mechanics
      if (now - this.lastBurstEnd < this.burstCooldown) {
        return;
      }

      if (now - this.lastShotTime >= this.fireInterval) {
        this.lastShotTime = now;
        this.fireShot(playerPos, distToPlayer);
        this.burstCount++;

        if (this.burstCount >= this.maxBurst) {
          this.burstCount = 0;
          this.lastBurstEnd = now;
          this.maxBurst = 2 + Math.floor(Math.random() * 3);
        }
      }
    }

    fireShot(playerPos, distToPlayer) {
      // Trigger Muzzle Flash
      this.meshes.muzzleFlash.material.opacity = 1.0;
      setTimeout(() => {
        if (this.meshes && this.meshes.muzzleFlash) {
          this.meshes.muzzleFlash.material.opacity = 0;
        }
      }, 50);

      // Play Gunshot Audio via Engine
      if (window.Engine && window.Engine.Audio && window.Engine.Audio.playGunshot) {
        window.Engine.Audio.playGunshot(0.7);
      }

      // Accuracy calculation based on distance
      const baseAccuracy = Math.max(0.25, 1.0 - (distToPlayer / 35.0) * 0.65);
      const isHit = Math.random() < baseAccuracy;

      if (isHit && window.Player) {
        const damage = 8 + Math.floor(Math.random() * 6);
        window.Player.takeDamage(damage, this.position);
      }
    }

    moveTowards(target, moveSpeed, delta) {
      const dir = new THREE.Vector3().subVectors(target, this.position);
      dir.y = 0;
      const dist = dir.length();

      if (dist > 0.6) {
        dir.normalize();
        const angle = Math.atan2(dir.x, dir.z);
        this.meshes.root.rotation.y = angle;

        const nextPos = this.position.clone();
        nextPos.x += dir.x * moveSpeed * delta;
        nextPos.z += dir.z * moveSpeed * delta;

        // Collision Check with compound walls
        if (window.Engine && window.Engine.checkCollision) {
          const col = window.Engine.checkCollision(nextPos, 0.45, 1.8);
          if (col.collided) {
            nextPos.x += col.pushback.x;
            nextPos.z += col.pushback.z;
          }
        }

        this.position.x = nextPos.x;
        this.position.z = nextPos.z;
      }
    }

    takeDamage(amount, isHeadshot, hitPoint) {
      if (this.isDead) return;

      const effectiveDamage = isHeadshot ? amount * 2.5 : amount;
      this.health -= effectiveDamage;

      // Spawn blood impact particles
      if (window.Engine && window.Engine.spawnBulletImpact) {
        window.Engine.spawnBulletImpact(hitPoint || this.position, new THREE.Vector3(0, 1, 0), 'blood');
      }

      if (this.health <= 0) {
        this.die(isHeadshot);
      }
    }

    die(isHeadshot) {
      this.isDead = true;
      this.meshes.muzzleFlash.material.opacity = 0;

      if (window.Player) {
        const wepName = (window.Weapons && window.Weapons.currentWeapon) ? window.Weapons.currentWeapon.name : 'M4A1';
        window.Player.registerKill(isHeadshot, wepName);
      }

      // Check if all bots in wave are cleared
      checkWaveStatus();
    }

    updateDeathAnimation(delta) {
      if (this.meshes.root.rotation.x < Math.PI * 0.45) {
        this.meshes.root.rotation.x += delta * 4.5;
        this.meshes.root.position.y = Math.max(0.1, this.meshes.root.position.y - delta * 2.0);
      }
    }

    cleanup() {
      if (this.meshes && this.meshes.root && scene) {
        scene.remove(this.meshes.root);
      }
    }
  }

  function init(s) {
    scene = s;
    initMaterials();
  }

  function startNextWave() {
    currentWave++;
    waveInProgress = true;
    const botCount = 2 + currentWave * 2; // Progressive scaling: 4, 6, 8, 10...

    if (window.UI) {
      window.UI.showWaveBanner(`WAVE ${currentWave}`, `HOSTILE PMC SQUAD DETECTED (${botCount} HOSTILES)`);
    }

    // Spawn bots at staggered positions
    for (let i = 0; i < botCount; i++) {
      const spawnPos = SPAWN_POINTS[i % SPAWN_POINTS.length].clone();
      // add small random offset
      spawnPos.x += (Math.random() - 0.5) * 4;
      spawnPos.z += (Math.random() - 0.5) * 4;
      const bot = new Bot(`PMC_${currentWave}_${i + 1}`, spawnPos);
      bots.push(bot);
    }
  }

  function checkWaveStatus() {
    const aliveCount = bots.filter(b => !b.isDead).length;
    if (aliveCount === 0 && waveInProgress) {
      waveInProgress = false;
      waveTransitionTimer = 3.5; // Next wave countdown
    }
  }

  function update(delta, playerPos) {
    // Handle Wave Transitions
    if (!waveInProgress) {
      if (waveTransitionTimer > 0) {
        waveTransitionTimer -= delta;
        if (waveTransitionTimer <= 0) {
          startNextWave();
        }
      } else if (currentWave === 0) {
        startNextWave();
      }
    }

    // Update all bots
    for (let i = bots.length - 1; i >= 0; i--) {
      const bot = bots[i];
      bot.update(delta, playerPos);
    }
  }

  function raycastHit(rayOrigin, rayDir, maxDist) {
    // Check intersection with all living bots
    let closestHit = null;
    let minDistance = maxDist;

    const raycaster = new THREE.Raycaster(rayOrigin, rayDir, 0.1, maxDist);

    for (const bot of bots) {
      if (bot.isDead) continue;

      const objectsToCheck = [bot.meshes.head, bot.meshes.torso];
      const intersects = raycaster.intersectObjects(objectsToCheck, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.distance < minDistance) {
          minDistance = hit.distance;
          const isHead = (hit.object === bot.meshes.head || hit.object.isHeadshotTarget);
          closestHit = {
            bot,
            point: hit.point,
            distance: hit.distance,
            isHeadshot: isHead
          };
        }
      }
    }

    return closestHit;
  }

  function reset() {
    for (const bot of bots) {
      bot.cleanup();
    }
    bots.length = 0;
    currentWave = 0;
    waveInProgress = false;
  }

  return {
    init,
    update,
    raycastHit,
    startNextWave,
    reset,
    getBots: () => bots,
    getCurrentWave: () => currentWave,
    getAliveCount: () => bots.filter(b => !b.isDead).length
  };
})();
