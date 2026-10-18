// ===== BACKGROUND THREE.JS SCENE — Light Theme =====
'use strict';

class BgScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.time = 0;
    this.clock = new THREE.Clock();
    this._init();
    this._buildGrid();
    this._buildParticles();
    this._animate();
  }

  _init() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x1e2125, 1); // Charcoal grey background

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x1e2125, 8, 45);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 5, 12);
    this.camera.lookAt(0, 0, 0);

    // Add lights for 3D models added to this scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(10, 15, 10);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00c8ff, 0.7);
    dirLight2.position.set(-10, 5, -10);
    this.scene.add(dirLight2);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _buildGrid() {
    // Highly performant native GridHelper
    this.grid = new THREE.GridHelper(50, 60, 0x00c8ff, 0x2d3540);
    this.grid.position.y = -1.8;
    this.grid.material.opacity = 0.35;
    this.grid.material.transparent = true;
    this.scene.add(this.grid);
  }

  _buildParticles() {
    // Simple basic points material for max FPS
    const N = 100;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 30;
      pos[i*3+1] = Math.random() * 20 - 5;
      pos[i*3+2] = (Math.random() - 0.5) * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x00c8ff,
      size: 0.12,
      transparent: true,
      opacity: 0.45
    });

    this.particles = new THREE.Points(geo, mat);
    this.scene.add(this.particles);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = this.clock.getDelta();
    this.time += dt;

    if (this.particles) {
      this.particles.rotation.y = this.time * 0.05;
      this.particles.position.y = Math.sin(this.time * 0.5) * 0.5;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

