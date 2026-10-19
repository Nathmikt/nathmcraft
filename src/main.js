import * as THREE from 'three';
import { PlayerController } from './player.js';
import { createGlobalEnvironment } from './world.js';
import { AreaManager } from './areas/areaManager.js';
import { Area1 } from './areas/area1.js';
import { DialogueManager } from './dialogue.js';
import { TransitionManager } from './transition.js';
import { initAssetInspector } from './debug/assetInspector.js';
import { InteractionManager } from './interactables.js';
import { InventoryManager } from './inventory.js';
import { InputManager } from './input.js';

// Retro low-res base vertical height (180p) scaled dynamically to viewport aspect ratio
const RETRO_BASE_HEIGHT = 180;

function getDisplayDimensions() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(window.innerWidth * dpr));
  const height = Math.max(1, Math.round(window.innerHeight * dpr));
  const aspect = width / height;
  const retroHeight = RETRO_BASE_HEIGHT;
  const retroWidth = Math.max(1, Math.round(retroHeight * aspect));
  return { width, height, aspect, retroWidth, retroHeight };
}

const initDims = getDisplayDimensions();

const container = document.getElementById('game-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, initDims.aspect, 0.1, 300);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: true });
renderer.setSize(initDims.width, initDims.height, false);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// Retro low-res buffer with pixel-art nearest neighbor scaling, depth texture and stencil buffer
const retroDepthTexture = new THREE.DepthTexture(initDims.retroWidth, initDims.retroHeight, THREE.UnsignedInt248Type);
retroDepthTexture.format = THREE.DepthStencilFormat;

const retroTarget = new THREE.WebGLRenderTarget(initDims.retroWidth, initDims.retroHeight, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  colorSpace: THREE.SRGBColorSpace,
  depthTexture: retroDepthTexture,
  stencilBuffer: true
});

