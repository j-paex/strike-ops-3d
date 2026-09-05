/**
 * Strike Ops 3D - User Interface & HUD Module
 * Call of Duty Modern Warfare inspired tactical HUD:
 * dynamic minimap radar, crosshair blooming, 4-diagonal hitmarkers,
 * killfeed, score popups, wave banners, and damage directional arcs.
 */

window.UI = (function() {
  'use strict';

  // DOM Elements cache
  let healthFill, healthValue;
  let clipAmmo, reserveAmmo, weaponName, reloadIndicator, reloadProgress;
  let crosshairContainer, hitmarkerEl, hitmarkerSkull;
  let damageVignette, damageIndicators;
  let killfeedContainer, scoreFeedContainer;
  let waveBanner, waveTitle, waveSubtitle;
  let killstreakBanner, killstreakText;
  let minimapCanvas, minimapCtx;
  let deployModal, gameOverModal;

  let radarSweepAngle = 0;

  function init() {
    healthFill = document.getElementById('health-fill');
    healthValue = document.getElementById('health-value');
    clipAmmo = document.getElementById('clip-ammo');
    reserveAmmo = document.getElementById('reserve-ammo');
    weaponName = document.getElementById('weapon-name');
    reloadIndicator = document.getElementById('reload-indicator');
    reloadProgress = document.getElementById('reload-progress');

    crosshairContainer = document.getElementById('crosshair-container');
    hitmarkerEl = document.getElementById('hitmarker');
    hitmarkerSkull = document.getElementById('hitmarker-skull');

    damageVignette = document.getElementById('damage-vignette');
    damageIndicators = document.getElementById('damage-indicators');

    killfeedContainer = document.getElementById('killfeed-container');
    scoreFeedContainer = document.getElementById('score-feed-container');

    waveBanner = document.getElementById('wave-banner');
    waveTitle = document.getElementById('wave-title');
    waveSubtitle = document.getElementById('wave-subtitle');

    killstreakBanner = document.getElementById('killstreak-banner');
    killstreakText = document.getElementById('killstreak-text');

    minimapCanvas = document.getElementById('minimap-canvas');
    if (minimapCanvas) {
      minimapCtx = minimapCanvas.getContext('2d');
    }

    deployModal = document.getElementById('deploy-modal');
    gameOverModal = document.getElementById('game-over-modal');

    setupModals();
  }

  function setupModals() {
    const deployBtn = document.getElementById('btn-deploy');
    if (deployBtn) {
      deployBtn.addEventListener('click', () => {
        if (deployModal) deployModal.classList.add('hidden');
        if (window.Engine && window.Engine.Audio && window.Engine.Audio.init) {
          window.Engine.Audio.init();
        }
        if (window.Game && window.Game.start) {
          window.Game.start();
        }
      });
    }

    const respawnBtn = document.getElementById('btn-respawn');
    if (respawnBtn) {
      respawnBtn.addEventListener('click', () => {
        if (gameOverModal) gameOverModal.classList.add('hidden');
        if (window.Game && window.Game.restart) {
          window.Game.restart();
        }
      });
    }
  }

  function updateHealth(hp, maxHp) {
    if (!healthFill) return;
    const ratio = Math.max(0, Math.min(1.0, hp / maxHp));
    healthFill.style.width = `${ratio * 100}%`;
    if (healthValue) healthValue.textContent = Math.ceil(hp);

    if (ratio <= 0.3) {
      healthFill.classList.add('low');
      if (damageVignette) damageVignette.classList.add('pulsing');
    } else {
      healthFill.classList.remove('low');
      if (damageVignette) damageVignette.classList.remove('pulsing');
    }
  }

  function updateAmmo(currentClip, maxClip, reserve) {
    if (clipAmmo) {
      clipAmmo.textContent = currentClip;
      if (currentClip <= Math.ceil(maxClip * 0.25)) {
        clipAmmo.classList.add('low');
      } else {
        clipAmmo.classList.remove('low');
      }
    }
    if (reserveAmmo) reserveAmmo.textContent = reserve;
  }

  function updateWeapon(name, mode) {
    if (weaponName) weaponName.textContent = name;
  }

  function startReload(durationSec) {
    if (reloadIndicator) {
      reloadIndicator.classList.add('active');
    }
    if (reloadProgress) {
      reloadProgress.style.transition = `width ${durationSec}s linear`;
      reloadProgress.style.width = '100%';
    }
  }

  function finishReload() {
    if (reloadIndicator) {
      reloadIndicator.classList.remove('active');
    }
    if (reloadProgress) {
      reloadProgress.style.transition = 'none';
      reloadProgress.style.width = '0%';
    }
  }

  function showHitmarker(isHeadshot) {
    if (!hitmarkerEl) return;

    hitmarkerEl.classList.remove('active', 'headshot');
    // Force DOM reflow
    void hitmarkerEl.offsetWidth;

    hitmarkerEl.classList.add('active');
    if (isHeadshot) {
      hitmarkerEl.classList.add('headshot');
    }

    setTimeout(() => {
      if (hitmarkerEl) hitmarkerEl.classList.remove('active', 'headshot');
    }, 160);
  }

  function showDamageVignette(healthRatio) {
    if (!damageVignette) return;
    const opacity = Math.min(0.9, (1.0 - healthRatio) * 0.85 + 0.2);
    damageVignette.style.opacity = `${opacity}`;
    setTimeout(() => {
      if (damageVignette && !damageVignette.classList.contains('pulsing')) {
        damageVignette.style.opacity = '0';
      }
    }, 220);
  }

  function showDamageIndicator(angleDegrees) {
    if (!damageIndicators) return;

    const arc = document.createElement('div');
    arc.className = 'damage-arc';
    arc.style.transform = `translate(-50%, -50%) rotate(${angleDegrees}deg)`;
    damageIndicators.appendChild(arc);

    setTimeout(() => {
      arc.style.opacity = '0';
      setTimeout(() => arc.remove(), 400);
    }, 300);
  }

  function addKillfeedEntry(killer, victim, weaponName, isHeadshot) {
    if (!killfeedContainer) return;

    const row = document.createElement('div');
    row.className = 'killfeed-row';
    row.innerHTML = `
      <span class="killer">${killer}</span>
      <span class="weapon-tag">[${weaponName}${isHeadshot ? ' ★' : ''}]</span>
      <span class="victim">${victim}</span>
    `;

    killfeedContainer.appendChild(row);
    setTimeout(() => {
      row.style.opacity = '0';
      row.style.transform = 'translateX(20px)';
      setTimeout(() => row.remove(), 350);
    }, 4500);
  }

  function addScorePopup(points, reason) {
    if (!scoreFeedContainer) return;

    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.innerHTML = `<span class="score-num">+${points}</span> <span class="score-desc">${reason}</span>`;

    scoreFeedContainer.appendChild(popup);
    setTimeout(() => {
      popup.style.opacity = '0';
      popup.style.transform = 'translateY(-20px)';
      setTimeout(() => popup.remove(), 400);
    }, 1600);
  }

  function showWaveBanner(title, subtitle) {
    if (!waveBanner) return;
    if (waveTitle) waveTitle.textContent = title;
    if (waveSubtitle) waveSubtitle.textContent = subtitle;

    waveBanner.style.opacity = '1';
    waveBanner.style.transform = 'translate(-50%, -50%) scale(1)';

    setTimeout(() => {
      if (waveBanner) {
        waveBanner.style.opacity = '0';
        waveBanner.style.transform = 'translate(-50%, -50%) scale(0.9)';
      }
    }, 3200);
  }

  function showKillstreakBanner(text) {
    if (!killstreakBanner) return;
    if (killstreakText) killstreakText.textContent = text;

    killstreakBanner.classList.add('active');
    setTimeout(() => {
      if (killstreakBanner) killstreakBanner.classList.remove('active');
    }, 3500);
  }

  function setCrosshairADS(isADS) {
    if (crosshairContainer) {
      crosshairContainer.classList.toggle('ads-hidden', isADS);
    }
  }

  function updateMinimap(playerPos, playerYaw, bots, delta) {
    if (!minimapCtx || !minimapCanvas) return;

    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const center = w / 2;
    const radarRadius = center - 8;
    const mapScale = 2.4; // World units to pixels

    minimapCtx.clearRect(0, 0, w, h);

    // Radar circular background
    minimapCtx.save();
    minimapCtx.beginPath();
    minimapCtx.arc(center, center, radarRadius, 0, Math.PI * 2);
    minimapCtx.fillStyle = 'rgba(10, 18, 25, 0.75)';
    minimapCtx.fill();
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeStyle = 'rgba(70, 140, 200, 0.6)';
    minimapCtx.stroke();
    minimapCtx.clip();

    // Concentric Range Rings
    minimapCtx.strokeStyle = 'rgba(60, 120, 180, 0.25)';
    minimapCtx.lineWidth = 1;
    for (let r = 25; r < radarRadius; r += 25) {
      minimapCtx.beginPath();
      minimapCtx.arc(center, center, r, 0, Math.PI * 2);
      minimapCtx.stroke();
    }

    // Rotating Radar Sweep Line
    radarSweepAngle += delta * 2.5;
    const sweepX = center + Math.cos(radarSweepAngle) * radarRadius;
    const sweepY = center + Math.sin(radarSweepAngle) * radarRadius;
    const grad = minimapCtx.createRadialGradient(center, center, 0, center, center, radarRadius);
    grad.addColorStop(0, 'rgba(0, 255, 200, 0)');
    grad.addColorStop(1, 'rgba(0, 255, 200, 0.15)');

    minimapCtx.fillStyle = grad;
    minimapCtx.beginPath();
    minimapCtx.moveTo(center, center);
    minimapCtx.arc(center, center, radarRadius, radarSweepAngle - 0.4, radarSweepAngle);
    minimapCtx.closePath();
    minimapCtx.fill();

    // Draw Enemy Blips (Red Dots)
    if (bots) {
      minimapCtx.fillStyle = '#ff3344';
      minimapCtx.shadowColor = '#ff2222';
      minimapCtx.shadowBlur = 6;

      for (const bot of bots) {
        if (bot.isDead) continue;
        const dx = (bot.position.x - playerPos.x) * mapScale;
        const dz = (bot.position.z - playerPos.z) * mapScale;

        // Rotate relative to player yaw
        const rx = dx * Math.cos(-playerYaw) - dz * Math.sin(-playerYaw);
        const ry = dx * Math.sin(-playerYaw) + dz * Math.cos(-playerYaw);

        const blipDist = Math.hypot(rx, ry);
        if (blipDist < radarRadius - 4) {
          minimapCtx.beginPath();
          minimapCtx.arc(center + rx, center + ry, 3.5, 0, Math.PI * 2);
          minimapCtx.fill();
        }
      }
      minimapCtx.shadowBlur = 0;
    }

    // Player indicator (Center White Chevron)
    minimapCtx.fillStyle = '#ffffff';
    minimapCtx.beginPath();
    minimapCtx.moveTo(center, center - 6);
    minimapCtx.lineTo(center + 4, center + 4);
    minimapCtx.lineTo(center, center + 2);
    minimapCtx.lineTo(center - 4, center + 4);
    minimapCtx.closePath();
    minimapCtx.fill();

    minimapCtx.restore();
  }

  function showGameOver(finalScore, finalKills, finalHeadshots) {
    if (!gameOverModal) return;
    const scoreEl = document.getElementById('game-over-score');
    const killsEl = document.getElementById('game-over-kills');
    const hsEl = document.getElementById('game-over-headshots');

    if (scoreEl) scoreEl.textContent = finalScore;
    if (killsEl) killsEl.textContent = finalKills;
    if (hsEl) hsEl.textContent = finalHeadshots;

    gameOverModal.classList.remove('hidden');
  }

  function hideGameOver() {
    if (gameOverModal) gameOverModal.classList.add('hidden');
  }

  return {
    init,
    updateHealth,
    updateAmmo,
    updateWeapon,
    startReload,
    finishReload,
    showHitmarker,
    showDamageVignette,
    showDamageIndicator,
    addKillfeedEntry,
    addScorePopup,
    showWaveBanner,
    showKillstreakBanner,
    setCrosshairADS,
    updateMinimap,
    showGameOver,
    hideGameOver
  };
})();
