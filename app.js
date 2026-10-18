// ===== MAIN ORCHESTRATOR — JARVIS HOLOGRAPHIC McLAREN INTERFACE =====
'use strict';

let modelController = null;
let bgScene = null;
let tracker = null;
let hud = null;
let currentModelName = 'IRON MAN';
let currentModelIndex = 2;
const MODELS = [
  {
    name: 'ARC REACTOR',
    path: 'assets/arc_reactor_-_tony_stark_-_high_poly.glb',
    chassis: 'VIBRANIUM',
    engine: 'ARC REACTOR'
  },
  {
    name: 'IRON MAN MARK 1',
    path: 'assets/iron_man_-_mark_1.glb',
    chassis: 'MARK 1',
    engine: 'PALLADIUM CORE'
  },
  {
    name: 'IRON MAN',
    path: 'assets/iron_man.glb',
    chassis: 'TITANIUM ALLOY',
    engine: 'ARC REACTOR MK II'
  },
  {
    name: 'IRON MAN MK2',
    path: 'assets/iron_man (1).glb',
    chassis: 'NANO-TECH',
    engine: 'RT NODE'
  },
  {
    name: 'IRON SPIDER',
    path: 'assets/iron_spider.glb',
    chassis: 'NANO-PARTICLE',
    engine: 'STARK TECH'
  },
  {
    name: 'SPIDER-MAN',
    path: 'assets/spider-man_brand_new_day.glb',
    chassis: 'SPANDEX / KEVLAR',
    engine: 'WEBSHOOTERS'
  },
  {
    name: 'MJOLNIR',
    path: 'assets/mjolnir_thors_hammer.glb',
    chassis: 'URU METAL',
    engine: 'ODINFORCE'
  },
  {
    name: 'IRON MAN SLEEP',
    path: 'assets/iron_man SLEEP.glb',
    chassis: 'TITANIUM ALLOY',
    engine: 'STANDBY MODE'
  },
  {
    name: 'LOKI HELMET',
    path: 'assets/loki_helmet.glb',
    chassis: 'ASGARDIAN GOLD',
    engine: 'MAGIC / ILLUSION'
  },
  {
    name: 'BLACK PANTHER',
    path: 'assets/black_panther_helmet.glb',
    chassis: 'VIBRANIUM',
    engine: 'KINETIC ABSORPTION'
  },
  {
    name: 'ASTON MARTIN F1',
    path: 'assets/aston_martin_f1_amr23_2023.glb',
    chassis: 'CARBON FIBRE',
    engine: 'MERCEDES V6 TURBO'
  },
  {
    name: 'VENOM',
    path: 'assets/venom_-_the_symbiote.glb',
    chassis: 'SYMBIOTE BIOMASS',
    engine: 'ALIEN PARASITE'
  },
  {
    name: 'ULTRON',
    path: 'assets/ultron_-_aaou_mcu.glb',
    chassis: 'VIBRANIUM ALLOY',
    engine: 'AI NEURAL NET'
  },
  {
    name: 'DEADPOOL',
    path: 'assets/deadpool_-_high_3d_ploy_ready_for_games.glb',
    chassis: 'WEAPON X SPANDEX',
    engine: 'HEALING FACTOR'
  },
  {
    name: 'INFINITY STONES',
    path: 'assets/infinity_stones.glb',
    chassis: 'COSMIC ENERGY',
    engine: 'UNIVERSAL SINGULARITY'
  }
];
let currentMode = 'hologram';
let lastGesture = '';
let lastGestureTriggerTime = 0;
const GESTURE_COOLDOWN_MS = 900;

// Smooth hand delta accumulators
let smoothDx = 0, smoothDy = 0;
const SMOOTH_FACTOR = 0.2;

let frameCount = 0;
let lastFpsCheck = performance.now();

