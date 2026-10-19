import * as THREE from 'three';
import { PropManager, getPixelTexture } from './props.js';
import { CloudManager } from './clouds.js';
import { AtmosphereParticles } from './particles.js';

// Procedural texture for atmospheric God Rays (volumetric sunbeams)
function createGodRaysTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Vertical beam gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, 'rgba(255, 250, 225, 0.65)');
  grad.addColorStop(0.3, 'rgba(254, 240, 138, 0.38)');
  grad.addColorStop(0.7, 'rgba(253, 224, 71, 0.14)');
  grad.addColorStop(1.0, 'rgba(250, 204, 21, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);

  // Soft lateral edge feathering
  const hGrad = ctx.createLinearGradient(0, 0, 64, 0);
  hGrad.addColorStop(0.0, 'rgba(0,0,0,1)');
  hGrad.addColorStop(0.3, 'rgba(0,0,0,0)');
  hGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
  hGrad.addColorStop(1.0, 'rgba(0,0,0,1)');

  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, 64, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Procedural soft halo texture for bioluminescent mushroom pulse
function createMushroomGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(165, 243, 252, 0.85)');
  grad.addColorStop(0.28, 'rgba(56, 189, 248, 0.55)');
  grad.addColorStop(0.65, 'rgba(129, 140, 248, 0.22)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GodRays {
  constructor(scene, sunPosition) {
    this.scene = scene;
    this.time = 0;
    this.beams = [];

    const beamTex = createGodRaysTexture();
    const beamGeo = new THREE.PlaneGeometry(5.2, 28.0);

    const beamConfigs = [
      { x: 5.5, y: 10.0, z: -14.0, rotY: 0.2, rotZ: 0.52, rotX: -0.38, baseOp: 0.18, speed: 0.7 },
      { x: 2.0, y: 9.5, z: -9.0, rotY: -0.25, rotZ: 0.50, rotX: -0.42, baseOp: 0.22, speed: 0.9 },
      { x: -3.0, y: 9.0, z: -5.0, rotY: 0.15, rotZ: 0.55, rotX: -0.36, baseOp: 0.16, speed: 0.6 },
      { x: -7.0, y: 8.5, z: -1.0, rotY: -0.2, rotZ: 0.51, rotX: -0.40, baseOp: 0.14, speed: 0.8 },
      { x: 0.5, y: 9.5, z: -18.0, rotY: 0.35, rotZ: 0.54, rotX: -0.42, baseOp: 0.19, speed: 1.0 }
    ];

    for (let i = 0; i < beamConfigs.length; i++) {
      const cfg = beamConfigs[i];
      const mat = new THREE.MeshBasicMaterial({
        map: beamTex,
        transparent: true,
        opacity: cfg.baseOp,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
        toneMapped: false
      });
      const mesh = new THREE.Mesh(beamGeo, mat);
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.beams.push({ mesh, mat, cfg });
    }
  }

  update(delta) {
    this.time += delta;
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      const shimmer = Math.sin(this.time * b.cfg.speed + i * 1.5) * 0.04;
      b.mat.opacity = Math.max(0.04, b.cfg.baseOp + shimmer);
    }
  }
}

export class MushroomGlowManager {
  constructor(scene, mushroomData) {
    this.scene = scene;
    this.time = 0;
    this.glowSprites = [];

    const glowTex = createMushroomGlowTexture();
    const baseMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: true,
      toneMapped: false
    });

    for (let i = 0; i < mushroomData.length; i++) {
      const m = mushroomData[i];
      const sprite = new THREE.Sprite(baseMat.clone());
      const size = m.s * 1.4;
      sprite.scale.set(size, size, 1);
      sprite.position.set(m.x, 0.22, m.z);
      sprite.frustumCulled = false;
      this.scene.add(sprite);

      this.glowSprites.push({
        sprite,
        mat: sprite.material,
        baseOp: 0.32 + (i % 3) * 0.06,
        speed: 1.4 + (i % 4) * 0.25,
        phase: (i * 1.3) % (Math.PI * 2)
      });
    }
  }

  update(delta) {
    this.time += delta;
    for (let i = 0; i < this.glowSprites.length; i++) {
      const g = this.glowSprites[i];
      g.mat.opacity = g.baseOp * (0.65 + 0.35 * Math.sin(this.time * g.speed + g.phase));
    }
  }
}

