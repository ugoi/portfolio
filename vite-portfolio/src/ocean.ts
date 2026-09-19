import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { BuoyPhysics } from "./buoyPhysics";
import { createDiveWorld } from "./diveWorld";
import { cameraAtDive } from "./dive";
import { createSky } from "./sky";
import { SKY_GLSL, SUN_DIRECTION } from "./lighting";
import { METRES_PER_UNIT, WATER_LEVEL, WAVE_GLSL, WAVE_GLSL_CALLS, sampleWater } from "./waves";

export interface OceanController {
  setBlueprint: (value: boolean) => void;
  setPaused: (value: boolean | null) => void;
  setDive: (depth: number) => void;
  dispose: () => void;
}

export function createOcean(
  container: HTMLDivElement,
  interaction: HTMLDivElement,
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
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  const sky = createSky(renderer, scene);
  const sunDirection = new THREE.Vector3(...SUN_DIRECTION).normalize();

  scene.add(new THREE.HemisphereLight(0xb9e1ec, 0x062632, 1.5));
  const key = new THREE.DirectionalLight(0xffe0ac, 3.2);
  key.position.copy(sunDirection).multiplyScalar(80);
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
  orbitGroup.visible = false;
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
        uSunDirection: { value: sunDirection },
      },
      vertexShader: `
        uniform float uTime;
        uniform mat4 textureMatrix;
        varying vec3 vWorldPosition;
        varying vec3 vWaveNormal;
        varying vec2 vSurface;
        varying vec4 vReflection;
        varying float vCrest;

        ${WAVE_GLSL}

        void main() {
          vec3 p = position;
          vec3 tangent = vec3(1.0, 0.0, 0.0);
          vec3 binormal = vec3(0.0, 1.0, 0.0);
          ${WAVE_GLSL_CALLS}
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

        ${SKY_GLSL}

        vec2 ripple(vec2 p, vec2 direction, float frequency,
          float amplitude, float speed, float footprint) {
          vec2 d = normalize(direction);
          float phase = dot(d, p) * frequency + uTime * speed;
          // Fade subpixel ripples instead of sparkling/aliasing at the horizon.
          float filterWidth = frequency * footprint;
          float filtered = exp(-filterWidth * filterWidth * 0.6);
          return d * cos(phase) * amplitude * frequency * filtered;
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
          vec3 reflectedSky = daylightSky(reflectedDirection);

          vec2 reflectionUV = vReflection.xy / vReflection.w;
          reflectionUV += n.xz * 0.035 / max(1.0, distanceToEye * 0.12);
          vec4 reflectedScene = texture2D(tDiffuse, clamp(reflectionUV, 0.002, 0.998));
          vec3 reflection = mix(reflectedSky, reflectedScene.rgb, reflectedScene.a);

          // More light transmits through the wave shoulders than the troughs.
          float shoulder = smoothstep(-0.25, 0.52, vCrest);
          vec3 deepWater = vec3(0.008, 0.075, 0.10);
          vec3 shallowLight = vec3(0.025, 0.19, 0.22);
          vec3 waterColor = mix(deepWater, shallowLight, shoulder * 0.65);
          vec3 color = mix(waterColor, reflection, fresnel);
          vec3 halfDirection = normalize(uSunDirection + viewDirection);
          float highlight = pow(max(dot(n, halfDirection), 0.0), 180.0);
          float sheen = pow(max(dot(n, halfDirection), 0.0), 24.0);
          color += vec3(1.0, .79, .45) * highlight * 1.6;
          color += vec3(.14, .15, .12) * sheen;

          // Sparse whitecaps belong only on the highest, steepest crests.
          float breakup = sin(vSurface.x * 15.0 + sin(vSurface.y * 9.0))
            * sin(vSurface.y * 18.0 - uTime * 0.7);
          float foam = smoothstep(0.42, 0.61, vCrest)
            * smoothstep(0.04, 0.2, 1.0 - n.y)
            * smoothstep(0.15, 0.65, breakup);
          color = mix(color, vec3(0.34, 0.51, 0.52), foam * 0.55);
          float fog = 1.0 - exp(-distanceToEye * distanceToEye * 0.00018);
          color = mix(color, daylightSky(vec3(0.0, .01, -1.0)) * .7, fog * .5);

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
  water.position.y = WATER_LEVEL;
  scene.add(water);
  const waterMaterial = water.material as THREE.ShaderMaterial;
  const uniforms = waterMaterial.uniforms;
  // The detailed Gerstner patch sits inside the pool. Beyond the deck this
  // quiet, low-cost water ring carries the light all the way to the horizon.
  const distantWaterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: uniforms.uTime,
      uBlueprint: uniforms.uBlueprint,
      uSunDirection: { value: sunDirection },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime, uBlueprint;
      varying vec3 vWorld;
      ${SKY_GLSL}
      void main() {
        vec3 viewDirection = normalize(cameraPosition - vWorld);
        float distanceToEye = length(cameraPosition - vWorld);
        float detail = exp(-distanceToEye * .006);
        vec3 n = normalize(vec3(
          sin(vWorld.x * 1.1 + vWorld.z * .72 - uTime) * .045 * detail,
          1.0,
          cos(vWorld.z * 1.6 - vWorld.x * .26 - uTime * .7) * .04 * detail));
        float fresnel = .0204 + .9796 * pow(1.0 - max(dot(n, viewDirection), 0.0), 5.0);
        vec3 color = mix(vec3(.01, .095, .13), daylightSky(reflect(-viewDirection, n)), fresnel);
        float sunlight = pow(max(dot(n, normalize(viewDirection + uSunDirection)), 0.0), 260.0);
        color += vec3(1.0, .78, .43) * sunlight;
        float mist = 1.0 - exp(-distanceToEye * .003);
        color = mix(color, daylightSky(vec3(0.0, .01, -1.0)), mist * .66);
        color = mix(color, vec3(.018, .067, .1), uBlueprint);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const distantWater = new THREE.Mesh(new THREE.RingGeometry(30, 295, 128), distantWaterMaterial);
  distantWater.rotation.x = -Math.PI / 2;
  distantWater.position.y = WATER_LEVEL - .65;
  distantWater.name = "Sea beyond the pool terrace";
  scene.add(distantWater);
  const diveWorld = createDiveWorld(scene);
  const shallowFog = new THREE.Color(0x063d4b);
  const deepFog = new THREE.Color(0x031724);
  const underwaterBackground = new THREE.Color();

  const physics = new BuoyPhysics({ scale: 1.12, x: 2.6, z: 1 });
  interaction.hidden = false;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const hitArea = document.createElementNS(svg.namespaceURI, "path") as SVGPathElement;
  hitArea.setAttribute("class", "buoy-hit-area");
  hitArea.setAttribute("fill-rule", "evenodd");
  hitArea.setAttribute("tabindex", "0");
  hitArea.setAttribute("role", "button");
  hitArea.setAttribute("aria-label", "Rettungsring bewegen. Ziehen oder Pfeiltasten verwenden. R setzt den Ring zurück.");
  svg.appendChild(hitArea);
  interaction.appendChild(svg);

  let mobile = false, viewportWidth = 0, viewportHeight = 0;
  let frame = 0, previous = 0, activePointer: number | null = null;
  let visible = true, blueprint = false, userPaused: boolean | null = null;
  let disposed = false, contextAvailable = true;
  let diveDepth = 0;
  let keyboardRelease: ReturnType<typeof setTimeout> | undefined;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const paused = () => userPaused ?? media.matches;
  const raycaster = new THREE.Raycaster();
  const pointerPosition = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  let grabHeight = 0;
  const bounds = () => mobile
    ? { minX: -0.7, maxX: 0.8, minZ: -1, maxZ: 3.2 }
    : { minX: -3.5, maxX: 4.2, minZ: -3, maxZ: 3.5 };

  // A projected SVG hit area limits touch-action:none to the ring itself.
  // Touches elsewhere retain native page scrolling and pinch zoom.
  type Point = { x: number; y: number };
  const project = new THREE.Vector3();
  const screenPoint = (x: number, y: number, z: number): Point => {
    project.set(x, y, z).applyMatrix4(model.matrixWorld).project(camera);
    return { x: (project.x + 1) * viewportWidth / 2, y: (1 - project.y) * viewportHeight / 2 };
  };
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const hull = (points: Point[]) => {
    points.sort((a, b) => a.x - b.x || a.y - b.y);
    const half = (list: Point[]) => {
      const result: Point[] = [];
      for (const p of list) {
        while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], p) <= 0) result.pop();
        result.push(p);
      }
      return result.slice(0, -1);
    };
    return [...half(points), ...half([...points].reverse())];
  };
  const path = (points: Point[]) => points.map((p, i) =>
    `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
  const updateHitArea = () => {
    if (diveDepth > .15) return;
    const outer: Point[] = [], inner: Point[] = [];
    model.updateWorldMatrix(true, false);
    const facing = Math.abs(new THREE.Vector3(0, 0, 1).applyQuaternion(model.quaternion)
      .dot(new THREE.Vector3().subVectors(camera.position, model.position).normalize()));
    for (let i = 0; i < 40; i++) {
      const angle = i / 40 * Math.PI * 2;
      for (let j = 0; j < 4; j++) {
        const section = j * Math.PI / 2;
        const radius = 1.43 + 0.41 * Math.cos(section);
        outer.push(screenPoint(Math.cos(angle) * radius, Math.sin(angle) * radius, Math.sin(section) * 0.34));
      }
      // Keep the cutout smaller than the projected opening: its near wall
      // occludes part of the hole at this grazing camera angle.
      if (facing > 0.45) inner.push(screenPoint(Math.cos(angle) * 0.4, Math.sin(angle) * 0.4, 0.16));
    }
    hitArea.setAttribute("d", path(hull(outer)) + (inner.length ? " " + path(inner) : ""));
  };
  const updateCamera = () => {
    const enter = THREE.MathUtils.smoothstep(diveDepth, 0, .8);
    const descend = THREE.MathUtils.smoothstep(diveDepth, .8, 5);
    const cameraY = cameraAtDive(diveDepth, mobile).y;
    const cameraX = Math.sin(diveDepth * .12) * 2.2 * descend;
    const cameraZ = THREE.MathUtils.lerp(mobile ? 14 : 12, 7.5 + Math.sin(diveDepth * .08) * 1.5, enter);
    camera.position.set(cameraX, cameraY, cameraZ);
    // During entry the surface remains above the viewer. The gaze gradually
    // pitches into the shaft, then levels out before reaching its floor.
    const lookDrop = THREE.MathUtils.lerp(3.0, 35.0, descend);
    const lookY = Math.max(WATER_LEVEL - 40.8 / METRES_PER_UNIT, cameraY - lookDrop);
    camera.lookAt(
      THREE.MathUtils.lerp(0, -1.5, enter),
      THREE.MathUtils.lerp(-.1, lookY, enter),
      THREE.MathUtils.lerp(0, THREE.MathUtils.lerp(-14, 0, descend), enter),
    );
    const fov = THREE.MathUtils.lerp(60, mobile ? 64 : 54, enter);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  };
  const renderFrame = () => {
    if (disposed || !contextAvailable) return;
    model.position.copy(physics.position);
    model.quaternion.copy(physics.quaternion);
    uniforms.uTime.value = physics.time;
    uniforms.uBlueprint.value = blueprint ? 1 : 0;
    const underwater = THREE.MathUtils.clamp((WATER_LEVEL - camera.position.y) * 2, 0, 1);
    sky.update(camera, underwater);
    diveWorld.update(diveDepth, physics.time, blueprint, underwater);
    underwaterBackground.copy(shallowFog).lerp(deepFog, diveDepth / 40);
    scene.background = underwater > 0 ? underwaterBackground : null;
    const fog = scene.fog as THREE.FogExp2;
    fog.color.set(0x9ebbc2).lerp(underwaterBackground, underwater);
    fog.density = THREE.MathUtils.lerp(.008, .017 + diveDepth * .00023, underwater);
    water.visible = underwater < .5;
    distantWater.visible = underwater < .01;
    model.visible = diveDepth < 5;
    renderer.render(scene, camera);
    updateHitArea();
  };
  const tick = (stamp: number) => {
    frame = 0;
    if (disposed || !contextAvailable || !visible || document.hidden || (paused() && !physics.isDragging)) return;
    if (stamp - previous >= 32) {
      physics.advance(Math.min((stamp - previous) / 1000, 0.08), paused());
      previous = stamp;
      renderFrame();
    }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    if ((!paused() || physics.isDragging) && visible && !document.hidden && !disposed && contextAvailable) {
      if (!frame) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    } else {
      const wasRunning = frame !== 0;
      cancelAnimationFrame(frame);
      frame = 0;
      // Pausing can cancel a queued scroll update before its first paint.
      if (wasRunning && visible && !document.hidden) renderFrame();
    }
  };
  const endGrab = () => {
    const pointerId = activePointer;
    activePointer = null;
    if (pointerId !== null && hitArea.hasPointerCapture(pointerId)) hitArea.releasePointerCapture(pointerId);
    clearTimeout(keyboardRelease);
    physics.endDrag();
    hitArea.classList.remove("is-grabbed");
    sync();
  };
  const reset = () => {
    endGrab();
    physics.reset({ scale: mobile ? 0.72 : 1.12, x: mobile ? 0.2 : 2.6, z: mobile ? 1.5 : 1 });
    physics.setBounds(bounds());
    renderFrame();
  };
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0 || (width === viewportWidth && height === viewportHeight)) return;
    const wasMobile = mobile;
    const first = viewportWidth === 0;
    viewportWidth = width; viewportHeight = height;
    mobile = width < 600;
    renderer.setSize(width, height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    camera.aspect = width / height;
    updateCamera();
    camera.updateProjectionMatrix();
    model.scale.setScalar(mobile ? 0.72 : 1.12);
    if (first || wasMobile !== mobile) reset();
    else renderFrame();
  };
  const setRay = (event: PointerEvent) => {
    const rect = interaction.getBoundingClientRect();
    pointerPosition.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(pointerPosition, camera);
  };
  const clampTarget = () => {
    const area = bounds();
    target.x = THREE.MathUtils.clamp(target.x, area.minX - 1, area.maxX + 1);
    target.z = THREE.MathUtils.clamp(target.z, area.minZ - 1, area.maxZ + 1);
    target.y = sampleWater(target.x, target.z, physics.time).height + grabHeight;
  };
  const pointerDown = (event: PointerEvent) => {
    if (!contextAvailable || diveDepth > .15 || activePointer !== null || !event.isPrimary || event.button !== 0) return;
    setRay(event);
    model.updateWorldMatrix(true, true);
    const hit = raycaster.intersectObject(body, false)[0];
    if (!hit) return;
    endGrab();
    event.preventDefault();
    activePointer = event.pointerId;
    hitArea.setPointerCapture(event.pointerId);
    target.copy(hit.point);
    grabHeight = hit.point.y - sampleWater(hit.point.x, hit.point.z, physics.time).height;
    dragPlane.constant = -hit.point.y;
    physics.beginDrag(hit.point, target);
    hitArea.classList.add("is-grabbed");
    sync();
  };
  const pointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) return;
    event.preventDefault();
    setRay(event);
    if (raycaster.ray.intersectPlane(dragPlane, target)) {
      clampTarget();
      physics.updateDrag(target);
    }
  };
  const pointerEnd = (event: PointerEvent) => {
    if (event.pointerId === activePointer) endGrab();
  };
  const keyDown = (event: KeyboardEvent) => {
    if (diveDepth > .15) return;
    if (event.key.toLowerCase() === "r" || event.key === "Home") { event.preventDefault(); reset(); return; }
    if (event.key === "Escape") { event.preventDefault(); endGrab(); return; }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || activePointer !== null) return;
    event.preventDefault();
    if (!physics.isDragging) {
      model.updateWorldMatrix(true, false);
      target.copy(model.localToWorld(new THREE.Vector3(0, -1.43, 0.25)));
      grabHeight = target.y - sampleWater(target.x, target.z, physics.time).height;
      physics.beginDrag(target, target);
    }
    if (event.key === "ArrowLeft") target.x -= 0.4;
    if (event.key === "ArrowRight") target.x += 0.4;
    if (event.key === "ArrowUp") target.z -= 0.4;
    if (event.key === "ArrowDown") target.z += 0.4;
    clampTarget();
    physics.updateDrag(target);
    hitArea.classList.add("is-grabbed");
    clearTimeout(keyboardRelease);
    keyboardRelease = setTimeout(endGrab, 450);
    sync();
  };
  const visibilityChanged = () => {
    if (document.hidden) endGrab();
    sync();
  };
  const observer = new IntersectionObserver(([entry]) => {
    if (visible === entry.isIntersecting) return;
    visible = entry.isIntersecting;
    if (!visible) endGrab();
    sync();
  });
  observer.observe(container);
  const resizer = new ResizeObserver(resize);
  resizer.observe(container);
  hitArea.addEventListener("pointerdown", pointerDown);
  hitArea.addEventListener("pointermove", pointerMove);
  hitArea.addEventListener("pointerup", pointerEnd);
  hitArea.addEventListener("pointercancel", pointerEnd);
  hitArea.addEventListener("lostpointercapture", pointerEnd);
  hitArea.addEventListener("keydown", keyDown);
  hitArea.addEventListener("blur", endGrab);
  window.addEventListener("blur", endGrab);
  document.addEventListener("visibilitychange", visibilityChanged);
  media.addEventListener("change", sync);
  const contextLost = (event: Event) => {
    event.preventDefault();
    contextAvailable = false;
    visible = false;
    endGrab();
    renderer.domElement.style.opacity = "0";
    interaction.hidden = true;
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
      orbitGroup.visible = value;
      orbitMaterial.opacity = value ? 0.65 : 0.16;
      renderFrame();
    },
    setPaused(value) {
      if (userPaused === value) return;
      userPaused = value;
      sync();
    },
    setDive(value) {
      if (!Number.isFinite(value)) return;
      const depth = THREE.MathUtils.clamp(value, 0, 40);
      if (depth === diveDepth) return;
      diveDepth = depth;
      if (depth > .15) {
        endGrab();
        if (document.activeElement === hitArea) hitArea.blur();
      }
      interaction.hidden = depth > .15 || !contextAvailable;
      updateCamera();
      // The animation loop paints the latest camera at its existing 30 Hz.
      // A paused/static view still responds immediately to deliberate scroll.
      if (!frame) renderFrame();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizer.disconnect();
      endGrab();
      hitArea.removeEventListener("pointerdown", pointerDown);
      hitArea.removeEventListener("pointermove", pointerMove);
      hitArea.removeEventListener("pointerup", pointerEnd);
      hitArea.removeEventListener("pointercancel", pointerEnd);
      hitArea.removeEventListener("lostpointercapture", pointerEnd);
      hitArea.removeEventListener("keydown", keyDown);
      hitArea.removeEventListener("blur", endGrab);
      window.removeEventListener("blur", endGrab);
      svg.remove();
      document.removeEventListener("visibilitychange", visibilityChanged);
      media.removeEventListener("change", sync);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      diveWorld.dispose();
      sky.dispose();
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
      distantWaterMaterial.dispose();
      labelMaterial.dispose();
      labelTexture.dispose();
      orbitMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
