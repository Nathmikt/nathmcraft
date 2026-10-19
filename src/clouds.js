import * as THREE from 'three';
import { getPixelTexture } from './props.js';

export class CloudManager {
  constructor(scene, sunPosition) {
    this.scene = scene;
    this.clouds = [];
    this.sunPosition = sunPosition || new THREE.Vector3(20, 32, -26);

    // Light angle projection onto ground (y = 0)
    const invSunY = 1.0 / this.sunPosition.y;
    this.shadowOffsetXRatio = -this.sunPosition.x * invSunY;
    this.shadowOffsetZRatio = -this.sunPosition.z * invSunY;

    this.cloudTypes = [
      {
        cloud: '/game_assets/environment/clouds1.png',
        shadow: '/game_assets/environment/clouds1_shadow.png'
      },
      {
        cloud: '/game_assets/environment/clouds2.png',
        shadow: '/game_assets/environment/clouds2_shadow.png'
      },
      {
        cloud: '/game_assets/environment/clouds3.png',
        shadow: '/game_assets/environment/clouds3_shadow.png'
      }
    ];

    this.initClouds();
  }

  initClouds() {
    const COUNT = 16;
    const Z_MIN = -52;
    const Z_SPAN = 66; // Full map range: z from -52 (corridor end) to +14 (south wall)

    // Stratified 4x4 grid cells to ensure whole-sky coverage without diagonal alignment
    const cells = [];
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        cells.push({ c, r });
      }
    }
    // Fisher-Yates shuffle to break all spatial correlation
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = cells[i];
      cells[i] = cells[j];
      cells[j] = tmp;
    }

    for (let i = 0; i < COUNT; i++) {
      const cell = cells[i];
      // Truly scattered non-linear placement across the sky
      const startX = -50 + (cell.c + Math.random()) * 25;
      const startZ = Z_MIN + (cell.r + Math.random()) * (Z_SPAN / 4);

      // 3 distinct atmospheric speed/altitude layers (breaks up lockstep motion forever)
      const layerTier = i % 3;
      let startY, speed, size;
      if (layerTier === 0) {
        startY = 15.5 + Math.random() * 2.0;
        speed = 1.7 + Math.random() * 0.7; // Fast lower drift
        size = 8 + Math.random() * 3.5;
      } else if (layerTier === 1) {
        startY = 18.0 + Math.random() * 2.5;
        speed = 1.1 + Math.random() * 0.5; // Mid cumulus
        size = 11 + Math.random() * 4.5;
      } else {
        startY = 21.0 + Math.random() * 3.0;
        speed = 0.55 + Math.random() * 0.45; // Slow high-altitude formations
        size = 13 + Math.random() * 4.0;
      }

      const typeIndex = (i + Math.floor(Math.random() * 3)) % this.cloudTypes.length;
      this.spawnCloud(startX, startY, startZ, typeIndex, size, speed);
    }
  }

  spawnCloud(x, y, z, typeIndex, size, speed) {
    const type = this.cloudTypes[typeIndex];

    // Sky Cloud (Flat plane tilted slightly forward so bottom face is visible from ground, no razor edge)
    const cloudTex = getPixelTexture(type.cloud);
    const baseCloudOpacity = 0.88;
    const cloudMat = new THREE.MeshBasicMaterial({
      map: cloudTex,
      transparent: true,
      opacity: baseCloudOpacity,
      alphaTest: 0.01,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false
    });
    const cloudGeo = new THREE.PlaneGeometry(size, size * 0.65);
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMesh.rotation.x = Math.PI / 2 + 0.1;
    cloudMesh.position.set(x, y, z);
    cloudMesh.frustumCulled = false;
    this.scene.add(cloudMesh);

    // Ground Shadow (Flat horizontal plane gliding over terrain)
    const shadowTex = getPixelTexture(type.shadow);
    const baseShadowOpacity = 0.35;
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: baseShadowOpacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      fog: true,
      toneMapped: false
    });
    const shadowGeo = new THREE.PlaneGeometry(size * 1.05, size * 0.7);
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;

    const shadowX = x + this.shadowOffsetXRatio * y;
    const shadowZ = z + this.shadowOffsetZRatio * y;
    shadowMesh.position.set(shadowX, 0.02, shadowZ);
    shadowMesh.renderOrder = 1;
    shadowMesh.frustumCulled = false;
    this.scene.add(shadowMesh);

    this.clouds.push({
      cloudMesh,
      shadowMesh,
      cloudMat,
      shadowMat,
      baseCloudOpacity,
      baseShadowOpacity,
      x,
      y,
      z,
      size,
      speed,
      typeIndex
    });
  }

  update(delta) {
    const BOUND_LEFT = -50;
    const BOUND_RIGHT = 50;
    const FADE_MARGIN = 14;
    const Z_MIN = -52;
    const Z_SPAN = 66;

    for (const c of this.clouds) {
      c.x += c.speed * delta;

      // Graceful fade in on spawn side (BOUND_LEFT) and fade out on exit side (BOUND_RIGHT)
      let fade = 1.0;
      if (c.x < BOUND_LEFT + FADE_MARGIN) {
        fade = Math.max(0, (c.x - BOUND_LEFT) / FADE_MARGIN);
      } else if (c.x > BOUND_RIGHT - FADE_MARGIN) {
        fade = Math.max(0, (BOUND_RIGHT - c.x) / FADE_MARGIN);
      }

      c.cloudMat.opacity = c.baseCloudOpacity * fade;
      c.shadowMat.opacity = c.baseShadowOpacity * fade;

      // Wrap around with randomized negative offset so clouds re-enter asynchronously
      if (c.x > BOUND_RIGHT) {
        c.x = BOUND_LEFT - Math.random() * 28;
        c.z = Z_MIN + Math.random() * Z_SPAN;

        // Re-randomize altitude & speed tier on respawn
        const layerTier = Math.floor(Math.random() * 3);
        if (layerTier === 0) {
          c.y = 15.5 + Math.random() * 2.0;
          c.speed = 1.7 + Math.random() * 0.7;
        } else if (layerTier === 1) {
          c.y = 18.0 + Math.random() * 2.5;
          c.speed = 1.1 + Math.random() * 0.5;
        } else {
          c.y = 21.0 + Math.random() * 3.0;
          c.speed = 0.55 + Math.random() * 0.45;
        }

        c.cloudMesh.position.y = c.y;
        c.cloudMesh.position.z = c.z;
      }

      c.cloudMesh.position.x = c.x;

      // Update projected shadow position
      const shadowX = c.x + this.shadowOffsetXRatio * c.y;
      const shadowZ = c.z + this.shadowOffsetZRatio * c.y;
      c.shadowMesh.position.x = shadowX;
      c.shadowMesh.position.z = shadowZ;
    }
  }
}
