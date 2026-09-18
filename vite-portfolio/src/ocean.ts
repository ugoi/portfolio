import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

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
  renderer.toneMappingExposure = 1.3;
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

  scene.add(new THREE.HemisphereLight(0x8fe8ff, 0x062632, 3));
  const key = new THREE.DirectionalLight(0xb8efff, 5);
  key.position.set(-4, 7, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x39eddb, 65, 16);
  rim.position.set(4, 2, 2);
  scene.add(rim);
  const blue = new THREE.PointLight(0x168cff, 80, 20);
  blue.position.set(0, -1, -4);
  scene.add(blue);

  const metal = new THREE.MeshStandardMaterial({
    color: 0x698e99,
    metalness: 0.94,
    roughness: 0.25,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x08202c,
    metalness: 0.82,
    roughness: 0.33,
  });
  const lightMetal = new THREE.MeshStandardMaterial({
    color: 0xb4d8d5,
    metalness: 0.9,
    roughness: 0.18,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x031316,
    metalness: 0.3,
    roughness: 0.68,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x9bffe9,
    emissive: 0x5cf8d7,
    emissiveIntensity: 2,
    metalness: 0.3,
    roughness: 0.24,
  });
  const oceanBlue = new THREE.MeshStandardMaterial({
    color: 0x09768a,
    metalness: 0.83,
    roughness: 0.2,
  });
  const materials = [metal, dark, lightMetal, rubber, glow, oceanBlue];
  const model = new THREE.Group();
  scene.add(model);
  const meshes: THREE.Mesh[] = [];
  const add = (
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Group = model,
  ) => {
    const mesh = new THREE.Mesh(geo, material);
    parent.add(mesh);
    meshes.push(mesh);
    return mesh;
  };
  // A custom mechanical rescue ring: machined shell, luminous seals, vented core.
  add(new THREE.TorusGeometry(1.61, 0.23, 18, 100), metal);
  add(
    new THREE.TorusGeometry(1.62, 0.245, 16, 100, Math.PI * 0.23),
    oceanBlue,
  ).rotation.z = 0.15;
  const arc2 = add(
    new THREE.TorusGeometry(1.62, 0.245, 16, 100, Math.PI * 0.23),
    oceanBlue,
  );
  arc2.rotation.z = Math.PI + 0.15;
  add(new THREE.TorusGeometry(1.81, 0.026, 8, 120), lightMetal).position.z =
    0.05;
  add(new THREE.TorusGeometry(1.42, 0.035, 10, 120), glow).position.z = 0.18;
  add(new THREE.TorusGeometry(1.3, 0.075, 12, 100), rubber).position.z = 0.08;
  const inner = new THREE.Group();
  model.add(inner);
  add(new THREE.TorusGeometry(0.98, 0.095, 14, 90), dark, inner).position.z =
    -0.07;
  add(new THREE.TorusGeometry(0.85, 0.018, 8, 100), glow, inner).position.z =
    0.04;
  const core = add(new THREE.CylinderGeometry(0.5, 0.5, 0.28, 12), metal);
  core.rotation.x = Math.PI / 2;
  core.position.z = 0.07;
  const face = add(new THREE.CylinderGeometry(0.385, 0.385, 0.03, 6), glow);
  face.rotation.x = Math.PI / 2;
  face.position.z = 0.24;
  const hex = add(new THREE.TorusGeometry(0.28, 0.025, 6, 6), dark);
  hex.position.z = 0.27;
  add(new THREE.TorusGeometry(0.18, 0.015, 6, 6), lightMetal).position.z =
    0.275;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const spoke = add(
      new THREE.BoxGeometry(0.105, 0.61, 0.14),
      i % 3 ? dark : lightMetal,
      inner,
    );
    spoke.position.set(Math.sin(angle) * 0.7, Math.cos(angle) * 0.7, -0.05);
    spoke.rotation.z = -angle;
    const bolt = add(
      new THREE.CylinderGeometry(0.052, 0.052, 0.055, 6),
      lightMetal,
    );
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(Math.sin(angle) * 1.63, Math.cos(angle) * 1.63, 0.24);
    const inset = add(new THREE.BoxGeometry(0.047, 0.017, 0.006), dark);
    inset.position.copy(bolt.position);
    inset.position.z += 0.03;
    inset.rotation.z = angle;
  }
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    const vent = add(
      new THREE.BoxGeometry(0.048, 0.15, 0.055),
      i % 4 === 0 ? glow : rubber,
    );
    vent.position.set(Math.sin(angle) * 1.63, Math.cos(angle) * 1.63, 0.218);
    vent.rotation.z = -angle;
  }
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const clamp = add(new THREE.BoxGeometry(0.36, 0.49, 0.38), dark);
    clamp.position.set(Math.sin(angle) * 1.65, Math.cos(angle) * 1.65, -0.09);
    clamp.rotation.z = -angle;
    const strip = add(new THREE.BoxGeometry(0.19, 0.045, 0.39), glow);
    strip.position.copy(clamp.position);
    strip.rotation.z = -angle;
  }
  // Fine orbital lines link the metal object to a drafting-board aesthetic.
  const orbitMaterial = new THREE.LineBasicMaterial({
    color: 0x63c9d5,
    transparent: true,
    opacity: 0.23,
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
  const uniforms = {
    uTime: { value: 0 },
    uBlueprint: { value: 0 },
    uColor: { value: new THREE.Color(0x073f57) },
  };
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vNormalWave;
      float wave(vec2 p) {
        return sin(p.x*.58+uTime*.53)*.24+sin(p.y*.68+uTime*.35+p.x*.21)*.22
          +sin(p.x*1.6+p.y*1.1-uTime*.4)*.08+sin(p.x*3.7-p.y*2.3+uTime*.8)*.028;
      }
      void main() {
        vec3 p=position;
        p.z=wave(p.xy);
        float e=.03;
        vNormalWave=normalize(vec3((wave(p.xy-vec2(e,0.))-wave(p.xy+vec2(e,0.)))/(2.*e),(wave(p.xy-vec2(0.,e))-wave(p.xy+vec2(0.,e)))/(2.*e),1.));
        vPos=p;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uBlueprint;
      varying vec3 vPos;
      varying vec3 vNormalWave;
      void main() {
        vec3 n=normalize(vNormalWave);
        float spec=pow(max(dot(n,normalize(vec3(.2,.3,1.))),0.),85.);
        float spec2=pow(max(dot(n,normalize(vec3(-.3,.15,1.))),0.),160.);
        float crest=smoothstep(.16,.49,vPos.z);
        vec3 col=mix(vec3(.014,.075,.12),vec3(.027,.24,.32),n.z*.5+crest*.5);
        col+=vec3(.17,.54,.63)*spec*.9+vec3(.17,.54,.48)*spec2*.6;
        float grid=step(.96,fract(vPos.x*1.5))+step(.96,fract(vPos.y*1.5));
        col=mix(col,vec3(.035,.13,.20)+vec3(.05,.24,.3)*min(grid,1.),uBlueprint);
        float fog=smoothstep(4.,21.,length(vPos.xy));
        col=mix(col,vec3(.022,.10,.14),fog);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(65, 65, 200, 200),
    waterMaterial,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -2.25;
  scene.add(water);
  const particlesGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    const a = i * 2.399;
    positions[i * 3] = Math.sin(a) * (2 + (i % 13));
    positions[i * 3 + 1] = (i % 17) / 2 - 2;
    positions[i * 3 + 2] = Math.cos(a) * 8 - 3;
  }
  particlesGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  const particlesMaterial = new THREE.PointsMaterial({
    color: 0xb3f8ed,
    size: 0.018,
    transparent: true,
    opacity: 0.5,
  });
  const particles = new THREE.Points(particlesGeo, particlesMaterial);
  scene.add(particles);

  let mobile = false;
  const resize = () => {
    const { width, height } = container.getBoundingClientRect();
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
    inner.rotation.z = time * 0.07;
    orbitGroup.rotation.z = time * -0.02;
    particles.rotation.y = time * 0.006;
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
    } else renderFrame();
  };
  const pointer = (event: PointerEvent) => {
    if (paused() || event.pointerType !== "mouse") return;
    pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    pointerY = (event.clientY / window.innerHeight) * 2 - 1;
  };
  const observer = new IntersectionObserver(([entry]) => {
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
      blueprint = value;
      materials.forEach((m) => {
        m.wireframe = value;
      });
      orbitMaterial.opacity = value ? 0.65 : 0.23;
      renderFrame();
    },
    setPaused(value) {
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
      waterMaterial.dispose();
      orbitMaterial.dispose();
      particlesMaterial.dispose();
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
