/**
 * Strike Ops 3D - Weapons Module
 * Viewmodel 3D meshes (M4A1, Desert Eagle, MP5), ADS sight alignment,
 * weapon sway/bobbing, recoil, raycast hit detection, bullet tracers,
 * and reload mechanics.
 */

window.Weapons = (function() {
  'use strict';

  let camera, scene;
  let currentWeaponIndex = 0;
  let isReloading = false;
  let reloadTimer = 0;
  let reloadDuration = 2.2;
  let lastFireTime = 0;
  let isADSActive = false;

  // Viewmodel root group attached to camera
  let viewmodelHolder;
  const weaponMeshes = [];

  // Sway & Bobbing tracking
  let swayX = 0, swayY = 0;
  let bobTimer = 0;
  let recoilOffset = new THREE.Vector3();
  let recoilRotation = new THREE.Euler();

  // Weapon Definitions
  const WEAPON_CONFIGS = [
    {
      id: 'm4a1',
      name: 'M4A1 TACTICAL',
      type: 'rifle',
      fireMode: 'AUTO',
      fireRate: 0.085, // ~700 RPM
      damage: 34,
      headshotMultiplier: 2.5,
      clipSize: 30,
      currentClip: 30,
      reserveAmmo: 120,
      maxReserve: 180,
      reloadTime: 2.2,
      hipPos: new THREE.Vector3(0.20, -0.22, -0.42),
      adsPos: new THREE.Vector3(0.00, -0.155, -0.32),
      recoilPitch: 0.035,
      recoilKick: 0.045
    },
    {
      id: 'deagle',
      name: 'DESERT EAGLE .50',
      type: 'pistol',
      fireMode: 'SEMI',
      fireRate: 0.22, // ~270 RPM
      damage: 65,
      headshotMultiplier: 2.5,
      clipSize: 7,
      currentClip: 7,
      reserveAmmo: 35,
      maxReserve: 42,
      reloadTime: 1.6,
      hipPos: new THREE.Vector3(0.18, -0.20, -0.38),
      adsPos: new THREE.Vector3(0.00, -0.138, -0.28),
      recoilPitch: 0.08,
      recoilKick: 0.08
    },
    {
      id: 'mp5',
      name: 'MP5 SUBMACHINE',
      type: 'smg',
      fireMode: 'AUTO',
      fireRate: 0.068, // ~880 RPM
      damage: 26,
      headshotMultiplier: 2.5,
      clipSize: 30,
      currentClip: 30,
      reserveAmmo: 150,
      maxReserve: 210,
      reloadTime: 1.9,
      hipPos: new THREE.Vector3(0.19, -0.21, -0.39),
      adsPos: new THREE.Vector3(0.00, -0.150, -0.30),
      recoilPitch: 0.025,
      recoilKick: 0.035
    }
  ];

  // Active bullet tracer lines
  const activeTracers = [];

  // ============================================================
  // WEAPON INITIALIZATION & 3D VIEWMODEL MESHES
  // ============================================================
  function init(cam, scn) {
    camera = cam;
    scene = scn;

    viewmodelHolder = new THREE.Group();
    camera.add(viewmodelHolder);

    // Build procedural 3D weapon models
    weaponMeshes.push(buildM4A1Mesh());
    weaponMeshes.push(buildDeagleMesh());
    weaponMeshes.push(buildMP5Mesh());

    weaponMeshes.forEach((w, idx) => {
      viewmodelHolder.add(w.group);
      w.group.visible = (idx === currentWeaponIndex);
    });
  }

  // --- M4A1 Tactical Assault Rifle Mesh ---
  function buildM4A1Mesh() {
    const group = new THREE.Group();

    const darkGunMat = new THREE.MeshStandardMaterial({ color: 0x1f2327, roughness: 0.4, metalness: 0.7 });
    const polyMat = new THREE.MeshStandardMaterial({ color: 0x2e3338, roughness: 0.8, metalness: 0.1 });
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0x22ff55 }); // Holographic sight green dot

    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.35), darkGunMat);
    receiver.position.set(0, 0, 0);
    group.add(receiver);

    // Barrel & Handguard
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.28), polyMat);
    handguard.position.set(0, 0.01, -0.30);
    group.add(handguard);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.18, 12), darkGunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.50);
    group.add(barrel);

    // Flash Hider / Muzzle Brake
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), darkGunMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.01, -0.60);
    group.add(muzzle);

    // Curved STANAG Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.08), darkGunMat);
    mag.position.set(0, -0.11, -0.06);
    mag.rotation.x = 0.2;
    group.add(mag);

    // Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.06), polyMat);
    grip.position.set(0, -0.10, 0.12);
    grip.rotation.x = -0.35;
    group.add(grip);

    // Crane Stock
    const stockTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12), darkGunMat);
    stockTube.rotation.x = Math.PI / 2;
    stockTube.position.set(0, 0.01, 0.26);
    group.add(stockTube);

    const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.08), polyMat);
    buttpad.position.set(0, -0.02, 0.35);
    group.add(buttpad);

    // Holographic Optic Sight
    const opticBase = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.12), darkGunMat);
    opticBase.position.set(0, 0.07, -0.05);
    group.add(opticBase);

    // Optic Glass & glowing reticle dot
    const reticleDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 8), reticleMat);
    reticleDot.position.set(0, 0.075, -0.05);
    group.add(reticleDot);

    // Muzzle flash point light and sprite
    const flashLight = new THREE.PointLight(0xffaa22, 0, 8);
    flashLight.position.set(0, 0.01, -0.65);
    group.add(flashLight);

    const flashGeo = new THREE.ConeGeometry(0.06, 0.15, 6);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0 });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.rotation.x = -Math.PI / 2;
    flashMesh.position.set(0, 0.01, -0.66);
    group.add(flashMesh);

    return {
      group,
      flashLight,
      flashMesh,
      muzzlePos: new THREE.Vector3(0, 0.01, -0.65)
    };
  }

  // --- Desert Eagle .50 Heavy Pistol Mesh ---
  function buildDeagleMesh() {
    const group = new THREE.Group();

    const chromeMat = new THREE.MeshStandardMaterial({ color: 0x9fa8b2, roughness: 0.25, metalness: 0.85 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.9, metalness: 0.0 });
    const sightMat = new THREE.MeshBasicMaterial({ color: 0xff3333 }); // Red front sight post

    // Slide & Upper Barrel
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.30), chromeMat);
    slide.position.set(0, 0.02, -0.05);
    group.add(slide);

    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.24), chromeMat);
    frame.position.set(0, -0.03, -0.04);
    group.add(frame);

    // Combat Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.16, 0.075), gripMat);
    grip.position.set(0, -0.11, 0.05);
    grip.rotation.x = -0.28;
    group.add(grip);

    // Front & Rear Sights
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.015, 0.01), sightMat);
    frontSight.position.set(0, 0.062, -0.19);
    group.add(frontSight);

    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.01), chromeMat);
    rearSight.position.set(0, 0.062, 0.09);
    group.add(rearSight);

    // Muzzle flash
    const flashLight = new THREE.PointLight(0xff9900, 0, 10);
    flashLight.position.set(0, 0.02, -0.22);
    group.add(flashLight);

    const flashGeo = new THREE.ConeGeometry(0.08, 0.18, 6);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffcc33, transparent: true, opacity: 0 });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.rotation.x = -Math.PI / 2;
    flashMesh.position.set(0, 0.02, -0.24);
    group.add(flashMesh);

    return {
      group,
      flashLight,
      flashMesh,
      muzzlePos: new THREE.Vector3(0, 0.02, -0.22)
    };
  }

  // --- MP5 Tactical SMG Mesh ---
  function buildMP5Mesh() {
    const group = new THREE.Group();

    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1f23, roughness: 0.5, metalness: 0.6 });
    const polymerMat = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.85, metalness: 0.1 });
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0x33eebb }); // Cyan optic dot

    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.28), darkMat);
    receiver.position.set(0, 0, 0);
    group.add(receiver);

    // Handguard
    const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 12), polymerMat);
    handguard.rotation.x = Math.PI / 2;
    handguard.position.set(0, -0.005, -0.20);
    group.add(handguard);

    // Barrel & Tri-lug
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 10), darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.005, -0.34);
    group.add(barrel);

    // Curved 9mm Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.17, 0.05), darkMat);
    mag.position.set(0, -0.10, -0.06);
    mag.rotation.x = 0.25;
    group.add(mag);

    // Pistol Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.13, 0.055), polymerMat);
    grip.position.set(0, -0.09, 0.09);
    grip.rotation.x = -0.32;
    group.add(grip);

    // Collapsible Stock Bars
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.18), darkMat);
    stock.position.set(0, 0.00, 0.22);
    group.add(stock);

    // Red Dot Sight
    const optic = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 12), darkMat);
    optic.rotation.x = Math.PI / 2;
    optic.position.set(0, 0.06, -0.03);
    group.add(optic);

    const reticleDot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 8), reticleMat);
    reticleDot.position.set(0, 0.06, -0.03);
    group.add(reticleDot);

    // Muzzle flash
    const flashLight = new THREE.PointLight(0xffaa22, 0, 7);
    flashLight.position.set(0, 0.005, -0.42);
    group.add(flashLight);

    const flashGeo = new THREE.ConeGeometry(0.05, 0.12, 6);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffee55, transparent: true, opacity: 0 });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.rotation.x = -Math.PI / 2;
    flashMesh.position.set(0, 0.005, -0.44);
    group.add(flashMesh);

    return {
      group,
      flashLight,
      flashMesh,
      muzzlePos: new THREE.Vector3(0, 0.005, -0.42)
    };
  }

  // ============================================================
  // WEAPON UPDATE (Bobbing, Sway, ADS Lerp, Recoil Recovery)
  // ============================================================
  function update(dt, isADS, isMoving, isFiring, isSprinting) {
    if (!viewmodelHolder) return;
    const currentWep = WEAPON_CONFIGS[currentWeaponIndex];
    const activeMeshObj = weaponMeshes[currentWeaponIndex];
    isADSActive = isADS;

    // Handle Reloading Timer
    if (isReloading) {
      reloadTimer += dt;
      const progress = Math.min(reloadTimer / reloadDuration, 1.0);
      if (window.UI) {
        window.UI.updateReloadProgress(progress);
      }

      // Reload dip animation
      const reloadDip = Math.sin(progress * Math.PI) * -0.15;
      viewmodelHolder.position.y += reloadDip;

      if (progress >= 1.0) {
        // Finish Reload
        const needed = currentWep.clipSize - currentWep.currentClip;
        const toTake = Math.min(needed, currentWep.reserveAmmo);
        currentWep.currentClip += toTake;
        currentWep.reserveAmmo -= toTake;
        isReloading = false;
        reloadTimer = 0;
        if (window.UI) {
          window.UI.finishReload();
          window.UI.updateAmmo(currentWep.currentClip, currentWep.clipSize, currentWep.reserveAmmo);
        }
      }
    }

    // ADS Target Position Lerp
    const targetPos = (isADS && !isReloading) ? currentWep.adsPos : currentWep.hipPos;
    const adsSpeed = isADS ? 14 : 12;
    viewmodelHolder.position.lerp(targetPos, adsSpeed * dt);

    // Camera FOV Lerp for ADS
    const targetFOV = isADS ? 48 : 75;
    camera.fov += (targetFOV - camera.fov) * (12 * dt);
    camera.updateProjectionMatrix();

    // Weapon Sway (decay toward center)
    swayX *= Math.pow(0.005, dt);
    swayY *= Math.pow(0.005, dt);

    // Weapon Bobbing (Walking / Sprinting)
    if (isMoving && !isADS) {
      const bobFreq = isSprinting ? 14 : 9;
      const bobAmp = isSprinting ? 0.024 : 0.012;
      bobTimer += dt * bobFreq;
      const bobX = Math.cos(bobTimer * 0.5) * bobAmp;
      const bobY = Math.abs(Math.sin(bobTimer)) * bobAmp * 1.5;
      viewmodelHolder.position.x += bobX;
      viewmodelHolder.position.y -= bobY;
    } else {
      bobTimer = 0;
    }

    // Recoil Recovery
    recoilOffset.lerp(new THREE.Vector3(0, 0, 0), 16 * dt);
    recoilRotation.x *= Math.pow(0.002, dt);
    recoilRotation.y *= Math.pow(0.002, dt);

    viewmodelHolder.position.add(recoilOffset);
    viewmodelHolder.rotation.x = recoilRotation.x + swayY;
    viewmodelHolder.rotation.y = recoilRotation.y + swayX;

    // Update active bullet tracers
    updateTracers(dt);
  }

  function applyMouseSway(deltaX, deltaY) {
    if (!viewmodelHolder) return;
    const factor = isADSActive ? 0.0003 : 0.0008;
    swayX = THREE.MathUtils.clamp(swayX - deltaX * factor, -0.04, 0.04);
    swayY = THREE.MathUtils.clamp(swayY - deltaY * factor, -0.04, 0.04);
  }

  // ============================================================
  // FIRING MECHANICS & RAYCAST HIT DETECTION
  // ============================================================
  function fire() {
    const currentWep = WEAPON_CONFIGS[currentWeaponIndex];
    const now = performance.now() / 1000;

    if (isReloading) return false;
    if (now - lastFireTime < currentWep.fireRate) return false;
    if (currentWep.currentClip <= 0) {
      // Dry fire click
      if (window.Engine && window.Engine.Audio) {
        window.Engine.Audio.playReloadSound();
      }
      reload();
      return false;
    }

    // Consume ammo
    currentWep.currentClip--;
    lastFireTime = now;

    // Update UI Ammo
    if (window.UI) {
      window.UI.updateAmmo(currentWep.currentClip, currentWep.clipSize, currentWep.reserveAmmo);
      window.UI.bloomCrosshair();
    }

    // Play procedural sound
    if (window.Engine && window.Engine.Audio) {
      window.Engine.Audio.playGunshot(currentWep.id);
    }

    // Viewmodel Recoil Impulse
    recoilOffset.z = currentWep.recoilKick * (isADSActive ? 0.4 : 1.0);
    recoilRotation.x = currentWep.recoilPitch * (isADSActive ? 0.5 : 1.0);
    recoilRotation.y = (Math.random() - 0.5) * 0.015;

    // Camera recoil kick
    if (window.Player && typeof window.Player.applyCameraRecoil === 'function') {
      const pitchKick = currentWep.recoilPitch * 0.35 * (isADSActive ? 0.4 : 1.0);
      const yawKick = (Math.random() - 0.5) * 0.008;
      window.Player.applyCameraRecoil(pitchKick, yawKick);
    }

    // Muzzle Flash Visual
    triggerMuzzleFlash(weaponMeshes[currentWeaponIndex]);

    // Raycast from Camera Center
    performRaycastHit(currentWep);

    return true;
  }

  function triggerMuzzleFlash(wepMesh) {
    if (!wepMesh) return;
    wepMesh.flashLight.intensity = 2.5;
    wepMesh.flashMesh.material.opacity = 0.95;
    wepMesh.flashMesh.rotation.z = Math.random() * Math.PI * 2;

    setTimeout(() => {
      wepMesh.flashLight.intensity = 0;
      wepMesh.flashMesh.material.opacity = 0;
    }, 45);
  }

  function performRaycastHit(wep) {
    const raycaster = new THREE.Raycaster();
    const screenCenter = new THREE.Vector2(0, 0);

    // Apply subtle spread if hipfiring
    if (!isADSActive) {
      const spreadAmt = wep.type === 'smg' ? 0.018 : wep.type === 'pistol' ? 0.012 : 0.015;
      screenCenter.x += (Math.random() - 0.5) * spreadAmt;
      screenCenter.y += (Math.random() - 0.5) * spreadAmt;
    }

    raycaster.setFromCamera(screenCenter, camera);

    // Target Meshes to test: Bots, Barrels, Scene Colliders
    const targetObjects = [];

    // 1. Bots
    if (window.AI && window.AI.getShootableObjects) {
      targetObjects.push(...window.AI.getShootableObjects());
    }

    // 2. Barrels & Environment Colliders
    if (window.Engine && window.Engine.colliders) {
      window.Engine.colliders.forEach(c => {
        if (c.mesh) targetObjects.push(c.mesh);
      });
    }

    const intersects = raycaster.intersectObjects(targetObjects, true);

    let endPoint;
    if (intersects.length > 0) {
      const hit = intersects[0];
      endPoint = hit.point;

      // Check if bot was hit
      let hitNode = hit.object;
      let botOwner = null;
      let isHeadshot = false;

      while (hitNode) {
        if (hitNode.userData && hitNode.userData.isHead) {
          isHeadshot = true;
        }
        if (hitNode.userData && hitNode.userData.bot) {
          botOwner = hitNode.userData.bot;
          break;
        }
        hitNode = hitNode.parent;
      }

      if (botOwner && !botOwner.isDead) {
        // Hit Bot!
        const totalDamage = isHeadshot ? Math.round(wep.damage * wep.headshotMultiplier) : wep.damage;
        const isKill = botOwner.takeDamage(totalDamage, isHeadshot);

        playHitmarker(isHeadshot);
        if (window.UI) {
          window.UI.showHitmarker(isHeadshot, isKill);
        }

        // Blood impact particles
        if (window.Engine && window.Engine.spawnBulletImpact) {
          window.Engine.spawnBulletImpact(hit.point, hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0), true);
        }
      } else {
        // Check if explosive barrel
        let isBarrel = false;
        if (hit.object.parent && window.Engine && window.Engine.explosiveBarrels) {
          window.Engine.explosiveBarrels.forEach(b => {
            if (b.mesh === hit.object || b.mesh === hit.object.parent) {
              b.takeDamage(wep.damage);
              isBarrel = true;
            }
          });
        }

        // Wall / Floor dust & spark impact
        if (!isBarrel && window.Engine && window.Engine.spawnBulletImpact) {
          const normal = hit.face ? hit.face.normal.clone().applyQuaternion(hit.object.quaternion) : new THREE.Vector3(0, 1, 0);
          window.Engine.spawnBulletImpact(hit.point, normal, false);
        }
      }
    } else {
      // Bullet traveled into open air
      endPoint = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(150));
    }

    // Spawn Tracer
    spawnTracer(weaponMeshes[currentWeaponIndex].muzzlePos, endPoint);
  }

  // ============================================================
  // BULLET TRACER VISUALS
  // ============================================================
  function spawnTracer(muzzleLocalPos, targetWorldPos) {
    const currentMeshObj = weaponMeshes[currentWeaponIndex];
    if (!currentMeshObj) return;

    // Convert local muzzle position to world space
    const startWorldPos = muzzleLocalPos.clone();
    currentMeshObj.group.localToWorld(startWorldPos);

    const dir = targetWorldPos.clone().sub(startWorldPos);
    const distance = dir.length();

    // Glowing yellow/orange tracer beam
    const tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, Math.min(distance, 4.0), 6);
    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffcc33,
      transparent: true,
      opacity: 0.95
    });

    const tracer = new THREE.Mesh(tracerGeo, tracerMat);
    tracer.position.copy(startWorldPos);
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    scene.add(tracer);

    activeTracers.push({
      mesh: tracer,
      startPos: startWorldPos,
      endPos: targetWorldPos,
      progress: 0,
      speed: 180 // m/s
    });
  }

  function updateTracers(dt) {
    for (let i = activeTracers.length - 1; i >= 0; i--) {
      const tr = activeTracers[i];
      tr.progress += (tr.speed * dt) / tr.startPos.distanceTo(tr.endPos);

      if (tr.progress >= 1.0) {
        scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mesh.material.dispose();
        activeTracers.splice(i, 1);
      } else {
        tr.mesh.position.lerpVectors(tr.startPos, tr.endPos, tr.progress);
      }
    }
  }

  // ============================================================
  // RELOAD & WEAPON SWITCHING
  // ============================================================
  function reload() {
    const currentWep = WEAPON_CONFIGS[currentWeaponIndex];
    if (isReloading) return;
    if (currentWep.currentClip >= currentWep.clipSize) return;
    if (currentWep.reserveAmmo <= 0) return;

    isReloading = true;
    reloadTimer = 0;
    reloadDuration = currentWep.reloadTime;

    if (window.Engine && window.Engine.Audio) {
      window.Engine.Audio.playReloadSound();
    }

    if (window.UI) {
      window.UI.startReload();
    }
  }

  function switchWeapon(indexOrNext) {
    if (isReloading) {
      isReloading = false;
      reloadTimer = 0;
      if (window.UI) window.UI.finishReload();
    }

    if (typeof indexOrNext === 'number') {
      currentWeaponIndex = (indexOrNext % WEAPON_CONFIGS.length + WEAPON_CONFIGS.length) % WEAPON_CONFIGS.length;
    } else {
      currentWeaponIndex = (currentWeaponIndex + 1) % WEAPON_CONFIGS.length;
    }

    // Toggle active viewmodel visibility
    weaponMeshes.forEach((w, idx) => {
      w.group.visible = (idx === currentWeaponIndex);
    });

    const newWep = WEAPON_CONFIGS[currentWeaponIndex];
    if (window.UI) {
      window.UI.updateWeapon(newWep.name, newWep.fireMode);
      window.UI.updateAmmo(newWep.currentClip, newWep.clipSize, newWep.reserveAmmo);
    }

    if (window.Engine && window.Engine.Audio) {
      window.Engine.Audio.playReloadSound();
    }
  }

  function playHitmarker(isHeadshot) {
    if (window.Engine && window.Engine.Audio) {
      window.Engine.Audio.playHitmarker(isHeadshot);
    }
  }

  function getAmmoInfo() {
    const wep = WEAPON_CONFIGS[currentWeaponIndex];
    return {
      name: wep.name,
      currentClip: wep.currentClip,
      maxClip: wep.clipSize,
      reserveAmmo: wep.reserveAmmo,
      fireMode: wep.fireMode,
      isReloading,
      reloadProgress: isReloading ? (reloadTimer / reloadDuration) : 0
    };
  }

  return {
    init,
    update,
    fire,
    reload,
    switchWeapon,
    playHitmarker,
    getAmmoInfo,
    applyMouseSway,
    get isADS() { return isADSActive; },
    get currentWeapon() { return WEAPON_CONFIGS[currentWeaponIndex]; }
  };
})();
