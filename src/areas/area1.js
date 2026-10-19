import * as THREE from 'three';
import { PropManager } from '../props.js';
import { InteractableEntity } from '../interactables.js';
import { NPC, CloakedAngel, Gatekeeper } from '../npc.js';
import { Item, AppleItem, CherryItem, GreenFruitItem, OrangeFruitItem } from '../item.js';
import { Gate, GoldenGate } from '../gate.js';
import {
  createWall,
  createGateMesh,
  createFloorTexture,
  createBloodTexture,
  GroundFog,
  MushroomGlowManager
} from '../world.js';

export class Area1 {
  constructor({ scene, dialogue, gameState, areaManager }) {
    this.id = 'area1';
    this.name = 'nathmcraft Grove';
    this.areaManager = areaManager;
    this.dialogue = dialogue;
    this.gameState = gameState;

    this.group = new THREE.Group();
    this.group.name = 'Area1_Group';
    scene.add(this.group);

    this.propManager = new PropManager(this.group);
    this.interactables = [];
    this.npcs = [];
    this.items = [];
    this.gates = [];

    this.spawns = {
      initial: { x: 0.0, y: 1.2, z: -7.85, yaw: Math.PI, pitch: 0 }, // Directly aligned dead center facing the Hooded Angel & Fountain
      from_gate: { x: -12.4, y: 1.2, z: 0.29, yaw: 4.71, pitch: 0 }
    };

    this.initWorld();
    this.initInteractables();
  }

  addGate(gate) {
    this.gates.push(gate);
    return gate;
  }

  addNPC(npc) {
    this.npcs.push(npc);
    if (npc.collider) {
      this.propManager.colliders.push(npc.collider);
    }
    return npc;
  }

  addItem(item) {
    this.items.push(item);
    return item;
  }