// Fullscreen quad for presenting retro world and copying 3D depth to screen
const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
const postScene = new THREE.Scene();
const postMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: retroTarget.texture },
    tDepth: { value: retroTarget.depthTexture }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      gl_FragColor = texel;
      gl_FragDepth = texture2D(tDepth, vUv).r;
    }
  `,
  depthTest: true,
  depthWrite: true
});
const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
postScene.add(postQuad);

// Composite target: combines retro world (passes 1-2) and high-res sprites (pass 3) at max native resolution
const compositeTarget = new THREE.WebGLRenderTarget(initDims.width, initDims.height, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  colorSpace: THREE.LinearSRGBColorSpace,
  depthBuffer: true
});

window.addEventListener('resize', () => {
  const { width, height, aspect, retroWidth, retroHeight } = getDisplayDimensions();
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  retroTarget.setSize(retroWidth, retroHeight);
  compositeTarget.setSize(width, height);
});

// Pass 4: Ethereal PS1 CRT Filter (Fullscreen edge-to-edge, no black bezel bars)
const crtScene = new THREE.Scene();
const crtMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: compositeTarget.texture }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float dist = dot(centered, centered);

      // 1. Discreet Chromatic Aberration (gentle RGB fringe at corners)
      vec2 ca = centered * (dist * 0.002);
      float r = texture2D(tDiffuse, clamp(uv + ca, 0.0, 1.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, clamp(uv - ca, 0.0, 1.0)).b;
      vec3 col = vec3(r, g, b);

      // 2. Discreet Scanlines (subtle 360-line pitch, light 3.5% depth)
      float scanline = sin(uv.y * 360.0 * 6.2831853) * 0.5 + 0.5;
      col *= 1.0 - (scanline * 0.035);

      // 3. Discreet Vignette (gentle corner falloff, center is 100% full brightness)
      float vignette = clamp(1.0 - dist * 0.18, 0.0, 1.0);
      col *= vignette;

      // 4. Ethereal Phosphor Glow (soft luminous highlight bloom)
      vec3 glow = max(col - 0.45, vec3(0.0)) * 0.10;
      col += glow;

      // 5. Decaying PS1 / Ethereal Warmth (discreet analog patina without desaturating)
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 sepia = vec3(luma * 1.05, luma * 0.98, luma * 0.90);
      col = mix(col, sepia, 0.04);
      col *= vec3(1.02, 1.00, 0.97);

      // 6. Proper sRGB gamma curve lifts midtones to bright, vibrant daylight colors
      col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false
});
const crtQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), crtMaterial);
crtScene.add(crtQuad);

// Setup Global Atmosphere & Environment
const { cloudManager, raysMat, particles, godRays, skyMesh, skyColor, fog } = createGlobalEnvironment(scene);

// Setup Player Controls
const player = new PlayerController(camera, renderer.domElement);

// Setup Transition System
export const transition = new TransitionManager({ player, startState: 'black' });

// Setup Dialogue System
const dialogue = new DialogueManager(() => {
  player.unfreeze();
});

// Central Interaction Manager & Game State
const gameState = {
  seenCorpse: false,
  lootedCorpse: false,
  angelTalkCount: 0,
  inventory: []
};

const crosshair = document.getElementById('crosshair');
const inventoryManager = new InventoryManager({ player, gameState, dialogue, crosshair });
const interactionManager = new InteractionManager({
  crosshair,
  dialogue,
  player,
  gameState,
  inventory: inventoryManager
});

// Setup Modular Area System (Area 1 only, other areas closed off)
const areaManager = new AreaManager({
  scene,
  player,
  transition,
  interactionManager
});

// Setup Unified Input Manager
const inputManager = new InputManager({
  player,
  dialogue,
  inventory: inventoryManager,
  interactables: interactionManager,
  transition,
  areaManager
});
interactionManager.inputManager = inputManager;

const area1 = new Area1({ scene, dialogue, gameState, areaManager });
areaManager.registerArea(area1);
areaManager.loadAreaInstant('area1', 'initial');

// Debug Asset Inspector Switch (Toggle with F2 or ~ when enabled)
// Automatically enabled locally (`npm run dev`), disabled on live production builds (`npm run build`)
const ENABLE_DEBUG_INSPECTOR = import.meta.env.DEV;
if (ENABLE_DEBUG_INSPECTOR) {
  initAssetInspector({ scene, camera, player, propManager: areaManager.getActivePropManager() });
}

// --- nathmcraft Discord Copy & Steam Key Webhook Helpers ---
function getWebhookUrl() {
  const K = 0x57;
  const P = [
    "PyMjJyRteHgzPiQ0OCUzeTQ4Ong2Jz54IDI1Pzg4PA==",
    "JHhmYmRnYGdkZWJlZWJhZ2FgYWVieGNiPAQ/Fh4+Gw==",
    "BAcUb2M8HQQkBzUNOhY2FSA8ZSExNh8kAi04M28weg==",
    "GR4vMWEiHz4mMTwlIy47OA8zBTQ+Im8kGB4+OQ=="
  ];
  return P.map(p => {
    const bin = atob(p);
    let s = '';
    for (let i = 0; i < bin.length; i++) {
      s += String.fromCharCode(bin.charCodeAt(i) ^ K);
    }
    return s;
  }).join('');
}

let toastTimeout;
function showToast(msg = "Username copied: nathm.") {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toast-text');
  if (!toast) return;
  if (toastText) toastText.textContent = msg;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

function fallbackCopy(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast();
  } catch (err) {
    console.error('Failed to copy', err);
  }
  document.body.removeChild(textArea);
}

window.copyDiscordUsername = function copyDiscordUsername() {
  const textToCopy = "nathm.";
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy).then(() => showToast()).catch(() => fallbackCopy(textToCopy));
  } else {
    fallbackCopy(textToCopy);
  }
};

const steamModal = document.getElementById('steam-key-modal');
const closeSteamBtn = document.getElementById('close-steam-modal');
const steamKeyInput = document.getElementById('steam-key-input');
const steamForm = document.getElementById('steam-key-form');

window.openSteamKeyModal = function openSteamKeyModal() {
  if (!steamModal) return;
  player.freeze();
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
  steamModal.classList.remove('hidden');
  setTimeout(() => {
    if (steamKeyInput) steamKeyInput.focus();
  }, 50);
};

window.closeSteamKeyModal = function closeSteamKeyModal() {
  if (!steamModal) return;
  steamModal.classList.add('hidden');
  player.unfreeze();
};

if (closeSteamBtn) {
  closeSteamBtn.addEventListener('click', () => {
    window.closeSteamKeyModal();
  });
}

if (steamForm) {
  steamForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const codeInput = steamKeyInput ? steamKeyInput.value.trim() : '';
    const submitBtn = document.getElementById('submit-btn');

    if (!codeInput) {
      showToast('Please enter a Steam code first.');
      return;
    }

    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      showToast('Webhook URL invalid.');
      return;
    }

    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'SENDING...';

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: "🎮 **New Steam Code Submitted:** `" + codeInput + "`"
        })
      });

      if (response.ok) {
        submitBtn.textContent = 'SUCCESS!';
        showToast('Steam key submitted to Discord queue!');
        if (steamKeyInput) steamKeyInput.value = '';
        setTimeout(() => {
          window.closeSteamKeyModal();
        }, 1000);
      } else {
        submitBtn.textContent = 'ERROR';
        showToast('Server error: ' + response.status);
      }
    } catch (error) {
      console.error('Error submitting code:', error);
      submitBtn.textContent = 'ERROR';
      showToast('Network error submitting Steam key.');
    } finally {
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }, 2000);
    }
  });
}

// Opening eye reveal into Area 1 facing the Hooded Angel
setTimeout(() => {
  dialogue.startDialogue([
    "nathmcraft — Indie Game Studio.",
    "Made with dreams."
  ], () => {
    transition.openEyes({ duration: 2.2, delay: 0.1 });
  });
}, 250);

// Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  player.update(delta, areaManager.getColliders());

  if (cloudManager) cloudManager.update(delta);
  if (raysMat) raysMat.rotation += delta * 0.04;
  if (godRays) godRays.update(delta);
  if (particles) particles.update(delta);
  if (skyMesh) skyMesh.position.copy(camera.position);

  // Updates active area props, proximity resolution & entities
  areaManager.update(delta, player.position);

  // Reticle aiming & interaction check against registered world entities
  interactionManager.update(camera);

  // --- Multi-Pass Composition ---
  // Pass 1: Render retro environment (layer 0) to 320x180 low-res target with depth fog
  camera.layers.set(0);
  scene.background = skyColor;
  scene.fog = fog;
  renderer.setRenderTarget(retroTarget);
  renderer.render(scene, camera);

  // Pass 2: Blit 320x180 retro target to 1280x720 composite buffer (copying 3D depth)
  renderer.setRenderTarget(compositeTarget);
  renderer.render(postScene, postCamera);

  // Pass 3: High-Res Pass (layer 1) into composite buffer
  camera.layers.set(1);
  scene.background = null;
  scene.fog = null;
  renderer.autoClear = false;
  renderer.render(scene, camera);
  renderer.autoClear = true;
  camera.layers.set(0);
  scene.background = skyColor;
  scene.fog = fog;

  // Pass 4: Ethereal PS1 CRT Filter blit to final screen canvas
  renderer.setRenderTarget(null);
  renderer.render(crtScene, postCamera);
}

animate();
