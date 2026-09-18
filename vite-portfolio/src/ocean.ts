import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Reflector } from "three/addons/objects/Reflector.js";

export interface OceanController {
  setBlueprint: (value: boolean) => void;
  setPaused: (value: boolean | null) => void;
  dispose: () => void;
}

export function createOcean(
  container: HTMLDivElement,
  onUnavailable: () => void,
): OceanController {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06232d, 0.028);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);
  scene.environment = env.texture;
  room.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0x8fe8ff, 0x062632, 1.8));
  const key = new THREE.DirectionalLight(0xd5edee, 3.2);
  key.position.set(-4, 7, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x39eddb, 65, 16);
  rim.position.set(4, 2, 2);
  scene.add(rim);
  const blue = new THREE.PointLight(0x168cff, 80, 20);
  blue.position.set(0, -1, -4);
  scene.add(blue);

  const shell = new THREE.MeshStandardMaterial({
    color: 0xe6eee8,
    metalness: 0.02,
    roughness: 0.36,
  });
  const safetyOrange = new THREE.MeshStandardMaterial({
    color: 0xf25b25,
    metalness: 0.03,
    roughness: 0.4,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x173c44,
    metalness: 0.3,
    roughness: 0.48,
  });
  const lightMetal = new THREE.MeshStandardMaterial({
    color: 0xc9dedc,
    metalness: 0.8,
    roughness: 0.27,
  });
  const ropeMaterial = new THREE.MeshStandardMaterial({
    color: 0xd0cbb1,
    roughness: 0.86,
  });
  const ropeThread = new THREE.MeshStandardMaterial({
    color: 0xa6a58d,
    roughness: 0.92,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x82ddd9,
    emissive: 0x3ac5c4,
    emissiveIntensity: 0.4,
    metalness: 0.35,
    roughness: 0.28,
  });
  const materials = [
    shell, safetyOrange, dark, lightMetal, ropeMaterial, ropeThread, glow,
  ];
  const model = new THREE.Group();
  scene.add(model);
  const add = (
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Group = model,
  ) => {
    const mesh = new THREE.Mesh(geo, material);
    parent.add(mesh);
    return mesh;
  };

  // A flotation body with an open centre, four safety panels and a grab line.
  // Nothing crosses the hole: the silhouette should read as a lifebuoy at once.
  const body = add(new THREE.TorusGeometry(1.43, 0.395, 28, 120), shell);
  body.scale.z = 0.82;
  const seam = add(new THREE.TorusGeometry(1.822, 0.012, 6, 120), dark);
  seam.position.z = -0.025;
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    const panel = add(
      new THREE.TorusGeometry(1.43, 0.401, 24, 18, 0.58),
      safetyOrange,
    );
    panel.rotation.z = angle - 0.29;
    panel.scale.z = 0.82;
    for (const edge of [-0.21, 0.18]) {
      const tape = add(
        new THREE.TorusGeometry(1.43, 0.406, 20, 3, 0.035),
        shell,
      );
      tape.rotation.z = angle + edge;
      tape.scale.z = 0.82;
    }
    const anchor = add(new THREE.BoxGeometry(0.17, 0.13, 0.13), dark);
    anchor.position.set(Math.cos(angle) * 1.8, Math.sin(angle) * 1.8, 0.02);
    anchor.rotation.z = angle;
    const eye = add(new THREE.TorusGeometry(0.075, 0.016, 6, 16), lightMetal);
    eye.position.set(Math.cos(angle) * 1.91, Math.sin(angle) * 1.91, 0.025);
    const marker = add(new THREE.BoxGeometry(0.08, 0.018, 0.015), glow);
    marker.position.set(Math.cos(angle) * 1.74, Math.sin(angle) * 1.74, 0.2);
    marker.rotation.z = angle;
  }
  const ropePoints: THREE.Vector3[] = [];
  const threadPoints: THREE.Vector3[] = [];
  for (let i = 0; i < 512; i++) {
    const angle = i / 512 * Math.PI * 2;
    const radius = 1.97 + 0.07 * Math.cos(4 * angle);
    ropePoints.push(new THREE.Vector3(
      Math.cos(angle) * radius, Math.sin(angle) * radius, 0.025,
    ));
    const twist = angle * 96;
    threadPoints.push(new THREE.Vector3(
      Math.cos(angle) * (radius + Math.cos(twist) * 0.03),
      Math.sin(angle) * (radius + Math.cos(twist) * 0.03),
      0.025 + Math.sin(twist) * 0.03,
    ));
  }
  add(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(ropePoints, true), 256, 0.036, 7, true,
  ), ropeMaterial);
  add(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(threadPoints, true), 640, 0.007, 4, true,
  ), ropeThread);

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const labelContext = labelCanvas.getContext("2d");
  if (labelContext) {
    labelContext.fillStyle = "#23454b";
    labelContext.font = "700 80px sans-serif";
    labelContext.textAlign = "center";
    labelContext.textBaseline = "middle";
    labelContext.fillText("RESCUE", 256, 64);
  }
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  const labelMaterial = new THREE.MeshBasicMaterial({
    map: labelTexture,
    transparent: true,
    depthWrite: false,
  });
  const label = add(new THREE.PlaneGeometry(0.76, 0.19), labelMaterial);
  label.position.set(0, 1.42, 0.335);
  // Fine orbital lines retain the technical drawing detail around the buoy.
  const orbitMaterial = new THREE.LineBasicMaterial({
    color: 0x63c9d5,
    transparent: true,
    opacity: 0.16,
  });
  const orbitGroup = new THREE.Group();
  model.add(orbitGroup);
  for (let i = 0; i < 2; i++) {
    const pts = Array.from({ length: 145 }, (_, j) => {
      const a = (j / 144) * Math.PI * 2;
      return new THREE.Vector3(
        Math.cos(a) * (2.16 + i * 0.22),
        Math.sin(a) * (2.16 + i * 0.22),
        0,
      );
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      orbitMaterial,
    );
    line.rotation.x = i ? 0.45 : -0.2;
    line.rotation.y = i ? -0.4 : 0.2;
    orbitGroup.add(line);
  }
  // Reflector renders only the scene above the mean water plane into a small
  // target. Its own mesh is hidden during that pass, so water never recurses.
  // This is planar reflection with wave distortion, not ray tracing.
  const water = new Reflector(new THREE.PlaneGeometry(64, 64, 176, 176), {
    textureWidth: 512,
    textureHeight: 512,
    multisample: 0,
    clipBias: 0.004,
    shader: {
      name: "OceanSurface",
      uniforms: {
        tDiffuse: { value: null },
        color: { value: new THREE.Color(0x073f57) },
        textureMatrix: { value: new THREE.Matrix4() },
        uTime: { value: 0 },
        uBlueprint: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform mat4 textureMatrix;
        varying vec3 vWorldPosition;
        varying vec3 vWaveNormal;
        varying vec2 vSurface;
        varying vec4 vReflection;
        varying float vCrest;

        void gerstner(vec2 at, vec2 direction, float wavelength,
          float steepness, float phase, inout vec3 p,
          inout vec3 tangent, inout vec3 binormal) {
          vec2 d = normalize(direction);
          float k = 6.2831853 / wavelength;
          float speed = sqrt(9.81 / k);
          float f = k * (dot(d, at) - speed * uTime * 0.55) + phase;
          float s = sin(f);
          float c = cos(f);
          float amplitude = steepness / k;
          p += vec3(d * amplitude * c, amplitude * s);
          tangent += vec3(-d * d.x * steepness * s, d.x * steepness * c);
          binormal += vec3(-d * d.y * steepness * s, d.y * steepness * c);
        }

        void main() {
          vec3 p = position;
          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 1.0, 0.0);
          gerstner(position.xy, vec2(1.0, 0.35), 8.2, 0.26, 0.2, p, tangent, binormal);
          gerstner(position.xy, vec2(0.75, -0.65), 4.6, 0.2, 2.4, p, tangent, binormal);
          gerstner(position.xy, vec2(-0.3, 1.0), 2.8, 0.13, 1.1, p, tangent, binormal);
          gerstner(position.xy, vec2(0.9, 0.5), 1.65, 0.07, 4.7, p, tangent, binormal);
          gerstner(position.xy, vec2(-0.65, 0.8), 1.05, 0.035, 3.0, p, tangent, binormal);
          vSurface = p.xy;
          vCrest = p.z;
          vWaveNormal = normalize(mat3(modelMatrix) * normalize(cross(tangent, binormal)));
          vec4 world = modelMatrix * vec4(p, 1.0);
          vWorldPosition = world.xyz;
          // Project the actual displaced surface into the mirrored camera.
          vReflection = textureMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uBlueprint;
        varying vec3 vWorldPosition;
        varying vec3 vWaveNormal;
        varying vec2 vSurface;
        varying vec4 vReflection;
        varying float vCrest;

        vec2 ripple(vec2 p, vec2 direction, float frequency,
          float amplitude, float speed, float footprint) {
          vec2 d = normalize(direction);
          float phase = dot(d, p) * frequency + uTime * speed;
          // Fade subpixel ripples instead of sparkling/aliasing at the horizon.
          float filterWidth = frequency * footprint;
          float filtered = exp(-filterWidth * filterWidth * 0.6);
          return d * cos(phase) * amplitude * frequency * filtered;
        }

        vec3 sky(vec3 direction) {
          float up = clamp(direction.y, 0.0, 1.0);
          vec3 horizon = vec3(0.19, 0.37, 0.42);
          vec3 zenith = vec3(0.017, 0.07, 0.115);
          vec3 result = mix(horizon, zenith, pow(up, 0.48));
          float clouds = sin(direction.x * 8.0 + direction.z * 5.0)
            * sin(direction.z * 14.0 - direction.x * 3.0);
          result += vec3(0.055, 0.065, 0.068) * smoothstep(0.12, 0.65, clouds)
            * smoothstep(0.03, 0.3, up);
          return result;
        }

        void main() {
          float distanceToEye = length(cameraPosition - vWorldPosition);
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float footprint = max(length(dFdx(vSurface)), length(dFdy(vSurface)));
          vec2 smallWaves = vec2(0.0);
          smallWaves += ripple(vSurface, vec2(1.0, 0.23), 7.8, 0.011, -1.3, footprint);
          smallWaves += ripple(vSurface, vec2(0.75, -0.8), 12.3, 0.0055, 1.7, footprint);
          smallWaves += ripple(vSurface, vec2(-0.2, 1.0), 19.5, 0.003, -2.1, footprint);
          smallWaves += ripple(vSurface, vec2(0.95, 0.4), 31.0, 0.0015, 2.8, footprint);
          vec3 n = normalize(vWaveNormal + vec3(-smallWaves.x, 0.0, smallWaves.y));
          float facing = max(dot(n, viewDirection), 0.0);
          float fresnel = 0.0204 + 0.9796 * pow(1.0 - facing, 5.0);
          vec3 reflectedDirection = reflect(-viewDirection, n);
          vec3 reflectedSky = sky(reflectedDirection);

          vec2 reflectionUV = vReflection.xy / vReflection.w;
          reflectionUV += n.xz * 0.035 / max(1.0, distanceToEye * 0.12);
          vec4 reflectedScene = texture2D(tDiffuse, clamp(reflectionUV, 0.002, 0.998));
          vec3 reflection = mix(reflectedSky, reflectedScene.rgb, reflectedScene.a);

          // More light transmits through the wave shoulders than the troughs.
          float shoulder = smoothstep(-0.25, 0.52, vCrest);
          vec3 deepWater = vec3(0.004, 0.033, 0.047);
          vec3 shallowLight = vec3(0.012, 0.105, 0.12);
          vec3 waterColor = mix(deepWater, shallowLight, shoulder * 0.65);
          vec3 color = mix(waterColor, reflection, fresnel);
          vec3 sunDirection = normalize(vec3(-0.42, 0.48, -0.77));
          vec3 halfDirection = normalize(sunDirection + viewDirection);
          float highlight = pow(max(dot(n, halfDirection), 0.0), 180.0);
          float sheen = pow(max(dot(n, halfDirection), 0.0), 24.0);
          color += vec3(0.65, 0.84, 0.86) * highlight * 0.85;
          color += vec3(0.045, 0.105, 0.12) * sheen;

          // Sparse whitecaps belong only on the highest, steepest crests.
          float breakup = sin(vSurface.x * 15.0 + sin(vSurface.y * 9.0))
            * sin(vSurface.y * 18.0 - uTime * 0.7);
          float foam = smoothstep(0.42, 0.61, vCrest)
            * smoothstep(0.04, 0.2, 1.0 - n.y)
            * smoothstep(0.15, 0.65, breakup);
          color = mix(color, vec3(0.34, 0.51, 0.52), foam * 0.55);
          float fog = 1.0 - exp(-distanceToEye * distanceToEye * 0.00018);
          color = mix(color, vec3(0.023, 0.082, 0.104), fog);

          vec2 gridPosition = vSurface * 1.5;
          vec2 grid = abs(fract(gridPosition - 0.5) - 0.5)
            / max(fwidth(gridPosition), vec2(0.001));
          float line = 1.0 - min(min(grid.x, grid.y), 1.0);
          vec3 blueprint = vec3(0.018, 0.067, 0.1) + vec3(0.04, 0.2, 0.25) * line;
          color = mix(color, blueprint, uBlueprint);
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = -2.25;
  scene.add(water);
  const waterMaterial = water.material as THREE.ShaderMaterial;
  const uniforms = waterMaterial.uniforms;

  let mobile = false;
  let viewportWidth = 0, viewportHeight = 0;
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    if (width === viewportWidth && height === viewportHeight) return;
    viewportWidth = width;
    viewportHeight = height;
    mobile = width < 600;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.position.set(0, mobile ? 1.3 : 1.8, mobile ? 13 : 12);
    camera.lookAt(0, -0.1, 0);
    camera.updateProjectionMatrix();
    model.scale.setScalar(mobile ? 0.72 : 1.12);
    model.position.set(mobile ? 0.65 : 2.35, mobile ? -1.5 : 0.35, 0);
    renderFrame();
  };
  let pointerX = 0,
    pointerY = 0,
    time = 0,
    frame = 0,
    previous = 0;
  let visible = true,
    blueprint = false,
    userPaused: boolean | null = null,
    disposed = false,
    contextAvailable = true;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const paused = () => userPaused ?? media.matches;
  const renderFrame = () => {
    if (disposed || !contextAvailable) return;
    const baseY = mobile ? -1.5 : 0.35;
    model.position.y = baseY + Math.sin(time * 0.6) * 0.085;
    model.rotation.set(
      0.13 + pointerY * 0.06,
      -0.38 + pointerX * 0.1 + Math.sin(time * 0.15) * 0.09,
      -0.22 + Math.sin(time * 0.2) * 0.035,
    );
    orbitGroup.rotation.z = time * -0.02;
    uniforms.uTime.value = time;
    uniforms.uBlueprint.value = blueprint ? 1 : 0;
    renderer.render(scene, camera);
  };
  const tick = (stamp: number) => {
    frame = 0;
    if (
      disposed ||
      !contextAvailable ||
      !visible ||
      document.hidden ||
      paused()
    )
      return;
    if (stamp - previous > 32) {
      time += Math.min((stamp - previous) / 1000, 0.08);
      previous = stamp;
      renderFrame();
    }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (
      !paused() &&
      visible &&
      !document.hidden &&
      !disposed &&
      contextAvailable
    ) {
      previous = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };
  const pointer = (event: PointerEvent) => {
    if (paused() || event.pointerType !== "mouse") return;
    pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    pointerY = (event.clientY / window.innerHeight) * 2 - 1;
  };
  const observer = new IntersectionObserver(([entry]) => {
    if (visible === entry.isIntersecting) return;
    visible = entry.isIntersecting;
    sync();
  });
  observer.observe(container);
  const resizer = new ResizeObserver(resize);
  resizer.observe(container);
  window.addEventListener("pointermove", pointer, { passive: true });
  document.addEventListener("visibilitychange", sync);
  media.addEventListener("change", sync);
  const contextLost = (event: Event) => {
    event.preventDefault();
    contextAvailable = false;
    visible = false;
    cancelAnimationFrame(frame);
    renderer.domElement.style.opacity = "0";
    onUnavailable();
  };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  resize();
  sync();
  return {
    setBlueprint(value) {
      if (blueprint === value) return;
      blueprint = value;
      materials.forEach((m) => {
        m.wireframe = value;
      });
      label.visible = !value;
      orbitMaterial.opacity = value ? 0.65 : 0.16;
      renderFrame();
    },
    setPaused(value) {
      if (userPaused === value) return;
      userPaused = value;
      sync();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizer.disconnect();
      window.removeEventListener("pointermove", pointer);
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", sync);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      const geometries = new Set<THREE.BufferGeometry>();
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.Line ||
          obj instanceof THREE.Points
        )
          geometries.add(obj.geometry);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      water.dispose();
      labelMaterial.dispose();
      labelTexture.dispose();
      orbitMaterial.dispose();
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