// Procedural texture helpers for lightweight sun effects
function createSunGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 255, 220, 0.65)');
  grad.addColorStop(0.3, 'rgba(255, 220, 110, 0.35)');
  grad.addColorStop(0.7, 'rgba(255, 180, 60, 0.12)');
  grad.addColorStop(1, 'rgba(255, 140, 30, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSunRaysTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(64, 64);
  const numRays = 8;
  for (let i = 0; i < numRays; i++) {
    ctx.rotate((Math.PI * 2) / numRays);
    const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, 64);
    grad.addColorStop(0, 'rgba(255, 255, 220, 0.35)');
    grad.addColorStop(0.4, 'rgba(255, 235, 150, 0.18)');
    grad.addColorStop(1, 'rgba(255, 210, 100, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-6, 64);
    ctx.lineTo(6, 64);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBloodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const cx = 32;
  const cy = 32;

  // Layered irregular dark crimson blood splatter
  const drops = [
    { dx: 0, dy: 0, r: 15, c: '#4a0404' },
    { dx: 2, dy: -2, r: 12, c: '#6e0808' },
    { dx: -3, dy: 2, r: 10, c: '#880a0a' },
    { dx: 3, dy: 3, r: 8, c: '#a31010' },
    { dx: -1, dy: -3, r: 6, c: '#ba1616' },
    { dx: -13, dy: -7, r: 3.5, c: '#6e0808' },
    { dx: 14, dy: 8, r: 4.0, c: '#880a0a' },
    { dx: -10, dy: 13, r: 3.0, c: '#5a0606' },
    { dx: 12, dy: -11, r: 3.2, c: '#6e0808' },
    { dx: -17, dy: 3, r: 2.5, c: '#4a0404' },
    { dx: 7, dy: -16, r: 2.8, c: '#880a0a' },
    { dx: 3, dy: 18, r: 2.2, c: '#6e0808' },
    { dx: -8, dy: -14, r: 2.0, c: '#a31010' },
    { dx: 17, dy: -3, r: 2.4, c: '#5a0606' }
  ];

  for (const d of drops) {
    ctx.beginPath();
    ctx.arc(cx + d.dx, cy + d.dy, d.r, 0, Math.PI * 2);
    ctx.fillStyle = d.c;
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function createSkyGradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Linear gradient mapped to celestial sphere:
  // Top (Zenith, v=1.0) -> Center (Horizon, v=0.5) -> Base/Bottom (Nadir, v=0.0)
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#3E86EE');  // Top (Vibrant Sky Blue) - Zenith
  grad.addColorStop(0.20, '#5EA0F4'); // Upper Sky (Crisp Daylight Blue)
  grad.addColorStop(0.35, '#82B4F2'); // Mid Sky (Azure Blue)
  grad.addColorStop(0.44, '#A8C5EC'); // Lower Sky (Soft Sky Blue)
  grad.addColorStop(0.47, '#D8A688'); // Near Horizon (Gentle Warm Peach Transition)
  grad.addColorStop(0.50, '#D68958'); // Horizon (Muted Warm Sunset Orange Rim)
  grad.addColorStop(0.65, '#BF7446'); // Below Horizon (Deep Amber Base)
  grad.addColorStop(1.0, '#A66034');  // Base / Bottom - Nadir

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  return tex;
}

export function createFloorTexture(repeatX = 36, repeatZ = 76) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  // Lighter, lush green meadow base
  ctx.fillStyle = '#4ea82a';
  ctx.fillRect(0, 0, 16, 16);

  // Vibrant lime grass flecks
  ctx.fillStyle = '#5ec234';
  ctx.fillRect(2, 3, 3, 2);
  ctx.fillRect(8, 9, 3, 2);
  ctx.fillRect(12, 1, 2, 2);

  // Sunlit bright tips
  ctx.fillStyle = '#72d645';
  ctx.fillRect(3, 4, 1, 1);
  ctx.fillRect(9, 10, 1, 1);
  ctx.fillRect(13, 2, 1, 1);
  ctx.fillRect(5, 13, 2, 1);

  // Gentle depth tones
  ctx.fillStyle = '#429323';
  ctx.fillRect(10, 4, 2, 2);
  ctx.fillRect(4, 11, 2, 2);
  ctx.fillRect(0, 0, 1, 1);

  // Tiny colorful meadow flower specks (yellow and white daisies)
  ctx.fillStyle = '#fde047'; // Yellow flower
  ctx.fillRect(6, 6, 1, 1);
  ctx.fillRect(14, 12, 1, 1);
  ctx.fillStyle = '#ffffff'; // White daisy
  ctx.fillRect(1, 14, 1, 1);

  const floorTexture = new THREE.CanvasTexture(canvas);
  floorTexture.colorSpace = THREE.SRGBColorSpace;
  floorTexture.wrapS = THREE.RepeatWrapping;
  floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(repeatX, repeatZ);
  floorTexture.magFilter = THREE.NearestFilter;
  floorTexture.minFilter = THREE.NearestMipmapLinearFilter;
  floorTexture.generateMipmaps = true;
  return floorTexture;
}

export function createWall(parent, width, x, z, rotY = 0) {
  const collisionTex = getPixelTexture('/game_assets/environment/collision_background.png');
  const wallHeight = 5.2;
  const tex = collisionTex.clone();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(width / wallHeight, 1);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.2,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: false
  });

  const geo = new THREE.PlaneGeometry(width, wallHeight);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, wallHeight / 2, z);
  mesh.rotation.y = rotY;
  mesh.frustumCulled = false;
  mesh.userData = { type: 'Wall', width, height: wallHeight, x, z, rotY };
  parent.add(mesh);
  return mesh;
}

