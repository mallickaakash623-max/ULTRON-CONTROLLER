// ===== GLSL SHADERS FOR HOLOGRAPHIC EFFECTS =====

const HologramShaders = {

  // --- Hologram material shader ---
  hologram: {
    vertexShader: `
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vec3 pos = position;
        // Subtle vertex displacement for holographic shimmer
        pos.x += sin(pos.y * 10.0 + uTime * 3.0) * 0.002;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform float uGlitchStrength;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUv;

      float scanline(float y, float speed, float width) {
        return step(width, mod(y * 50.0 + uTime * speed, 1.0));
      }

      void main() {
        // Fresnel rim glow
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);

        // Scanline effect
        float scan = scanline(vUv.y, 2.0, 0.85);

        // Moving glow band
        float band = smoothstep(0.0, 0.05, abs(mod(vUv.y - uTime * 0.3, 1.0) - 0.5) - 0.45);

        // Glitch offset
        float glitch = step(0.98, sin(uTime * 20.0 + vUv.y * 100.0)) * uGlitchStrength;
        float r = texture2D(map, vUv + vec2(glitch * 0.01, 0.0)).r;

        // Compose
        float alpha = (fresnel * 0.8 + 0.2) * scan * uOpacity;
        alpha += (1.0 - band) * 0.15;

        vec3 col = uColor;
        col += vec3(fresnel * 0.4);
        col = mix(col, vec3(1.0), glitch * 0.3);

        gl_FragColor = vec4(col, alpha);
      }
    `
  },

  // --- X-Ray shader ---
  xray: {
    vertexShader: `
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main() {
        vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec2 vUv;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float fresnel = 1.0 - abs(dot(normalize(vNormal), viewDir));
        fresnel = pow(fresnel, 2.5);

        // Bone-like internal structure
        float stripe = abs(sin(vPosition.y * 8.0 + uTime * 0.5)) * 0.3;
        float density = fresnel + stripe * (1.0 - fresnel);

        vec3 cold = vec3(0.0, 0.3, 0.7);
        vec3 hot  = vec3(0.0, 1.0, 0.8);
        vec3 col  = mix(cold, hot, fresnel);
        col = mix(col, uColor, 0.3);

        float alpha = density * uOpacity;
        gl_FragColor = vec4(col, alpha);
      }
    `
  },

  // --- Grid floor shader ---
  grid: {
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;

      float grid(vec2 uv, float size) {
        vec2 g = abs(fract(uv * size - 0.5) - 0.5) / fwidth(uv * size);
        return 1.0 - min(min(g.x, g.y), 1.0);
      }

      void main() {
        // Center-fade grid
        float dist = length(vUv - 0.5) * 2.0;
        float fade = 1.0 - smoothstep(0.3, 1.0, dist);

        float g1 = grid(vUv, 20.0);
        float g2 = grid(vUv, 4.0) * 0.4;

        // Ripple pulse
        float ripple = sin(dist * 20.0 - uTime * 2.0) * 0.5 + 0.5;
        ripple *= smoothstep(0.0, 0.02, 0.01);

        float intensity = (g1 + g2) * fade;
        vec3 col = uColor * intensity;
        col += uColor * ripple * 0.1 * fade;

        gl_FragColor = vec4(col, intensity * 0.7);
      }
    `
  },

  // --- Particle shader ---
  particle: {
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec3 pos = position;
        float t = uTime * 0.5 + aPhase;
        pos.y += sin(t * 1.3) * 0.05;
        pos.x += cos(t * 0.9) * 0.03;
        float pulse = sin(t * 2.0) * 0.5 + 0.5;
        vAlpha = pulse * 0.8;
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = aSize * (300.0 / -mv.z) * (0.5 + pulse * 0.5);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      uniform vec3 uColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d) * vAlpha;
        gl_FragColor = vec4(uColor, a);
      }
    `
  }
};
