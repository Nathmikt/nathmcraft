import * as THREE from 'three';
import { getPixelTexture, makeCylindricalSpriteMaterial } from './props.js';
import { InteractableEntity } from './interactables.js';

export class NPC {
  constructor(sceneOrOptions, maybeOptions = {}) {
    const isParentObj = sceneOrOptions && (sceneOrOptions.isObject3D || typeof sceneOrOptions.add === 'function');
    const options = isParentObj
      ? (typeof maybeOptions === 'string' ? { texture: maybeOptions } : maybeOptions)
      : sceneOrOptions;

    const scene = isParentObj ? sceneOrOptions : options.scene;

    const {
      name = 'NPC',
      texture,
      textureUrl,
      x = 0,
      y = 0,
      z = 0,
      width = 1.8,
      height = 1.8,
      scale = null,
      anchorX = 0.5,
      anchorY = 0.0,
      layer = 1,
      renderOrder = 2,
      alphaTest = 0.5,
      cylindrical = true,
      // Sprite Sheet Animation
      animation = null,
      cols = null,
      rows = null,
      totalFrames = null,
      fps = null,
      loop = true,
      frameDurations = null,
      frameSequence = null,
      // Floating / Bobbing behavior
      floating = false,
      floatSpeed = 2.2,
      floatHeight = 0.12,
      floatOffset = 0,
      // Ground Shadow
      shadow = true,
      shadowRadius = 0.55,
      shadowColor = 0x030305,
      shadowOpacity = 0.42,
      shadowY = 0.01,
      shadowScaleFactor = 0.15,
      shadowOpacityFactor = 0.08,
      // Collision
      collisionRadius = 0,
      // Interaction & Dialogue
      interactionRange = 2.5,
      onInteract = null
    } = options;

    this.scene = scene;
    this.name = name;
    this.x = x;
    this.baseY = y;
    this.z = z;
    this.floating = Boolean(floating);
    this.floatSpeed = floatSpeed;
    this.floatHeight = floatHeight;
    this.floatOffset = floatOffset;
    this.shadowOpacity = shadowOpacity;
    this.shadowScaleFactor = shadowScaleFactor;
    this.shadowOpacityFactor = shadowOpacityFactor;
    this.shadowY = shadowY;
    this.collisionRadius = collisionRadius;
    this.interactionRange = interactionRange;
    this.onInteract = onInteract;
    this.time = 0;

    const actualWidth = scale !== null ? scale : width;
    const actualHeight = scale !== null ? scale : height;

    // Pure nearest-neighbor 1:1 pixel art texture without mipmaps
    const texPath = texture || textureUrl;
    const baseTex = (texPath && typeof texPath === 'string')
      ? getPixelTexture(texPath, { mipmaps: false })
      : texPath;

    // Sprite Sheet Animation setup
    const animConfig = typeof animation === 'object' && animation !== null ? animation : {};
    const animCols = cols ?? animConfig.cols ?? 1;
    const animRows = rows ?? animConfig.rows ?? 1;
    const animTotal = totalFrames ?? animConfig.totalFrames ?? (animCols * animRows);
    const animFps = fps ?? animConfig.fps ?? (animConfig.speed ?? 4);
    const animLoop = (loop !== undefined ? loop : animConfig.loop) !== false;
    const animDurations = frameDurations ?? animConfig.frameDurations ?? null;
    const animSequence = frameSequence ?? animConfig.frameSequence ?? null;

    this.isAnimated = animCols > 1 || animRows > 1 || animTotal > 1;
    this.animCols = animCols;
    this.animRows = animRows;
    this.animTotalFrames = animTotal;
    this.animFps = animFps;
    this.animLoop = animLoop;
    this.frameDurations = animDurations;
    this.frameSequence = animSequence;
    this.sequenceIndex = 0;
    this.currentFrame = this.frameSequence && this.frameSequence.length > 0 ? this.frameSequence[0] : 0;
    this.isPlaying = true;
    this.animTimer = 0;
    this.currentFrameDuration = this.getFrameDuration(this.sequenceIndex || this.currentFrame);

    let tex = baseTex;
    if (this.isAnimated && baseTex) {
      tex = baseTex.clone();
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1 / animCols, 1 / animRows);
      tex.needsUpdate = true;
    }
    this.tex = tex;