export { Gate, Door, GoldenGate, GoldenDoor } from './gate.js';

export function createGateMesh({ parent, x, y, z, rotY = 0 }) {
  const gateTex = getPixelTexture('/game_assets/environment/the_gate_basic.png', { mipmaps: false });
  const gateWidth = 3.2;
  const gateHeight = 3.2;
  const gateMat = new THREE.MeshBasicMaterial({
    map: gateTex,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    fog: true,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  const gateGeo = new THREE.PlaneGeometry(gateWidth, gateHeight);
  const gateMesh = new THREE.Mesh(gateGeo, gateMat);
  const posY = y !== undefined ? y : gateHeight / 2;
  gateMesh.position.set(x, posY, z);
  gateMesh.rotation.y = rotY;
  gateMesh.frustumCulled = false;
  gateMesh.userData = {
    type: 'Gate',
    texture: '/game_assets/environment/the_gate_basic.png',
    width: gateWidth,
    height: gateHeight,
    x,
    y: posY,
    z
  };
  parent.add(gateMesh);
  return gateMesh;
}

export function createGlobalEnvironment(scene) {
  // 1. Static 3D Sky Sphere (World-space celestial sphere, invariant to camera freelook)
  const skyTexture = createSkyGradientTexture();
  const skyGeo = new THREE.SphereGeometry(220, 32, 24);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.layers.set(0);
  skyMesh.frustumCulled = false;
  scene.add(skyMesh);

  // Background clear color & Distance Fog (matched to Horizon: Soft Sunset Orange #D68958)
  const fogColor = new THREE.Color('#D68958');
  scene.background = fogColor;
  const fog = new THREE.Fog(fogColor, 22.0, 56.0);
  scene.fog = fog;

  // Sun Position in Sky
  const sunPosition = new THREE.Vector3(20, 32, -26);

  // Lighting - Bright cheerful sunlight
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.05);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfffaed, 0.90);
  sunLight.position.copy(sunPosition);
  scene.add(sunLight);

  // Mountains Cylinder (Horizon background)
  const bgTex = getPixelTexture('/game_assets/environment/background.png');
  bgTex.wrapS = THREE.RepeatWrapping;
  bgTex.wrapT = THREE.ClampToEdgeWrapping;
  bgTex.repeat.set(16, 1);

  const bgRadius = 90;
  const bgHeight = 46;
  const bgGeo = new THREE.CylinderGeometry(bgRadius, bgRadius, bgHeight, 32, 1, true);
  const bgMat = new THREE.MeshBasicMaterial({
    map: bgTex,
    transparent: true,
    alphaTest: 0.2,
    side: THREE.BackSide,
    fog: true,
    toneMapped: false
  });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.position.set(0, 23, -20);
  bgMesh.frustumCulled = false;
  bgMesh.visible = false;
  scene.add(bgMesh);

  // Sun in the Sky with Glow & Light Rays
  const sunTex = getPixelTexture('/game_assets/environment/the_legendary_sun.png');
  const sunMat = new THREE.SpriteMaterial({
    map: sunTex,
    transparent: true,
    alphaTest: 0.2,
    fog: false,
    toneMapped: false
  });
  const sunSprite = new THREE.Sprite(sunMat);
  sunSprite.scale.set(7.5, 7.5, 1);
  sunSprite.position.copy(sunPosition);
  sunSprite.frustumCulled = false;
  scene.add(sunSprite);

  // Sun Glow Halo
  const glowMat = new THREE.SpriteMaterial({
    map: createSunGlowTexture(),
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const glowSprite = new THREE.Sprite(glowMat);
  glowSprite.scale.set(15, 15, 1);
  glowSprite.position.copy(sunPosition);
  glowSprite.frustumCulled = false;
  scene.add(glowSprite);

  // Sun Rays
  const raysMat = new THREE.SpriteMaterial({
    map: createSunRaysTexture(),
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
  const raysSprite = new THREE.Sprite(raysMat);
  raysSprite.scale.set(28, 28, 1);
  raysSprite.position.copy(sunPosition);
  raysSprite.frustumCulled = false;
  scene.add(raysSprite);

  // Clouds & Dynamic Shadows
  const cloudManager = new CloudManager(scene, sunPosition);

  // Atmospheric Particles
  const particles = new AtmosphereParticles(scene);

  // God Rays
  const godRays = new GodRays(scene, sunPosition);

  return {
    skyMesh,
    skyColor: fogColor,
    fogColor,
    fog,
    sunPosition,
    cloudManager,
    raysMat,
    godRays,
    particles
  };
}

export function createWorld(scene) {
  return createGlobalEnvironment(scene);
}

export { NPC, CloakedAngel } from './npc.js';

function createGroundFogTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(128, 128, 25, 128, 128, 128);
  // Center is clear so player & angel are not obscured
  grad.addColorStop(0, 'rgba(220, 240, 255, 0)');
  grad.addColorStop(0.28, 'rgba(220, 240, 255, 0)');
  // Mid ground mist ring
  grad.addColorStop(0.55, 'rgba(220, 242, 255, 0.42)');
  grad.addColorStop(0.78, 'rgba(210, 238, 255, 0.52)');
  // Edge fade
  grad.addColorStop(0.92, 'rgba(205, 235, 255, 0.22)');
  grad.addColorStop(1, 'rgba(205, 235, 255, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createVerticalFogTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Task 3: Soft gradient fading smoothly to zero well before eye level (1.2m)
  const grad = ctx.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, 'rgba(215, 240, 255, 0.32)');
  grad.addColorStop(0.25, 'rgba(215, 240, 255, 0.16)');
  grad.addColorStop(0.55, 'rgba(215, 240, 255, 0.03)');
  grad.addColorStop(0.75, 'rgba(215, 240, 255, 0)');
  grad.addColorStop(1, 'rgba(215, 240, 255, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GroundFog {
  constructor(scene) {
    this.time = 0;
    this.layers = [];

    const fogTex = createGroundFogTexture();
    const layerConfigs = [
      { radius: 15.5, y: 0.15, rotSpeed: 0.012, opacity: 0.45 },
      { radius: 14.0, y: 0.42, rotSpeed: -0.016, opacity: 0.4 },
      { radius: 12.5, y: 0.68, rotSpeed: 0.02, opacity: 0.35 }
    ];

    for (const cfg of layerConfigs) {
      const geo = new THREE.PlaneGeometry(cfg.radius * 2, cfg.radius * 2);
      const mat = new THREE.MeshBasicMaterial({
        map: fogTex,
        transparent: true,
        opacity: cfg.opacity,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, cfg.y, 0);
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.layers.push({ mesh, baseY: cfg.y, rotSpeed: cfg.rotSpeed });
    }

    // Task 3: Lower mist skirt to hug ground terrain (y=0.6, height=1.2) - no hard seam across tree trunks
    const vertTex = createVerticalFogTexture();
    const skirtGeo = new THREE.CylinderGeometry(13.2, 13.2, 1.2, 32, 1, true);
    const skirtMat = new THREE.MeshBasicMaterial({
      map: vertTex,
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.skirt = new THREE.Mesh(skirtGeo, skirtMat);
    this.skirt.position.set(0, 0.6, 0);
    this.skirt.frustumCulled = false;
    scene.add(this.skirt);
  }

  update(delta, playerPosition) {
    this.time += delta;
    const px = playerPosition ? playerPosition.x : 0;
    const pz = playerPosition ? playerPosition.z : 0;

    for (let i = 0; i < this.layers.length; i++) {
      const l = this.layers[i];
      l.mesh.rotation.z += l.rotSpeed * delta;
      l.mesh.position.set(
        px,
        l.baseY + Math.sin(this.time * 0.7 + i * 1.5) * 0.03,
        pz
      );
    }

    if (this.skirt) {
      this.skirt.position.set(px, 0.6, pz);
    }
  }
}
