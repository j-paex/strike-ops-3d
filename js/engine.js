/**
 * Strike Ops 3D - Visual Engine, Procedural Textures & Tactical Military Map
 * Standalone WebGL Tactical 3D Engine powered by Three.js (r128)
 * 
 * Features:
 * - High-end WebGLRenderer: antialias, PCFSoftShadowMap enabled, shadow map resolution 2048,
 *   ACESFilmicToneMapping, toneMappingExposure: 1.15.
 * - Atmospheric lighting: Directional sunlight casting shadows, ambient hemisphere light
 *   (sky blue / ground warm gray), warm warehouse interior point lights, industrial floodlights
 *   with soft volumetric flare/cone.
 * - Atmospheric haze/fog: THREE.FogExp2 for tactical depth.
 * - Floating airborne dust motes (1200 drifting particles) & warehouse skylight sunbeam shafts.
 * - 100% Procedural 512x512 canvas textures (Zero external asset dependencies):
 *   - Weathered tactical concrete (scratches, grunge, noise, slab seams, cracks).
 *   - Rusted painted metal for shipping containers (scratches, rivets, rust bleed, "PMC-409" stencils,
 *     olive green, desert tan, navy blue, industrial red).
 *   - Corrugated warehouse sheet metal panels (sinusoidal ribs, zinc spangles, hex screws).
 *   - Asphalt floor with tactical yellow/white hazard lines, aggregate gravel, oil stains.
 *   - Wooden military equipment crates ("US ARMAMENT", "FRAGILE", corner brackets).
 *   - Explosive red hazard barrels with warning symbols (flame icon, hazard chevrons, UN codes).
 *   - Sandbags (coarse burlap crosshatch weave, seam stitching).
 * - Tactical Military Compound Map Layout:
 *   - High perimeter boundary walls with razor wire detailing, buttresses, and barricaded gates.
 *   - Stacking shipping containers forming choke points, corridors, and sniper perches with access ramps.
 *   - Central two-story warehouse/hangar with open doorways, interior catwalk, and skylight window beams.
 *   - Sandbag fortifications, concrete Jersey barriers, guard towers with ladders & floodlights.
 *   - Multiple explosive barrels placed tactically around the map.
 * - Collision & Physics System:
 *   - Static collision bounding boxes (AABBs): `colliders = []` (with mesh references for raycasting).
 *   - `checkCollision(position, radius, height)` returning collision response / pushback vector
 *     for smooth wall sliding and walkable top surface clearance.
 *   - `getFloorHeight(x, z, currentY, stepHeight)` supporting ground, crates, container roofs, catwalks, and ramps.
 *   - Fast raycast hit detection with face normals.
 *   - Interactive explosive barrels with health (explode when shot, damaging nearby enemies & chain reactions).
 * - Full VFX & Audio:
 *   - Particle fire, ground shockwave, shrapnel sparks, billowing dark smoke, flash point light.
 *   - Camera screen shake with distance falloff.
 *   - Bullet impact particles (dust, sparks, blood).
 *   - Built-in Procedural Web Audio synthesizer (gunshots, reload, hitmarker, explosions).
 * - Clean Module API:
 *   - Exported as `window.Engine` and CommonJS / ES module compatible.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Engine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Helper: Retrieve Three.js instance
  const getTHREE = () => {
    if (typeof THREE !== 'undefined') return THREE;
    if (typeof window !== 'undefined' && window.THREE) return window.THREE;
    return null;
  };

  // =========================================================================
  // SECTION 1: PROCEDURAL TEXTURE GENERATOR (Zero External Asset Dependencies)
  // =========================================================================

  const TextureGenerator = {
    cache: {},

    createCanvas(width, height) {
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },

    // Apply high-frequency noise & grunge grain
    applyNoise(ctx, width, height, density = 0.5, opacity = 0.15, monochrome = true) {
      try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const step = Math.max(1, Math.floor(1 / density));
        for (let i = 0; i < data.length; i += 4 * step) {
          const val = (Math.random() - 0.5) * opacity * 255;
          data[i] = Math.min(255, Math.max(0, data[i] + val));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + (monochrome ? val : (Math.random() - 0.5) * opacity * 255)));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + (monochrome ? val : (Math.random() - 0.5) * opacity * 255)));
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (e) {
        // Fallback for sandboxed or mock contexts
      }
    },

    // Military Stencil Typography with spray-bleed bridge cuts
    drawStencilText(ctx, text, x, y, font, color, tracking = 2) {
      ctx.save();
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      let currentX = x;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        ctx.fillText(char, currentX, y);
        let charW = 18;
        try {
          charW = ctx.measureText(char).width;
        } catch (e) {}

        // Cut horizontal bridge gaps for authentic military stencil look
        if ('048ABDPQROP'.indexOf(char) !== -1) {
          ctx.clearRect(currentX + charW * 0.35, y - 14, Math.max(2, charW * 0.25), 28);
        }
        currentX += charW + tracking;
      }
      ctx.restore();
    },

    // 1. Weathered Tactical Concrete Texture (512x512)
    createConcreteTexture() {
      if (this.cache['concrete']) return this.cache['concrete'];
      const THREE = getTHREE();
      if (!THREE || typeof document === 'undefined') return null;

      const size = 512;
      const canvas = this.createCanvas(size, size);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');

      // Base weathered concrete slate-gray
      ctx.fillStyle = '#787c80';
      ctx.fillRect(0, 0, size, size);

      // Mottled grunge patches and damp stains
      for (let i = 0; i < 65; i++) {
        const cx = Math.random() * size;
        const cy = Math.random() * size;
        const r = 25 + Math.random() * 85;
        const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
        const isDark = Math.random() > 0.45;
        grad.addColorStop(0, isDark ? 'rgba(52, 56, 60, 0.28)' : 'rgba(155, 160, 165, 0.22)');
        grad.addColorStop(1, 'rgba(120, 124, 128, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Concrete expansion joint seams (2x2 grid)
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#27292c';
      ctx.beginPath();
      ctx.moveTo(256, 0); ctx.lineTo(256, size);
      ctx.moveTo(0, 256); ctx.lineTo(size, 256);
      ctx.stroke();

      // Expansion joint bevel highlight
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#9ca0a4';
      ctx.beginPath();
      ctx.moveTo(258, 0); ctx.lineTo(258, size);
      ctx.moveTo(0, 258); ctx.lineTo(size, 258);
      ctx.stroke();

      // Jagged structural cracks
      ctx.lineWidth = 1.5;
      for (let c = 0; c < 3; c++) {
        let px = 50 + Math.random() * 400;
        let py = 50 + Math.random() * 400;
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let s = 0; s < 10; s++) {
          px += (Math.random() - 0.5) * 45;
          py += (Math.random() - 0.45) * 45;
          ctx.lineTo(px, py);
        }
        ctx.strokeStyle = 'rgba(30, 32, 35, 0.85)';
        ctx.stroke();

        // Sunlit rim highlight on crack
        ctx.strokeStyle = 'rgba(180, 185, 190, 0.35)';
        ctx.stroke();
      }

      // Aggregate rock speckles
      this.applyNoise(ctx, size, size, 0.8, 0.22, true);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      this.cache['concrete'] = texture;
      return texture;
    },

    // 2. Shipping Container Painted Metal Texture (512x512)
    // Supports military themes: 'olive', 'tan', 'blue', 'red'
    createContainerTexture(theme = 'olive', stencilCode = 'PMC-409') {
      const cacheKey = `container_${theme}_${stencilCode}`;
      if (this.cache[cacheKey]) return this.cache[cacheKey];
      const THREE = getTHREE();
      if (!THREE || typeof document === 'undefined') return null;

      const size = 512;
      const canvas = this.createCanvas(size, size);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');

      const palettes = {
        olive: { base: '#3b4632', shadow: '#1f261a', light: '#506043', rust: '#6b361a' },
        tan:   { base: '#99835d', shadow: '#5e4e35', light: '#b59c70', rust: '#6b3519' },
        blue:  { base: '#2b3f56', shadow: '#162230', light: '#3f5d7d', rust: '#703618' },
        red:   { base: '#702b24', shadow: '#421813', light: '#8c372e', rust: '#542713' }
      };
      const p = palettes[theme] || palettes.olive;

      // Base coat
      ctx.fillStyle = p.base;
      ctx.fillRect(0, 0, size, size);

      // Corrugated vertical sheet metal ribs (16 ribs = 32px pitch)
      const ribPitch = 32;
      for (let x = 0; x < size; x += ribPitch) {
        // Recessed groove shadow
        const shadowGrad = ctx.createLinearGradient(x, 0, x + ribPitch * 0.4, 0);
        shadowGrad.addColorStop(0, p.shadow);
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(x, 0, ribPitch * 0.4, size);

        // Raised ridge specular highlight
        const lightGrad = ctx.createLinearGradient(x + ribPitch * 0.4, 0, x + ribPitch, 0);
        lightGrad.addColorStop(0, 'rgba(255,255,255,0.02)');
        lightGrad.addColorStop(0.7, p.light);
        lightGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = lightGrad;
        ctx.fillRect(x + ribPitch * 0.4, 0, ribPitch * 0.6, size);
      }

      // Top and Bottom Heavy Structural Steel Beams
      const beamHeight = 32;
      ctx.fillStyle = p.shadow;
      ctx.fillRect(0, 0, size, beamHeight);
      ctx.fillRect(0, size - beamHeight, size, beamHeight);

      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, beamHeight - 2, size, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, size - beamHeight, size, 2);

      // Rivet rows along top and bottom structural beams
      for (let x = ribPitch / 2; x < size; x += ribPitch) {
        // Top Rivet
        ctx.beginPath();
        ctx.arc(x, beamHeight / 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#111417';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - 1, beamHeight / 2 - 1, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#9eabb8';
        ctx.fill();

        // Bottom Rivet
        ctx.beginPath();
        ctx.arc(x, size - beamHeight / 2, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#111417';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - 1, size - beamHeight / 2 - 1, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#9eabb8';
        ctx.fill();

        // Downward vertical rust drip from rivets
        if (Math.random() > 0.4) {
          const rustH = 25 + Math.random() * 85;
          const rustGrad = ctx.createLinearGradient(x, beamHeight, x, beamHeight + rustH);
          rustGrad.addColorStop(0, 'rgba(110, 50, 20, 0.7)');
          rustGrad.addColorStop(1, 'rgba(110, 50, 20, 0)');
          ctx.fillStyle = rustGrad;
          ctx.fillRect(x - 2, beamHeight, 4, rustH);
        }
      }

      // Scratches & Exposed Bare Metal Scrapes
      ctx.lineWidth = 1;
      for (let s = 0; s < 15; s++) {
        const sx = Math.random() * size;
        const sy = 40 + Math.random() * (size - 80);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (Math.random() - 0.5) * 55, sy + (Math.random() - 0.5) * 15);
        ctx.strokeStyle = 'rgba(215, 222, 230, 0.75)';
        ctx.stroke();
      }

      // Military Stencil Typography ("PMC-409", cargo weights, hazard squares)
      this.drawStencilText(ctx, stencilCode, 38, 140, 'bold 36px monospace', 'rgba(235, 240, 245, 0.9)');
      this.drawStencilText(ctx, 'MAX GROSS  30480 KG', 38, 190, 'bold 15px monospace', 'rgba(220, 228, 235, 0.75)');
      this.drawStencilText(ctx, 'TARE WT     2200 KG', 38, 212, 'bold 15px monospace', 'rgba(220, 228, 235, 0.75)');
      this.drawStencilText(ctx, 'TACTICAL FREIGHT // SEC-4', 38, 234, 'bold 15px monospace', 'rgba(220, 228, 235, 0.75)');

      // Hazard Warning Placard Box (Lower Right)
      ctx.strokeStyle = 'rgba(220, 180, 40, 0.85)';
      ctx.lineWidth = 3;
      ctx.strokeRect(360, 360, 110, 100);
      ctx.fillStyle = 'rgba(200, 150, 20, 0.2)';
      ctx.fillRect(362, 362, 106, 96);
      this.drawStencilText(ctx, 'CLASS 1', 375, 400, 'bold 16px monospace', '#f0c030');
      this.drawStencilText(ctx, 'EXPLOSIVE', 368, 425, 'bold 13px monospace', '#f0c030');

      // Fine metallic grain
      this.applyNoise(ctx, size, size, 0.7, 0.18, false);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      this.cache[cacheKey] = texture;
      return texture;
    },

    // 3. Corrugated Warehouse Sheet Metal Panels (512x512)
    createCorrugatedSheetTexture() {
      if (this.cache['corrugated']) return this.cache['corrugated'];
      const THREE = getTHREE();
      if (!THREE || typeof document === 'undefined') return null;

      const size = 512;
      const canvas = this.createCanvas(size, size);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');

      // Galvanized steel base tone
      ctx.fillStyle = '#6b7177';
      ctx.fillRect(0, 0, size, size);

      // Sinusoidal corrugated ridges (pitch = 24px)
      const pitch = 24;
      for (let x = 0; x < size; x += pitch) {
        const grad = ctx.createLinearGradient(x, 0, x + pitch, 0);
        grad.addColorStop(0, '#3e4348');      // Trough shadow
        grad.addColorStop(0.35, '#828991');   // Slope highlight
        grad.addColorStop(0.65, '#9aa2ab');   // Apex specular
        grad.addColorStop(1, '#43494e');      // Trailing shadow
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, pitch, size);
      }

      // Horizontal purlin support lines & hex fastener screws
      const purlinYs = [80, 210, 340, 470];
      for (const py of purlinYs) {
        ctx.fillStyle = 'rgba(30, 35, 40, 0.6)';
        ctx.fillRect(0, py - 4, size, 8);

        // Fastener screws
        for (let x = pitch / 2; x < size; x += pitch * 2) {
          ctx.beginPath();
          ctx.arc(x, py, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#22262a';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x - 1, py - 1, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = '#ccd5df';
          ctx.fill();
        }
      }

      // Zinc spangle crystalline flecks & oxidation
      this.applyNoise(ctx, size, size, 0.9, 0.25, true);

      // Rainwater weathering trails
      for (let i = 0; i < 8; i++) {
        const ox = Math.random() * size;
        const oGrad = ctx.createLinearGradient(ox, 0, ox, size);
        oGrad.addColorStop(0, 'rgba(40, 48, 56, 0.4)');
        oGrad.addColorStop(0.7, 'rgba(50, 42, 35, 0.3)');
        oGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = oGrad;
        ctx.fillRect(ox - 3, 0, 6, size);
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      this.cache['corrugated'] = texture;
      return texture;
    },

    // 4. Asphalt Floor with Tactical Hazard Lines (512x512)
    createAsphaltTexture() {
      if (this.cache['asphalt']) return this.cache['asphalt'];
      const THREE = getTHREE();
      if (!THREE || typeof document === 'undefined') return null;

      const size = 512;
      const canvas = this.createCanvas(size, size);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');

      // Heavy dark aggregate asphalt
      ctx.fillStyle = '#232528';
      ctx.fillRect(0, 0, size, size);

      // Crushed basalt rock speckles
      this.applyNoise(ctx, size, size, 0.95, 0.35, true);

      // Tactical Yellow & Black Hazard Stripes
      const stripeH = 70;
      const stripeY = 220;
      ctx.fillStyle = 'rgba(215, 170, 30, 0.92)'; // Hazard yellow
      ctx.fillRect(0, stripeY, size, stripeH);

      // Diagonal black hash stripes (45 degrees)
      ctx.fillStyle = '#1c1e20';
      const stripeW = 40;
      for (let x = -stripeH; x < size + stripeH; x += stripeW * 2) {
        ctx.beginPath();
        ctx.moveTo(x, stripeY);
        ctx.lineTo(x + stripeW, stripeY);
        ctx.lineTo(x + stripeW + stripeH, stripeY + stripeH);
        ctx.lineTo(x + stripeH, stripeY + stripeH);
        ctx.closePath();
        ctx.fill();
      }

      // Tire skid marks & heavy oil spots
      ctx.fillStyle = 'rgba(15, 16, 18, 0.75)';
      ctx.beginPath();
      ctx.ellipse(180, 120, 90, 25, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(340, 390, 110, 35, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Hairline bitumen tar cracks
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#111214';
      ctx.beginPath();
      ctx.moveTo(40, 30);
      ctx.lineTo(120, 150); ctx.lineTo(190, 165); ctx.lineTo(260, 210);
      ctx.stroke();

      // Stenciled ground text
      this.drawStencilText(ctx, 'KEEP CLEAR // STAGING AREA', 60, 340, 'bold 22px monospace', 'rgba(230, 235, 240, 0.8)');

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      this.cache['asphalt'] = texture;
      return texture;
    },

    // 5. Wooden Military Equipment Crates (512x512)
    createWoodCrateTexture() {
      if (this.cache['woodCrate']) return this.cache['woodCrate'];
      const THREE = getTHREE();
      if (!THREE || typeof document === 'undefined') return null;

      const size = 512;
      const canvas = this.createCanvas(size, size);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');

      // Weathered pine wood
      ctx.fillStyle = '#7a6042';
      ctx.fillRect(0, 0, size, size);

      // Horizontal wood planks
      const plankH = size / 5;
      for (let i = 0; i < 5; i++) {
        const y = i * plankH;
        for (let g = 0; g < 18; g++) {
          const gy = y + Math.random() * plankH;
          ctx.fillStyle = (Math.random() > 0.5) ? 'rgba(95, 72, 48, 0.35)' : 'rgba(145, 118, 85, 0.25)';
          ctx.fillRect(0, gy, size, 2 + Math.random() * 4);
        }
        ctx.fillStyle = '#2b1e11';
        ctx.fillRect(0, y - 2, size, 4);
      }

      // Outer Structural Reinforcing Frame (48px)
      const borderW = 48;
      ctx.fillStyle = '#6e5437';
      ctx.fillRect(0, 0, size, borderW);
      ctx.fillRect(0, size - borderW, size, borderW);
      ctx.fillRect(0, 0, borderW, size);
      ctx.fillRect(size - borderW, 0, borderW, size);

      // Diagonal Cross-Brace Plank
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(borderW, borderW);
      ctx.lineTo(borderW + 45, borderW);
      ctx.lineTo(size - borderW, size - borderW - 45);
      ctx.lineTo(size - borderW, size - borderW);
      ctx.lineTo(size - borderW - 45, size - borderW);
      ctx.lineTo(borderW, borderW + 45);
      ctx.closePath();
      ctx.fillStyle = '#654c30';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2d1e0f';
      ctx.stroke();
      ctx.restore();

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2b1e11';
      ctx.strokeRect(borderW, borderW, size - borderW * 2, size - borderW * 2);

      // Metal Corner Reinforcement Brackets
      const bracketSize = 80;
      const drawBracket = (bx, by, flipX, flipY) => {
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(flipX, flipY);
        ctx.fillStyle = '#26292c';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(bracketSize, 0); ctx.lineTo(bracketSize, 24);
        ctx.lineTo(24, 24); ctx.lineTo(24, bracketSize); ctx.lineTo(0, bracketSize);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#4a5056';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const screwPos = [[12, 12], [bracketSize - 14, 12], [12, bracketSize - 14]];
        for (const [sx, sy] of screwPos) {
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#111315';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx - 1, sy - 1, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = '#c5ccd4';
          ctx.fill();
        }
        ctx.restore();
      };

      drawBracket(0, 0, 1, 1);
      drawBracket(size, 0, -1, 1);
      drawBracket(0, size, 1, -1);
      drawBracket(size, size, -1, -1);

      // Stencils: "US ARMAMENT", "FRAGILE", "ORDNANCE DIV"
      this.drawStencilText(ctx, 'US ARMAMENT', 110, 180, 'bold 32px monospace', 'rgba(25, 20, 15, 0.92)');
      this.drawStencilText(ctx, 'ORDNANCE DIV // 7.62mm NATO', 110, 220, 'bold 15px monospace', 'rgba(25, 20, 15, 0.85)');
      this.drawStencilText(ctx, 'FRAGILE', 110, 310, 'bold 28px monospace', 'rgba(160, 30, 25, 0.9)');
      this.drawStencilText(ctx, '▲▲ THIS END UP ▲▲', 110, 345, 'bold 15px monospace', 'rgba(25, 20, 15, 0.85)');
      this.drawStencilText(ctx, 'LOT #884-B // CLASS 1.4', 110, 375, 'bold 14px monospace', 'rgba(25, 20, 15, 0.8)');

      this.applyNoise(ctx, size, size, 0.6, 0.2, true);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      this.cache['woodCrate'] = texture;
      return texture;
    },

    // 6. Explosive Red Hazard Barrels (512x512)
    createHazardBarrelTexture() {
      if (this.cache['hazardBarrel']) return this.cache['hazardBarrel'];
      const THREE = getTHREE();
      if (!THREE || typeof document === 'undefined') return null;

      const size = 512;
      const canvas = this.createCanvas(size, size);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');

      // Crimson Red Barrel Body
      ctx.fillStyle = '#ba1e14';
      ctx.fillRect(0, 0, size, size);

      // Barrel reinforcement horizontal chime rings
      const rings = [120, 360];
      for (const ry of rings) {
        const ringGrad = ctx.createLinearGradient(0, ry - 18, 0, ry + 18);
        ringGrad.addColorStop(0, '#590a05');
        ringGrad.addColorStop(0.3, '#f54336'); // highlight
        ringGrad.addColorStop(0.7, '#ba1e14');
        ringGrad.addColorStop(1, '#3d0502');
        ctx.fillStyle = ringGrad;
        ctx.fillRect(0, ry - 18, size, 36);
      }

      // Top and Bottom Chime Metal Rims
      ctx.fillStyle = '#26292c';
      ctx.fillRect(0, 0, size, 22);
      ctx.fillRect(0, size - 22, size, 22);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(0, 20, size, 2);
      ctx.fillRect(0, size - 22, size, 2);

      // Center Yellow/Black Hazard Stripe Band
      const bandY = 210;
      const bandH = 80;
      ctx.fillStyle = '#e8b817';
      ctx.fillRect(0, bandY, size, bandH);

      ctx.fillStyle = '#1c1e21';
      const stripeW = 45;
      for (let x = -bandH; x < size + bandH; x += stripeW * 2) {
        ctx.beginPath();
        ctx.moveTo(x, bandY);
        ctx.lineTo(x + stripeW, bandY);
        ctx.lineTo(x + stripeW + bandH, bandY + bandH);
        ctx.lineTo(x + bandH, bandY + bandH);
        ctx.closePath();
        ctx.fill();
      }

      // Flammable Hazard Warning Diamond
      ctx.fillStyle = '#f8f9fa';
      ctx.beginPath();
      const dx = 256, dy = 160, dr = 32;
      ctx.moveTo(dx, dy - dr);
      ctx.lineTo(dx + dr, dy);
      ctx.lineTo(dx, dy + dr);
      ctx.lineTo(dx - dr, dy);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#18191a';
      ctx.stroke();

      // Flame Icon Silhouette
      ctx.fillStyle = '#ba1e14';
      ctx.beginPath();
      ctx.moveTo(dx, dy - 20);
      ctx.bezierCurveTo(dx + 15, dy - 5, dx + 15, dy + 15, dx, dy + 18);
      ctx.bezierCurveTo(dx - 15, dy + 15, dx - 15, dy - 5, dx, dy - 20);
      ctx.fill();

      // Warning Stencil Text
      this.drawStencilText(ctx, 'FLAMMABLE', 180, 325, 'bold 24px monospace', '#ffffff');
      this.drawStencilText(ctx, 'EXPLOSIVE HAZARD', 170, 345, 'bold 15px monospace', '#ffd438');
      this.drawStencilText(ctx, 'CLASS 3  UN-1203', 190, 420, 'bold 16px monospace', '#ffffff');

      // Chipped paint spots
      for (let i = 0; i < 16; i++) {
        const cx = Math.random() * size;
        const cy = Math.random() * size;
        ctx.beginPath();
        ctx.arc(cx, cy, 3 + Math.random() * 8, 0, Math.PI * 2);
        ctx.fillStyle = '#26282b';
        ctx.fill();
      }

      this.applyNoise(ctx, size, size, 0.7, 0.22, true);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      this.cache['hazardBarrel'] = texture;
      return texture;
    },

    // 7. Sandbag Coarse Burlap Fabric Texture (512x512)
    createSandbagTexture() {
      if (this.cache['sandbag']) return this.cache['sandbag'];
      const THREE = getTHREE();
      if (!THREE || typeof document === 'undefined') return null;

      const size = 512;
      const canvas = this.createCanvas(size, size);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#8f7b58';
      ctx.fillRect(0, 0, size, size);

      // Crosshatch burlap weave
      ctx.lineWidth = 1;
      for (let x = 0; x < size; x += 4) {
        ctx.strokeStyle = (x % 8 === 0) ? 'rgba(75, 62, 42, 0.45)' : 'rgba(180, 160, 125, 0.35)';
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, size);
        ctx.stroke();
      }
      for (let y = 0; y < size; y += 4) {
        ctx.strokeStyle = (y % 8 === 0) ? 'rgba(75, 62, 42, 0.45)' : 'rgba(180, 160, 125, 0.35)';
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(size, y);
        ctx.stroke();
      }

      // Seam stitch line
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#3d3020';
      ctx.beginPath();
      ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
      ctx.stroke();

      this.applyNoise(ctx, size, size, 0.8, 0.25, true);

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      this.cache['sandbag'] = texture;
      return texture;
    },

    // 8. Soft Particle Sprite Textures (128x128)
    createParticleTexture(type = 'fire') {
      const cacheKey = `particle_${type}`;
      if (this.cache[cacheKey]) return this.cache[cacheKey];
      const THREE = getTHREE();
      if (!THREE || typeof document === 'undefined') return null;

      const size = 128;
      const canvas = this.createCanvas(size, size);
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      const center = size / 2;

      if (type === 'fire') {
        const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
        grad.addColorStop(0, 'rgba(255, 240, 200, 1)');
        grad.addColorStop(0.2, 'rgba(255, 160, 30, 0.9)');
        grad.addColorStop(0.5, 'rgba(230, 60, 10, 0.6)');
        grad.addColorStop(0.8, 'rgba(100, 20, 5, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      } else if (type === 'smoke') {
        const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
        grad.addColorStop(0, 'rgba(80, 85, 90, 0.7)');
        grad.addColorStop(0.4, 'rgba(50, 55, 60, 0.5)');
        grad.addColorStop(0.7, 'rgba(30, 32, 35, 0.25)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      } else if (type === 'spark') {
        const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.15, 'rgba(255, 220, 120, 0.9)');
        grad.addColorStop(0.4, 'rgba(255, 120, 20, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      } else if (type === 'blood') {
        const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
        grad.addColorStop(0, 'rgba(180, 10, 10, 0.95)');
        grad.addColorStop(0.3, 'rgba(120, 5, 5, 0.85)');
        grad.addColorStop(0.7, 'rgba(60, 0, 0, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      } else if (type === 'dust') {
        const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
        grad.addColorStop(0, 'rgba(240, 230, 200, 0.8)');
        grad.addColorStop(0.5, 'rgba(200, 190, 170, 0.3)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      }

      const texture = new THREE.CanvasTexture(canvas);
      this.cache[cacheKey] = texture;
      return texture;
    }
  };

  // =========================================================================
  // SECTION 2: MATERIAL FACTORY (PBR Materials & Shader Settings)
  // =========================================================================

  const MaterialFactory = {
    materials: {},

    init() {
      const THREE = getTHREE();
      if (!THREE) return;

      // Concrete
      const concreteTex = TextureGenerator.createConcreteTexture();
      if (concreteTex) concreteTex.repeat.set(4, 4);
      this.materials.concrete = new THREE.MeshStandardMaterial({
        map: concreteTex,
        bumpMap: concreteTex,
        bumpScale: 0.04,
        roughness: 0.88,
        metalness: 0.12
      });

      // Perimeter Wall Concrete
      const wallTex = TextureGenerator.createConcreteTexture();
      if (wallTex) wallTex.repeat.set(12, 1.5);
      this.materials.perimeterWall = new THREE.MeshStandardMaterial({
        map: wallTex,
        bumpMap: wallTex,
        bumpScale: 0.05,
        roughness: 0.9,
        metalness: 0.1
      });

      // Asphalt Ground
      const asphaltTex = TextureGenerator.createAsphaltTexture();
      if (asphaltTex) asphaltTex.repeat.set(10, 10);
      this.materials.asphalt = new THREE.MeshStandardMaterial({
        map: asphaltTex,
        bumpMap: asphaltTex,
        bumpScale: 0.03,
        roughness: 0.92,
        metalness: 0.15
      });

      // Warehouse Corrugated Sheet Metal
      const corrugatedTex = TextureGenerator.createCorrugatedSheetTexture();
      if (corrugatedTex) corrugatedTex.repeat.set(6, 3);
      this.materials.corrugated = new THREE.MeshStandardMaterial({
        map: corrugatedTex,
        bumpMap: corrugatedTex,
        bumpScale: 0.06,
        roughness: 0.55,
        metalness: 0.45
      });

      // Shipping Containers (Olive, Tan, Blue, Red)
      ['olive', 'tan', 'blue', 'red'].forEach(theme => {
        const tex = TextureGenerator.createContainerTexture(theme, `PMC-${Math.floor(100 + Math.random() * 899)}`);
        this.materials[`container_${theme}`] = new THREE.MeshStandardMaterial({
          map: tex,
          bumpMap: tex,
          bumpScale: 0.05,
          roughness: 0.65,
          metalness: 0.35
        });
      });

      // Wooden Military Crates
      const crateTex = TextureGenerator.createWoodCrateTexture();
      this.materials.woodCrate = new THREE.MeshStandardMaterial({
        map: crateTex,
        bumpMap: crateTex,
        bumpScale: 0.05,
        roughness: 0.78,
        metalness: 0.2
      });

      // Explosive Hazard Barrels
      const barrelTex = TextureGenerator.createHazardBarrelTexture();
      this.materials.hazardBarrel = new THREE.MeshStandardMaterial({
        map: barrelTex,
        bumpMap: barrelTex,
        bumpScale: 0.04,
        roughness: 0.45,
        metalness: 0.4
      });

      // Sandbags
      const sandbagTex = TextureGenerator.createSandbagTexture();
      if (sandbagTex) sandbagTex.repeat.set(2, 1);
      this.materials.sandbag = new THREE.MeshStandardMaterial({
        map: sandbagTex,
        bumpMap: sandbagTex,
        bumpScale: 0.06,
        roughness: 0.95,
        metalness: 0.05
      });

      // Structural Steel / Catwalk Grating
      this.materials.steelStructure = new THREE.MeshStandardMaterial({
        color: 0x2e3338,
        roughness: 0.6,
        metalness: 0.75
      });

      this.materials.catwalkGrate = new THREE.MeshStandardMaterial({
        color: 0x22262a,
        roughness: 0.7,
        metalness: 0.8
      });

      // Yellow Industrial Safety Railing
      this.materials.yellowRailing = new THREE.MeshStandardMaterial({
        color: 0xdca818,
        roughness: 0.5,
        metalness: 0.35
      });

      // Translucent Skylight Glass
      this.materials.skylightGlass = new THREE.MeshStandardMaterial({
        color: 0x9ec7eb,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1
      });

      // Volumetric Sunbeam Shaft
      this.materials.sunbeam = new THREE.MeshBasicMaterial({
        color: 0xffeed4,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      // Volumetric Floodlight Cone
      this.materials.floodlightCone = new THREE.MeshBasicMaterial({
        color: 0xd8eeff,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
    }
  };

  // =========================================================================
  // SECTION 3: COLLISION & PHYSICS SYSTEM (AABBs + Smooth Wall Sliding)
  // =========================================================================

  const Physics = {
    colliders: [], // Array of { min, max, mesh, type, isWalkable, ramp, userData }

    init() {
      this.colliders = [];
    },

    registerCollider(box, metadata = {}) {
      const THREE = getTHREE();
      if (!THREE) return;

      const collider = {
        min: box.min.clone(),
        max: box.max.clone(),
        mesh: metadata.mesh || null,
        type: metadata.type || 'obstacle',
        isWalkable: metadata.isWalkable !== false,
        ramp: metadata.ramp || null,
        userData: metadata.userData || null
      };
      this.colliders.push(collider);
      return collider;
    },

    removeCollider(collider) {
      const index = this.colliders.indexOf(collider);
      if (index !== -1) {
        this.colliders.splice(index, 1);
        return true;
      }
      return false;
    },

    /**
     * checkCollision(position, radius, height)
     * Performs horizontal cylinder / capsule collision checks against all registered AABBs.
     * Computes pushback vector and applies it to position for buttery-smooth wall sliding.
     */
    checkCollision(position, radius = 0.45, height = 1.8) {
      const THREE = getTHREE();
      if (!THREE) return { collided: false, pushback: new THREE.Vector3(), groundY: 0 };

      const totalPush = new THREE.Vector3(0, 0, 0);
      let collided = false;

      const pYMin = position.y;
      const pYMax = position.y + height;

      // Up to 3 solver passes to avoid getting trapped in tight corners
      for (let pass = 0; pass < 3; pass++) {
        let passCollided = false;

        for (let i = 0; i < this.colliders.length; i++) {
          const c = this.colliders[i];

          // Skip if player is above or below collider vertical span
          // Also skip if player feet are at or above obstacle top surface (player is walking on top of it)
          if (pYMax <= c.min.y + 0.05 || pYMin >= c.max.y - 0.20) {
            continue;
          }

          // Skip ramps for horizontal pushback; ramps are handled via smooth floor height stepping
          if (c.ramp) {
            continue;
          }

          // Closest horizontal point on AABB to player center
          const closestX = Math.max(c.min.x, Math.min(position.x, c.max.x));
          const closestZ = Math.max(c.min.z, Math.min(position.z, c.max.z));

          const dx = position.x - closestX;
          const dz = position.z - closestZ;
          const distSq = dx * dx + dz * dz;

          if (distSq < radius * radius) {
            passCollided = true;
            collided = true;

            let pushX = 0;
            let pushZ = 0;

            if (distSq < 0.000001) {
              // Deeply embedded inside box: push towards nearest face
              const dLeft = Math.abs(position.x - c.min.x);
              const dRight = Math.abs(position.x - c.max.x);
              const dBack = Math.abs(position.z - c.min.z);
              const dFront = Math.abs(position.z - c.max.z);
              const minD = Math.min(dLeft, dRight, dBack, dFront);

              if (minD === dLeft) pushX = -radius;
              else if (minD === dRight) pushX = radius;
              else if (minD === dBack) pushZ = -radius;
              else pushZ = radius;
            } else {
              // Radial pushback away from closest boundary point
              const dist = Math.sqrt(distSq);
              const overlap = radius - dist;
              pushX = (dx / dist) * overlap;
              pushZ = (dz / dist) * overlap;
            }

            position.x += pushX;
            position.z += pushZ;
            totalPush.x += pushX;
            totalPush.z += pushZ;
          }
        }

        if (!passCollided) break;
      }

      // Check highest walkable ground / ramp surface underneath
      const groundY = this.getFloorHeight(position.x, position.z, position.y);

      return {
        collided,
        pushback: totalPush,
        groundY
      };
    },

    /**
     * getFloorHeight(x, z, currentY, stepHeight)
     * Finds highest walkable floor height directly underneath (x, z).
     * Supports ground level, crate tops, container roofs, catwalks, and inclined ramps!
     */
    getFloorHeight(x, z, currentY = 0, stepHeight = 0.55) {
      let highestY = 0.0; // Ground plane is y = 0

      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        if (!c.isWalkable) continue;

        if (x >= c.min.x && x <= c.max.x && z >= c.min.z && z <= c.max.z) {
          if (c.ramp) {
            const r = c.ramp;
            let t = 0;
            if (r.axis === 'z') {
              t = (z - r.startZ) / (r.endZ - r.startZ);
            } else {
              t = (x - r.startX) / (r.endX - r.startX);
            }
            t = Math.max(0, Math.min(1, t));
            const rampY = r.startY + t * (r.endY - r.startY);
            if (rampY <= currentY + stepHeight + 0.25) {
              if (rampY > highestY) highestY = rampY;
            }
          } else {
            const topY = c.max.y;
            if (topY <= currentY + stepHeight + 0.25) {
              if (topY > highestY) {
                highestY = topY;
              }
            }
          }
        }
      }

      return highestY;
    },

    /**
     * Fast Raycast against colliders with face normal calculation
     */
    raycast(origin, direction, maxDistance = 100) {
      const THREE = getTHREE();
      if (!THREE) return null;

      const ray = new THREE.Ray(origin, direction.clone().normalize());
      let closestHit = null;
      let minDistance = maxDistance;

      const box = new THREE.Box3();
      const hitPoint = new THREE.Vector3();

      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        box.min.copy(c.min);
        box.max.copy(c.max);

        if (ray.intersectBox(box, hitPoint)) {
          const dist = origin.distanceTo(hitPoint);
          if (dist < minDistance) {
            minDistance = dist;

            // Compute hit face normal
            const eps = 0.02;
            const normal = new THREE.Vector3();
            if (Math.abs(hitPoint.x - box.min.x) < eps) normal.set(-1, 0, 0);
            else if (Math.abs(hitPoint.x - box.max.x) < eps) normal.set(1, 0, 0);
            else if (Math.abs(hitPoint.y - box.min.y) < eps) normal.set(0, -1, 0);
            else if (Math.abs(hitPoint.y - box.max.y) < eps) normal.set(0, 1, 0);
            else if (Math.abs(hitPoint.z - box.min.z) < eps) normal.set(0, 0, -1);
            else if (Math.abs(hitPoint.z - box.max.z) < eps) normal.set(0, 0, 1);
            else normal.set(0, 1, 0);

            closestHit = {
              point: hitPoint.clone(),
              normal: normal,
              distance: dist,
              collider: c,
              mesh: c.mesh,
              type: c.type,
              userData: c.userData
            };
          }
        }
      }

      return closestHit;
    }
  };

  // =========================================================================
  // SECTION 4: TACTICAL MILITARY COMPOUND MAP ARCHITECTURE
  // =========================================================================

  const MapBuilder = {
    compoundGroup: null,

    build(scene) {
      const THREE = getTHREE();
      if (!THREE) return;

      this.compoundGroup = new THREE.Group();
      this.compoundGroup.name = "MilitaryCompound";

      // 1. Asphalt Compound Ground (120m x 120m)
      const groundGeo = new THREE.PlaneGeometry(120, 120);
      const groundMesh = new THREE.Mesh(groundGeo, MaterialFactory.materials.asphalt);
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.position.y = 0;
      groundMesh.receiveShadow = true;
      this.compoundGroup.add(groundMesh);

      // Register ground plane in colliders
      const groundBox = new THREE.Box3(
        new THREE.Vector3(-60, -0.5, -60),
        new THREE.Vector3(60, 0.0, 60)
      );
      Physics.registerCollider(groundBox, {
        mesh: groundMesh,
        type: 'ground',
        isWalkable: true
      });

      // 2. High Reinforced Concrete Perimeter Boundary Walls with Razor Wire
      this.buildPerimeterWalls();

      // 3. Central Two-Story Warehouse / Hangar
      this.buildWarehouse();

      // 4. Stacking Shipping Containers Yard (Olive, Tan, Blue) & Sniper Perches
      this.buildContainerYard();

      // 5. Motor Pool Alleyway & Chokepoints
      this.buildMotorPoolAlley();

      // 6. Perimeter Guard Watchtowers
      this.buildGuardTower(36, -36, -Math.PI * 0.75); // NE Tower
      this.buildGuardTower(-36, 36, Math.PI * 0.25);   // SW Tower

      // 7. Sandbag Fortifications & Concrete Jersey Barriers
      this.buildFortifications();

      // 8. Tactical Wooden Crates Stacks
      this.buildCrateClusters();

      // 9. Tactical Explosive Barrels
      this.buildExplosiveBarrels();

      scene.add(this.compoundGroup);
    },

    // Helper: Create Box Mesh + Register Collider AABB
    createBoxObstacle(x, y, z, width, height, depth, material, metadata = {}) {
      const THREE = getTHREE();
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y + height / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.compoundGroup.add(mesh);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(mesh.position, new THREE.Vector3(width, height, depth));
      Physics.registerCollider(box, {
        ...metadata,
        mesh
      });

      return mesh;
    },

    // 1. Perimeter Walls (100m x 100m compound, height 6m, thickness 1.2m)
    buildPerimeterWalls() {
      const wallH = 6.0;
      const wallT = 1.2;
      const halfL = 50;

      // North Wall with security checkpoint gate
      this.createBoxObstacle(-29, 0, -halfL, 42, wallH, wallT, MaterialFactory.materials.perimeterWall, { type: 'wall' });
      this.createBoxObstacle(29, 0, -halfL, 42, wallH, wallT, MaterialFactory.materials.perimeterWall, { type: 'wall' });
      this.buildSecurityGate(0, -halfL, 8, 4.8);

      // South Wall with security checkpoint gate
      this.createBoxObstacle(-29, 0, halfL, 42, wallH, wallT, MaterialFactory.materials.perimeterWall, { type: 'wall' });
      this.createBoxObstacle(29, 0, halfL, 42, wallH, wallT, MaterialFactory.materials.perimeterWall, { type: 'wall' });
      this.buildSecurityGate(0, halfL, 8, 4.8);

      // West Wall (solid)
      this.createBoxObstacle(-halfL, 0, 0, wallT, wallH, 100 + wallT, MaterialFactory.materials.perimeterWall, { type: 'wall' });

      // East Wall (solid)
      this.createBoxObstacle(halfL, 0, 0, wallT, wallH, 100 + wallT, MaterialFactory.materials.perimeterWall, { type: 'wall' });

      // Support Buttresses along perimeter walls
      for (let pos = -40; pos <= 40; pos += 12.5) {
        if (Math.abs(pos) > 5) {
          this.createBoxObstacle(pos, 0, -halfL + 0.8, 1.4, wallH, 0.8, MaterialFactory.materials.concrete, { type: 'wall' });
          this.createBoxObstacle(pos, 0, halfL - 0.8, 1.4, wallH, 0.8, MaterialFactory.materials.concrete, { type: 'wall' });
          this.createBoxObstacle(-halfL + 0.8, 0, pos, 0.8, wallH, 1.4, MaterialFactory.materials.concrete, { type: 'wall' });
          this.createBoxObstacle(halfL - 0.8, 0, pos, 0.8, wallH, 1.4, MaterialFactory.materials.concrete, { type: 'wall' });
        }
      }

      // Razor Wire Detailing on perimeter wall crowns
      this.buildRazorWireCoils(-halfL, halfL, -halfL, halfL, wallH);
    },

    buildRazorWireCoils(minX, maxX, minZ, maxZ, y) {
      const THREE = getTHREE();
      const wireMat = new THREE.MeshStandardMaterial({
        color: 0x88929c,
        metalness: 0.9,
        roughness: 0.4
      });

      const addWireSegment = (sx, sz, ex, ez) => {
        const dist = Math.hypot(ex - sx, ez - sz);
        const geo = new THREE.CylinderGeometry(0.35, 0.35, dist, 8, 1, true);
        const mesh = new THREE.Mesh(geo, wireMat);
        mesh.position.set((sx + ex) / 2, y + 0.38, (sz + ez) / 2);
        const angle = Math.atan2(ex - sx, ez - sz);
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = -angle;
        mesh.castShadow = true;
        this.compoundGroup.add(mesh);
      };

      addWireSegment(minX, minZ, maxX, minZ);
      addWireSegment(minX, maxZ, maxX, maxZ);
      addWireSegment(minX, minZ, minX, maxZ);
      addWireSegment(maxX, minZ, maxX, maxZ);
    },

    buildSecurityGate(x, z, width, height) {
      const gateMesh = this.createBoxObstacle(x, 0, z, width, height, 0.8, MaterialFactory.materials.steelStructure, { type: 'wall' });
      const THREE = getTHREE();
      const bannerGeo = new THREE.PlaneGeometry(width * 0.9, 1.2);
      const bannerMesh = new THREE.Mesh(bannerGeo, MaterialFactory.materials.asphalt);
      bannerMesh.position.set(x, 2.0, z + (z < 0 ? 0.42 : -0.42));
      if (z > 0) bannerMesh.rotation.y = Math.PI;
      this.compoundGroup.add(bannerMesh);
    },

    // 2. Central Two-Story Warehouse / Hangar (28m W x 34m L x 9m H)
    buildWarehouse() {
      const wWidth = 28;
      const wLength = 34;
      const wHeight = 9.0;
      const wallT = 0.6;

      const halfW = wWidth / 2;
      const halfL = wLength / 2;

      // Concrete Plinth Foundation
      this.createBoxObstacle(-halfW + 0.3, 0, 0, wallT, 1.0, wLength, MaterialFactory.materials.concrete, { type: 'wall' });
      this.createBoxObstacle(halfW - 0.3, 0, 0, wallT, 1.0, wLength, MaterialFactory.materials.concrete, { type: 'wall' });

      // North Wall with central roll-up door (width 7m, height 5.2m)
      const doorW = 7.0;
      const sideWallW = (wWidth - doorW) / 2;
      this.createBoxObstacle(-halfW + sideWallW / 2, 0, -halfL, sideWallW, wHeight, wallT, MaterialFactory.materials.corrugated, { type: 'wall' });
      this.createBoxObstacle(halfW - sideWallW / 2, 0, -halfL, sideWallW, wHeight, wallT, MaterialFactory.materials.corrugated, { type: 'wall' });
      this.createBoxObstacle(0, 5.2, -halfL, doorW, wHeight - 5.2, wallT, MaterialFactory.materials.corrugated, { type: 'wall' });

      // South Wall with central roll-up door
      this.createBoxObstacle(-halfW + sideWallW / 2, 0, halfL, sideWallW, wHeight, wallT, MaterialFactory.materials.corrugated, { type: 'wall' });
      this.createBoxObstacle(halfW - sideWallW / 2, 0, halfL, sideWallW, wHeight, wallT, MaterialFactory.materials.corrugated, { type: 'wall' });
      this.createBoxObstacle(0, 5.2, halfL, doorW, wHeight - 5.2, wallT, MaterialFactory.materials.corrugated, { type: 'wall' });

      // West Wall with side door (width 3.5m, height 3.2m)
      const sideDoorW = 3.5;
      const sideWallL = (wLength - sideDoorW) / 2;
      this.createBoxObstacle(-halfW, 0, -halfL + sideWallL / 2, wallT, wHeight, sideWallL, MaterialFactory.materials.corrugated, { type: 'wall' });
      this.createBoxObstacle(-halfW, 0, halfL - sideWallL / 2, wallT, wHeight, sideWallL, MaterialFactory.materials.corrugated, { type: 'wall' });
      this.createBoxObstacle(-halfW, 3.2, 0, wallT, wHeight - 3.2, sideDoorW, MaterialFactory.materials.corrugated, { type: 'wall' });

      // East Wall with side door
      this.createBoxObstacle(halfW, 0, -halfL + sideWallL / 2, wallT, wHeight, sideWallL, MaterialFactory.materials.corrugated, { type: 'wall' });
      this.createBoxObstacle(halfW, 0, halfL - sideWallL / 2, wallT, wHeight, sideWallL, MaterialFactory.materials.corrugated, { type: 'wall' });
      this.createBoxObstacle(halfW, 3.2, 0, wallT, wHeight - 3.2, sideDoorW, MaterialFactory.materials.corrugated, { type: 'wall' });

      // Internal Heavy Steel Columns
      const colX = [-halfW + 4, halfW - 4];
      const colZ = [-halfL + 7, 0, halfL - 7];
      for (const cx of colX) {
        for (const cz of colZ) {
          this.createBoxObstacle(cx, 0, cz, 0.8, wHeight, 0.8, MaterialFactory.materials.steelStructure, { type: 'column' });
        }
      }

      // 2nd-Story Mezzanine / Interior Perimeter Catwalk (y = 4.2m, width = 2.4m)
      this.buildWarehouseCatwalk(wWidth, wLength, 4.2, 2.4);

      // Pitched Roof with 3 Skylights and Volumetric Sunbeams
      this.buildWarehouseRoof(wWidth, wLength, wHeight);
    },

    buildWarehouseCatwalk(wWidth, wLength, height, walkWidth) {
      const halfW = wWidth / 2 - 0.4;
      const halfL = wLength / 2 - 0.4;
      const catwalkT = 0.25;

      // Walkway platforms
      this.createBoxObstacle(0, height, -halfL + walkWidth / 2, wWidth - walkWidth * 2, catwalkT, walkWidth, MaterialFactory.materials.catwalkGrate, { type: 'catwalk', isWalkable: true });
      this.createBoxObstacle(0, height, halfL - walkWidth / 2, wWidth - walkWidth * 2, catwalkT, walkWidth, MaterialFactory.materials.catwalkGrate, { type: 'catwalk', isWalkable: true });
      this.createBoxObstacle(-halfW + walkWidth / 2, height, 0, walkWidth, catwalkT, wLength - 0.8, MaterialFactory.materials.catwalkGrate, { type: 'catwalk', isWalkable: true });
      this.createBoxObstacle(halfW - walkWidth / 2, height, 0, walkWidth, catwalkT, wLength - 0.8, MaterialFactory.materials.catwalkGrate, { type: 'catwalk', isWalkable: true });

      // Safety Railings (height 1.1m)
      this.createBoxObstacle(0, height + catwalkT, -halfL + walkWidth, wWidth - walkWidth * 2, 1.1, 0.1, MaterialFactory.materials.yellowRailing, { type: 'railing' });
      this.createBoxObstacle(0, height + catwalkT, halfL - walkWidth, wWidth - walkWidth * 2, 1.1, 0.1, MaterialFactory.materials.yellowRailing, { type: 'railing' });
      this.createBoxObstacle(-halfW + walkWidth, height + catwalkT, 0, 0.1, 1.1, wLength - walkWidth * 2, MaterialFactory.materials.yellowRailing, { type: 'railing' });
      this.createBoxObstacle(halfW - walkWidth, height + catwalkT, 0, 0.1, 1.1, wLength - walkWidth * 2, MaterialFactory.materials.yellowRailing, { type: 'railing' });

      // Access Stair Ramps
      this.buildStairRamp(-halfW + walkWidth / 2, 4, 12, 0, height, walkWidth, 'z');
      this.buildStairRamp(halfW - walkWidth / 2, -4, -12, 0, height, walkWidth, 'z');
    },

    buildStairRamp(x, startZ, endZ, startY, endY, width, axis = 'z') {
      const THREE = getTHREE();
      const steps = 14;
      const dz = (endZ - startZ) / steps;
      const dy = (endY - startY) / steps;

      for (let s = 0; s < steps; s++) {
        const stepZ = startZ + s * dz + dz / 2;
        const stepH = (s + 1) * dy;
        this.createBoxObstacle(x, 0, stepZ, width, stepH, Math.abs(dz) + 0.05, MaterialFactory.materials.steelStructure, {
          type: 'ramp_step',
          isWalkable: true
        });
      }

      // Register smooth slope in physics for floor height tracking
      const minZ = Math.min(startZ, endZ);
      const maxZ = Math.max(startZ, endZ);
      const rampBox = new THREE.Box3(
        new THREE.Vector3(x - width / 2, startY, minZ),
        new THREE.Vector3(x + width / 2, endY, maxZ)
      );
      Physics.registerCollider(rampBox, {
        type: 'ramp',
        isWalkable: true,
        ramp: {
          axis: 'z',
          startX: x, endX: x,
          startZ: startZ, endZ: endZ,
          startY: startY, endY: endY
        }
      });
    },

    buildWarehouseRoof(wWidth, wLength, baseHeight) {
      const THREE = getTHREE();
      const roofPeak = baseHeight + 3.0;

      // West Roof Slope
      const roofSlopeGeo = new THREE.PlaneGeometry(16, wLength);
      const westRoof = new THREE.Mesh(roofSlopeGeo, MaterialFactory.materials.corrugated);
      westRoof.position.set(-7, (baseHeight + roofPeak) / 2, 0);
      westRoof.rotation.y = Math.PI / 2;
      westRoof.rotation.x = Math.atan2(3.0, 14);
      westRoof.castShadow = true;
      westRoof.receiveShadow = true;
      this.compoundGroup.add(westRoof);

      // East Roof Slope
      const eastRoof = new THREE.Mesh(roofSlopeGeo, MaterialFactory.materials.corrugated);
      eastRoof.position.set(7, (baseHeight + roofPeak) / 2, 0);
      eastRoof.rotation.y = -Math.PI / 2;
      eastRoof.rotation.x = Math.atan2(3.0, 14);
      eastRoof.castShadow = true;
      eastRoof.receiveShadow = true;
      this.compoundGroup.add(eastRoof);

      // 3 Skylights with Volumetric Sunbeam Shafts
      const skylightZ = [-9, 0, 9];
      for (const sz of skylightZ) {
        const glassGeo = new THREE.PlaneGeometry(4.0, 5.0);
        const glassMesh = new THREE.Mesh(glassGeo, MaterialFactory.materials.skylightGlass);
        glassMesh.position.set(-4.5, roofPeak - 1.2, sz);
        glassMesh.rotation.y = Math.PI / 2;
        glassMesh.rotation.x = Math.atan2(3.0, 14);
        this.compoundGroup.add(glassMesh);

        // Angled Volumetric Sunbeam Shaft
        const beamGeo = new THREE.CylinderGeometry(2.0, 4.8, 10.5, 8, 1, true);
        const beamMesh = new THREE.Mesh(beamGeo, MaterialFactory.materials.sunbeam);
        beamMesh.position.set(-1.5, 4.5, sz);
        beamMesh.rotation.z = 0.35;
        beamMesh.rotation.x = 0.15;
        this.compoundGroup.add(beamMesh);
      }
    },

    // 3. Shipping Container Yard (Olive, Tan, Blue) & Stacks with Access Ramps
    buildContainerYard() {
      const c20L = 6.0, c20W = 2.44, cH = 2.6;
      const c40L = 12.2, c40W = 2.44;

      // Ground Level Containers forming tactical choke points
      this.createContainer(-30, 0, -32, c40L, cH, c40W, 0, 'olive', 'PMC-401');
      this.createContainer(-30, 0, -22, c20L, cH, c20W, Math.PI / 2, 'tan', 'PMC-402');
      this.createContainer(-38, 0, -12, c40L, cH, c40W, 0, 'blue', 'PMC-403');
      this.createContainer(-24, 0, -8,  c20L, cH, c20W, 0, 'olive', 'PMC-404');

      // Double-Stacked Sniper Perch 1 (North-West)
      this.createContainer(-30, cH, -32, c40L, cH, c40W, 0, 'tan', 'SNIPER-NORTH');
      this.buildStairRamp(-30 + c40L / 2 + 3.0, -32, -32, 0, cH, 2.0, 'x');
      this.createBoxObstacle(-30, cH * 2, -32 - c40W / 2 + 0.3, 5.0, 1.0, 0.6, MaterialFactory.materials.sandbag, { type: 'cover' });

      // Mid-West Chokepoints (tight 90-degree corners & blind spots)
      this.createContainer(-32, 0, 4,   c40L, cH, c40W, Math.PI / 12, 'blue', 'PMC-405');
      this.createContainer(-22, 0, 14,  c20L, cH, c20W, Math.PI / 2, 'olive', 'PMC-406');
      this.createContainer(-36, 0, 22,  c40L, cH, c40W, 0, 'tan', 'PMC-407');

      // Double-Stacked Sniper Perch 2 (South-West)
      this.createContainer(-36, cH, 22, c40L, cH, c40W, 0, 'blue', 'SNIPER-SOUTH');
      this.buildStairRamp(-36 - c40L / 2 - 3.0, 22, 22, 0, cH, 2.0, 'x');
      this.createBoxObstacle(-36, cH * 2, 22 + c40W / 2 - 0.3, 5.0, 1.0, 0.6, MaterialFactory.materials.sandbag, { type: 'cover' });

      // Open-ended Walkthrough Container Tunnel (x: -24, z: 32)
      this.buildContainerTunnel(-24, 0, 32, c40L, cH, c40W);
    },

    createContainer(x, y, z, length, height, width, rotY = 0, theme = 'olive', code = 'PMC-01') {
      const THREE = getTHREE();
      const mat = MaterialFactory.materials[`container_${theme}`] || MaterialFactory.materials.container_olive;
      const mesh = this.createBoxObstacle(x, y, z, length, height, width, mat, {
        type: 'container',
        isWalkable: true
      });
      if (rotY !== 0) {
        mesh.rotation.y = rotY;
        const box = new THREE.Box3().setFromObject(mesh);
        Physics.registerCollider(box, { type: 'container', isWalkable: true, mesh });
      }
      return mesh;
    },

    buildContainerTunnel(x, y, z, length, height, width) {
      const wallT = 0.2;
      this.createBoxObstacle(x, y, z, length, wallT, width, MaterialFactory.materials.steelStructure, { type: 'tunnel', isWalkable: true });
      this.createBoxObstacle(x, y + height - wallT, z, length, wallT, width, MaterialFactory.materials.steelStructure, { type: 'tunnel', isWalkable: true });
      this.createBoxObstacle(x, y, z - width / 2 + wallT / 2, length, height, wallT, MaterialFactory.materials.container_tan, { type: 'tunnel' });
      this.createBoxObstacle(x, y, z + width / 2 - wallT / 2, length, height, wallT, MaterialFactory.materials.container_tan, { type: 'tunnel' });
    },

    // 4. Motor Pool / Long Sightline Alleyway (East Sector)
    buildMotorPoolAlley() {
      const c40L = 12.2, c40W = 2.44, cH = 2.6;

      this.createContainer(28, 0, -28, c40L, cH, c40W, 0, 'blue', 'PMC-EAST-1');
      this.createContainer(28, 0, 26,  c40L, cH, c40W, 0, 'olive', 'PMC-EAST-2');

      // Double Stack Sniper Perch (East Motor Pool)
      this.createContainer(28, cH, 26, c40L, cH, c40W, 0, 'tan', 'SNIPER-EAST');
      this.buildStairRamp(28 + c40L / 2 + 2.8, 26, 26, 0, cH, 2.0, 'x');

      // Staggered Concrete Jersey Barriers
      const chicaneZs = [-16, -6, 4, 14];
      chicaneZs.forEach((cz, idx) => {
        const cx = (idx % 2 === 0) ? 22 : 34;
        this.buildJerseyBarrier(cx, cz, 4.0, (idx % 2 === 0) ? 0.2 : -0.2);
      });
    },

    // 5. Perimeter Guard Watchtowers
    buildGuardTower(x, z, facingAngle = 0) {
      const THREE = getTHREE();
      const towerGroup = new THREE.Group();
      towerGroup.position.set(x, 0, z);
      towerGroup.rotation.y = facingAngle;

      const towerH = 6.0;
      const legSpan = 2.2;

      // 4 Steel Legs
      const legGeo = new THREE.CylinderGeometry(0.18, 0.22, towerH, 8);
      const legMat = MaterialFactory.materials.steelStructure;
      const legPositions = [
        [-legSpan, -legSpan], [legSpan, -legSpan],
        [-legSpan, legSpan],  [legSpan, legSpan]
      ];

      for (const [lx, lz] of legPositions) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, towerH / 2, lz);
        leg.castShadow = true;
        towerGroup.add(leg);

        const box = new THREE.Box3(
          new THREE.Vector3(x + lx - 0.3, 0, z + lz - 0.3),
          new THREE.Vector3(x + lx + 0.3, towerH, z + lz + 0.3)
        );
        Physics.registerCollider(box, { type: 'scaffold_leg', mesh: leg });
      }

      // Observation Platform (4.8m x 4.8m at y = 6m)
      const platGeo = new THREE.BoxGeometry(4.8, 0.3, 4.8);
      const platMesh = new THREE.Mesh(platGeo, MaterialFactory.materials.woodCrate);
      platMesh.position.set(0, towerH, 0);
      platMesh.castShadow = true;
      platMesh.receiveShadow = true;
      towerGroup.add(platMesh);

      const platBox = new THREE.Box3(
        new THREE.Vector3(x - 2.4, towerH - 0.2, z - 2.4),
        new THREE.Vector3(x + 2.4, towerH + 0.2, z + 2.4)
      );
      Physics.registerCollider(platBox, { type: 'tower_platform', isWalkable: true, mesh: platMesh });

      // Parapet Railings (height 1.1m)
      const parapetGeo = new THREE.BoxGeometry(4.8, 1.1, 0.2);
      const parapetMat = MaterialFactory.materials.corrugated;
      const pFront = new THREE.Mesh(parapetGeo, parapetMat);
      pFront.position.set(0, towerH + 0.55, 2.3);
      towerGroup.add(pFront);

      const pBack = new THREE.Mesh(parapetGeo, parapetMat);
      pBack.position.set(0, towerH + 0.55, -2.3);
      towerGroup.add(pBack);

      const pLeft = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 4.8), parapetMat);
      pLeft.position.set(-2.3, towerH + 0.55, 0);
      towerGroup.add(pLeft);

      // Canopy Roof
      const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.15, 5.2), MaterialFactory.materials.corrugated);
      roofMesh.position.set(0, towerH + 2.8, 0);
      roofMesh.rotation.x = 0.1;
      roofMesh.castShadow = true;
      towerGroup.add(roofMesh);

      // Access Ladder
      this.buildStairRamp(x, z - legSpan - 1.0, z - legSpan + 1.0, 0, towerH, 1.2, 'z');

      // Industrial Floodlight
      this.buildFloodlight(x, towerH + 1.2, z + 2.4, facingAngle);

      this.compoundGroup.add(towerGroup);
    },

    buildFloodlight(x, y, z, rotY) {
      const THREE = getTHREE();
      const housingGeo = new THREE.CylinderGeometry(0.35, 0.45, 0.6, 12);
      const housingMesh = new THREE.Mesh(housingGeo, MaterialFactory.materials.steelStructure);
      housingMesh.position.set(x, y, z);
      housingMesh.rotation.x = Math.PI / 3;
      housingMesh.rotation.y = rotY;
      this.compoundGroup.add(housingMesh);

      const spotLight = new THREE.SpotLight(0xd8eeff, 2.8, 55, Math.PI / 4, 0.55, 1.8);
      spotLight.position.set(x, y, z);
      spotLight.target.position.set(x + Math.sin(rotY) * 25, 0, z + Math.cos(rotY) * 25);
      spotLight.castShadow = true;
      spotLight.shadow.mapSize.width = 1024;
      spotLight.shadow.mapSize.height = 1024;
      spotLight.shadow.bias = -0.0004;
      this.compoundGroup.add(spotLight);
      this.compoundGroup.add(spotLight.target);

      // Soft volumetric cone
      const coneGeo = new THREE.ConeGeometry(8.0, 35, 16, 1, true);
      const coneMesh = new THREE.Mesh(coneGeo, MaterialFactory.materials.floodlightCone);
      coneMesh.position.set(x + Math.sin(rotY) * 16, y - 9, z + Math.cos(rotY) * 16);
      coneMesh.rotation.x = -Math.PI / 2 + 0.45;
      coneMesh.rotation.z = -rotY;
      this.compoundGroup.add(coneMesh);
    },

    // 6. Sandbag Fortifications & Concrete Jersey Barriers
    buildFortifications() {
      this.buildSandbagBunker(-6, -22, 6.0, 3.5, 0);          // North Warehouse Door
      this.buildSandbagBunker(6, 22, 6.0, 3.5, Math.PI);      // South Warehouse Door
      this.buildSandbagBunker(-18, 0, 4.5, 3.0, Math.PI / 2); // West Personnel Door
      this.buildSandbagBunker(18, 0, 4.5, 3.0, -Math.PI / 2); // East Personnel Door

      // Additional Jersey Barriers in Courtyards
      this.buildJerseyBarrier(-8, -36, 4.2, 0.1);
      this.buildJerseyBarrier(8, -36, 4.2, -0.1);
      this.buildJerseyBarrier(-8, 36, 4.2, -0.1);
      this.buildJerseyBarrier(8, 36, 4.2, 0.1);
    },

    buildSandbagBunker(x, z, width, depth, rotY = 0) {
      const bagH = 1.1; // Waist-high crouch cover
      const bagT = 0.7;

      this.createBoxObstacle(x, 0, z + depth / 2, width, bagH, bagT, MaterialFactory.materials.sandbag, { type: 'sandbag' });
      this.createBoxObstacle(x - width / 2 + bagT / 2, 0, z, bagT, bagH, depth, MaterialFactory.materials.sandbag, { type: 'sandbag' });
      this.createBoxObstacle(x + width / 2 - bagT / 2, 0, z, bagT, bagH, depth, MaterialFactory.materials.sandbag, { type: 'sandbag' });
    },

    buildJerseyBarrier(x, z, length = 3.5, rotY = 0) {
      const height = 1.15;
      const width = 0.8;
      const mesh = this.createBoxObstacle(x, 0, z, length, height, width, MaterialFactory.materials.concrete, {
        type: 'jersey_barrier',
        isWalkable: true
      });
      if (rotY !== 0) {
        mesh.rotation.y = rotY;
      }
    },

    // 7. Tactical Military Crates Clusters
    buildCrateClusters() {
      // Inside Warehouse
      this.buildCrateStack(-9, 0, -8, 2, 2);
      this.buildCrateStack(9, 0, 8, 3, 2);
      this.buildCrateStack(-8, 0, 10, 2, 1);

      // Yard Stacks
      this.buildCrateStack(-18, 0, -28, 3, 2);
      this.buildCrateStack(-20, 0, 24, 2, 2);
      this.buildCrateStack(20, 0, -18, 2, 2);
      this.buildCrateStack(32, 0, 8, 3, 2);
    },

    buildCrateStack(baseX, baseY, baseZ, cols = 2, rows = 2) {
      const crateSize = 1.2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - r; c++) {
          const cx = baseX + c * (crateSize + 0.05);
          const cy = baseY + r * crateSize;
          const cz = baseZ;
          this.createBoxObstacle(cx, cy, cz, crateSize, crateSize, crateSize, MaterialFactory.materials.woodCrate, {
            type: 'crate',
            isWalkable: true
          });
        }
      }
    },

    // 8. Multiple Explosive Barrels Placed Tactically Around the Map
    buildExplosiveBarrels() {
      const barrelPositions = [
        { x: -4.5, z: -19.5 },
        { x: 4.5, z: 19.5 },
        { x: -7.5, z: 3.5 },
        { x: 7.5, z: -4.0 },
        { x: -28, z: -14 },
        { x: -34, z: 2 },
        { x: -21, z: 22 },
        { x: 26, z: -12 },
        { x: 30, z: 12 },
        { x: 24, z: 34 },
        { x: 34, z: -32 },
        { x: -34, z: 32 }
      ];

      barrelPositions.forEach((pos, idx) => {
        Engine.createBarrel(pos.x, 0, pos.z, `barrel_${idx}`);
      });
    }
  };

  // =========================================================================
  // SECTION 5: EXPLOSION VFX, PARTICLES & SCREEN SHAKE
  // =========================================================================

  const VFX = {
    explosionLight: null,
    activeExplosions: [],

    init(scene) {
      const THREE = getTHREE();
      if (!THREE) return;

      this.explosionLight = new THREE.PointLight(0xff7722, 0, 32, 2.0);
      this.explosionLight.position.set(0, -100, 0);
      scene.add(this.explosionLight);
    },

    triggerExplosion(position, radius = 7.5, damage = 120) {
      const THREE = getTHREE();
      if (!THREE || !Engine.scene) return;

      const scene = Engine.scene;

      // Play explosion sound effect
      if (AudioSys) {
        AudioSys.playExplosionSound();
      }

      // 1. Dynamic Flash Point Light
      if (this.explosionLight) {
        this.explosionLight.position.copy(position).add(new THREE.Vector3(0, 1.5, 0));
        this.explosionLight.intensity = 10.0;
        this.explosionLight.color.setHex(0xff8833);
      }

      // 2. Expanding Fireball Sphere
      const fireballGeo = new THREE.SphereGeometry(0.8, 16, 16);
      const fireballMat = new THREE.MeshBasicMaterial({
        color: 0xffaa33,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      const fireball = new THREE.Mesh(fireballGeo, fireballMat);
      fireball.position.copy(position).add(new THREE.Vector3(0, 1.0, 0));
      scene.add(fireball);

      // 3. Ground Shockwave Disc
      const shockGeo = new THREE.RingGeometry(0.2, 1.5, 24);
      const shockMat = new THREE.MeshBasicMaterial({
        color: 0xffeedd,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const shockwave = new THREE.Mesh(shockGeo, shockMat);
      shockwave.position.copy(position).add(new THREE.Vector3(0, 0.1, 0));
      shockwave.rotation.x = -Math.PI / 2;
      scene.add(shockwave);

      // 4. Shrapnel Sparks
      const sparkMat = new THREE.PointsMaterial({
        size: 0.45,
        map: TextureGenerator.createParticleTexture('spark'),
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const sparkCount = 35;
      const sparkGeo = new THREE.BufferGeometry();
      const sparkPositions = new Float32Array(sparkCount * 3);
      const sparkVelocities = [];

      for (let i = 0; i < sparkCount; i++) {
        sparkPositions[i * 3] = position.x;
        sparkPositions[i * 3 + 1] = position.y + 0.8;
        sparkPositions[i * 3 + 2] = position.z;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.5;
        const speed = 12 + Math.random() * 22;
        sparkVelocities.push(new THREE.Vector3(
          Math.cos(theta) * Math.cos(phi) * speed,
          Math.sin(phi) * speed,
          Math.sin(theta) * Math.cos(phi) * speed
        ));
      }
      sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
      const sparkSystem = new THREE.Points(sparkGeo, sparkMat);
      scene.add(sparkSystem);

      // 5. Billowing Dark Smoke
      const smokeMat = new THREE.PointsMaterial({
        size: 2.2,
        map: TextureGenerator.createParticleTexture('smoke'),
        transparent: true,
        opacity: 0.75,
        depthWrite: false
      });

      const smokeCount = 18;
      const smokeGeo = new THREE.BufferGeometry();
      const smokePositions = new Float32Array(smokeCount * 3);
      const smokeVelocities = [];

      for (let i = 0; i < smokeCount; i++) {
        smokePositions[i * 3] = position.x + (Math.random() - 0.5) * 1.5;
        smokePositions[i * 3 + 1] = position.y + 0.5 + Math.random() * 1.0;
        smokePositions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 1.5;

        smokeVelocities.push(new THREE.Vector3(
          (Math.random() - 0.5) * 4.0,
          2.5 + Math.random() * 4.5,
          (Math.random() - 0.5) * 4.0
        ));
      }
      smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
      const smokeSystem = new THREE.Points(smokeGeo, smokeMat);
      scene.add(smokeSystem);

      // Track animation
      this.activeExplosions.push({
        fireball,
        shockwave,
        sparkSystem,
        sparkPositions,
        sparkVelocities,
        smokeSystem,
        smokePositions,
        smokeVelocities,
        elapsed: 0,
        duration: 1.6
      });

      // 6. Camera Screen Shake (Distance Falloff)
      if (Engine.camera) {
        const camDist = Engine.camera.position.distanceTo(position);
        const shakePower = Math.max(0, 1.0 - camDist / 45.0) * 0.45;
        if (shakePower > 0.01) {
          Engine.screenShake.intensity = Math.min(0.70, Engine.screenShake.intensity + shakePower);
        }
      }

      // 7. Radial Damage & Chain Reactions to Other Barrels
      for (let i = 0; i < Engine.barrels.length; i++) {
        const barrel = Engine.barrels[i];
        if (barrel.isDead) continue;
        const d = barrel.position.distanceTo(position);
        if (d < radius && d > 0.1) {
          const falloff = 1.0 - (d / radius);
          const barrelDmg = damage * falloff;
          setTimeout(() => {
            if (!barrel.isDead) barrel.takeDamage(barrelDmg, position);
          }, 70 + Math.random() * 70);
        }
      }

      // Notify registered damage listeners
      for (let i = 0; i < Engine.damageCallbacks.length; i++) {
        Engine.damageCallbacks[i](position, radius, damage);
      }
    },

    update(delta) {
      if (this.explosionLight && this.explosionLight.intensity > 0) {
        this.explosionLight.intensity = Math.max(0, this.explosionLight.intensity - delta * 25.0);
      }

      for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
        const exp = this.activeExplosions[i];
        exp.elapsed += delta;
        const progress = exp.elapsed / exp.duration;

        if (progress >= 1.0) {
          Engine.scene.remove(exp.fireball);
          Engine.scene.remove(exp.shockwave);
          Engine.scene.remove(exp.sparkSystem);
          Engine.scene.remove(exp.smokeSystem);
          exp.fireball.geometry.dispose();
          exp.fireball.material.dispose();
          exp.shockwave.geometry.dispose();
          exp.shockwave.material.dispose();
          exp.sparkSystem.geometry.dispose();
          exp.sparkSystem.material.dispose();
          exp.smokeSystem.geometry.dispose();
          exp.smokeSystem.material.dispose();
          this.activeExplosions.splice(i, 1);
          continue;
        }

        // Fireball expansion
        const fbScale = 1.0 + progress * 5.5;
        exp.fireball.scale.set(fbScale, fbScale, fbScale);
        exp.fireball.material.opacity = Math.max(0, 1.0 - progress * 1.8);

        // Shockwave expansion
        const swScale = 1.0 + progress * 7.0;
        exp.shockwave.scale.set(swScale, swScale, swScale);
        exp.shockwave.material.opacity = Math.max(0, (1.0 - progress * 1.5) * 0.85);

        // Flying sparks
        const sPos = exp.sparkPositions;
        for (let s = 0; s < exp.sparkVelocities.length; s++) {
          const vel = exp.sparkVelocities[s];
          vel.y -= 24.0 * delta;
          sPos[s * 3] += vel.x * delta;
          sPos[s * 3 + 1] = Math.max(0.05, sPos[s * 3 + 1] + vel.y * delta);
          sPos[s * 3 + 2] += vel.z * delta;
        }
        exp.sparkSystem.geometry.attributes.position.needsUpdate = true;
        exp.sparkSystem.material.opacity = Math.max(0, 1.0 - progress * 1.6);

        // Billowing smoke
        const smPos = exp.smokePositions;
        for (let sm = 0; sm < exp.smokeVelocities.length; sm++) {
          const sVel = exp.smokeVelocities[sm];
          smPos[sm * 3] += sVel.x * delta;
          smPos[sm * 3 + 1] += sVel.y * delta;
          smPos[sm * 3 + 2] += sVel.z * delta;
        }
        exp.smokeSystem.geometry.attributes.position.needsUpdate = true;
        exp.smokeSystem.material.size = 2.2 + progress * 4.0;
        exp.smokeSystem.material.opacity = Math.max(0, (1.0 - progress) * 0.75);
      }
    },

    // Bullet Hit Impact Particles (dust, sparks, blood)
    spawnBulletImpact(position, normal, materialTypeOrBlood = 'concrete') {
      const THREE = getTHREE();
      if (!THREE || !Engine.scene) return;

      const isBlood = (materialTypeOrBlood === true || materialTypeOrBlood === 'blood');
      const isMetal = (materialTypeOrBlood === 'metal');
      const isWood = (materialTypeOrBlood === 'wood');

      // Audio impact sound
      if (AudioSys) {
        AudioSys.playImpact(isBlood ? 'blood' : (isMetal ? 'metal' : (isWood ? 'wood' : 'concrete')));
      }

      const count = isBlood ? 12 : (isMetal ? 16 : 9);
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const vels = [];

      for (let i = 0; i < count; i++) {
        pos[i * 3] = position.x;
        pos[i * 3 + 1] = position.y;
        pos[i * 3 + 2] = position.z;

        const spd = isBlood ? (2 + Math.random() * 4) : (4 + Math.random() * 8);
        vels.push(new THREE.Vector3(
          (normal.x + (Math.random() - 0.5) * 1.2) * spd,
          (normal.y + Math.random() * 0.8) * spd,
          (normal.z + (Math.random() - 0.5) * 1.2) * spd
        ));
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

      const pType = isBlood ? 'blood' : (isMetal ? 'spark' : 'dust');
      const mat = new THREE.PointsMaterial({
        size: isBlood ? 0.35 : 0.28,
        map: TextureGenerator.createParticleTexture(pType),
        transparent: true,
        opacity: 0.95,
        blending: isMetal ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false
      });
      const points = new THREE.Points(geo, mat);
      Engine.scene.add(points);

      let life = 0;
      const stepImpact = () => {
        life += 0.045;
        for (let i = 0; i < count; i++) {
          pos[i * 3] += vels[i].x * 0.025;
          pos[i * 3 + 1] += vels[i].y * 0.025 - (isBlood ? 0.4 : 0.2) * 0.025;
          pos[i * 3 + 2] += vels[i].z * 0.025;
        }
        geo.attributes.position.needsUpdate = true;
        mat.opacity = Math.max(0, 1.0 - life);

        if (life < 1.0) {
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(stepImpact);
          }
        } else {
          Engine.scene.remove(points);
          geo.dispose();
          mat.dispose();
        }
      };

      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(stepImpact);
      }
    }
  };

  // =========================================================================
  // SECTION 6: EXPLOSIVE BARREL ENTITY
  // =========================================================================

  class ExplosiveBarrel {
    constructor(x, y, z, id) {
      const THREE = getTHREE();
      this.id = id;
      this.position = new THREE.Vector3(x, y, z);
      this.health = 50;
      this.maxHealth = 50;
      this.isDead = false;
      this.radius = 0.5;
      this.height = 1.25;

      const geo = new THREE.CylinderGeometry(this.radius, this.radius, this.height, 16);
      this.mesh = new THREE.Mesh(geo, MaterialFactory.materials.hazardBarrel);
      this.mesh.position.set(x, y + this.height / 2, z);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.mesh.userData = { isBarrel: true, barrel: this };
      Engine.scene.add(this.mesh);

      const box = new THREE.Box3();
      box.setFromCenterAndSize(this.mesh.position, new THREE.Vector3(this.radius * 2, this.height, this.radius * 2));
      this.collider = Physics.registerCollider(box, {
        mesh: this.mesh,
        type: 'barrel',
        isWalkable: true,
        userData: this
      });
    }

    takeDamage(amount, hitPoint) {
      if (this.isDead) return;

      this.health -= amount;

      // Hit visual flash
      if (this.mesh && this.mesh.material) {
        this.mesh.material.emissive = new THREE.Color(0xff2200);
        setTimeout(() => {
          if (this.mesh && this.mesh.material) {
            this.mesh.material.emissive = new THREE.Color(0x000000);
          }
        }, 80);
      }

      // Spark impact
      const p = hitPoint || this.position.clone().add(new THREE.Vector3(0, 0.6, 0));
      VFX.spawnBulletImpact(p, new THREE.Vector3(0, 1, 0), 'metal');

      if (this.health <= 0) {
        this.explode();
      }
    }

    explode() {
      if (this.isDead) return;
      this.isDead = true;

      // Remove physics collider
      Physics.removeCollider(this.collider);

      // Trigger massive explosion VFX & Screen Shake
      Engine.triggerExplosion(this.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 8.5, 140);

      // Swap to charred crumpled drum
      const charredGeo = new THREE.CylinderGeometry(this.radius * 1.15, this.radius * 1.3, 0.35, 12);
      const charredMat = new THREE.MeshStandardMaterial({
        color: 0x18191a,
        roughness: 0.95,
        metalness: 0.3
      });
      const burntMesh = new THREE.Mesh(charredGeo, charredMat);
      burntMesh.position.set(this.position.x, 0.18, this.position.z);
      burntMesh.castShadow = true;
      burntMesh.receiveShadow = true;

      Engine.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      Engine.scene.add(burntMesh);
    }
  }

  // =========================================================================
  // SECTION 7: AIRBORNE DUST MOTES & SUNBEAMS
  // =========================================================================

  const Atmosphere = {
    dustParticles: null,
    dustPositions: null,
    dustCount: 1200,

    init(scene) {
      const THREE = getTHREE();
      if (!THREE) return;

      const geo = new THREE.BufferGeometry();
      this.dustPositions = new Float32Array(this.dustCount * 3);

      for (let i = 0; i < this.dustCount; i++) {
        this.dustPositions[i * 3] = (Math.random() - 0.5) * 95;
        this.dustPositions[i * 3 + 1] = 0.5 + Math.random() * 12.0;
        this.dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 95;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));

      const mat = new THREE.PointsMaterial({
        size: 0.18,
        map: TextureGenerator.createParticleTexture('dust'),
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      this.dustParticles = new THREE.Points(geo, mat);
      scene.add(this.dustParticles);
    },

    update(delta) {
      if (!this.dustParticles || !this.dustPositions) return;

      const pos = this.dustPositions;
      const t = Date.now() * 0.001;
      for (let i = 0; i < this.dustCount; i++) {
        pos[i * 3] += Math.sin(pos[i * 3 + 1] * 0.5 + t) * 0.25 * delta;
        pos[i * 3 + 1] -= 0.15 * delta;
        pos[i * 3 + 2] += Math.cos(pos[i * 3] * 0.5 + t) * 0.25 * delta;

        if (pos[i * 3 + 1] < 0.2) {
          pos[i * 3 + 1] = 11.5;
        }
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;
    }
  };

  // =========================================================================
  // SECTION 8: PROCEDURAL WEB AUDIO SYNTHESIZER (Zero Audio Files)
  // =========================================================================

  const AudioSys = {
    ctx: null,

    init() {
      if (typeof window !== 'undefined') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          try {
            this.ctx = new AudioContext();
          } catch (e) {}
        }
      }
    },

    ensureContext() {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          try {
            this.ctx = new AudioContext();
          } catch (e) {}
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    },

    // Procedural Gunshot synthesis with punchy noise transient & low-end thump
    playGunshot(type = 'm4a1') {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Noise Burst Transient
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.035));
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(type === 'deagle' ? 1200 : 2200, now);
      noiseFilter.Q.setValueAtTime(1.2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start(now);

      // 2. Low-Frequency Sub Thump
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(type === 'deagle' ? 140 : 180, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.16);

      oscGain.gain.setValueAtTime(0.85, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    },

    playReloadSound() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Quick metallic magazine click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.08);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    },

    playHitmarker(isHeadshot = false) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isHeadshot ? 'sine' : 'square';
      osc.frequency.setValueAtTime(isHeadshot ? 2200 : 1100, now);
      osc.frequency.exponentialRampToValueAtTime(isHeadshot ? 1600 : 700, now + 0.07);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    },

    playExplosionSound() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Heavy distorted sub bass rumble
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(22, now + 0.85);

      gain.gain.setValueAtTime(1.0, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);

      // Billowing noise decay
      const bufferSize = ctx.sampleRate * 0.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.25));
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, now);
      filter.frequency.linearRampToValueAtTime(80, now + 0.8);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.9, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      noiseSource.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noiseSource.start(now);
    },

    playImpact(material = 'concrete') {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (material === 'metal') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  };

  // =========================================================================
  // SECTION 9: ENGINE CORE API & LIFECYCLE
  // =========================================================================

  const Engine = {
    scene: null,
    camera: null,
    renderer: null,
    colliders: Physics.colliders,
    barrels: [],
    explosiveBarrels: null, // Alias for weapon raycasting
    lights: {},
    damageCallbacks: [],

    screenShake: {
      intensity: 0,
      decay: 4.5,
      offset: null
    },

    Audio: AudioSys,

    /**
     * Engine.init(container)
     * Initializes Three.js WebGLRenderer with PCFSoftShadowMap, ACESFilmicToneMapping,
     * Atmospheric lighting, Fog, Tactical Map, Colliders, Barrels, Dust Motes, and VFX.
     */
    init(container) {
      const THREE = getTHREE();
      if (!THREE) {
        console.error("StrikeOps Engine: THREE is not defined.");
        return;
      }

      Physics.init();
      AudioSys.init();

      this.colliders = Physics.colliders;
      this.barrels = [];
      this.explosiveBarrels = this.barrels; // Alias

      this.screenShake.offset = new THREE.Vector3();

      // 1. Scene Setup & Tactical Fog
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x181f26);
      this.scene.fog = new THREE.FogExp2(0x181f26, 0.0115);

      // 2. Camera Setup
      const width = (container && container.clientWidth) ? container.clientWidth : (typeof window !== 'undefined' ? window.innerWidth : 1280);
      const height = (container && container.clientHeight) ? container.clientHeight : (typeof window !== 'undefined' ? window.innerHeight : 720);
      this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 300);
      this.camera.position.set(0, 1.8, 15);

      // 3. WebGLRenderer Setup
      const isCanvas = container && container.tagName === 'CANVAS';
      const rendererConfig = {
        antialias: true,
        powerPreference: 'high-performance'
      };
      if (isCanvas) {
        rendererConfig.canvas = container;
      }
      this.renderer = new THREE.WebGLRenderer(rendererConfig);
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1);

      // High-End Shadow Map & Tone Mapping
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      if (THREE.sRGBEncoding) {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }

      if (container && container.appendChild && !isCanvas) {
        container.appendChild(this.renderer.domElement);
      }

      // 4. Initialize Procedural Materials
      MaterialFactory.init();

      // 5. Atmospheric Tactical Lighting
      this.setupLighting();

      // 6. Build Tactical Military Compound Map
      MapBuilder.build(this.scene);

      // 7. VFX & Dust Systems
      VFX.init(this.scene);
      Atmosphere.init(this.scene);

      // Resize listener
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', () => {
          const w = (container && container.clientWidth) ? container.clientWidth : window.innerWidth;
          const h = (container && container.clientHeight) ? container.clientHeight : window.innerHeight;
          this.resize(w, h);
        });
      }

      return this;
    },

    setupLighting() {
      const THREE = getTHREE();

      // 1. Ambient Hemisphere Light (Sky Blue / Ground Dusty Gray)
      const hemiLight = new THREE.HemisphereLight(0x7da2c4, 0x36322b, 0.52);
      hemiLight.position.set(0, 50, 0);
      this.scene.add(hemiLight);
      this.lights.hemi = hemiLight;

      // 2. Angled Directional Sunlight (2048 Shadow Resolution)
      const sunLight = new THREE.DirectionalLight(0xfff0dc, 1.35);
      sunLight.position.set(55, 75, 45);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 220;
      sunLight.shadow.camera.left = -65;
      sunLight.shadow.camera.right = 65;
      sunLight.shadow.camera.top = 65;
      sunLight.shadow.camera.bottom = -65;
      sunLight.shadow.bias = -0.0003;
      sunLight.shadow.radius = 1.4;
      this.scene.add(sunLight);
      this.lights.sun = sunLight;

      // 3. Warehouse Warm Tungsten Interior Point Lights
      const warmLight1 = new THREE.PointLight(0xff9933, 2.2, 28, 2.0);
      warmLight1.position.set(0, 7.5, -8);
      this.scene.add(warmLight1);

      const warmLight2 = new THREE.PointLight(0xff9933, 2.2, 28, 2.0);
      warmLight2.position.set(0, 7.5, 8);
      this.scene.add(warmLight2);

      // Industrial wire cage hanging fixtures
      const cageGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.6, 8, 1, true);
      const cageMat = MaterialFactory.materials.steelStructure;
      const cage1 = new THREE.Mesh(cageGeo, cageMat);
      cage1.position.copy(warmLight1.position);
      this.scene.add(cage1);
      const cage2 = new THREE.Mesh(cageGeo, cageMat);
      cage2.position.copy(warmLight2.position);
      this.scene.add(cage2);
    },

    createBarrel(x, y, z, id) {
      const barrel = new ExplosiveBarrel(x, y, z, id);
      this.barrels.push(barrel);
      this.explosiveBarrels = this.barrels;
      return barrel;
    },

    /**
     * Engine.update(delta)
     */
    update(delta = 0.016) {
      VFX.update(delta);
      Atmosphere.update(delta);

      // Screen Shake damping
      if (this.screenShake.intensity > 0) {
        this.screenShake.intensity = Math.max(0, this.screenShake.intensity - delta * this.screenShake.decay);
        const power = this.screenShake.intensity;
        this.screenShake.offset.set(
          (Math.random() - 0.5) * power * 0.8,
          (Math.random() - 0.5) * power * 0.8,
          (Math.random() - 0.5) * power * 0.8
        );
      } else {
        this.screenShake.offset.set(0, 0, 0);
      }
    },

    /**
     * Engine.render()
     */
    render() {
      if (this.renderer && this.scene && this.camera) {
        if (this.screenShake.intensity > 0) {
          this.camera.position.add(this.screenShake.offset);
          this.renderer.render(this.scene, this.camera);
          this.camera.position.sub(this.screenShake.offset);
        } else {
          this.renderer.render(this.scene, this.camera);
        }
      }
    },

    /**
     * Engine.resize(width, height)
     */
    resize(width, height) {
      if (!this.camera || !this.renderer) return;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    },

    // Physics Delegates
    checkCollision(position, radius, height) {
      return Physics.checkCollision(position, radius, height);
    },

    getFloorHeight(x, z, currentY) {
      return Physics.getFloorHeight(x, z, currentY);
    },

    raycast(origin, direction, maxDistance) {
      return Physics.raycast(origin, direction, maxDistance);
    },

    registerCollider(box, metadata) {
      return Physics.registerCollider(box, metadata);
    },

    removeCollider(collider) {
      return Physics.removeCollider(collider);
    },

    // VFX Delegates
    triggerExplosion(position, radius, damage) {
      VFX.triggerExplosion(position, radius, damage);
    },

    spawnBulletImpact(position, normal, materialType) {
      VFX.spawnBulletImpact(position, normal, materialType);
    },

    onExplosionDamage(callback) {
      if (typeof callback === 'function') {
        this.damageCallbacks.push(callback);
      }
    }
  };

  return Engine;
}));
