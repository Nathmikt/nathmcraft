import * as THREE from 'three';

const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();

export function getPixelTexture(url, { mipmaps = true, filter = 'nearest' } = {}) {
  const cacheKey = `${url}:${mipmaps}:${filter}`;
  if (!textureCache.has(cacheKey)) {
    const tex = textureLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    if (filter === 'linear' || filter === 'pixelArt') {
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
    } else if (filter === 'nearestMipmap') {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestMipmapNearestFilter;
      tex.generateMipmaps = true;
    } else if (mipmaps) {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestMipmapLinearFilter;
      tex.generateMipmaps = true;
    } else {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
    }
    textureCache.set(cacheKey, tex);
  }
  return textureCache.get(cacheKey);
}

// Shared stencil shadow material:
// Prevents Z-fighting (depthWrite: false) and merges overlapping shadows seamlessly (stencil: ref 1)
// with zero double-darkening, layering, or strobing.
const sharedShadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x030305,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
  stencilWrite: true,
  stencilRef: 1,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilZPass: THREE.ReplaceStencilOp,
  fog: true,
  toneMapped: false
});

export function makeCylindricalSpriteMaterial(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      'mvPosition.xy += rotatedPosition;',
      `vec3 upInView = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
       mvPosition.xyz += vec3(1.0, 0.0, 0.0) * rotatedPosition.x + upInView * rotatedPosition.y;`
    );
  };
  material.customProgramCacheKey = () => (material.fog ? 'cyl_fog' : 'cyl_nofog');
  return material;
}

export class PropManager {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.props = [];
    this.swayProps = [];
    this.time = 0;

