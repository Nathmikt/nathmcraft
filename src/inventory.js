export class InventoryManager {
  constructor({ player, gameState, dialogue, crosshair = null }) {
    this.player = player;
    this.gameState = gameState;
    this.dialogue = dialogue;
    this.crosshair = crosshair || document.getElementById('crosshair');

    this.container = document.getElementById('inventory-container');
    this.gridEl = document.getElementById('inventory-grid');
    this.emptyEl = document.getElementById('inventory-empty');
    this.descNameEl = document.getElementById('inventory-desc-name');
    this.descTextEl = document.getElementById('inventory-desc-text');
    this.clickHint = document.getElementById('click-to-play');

    this.isOpen = false;
    this.selectedIndex = 0;
    this.columns = 6;
  }

  getItems() {
    return (this.gameState && Array.isArray(this.gameState.inventory))
      ? this.gameState.inventory
      : [];
  }

  open() {
    if (this.dialogue && this.dialogue.isActive) return;
    if (this.player && this.player.isFrozen) return;
    this.isOpen = true;

    if (this.player) {
      this.player.freeze();
    }

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    if (this.crosshair) {
      this.crosshair.classList.add('hidden');
    }

    if (this.clickHint) {
      this.clickHint.classList.add('hidden');
    }

    if (this.container) {
      this.container.classList.remove('hidden');
    }

    this.render();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    if (this.container) {
      this.container.classList.add('hidden');
    }

    if (this.crosshair) {
      this.crosshair.classList.remove('hidden');
    }

    if (this.clickHint) {
      this.clickHint.classList.remove('hidden');
    }

    if (this.player) {
      this.player.unfreeze();
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  render() {
    const items = this.getItems();

    if (items.length === 0) {
      if (this.gridEl) {
        this.gridEl.innerHTML = '';
        this.gridEl.classList.add('hidden');
      }
      if (this.emptyEl) {
        this.emptyEl.classList.remove('hidden');
      }
      this.selectedIndex = -1;
      this.updateDescription(null);
      return;
    }

    if (this.emptyEl) {
      this.emptyEl.classList.add('hidden');
    }
    if (this.gridEl) {
      this.gridEl.classList.remove('hidden');
      this.gridEl.innerHTML = '';
    }

    if (this.selectedIndex < 0 || this.selectedIndex >= items.length) {
      this.selectedIndex = 0;
    }

    items.forEach((item, index) => {
      const slot = document.createElement('div');
      slot.className = `inventory-slot ${index === this.selectedIndex ? 'selected' : ''}`;

      if (item.icon) {
        const img = document.createElement('img');
        img.className = 'inventory-icon';
        img.src = item.icon;
        img.alt = item.name || 'Item';
        slot.appendChild(img);
      }

      if (item.quantity && item.quantity > 1) {
        const qty = document.createElement('span');
        qty.className = 'inventory-qty';
        qty.textContent = `x${item.quantity}`;
        slot.appendChild(qty);
      }

      slot.addEventListener('mouseenter', () => {
        this.selectIndex(index);
      });

      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectIndex(index);
      });

      this.gridEl.appendChild(slot);
    });

    this.updateDescription(items[this.selectedIndex]);
  }

  selectIndex(index) {
    const items = this.getItems();
    if (items.length === 0) return;

    this.selectedIndex = Math.max(0, Math.min(index, items.length - 1));

    if (this.gridEl) {
      const slots = this.gridEl.children;
      for (let i = 0; i < slots.length; i++) {
        slots[i].classList.toggle('selected', i === this.selectedIndex);
      }
    }

    this.updateDescription(items[this.selectedIndex]);
  }

  updateDescription(item) {
    if (!this.descNameEl || !this.descTextEl) return;

    if (!item) {
      this.descNameEl.textContent = '';
      this.descTextEl.textContent = 'No item selected.';
      return;
    }

    this.descNameEl.textContent = item.name || 'Unknown Item';
    this.descTextEl.textContent = item.description || 'A mysterious item.';
  }

  navigate(dir) {
    const items = this.getItems();
    const total = items.length;
    if (total === 0) return;

    const cols = this.columns;
    let idx = this.selectedIndex;

    if (dir === 'right') {
      if (idx + 1 < total) {
        idx++;
      }
    } else if (dir === 'left') {
      if (idx - 1 >= 0) {
        idx--;
      }
    } else if (dir === 'down') {
      if (idx + cols < total) {
        idx += cols;
      }
    } else if (dir === 'up') {
      if (idx - cols >= 0) {
        idx -= cols;
      }
    }

    this.selectIndex(idx);
  }

  handleKeyDown(e) {
    if (e.code === 'KeyI') {
      e.preventDefault();
      e.stopPropagation();
      if (this.player && this.player.isFrozen && !this.isOpen) return;
      this.toggle();
      return;
    }

    if (!this.isOpen) return;

    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }

    if (e.code === 'KeyD' || e.code === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      this.navigate('right');
    } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      this.navigate('left');
    } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      this.navigate('up');
    } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      this.navigate('down');
    }
  }

  handlePointerDown(e) {
    if (!this.isOpen) return;
    if (e && e.target && (e.target.closest('#inventory-box') || e.target.closest('#inventory-desc-box'))) {
      return;
    }
    this.close();
  }
}
