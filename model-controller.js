// ===== NATIVE THREE.JS MODEL CONTROLLER — Iron Man Mark 1 =====
"use strict";

class ModelController {
  constructor(scene) {
    this.scene = scene;
    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);
    this.model = null; this.ready = false; this.materials = []; this.origMaterials = new Map(); this.mode = "hologram";
    this.rotationY = 0; this.rotationX = 0; this.scale = 1; this.panX = 0; this.panY = 0;
    this.targetRotationY = 0; this.targetRotationX = 0; this.targetScale = 1; this.targetPanX = 0; this.targetPanY = 0;
    this.homeScale = 1; this.homePanY = 0;
    this.MIN_SCALE = 0.1; this.MAX_SCALE = 8;
    this.autoRotate = true; this.autoRotateSpeed = 0.004;
    this.onReady = null; this.onError = null; this.onProgress = null;
    this.loadModel("assets/iron_man.glb"); this._animLoop();
  }
  loadModel(path) {
    this.currentLoadId = (this.currentLoadId || 0) + 1;
    const loadId = this.currentLoadId;

    if (this.model) {
      this.modelGroup.remove(this.model);
      this.model = null;
    }
    // Clear the group to ensure no previous async loads are lingering
    this.modelGroup.clear();

    this.ready = false;
    this.materials = [];
    this.origMaterials = new Map();
    
    const loading = document.getElementById('model-loading');
    if (loading) loading.classList.remove('hidden');

    const loader = new THREE.GLTFLoader();
    loader.load(path, (gltf) => {
      if (this.currentLoadId !== loadId) return; // Prevent async race condition

      this.model = gltf.scene;
      const box = new THREE.Box3().setFromObject(this.model);
      this.model.position.sub(box.getCenter(new THREE.Vector3()));
      this.modelGroup.add(this.model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const visH = 2 * Math.tan((55 * Math.PI / 180) / 2) * 12;
      const fit = (visH * 0.62) / maxDim;
      this.homeScale = fit; this.homePanY = 0.4;
      this.targetScale = fit; this.targetPanX = 0; this.targetPanY = this.homePanY;
      this.scale = fit * 0.01; this.panY = this.homePanY;
      this.MIN_SCALE = fit * 0.2; this.MAX_SCALE = fit * 5;
      this.model.traverse((c) => { 
        if (c.isMesh) { 
          this.materials.push(c); 
          if (Array.isArray(c.material)) {
            const m = c.material.map(mat => { const cloned = mat.clone(); cloned.transparent = true; return cloned; });
            c.material = m; 
            this.origMaterials.set(c.uuid, m); 
          } else {
            const m = c.material.clone(); 
            m.transparent = true; 
            c.material = m; 
            this.origMaterials.set(c.uuid, m); 
          }
        } 
      });
      this.ready = true; this.setMode("hologram"); if (this.onReady) this.onReady();
    }, (xhr) => { if (this.onProgress) this.onProgress((xhr.total > 0 ? (xhr.loaded / xhr.total * 100) : 0).toFixed(0)); },
       (err) => { console.error("[Model] Load error:", err); if (this.onError) this.onError(err); });
  }
  _animLoop() {
    requestAnimationFrame(() => this._animLoop());
    if (!this.ready) return;
    if (this.autoRotate) this.targetRotationY += this.autoRotateSpeed;
    const L = 0.09;
    this.rotationY += (this.targetRotationY - this.rotationY) * L;
    this.rotationX += (this.targetRotationX - this.rotationX) * L;
    this.scale     += (this.targetScale     - this.scale)     * L;
    this.panX      += (this.targetPanX      - this.panX)      * L;
    this.panY      += (this.targetPanY      - this.panY)      * L;
    const mt = Math.PI / 2.2;
    this.rotationX = Math.max(-mt, Math.min(mt, this.rotationX));
    this.targetRotationX = Math.max(-mt, Math.min(mt, this.targetRotationX));
    this.modelGroup.rotation.y = this.rotationY;
    this.modelGroup.rotation.x = this.rotationX;
    this.modelGroup.scale.setScalar(this.scale);
    this.modelGroup.position.set(this.panX, this.panY, 0);
  }
  applyRotation(dx, dy) { this.targetRotationY += dx * 6; this.targetRotationX += dy * 3; this.autoRotate = false; }
  applyPinch(dx, dy) {
    // While pinched, hand movement ROTATES the model (like spinning it)
    if (Math.abs(dx) > 0.0006 || Math.abs(dy) > 0.0006) {
      this.targetRotationY += dx * 8;   // left/right = Y spin
      this.targetRotationX += dy * 4;   // up/down = X tilt
    }
    this.autoRotate = false;
  }
  zoomIn() {
    // Zoom to 1.5x of HOME scale (not current, so it's always predictable)
    this.targetScale = Math.min(this.MAX_SCALE, this.homeScale * 1.5);
  }
  releasePinch() {
    // Fully reset: zoom back to home, pan back to centre
    this.targetScale = this.homeScale;
    this.targetPanX  = 0;
    this.targetPanY  = this.homePanY;
    // Also gently snap rotation back towards 0 tilt
    this.targetRotationX = 0;
    this.autoRotate = true; // resume auto-rotate on release
  }
  startAutoRotate() { this.autoRotate = true; }
  applyZoom(delta) { this.targetScale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, this.targetScale + delta)); }
  setMode(mode) {
    this.mode = mode; if (!this.ready) return;
    this.materials.forEach(mesh => {
      const orig = this.origMaterials.get(mesh.uuid);
      
      const setMat = (modeMat) => {
        if (Array.isArray(orig)) {
          // If original was an array, apply the mode material to all slots, or just set single material
          mesh.material = modeMat; 
        } else {
          mesh.material = modeMat;
        }
      };

      if (mode === "hologram") setMat(new THREE.MeshBasicMaterial({ color: 0x00c8ff, transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, depthWrite: false }));
      else if (mode === "xray") setMat(new THREE.MeshBasicMaterial({ color: 0x0080ff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
      else if (mode === "wireframe") setMat(new THREE.MeshBasicMaterial({ color: 0x00c8ff, wireframe: true, transparent: true, opacity: 0.85 }));
      else if (mode === "solid") mesh.material = orig;
    });
  }
  reset() { this.targetRotationY = 0; this.targetRotationX = 0; this.targetScale = this.homeScale; this.targetPanX = 0; this.targetPanY = this.homePanY; this.autoRotate = true; this.setMode("hologram"); }
  getOrbitInfo() { return { theta: this.rotationY.toFixed(2), phi: this.rotationX.toFixed(2), radius: this.scale.toFixed(3) }; }
}