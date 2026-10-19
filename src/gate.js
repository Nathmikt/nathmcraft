import * as THREE from 'three';
import { getPixelTexture } from './props.js';
import { InteractableEntity } from './interactables.js';

/**
 * Reusable Gate / Door entity.
 * Supports custom sprites, positions, lock state, required keys, and interactive dialogues.
 */
export class Gate {
  /**
   * @param {THREE.Object3D|Object} parentOrOptions - Parent Object3D or options object
   * @param {Object} [maybeOptions={}] - Options if parent was first argument
   */
  constructor(parentOrOptions, maybeOptions = {}) {
    const isParentObj = parentOrOptions && (parentOrOptions.isObject3D || typeof parentOrOptions.add === 'function');
    const options = isParentObj ? maybeOptions : (parentOrOptions || {});
    const parent = isParentObj ? parentOrOptions : (options.parent || options.scene);

    const {
      name = 'The Gate',
      texture = '/game_assets/environment/the_gate_basic.png',
      textureUrl,
      x = 0,
      y,
      z = 0,
      rotY = 0,
      width = 3.2,
      height = 3.2,
      range = 2.8,
      interactionRange,
      isLocked = false,
      locked = false,
      requiredKey = null,
      lockedDialogue = [
        "A heavy gate sealed with a golden lock.",
        "It cannot be opened. It requires a golden key."
      ],
      onInteract = null,
      onOpen = null
    } = options;

    this.parent = parent;
    this.name = name;
    this.x = x;
    this.z = z;
    this.rotY = rotY;
    this.width = width;
    this.height = height;
    this.posY = y !== undefined ? y : height / 2;
    this.textureUrl = textureUrl || texture;
    this.range = interactionRange !== undefined ? interactionRange : range;
    this.isLocked = Boolean(isLocked || locked);
    this.requiredKey = requiredKey;
    this.lockedDialogue = Array.isArray(lockedDialogue) ? lockedDialogue : [lockedDialogue];
    this.customInteract = onInteract;
    this.onOpen = onOpen;

    // Gate mesh with pixel-art texture
    const gateTex = getPixelTexture(this.textureUrl, { mipmaps: false });
    this.material = new THREE.MeshBasicMaterial({
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

    this.geometry = new THREE.PlaneGeometry(this.width, this.height);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.set(this.x, this.posY, this.z);
    this.mesh.rotation.y = this.rotY;
    this.mesh.frustumCulled = false;
    this.mesh.userData = {
      type: 'Gate',
      texture: this.textureUrl,
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.posY,
      z: this.z,
      rotY: this.rotY,
      gate: this
    };

    if (this.parent) {
      this.parent.add(this.mesh);
    }

    // Interactive reticle entity
    this.interactable = new InteractableEntity({
      name: this.name,
      target: this.mesh,
      range: this.range,
      onInteract: (ctx) => this.handleInteract(ctx)
    });
  }

  handleInteract(ctx) {
    const { player, dialogue, gameState } = ctx;

    if (typeof this.customInteract === 'function') {
      this.customInteract({ ...ctx, gate: this });
      return;
    }

    const hasKey = Boolean(
      this.requiredKey && gameState && (
        gameState[this.requiredKey] ||
        gameState.hasGoldenKey ||
        (Array.isArray(gameState.inventory) && gameState.inventory.some(item => item.id === this.requiredKey))
      )
    );

    if (this.isLocked && !hasKey) {
      if (player && typeof player.freeze === 'function') {
        player.freeze();
      }
      if (dialogue) {
        dialogue.startDialogue(this.lockedDialogue, () => {
          if (player && typeof player.unfreeze === 'function') {
            player.unfreeze();
          }
        });
      }
      return;
    }

    if (typeof this.onOpen === 'function') {
      this.onOpen({ ...ctx, gate: this });
    }
  }

  unlock() {
    this.isLocked = false;
  }

  lock() {
    this.isLocked = true;
  }
}

/**
 * Specialized Golden Gate with golden lock sprite and default key requirement.
 */
export class GoldenGate extends Gate {
  constructor(parentOrOptions, maybeOptions = {}) {
    const isParentObj = parentOrOptions && (parentOrOptions.isObject3D || typeof parentOrOptions.add === 'function');
    const baseOpts = isParentObj ? maybeOptions : (parentOrOptions || {});
    const parent = isParentObj ? parentOrOptions : (baseOpts.parent || baseOpts.scene);

    super(parent, {
      name: 'Golden Gate',
      texture: '/game_assets/environment/the_gate_golden.png',
      isLocked: true,
      requiredKey: 'golden_key',
      lockedDialogue: [
        "A heavy gate sealed with a golden lock.",
        "It cannot be opened. It requires a golden key."
      ],
      ...baseOpts
    });
  }
}

// Aliases for "door" naming conventions
export { Gate as Door };
export { GoldenGate as GoldenDoor };