// ==================== BOOT SEQUENCE ====================
async function boot() {
  const statusEl = document.getElementById('boot-status');
  const bootScreen = document.getElementById('boot-screen');
  const app = document.getElementById('app');

  const steps = [
    [300,  'LOADING THREE.JS BACKGROUND ENGINE...'],
    [700,  'INITIALIZING LOCAL GLB LOADER...'],
    [1100, 'CONNECTING TO HOLOGRAPHIC RENDERER...'],
    [1500, 'CALIBRATING HAND TRACKING AI MODEL...'],
    [1900, 'REQUESTING CAMERA PERMISSIONS...'],
    [2200, 'LAUNCHING ARC REACTOR PROJECTION...'],
  ];

  let prev = 0;
  for (const [t, msg] of steps) {
    await sleep(t - prev);
    prev = t;
    if (statusEl) statusEl.textContent = msg;
  }

  // ---- Show app ----
  app.classList.remove('hidden');

  // ---- Init HUD ----
  hud = new HUD();

  // ---- Init background Three.js scene ----
  const bgCanvas = document.getElementById('bg-canvas');
  bgScene = new BgScene(bgCanvas);

  // ---- Init Native Model Controller ----
  modelController = new ModelController(bgScene.scene);

  modelController.onProgress = (pct) => {
    const el = document.getElementById('ml-pct');
    if (el) el.textContent = pct + '%';
  };

  modelController.onReady = () => {
    // Hide loading overlay
    const loading = document.getElementById('model-loading');
    if (loading) loading.classList.add('hidden');

    const statusModel = document.getElementById('model-status');
    if (statusModel) statusModel.textContent = 'ONLINE';

    hud.toast(`◉ ${currentModelName} LOADED — HAND CONTROL ACTIVE`, 3500);
    hud.setActiveMode('hologram');
  };

  modelController.onError = (err) => {
    const statusModel = document.getElementById('model-status');
    if (statusModel) { statusModel.textContent = 'ERROR'; statusModel.style.color = '#ff2020'; }
    hud.toast('⚠ MODEL LOAD ERROR — CHECK FILE', 5000);
  };

  // ---- Init hand tracker ----
  const video = document.getElementById('camera-feed');
  const camCanvas = document.getElementById('camera-canvas');

  try {
    tracker = new HandTracker(video, camCanvas);

    tracker.onHandData = (data) => {
      hud.update(data);
      handleContinuousGesture(data);
    };

    tracker.onGesture = (gesture) => {
      handleTriggerGesture(gesture);
    };

    await tracker.init();
    hud.setStatus(true);
    hud.toast('✓ HAND TRACKING ONLINE', 2000);
  } catch (err) {
    console.warn('[App] Camera unavailable:', err);
    hud.toast('⚠ CAMERA UNAVAILABLE — MOUSE/TOUCH MODE ACTIVE', 4000);
    enableMouseFallback();
  }

  // ---- Fade boot screen ----
  await sleep(200);
  bootScreen.classList.add('gone');

  // ---- FPS counter ----
  setInterval(updateFps, 600);

  // ---- Coord display ----
  setInterval(updateCoords, 250);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Fake progress bar since Sketchfab API doesn't expose load progress
// Removed as GLTFLoader provides actual progress

// ==================== CONTINUOUS GESTURE HANDLER ====================
// Tracks whether the previous frame was a pinch so we can detect start & release
let _wasPinching = false;

function handleContinuousGesture(data) {
  const { gesture, dx, dy, handCount } = data;
  if (!modelController || handCount === 0) {
    if (_wasPinching) { modelController && modelController.releasePinch(); _wasPinching = false; }
    smoothDx = 0; smoothDy = 0;
    return;
  }

  const t0 = performance.now();

  // ---- Open Palm → rotate ----
  if (gesture === 'OPEN_PALM') {
    smoothDx += (dx - smoothDx) * SMOOTH_FACTOR;
    smoothDy += (dy - smoothDy) * SMOOTH_FACTOR;
    if (Math.abs(smoothDx) > 0.0006 || Math.abs(smoothDy) > 0.0006) {
      modelController.applyRotation(-smoothDx * 10, smoothDy * 5);
    }
    if (_wasPinching) { modelController.releasePinch(); _wasPinching = false; }
  }
  // ---- Pinch → auto-zoom on start, then move model with hand ----
  else if (gesture === 'PINCH') {
    // First frame of pinch: trigger a slight zoom-in
    if (!_wasPinching) {
      modelController.zoomIn();
      _wasPinching = true;
      smoothDx = 0; smoothDy = 0; // reset deltas so there's no jump
    }
    smoothDx += (dx - smoothDx) * SMOOTH_FACTOR;
    smoothDy += (dy - smoothDy) * SMOOTH_FACTOR;
    modelController.applyPinch(smoothDx, smoothDy);
  }
  // ---- L-Sign → auto-rotate ----
  else if (gesture === 'L_SIGN') {
    modelController.autoRotate = true;
    if (_wasPinching) { modelController.releasePinch(); _wasPinching = false; }
    smoothDx = 0; smoothDy = 0;
  }
  // ---- Everything else → decay ----
  else {
    smoothDx *= 0.80; smoothDy *= 0.80;
    if (_wasPinching) { modelController.releasePinch(); _wasPinching = false; }
  }

  hud.updateLatency(Math.round(performance.now() - t0));
}

// ==================== TRIGGER GESTURE HANDLER ====================
// Only fires once per gesture change (debounced by HandTracker)
function handleTriggerGesture(gesture) {
  const now = Date.now();
  if (now - lastGestureTriggerTime < GESTURE_COOLDOWN_MS) return;
  if (gesture === lastGesture) return;
  lastGestureTriggerTime = now;
  lastGesture = gesture;

  switch (gesture) {
    case 'FIST':
      // Fist resets the view back to default
      if (modelController) modelController.reset();
      hud.toast('\u27f3 VIEW RESET');
      hud.setActiveMode('hologram');
      currentMode = 'hologram';
      break;
    case 'L_SIGN':
      if (modelController) { modelController.startAutoRotate(); hud.toast('\u25b6 AUTO ROTATING'); }
      break;
    // OPEN_PALM and PINCH are handled continuously — no trigger action needed
  }
}

// ==================== VIEW MODES ====================
function setMode(mode) {
  // Public — called by mode buttons
  if (mode === currentMode) {
    // Toggle back to hologram
    currentMode = 'hologram';
  } else {
    currentMode = mode;
  }
  _applyMode(currentMode);
}

function toggleMode(mode) {
  currentMode = (currentMode === mode) ? 'hologram' : mode;
  _applyMode(currentMode);
}

function _applyMode(mode) {
  if (modelController) modelController.setMode(mode);
  if (hud) hud.setActiveMode(mode);
  const modeLabel = document.getElementById('mode-label');
  if (modeLabel) {
    const names = { hologram: 'HOLOGRAPHIC MODE', xray: 'X-RAY SCAN MODE', wireframe: 'WIREFRAME MODE', solid: 'SOLID MODE' };
    modeLabel.textContent = `◉ ${names[mode] || mode}`;
  }
  hud.toast(`◉ ${mode.toUpperCase()} MODE ACTIVE`);
}

// ==================== MOUSE / TOUCH FALLBACK ====================
function enableMouseFallback() {
  let dragging = false, lastX = 0, lastY = 0;
  const container = document.getElementById('model-container');

  container.addEventListener('mousedown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    if (modelController) modelController.autoRotate = false;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', e => {
    if (!dragging || !modelController) return;
    const dx = (e.clientX - lastX) / window.innerWidth;
    const dy = (e.clientY - lastY) / window.innerHeight;
    modelController.applyRotation(-dx * 6, dy * 3);
    lastX = e.clientX; lastY = e.clientY;
  });
  container.addEventListener('wheel', e => {
    if (modelController) modelController.applyZoom(-e.deltaY * 0.005);
    e.preventDefault();
  }, { passive: false });

  // Touch
  let lastTouchDist = null;
  container.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      if (modelController) modelController.autoRotate = false;
    }
  }, { passive: true });
  container.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && dragging && modelController) {
      const dx = (e.touches[0].clientX - lastX) / window.innerWidth;
      const dy = (e.touches[0].clientY - lastY) / window.innerHeight;
      modelController.applyRotation(-dx * 6, dy * 3);
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2 && modelController) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastTouchDist !== null) modelController.applyZoom((d - lastTouchDist) * 0.005);
      lastTouchDist = d;
    }
  }, { passive: true });
  container.addEventListener('touchend', () => { dragging = false; lastTouchDist = null; });
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', e => {
  if (!modelController) return;
  switch (e.key) {
    case '1': setMode('hologram'); break;
    case '2': setMode('xray');     break;
    case '3': setMode('wireframe'); break;
    case '4': setMode('solid');    break;
    case 'r': case 'R':
      modelController.reset();
      hud?.toast('⟳ VIEW RESET');
      currentMode = 'hologram';
      hud?.setActiveMode('hologram');
      break;
    case ' ':
      modelController.autoRotate = !modelController.autoRotate;
      hud?.toast(modelController.autoRotate ? '▶ AUTO ROTATE' : '⏸ PAUSED');
      e.preventDefault();
      break;
  }
});

