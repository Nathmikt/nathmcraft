import * as THREE from 'three';
import { getPixelTexture, makeCylindricalSpriteMaterial } from './props.js';
import { InteractableEntity } from './interactables.js';

export class Item {
  constructor(sceneOrOptions, maybeOptions = {}) {
    const isParentObj = sceneOrOptions && (sceneOrOptions.isObject3D || typeof sceneOrOptions.add === 'function');
    const options = isParentObj
      ? (typeof maybeOptions === 'string' ? { texture: maybeOptions } : maybeOptions)
      : sceneOrOptions;

    const scene = isParentObj ? sceneOrOptions : options.scene;

    const {
      id = 'item',
      name = 'Item',
      texture,
      textureUrl,
      x = 0,
      y = 0.4,
      z = 0,
      width = 0.45,
      height = 0.45,
      scale = null,
      layer = 1,
      renderOrder = 2,
      alphaTest = 0.5,
      cylindrical = true,
      // Hover / Bobbing
      bob = true,
      bobSpeed = 2.8,
      bobHeight = 0.04,
      bobOffset = Math.random() * Math.PI * 2,
      // Ground Shadow
      shadow = true,
      shadowRadius = 0.16,
      shadowColor = 0x030305,
      shadowOpacity = 0.35,
      shadowY = 0.015,
      // Interaction
      interactionRange = 2.0,
      itemType = 'consumable',
      quantity = 1,
      description = '',
      showObtainedDialogue = true,
      onPickup = null,
      onInventoryAdd = null,
      onPlaySfx = null,
      onNotify = null
    } = options;

    this.scene = scene;
    this.id = id;
    this.name = name;
    this.textureUrl = texture || textureUrl;
    this.x = x;
    this.baseY = y;
    this.z = z;
    this.itemType = itemType;
    this.quantity = quantity;
    this.description = description;
    this.showObtainedDialogue = Boolean(showObtainedDialogue);
    this.interactionRange = interactionRange;
    this.collected = false;

    this.bob = Boolean(bob);
    this.bobSpeed = bobSpeed;
    this.bobHeight = bobHeight;
    this.bobOffset = bobOffset;
    this.time = 0;

    this.onPickup = onPickup;
    this.onInventoryAdd = onInventoryAdd;
    this.onPlaySfx = onPlaySfx;
    this.onNotify = onNotify;

    const actualWidth = scale !== null ? scale : width;
    const actualHeight = scale !== null ? scale : height;

    // Nearest-neighbor 1:1 pixel art texture without mipmaps
    const tex = (this.textureUrl && typeof this.textureUrl === 'string')
      ? getPixelTexture(this.textureUrl, { mipmaps: false })
      : this.textureUrl;

    let spriteMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      alphaTest,
      fog: false,
      toneMapped: false
    });

    if (cylindrical) {
      spriteMat = makeCylindricalSpriteMaterial(spriteMat);
    }
    this.mat = spriteMat;

    // Sprite representation (Layer 1 keeps pixel art crisp)
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.layers.set(layer);
    this.sprite.scale.set(actualWidth, actualHeight, 1);
    this.sprite.center.set(0.5, 0.5);
    this.sprite.position.set(this.x, this.baseY, this.z);
    this.sprite.renderOrder = renderOrder;
    this.sprite.frustumCulled = false;
    this.sprite.userData = {
      type: 'Item',
      name: this.name,
      item: this
    };

    if (this.scene) {
      this.scene.add(this.sprite);
    }

    // Ground Shadow beneath item (stencil-compliant per Rule 3)
    this.shadow = null;
    this.shadowGeo = null;
    this.shadowMat = null;

    if (shadow) {
      this.shadowGeo = new THREE.CircleGeometry(shadowRadius, 16);
      this.shadowMat = new THREE.MeshBasicMaterial({
        color: shadowColor,
        transparent: true,
        opacity: shadowOpacity,
        depthWrite: false,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: THREE.NotEqualStencilFunc,
        stencilZPass: THREE.ReplaceStencilOp,
        fog: false,
        toneMapped: false
      });
      this.shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
      this.shadow.rotation.x = -Math.PI / 2;
      this.shadow.position.set(this.x, shadowY, this.z);
      this.shadow.renderOrder = 1;
      this.shadow.frustumCulled = false;
      this.shadow.userData = {
        type: 'ItemShadow',
        item: this
      };

      if (this.scene) {
        this.scene.add(this.shadow);
      }
    }

    // Interactable Entity
    this.interactable = new InteractableEntity({
      name: this.name,
      target: this.sprite,
      range: this.interactionRange,
      onInteract: (context) => this.interact(context)
    });
  }

  interact(context = {}) {
    if (this.collected) return;
    const { player, dialogue } = context;

    this.pickup(context);

    if (this.showObtainedDialogue && dialogue) {
      if (player) player.freeze();
      dialogue.startDialogue([`Obtained ${this.name}.`], () => {
        if (player) player.unfreeze();
      });
    }
  }

  update(delta) {
    if (this.collected) return;
    if (this.bob) {
      this.time += delta;
      const hover = Math.sin(this.time * this.bobSpeed + this.bobOffset) * this.bobHeight;
      this.sprite.position.y = this.baseY + hover;
      if (this.shadow) {
        const shadowScale = 1.0 - (hover / (this.bobHeight || 1)) * 0.15;
        this.shadow.scale.set(shadowScale, shadowScale, 1);
      }
    }
  }

  pickup({ player, dialogue, manager, gameState } = {}) {
    if (this.collected) return;
    this.collected = true;

    // 1. Visual Disappearance
    this.sprite.visible = false;
    if (this.shadow) {
      this.shadow.visible = false;
    }
    if (this.interactable) {
      this.interactable.enabled = false;
    }

    // 2. Inventory storage
    if (gameState) {
      if (!Array.isArray(gameState.inventory)) {
        gameState.inventory = [];
      }
      const existing = gameState.inventory.find(i => i.id === this.id);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + (this.quantity || 1);
      } else {
        gameState.inventory.push(this.toItemData());
      }
    }
    if (typeof this.onInventoryAdd === 'function') {
      this.onInventoryAdd({ item: this, player, gameState });
    }

    // 3. Room for Future Implementation: Disappearing SFX
    this.playPickupSound();
    if (typeof this.onPlaySfx === 'function') {
      this.onPlaySfx({ item: this });
    }

    // 4. Room for Future Implementation: Notification Prompt
    this.showNotification();
    if (typeof this.onNotify === 'function') {
      this.onNotify({ item: this, name: this.name });
    }

    // 5. Custom onPickup hook
    if (typeof this.onPickup === 'function') {
      this.onPickup({ item: this, player, dialogue, manager, gameState });
    }
  }

  playPickupSound() {
    // ROOM FOR FUTURE IMPLEMENTATION: SFX playback
    // audioManager.play('item_pickup', { volume: 0.8 });
  }

  showNotification() {
    // ROOM FOR FUTURE IMPLEMENTATION: Notification HUD banner
    // notificationManager.show(`Picked up ${this.name}`);
  }

  toItemData() {
    return {
      id: this.id,
      name: this.name,
      icon: this.textureUrl,
      type: this.itemType,
      quantity: this.quantity,
      description: this.description
    };
  }

  respawn() {
    this.collected = false;
    this.sprite.visible = true;
    if (this.shadow) this.shadow.visible = true;
    if (this.interactable) this.interactable.enabled = true;
  }

  dispose() {
    if (this.sprite) {
      if (this.sprite.parent) this.sprite.parent.remove(this.sprite);
      if (this.mat) this.mat.dispose();
    }
    if (this.shadow) {
      if (this.shadow.parent) this.shadow.parent.remove(this.shadow);
      if (this.shadowGeo) this.shadowGeo.dispose();
      if (this.shadowMat) this.shadowMat.dispose();
    }
  }
}