    let spriteMat = new THREE.SpriteMaterial({
      map: this.tex,
      transparent: true,
      alphaTest,
      fog: false,
      toneMapped: false
    });

    if (cylindrical) {
      spriteMat = makeCylindricalSpriteMaterial(spriteMat);
    }
    this.mat = spriteMat;

    // Initialize initial frame UV
    if (this.isAnimated) {
      this.setFrame(this.currentFrame);
    }

    // --- Rule 1: NPCs always high-res ---
    // NPCs remain permanently on Layer 1 (high-res display buffer) at all distances
    this.sprite = new THREE.Sprite(this.mat);
    this.sprite.layers.set(layer);
    this.sprite.scale.set(actualWidth, actualHeight, 1);
    this.sprite.center.set(anchorX, anchorY);
    this.sprite.position.set(this.x, this.baseY, this.z);
    this.sprite.renderOrder = renderOrder;
    this.sprite.frustumCulled = false;
    this.sprite.userData = {
      type: 'NPC',
      name: this.name,
      npc: this
    };

    if (this.scene) {
      this.scene.add(this.sprite);
    }

    // Ground Shadow beneath NPC
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
      this.shadow.position.set(this.x, this.shadowY, this.z);
      this.shadow.renderOrder = 1;
      this.shadow.frustumCulled = false;
      this.shadow.userData = {
        type: 'NPCShadow',
        npc: this
      };

