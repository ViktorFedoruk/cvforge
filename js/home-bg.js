// /js/home-bg.js
import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

let renderer, scene, camera, mesh;
let startTime = performance.now();

function init() {
  const canvas = document.getElementById("bgCanvas");

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(camera);

  const geometry = new THREE.PlaneGeometry(2, 2);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },

      // фирменная палитра уровней навыков
      uColor1: { value: new THREE.Color("#6366f1") },
      uColor2: { value: new THREE.Color("#3b82f6") },
      uColor3: { value: new THREE.Color("#94a3b8") },
    },

    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,

    fragmentShader: `
      precision highp float;

      varying vec2 vUv;
      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;

      // простая функция шума
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      // сетка
      float grid(vec2 uv, float scale) {
        uv *= scale;
        vec2 g = abs(fract(uv - 0.5) - 0.5) / fwidth(uv);
        float line = min(g.x, g.y);
        return 1.0 - smoothstep(0.0, 1.0, line);
      }


      void main() {
        vec2 uv = vUv;
        float t = uTime * 0.0001;

        // базовый фон — чистый, нейтральный
        vec3 col = vec3(0.96, 0.97, 1.0);

        // мягкая сетка
        float g = grid(uv + vec2(t * 0.2, t * 0.1), 20.0);
        col = mix(col, vec3(0.90, 0.93, 1.0), g * 0.12);

        // акцентная сетка (цветная)
        float g2 = grid(uv + vec2(-t * 0.15, t * 0.05), 35.0);
        vec3 gridColor = mix(uColor1, uColor2, 0.5);
        col = mix(col, gridColor, g2 * 0.08);

        // лёгкая виньетка
        float vignette = smoothstep(1.2, 0.3, length(uv - 0.5));
        col *= mix(1.0, 0.92, vignette);

        gl_FragColor = vec4(col, 1.0);
      }
    `,

    depthWrite: false,
    depthTest: false
  });

  mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  onResize();
  window.addEventListener("resize", onResize);

  animate();
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  renderer.setSize(w, h);

  if (mesh.material.uniforms.uResolution) {
    mesh.material.uniforms.uResolution.value.set(w, h);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const elapsed = now - startTime;

  mesh.material.uniforms.uTime.value = elapsed;

  renderer.render(scene, camera);
}

init();
