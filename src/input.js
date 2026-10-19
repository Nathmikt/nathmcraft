/**
 * Unified Input & State Machine Manager.
 * Single point of entry for keyboard, mouse look, and pointer events.
 * Routes inputs according to active modal context:
 * - TRANSITION: Area loading, black screen fades, eye animations (all gameplay input suppressed)
 * - DIALOGUE: Active conversation / choice selection
 * - INVENTORY: Grid item inspection and navigation
 * - PAUSED: Pointer lock lost or game paused
 * - DISABLED: Scripted freeze or unready state
 * - EXPLORATION: Free walking, camera look, world interaction
 */

export const InputMode = {
  TRANSITION: 'TRANSITION',
  DIALOGUE: 'DIALOGUE',
  INVENTORY: 'INVENTORY',
  PAUSED: 'PAUSED',
  DISABLED: 'DISABLED',
  EXPLORATION: 'EXPLORATION'
};

export class InputManager {
  constructor({
    player = null,
    dialogue = null,
    inventory = null,
    interactables = null,
    transition = null,
    areaManager = null
  } = {}) {
    this.player = player;
    this.dialogue = dialogue;
    this.inventory = inventory;
    this.interactables = interactables;
    this.transition = transition;
    this.areaManager = areaManager;

    this.initEvents();
  }

  /**
   * Resolves current active input mode hierarchically.
   * Modal overlays and transitions take strict precedence.
   * @returns {string} One of InputMode values
   */
  getMode() {
    if (this.transition?.isTransitioning() || this.areaManager?.isTransitioning) {
      return InputMode.TRANSITION;
    }
    if (this.dialogue?.isActive) {
      return InputMode.DIALOGUE;
    }
    if (this.inventory?.isOpen) {
      return InputMode.INVENTORY;
    }
    if (this.player?.isPaused) {
      return InputMode.PAUSED;
    }
    if (this.player?.isFrozen) {
      return InputMode.DISABLED;
    }
    return InputMode.EXPLORATION;
  }

  initEvents() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('pointerdown', (e) => this.onPointerDown(e));
  }

  onKeyDown(e) {
    const steamModal = document.getElementById('steam-key-modal');
    if (steamModal && !steamModal.classList.contains('hidden')) {
      if (e.code === 'Escape' && typeof window.closeSteamKeyModal === 'function') {
        e.preventDefault();
        window.closeSteamKeyModal();
      }
      return;
    }

    const mode = this.getMode();

    // In any non-exploration mode, reset player movement keys to prevent sticking
    if (mode !== InputMode.EXPLORATION && this.player) {
      this.player.resetKeys();
    }

    if (mode === InputMode.TRANSITION || mode === InputMode.DISABLED) {
      return;
    }

    if (mode === InputMode.DIALOGUE) {
      this.dialogue?.handleKeyDown(e);
      return;
    }

    if (mode === InputMode.INVENTORY) {
      this.inventory?.handleKeyDown(e);
      return;
    }

    if (mode === InputMode.PAUSED) {
      return;
    }

    if (mode === InputMode.EXPLORATION) {
      if (e.code === 'KeyI') {
        e.preventDefault();
        this.player?.resetKeys();
        this.inventory?.open();
        return;
      }

      if (e.code === 'KeyE') {
        e.preventDefault();
        this.interactables?.triggerInteraction();
        return;
      }

      if (e.code === 'Escape') {
        if (this.player) this.player.isPaused = true;
        return;
      }

      this.player?.onKeyDown(e);
    }
  }

  onKeyUp(e) {
    // Key releases always reach player controller so keys never stick
    this.player?.onKeyUp(e);
  }

  onMouseMove(e) {
    const mode = this.getMode();
    if (mode === InputMode.EXPLORATION) {
      this.player?.onMouseMove(e);
    }
  }

  onPointerDown(e) {
    const steamModal = document.getElementById('steam-key-modal');
    if (steamModal && !steamModal.classList.contains('hidden')) {
      return;
    }

    const mode = this.getMode();

    if (mode === InputMode.TRANSITION || mode === InputMode.DISABLED) {
      return;
    }

    // Don't steal pointer lock if user clicked an input field or debug HUD
    if (e.target && (
      e.target.tagName === 'INPUT' ||
      e.target.tagName === 'TEXTAREA' ||
      e.target.tagName === 'BUTTON' ||
      e.target.closest('#steam-key-modal') ||
      e.target.closest('#debug-hud') ||
      e.target.closest('#debug-inspector-hud')
    )) {
      return;
    }

    if (mode === InputMode.DIALOGUE) {
      this.dialogue?.handlePointerDown(e);
      return;
    }

    if (mode === InputMode.INVENTORY) {
      this.inventory?.handlePointerDown(e);
      return;
    }

    if (mode === InputMode.EXPLORATION || mode === InputMode.PAUSED) {
      if (this.player) {
        const wasLocked = this.player.isLocked;
        this.player.isPaused = false;
        this.player.requestLock();
        window.focus();
        if (wasLocked && mode === InputMode.EXPLORATION && e.button === 0) {
          this.interactables?.triggerInteraction();
        }
      }
    }
  }
}
