// ===== MEDIAPIPE HAND TRACKING + GESTURE RECOGNITION =====
'use strict';

class HandTracker {
  constructor(videoEl, canvasEl) {
    this.videoEl = videoEl;
    this.canvasEl = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.results = null;
    this.hands = null;
    this.camera = null;
    this.onGesture = null;  // callback
    this.onHandData = null; // callback
    this.lastGesture = '';
    this.gestureHoldFrames = 0;
    this.GESTURE_HOLD = 2;  // fewer frames = faster gesture response
    this.prevHandCenter = null;
    this.prevPinchDist = null;
    this._pinching = false; // hysteresis state for pinch
    this.frameCount = 0;
    this.fpsArr = [];
    this.lastFrameTime = performance.now();
    this.ready = false;
  }

  async init() {
    // Resize canvas to match video
    const resizeCanvas = () => {
      this.canvasEl.width = this.canvasEl.offsetWidth;
      this.canvasEl.height = this.canvasEl.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    this.hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 1,          // only track 1 hand — more CPU budget = better accuracy
      modelComplexity: 1,      // full model for reliable landmark positions
      minDetectionConfidence: 0.75,
      minTrackingConfidence: 0.75,
    });

    this.hands.onResults((results) => this._onResults(results));

    this.camera = new Camera(this.videoEl, {
      onFrame: async () => {
        await this.hands.send({ image: this.videoEl });
      },
      width: 640, height: 480
    });

