import * as THREE from 'three';

/**
 * In-game Asset Inspector & Coordinate Picker.
 * Toggle with F2 or Tilde (`).
 * Click any asset (tree, bush, mushroom, flower, wall, etc.) to highlight it,
 * display its exact coordinates, and auto-copy JSON snippet to clipboard.
 *
 * To remove: delete src/debug/ and remove initAssetInspector() in src/main.js.
 */
export function initAssetInspector({ scene, camera, player, propManager }) {
  let isActive = false;
  let selectedObject = null;
  let highlightMesh = null;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // 1. Create Neon Selection Box Helper
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const boxMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    wireframe: true,
    depthTest: false,
    transparent: true,
    opacity: 0.95
  });
  highlightMesh = new THREE.Mesh(boxGeo, boxMat);
  highlightMesh.renderOrder = 9999;
  highlightMesh.frustumCulled = false;
  highlightMesh.visible = false;
  scene.add(highlightMesh);

  // 2. Create Floating HUD
  const hud = document.createElement('div');
  hud.id = 'debug-inspector-hud';
  Object.assign(hud.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: '99999',
    background: 'rgba(10, 15, 30, 0.92)',
    border: '1px solid #00f0ff',
    borderRadius: '8px',
    padding: '14px 18px',
    color: '#e2e8f0',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '1.5',
    boxShadow: '0 8px 30px rgba(0, 240, 255, 0.25), 0 4px 12px rgba(0,0,0,0.8)',
    maxWidth: '360px',
    minWidth: '280px',
    pointerEvents: 'auto',
    display: 'none',
    userSelect: 'text'
  });

  hud.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid rgba(0, 240, 255, 0.3); padding-bottom: 6px;">
      <span style="color: #00f0ff; font-weight: bold; font-size: 13px; letter-spacing: 0.5px;">[ASSET INSPECTOR]</span>
      <span style="font-size: 11px; background: rgba(0,240,255,0.15); color: #00f0ff; padding: 2px 6px; border-radius: 4px;">F2: exit | F3: pin HUD</span>
    </div>

    <!-- Live Player Coordinates -->
    <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 6px; padding: 8px 10px; margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="color: #38bdf8; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Player Coordinates</span>
        <div style="display: flex; gap: 4px;">
          <button id="dbg-pin-coords" style="background: #1e293b; color: #94a3b8; border: 1px solid #475569; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer; font-family: inherit;">Pin (F3)</button>
          <button id="dbg-copy-player" style="background: #0284c7; color: #fff; border: none; border-radius: 3px; padding: 2px 8px; font-size: 11px; cursor: pointer; font-family: inherit; font-weight: bold;">Copy JSON</button>
        </div>
      </div>
      <div id="dbg-player-pos" style="color: #4ade80; font-weight: bold; font-size: 12px;">X: 0.00 | Y: 1.20 | Z: 0.00</div>
      <div id="dbg-player-rot" style="color: #94a3b8; font-size: 11px; margin-top: 2px;">Yaw: 0.0°</div>
    </div>

    <div id="dbg-copy-status" style="margin-bottom: 10px; padding: 6px 10px; background: #166534; color: #86efac; border-radius: 4px; font-weight: bold; text-align: center; font-size: 12px; display: none; transition: opacity 0.3s;">
      &#10003; COPIED TO CLIPBOARD!
    </div>

    <div id="dbg-hint" style="color: #94a3b8; font-size: 12px; margin-bottom: 6px;">
      Click any tree, bush, mushroom, or wall in the scene to inspect.
    </div>
    <div id="dbg-details" style="display: none;">
      <div style="margin: 4px 0;"><span style="color: #38bdf8;">Asset:</span> <strong id="dbg-asset-name" style="color: #fff;">-</strong></div>
      <div style="margin: 4px 0;"><span style="color: #38bdf8;">Type:</span> <span id="dbg-asset-type" style="color: #facc15; font-weight: bold;">-</span></div>
      <div style="margin: 4px 0;"><span style="color: #38bdf8;">Pos (X, Y, Z):</span> <span id="dbg-asset-pos" style="color: #4ade80;">-</span></div>
      <div style="margin: 4px 0;"><span style="color: #38bdf8;">Size (W x H):</span> <span id="dbg-asset-size" style="color: #a78bfa;">-</span></div>
      <pre id="dbg-code-snippet" style="background: rgba(0,0,0,0.6); border: 1px solid #334155; border-radius: 4px; padding: 8px; font-size: 11px; overflow-x: auto; margin-top: 8px; color: #f1f5f9;"></pre>
    </div>
  `;
  document.body.appendChild(hud);

  // 3. Create persistent top-left live coordinate badge
  const coordsBadge = document.createElement('div');
  coordsBadge.id = 'debug-coords-badge';
  Object.assign(coordsBadge.style, {
    position: 'fixed',
    top: '12px',
    left: '12px',
    zIndex: '99999',
    background: 'rgba(10, 15, 30, 0.88)',
    border: '1px solid rgba(0, 240, 255, 0.6)',
    borderRadius: '6px',
    padding: '6px 12px',
    color: '#4ade80',
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
    pointerEvents: 'none',
    display: 'none',
    userSelect: 'none'
  });
  document.body.appendChild(coordsBadge);

  const dbgHint = hud.querySelector('#dbg-hint');
  const dbgDetails = hud.querySelector('#dbg-details');
  const dbgName = hud.querySelector('#dbg-asset-name');
  const dbgType = hud.querySelector('#dbg-asset-type');
  const dbgPos = hud.querySelector('#dbg-asset-pos');
  const dbgSize = hud.querySelector('#dbg-asset-size');
  const dbgStatus = hud.querySelector('#dbg-copy-status');
  const dbgSnippet = hud.querySelector('#dbg-code-snippet');
  const dbgPlayerPos = hud.querySelector('#dbg-player-pos');
  const dbgPlayerRot = hud.querySelector('#dbg-player-rot');
  const dbgCopyPlayer = hud.querySelector('#dbg-copy-player');
  const dbgPinBtn = hud.querySelector('#dbg-pin-coords');

  let showCoordsBadge = false;

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }

  function flashStatus(text) {
    dbgStatus.textContent = text;
    dbgStatus.style.display = 'block';
    dbgStatus.style.opacity = '1';
    clearTimeout(dbgStatus._timer);
    dbgStatus._timer = setTimeout(() => {
      dbgStatus.style.opacity = '0';
      setTimeout(() => { dbgStatus.style.display = 'none'; }, 300);
    }, 2000);
  }

  function copyPlayerCoords() {
    if (!player || !player.position) return;
    const px = Number(player.position.x.toFixed(2));
    const py = Number(player.position.y.toFixed(2));
    const pz = Number(player.position.z.toFixed(2));
    const yaw = Number(player.yaw.toFixed(2));

    const json = JSON.stringify({ x: px, y: py, z: pz, yaw }, null, 2);
    copyText(json);
    flashStatus('✓ PLAYER POS COPIED TO CLIPBOARD!');
  }

  dbgCopyPlayer.addEventListener('click', (e) => {
    e.stopPropagation();
    copyPlayerCoords();
  });

  dbgPinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCoordsBadge();
  });

  function updateCoordsBadge() {
    coordsBadge.style.display = (showCoordsBadge || isActive) ? 'block' : 'none';
    if (dbgPinBtn) {
      if (showCoordsBadge) {
        dbgPinBtn.style.background = '#166534';
        dbgPinBtn.style.color = '#86efac';
        dbgPinBtn.style.borderColor = '#22c55e';
        dbgPinBtn.textContent = 'Pinned (F3) ✓';
      } else {
        dbgPinBtn.style.background = '#1e293b';
        dbgPinBtn.style.color = '#94a3b8';
        dbgPinBtn.style.borderColor = '#475569';
        dbgPinBtn.textContent = 'Pin (F3)';
      }
    }
  }

  function toggleCoordsBadge(forced) {
    showCoordsBadge = typeof forced === 'boolean' ? forced : !showCoordsBadge;
    updateCoordsBadge();
  }

  function updateLoop() {
    if (player && player.position) {
      const px = player.position.x.toFixed(2);
      const py = player.position.y.toFixed(2);
      const pz = player.position.z.toFixed(2);
      const yawDeg = ((player.yaw * 180 / Math.PI) % 360).toFixed(1);

      if (isActive && dbgPlayerPos) {
        dbgPlayerPos.textContent = `X: ${px} | Y: ${py} | Z: ${pz}`;
        dbgPlayerRot.textContent = `Yaw: ${yawDeg}° (${player.yaw.toFixed(2)} rad)`;
      }

      if (coordsBadge && coordsBadge.style.display !== 'none') {
        coordsBadge.textContent = `XYZ: ${px}, ${py}, ${pz} | Yaw: ${yawDeg}°`;
      }
    }
    requestAnimationFrame(updateLoop);
  }
  requestAnimationFrame(updateLoop);

  function toggleDebug(forcedState) {
    isActive = typeof forcedState === 'boolean' ? forcedState : !isActive;
    if (isActive) {
      if (player && typeof player.freeze === 'function') {
        player.freeze();
      }
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      hud.style.display = 'block';
    } else {
      if (player && typeof player.unfreeze === 'function') {
        player.unfreeze();
      }
      hud.style.display = 'none';
      if (highlightMesh) highlightMesh.visible = false;
      selectedObject = null;
    }
    updateCoordsBadge();
  }

  // Toggle on F2 or Backquote (`), F3 for live coords pin, P for player coords
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F2' || e.code === 'Backquote') {
      e.preventDefault();
      toggleDebug();
    } else if (e.code === 'F3') {
      e.preventDefault();
      toggleCoordsBadge();
    } else if (isActive && e.code === 'KeyP') {
      copyPlayerCoords();
    }
  });

  // Handle asset click in debug mode
  window.addEventListener('pointerdown', (e) => {
    if (!isActive) return;
    if (hud.contains(e.target)) return; // Ignore click on HUD itself

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Filter candidate objects in scene
    const candidates = [];
    scene.traverse((obj) => {
      if (obj === highlightMesh) return;
      if (obj.isMesh && obj.geometry && obj.geometry.type === 'PlaneGeometry' && obj.material?.map?.repeat?.x === 36) {
        // Skip terrain floor
        return;
      }
      if (obj.geometry?.type === 'SphereGeometry' && obj.scale.x > 100) {
        // Skip sky sphere
        return;
      }
      if (obj.isSprite || obj.userData?.type === 'Wall' || obj.userData?.texture) {
        candidates.push(obj);
      } else if (obj.isMesh && obj.material?.side === THREE.DoubleSide && obj.geometry?.type === 'PlaneGeometry') {
        // Wall meshes
        candidates.push(obj);
      }
    });

    const intersects = raycaster.intersectObjects(candidates, false);
    if (intersects.length === 0) return;

    // Pick closest hit
    const hit = intersects[0];
    const target = hit.object;
    selectedObject = target;

    // Extract metadata
    const ud = target.userData || {};
    let texPath = ud.texture || target.material?.map?.image?.src || '';
    let fileName = texPath ? texPath.split('/').pop().split('?')[0] : 'Unknown';

    let type = ud.type || 'Prop';
    if (fileName.includes('tree')) type = 'Tree';
    else if (fileName.includes('bush')) type = 'Bush';
    else if (fileName.includes('Mushroom')) type = 'Mushroom';
    else if (fileName.includes('flower') || fileName.includes('Flower')) type = 'Flower';
    else if (fileName.includes('Grass') || fileName.includes('grass')) type = 'Grass';
    else if (fileName.includes('collision_background')) type = 'Wall';
    else if (fileName.includes('angel')) type = 'Angel';

    const x = Number(target.position.x.toFixed(2));
    const y = Number(target.position.y.toFixed(2));
    const z = Number(target.position.z.toFixed(2));

    const width = Number((ud.width || target.scale.x).toFixed(2));
    const height = Number((ud.height || target.scale.y).toFixed(2));

    // Update neon highlight box
    highlightMesh.visible = true;
    if (target.isSprite) {
      const anchorY = ud.anchorY !== undefined ? ud.anchorY : 0.09375;
      const centerY = target.position.y + height * (0.5 - anchorY);
      highlightMesh.position.set(x, centerY, z);
      highlightMesh.rotation.set(0, 0, 0);
      highlightMesh.scale.set(width, height, Math.max(0.3, width * 0.15));
    } else {
      highlightMesh.position.copy(target.position);
      highlightMesh.rotation.copy(target.rotation);
      highlightMesh.scale.set(width, height, 0.4);
    }

    // Build snippet
    const snippetObj = {
      type,
      texture: fileName,
      x,
      z,
      ...(y !== 0 ? { y } : {}),
      width,
      height,
      ...(ud.collisionRadius ? { collisionRadius: ud.collisionRadius } : {})
    };

    const snippetJson = JSON.stringify(snippetObj, null, 2);
    copyText(snippetJson);

    // Update HUD
    dbgHint.style.display = 'none';
    dbgDetails.style.display = 'block';
    dbgName.textContent = fileName;
    dbgType.textContent = type;
    dbgPos.textContent = `X: ${x} | Y: ${y} | Z: ${z}`;
    dbgSize.textContent = `W: ${width} | H: ${height}`;
    dbgSnippet.textContent = snippetJson;

    // Flash copied indicator
    flashStatus('✓ ASSET COPIED TO CLIPBOARD!');
  });

  return {
    toggle: toggleDebug,
    isActive: () => isActive
  };
}