// ==================== HUD UPDATERS ====================
(function rAFCounter() { frameCount++; requestAnimationFrame(rAFCounter); })();

function updateFps() {
  const now = performance.now();
  const fps = Math.round((frameCount / (now - lastFpsCheck)) * 1000);
  frameCount = 0; lastFpsCheck = now;
  hud?.updateFps(fps);
}

function updateCoords() {
  if (!modelController) return;
  const { theta, phi, radius } = modelController.getOrbitInfo();
  const el = document.getElementById('coords');
  if (el) el.textContent = `θ: ${theta} φ: ${phi} R: ${radius}`;
}

// ==================== MODEL SWITCHING ====================
window.switchModel = function() {
  currentModelIndex = (currentModelIndex + 1) % MODELS.length;
  const nextModel = MODELS[currentModelIndex];
  
  currentModelName = nextModel.name;
  modelController.loadModel(nextModel.path);
  
  // Update UI Elements
  const modelNameDisplay = document.querySelector('.model-name-display');
  if (modelNameDisplay) modelNameDisplay.textContent = currentModelName;
  
  const mlText = document.querySelector('.ml-text');
  if (mlText) mlText.textContent = `LOADING ${currentModelName}...`;
  
  const chassisValue = document.querySelector('.panel-row:nth-child(2) .row-value');
  if (chassisValue) chassisValue.textContent = nextModel.chassis;
  
  const engineValue = document.querySelector('.panel-row:nth-child(4) .row-value');
  if (engineValue) engineValue.textContent = nextModel.engine;
};

// ==================== START ====================
window.addEventListener('DOMContentLoaded', boot);