      if (this.scene) {
        this.scene.add(this.shadow);
      }
    }

    // Interaction Entity
    this.interactable = null;
    if (typeof this.onInteract === 'function') {
      this.interactable = new InteractableEntity({
        name: this.name,
        target: this.sprite,
        range: this.interactionRange,
        onInteract: this.onInteract
      });
    }
  }

  getFrameDuration(index) {
    if (this.frameDurations && this.frameDurations.length > 0) {
      const val = this.frameDurations[index % this.frameDurations.length];
      if (Array.isArray(val) && val.length >= 2) {
        return val[0] + Math.random() * (val[1] - val[0]);
      }
      if (typeof val === 'number' && val > 0) {
        return val;
      }
    }
    return this.animFps > 0 ? 1.0 / this.animFps : 1.0;
  }

  setFrame(frameIndex) {
    if (!this.tex || !this.isAnimated) return;
    this.currentFrame = frameIndex;
    const col = frameIndex % this.animCols;
    const row = Math.floor(frameIndex / this.animCols);
    this.tex.offset.x = col / this.animCols;
    this.tex.offset.y = 1.0 - (row + 1) / this.animRows;
  }

  playAnimation({ fps, loop = true, frameDurations = null } = {}) {
    if (fps !== undefined) this.animFps = fps;
    if (frameDurations !== null) this.frameDurations = frameDurations;
    this.animLoop = loop;
    this.isPlaying = true;
    this.currentFrameDuration = this.getFrameDuration(this.sequenceIndex || this.currentFrame);
  }

  stopAnimation() {
    this.isPlaying = false;
  }

  setInteractable(onInteract, range = this.interactionRange) {
    this.interactionRange = range;
    this.onInteract = onInteract;
    this.interactable = new InteractableEntity({
      name: this.name,
      target: this.sprite,
      range: this.interactionRange,
      onInteract: this.onInteract
    });
    return this.interactable;
  }

  update(delta) {
    this.time += delta;

    // Sprite Sheet Animation with variable/weighted frame durations
    if (this.isAnimated && this.isPlaying) {
      this.animTimer += delta;
      const targetDuration = Math.max(0.001, this.currentFrameDuration);

      if (this.animTimer >= targetDuration) {
        if (this.animTimer > targetDuration * 3) {
          this.animTimer = 0;
        } else {
          this.animTimer %= targetDuration;
        }

        if (this.frameSequence && this.frameSequence.length > 0) {
          this.sequenceIndex++;
          if (this.sequenceIndex >= this.frameSequence.length) {
            this.sequenceIndex = this.animLoop ? 0 : this.frameSequence.length - 1;
          }
          const nextFrame = this.frameSequence[this.sequenceIndex];
          this.setFrame(nextFrame);
          this.currentFrameDuration = this.getFrameDuration(this.sequenceIndex);
        } else {
          let nextFrame = this.currentFrame + 1;
          if (nextFrame >= this.animTotalFrames) {
            nextFrame = this.animLoop ? 0 : this.animTotalFrames - 1;
          }
          if (nextFrame !== this.currentFrame || this.animTotalFrames === 1) {
            this.setFrame(nextFrame);
            this.currentFrameDuration = this.getFrameDuration(nextFrame);
          }
        }
      }
    }

    // Floating / Bobbing behavior
    if (this.floating) {
      const hover = Math.sin(this.time * this.floatSpeed + this.floatOffset) * this.floatHeight;
      this.sprite.position.y = this.baseY + hover;

      if (this.shadow && this.shadowMat) {
        const ratio = this.floatHeight > 0 ? (hover / this.floatHeight) : 0;
        const shadowScale = 1.0 - ratio * this.shadowScaleFactor;
        this.shadow.scale.set(shadowScale, shadowScale, 1);
        this.shadowMat.opacity = this.shadowOpacity - ratio * this.shadowOpacityFactor;
      }
    }
  }

  setPosition(x, y, z) {
    this.x = x;
    this.baseY = y;
    this.z = z;
    this.sprite.position.set(x, y, z);
    if (this.shadow) {
      this.shadow.position.set(x, this.shadowY, z);
    }
  }

  get position() {
    return this.sprite.position;
  }

  get collider() {
    if (this.collisionRadius > 0) {
      return { x: this.x, z: this.z, radius: this.collisionRadius };
    }
    return null;
  }

  dispose() {
    if (this.tex && this.isAnimated) {
      this.tex.dispose();
    }
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

export class CloakedAngel extends NPC {
  constructor(scene, options = {}) {
    const opts = typeof options === 'string' ? { texture: options } : options;

    const defaultOnInteract = ({ dialogue, player, gameState }) => {
      player.freeze();

      const mainMenu = {
        prompt: "What brings you to the grove?",
        choices: []
      };

      const creditsMenu = {
        prompt: "Some of the indie titles we have playtested and helped push toward release:",
        choices: []
      };

      creditsMenu.choices = [
        {
          label: "EON Survivor",
          lines: [
            "EON Survivor (by Square Wheel) — Genre: Survivor-like.",
            "A space survivor with an objective hunting twist. We provided feedback on level progression, difficulty, and UI clarity."
          ],
          nextChoices: {
            prompt: "EON Survivor on Steam:",
            choices: [
              {
                label: "Open EON Survivor Steam Page ↗",
                action: () => {
                  window.open("https://store.steampowered.com/app/4286910/EON_Survivor/", "_blank", "noopener,noreferrer");
                },
                lines: ["Opened EON Survivor on Steam."],
                nextChoices: mainMenu
              },
              {
                label: "[Back]",
                nextChoices: creditsMenu
              }
            ]
          }
        },
        {
          label: "[Back]",
          nextChoices: mainMenu
        }
      ];

      mainMenu.choices = [
        {
          label: "01 / Our Games",
          lines: [
            "We build focused, nostalgic experiences.",
            "Currently in active development: [Unannounced Roguelike].",
            "Built with tight gameplay loops, deep progression, and high replayability. More details to be announced."
          ],
          nextChoices: mainMenu
        },
        {
          label: "02 / About nathmcraft",
          lines: [
            "We are an independent game development studio dedicated to crafting focused, mechanics-first titles with a deeply nostalgic atmosphere.",
            "Alongside developing our own projects, we continue to playtest games for fellow indie creators — bringing raw, actionable feedback from one developer to another."
          ],
          nextChoices: mainMenu
        },
        {
          label: "03 / Submit Steam Key (Indie Playtesting)",
          action: () => {
            dialogue.closeDialogue(false);
            if (typeof window.openSteamKeyModal === 'function') {
              window.openSteamKeyModal();
            } else {
              player.unfreeze();
            }
          }
        },
        {
          label: "04 / Playtesting Credits",
          nextChoices: creditsMenu
        },
        {
          label: "05 / Contact Us (Reddit & Discord)",
          nextChoices: {
            prompt: "Connect with us directly on Reddit (u/Nathmikt) or Discord (nathm.):",
            choices: [
              {
                label: "Copy Discord Username (nathm.)",
                action: () => {
                  if (typeof window.copyDiscordUsername === 'function') {
                    window.copyDiscordUsername();
                  }
                },
                lines: ["Discord username 'nathm.' copied to clipboard!"],
                nextChoices: mainMenu
              },
              {
                label: "Visit Reddit Profile (u/Nathmikt) ↗",
                action: () => {
                  window.open("https://www.reddit.com/user/Nathmikt/", "_blank", "noopener,noreferrer");
                },
                lines: ["Opened u/Nathmikt on Reddit."],
                nextChoices: mainMenu
              },
              {
                label: "[Back]",
                nextChoices: mainMenu
              }
            ]
          }
        },
        {
          label: "[Leave]"
        }
      ];

      if (gameState.angelTalkCount === 0) {
        const introLines = gameState.seenCorpse
          ? [
              "Ah... you wandered down the dark corridor and found the remains.",
              "That is the remnant of an old prototype. Pay it no mind.",
              "Instead, I bid you welcome to what survived.",
              "Our grove - nathmcraft"
            ]
          : [
              "Welcome, traveler, to our grove - nathmcraft.",
              "We are an independent game studio crafting focused, mechanically rich and deeply nostalgic games.",
              "Speak with me anytime to learn about our games.",
              "Or just have fun and explore."
            ];

        dialogue.startDialogue(introLines, () => {
          gameState.angelTalkCount = (gameState.angelTalkCount || 0) + 1;
          dialogue.showChoices(mainMenu, () => {
            player.unfreeze();
          }, gameState);
        });
      } else {
        dialogue.showChoices(mainMenu, () => {
          player.unfreeze();
        }, gameState);
      }
    };

    super(scene, {
      name: 'The Hooded Angel',
      texture: '/game_assets/npcs/cloaked_angel.png',
      x: 0,
      y: 0,
      z: 0,
      scale: 1.8,
      floating: false,
      floatSpeed: 2.2,
      floatHeight: 0.12,
      shadow: true,
      shadowRadius: 0.55,
      collisionRadius: 0.55,
      interactionRange: 2.8,
      animation: {
        cols: 4,
        rows: 1,
        totalFrames: 4,
        frameDurations: [[8.0, 12.0], 0.5, 0.35, 0.5],
        loop: true
      },
      onInteract: defaultOnInteract,
      ...opts
    });
  }
}

export class Gatekeeper extends NPC {
  constructor(scene, options = {}) {
    const defaultOnInteract = ({ dialogue, player }) => {
      player.freeze();
      dialogue.startDialogue([
        "Hey there, fellow developer.",
        "I guard the Golden Gate to our upcoming unannounced project.",
        "Tho, I can't tell you much, as it's still deep in development.",
        "If you have any curiosities, talk to the Hooded Angel by the fountain!"
      ], () => {
        player.unfreeze();
      });
    };

    const opts = typeof options === 'string' ? { texture: options } : options;

    super(scene, {
      name: 'The Gatekeeper',
      texture: '/game_assets/npcs/the_gatekeeper.png',
      x: 0,
      y: 0,
      z: 0,
      scale: 1.35,
      floating: false,
      shadow: true,
      shadowRadius: 0.45,
      collisionRadius: 0.45,
      interactionRange: 3.0,
      onInteract: defaultOnInteract,
      ...opts
    });
  }
}

export { Gatekeeper as TheGatekeeper, Gatekeeper as Beggar, Gatekeeper as TheBeggar };
