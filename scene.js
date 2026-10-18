// ===== THREE.JS SCENE — F1 CAR + HOLOGRAPHIC EFFECTS =====
'use strict';

class HologramScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.mode = 'hologram'; // hologram | xray | wireframe | solid
    this.rotation = { x: 0, y: 0, z: 0 };
    this.targetRotation = { x: -0.15, y: 0, z: 0 };
    this.scale = 1;
    this.targetScale = 1;
    this.autoRotate = true;
    this.scanProgress = 0;
    this.explodeAmount = 0;
    this.targetExplode = 0;

    this._init();
    this._buildF1Car();
    this._buildEnvironment();
    this._buildParticles();
    this._animate();
  }

  _init() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);

    // Scene
    this.scene = new THREE.Scene();
    // No fog - performance

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 200);
    this.camera.position.set(0, 1.5, 7);
    this.camera.lookAt(0, 0.3, 0);

    // Groups
    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);

    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // ==================== F1 CAR BUILD ====================
  _buildF1Car() {
    this.parts = {};
    this.allMeshes = [];
    const C = { x: 0, y: 0, z: 0 };

    const holoCyan = 0x00f5ff;
    const holoBlue = 0x0060ff;
    const holoRed  = 0xff2020;

    // Helper: create holographic mesh
    const mkMesh = (geo, opts = {}) => {
      const color = opts.color || holoCyan;
      const mat = new THREE.MeshPhysicalMaterial({
        color, transparent: true, opacity: opts.opacity || 0.82,
        wireframe: false,
        roughness: 0.1, metalness: 0.9,
        emissive: new THREE.Color(color).multiplyScalar(0.35),
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.baseColor = color;
      mesh.userData.baseOpacity = opts.opacity || 0.82;
      mesh.userData.partName = opts.part || 'body';
      mesh.userData.explodeDir = opts.explodeDir || new THREE.Vector3(0, 0, 0);
      mesh.userData.basePos = opts.pos ? opts.pos.clone() : new THREE.Vector3();
      if (opts.pos) mesh.position.copy(opts.pos);
      if (opts.rot) mesh.rotation.set(...opts.rot);
      if (opts.scale) mesh.scale.set(...opts.scale);
      this.carGroup.add(mesh);
      this.allMeshes.push(mesh);
      return mesh;
    };

    // ---- CHASSIS / MONOCOQUE ----
    const chassis = mkMesh(
      new THREE.BoxGeometry(0.6, 0.28, 3.8, 4, 2, 12),
      { part: 'chassis', color: holoCyan, opacity: 0.75,
        pos: new THREE.Vector3(0, 0.14, 0), explodeDir: new THREE.Vector3(0, 0.5, 0) }
    );
    // Taper chassis front
    chassis.geometry.attributes.position.array.forEach((_, i) => {
      const vx = chassis.geometry.attributes.position.array[i * 3];
      const vz = chassis.geometry.attributes.position.array[i * 3 + 2];
      if (vz < -1.0) {
        const t = (-vz - 1.0) / 0.9;
        chassis.geometry.attributes.position.array[i * 3] *= (1 - t * 0.55);
        chassis.geometry.attributes.position.array[i * 3 + 1] -= t * 0.06;
      }
    });
    chassis.geometry.attributes.position.needsUpdate = true;
    chassis.geometry.computeVertexNormals();
    this.parts.chassis = chassis;

    // ---- COCKPIT / BODYWORK ----
    const cockpit = mkMesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.28, 8, 1, false, 0, Math.PI * 2),
      { part: 'cockpit', color: 0x0080ff, opacity: 0.7,
        pos: new THREE.Vector3(0, 0.32, 0.3), rot: [0, 0, 0], explodeDir: new THREE.Vector3(0, 1, 0) }
    );

    // ---- NOSE CONE ----
    const nose = mkMesh(
      new THREE.ConeGeometry(0.12, 1.2, 8),
      { part: 'nose', color: holoCyan, opacity: 0.8,
        pos: new THREE.Vector3(0, 0.1, -2.5), rot: [Math.PI / 2, 0, 0],
        explodeDir: new THREE.Vector3(0, 0, -1) }
    );

    // ---- FRONT WING ====
    // Main plane
    const fwMain = mkMesh(
      new THREE.BoxGeometry(1.8, 0.03, 0.45, 8, 1, 4),
      { part: 'front_wing', color: holoCyan, opacity: 0.85,
        pos: new THREE.Vector3(0, -0.02, -2.6), explodeDir: new THREE.Vector3(0, -0.5, -1) }
    );
    // Front wing flap 1
    mkMesh(new THREE.BoxGeometry(1.7, 0.02, 0.22, 6, 1, 3),
      { part: 'front_wing', color: holoBlue, opacity: 0.8,
        pos: new THREE.Vector3(0, 0.04, -2.48), explodeDir: new THREE.Vector3(0, -0.5, -1.2) });
    // Front wing flap 2
    mkMesh(new THREE.BoxGeometry(1.6, 0.02, 0.18, 6, 1, 3),
      { part: 'front_wing', color: holoCyan, opacity: 0.75,
        pos: new THREE.Vector3(0, 0.08, -2.36), explodeDir: new THREE.Vector3(0, -0.5, -1.4) });
    // Endplates
    [-0.88, 0.88].forEach(x => {
      mkMesh(new THREE.BoxGeometry(0.04, 0.18, 0.52, 1, 3, 4),
        { part: 'front_wing', color: holoBlue, opacity: 0.85,
          pos: new THREE.Vector3(x, 0.04, -2.56), explodeDir: new THREE.Vector3(x > 0 ? 0.5 : -0.5, -0.3, -0.8) });
    });

    // ---- REAR WING ----
    mkMesh(new THREE.BoxGeometry(1.35, 0.03, 0.55, 6, 1, 4),
      { part: 'rear_wing', color: holoCyan, opacity: 0.85,
        pos: new THREE.Vector3(0, 0.85, 1.65), explodeDir: new THREE.Vector3(0, 1, 1) });
    mkMesh(new THREE.BoxGeometry(1.2, 0.02, 0.28, 5, 1, 3),
      { part: 'rear_wing', color: holoBlue, opacity: 0.8,
        pos: new THREE.Vector3(0, 0.92, 1.56), explodeDir: new THREE.Vector3(0, 1.2, 1.2) });
    // DRS flap
    mkMesh(new THREE.BoxGeometry(1.1, 0.018, 0.22, 4, 1, 2),
      { part: 'rear_wing', color: 0x00ccff, opacity: 0.78,
        pos: new THREE.Vector3(0, 0.98, 1.46), explodeDir: new THREE.Vector3(0, 1.4, 1.4) });
    // Rear wing pylons
    [-0.3, 0.3].forEach(x => {
      mkMesh(new THREE.BoxGeometry(0.05, 0.55, 0.08, 1, 4, 1),
        { part: 'rear_wing', color: holoCyan, opacity: 0.7,
          pos: new THREE.Vector3(x, 0.55, 1.65), explodeDir: new THREE.Vector3(0, 0.5, 0.8) });
    });
    // Rear endplates
    [-0.66, 0.66].forEach(x => {
      mkMesh(new THREE.BoxGeometry(0.04, 0.42, 0.65, 1, 4, 4),
        { part: 'rear_wing', color: holoBlue, opacity: 0.85,
          pos: new THREE.Vector3(x, 0.72, 1.62), explodeDir: new THREE.Vector3(x > 0 ? 0.6 : -0.6, 0.5, 0.8) });
    });

    // ---- SIDEPODS ----
    [-0.36, 0.36].forEach((x, i) => {
      const dir = x < 0 ? -1 : 1;
      // Main sidepod body
      const spGeo = new THREE.BoxGeometry(0.32, 0.26, 1.45, 4, 3, 8);
      mkMesh(spGeo, { part: 'sidepod', color: holoCyan, opacity: 0.75,
        pos: new THREE.Vector3(x, 0.15, 0.28), explodeDir: new THREE.Vector3(dir * 0.8, 0, 0) });
      // Air intake
      mkMesh(new THREE.CylinderGeometry(0.1, 0.13, 0.06, 8, 1, false, 0, Math.PI),
        { part: 'sidepod', color: 0x003366, opacity: 0.9,
          pos: new THREE.Vector3(x, 0.22, -0.25), rot: [0, dir > 0 ? -Math.PI/2 : Math.PI/2, 0],
          explodeDir: new THREE.Vector3(dir * 1.2, 0.3, -0.5) });
      // Floor/undercut
      mkMesh(new THREE.BoxGeometry(0.22, 0.04, 1.2, 4, 1, 6),
        { part: 'sidepod', color: holoBlue, opacity: 0.65,
          pos: new THREE.Vector3(x, 0.02, 0.3), explodeDir: new THREE.Vector3(dir * 0.6, -0.4, 0) });
    });

    // ---- FLOOR & DIFFUSER ----
    mkMesh(new THREE.BoxGeometry(1.2, 0.025, 3.0, 6, 1, 12),
      { part: 'floor', color: 0x0055cc, opacity: 0.55,
        pos: new THREE.Vector3(0, -0.01, 0.1), explodeDir: new THREE.Vector3(0, -0.8, 0) });
    // Diffuser
    const diffGeo = new THREE.BoxGeometry(1.0, 0.15, 0.65, 6, 3, 4);
    const diff = mkMesh(diffGeo, { part: 'diffuser', color: holoCyan, opacity: 0.7,
      pos: new THREE.Vector3(0, 0.06, 1.65), explodeDir: new THREE.Vector3(0, -0.5, 1.2) });

    // ---- ENGINE COVER / AIRBOX ----
    mkMesh(new THREE.CylinderGeometry(0.16, 0.13, 0.55, 8),
      { part: 'engine', color: 0xff3300, opacity: 0.75,
        pos: new THREE.Vector3(0, 0.54, 0.55), explodeDir: new THREE.Vector3(0, 1, 0) });
    // Engine cover bodywork
    mkMesh(new THREE.BoxGeometry(0.38, 0.22, 1.1, 4, 3, 6),
      { part: 'engine', color: holoCyan, opacity: 0.65,
        pos: new THREE.Vector3(0, 0.38, 0.55), explodeDir: new THREE.Vector3(0, 0.8, 0) });

    // ---- WHEELS (4) ----
    const wheelPositions = [
      { x: -0.82, y: -0.02, z: -1.78, front: true },
      { x:  0.82, y: -0.02, z: -1.78, front: true },
      { x: -0.92, y: -0.02, z:  1.62, front: false },
      { x:  0.92, y: -0.02, z:  1.62, front: false },
    ];
    this.wheels = [];
    wheelPositions.forEach((wp, wi) => {
      const dir = wp.x < 0 ? -1 : 1;
      const explDir = new THREE.Vector3(dir * 1.5, -0.5, wp.front ? -0.5 : 0.5);
      // Tire
      const tire = mkMesh(
        new THREE.TorusGeometry(0.33, 0.14, 16, 32),
        { part: 'wheel', color: 0x002266, opacity: 0.85,
          pos: new THREE.Vector3(wp.x, wp.y, wp.z), rot: [0, 0, Math.PI / 2],
          explodeDir: explDir }
      );
      tire.userData.wheelIdx = wi;
      // Rim
      const rim = mkMesh(
        new THREE.CylinderGeometry(0.26, 0.26, 0.2, 16, 1),
        { part: 'rim', color: holoCyan, opacity: 0.9,
          pos: new THREE.Vector3(wp.x, wp.y, wp.z), rot: [0, 0, Math.PI / 2],
          explodeDir: explDir }
      );
      rim.userData.wheelIdx = wi;
      // Brake disc (internal)
      mkMesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12, 1),
        { part: 'brakes', color: holoRed, opacity: 0.65,
          pos: new THREE.Vector3(wp.x, wp.y, wp.z), rot: [0, 0, Math.PI / 2],
          explodeDir: explDir });
      // Wheel suspension arm
      const armLen = Math.abs(wp.x) - 0.32;
      mkMesh(new THREE.BoxGeometry(armLen, 0.04, 0.04, 3, 1, 1),
        { part: 'suspension', color: holoBlue, opacity: 0.75,
          pos: new THREE.Vector3(wp.x / 2, wp.y, wp.z), explodeDir: new THREE.Vector3(dir * 0.5, 0, 0) });
      this.wheels.push({ tire, rim });
    });

    // ---- HALO ----
    const haloPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.22, 0, -0.4),
      new THREE.Vector3(-0.28, 0.28, 0),
      new THREE.Vector3(0, 0.38, 0.35),
      new THREE.Vector3(0.28, 0.28, 0),
      new THREE.Vector3(0.22, 0, -0.4),
    ]);
    mkMesh(new THREE.TubeGeometry(haloPath, 30, 0.025, 8, false),
      { part: 'halo', color: 0xffffaa, opacity: 0.85,
        pos: new THREE.Vector3(0, 0.26, 0.12), explodeDir: new THREE.Vector3(0, 1.5, 0) });

    // ---- FRONT SUSPENSION ----
    [[-0.3, -1.68], [0.3, -1.68]].forEach(([x, z]) => {
      mkMesh(new THREE.BoxGeometry(0.5, 0.035, 0.035, 4, 1, 1),
        { part: 'suspension', color: holoBlue, opacity: 0.7,
          pos: new THREE.Vector3(x, 0.1, z), explodeDir: new THREE.Vector3(x > 0 ? 0.3 : -0.3, 0, -0.5) });
      mkMesh(new THREE.BoxGeometry(0.5, 0.035, 0.035, 4, 1, 1),
        { part: 'suspension', color: holoBlue, opacity: 0.7,
          pos: new THREE.Vector3(x, -0.04, z), explodeDir: new THREE.Vector3(x > 0 ? 0.3 : -0.3, 0, -0.5) });
    });

    // ---- EXHAUST ----
    mkMesh(new THREE.CylinderGeometry(0.055, 0.07, 0.4, 8, 1, true),
      { part: 'engine', color: 0xff5500, opacity: 0.7,
        pos: new THREE.Vector3(0.18, 0.28, 1.72), rot: [Math.PI / 2, 0, 0.15],
        explodeDir: new THREE.Vector3(0.3, 0, 1) });

    // Center the whole car
    this.carGroup.position.set(0, 0, 0);
    this.carGroup.rotation.y = 0.3;

    // Wireframe overlays for all parts
    this._rebuildWireframes();
  }

  _rebuildWireframes() {
    // Remove old wireframes
    this.wireframeMeshes = this.wireframeMeshes || [];
    this.wireframeMeshes.forEach(m => this.scene.remove(m));
    this.wireframeMeshes = [];

    this.allMeshes.forEach(mesh => {
      const wfMat = new THREE.MeshBasicMaterial({
        color: 0x00f5ff, wireframe: true, transparent: true, opacity: 0.15
      });
      const wf = new THREE.Mesh(mesh.geometry, wfMat);
      wf.position.copy(mesh.position);
      wf.rotation.copy(mesh.rotation);
      wf.scale.copy(mesh.scale);
      this.carGroup.add(wf);
      this.wireframeMeshes.push({ wf, mesh });
    });
  }

  // ==================== ENVIRONMENT ====================
  _buildEnvironment() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x001133, 0.8);
    this.scene.add(ambient);

    // Rim lights (holographic blue)
    const rimL = new THREE.DirectionalLight(0x00ccff, 3.5);
    rimL.position.set(-5, 3, -2);
    this.scene.add(rimL);
    const rimR = new THREE.DirectionalLight(0x0044ff, 2.5);
    rimR.position.set(5, 2, 2);
    this.scene.add(rimR);
    const rimTop = new THREE.PointLight(0x00f5ff, 2, 20);
    rimTop.position.set(0, 6, 0);
    this.scene.add(rimTop);

    // Ground light
    this.groundLight = new THREE.PointLight(0x00f5ff, 1.5, 8);
    this.groundLight.position.set(0, -1.5, 0);
    this.scene.add(this.groundLight);

    // Grid floor
    const gridGeo = new THREE.PlaneGeometry(30, 30, 40, 40);
    const gridMat = new THREE.ShaderMaterial({
      vertexShader: HologramShaders.grid.vertexShader,
      fragmentShader: HologramShaders.grid.fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x00f5ff) }
      },
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    this.gridFloor = new THREE.Mesh(gridGeo, gridMat);
    this.gridFloor.rotation.x = -Math.PI / 2;
    this.gridFloor.position.y = -0.5;
    this.scene.add(this.gridFloor);

    // Holographic ring circles
    this.rings = [];
    [1.8, 3.0, 4.5].forEach((r, i) => {
      const ringGeo = new THREE.RingGeometry(r - 0.02, r, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f5ff, transparent: true, opacity: 0.12 - i * 0.03, side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.49;
      ring.userData.baseRadius = r;
      ring.userData.phase = i * 0.7;
      this.scene.add(ring);
      this.rings.push(ring);
    });

    // Vertical glow column
    const colGeo = new THREE.CylinderGeometry(0.02, 0.02, 6, 8, 1, true);
    const colMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.07 });
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.y = 2.5;
    this.scene.add(col);
  }

  _buildParticles() {
    const N = 150;
    const pos = new Float32Array(N * 3);
    const sizes = new Float32Array(N);
    const phases = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = 1.8 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      pos[i * 3]     = r * Math.cos(theta) * Math.cos(phi);
      pos[i * 3 + 1] = r * Math.sin(phi) + 0.5;
      pos[i * 3 + 2] = r * Math.sin(theta) * Math.cos(phi);
      sizes[i] = Math.random() * 3 + 1;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.particleMat = new THREE.ShaderMaterial({
      vertexShader: HologramShaders.particle.vertexShader,
      fragmentShader: HologramShaders.particle.fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x00f5ff) }
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.particles = new THREE.Points(geo, this.particleMat);
    this.scene.add(this.particles);
  }

  // ==================== RENDER MODES ====================
  setMode(mode) {
    this.mode = mode;
    this.allMeshes.forEach(mesh => {
      const mat = mesh.material;
      const bc = mesh.userData.baseColor;
      const bo = mesh.userData.baseOpacity;
      switch (mode) {
        case 'hologram':
          mat.wireframe = false;
          mat.color.set(bc);
          mat.emissive.set(new THREE.Color(bc).multiplyScalar(0.35));
          mat.opacity = bo;
          mat.transparent = true;
          break;
        case 'xray':
          mat.wireframe = false;
          mat.color.set(0x00ffcc);
          mat.emissive.set(new THREE.Color(0x00ffcc).multiplyScalar(0.5));
          mat.opacity = 0.4;
          mat.transparent = true;
          break;
        case 'wireframe':
          mat.wireframe = true;
          mat.color.set(0x00f5ff);
          mat.emissive.set(new THREE.Color(0x00f5ff).multiplyScalar(0.5));
          mat.opacity = 0.85;
          mat.transparent = true;
          break;
        case 'solid':
          mat.wireframe = false;
          mat.color.set(0x111133);
          mat.emissive.set(0x002244);
          mat.opacity = 1.0;
          mat.transparent = false;
          break;
      }
    });
    // Toggle wireframe overlays
    this.wireframeMeshes.forEach(({ wf }) => {
      wf.visible = (mode === 'hologram' || mode === 'xray');
      wf.material.opacity = mode === 'xray' ? 0.35 : 0.12;
    });
  }

  // ==================== CONTROLS ====================
  applyRotation(dx, dy) {
    this.targetRotation.y += dx * 0.012;
    this.targetRotation.x += dy * 0.008;
    this.targetRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.targetRotation.x));
    this.autoRotate = false;
  }

  applyZoom(delta) {
    this.targetScale = Math.max(0.4, Math.min(3.0, this.targetScale + delta));
  }

  reset() {
    this.targetRotation = { x: -0.15, y: 0.3, z: 0 };
    this.targetScale = 1.0;
    this.autoRotate = true;
    this.targetExplode = 0;
  }

  toggleExplode() {
    this.targetExplode = this.targetExplode > 0 ? 0 : 1;
  }

  // ==================== ANIMATE ====================
  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = this.clock.getDelta();
    this.time += dt;

    // Auto-rotate
    if (this.autoRotate) {
      this.targetRotation.y += dt * 0.25;
    }

    // Smooth rotation lerp
    this.rotation.x += (this.targetRotation.x - this.rotation.x) * 8 * dt;
    this.rotation.y += (this.targetRotation.y - this.rotation.y) * 8 * dt;

    // Smooth scale lerp
    const s = this.targetScale;
    this.scale += (s - this.scale) * 8 * dt;

    this.carGroup.rotation.x = this.rotation.x;
    this.carGroup.rotation.y = this.rotation.y;
    this.carGroup.scale.setScalar(this.scale);

    // Hover animation
    this.carGroup.position.y = Math.sin(this.time * 0.7) * 0.04;

    // Explode animation
    this.explodeAmount += (this.targetExplode - this.explodeAmount) * 4 * dt;
    this.allMeshes.forEach(mesh => {
      const dir = mesh.userData.explodeDir;
      const base = mesh.userData.basePos;
      mesh.position.x = base.x + dir.x * this.explodeAmount * 0.4;
      mesh.position.y = base.y + dir.y * this.explodeAmount * 0.4;
      mesh.position.z = base.z + dir.z * this.explodeAmount * 0.4;
    });
    // Sync wireframes
    this.wireframeMeshes.forEach(({ wf, mesh }) => {
      wf.position.copy(mesh.position);
    });

    // Wheel spin
    if (this.wheels) {
      this.wheels.forEach(({ tire, rim }) => {
        tire.rotation.x += dt * 2.5;
        rim.rotation.x += dt * 2.5;
      });
    }

    // Scan ring pulse
    this.scanProgress = (this.scanProgress + dt * 0.15) % 1;
    const sp = this.scanProgress;

    // Holographic material pulse
    if (this.mode === 'hologram') {
      const pulse = Math.sin(this.time * 2) * 0.05;
      this.allMeshes.forEach(m => {
        if (!m.material.wireframe) {
          m.material.opacity = m.userData.baseOpacity + pulse;
        }
      });
    }

    // Grid + particles
    if (this.gridFloor) this.gridFloor.material.uniforms.uTime.value = this.time;
    if (this.particleMat) this.particleMat.uniforms.uTime.value = this.time;

    // Rings pulse
    this.rings.forEach(ring => {
      const t = this.time * 0.5 + ring.userData.phase;
      ring.material.opacity = 0.06 + Math.sin(t) * 0.04;
      ring.rotation.z = this.time * 0.05;
    });

    // Ground light pulse
    if (this.groundLight) {
      this.groundLight.intensity = 1.2 + Math.sin(this.time * 1.5) * 0.4;
    }

    this.renderer.render(this.scene, this.camera);
    return sp;
  }

  getScanProgress() { return this.scanProgress; }
}
