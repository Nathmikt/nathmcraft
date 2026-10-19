import * as THREE from 'three';

/**
 * Creates a soft glowing circular particle texture for spores / fireflies
 */
function createSporeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 12);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.25, 'rgba(254, 240, 138, 0.65)');
  grad.addColorStop(0.6, 'rgba(167, 243, 208, 0.25)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a stylized retro pixel-art leaf texture (16x16)
 */
function createLeafTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  // Pixel art autumn/forest leaf silhouette
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 16, 16);

  // Outer leaf shape in golden amber
  ctx.fillStyle = '#d97706';
  ctx.fillRect(5, 2, 6, 2);
  ctx.fillRect(3, 4, 10, 4);
  ctx.fillRect(2, 8, 12, 4);
  ctx.fillRect(4, 12, 8, 2);
  ctx.fillRect(7, 14, 2, 2); // stem tip

  // Inner warm highlight
  ctx.fillStyle = '#fde047';
  ctx.fillRect(5, 5, 5, 3);
  ctx.fillRect(4, 8, 7, 2);

  // Central vein
  ctx.fillStyle = '#92400e';
  ctx.fillRect(7, 3, 2, 10);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class AtmosphereParticles {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;

    this.initSpores();
    this.initLeaves();
  }

  initSpores() {
    this.sporeCount = 55;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.sporeCount * 3);
    const colors = new Float32Array(this.sporeCount * 3);
    this.sporeData = [];

    const palette = [
      new THREE.Color(0xffe082), // warm fairy gold
      new THREE.Color(0x67e8f9), // ethereal cyan
      new THREE.Color(0xa7f3d0), // mystical jade
      new THREE.Color(0xfde047)  // golden sun speck
    ];

    for (let i = 0; i < this.sporeCount; i++) {
      const x = -16 + Math.random() * 32;
      const y = 0.4 + Math.random() * 3.8;
      const z = -50 + Math.random() * 62;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      this.sporeData.push({
        baseY: y,
        speedX: 0.12 + Math.random() * 0.18,
        bobFreq: 1.0 + Math.random() * 1.5,
        bobAmp: 0.12 + Math.random() * 0.18,
        phase: Math.random() * Math.PI * 2
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.sporeMat = new THREE.PointsMaterial({
      size: 0.07,
      map: createSporeTexture(),
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      fog: true
    });

    this.spores = new THREE.Points(geo, this.sporeMat);
    this.spores.frustumCulled = false;
    this.scene.add(this.spores);
  }

  initLeaves() {
    this.leafCount = 24;
    const leafGeo = new THREE.PlaneGeometry(0.22, 0.16);
    const leafTex = createLeafTexture();

    const leafMat = new THREE.MeshBasicMaterial({
      map: leafTex,
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
      fog: true,
      toneMapped: false
    });

    this.leavesMesh = new THREE.InstancedMesh(leafGeo, leafMat, this.leafCount);
    this.leavesMesh.renderOrder = 3;
    this.leavesMesh.frustumCulled = false;

    this.leafData = [];
    this.dummy = new THREE.Object3D();

    for (let i = 0; i < this.leafCount; i++) {
      const data = {
        x: -14 + Math.random() * 28,
        y: 0.2 + Math.random() * 5.2,
        z: -48 + Math.random() * 60,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        fallSpeed: 0.35 + Math.random() * 0.45,
        spinSpeed: (Math.random() - 0.5) * 2.5,
        wobbleFreq: 1.8 + Math.random() * 1.5,
        wobbleAmp: 0.15 + Math.random() * 0.2,
        phase: Math.random() * Math.PI * 2,
        scale: 0.8 + Math.random() * 0.45
      };
      this.leafData.push(data);
    }

    this.scene.add(this.leavesMesh);
  }

  update(delta) {
    this.time += delta;

    // 1. Update Spores
    const posAttr = this.spores.geometry.attributes.position;
    const positions = posAttr.array;

    for (let i = 0; i < this.sporeCount; i++) {
      const d = this.sporeData[i];
      let x = positions[i * 3] + d.speedX * delta;
      let y = d.baseY + Math.sin(this.time * d.bobFreq + d.phase) * d.bobAmp;
      let z = positions[i * 3 + 2];

      // Wrap boundaries seamlessly
      if (x > 18) x = -18;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    posAttr.needsUpdate = true;

    // Twinkling pulse on spores
    this.sporeMat.opacity = 0.55 + Math.sin(this.time * 2.2) * 0.15;

    // 2. Update Falling Leaves
    for (let i = 0; i < this.leafCount; i++) {
      const l = this.leafData[i];

      l.y -= l.fallSpeed * delta;
      l.x += Math.sin(this.time * l.wobbleFreq + l.phase) * l.wobbleAmp * delta;
      l.rotX += l.spinSpeed * delta;
      l.rotZ += Math.cos(this.time * 2.0 + l.phase) * 1.2 * delta;

      // Respawn at canopy height once touching ground
      if (l.y <= 0.05) {
        l.y = 4.8 + Math.random() * 1.6;
        l.x = -14 + Math.random() * 28;
        l.z = -48 + Math.random() * 60;
      }

      this.dummy.position.set(l.x, l.y, l.z);
      this.dummy.rotation.set(l.rotX, l.rotY, l.rotZ);
      this.dummy.scale.set(l.scale, l.scale, l.scale);
      this.dummy.updateMatrix();

      this.leavesMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.leavesMesh.instanceMatrix.needsUpdate = true;
  }
}
