// ===== HUD OVERLAY — TELEMETRY + IRON MAN UI =====
'use strict';

class HUD {
  constructor() {
    this.timeEl = document.getElementById('hud-time');
    this.statusDot = document.getElementById('status-tracking');
    this.statusLabel = document.getElementById('status-label');
    this.handCount = document.getElementById('hand-count');
    this.currentGesture = document.getElementById('current-gesture');
    this.handConf = document.getElementById('hand-conf');
    this.fpsCounter = document.getElementById('fps-counter');
    this.latency = document.getElementById('latency');
    this.scanFill = document.getElementById('scan-fill');
    this.scanPct = document.getElementById('scan-pct');
    this.coordsEl = document.getElementById('coords');
    this.gi = document.getElementById('gesture-indicator');
    this.giIcon = document.getElementById('gi-icon');
    this.giLabel = document.getElementById('gi-label');
    this.alertToast = document.getElementById('alert-toast');
    this.alertTimer = null;
    this.gestureHideTimer = null;

    this.GESTURES = {
      'OPEN_PALM': { icon: '🖐', label: 'OPEN PALM — ROTATING MODEL' },
      'FIST':      { icon: '✊', label: 'FIST — RESET VIEW' },
      'PINCH':     { icon: '🤏', label: 'PINCH — ZOOM & PAN' },
      'L_SIGN':    { icon: '🤙', label: 'L-SIGN — AUTO ROTATING' },
      'PEACE':     { icon: '✌', label: 'PEACE — X-RAY VIEW' },
      'THREE':     { icon: '🤟', label: 'THREE — WIREFRAME' },
      'OK':        { icon: '👌', label: 'OK — SOLID MODE' },
      'ROTATE':    { icon: '🔄', label: 'DETECTING...' },
      'NONE':      { icon: '👻', label: 'NO HAND DETECTED' },
    };

    this._startClock();
    this._animateScan();
  }

  _startClock() {
    setInterval(() => {
      const d = new Date();
      const t = d.toTimeString().slice(0, 8);
      if (this.timeEl) this.timeEl.textContent = t;
    }, 1000);
  }

  _animateScan() {
    // Scan fills continuously
    let pct = 0;
    setInterval(() => {
      pct = (pct + 0.5) % 101;
      const offset = 264 - (264 * pct / 100);
      if (this.scanFill) this.scanFill.style.strokeDashoffset = offset;
      if (this.scanPct) this.scanPct.textContent = Math.round(pct) + '%';
    }, 60);
  }

  setStatus(active) {
    if (this.statusDot) {
      this.statusDot.classList.toggle('active', active);
    }
    if (this.statusLabel) {
      this.statusLabel.textContent = active ? 'TRACKING ACTIVE' : 'SEARCHING...';
    }
  }

  update(data) {
    const { handCount, gesture, fps, confidence, dx, dy } = data;

    if (this.handCount) {
      this.handCount.textContent = handCount + (handCount === 1 ? ' HAND' : ' HANDS');
    }
    if (this.currentGesture) {
      this.currentGesture.textContent = gesture || 'NONE';
    }
    if (this.handConf) {
      this.handConf.textContent = confidence ? confidence + '%' : '--';
    }
    if (this.fpsCounter) {
      this.fpsCounter.textContent = fps || '--';
      this.fpsCounter.style.color = fps > 45 ? '#00ff80' : fps > 25 ? '#ffaa00' : '#ff2020';
    }

    this.setStatus(handCount > 0);

    // Gesture indicator
    if (gesture && gesture !== 'NONE' && handCount > 0) {
      const g = this.GESTURES[gesture] || { icon: '?', label: gesture };
      if (this.giIcon) this.giIcon.textContent = g.icon;
      if (this.giLabel) this.giLabel.textContent = g.label;
      this.gi.classList.add('visible');

      clearTimeout(this.gestureHideTimer);
      this.gestureHideTimer = setTimeout(() => {
        this.gi.classList.remove('visible');
      }, 2000);
    }

    // Coords
    if (this.coordsEl && dx !== undefined) {
      this.coordsEl.textContent = `X: ${(dx * 100).toFixed(2)} Y: ${(dy * 100).toFixed(2)} Z: 0.00`;
    }
  }

  updateFps(fps) {
    if (this.fpsCounter) {
      this.fpsCounter.textContent = fps;
      this.fpsCounter.style.color = fps > 45 ? '#00ff80' : fps > 25 ? '#ffaa00' : '#ff2020';
    }
  }

  updateLatency(ms) {
    if (this.latency) {
      this.latency.textContent = ms + 'ms';
      this.latency.style.color = ms < 20 ? '#00ff80' : ms < 50 ? '#ffaa00' : '#ff2020';
    }
  }

  toast(msg, duration = 2500) {
    if (this.alertToast) {
      this.alertToast.textContent = msg;
      this.alertToast.classList.add('visible');
      clearTimeout(this.alertTimer);
      this.alertTimer = setTimeout(() => {
        this.alertToast.classList.remove('visible');
      }, duration);
    }
  }

  setActiveMode(mode) {
    ['hologram', 'xray', 'wireframe', 'solid'].forEach(m => {
      const btn = document.getElementById('btn-' + m);
      if (btn) btn.classList.toggle('active', m === mode);
    });
  }
}