    // --- Smooth Resolution Transition Boundaries ---
    // Beyond fogBoundary (21.0m): 100% low-res retro (Layer 0, smudged 320x180)
    // Within nearBoundary (15.0m): 100% actual file resolution (Layer 1, crisp 1280x720, smudged model completely hidden)
    // In-between (15.0m - 21.0m): continuous smoothstep alpha cross-dissolve
    this.fogBoundary = 21.0;
    this.nearBoundary = 15.0;
  }

  /**
   * Add a reusable 2.5D billboard prop (tree, bush, rock, etc.)
   * @param {Object} options
   * @param {string} options.texture - Asset URL path
   * @param {number} options.x - World X position
   * @param {number} options.z - World Z position
   * @param {number} [options.width=5.0] - Width in world units
   * @param {number} [options.height=5.0] - Height in world units
   * @param {number} [options.yOffset=0] - Additional Y offset
   * @param {number} [options.anchorY=0.0625] - Vertical pivot point (bottom of visible trunk)
   * @param {number} [options.collisionRadius=0.5] - Player collision radius (0 for non-solid)
   * @param {boolean} [options.shadow=true] - Ground shadow indicator
   */
  addProp({
    texture,
    x,
    z,
    width = 5.0,
    height = 5.0,
    yOffset = 0,
    anchorY = 0.09375,
    collisionRadius = 0.5,
    shadow = true,
    shadowRadius = null,
    sway = false,
    swaySpeed = 2.0,
    swayAmp = 0.05
  }) {
    // 1. Low-res retro sprite (Layer 0: rendered to 320x180 retro target with distance fog)
    const lowTex = getPixelTexture(texture, { mipmaps: true, filter: 'nearest' });
    const lowMat = makeCylindricalSpriteMaterial(new THREE.SpriteMaterial({
      map: lowTex,
      transparent: true,
      opacity: 1.0,
      alphaTest: 0.001,
      fog: true,
      toneMapped: false
    }));
    const spriteLow = new THREE.Sprite(lowMat);
    spriteLow.scale.set(width, height, 1);
    spriteLow.center.set(0.5, anchorY);
    spriteLow.renderOrder = 2;
    spriteLow.position.set(x, yOffset, z);
    spriteLow.frustumCulled = false;
    spriteLow.layers.set(0);
    spriteLow.userData = { texture, x, z, width, height, yOffset, anchorY, collisionRadius };
    this.scene.add(spriteLow);

    // 2. High-res sprite (Layer 1: rendered to 1280x720 composite buffer with smooth alpha cross-dissolve)
    const highTex = getPixelTexture(texture, { mipmaps: false, filter: 'nearest' });
    const highMat = makeCylindricalSpriteMaterial(new THREE.SpriteMaterial({
      map: highTex,
      transparent: true,
      opacity: 0.0,
      alphaTest: 0.001,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    }));
    highMat.polygonOffset = true;
    highMat.polygonOffsetFactor = -4;
    highMat.polygonOffsetUnits = -4;

    const spriteHigh = new THREE.Sprite(highMat);
    spriteHigh.scale.set(width, height, 1);
    spriteHigh.center.set(0.5, anchorY);
    spriteHigh.renderOrder = 2;
    spriteHigh.position.set(x, yOffset, z);
    spriteHigh.frustumCulled = false;
    spriteHigh.layers.set(1);
    spriteHigh.visible = false;
    spriteHigh.userData = spriteLow.userData;
    this.scene.add(spriteHigh);

    let shadowMesh = null;
    if (shadow) {
      const sRadius = shadowRadius !== null ? shadowRadius : width * 0.16;
      const shadowGeo = new THREE.CircleGeometry(sRadius, 12);
      shadowMesh = new THREE.Mesh(shadowGeo, sharedShadowMaterial);
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.set(x, 0.01, z);
      shadowMesh.renderOrder = 1;
      shadowMesh.frustumCulled = false;
      this.scene.add(shadowMesh);
    }

    const propData = {
      sprite: spriteLow,
      spriteLow,
      spriteHigh,
      lowMat,
      highMat,
      x,
      z,
      radius: collisionRadius,
      sway,
      swaySpeed,
      swayAmp,
      swayPhase: Math.random() * Math.PI * 2
    };
    this.props.push(propData);
    if (sway) {
      this.swayProps.push(propData);
    }

    if (collisionRadius > 0) {
      this.colliders.push({ x, z, radius: collisionRadius });
    }

    return propData;
  }

  /**
   * Continuous smooth proximity resolution update:
   * - Distant (>= fogBoundary): High-res sprite invisible; 100% low-res retro sprite.
   * - Close (<= nearBoundary): Smudged model completely hidden; 100% high-res sprite at actual file resolution.
   * - Transition zone (nearBoundary..fogBoundary): Continuous smoothstep cross-dissolve (smudge fades out as high-res fades in).
   */
  updateResolution(playerPosition) {
    if (!playerPosition) return;
    const px = playerPosition.x;
    const pz = playerPosition.z;

    const dFar = this.fogBoundary;
    const dNear = this.nearBoundary;
    const dRange = dFar - dNear;

    for (let i = 0; i < this.props.length; i++) {
      const p = this.props[i];
      const dx = p.x - px;
      const dz = p.z - pz;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist >= dFar) {
        if (!p.spriteLow.visible) p.spriteLow.visible = true;
        p.lowMat.opacity = 1.0;
        p.lowMat.depthWrite = true;
        if (p.spriteHigh.visible) {
          p.spriteHigh.visible = false;
          p.highMat.opacity = 0.0;
        }
      } else if (dist <= dNear) {
        // Approached: smudged model is completely hidden, high-res is 100% opaque
        if (p.spriteLow.visible) p.spriteLow.visible = false;
        if (!p.spriteHigh.visible) p.spriteHigh.visible = true;
        p.highMat.opacity = 1.0;
        p.highMat.depthWrite = true;
        p.highMat.depthTest = true;
      } else {
        // Transition zone: smooth cross-fade without quantized depth self-interference
        const t = (dFar - dist) / dRange;
        const alpha = t * t * (3.0 - 2.0 * t);
        if (!p.spriteLow.visible) p.spriteLow.visible = true;
        if (!p.spriteHigh.visible) p.spriteHigh.visible = true;
        p.lowMat.opacity = 1.0 - alpha;
        p.lowMat.depthWrite = false;
        p.highMat.opacity = alpha;
        p.highMat.depthWrite = false;
        p.highMat.depthTest = true;
      }
    }
  }

  /**
   * Update frame logic:
   * - Proximity resolution transitions
   * - Gentle wind sway on foliage (bushes, grass)
   */
  update(delta, playerPosition) {
    this.updateResolution(playerPosition);

    if (this.swayProps.length > 0) {
      this.time += delta;
      for (let i = 0; i < this.swayProps.length; i++) {
        const p = this.swayProps[i];
        const rot = Math.sin(this.time * p.swaySpeed + p.swayPhase) * p.swayAmp;
        p.lowMat.rotation = rot;
        p.highMat.rotation = rot;
      }
    }
  }
}