// Preset Fruit Item Classes
export class AppleItem extends Item {
  constructor(scene, options = {}) {
    super(scene, {
      id: 'apple_fruit',
      name: 'Apple',
      texture: '/game_assets/icons/apple_fruit.png',
      description: 'A crisp red apple. Smells sweet and fresh.',
      ...options
    });
  }
}

export class CherryItem extends Item {
  constructor(scene, options = {}) {
    super(scene, {
      id: 'cherry_fruit',
      name: 'Cherry',
      texture: '/game_assets/icons/cherry_fruit.png',
      description: 'A pair of glossy red cherries tied by a stem.',
      ...options
    });
  }
}

export class GreenFruitItem extends Item {
  constructor(scene, options = {}) {
    super(scene, {
      id: 'green_fruit',
      name: 'Green Fruit',
      texture: '/game_assets/icons/green_fruit.png',
      description: 'An unusual green fruit with a tart aroma.',
      ...options
    });
  }
}

export class OrangeFruitItem extends Item {
  constructor(scene, options = {}) {
    super(scene, {
      id: 'orange_fruit',
      name: 'Orange',
      texture: '/game_assets/icons/orange_fruit.png',
      description: 'A bright citrus fruit with a fragrant rind.',
      ...options
    });
  }
}

export class CursedFleshItem extends Item {
  constructor(scene, options = {}) {
    super(scene, {
      id: 'cursed_flesh',
      name: 'Cursed Flesh',
      texture: '/game_assets/icons/cursed_flesh.png',
      itemType: 'material',
      description: 'A cold, writhing mass of corrupted flesh. It emanates a faint, unsettling warmth.',
      ...options
    });
  }
}

export class PurifiedFleshItem extends Item {
  constructor(scene, options = {}) {
    super(scene, {
      id: 'purified_flesh',
      name: 'Purified Flesh',
      texture: '/game_assets/icons/purified_flesh.png',
      itemType: 'material',
      description: 'Cleansed in the pure waters of the fountain. It glows with an ethereal, serene light.',
      ...options
    });
  }
}
