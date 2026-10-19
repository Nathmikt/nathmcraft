import * as THREE from 'three';

export class PlayerController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.position = new THREE.Vector3(0.0, 1.2, 0.0);
    this.camera.position.copy(this.position);

    this.yaw = 0.0;
    this.pitch = 0;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.speed = 4.5;
    this.isLocked = false;
    this.isFrozen = false;
    this.isPaused = false;

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      turnLeft: false,
      turnRight: false
    };

    this.initEvents();
  }

  requestLock() {
    if (document.pointerLockElement !== this.domElement && !this.isPaused) {
      this.domElement.requestPointerLock();
    }
  }

  initEvents() {
    const clickHint = document.getElementById('click-to-play');

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      document.body.classList.toggle('locked', this.isLocked);
      if (clickHint) {
        clickHint.style.opacity = this.isLocked ? '0' : '1';
        clickHint.textContent = this.isPaused ? 'Paused — Click to Resume' : 'Click to Look around (WASD to walk)';
      }
      if (this.isLocked) {
        this.isPaused = false;
      }
    });
  }

  onMouseMove(e) {
    if (!this.isLocked || this.isFrozen) return;
    const sensitivity = 0.0022;
    this.yaw -= e.movementX * sensitivity;
    this.pitch -= e.movementY * sensitivity;
    // Clamp pitch to avoid flipping
    this.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch));
  }

  onKeyDown(e) {
    if (this.isFrozen) return;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = true;
    if (e.code === 'KeyA') this.keys.left = true;
    if (e.code === 'KeyD') this.keys.right = true;
    if (e.code === 'KeyQ' || e.code === 'ArrowLeft') this.keys.turnLeft = true;
    if (e.code === 'ArrowRight') this.keys.turnRight = true;
  }

  onKeyUp(e) {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
    if (e.code === 'KeyA') this.keys.left = false;
    if (e.code === 'KeyD') this.keys.right = false;
    if (e.code === 'KeyQ' || e.code === 'ArrowLeft') this.keys.turnLeft = false;
    if (e.code === 'ArrowRight') this.keys.turnRight = false;
  }

  resetKeys() {
    for (const key in this.keys) {
      this.keys[key] = false;
    }
  }

  setBoundsCallback(fn) {
    this.boundsCallback = fn;
  }

  teleport(x, y, z, yaw, pitch = 0) {
    this.position.set(x, y, z);
    if (typeof yaw === 'number') this.yaw = yaw;
    if (typeof pitch === 'number') this.pitch = pitch;
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.position.copy(this.position);
  }

  freeze() {
    this.isFrozen = true;
    this.resetKeys();
  }

  unfreeze() {
    this.isFrozen = false;
    this.resetKeys();
  }

  update(delta, colliders = []) {
    if (this.isFrozen) return;

    // Keyboard rotation support (Arrow keys / Q)
    const keyTurnSpeed = 2.0;
    if (this.keys.turnLeft) this.yaw += keyTurnSpeed * delta;
    if (this.keys.turnRight) this.yaw -= keyTurnSpeed * delta;

    // Compute forward & right vectors on XZ plane
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const move = new THREE.Vector3();
    if (this.keys.forward) move.add(forward);
    if (this.keys.backward) move.sub(forward);
    if (this.keys.right) move.add(right);
    if (this.keys.left) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.speed * delta);
      this.position.add(move);

      // Circle-circle collision against props
      const playerRadius = 0.3;
      for (const col of colliders) {
        const dx = this.position.x - col.x;
        const dz = this.position.z - col.z;
        const minDist = col.radius + playerRadius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const overlap = minDist - dist;
          this.position.x += (dx / dist) * overlap;
          this.position.z += (dz / dist) * overlap;
        }
      }

      // Level geometry boundary
      if (typeof this.boundsCallback === 'function') {
        this.boundsCallback(this.position);
      } else {
        // Default level geometry boundary: wide clearing tapering into narrow frontal corridor
        this.position.z = Math.max(-47.8, Math.min(13.2, this.position.z));
        let maxX = 13.2;
        if (this.position.z < -3.0 && this.position.z >= -12.0) {
          const t = (-3.0 - this.position.z) / 9.0;
          maxX = 13.2 - t * 9.6; // Tapers from 13.2 down to 3.6
        } else if (this.position.z < -12.0) {
          maxX = 3.6; // Narrow frontal corridor past the angel
        }
        this.position.x = Math.max(-maxX, Math.min(maxX, this.position.x));
      }
    }

    // Apply rotation and position to camera
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.position.copy(this.position);
  }

  getForwardDirection() {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
  }
}
