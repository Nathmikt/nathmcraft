import * as THREE from 'three';

/**
 * Generic Interactable Entity.
 * Decouples the 3D model/sprite and its world placement from its interaction role
 * (NPC dialogue, inspection text, lootable item, shrine boon, event trigger, etc.).
 */
export class InteractableEntity {
  /**
   * @param {Object} options
   * @param {string} options.name - Human-readable identifier (e.g. "The Angel", "The Corpse")
   * @param {THREE.Object3D|THREE.Object3D[]} options.target - Mesh/sprite or array of meshes/sprites to raycast against
   * @param {number} [options.range=2.6] - Maximum distance in meters to interact
   * @param {Function} options.onInteract - Callback ({ player, dialogue, entity, manager }) => void
   */
  constructor({ name, target, range = 2.6, onInteract }) {
    this.name = name;
    this.targets = Array.isArray(target) ? target : [target];
    this.range = range;
    this.onInteract = onInteract;
    this.enabled = true;

    // Tag targets with metadata for debugging / inspector
    for (const obj of this.targets) {
      if (obj && obj.userData) {
        obj.userData.interactableName = name;
      }
    }
  }

  interact(context) {
    if (!this.enabled) return;
    if (typeof this.onInteract === 'function') {
      this.onInteract({ ...context, entity: this });
    }
  }
}

/**
 * Central Interaction Manager.
 * Handles reticle raycasting, distance checks, crosshair UI states, and input dispatch.
 */
export class InteractionManager {
  constructor({ crosshair, dialogue, player, gameState = {}, inventory = null, inputManager = null }) {
    this.crosshair = crosshair;
    this.dialogue = dialogue;
    this.player = player;
    this.gameState = gameState;
    this.inventory = inventory;
    this.inputManager = inputManager;

    this.entities = [];
    this.activeEntity = null;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.enableAll();
    this.screenCenter = new THREE.Vector2(0, 0);
  }

  isInteractionBlocked() {
    if (this.inputManager) {
      return this.inputManager.getMode() !== 'EXPLORATION';
    }
    return Boolean(
      (this.dialogue && this.dialogue.isActive) ||
      (this.inventory && this.inventory.isOpen) ||
      (this.player && this.player.isFrozen)
    );
  }

  /**
   * Register an interactable entity into the world.
   * @param {InteractableEntity} entity
   * @returns {InteractableEntity}
   */
  register(entity) {
    this.entities.push(entity);
    return entity;
  }

  /**
   * Set active entity list directly (e.g. on area transition).
   * @param {InteractableEntity[]} entities
   */
  setEntities(entities) {
    this.entities = Array.isArray(entities) ? [...entities] : [];
    this.activeEntity = null;
    if (this.crosshair) this.crosshair.classList.remove('interactable');
  }

  /**
   * Clear all registered entities.
   */
  clear() {
    this.entities = [];
    this.activeEntity = null;
    if (this.crosshair) this.crosshair.classList.remove('interactable');
  }

  /**
   * Unregister an entity (e.g. after item is looted or consumed).
   * @param {InteractableEntity} entity
   */
  unregister(entity) {
    this.entities = this.entities.filter(e => e !== entity);
    if (this.activeEntity === entity) {
      this.activeEntity = null;
      if (this.crosshair) this.crosshair.classList.remove('interactable');
    }
  }

  /**
   * Called every frame in animate() loop to test center-screen aiming against registered entities.
   * @param {THREE.Camera} camera
   */
  update(camera) {
    if (this.isInteractionBlocked()) {
      this.activeEntity = null;
      if (this.crosshair) this.crosshair.classList.remove('interactable');
      return;
    }

    const candidateObjects = [];
    const objectToEntity = new Map();

    for (let i = 0; i < this.entities.length; i++) {
      const ent = this.entities[i];
      if (!ent.enabled) continue;

      for (let j = 0; j < ent.targets.length; j++) {
        const obj = ent.targets[j];
        if (obj && obj.visible !== false) {
          obj.updateMatrixWorld();
          candidateObjects.push(obj);
          objectToEntity.set(obj, ent);
        }
      }
    }

    camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.screenCenter, camera);
    const hits = this.raycaster.intersectObjects(candidateObjects, false);

    this.activeEntity = null;
    if (hits.length > 0) {
      const hit = hits[0];
      const entity = objectToEntity.get(hit.object);
      if (entity && hit.distance <= entity.range) {
        this.activeEntity = entity;
      }
    }

    if (this.crosshair) {
      this.crosshair.classList.toggle('interactable', this.activeEntity !== null);
    }
  }

  triggerInteraction() {
    if (this.isInteractionBlocked()) return;
    if (!this.activeEntity) return;

    this.activeEntity.interact({
      player: this.player,
      dialogue: this.dialogue,
      manager: this,
      gameState: this.gameState
    });
  }
}
