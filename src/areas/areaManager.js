export class AreaManager {
  constructor({ scene, player, transition, interactionManager }) {
    this.scene = scene;
    this.player = player;
    this.transition = transition;
    this.interactionManager = interactionManager;

    this.areas = new Map();
    this.currentArea = null;
    this.isTransitioning = false;
  }

  /**
   * Register an area definition into the manager.
   * @param {Object} area
   */
  registerArea(area) {
    this.areas.set(area.id, area);
    if (area.group) {
      area.group.visible = false;
    }
  }

  getArea(id) {
    return this.areas.get(id);
  }

  /**
   * Instantaneous area load (used at game initialization or under black transition).
   * @param {string} areaId
   * @param {string} spawnName
   */
  loadAreaInstant(areaId, spawnName = 'initial') {
    const nextArea = this.areas.get(areaId);
    if (!nextArea) {
      console.error(`Area "${areaId}" not found`);
      return;
    }

    if (this.currentArea && this.currentArea !== nextArea) {
      this.currentArea.onExit();
    }

    this.currentArea = nextArea;
    nextArea.onEnter(spawnName);

    // Apply area boundaries to player controller
    if (typeof nextArea.bounds === 'function') {
      this.player.setBoundsCallback(nextArea.bounds.bind(nextArea));
    }

    // Teleport player to defined spawn point
    const spawn = (nextArea.spawns && nextArea.spawns[spawnName]) ||
                  (nextArea.spawns && nextArea.spawns.initial) ||
                  (nextArea.spawns && Object.values(nextArea.spawns)[0]);

    if (spawn) {
      this.player.teleport(spawn.x, spawn.y, spawn.z, spawn.yaw, spawn.pitch || 0);
    }

    // Mount active interactables into interaction manager
    if (this.interactionManager) {
      this.interactionManager.setEntities(nextArea.interactables || []);
    }
  }

  /**
   * Smooth transition to target area:
   * 1. Screen fades to black
   * 2. Area swaps and player teleports
   * 3. Transition reveals from black to color
   * @param {string} areaId
   * @param {string} spawnName
   */
  async transitionTo(areaId, spawnName = 'from_gate') {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.player.freeze();

    try {
      // 1. Fade to black
      await this.transition.fadeToBlack({ duration: 0.6 });

      // 2. Switch area while screen is completely black
      this.loadAreaInstant(areaId, spawnName);

      // 3. Reveal new area: transition from black to color
      await this.transition.fadeFromBlack({ duration: 1.2 });
    } catch (err) {
      console.error('Area transition error:', err);
    } finally {
      this.player.unfreeze();
      this.isTransitioning = false;
    }
  }

  /**
   * Returns active area colliders for player collision checks.
   */
  getColliders() {
    return (this.currentArea && this.currentArea.propManager) ? this.currentArea.propManager.colliders : [];
  }

  /**
   * Returns active area PropManager.
   */
  getActivePropManager() {
    return this.currentArea ? this.currentArea.propManager : null;
  }

  /**
   * Frame update for active area.
   */
  update(delta, playerPosition) {
    if (this.currentArea && typeof this.currentArea.update === 'function') {
      this.currentArea.update(delta, playerPosition);
    }
  }
}