  initWorld() {
    // 1. Ground Plane
    const floorTexture = createFloorTexture(36, 76);
    const floorGeo = new THREE.PlaneGeometry(42, 82);
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTexture });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -20);
    floor.frustumCulled = false;
    this.group.add(floor);

    // 2. Perimeter Walls
    createWall(this.group, 31.4, 0, 14.54);
    createWall(this.group, 19.6, -14.5, 5.7, Math.PI / 2);
    createWall(this.group, 19.6, 14.5, 5.7, Math.PI / 2);

    // The West Gate: sealed gate (other areas closed off)
    this.gate = createGateMesh({
      parent: this.group,
      x: -14.48,
      y: 1.6,
      z: 0.29,
      rotY: Math.PI / 2
    });

    // The Golden Gate: locked gate mounted on the East clearing wall at (14.5, 5.7)
    this.goldenGate = this.addGate(new GoldenGate(this.group, {
      x: 14.48,
      y: 1.6,
      z: 5.7,
      rotY: -Math.PI / 2,
      lockedDialogue: [
        "The Golden Gate — [Unannounced Roguelike: In Active Development].",
        "Beyond this gate lies our upcoming roguelike, built with tight gameplay loops, deep progression, and high replayability.",
        "The gate remains sealed until we are ready to reveal more."
      ]
    }));

    createWall(this.group, 12.3, -10.5, -7.5, Math.atan2(-9.0, -8.0));
    createWall(this.group, 12.3, 10.5, -7.5, Math.atan2(-9.0, 8.0));
    createWall(this.group, 41.6, -6.5, -32.8, Math.PI / 2);
    createWall(this.group, 41.6, 6.5, -32.8, Math.PI / 2);
    createWall(this.group, 15.4, 0, -52.04);

    // 3. Large Trees
    const treeLocations = [
      // Meadow clearing framing trees
      { x: -4.2, z: 3.5, size: 4.9, r: 0.5 },
      { x: 4.8, z: 3.8, size: 5.3, r: 0.55 },
      { x: -8.5, z: -5.5, size: 5.6, r: 0.6 },
      { x: 8.0, z: -5.5, size: 5.5, r: 0.6 },
      { x: 9.5, z: -2.0, size: 5.0, r: 0.55 },
      { x: -9.5, z: 6.5, size: 5.3, r: 0.55 },
      { x: -6.5, z: 9.0, size: 4.8, r: 0.5 },
      { x: 9.0, z: 6.0, size: 5.7, r: 0.6 },
      { x: 6.5, z: 9.5, size: 5.2, r: 0.55 },
      { x: 11.5, z: 0, size: 5.6, r: 0.6 },
      { x: 0, z: 11.5, size: 5.3, r: 0.55 },

      // Entrance trees (framing the path ahead)
      { x: 3.4, z: -3.1, size: 4.8, r: 0.52 },
      { x: -3.9, z: -3.8, size: 5.4, r: 0.58 },

      // Funnel grove (z = -6 to -12) - organic scattering & clusters
      { x: -5.6, z: -6.2, size: 5.9, r: 0.64 },
      { x: 4.7, z: -7.1, size: 5.8, r: 0.60 },
      { x: 2.1, z: -8.3, size: 5.1, r: 0.52 },
      { x: -3.8, z: -9.2, size: 5.5, r: 0.58 },
      { x: -0.5, z: -10.7, size: 4.7, r: 0.48 },
      { x: 3.9, z: -11.4, size: 5.6, r: 0.60 },
      { x: -4.9, z: -12.1, size: 5.3, r: 0.55 },

      // Corridor section 1 (z = -13 to -24) - natural groves
      { x: 1.7, z: -13.8, size: 5.8, r: 0.60 },
      { x: -3.9, z: -15.2, size: 5.1, r: 0.52 },
      { x: 4.8, z: -16.9, size: 5.7, r: 0.62 },
      { x: -1.2, z: -18.1, size: 5.3, r: 0.55 },
      { x: -4.6, z: -20.3, size: 5.5, r: 0.58 },
      { x: 1.9, z: -21.6, size: 4.9, r: 0.50 },
      { x: 4.5, z: -23.1, size: 5.4, r: 0.56 },

      // Corridor section 2 (z = -25 to -36) - irregular clumps & natural bends
      { x: -1.8, z: -25.2, size: 6.0, r: 0.64 },
      { x: -4.8, z: -26.9, size: 5.0, r: 0.52 },
      { x: 1.5, z: -28.7, size: 5.4, r: 0.56 },
      { x: 4.9, z: -30.4, size: 5.8, r: 0.60 },
      { x: -1.1, z: -32.6, size: 4.8, r: 0.48 },
      { x: -4.5, z: -34.1, size: 5.6, r: 0.60 },
      { x: 1.8, z: -35.8, size: 5.3, r: 0.54 },

      // Corridor deep section & Corpse approach (z = -37 to -50)
      { x: 4.7, z: -37.9, size: 5.5, r: 0.58 },
      { x: -1.6, z: -39.4, size: 5.8, r: 0.62 },
      { x: 1.2, z: -42.2, size: 5.1, r: 0.52 },
      { x: -4.4, z: -43.8, size: 5.4, r: 0.56 },
      { x: 0.3, z: -45.1, size: 4.9, r: 0.50 },
      { x: 3.8, z: -46.7, size: 5.7, r: 0.60 },
      { x: -2.9, z: -49.1, size: 5.6, r: 0.58 },
      { x: 0.2, z: -49.5, size: 6.1, r: 0.64 },
      { x: 3.1, z: -48.9, size: 5.2, r: 0.54 }
    ];

    for (const t of treeLocations) {
      this.propManager.addProp({
        texture: '/game_assets/environment/tree_1.png',
        x: t.x,
        z: t.z,
        width: t.size,
        height: t.size,
        collisionRadius: t.r,
        shadow: true
      });
    }

    // 4. Ground Mushrooms
    const mushroomModels = [
      '/game_assets/environment/Mushroom_medium.png',
      '/game_assets/environment/Mushroom_medium_2.png',
      '/game_assets/environment/Mushroom_medium_3.png',
      '/game_assets/environment/Mushroom_medium_4.png'
    ];

    this.mushroomData = [
      { x: 1.4, z: 4.0, type: 1, s: 0.45, aspect: 1.1 },
      { x: -2.1, z: 3.5, type: 2, s: 0.38, aspect: 0.92 },
      { x: 2.2, z: -0.6, type: 3, s: 0.55, aspect: 1.18 },
      { x: -1.8, z: -1.0, type: 4, s: 0.42, aspect: 0.95 },
      { x: -4.2, z: -2.2, type: 2, s: 0.58, aspect: 1.1 },
      { x: 4.0, z: -2.0, type: 3, s: 0.36, aspect: 0.9 },
      { x: 6.2, z: 2.0, type: 2, s: 0.52, aspect: 1.12 },
      { x: -6.0, z: 1.2, type: 3, s: 0.44, aspect: 0.88 },
      { x: 3.2, z: 6.2, type: 1, s: 0.50, aspect: 1.0 },
      { x: -3.6, z: 4.6, type: 4, s: 0.46, aspect: 1.02 },
      { x: 4.8, z: -3.8, type: 4, s: 0.50, aspect: 1.14 },
      { x: -5.2, z: -1.6, type: 1, s: 0.40, aspect: 0.90 },
      { x: 1.8, z: -3.2, type: 4, s: 0.44, aspect: 1.08 },
      { x: -0.8, z: 6.8, type: 4, s: 0.48, aspect: 0.96 },
      { x: -2.5, z: -16.5, type: 1, s: 0.48, aspect: 1.05 },
      { x: 2.8, z: -23.0, type: 2, s: 0.55, aspect: 1.15 },
      { x: -1.6, z: -27.5, type: 4, s: 0.46, aspect: 0.98 },
      { x: -2.2, z: -31.0, type: 3, s: 0.42, aspect: 0.92 },
      { x: 2.6, z: -38.5, type: 4, s: 0.52, aspect: 1.10 },
      { x: -2.4, z: -44.0, type: 2, s: 0.46, aspect: 0.95 },
      { x: 0.8, z: -47.5, type: 3, s: 0.58, aspect: 1.12 },
      { x: -1.2, z: -49.2, type: 4, s: 0.50, aspect: 1.06 }
    ];

    for (const m of this.mushroomData) {
      const width = m.s * m.aspect;
      const height = m.s / m.aspect;
      const texUrl = mushroomModels[(m.type - 1) % mushroomModels.length];
      this.propManager.addProp({
        texture: texUrl,
        x: m.x,
        z: m.z,
        width,
        height,
        anchorY: 0.04,
        yOffset: 0.05,
        collisionRadius: 0,
        shadow: true,
        shadowRadius: width * 0.28
      });
    }

    // 5. Grass Tufts
    const grassModels = [
      { url: '/game_assets/environment/Grass_tuft_small.png', hFactor: 0.72 },
      { url: '/game_assets/environment/Grass_tuft_small_2.png', hFactor: 0.75 },
      { url: '/game_assets/environment/Grass_tuft_small_3.png', hFactor: 0.95 },
      { url: '/game_assets/environment/Grass_tuft_smallest.png', hFactor: 0.65 }
    ];

    const grassTuftData = [
      { x: -4.8, z: -2.6, m: 0, s: 0.65, aspect: 1.4 },
      { x: -4.0, z: -3.5, m: 1, s: 0.55, aspect: 1.3 },
      { x: -3.6, z: -2.8, m: 2, s: 0.60, aspect: 1.2 },
      { x: -5.2, z: -3.2, m: 3, s: 0.45, aspect: 1.3 },
      { x: 4.2, z: -3.2, m: 0, s: 0.70, aspect: 1.5 },
      { x: 5.0, z: -2.4, m: 1, s: 0.58, aspect: 1.35 },
      { x: 4.5, z: -2.2, m: 2, s: 0.62, aspect: 1.25 },
      { x: 5.4, z: -3.6, m: 3, s: 0.42, aspect: 1.4 },
      { x: -3.8, z: 3.8, m: 1, s: 0.62, aspect: 1.45 },
      { x: -4.6, z: 3.0, m: 0, s: 0.72, aspect: 1.3 },
      { x: -4.0, z: 2.8, m: 2, s: 0.65, aspect: 1.2 },
      { x: -4.8, z: 4.2, m: 3, s: 0.46, aspect: 1.35 },
      { x: 4.4, z: 3.4, m: 0, s: 0.60, aspect: 1.4 },
      { x: 5.2, z: 4.2, m: 1, s: 0.68, aspect: 1.5 },
      { x: 4.2, z: 4.5, m: 2, s: 0.58, aspect: 1.2 },
      { x: 5.5, z: 3.2, m: 3, s: 0.44, aspect: 1.35 },
      { x: -1.2, z: 2.2, m: 0, s: 0.55, aspect: 1.4 },
      { x: 1.5, z: 2.5, m: 1, s: 0.65, aspect: 1.35 },
      { x: -2.5, z: 1.0, m: 2, s: 0.58, aspect: 1.25 },
      { x: 2.8, z: 0.8, m: 0, s: 0.70, aspect: 1.4 },
      { x: -2.0, z: -1.8, m: 1, s: 0.60, aspect: 1.3 },
      { x: 1.8, z: -2.0, m: 2, s: 0.55, aspect: 1.2 },
      { x: -0.6, z: 1.5, m: 3, s: 0.42, aspect: 1.35 },
      { x: 0.8, z: -1.2, m: 3, s: 0.45, aspect: 1.4 },
      { x: -1.8, z: 0.2, m: 0, s: 0.52, aspect: 1.4 },
      { x: 2.2, z: -1.2, m: 1, s: 0.62, aspect: 1.3 },
      { x: 0.8, z: 4.8, m: 0, s: 0.50, aspect: 1.35 },
      { x: -1.0, z: 5.2, m: 1, s: 0.65, aspect: 1.4 },
      { x: 2.0, z: 5.8, m: 2, s: 0.58, aspect: 1.25 },
      { x: -2.2, z: 6.0, m: 0, s: 0.72, aspect: 1.3 },
      { x: 0.2, z: 5.8, m: 3, s: 0.40, aspect: 1.4 },
      { x: -0.5, z: 4.2, m: 2, s: 0.52, aspect: 1.2 },
      { x: 1.2, z: 6.8, m: 1, s: 0.60, aspect: 1.4 },
      { x: -1.6, z: 6.8, m: 3, s: 0.46, aspect: 1.3 },
      { x: -7.5, z: -5.5, m: 0, s: 0.68, aspect: 1.4 },
      { x: -5.0, z: -7.2, m: 1, s: 0.60, aspect: 1.35 },
      { x: -8.8, z: -2.5, m: 2, s: 0.75, aspect: 1.25 },
      { x: -8.0, z: -7.2, m: 3, s: 0.48, aspect: 1.4 },
      { x: -6.5, z: -6.2, m: 0, s: 0.58, aspect: 1.35 },
      { x: -9.2, z: -5.0, m: 1, s: 0.64, aspect: 1.4 },
      { x: -4.5, z: -9.0, m: 2, s: 0.70, aspect: 1.2 },
      { x: -7.0, z: -9.8, m: 3, s: 0.44, aspect: 1.35 },
      { x: 7.2, z: -6.8, m: 0, s: 0.62, aspect: 1.4 },
      { x: 8.8, z: -3.0, m: 1, s: 0.70, aspect: 1.3 },
      { x: 6.0, z: -8.0, m: 2, s: 0.55, aspect: 1.25 },
      { x: 7.8, z: -8.5, m: 3, s: 0.45, aspect: 1.4 },
      { x: 8.2, z: -5.5, m: 0, s: 0.66, aspect: 1.35 },
      { x: 9.2, z: -4.2, m: 2, s: 0.72, aspect: 1.2 },
      { x: 6.8, z: -9.2, m: 1, s: 0.58, aspect: 1.4 },
      { x: 4.8, z: -8.5, m: 3, s: 0.42, aspect: 1.3 },
      { x: -8.5, z: 5.5, m: 0, s: 0.65, aspect: 1.35 },
      { x: -6.0, z: 8.0, m: 1, s: 0.72, aspect: 1.4 },
      { x: -7.2, z: 7.0, m: 2, s: 0.60, aspect: 1.25 },
      { x: -9.0, z: 7.5, m: 3, s: 0.46, aspect: 1.4 },
      { x: -5.2, z: 9.2, m: 0, s: 0.58, aspect: 1.35 },
      { x: -7.8, z: 9.0, m: 1, s: 0.68, aspect: 1.4 },
      { x: -3.5, z: 8.2, m: 2, s: 0.64, aspect: 1.2 },
      { x: -4.2, z: 9.8, m: 3, s: 0.42, aspect: 1.3 },
      { x: 8.2, z: 5.0, m: 0, s: 0.58, aspect: 1.5 },
      { x: 6.2, z: 8.2, m: 1, s: 0.66, aspect: 1.3 },
      { x: 7.5, z: 7.0, m: 2, s: 0.62, aspect: 1.2 },
      { x: 8.8, z: 6.5, m: 3, s: 0.45, aspect: 1.4 },
      { x: 5.5, z: 9.0, m: 0, s: 0.70, aspect: 1.4 },
      { x: 7.0, z: 9.5, m: 1, s: 0.56, aspect: 1.35 },
      { x: 3.8, z: 8.5, m: 2, s: 0.65, aspect: 1.25 },
      { x: 4.8, z: 10.0, m: 3, s: 0.44, aspect: 1.35 },
      { x: -0.8, z: -9.5, m: 0, s: 0.70, aspect: 1.4 },
      { x: 1.2, z: -10.0, m: 1, s: 0.60, aspect: 1.35 },
      { x: -2.2, z: -10.8, m: 2, s: 0.68, aspect: 1.2 },
      { x: 2.5, z: -10.5, m: 3, s: 0.46, aspect: 1.4 },
      { x: -1.5, z: 9.5, m: 0, s: 0.65, aspect: 1.45 },
      { x: 1.0, z: 10.2, m: 1, s: 0.58, aspect: 1.3 },
      { x: -0.2, z: 10.8, m: 2, s: 0.72, aspect: 1.2 },
      { x: 2.2, z: 10.5, m: 3, s: 0.42, aspect: 1.35 },
      { x: -10.0, z: 0.5, m: 0, s: 0.72, aspect: 1.4 },
      { x: -10.8, z: 2.0, m: 1, s: 0.62, aspect: 1.35 },
      { x: -10.5, z: -1.8, m: 2, s: 0.66, aspect: 1.2 },
      { x: 10.2, z: -0.5, m: 0, s: 0.68, aspect: 1.45 },
      { x: 10.8, z: 1.5, m: 1, s: 0.60, aspect: 1.35 },
      { x: 10.5, z: -2.2, m: 2, s: 0.64, aspect: 1.2 },
      { x: -1.8, z: -14.5, m: 0, s: 0.65, aspect: 1.4 },
      { x: 1.5, z: -16.0, m: 1, s: 0.58, aspect: 1.35 },
      { x: 0.2, z: -18.0, m: 2, s: 0.62, aspect: 1.25 },
      { x: -3.2, z: -19.5, m: 3, s: 0.45, aspect: 1.35 },
      { x: 3.4, z: -20.5, m: 0, s: 0.70, aspect: 1.4 },
      { x: -1.5, z: -22.5, m: 1, s: 0.60, aspect: 1.3 },
      { x: 2.0, z: -24.5, m: 2, s: 0.68, aspect: 1.2 },
      { x: -0.6, z: -27.0, m: 3, s: 0.42, aspect: 1.4 },
      { x: -3.5, z: -29.0, m: 0, s: 0.65, aspect: 1.35 },
      { x: 1.2, z: -30.5, m: 1, s: 0.58, aspect: 1.45 },
      { x: -1.8, z: -33.0, m: 2, s: 0.72, aspect: 1.25 },
      { x: 2.5, z: -35.0, m: 3, s: 0.44, aspect: 1.35 },
      { x: 0.4, z: -37.0, m: 0, s: 0.62, aspect: 1.4 },
      { x: -3.2, z: -39.5, m: 1, s: 0.68, aspect: 1.35 },
      { x: 3.5, z: -40.5, m: 2, s: 0.60, aspect: 1.2 },
      { x: -1.4, z: -42.5, m: 3, s: 0.46, aspect: 1.4 },
      { x: 1.8, z: -44.0, m: 0, s: 0.65, aspect: 1.35 },
      { x: -0.5, z: -46.0, m: 1, s: 0.58, aspect: 1.4 },
      { x: -2.2, z: -48.0, m: 2, s: 0.70, aspect: 1.25 },
      { x: 2.2, z: -48.5, m: 3, s: 0.45, aspect: 1.35 }
    ];

    for (const g of grassTuftData) {
      const model = grassModels[g.m];
      const width = g.s * g.aspect;
      const height = g.s * model.hFactor;
      this.propManager.addProp({
        texture: model.url,
        x: g.x,
        z: g.z,
        width,
        height,
        anchorY: 0.06,
        yOffset: 0.05,
        collisionRadius: 0,
        shadow: false,
        sway: true,
        swaySpeed: 2.2 + Math.random() * 0.8,
        swayAmp: 0.08
      });
    }

    // 6. Bushes
    const bushData = [
      // Meadow clearing framing bushes
      { x: -5.3, z: -2.7, s: 3.4, aspect: 1.65 },
      { x: 5.3, z: -2.3, s: 3.8, aspect: 1.70 },
      { x: -4.9, z: 3.8, s: 3.5, aspect: 1.60 },
      { x: -3.5, z: 4.2, s: 2.7, aspect: 1.75 },
      { x: 5.5, z: 3.5, s: 3.2, aspect: 1.65 },
      { x: 4.2, z: 4.4, s: 3.7, aspect: 1.70 },
      { x: -2.8, z: 2.2, s: 2.9, aspect: 1.60 },
      { x: 3.1, z: 1.8, s: 3.1, aspect: 1.70 },
      { x: 1.8, z: 4.5, s: 2.8, aspect: 1.65 },
      { x: -1.8, z: 5.0, s: 3.0, aspect: 1.70 },
      { x: -8.0, z: -6.0, s: 4.1, aspect: 1.75 },
      { x: 8.5, z: -7.0, s: 3.9, aspect: 1.70 },
      { x: 9.0, z: -2.8, s: 3.1, aspect: 1.65 },
      { x: -9.0, z: 6.0, s: 3.7, aspect: 1.70 },
      { x: -6.8, z: 8.5, s: 3.2, aspect: 1.60 },
      { x: 8.5, z: 6.5, s: 4.2, aspect: 1.75 },
      { x: 6.0, z: 9.0, s: 3.4, aspect: 1.65 },
      { x: 0.0, z: 11.2, s: 3.6, aspect: 1.65 },
      { x: -6.8, z: 10.2, s: 3.4, aspect: 1.60 },
      { x: 6.8, z: 10.2, s: 3.5, aspect: 1.70 },
      { x: 11.2, z: 0.5, s: 3.7, aspect: 1.65 },

      // Clearing entrance bushes
      { x: 1.6, z: -3.8, s: 3.1, aspect: 1.55 },
      { x: -2.4, z: -3.3, s: 3.5, aspect: 1.62 },
      { x: 3.6, z: -2.7, s: 2.9, aspect: 1.70 },
      { x: -4.3, z: -3.2, s: 3.3, aspect: 1.58 },

      // Funnel grove undergrowth (z = -5 to -12)
      { x: -4.8, z: -7.6, s: 3.9, aspect: 1.72 },
      { x: 4.2, z: -9.8, s: 3.6, aspect: 1.66 },
      { x: -2.6, z: -10.9, s: 3.1, aspect: 1.60 },
      { x: 1.2, z: -12.3, s: 3.5, aspect: 1.64 },

      // Corridor natural forest undergrowth
      { x: 3.8, z: -14.6, s: 3.3, aspect: 1.62 },
      { x: -2.7, z: -16.8, s: 3.6, aspect: 1.68 },
      { x: 2.4, z: -19.4, s: 3.0, aspect: 1.54 },
      { x: -3.8, z: -22.3, s: 3.7, aspect: 1.70 },
      { x: 0.5, z: -24.7, s: 2.9, aspect: 1.58 },
      { x: 3.6, z: -27.3, s: 3.4, aspect: 1.62 },
      { x: -2.9, z: -30.1, s: 3.8, aspect: 1.74 },
      { x: 2.7, z: -33.5, s: 3.1, aspect: 1.56 },
      { x: -3.5, z: -36.2, s: 3.5, aspect: 1.66 },
      { x: 0.8, z: -38.6, s: 2.8, aspect: 1.52 },
      { x: 3.9, z: -41.2, s: 3.6, aspect: 1.68 },
      { x: -2.5, z: -44.3, s: 3.3, aspect: 1.60 },
      { x: 2.1, z: -46.5, s: 3.5, aspect: 1.64 },
      { x: -1.2, z: -48.6, s: 3.2, aspect: 1.58 }
    ];

    for (const b of bushData) {
      const width = b.s;
      const height = b.s * (13 / 22) * (b.aspect / 1.65);
      this.propManager.addProp({
        texture: '/game_assets/environment/bush.png',
        x: b.x,
        z: b.z,
        width,
        height,
        anchorY: 0.04,
        yOffset: 0.05,
        collisionRadius: 0,
        shadow: true,
        shadowRadius: width * 0.28,
        sway: true,
        swaySpeed: 1.4 + Math.random() * 0.5,
        swayAmp: 0.04
      });
    }

    // 7. The Fountain (in the middle of Area 1)
    this.fountain = this.propManager.addProp({
      texture: '/game_assets/environment/the_fountain.png',
      x: 0,
      z: 0,
      width: 2.2,
      height: 2.2,
      anchorY: 0.04,
      yOffset: 0.02,
      collisionRadius: 0.7,
      shadow: true,
      shadowRadius: 0.85
    });
    this.fountain.spriteLow.userData.type = 'Fountain';
    this.fountain.spriteHigh.userData.type = 'Fountain';

    // The Hooded Angel NPC (main guide standing right in front of the player & fountain)
    this.angel = this.addNPC(new CloakedAngel(this.group, {
      x: 0.0,
      y: 0,
      z: -3.2,
      areaManager: this.areaManager
    }));

    // The Gatekeeper NPC (next to the Golden Gate on the right side)
    this.gatekeeper = this.addNPC(new Gatekeeper(this.group, {
      x: 14.0,
      y: 0,
      z: 7.8
    }));

    // 8. Blood Trail
    const bloodTex = createBloodTexture();
    const bloodMat = new THREE.MeshBasicMaterial({
      map: bloodTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      fog: true,
      toneMapped: false
    });

    const bloodTrailData = [
      { x: -1.2, z: -38.5, rx: 0.45, rz: 0.35, rot: 0.4 },
      { x: -1.7, z: -40.5, rx: 0.55, rz: 0.42, rot: -0.7 },
      { x: -2.1, z: -42.4, rx: 0.50, rz: 0.65, rot: 0.3 },
      { x: -2.6, z: -44.2, rx: 0.70, rz: 0.55, rot: 1.1 },
      { x: -3.0, z: -46.0, rx: 0.85, rz: 0.75, rot: -0.4 },
      { x: -3.5, z: -47.6, rx: 1.40, rz: 1.25, rot: 0.2 }
    ];

    for (const b of bloodTrailData) {
      const geo = new THREE.PlaneGeometry(b.rx, b.rz);
      const mesh = new THREE.Mesh(geo, bloodMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = b.rot;
      mesh.position.set(b.x, 0.015, b.z);
      mesh.renderOrder = 1;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }

    // 9. The Corpse
    this.corpse = this.propManager.addProp({
      texture: '/game_assets/environment/the_corpse.png',
      x: -3.5,
      z: -47.6,
      width: 1.35,
      height: 1.35,
      yOffset: 0.02,
      anchorY: 0.12,
      collisionRadius: 0.35,
      shadow: false
    });
    this.corpse.spriteLow.userData.type = 'Corpse';
    this.corpse.spriteHigh.userData.type = 'Corpse';

    // 10. Ground-Level Fog & Mushroom Glow
    this.groundFog = new GroundFog(this.group);
    this.mushroomGlow = new MushroomGlowManager(this.group, this.mushroomData);

    // 11. Interactive Fruit Items (disappear on pickup)
    this.addItem(new AppleItem(this.group, { x: -2.0, z: -5.0 }));
    this.addItem(new CherryItem(this.group, { x: 2.0, z: -5.5 }));
  }

  initInteractables() {
    // West Gate (sealed off — Playtesting Hall)
    this.interactables.push(new InteractableEntity({
      name: 'The West Gate',
      target: this.gate,
      range: 2.8,
      onInteract: ({ dialogue, player }) => {
        player.freeze();
        dialogue.startDialogue([
          "The iron gate is sealed shut.",
          "An inscription on the stone reads: 'Playtesting Archives — EON Survivor (by Square Wheel).'",
          "Speak with the Hooded Angel at the center of the grove to submit a Steam key or view our credits."
        ], () => {
          player.unfreeze();
        });
      }
    }));

    // Register all NPC Interactables
    for (const npc of this.npcs) {
      if (npc.interactable) {
        this.interactables.push(npc.interactable);
      }
    }

    // Register all Item Interactables
    for (const item of this.items) {
      if (item.interactable) {
        this.interactables.push(item.interactable);
      }
    }

    // Register all Gate Interactables
    for (const gate of this.gates) {
      if (gate.interactable) {
        this.interactables.push(gate.interactable);
      }
    }

    // The Corpse
    if (this.corpse) {
      this.interactables.push(new InteractableEntity({
        name: 'The Corpse',
        target: [this.corpse.spriteLow, this.corpse.spriteHigh],
        range: 2.8,
        onInteract: ({ dialogue, player, gameState }) => {
          gameState.seenCorpse = true;
          player.freeze();
          dialogue.startDialogue([
            "A pile of flesh and bones.",
            "A testimony to something that once was.",
            "It has died horribly."
          ], () => {
            if (!gameState.lootedCorpse) {
              dialogue.showChoices({
                prompt: "What will you do?",
                choices: [
                  {
                    label: "Grab a heap of flesh.",
                    lines: [
                      "You tear away a sickening clump of flesh from the remains.",
                      "Obtained Cursed Flesh."
                    ],
                    action: () => {
                      gameState.lootedCorpse = true;
                      if (!Array.isArray(gameState.inventory)) {
                        gameState.inventory = [];
                      }
                      const existing = gameState.inventory.find(i => i.id === 'cursed_flesh');
                      if (existing) {
                        existing.quantity = (existing.quantity || 1) + 1;
                      } else {
                        gameState.inventory.push({
                          id: 'cursed_flesh',
                          name: 'Cursed Flesh',
                          icon: '/game_assets/icons/cursed_flesh.png',
                          type: 'material',
                          quantity: 1,
                          description: 'A cold, writhing mass of corrupted flesh. It emanates a faint, unsettling warmth.'
                        });
                      }
                    }
                  },
                  {
                    label: "[Leave]"
                  }
                ]
              }, () => {
                player.unfreeze();
              });
            } else {
              player.unfreeze();
            }
          });
        }
      }));
    }

    // The Fountain
    if (this.fountain) {
      this.interactables.push(new InteractableEntity({
        name: 'The Fountain',
        target: [this.fountain.spriteLow, this.fountain.spriteHigh],
        range: 2.8,
        onInteract: ({ dialogue, player, gameState }) => {
          player.freeze();
          dialogue.startDialogue([
            "A stone fountain with flowing water.",
            "The water is remarkably blue and pure, shimmering with an untouched clarity."
          ], () => {
            const hasCursedFlesh = Array.isArray(gameState?.inventory) &&
              gameState.inventory.some(i => i.id === 'cursed_flesh' && (i.quantity || 1) > 0);

            if (hasCursedFlesh) {
              dialogue.showChoices({
                prompt: "The pure water ripples gently.",
                choices: [
                  {
                    label: "Purify the Cursed Flesh.",
                    lines: [
                      "You submerge the vile clump into the shimmering basin.",
                      "A soft hissing sound echoes as dark corruption cleanses away in gentle light.",
                      "Obtained Purified Flesh."
                    ],
                    action: () => {
                      const fleshIndex = gameState.inventory.findIndex(i => i.id === 'cursed_flesh');
                      if (fleshIndex !== -1) {
                        const item = gameState.inventory[fleshIndex];
                        if (item.quantity && item.quantity > 1) {
                          item.quantity -= 1;
                        } else {
                          gameState.inventory.splice(fleshIndex, 1);
                        }
                      }

                      const existingPurified = gameState.inventory.find(i => i.id === 'purified_flesh');
                      if (existingPurified) {
                        existingPurified.quantity = (existingPurified.quantity || 1) + 1;
                      } else {
                        gameState.inventory.push({
                          id: 'purified_flesh',
                          name: 'Purified Flesh',
                          icon: '/game_assets/icons/purified_flesh.png',
                          type: 'material',
                          quantity: 1,
                          description: 'Cleansed in the pure waters of the fountain. It glows with an ethereal, serene light.'
                        });
                      }
                    }
                  },
                  {
                    label: "[Leave]"
                  }
                ]
              }, () => {
                player.unfreeze();
              });
            } else {
              player.unfreeze();
            }
          });
        }
      }));
    }
  }

  bounds(pos) {
    pos.z = Math.max(-47.8, Math.min(13.2, pos.z));
    let maxX = 13.2;
    if (pos.z < -3.0 && pos.z >= -12.0) {
      const t = (-3.0 - pos.z) / 9.0;
      maxX = 13.2 - t * 9.6; // Tapers from 13.2 down to 3.6
    } else if (pos.z < -12.0) {
      maxX = 3.6; // Narrow frontal corridor
    }
    pos.x = Math.max(-maxX, Math.min(maxX, pos.x));
  }

  onEnter() {
    this.group.visible = true;
  }

  onExit() {
    this.group.visible = false;
  }

  update(delta, playerPosition) {
    this.propManager.update(delta, playerPosition);
    for (const npc of this.npcs) {
      npc.update(delta);
    }
    for (const item of this.items) {
      item.update(delta);
    }
    if (this.groundFog) this.groundFog.update(delta, playerPosition);
    if (this.mushroomGlow) this.mushroomGlow.update(delta);
  }
}
