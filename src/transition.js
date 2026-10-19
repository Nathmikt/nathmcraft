export class TransitionManager {
  constructor(options = {}) {
    this.player = options.player || null;
    this.canvas = options.canvas || document.getElementById('transition-canvas');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'transition-canvas';
      const uiLayer = document.getElementById('ui-layer') || document.body;
      uiLayer.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext('2d');

    this.state = options.startState || 'black'; // 'black', 'visible', 'opening', 'closing'
    this.animId = null;
    this.delayTimer = null;
    this.currentResolve = null;
    this.currentReject = null;
    this.dpr = 1;

    this.initResize();
    if (this.state === 'black') {
      this.setBlack();
    } else {
      this.setVisible();
    }
  }

  setPlayer(player) {
    this.player = player;
  }

  initResize() {
    this.resize = () => {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.redrawCurrentState();
    };
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  redrawCurrentState() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    if (this.state === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
    } else if (this.state === 'visible') {
      ctx.clearRect(0, 0, w, h);
    }

    ctx.restore();
  }

  isTransitioning() {
    return this.state === 'opening' || this.state === 'closing';
  }

  isVisible() {
    return this.state === 'visible';
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  drawEyes(progress, isOpening = true) {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const effectiveProgress = isOpening ? progress : (1 - progress);

    if (effectiveProgress <= 0.001) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return;
    }

    if (effectiveProgress >= 0.999) {
      ctx.clearRect(0, 0, w, h);
      ctx.restore();
      return;
    }

    // Base black screen
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const t = this.easeInOutCubic(effectiveProgress);
    const cx = w / 2;
    const cy = h / 2;

    // Aperture geometry: horizontal slit spanning slightly beyond viewport edges
    const halfW = w * (0.65 + 0.35 * t);
    const openY = (h * 0.75) * t;

    // Cut out eyelid opening
    ctx.globalCompositeOperation = 'destination-out';

    // Soft blur for organic eyelid rim feathering
    const blurPx = Math.max(3, Math.round(18 * (1 - t * 0.75)));
    if ('filter' in ctx) {
      ctx.filter = `blur(${blurPx}px)`;
    }

    ctx.beginPath();
    ctx.moveTo(cx - halfW, cy);
    // Upper eyelid curve
    ctx.quadraticCurveTo(cx, cy - 2 * openY, cx + halfW, cy);
    // Lower eyelid curve
    ctx.quadraticCurveTo(cx, cy + 2 * openY, cx - halfW, cy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
    ctx.fill();

    if ('filter' in ctx) {
      ctx.filter = 'none';
    }

    // Atmospheric dimming inside eye opening that clears up as eyes adjust to light
    const veilOpacity = Math.max(0, Math.pow(1 - t, 1.8) * 0.55);
    if (veilOpacity > 0.02) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(0, 0, 0, ${veilOpacity})`;
      ctx.fill();
    }

    ctx.restore();
  }

  drawFade(progress, isOpening = true) {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, w, h);

    const effectiveProgress = isOpening ? progress : (1 - progress);
    const alpha = Math.max(0, Math.min(1, 1.0 - effectiveProgress));

    if (alpha > 0.001) {
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  openEyes({ duration = 2.6, delay = 0.3, onComplete } = {}) {
    return this._runTransition({
      type: 'eyes',
      direction: 'open',
      duration,
      delay,
      onComplete
    });
  }

  closeEyes({ duration = 1.6, delay = 0, onComplete } = {}) {
    return this._runTransition({
      type: 'eyes',
      direction: 'close',
      duration,
      delay,
      onComplete
    });
  }

  fadeFromBlack({ duration = 1.5, delay = 0, onComplete } = {}) {
    return this._runTransition({
      type: 'fade',
      direction: 'open',
      duration,
      delay,
      onComplete
    });
  }

  fadeToBlack({ duration = 1.5, delay = 0, onComplete } = {}) {
    return this._runTransition({
      type: 'fade',
      direction: 'close',
      duration,
      delay,
      onComplete
    });
  }

  _runTransition({ type = 'eyes', direction = 'open', duration = 2.0, delay = 0, onComplete }) {
    this._cancelCurrent();

    const isOpening = direction === 'open';
    this.state = isOpening ? 'opening' : 'closing';

    // Freeze player walking & input during transition
    this._setPlayerFrozen(true);
    this.canvas.style.display = 'block';
    this._setHudVisibility(false);

    return new Promise((resolve, reject) => {
      this.currentResolve = resolve;
      this.currentReject = reject;

      const startAnim = () => {
        const startTime = performance.now();
        const durationMs = duration * 1000;

        const tick = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(1.0, elapsed / durationMs);

          if (type === 'eyes') {
            this.drawEyes(progress, isOpening);
          } else {
            this.drawFade(progress, isOpening);
          }

          if (progress < 1.0) {
            this.animId = requestAnimationFrame(tick);
          } else {
            this.animId = null;
            this._finishTransition(isOpening, onComplete);
          }
        };

        this.animId = requestAnimationFrame(tick);
      };

      if (delay > 0) {
        if (type === 'eyes') {
          this.drawEyes(0, isOpening);
        } else {
          this.drawFade(0, isOpening);
        }
        this.delayTimer = setTimeout(startAnim, delay * 1000);
      } else {
        startAnim();
      }
    });
  }

  _finishTransition(isOpening, onComplete) {
    if (isOpening) {
      this.state = 'visible';
      this.canvas.style.display = 'none';
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Transition finished & screen visible -> player input regained
      this._setPlayerFrozen(false);
      this._setHudVisibility(true);
    } else {
      this.state = 'black';
      this._setPlayerFrozen(true);
      this._setHudVisibility(false);
    }

    if (typeof onComplete === 'function') {
      onComplete();
    }

    if (this.currentResolve) {
      const res = this.currentResolve;
      this.currentResolve = null;
      this.currentReject = null;
      res();
    }
  }

  _setPlayerFrozen(frozen) {
    if (!this.player) return;
    if (frozen) {
      if (typeof this.player.freeze === 'function') {
        this.player.freeze();
      } else {
        this.player.isFrozen = true;
      }
    } else {
      if (typeof this.player.unfreeze === 'function') {
        this.player.unfreeze();
      } else {
        this.player.isFrozen = false;
      }
    }
  }

  _setHudVisibility(visible) {
    const crosshair = document.getElementById('crosshair');
    const clickHint = document.getElementById('click-to-play');
    if (crosshair) {
      crosshair.style.opacity = visible ? '1' : '0';
    }
    if (clickHint) {
      if (!visible) {
        clickHint.style.opacity = '0';
      } else {
        const isLocked = this.player && this.player.isLocked;
        clickHint.style.opacity = isLocked ? '0' : '1';
      }
    }
  }

  setBlack() {
    this._cancelCurrent();
    this.state = 'black';
    this.canvas.style.display = 'block';
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    this._setPlayerFrozen(true);
    this._setHudVisibility(false);
  }

  setVisible() {
    this._cancelCurrent();
    this.state = 'visible';
    this.canvas.style.display = 'none';
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this._setPlayerFrozen(false);
    this._setHudVisibility(true);
  }

  skip() {
    if (!this.isTransitioning()) return;
    const isOpening = this.state === 'opening';
    this._cancelCurrent();
    this._finishTransition(isOpening);
  }

  _cancelCurrent() {
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.currentReject) {
      this.currentReject(new Error('Transition cancelled'));
      this.currentResolve = null;
      this.currentReject = null;
    }
  }
}