    await this.camera.start();
    this.ready = true;
    return true;
  }

  _onResults(results) {
    this.results = results;
    const now = performance.now();
    const fps = 1000 / (now - this.lastFrameTime);
    this.fpsArr.push(fps);
    if (this.fpsArr.length > 30) this.fpsArr.shift();
    this.lastFrameTime = now;

    this._drawCameraCanvas(results);

    const handCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
    const avgFps = Math.round(this.fpsArr.reduce((a, b) => a + b, 0) / this.fpsArr.length);

    if (handCount === 0) {
      this.prevHandCenter = null;
      this.prevPinchDist = null;
      if (this.onHandData) this.onHandData({ handCount: 0, gesture: 'NONE', fps: avgFps, confidence: 0 });
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const gesture = this._classifyGesture(landmarks, results);
    const confidence = results.multiHandedness?.[0]?.score ?? 0;

    // Gesture hold debounce
    if (gesture === this.lastGesture) {
      this.gestureHoldFrames++;
    } else {
      this.gestureHoldFrames = 0;
      this.lastGesture = gesture;
    }

    const confirmedGesture = this.gestureHoldFrames >= this.GESTURE_HOLD ? gesture : this.lastGesture;

    // Hand deltas
    const center = this._handCenter(landmarks);
    let dx = 0, dy = 0;
    if (this.prevHandCenter) {
      dx = center.x - this.prevHandCenter.x;
      dy = center.y - this.prevHandCenter.y;
    }
    this.prevHandCenter = center;

    // Pinch distance
    let pinchDelta = 0;
    const pinchDist = this._pinchDistance(landmarks);
    if (this.prevPinchDist !== null) {
      pinchDelta = pinchDist - this.prevPinchDist;
    }
    this.prevPinchDist = pinchDist;

    // Two-hand scale
    let twoHandDelta = 0;
    if (results.multiHandLandmarks.length >= 2) {
      const c1 = this._handCenter(results.multiHandLandmarks[0]);
      const c2 = this._handCenter(results.multiHandLandmarks[1]);
      const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
      if (this._prevTwoHandDist !== undefined) {
        twoHandDelta = dist - this._prevTwoHandDist;
      }
      this._prevTwoHandDist = dist;
    } else {
      this._prevTwoHandDist = undefined;
    }

    if (this.onHandData) {
      this.onHandData({
        handCount,
        gesture: confirmedGesture,
        fps: avgFps,
        confidence: Math.round(confidence * 100),
        dx, dy,
        pinchDist, pinchDelta,
        twoHandDelta,
        landmarks,
        center
      });
    }
    if (this.onGesture && this.gestureHoldFrames === this.GESTURE_HOLD) {
      this.onGesture(confirmedGesture);
    }
  }

  _drawCameraCanvas(results) {
    const w = this.canvasEl.width;
    const h = this.canvasEl.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // Draw mirrored camera feed
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(this.videoEl, -w, 0, w, h);
    ctx.restore();

    // Overlay tint
    ctx.fillStyle = 'rgba(0, 10, 30, 0.35)';
    ctx.fillRect(0, 0, w, h);

    // Scan line across camera
    const scanY = (Date.now() % 2000) / 2000 * h;
    const grad = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
    grad.addColorStop(0, 'rgba(0,245,255,0)');
    grad.addColorStop(0.5, 'rgba(0,245,255,0.5)');
    grad.addColorStop(1, 'rgba(0,245,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 8, w, 16);

    if (!results.multiHandLandmarks) return;

    results.multiHandLandmarks.forEach((landmarks, hi) => {
      const handColor = hi === 0 ? '#00f5ff' : '#ff6b00';

      // Draw connections
      const connections = [
        [0,1],[1,2],[2,3],[3,4],   // thumb
        [0,5],[5,6],[6,7],[7,8],   // index
        [0,9],[9,10],[10,11],[11,12], // middle
        [0,13],[13,14],[14,15],[15,16], // ring
        [0,17],[17,18],[18,19],[19,20], // pinky
        [5,9],[9,13],[13,17]        // palm
      ];

      ctx.strokeStyle = handColor;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = handColor;
      ctx.globalAlpha = 0.8;

      connections.forEach(([a, b]) => {
        const pa = this._lm2canvas(landmarks[a], w, h);
        const pb = this._lm2canvas(landmarks[b], w, h);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      });

      // Draw joints
      landmarks.forEach((lm, i) => {
        const p = this._lm2canvas(lm, w, h);
        const size = [0, 4, 8, 12, 16, 20].includes(i) ? 5 : 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = handColor;
        ctx.shadowBlur = 12;
        ctx.shadowColor = handColor;
        ctx.fill();
      });

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    });
  }

  _lm2canvas(lm, w, h) {
    // Mirror X for canvas display
    return { x: (1 - lm.x) * w, y: lm.y * h };
  }

  _handCenter(landmarks) {
    let x = 0, y = 0;
    landmarks.forEach(lm => { x += lm.x; y += lm.y; });
    return { x: x / landmarks.length, y: y / landmarks.length };
  }

  _pinchDistance(landmarks) {
    const thumb = landmarks[4];
    const index = landmarks[8];
    return Math.hypot(thumb.x - index.x, thumb.y - index.y);
  }

  _fingerExtended(landmarks, finger) {
    // tip, pip, mcp indices per finger
    const tips = { thumb: [4,3,2], index: [8,6,5], middle: [12,10,9], ring: [16,14,13], pinky: [20,18,17] };
    const [tip, pip, mcp] = tips[finger];
    if (finger === 'thumb') {
      // Thumb: check x distance from palm
      return Math.abs(landmarks[tip].x - landmarks[mcp].x) > 0.06;
    }
    // Others: tip y < pip y (raised)
    return landmarks[tip].y < landmarks[pip].y;
  }

  _classifyGesture(landmarks, results) {
    const thumb  = this._fingerExtended(landmarks, 'thumb');
    const index  = this._fingerExtended(landmarks, 'index');
    const middle = this._fingerExtended(landmarks, 'middle');
    const ring   = this._fingerExtended(landmarks, 'ring');
    const pinky  = this._fingerExtended(landmarks, 'pinky');

    const extended = [thumb, index, middle, ring, pinky];
    const count = extended.filter(Boolean).length;

    // Pinch — use hysteresis: enter at <0.05, exit at >0.08
    // This prevents flickering between PINCH and other gestures
    const pinchDist = this._pinchDistance(landmarks);
    if (!this._pinching && pinchDist < 0.05 && !middle && !ring && !pinky) {
      this._pinching = true;
    } else if (this._pinching && pinchDist > 0.08) {
      this._pinching = false;
    }
    if (this._pinching) return 'PINCH';

    // Fist
    if (count === 0 || count === 1) return 'FIST';

    // Open palm
    if (count === 5) return 'OPEN_PALM';
    
    // L-SIGN (Thumb and Index)
    if (thumb && index && !middle && !ring && !pinky) return 'L_SIGN';

    // Point
    if (index && !middle && !ring && !pinky) return 'POINT';

    // Peace / V
    if (index && middle && !ring && !pinky) return 'PEACE';

    // Three fingers
    if (index && middle && ring && !pinky) return 'THREE';

    // OK
    if (thumb && !index && middle && ring && pinky) return 'OK';

    return 'ROTATE';
  }

  destroy() {
    if (this.camera) this.camera.stop();
    if (this.hands) this.hands.close();
  }
}
