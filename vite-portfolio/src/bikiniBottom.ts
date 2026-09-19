import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { METRES_PER_UNIT, WATER_LEVEL } from "./waterScale";

/** A deliberately illustrated destination after the real ocean descent. */
export function createBikiniBottom(scene: THREE.Scene) {
  const town = new THREE.Group();
  town.name = "Bikini Bottom — a day at Goo Lagoon";
  town.position.y = WATER_LEVEL - 1007 / METRES_PER_UNIT;
  town.visible = false;
  scene.add(town);
  const architecture = new THREE.Group();
  town.add(architecture);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const palettes = new Map<THREE.MeshLambertMaterial, THREE.Color>();
  const textures: THREE.Texture[] = [];
  const animated: { group: THREE.Group; y: number; phase: number; sway: number }[] = [];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  const paint = (color: number, glow = 0.16) => {
    const material = new THREE.MeshLambertMaterial({
      color, emissive: color, emissiveIntensity: glow, fog: false,
    });
    materials.add(material);
    palettes.set(material, new THREE.Color(color));
    return material;
  };
  const sand = paint(0xe6c791, 0.28);
  const path = paint(0xbed3c3, 0.24);
  const peach = paint(0xe8aa7a);
  const orange = paint(0xe99424);
  const orangeDark = paint(0xa45b20);
  const yellow = paint(0xf6ce31, 0.28);
  const pore = paint(0xd29d16, 0.24);
  const pink = paint(0xef8d9d, 0.22);
  const green = paint(0x92cb55);
  const leaf = paint(0x569a36);
  const leafLight = paint(0x7eb73e);
  const violet = paint(0xa45ba3);
  const turquoise = paint(0x85b7b4, 0.2);
  const slate = paint(0x657fa0);
  const slateLight = paint(0x8098b5);
  const blue = paint(0x479bd3, 0.24);
  const deepBlue = paint(0x255673, 0.2);
  const white = paint(0xf6f0dc, 0.3);
  const black = paint(0x243d49, 0.08);
  const brown = paint(0x976049);
  const brownLight = paint(0xc08a58);
  const red = paint(0xe65a55);
  const gold = paint(0xf2ca77);
  const silver = paint(0xc4d5d1);

  function mesh(
    target: THREE.Object3D, geometry: THREE.BufferGeometry,
    material: THREE.Material, x = 0, y = 0, z = 0,
  ) {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    target.add(result);
    return result;
  }
  const sphere = (target: THREE.Object3D, material: THREE.Material,
    x: number, y: number, z: number, sx: number, sy = sx, sz = sx) => {
    const result = mesh(target, new THREE.SphereGeometry(1, 18, 12), material, x, y, z);
    result.scale.set(sx, sy, sz);
    return result;
  };
  const box = (target: THREE.Object3D, material: THREE.Material,
    x: number, y: number, z: number, w: number, h: number, d: number, radius = 0.1) =>
    mesh(target, new RoundedBoxGeometry(w, h, d, 2, radius), material, x, y, z);
  const rod = (target: THREE.Object3D, material: THREE.Material,
    a: THREE.Vector3, b: THREE.Vector3, radius: number, topRadius = radius) => {
    const result = mesh(target, new THREE.CylinderGeometry(topRadius, radius, a.distanceTo(b), 8), material);
    result.position.copy(a).add(b).multiplyScalar(0.5);
    result.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
    return result;
  };
  const tube = (target: THREE.Object3D, material: THREE.Material, points: THREE.Vector3[], radius: number) =>
    mesh(target, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, radius, 5, false), material);
  const ring = (target: THREE.Object3D, material: THREE.Material,
    x: number, y: number, z: number, radius: number, thickness: number, flat = false) => {
    const result = mesh(target, new THREE.TorusGeometry(radius, thickness, 8, 32), material, x, y, z);
    if (flat) result.rotation.x = Math.PI / 2;
    return result;
  };
  const groupAt = (target: THREE.Object3D, name: string, x: number, y: number, z: number) => {
    const result = new THREE.Group();
    result.name = name;
    result.position.set(x, y, z);
    target.add(result);
    return result;
  };

  // Bake each still-life or character into one draw per colour. Hundreds of
  // modelling details should not turn into hundreds of mobile draw calls.
  function bake(group: THREE.Group) {
    group.updateWorldMatrix(true, true);
    const inverse = group.matrixWorld.clone().invert();
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const originals: THREE.Mesh[] = [];
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      if (geometry.index) {
        const expanded = geometry.toNonIndexed();
        geometry.dispose();
        const batch = batches.get(object.material) ?? [];
        batch.push(expanded);
        batches.set(object.material, batch);
      } else {
        const batch = batches.get(object.material) ?? [];
        batch.push(geometry);
        batches.set(object.material, batch);
      }
      originals.push(object);
    });
    originals.forEach((original) => original.removeFromParent());
    for (const [material, parts] of batches) {
      const combined = mergeGeometries(parts);
      parts.forEach((part) => part.dispose());
      if (combined) mesh(group, combined, material);
    }
  }

  // The sandy seabed continues beyond the town. A low dune gives the
  // neighbourhood shape without leaving an island floating in open water.
  sand.fog = true;
  const seabed = mesh(architecture, new THREE.PlaneGeometry(2400, 2400), sand, 0, -4, -41);
  seabed.rotation.x = -Math.PI / 2;
  sphere(architecture, sand, 0, -5.5, -41, 98, 6, 97);
  sphere(architecture, sand, -40, -2.9, -79, 37, 4, 27);
  sphere(architecture, sand, 46, -2.9, -71, 43, 4, 34);
  const street = mesh(architecture, new THREE.CircleGeometry(1, 64), path, 0, 0.61, -57);
  street.rotation.x = -Math.PI / 2;
  street.scale.set(39, 11, 1);
  // Curved stepping-stones lead from the neighbourhood to the lagoon.
  for (let i = 0; i < 12; i++) {
    const z = -51 + i * 2.1;
    const x = 14 + Math.sin(i * 0.32) * 4;
    sphere(architecture, white, x, 0.9, z, 1.4, 0.18, 0.75);
  }

  function porthole(target: THREE.Group, x: number, y: number, z: number, size: number) {
    sphere(target, blue, x, y, z, size, size, 0.25);
    ring(target, silver, x, y, z + 0.18, size, 0.23);
    rod(target, white, v(x - size * 0.5, y + size * 0.52, z + 0.31),
      v(x + size * 0.22, y + size * 0.8, z + 0.31), 0.08);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      sphere(target, deepBlue, x + Math.cos(a) * size, y + Math.sin(a) * size, z + 0.38, 0.085);
    }
  }

  const pineapple = groupAt(architecture, "SpongeBob’s pineapple", 14, 0.65, -65);
  // The diamond skin follows the actual convex fruit, not a flat decal.
  const fruitPoints = [
    new THREE.Vector2(4.1, 0), new THREE.Vector2(5.8, 2),
    new THREE.Vector2(6.8, 7), new THREE.Vector2(6.4, 12),
    new THREE.Vector2(4.6, 18), new THREE.Vector2(2.6, 20),
  ];
  mesh(pineapple, new THREE.LatheGeometry(fruitPoints, 40), orange);
  const fruitRadius = (y: number) => {
    for (let i = 1; i < fruitPoints.length; i++) {
      if (y <= fruitPoints[i].y) {
        const a = fruitPoints[i - 1]; const b = fruitPoints[i];
        return THREE.MathUtils.lerp(a.x, b.x, (y - a.y) / (b.y - a.y));
      }
    }
    return 2.6;
  };
  for (const sign of [-1, 1]) {
    for (let strand = 0; strand < 12; strand++) {
      const points: THREE.Vector3[] = [];
      for (let j = 0; j <= 22; j++) {
        const y = j / 22 * 19.8;
        const a = strand / 12 * Math.PI * 2 + y * 0.15 * sign;
        const r = fruitRadius(y) + 0.06;
        points.push(v(Math.sin(a) * r, y, Math.cos(a) * r));
      }
      tube(pineapple, orangeDark, points, 0.1);
    }
  }
  // Broad tapered pineapple leaves have clear silhouettes from every angle.
  for (let i = 0; i < 11; i++) {
    const angle = i * 2.399;
    const length = 9 + (i % 3) * 2.2;
    const s = new THREE.Shape();
    s.moveTo(-1.5, 0); s.quadraticCurveTo(-2.4, length * 0.48, -0.3, length);
    s.quadraticCurveTo(2.2, length * 0.55, 1.5, 0); s.closePath();
    const blade = mesh(pineapple, new THREE.ExtrudeGeometry(s, {
      depth: 0.22, bevelEnabled: false, curveSegments: 6,
    }), i % 2 ? leaf : leafLight, Math.sin(angle) * 1.4, 18.5, Math.cos(angle) * 1.4);
    blade.rotation.y = angle;
    blade.rotation.x = 0.3 + (i % 4) * 0.13;
  }
  box(pineapple, deepBlue, 0, 3.9, 6.3, 3.9, 7.5, 0.7, 1.7);
  box(pineapple, blue, 0, 3.9, 6.73, 3.05, 6.7, 0.3, 1.4);
  ring(pineapple, silver, 0, 4, 7, 0.63, 0.12);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    rod(pineapple, silver, v(0, 4, 7), v(Math.cos(a) * 0.95, 4 + Math.sin(a) * 0.95, 7), 0.07);
  }
  porthole(pineapple, -3.5, 11.6, 5.75, 1.7);
  porthole(pineapple, 3.3, 15.1, 4.3, 1.35);
  tube(pineapple, silver, [v(5, 14, 0), v(8, 15, 0), v(8.5, 18, 0), v(10, 18, 0)], 0.7);
  for (let i = 0; i < 4; i++) box(pineapple, white, 0, 0.25 + i * 0.15, 9 - i, 4.4, 0.5, 1.4);

  const moai = groupAt(architecture, "Squidward’s Easter Island house", -5, 0.7, -69);
  box(moai, slate, 0, 11, 0, 11.6, 22, 8.7, 1.6);
  box(moai, slateLight, 0, 21.3, 0.1, 11.9, 5.4, 9.2, 1);
  box(moai, slate, 0, 24.4, -0.4, 10.6, 1.8, 8.3, 0.8);
  box(moai, slate, -6.5, 11.5, 0, 2.5, 7.8, 4, 0.5);
  box(moai, slate, 6.5, 11.5, 0, 2.5, 7.8, 4, 0.5);
  for (const side of [-1, 1]) {
    porthole(moai, side * 2.9, 16.1, 4.6, 1.6);
    box(moai, slateLight, side * 2.8, 18.5, 5, 5.4, 1.5, 2.3, 0.4);
  }
  box(moai, slateLight, 0, 11.4, 5.2, 2.4, 8.2, 3.2, 0.65);
  sphere(moai, slateLight, 0, 7.7, 6.1, 2.1, 1.15, 1.4);
  box(moai, deepBlue, 0, 3.1, 4.9, 3.7, 5.9, 0.45, 1.8);
  box(moai, brown, 0, 2.9, 5.2, 2.8, 5.1, 0.25, 1.3);
  sphere(moai, gold, 0.85, 2.7, 5.45, 0.2);

  const rock = groupAt(architecture, "Patrick’s rock", -25, 0.7, -59);
  const dome = mesh(rock, new THREE.SphereGeometry(8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), brownLight);
  dome.scale.set(1.2, 0.75, 0.95);
  ring(rock, brown, 0, 0.18, 0, 7.85, 0.22, true).scale.set(1.2, 0.95, 1);
  rod(rock, brown, v(0, 6, 0), v(0, 11, 0), 0.13);
  rod(rock, brown, v(-2, 9.5, 0), v(2, 9.5, 0), 0.13);
  sphere(rock, gold, -2, 9.5, 0, 0.5, 0.25, 0.5);
  const vane = mesh(rock, new THREE.ConeGeometry(0.6, 1.7, 3), brown, 2.5, 9.5, 0);
  vane.rotation.z = -Math.PI / 2;

  // Sandy’s tree dome is a small fourth landmark behind the beach.
  const domeHome = groupAt(architecture, "Sandy’s tree dome", 34, 0.8, -81);
  ring(domeHome, silver, 0, 0, 0, 9.5, 0.55, true);
  const glass = new THREE.MeshPhongMaterial({
    color: 0xb0ebd5, transparent: true, opacity: 0.1,
    shininess: 80, specular: 0xffffff, depthWrite: false, fog: false,
  });
  materials.add(glass);
  const treeGlass = mesh(town, new THREE.SphereGeometry(9.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass, 34, 0.8, -81);
  treeGlass.name = "Transparent tree dome";
  rod(domeHome, brown, v(0, 0, 0), v(0, 7.4, 0), 0.7, 0.35);
  sphere(domeHome, leaf, 0, 6.8, 0, 4.7, 2.8, 4.7);
  sphere(domeHome, leafLight, -1.2, 8.7, 0.3, 3.2, 2.2, 3.2);

  // Goo Lagoon: the cartoon's deliberately impossible beach beneath the sea.
  sphere(architecture, peach, 0, 0.25, -25, 19, 0.7, 13);
  const lagoonMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBlueprint: { value: 0 } },
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime, uBlueprint; varying vec2 vUv;
      void main() {
        vec2 p = (vUv - .5) * 2.;
        float shore = smoothstep(.77, 1., length(p));
        float ripples = sin(p.x * 45. + sin(p.y * 34. + uTime * .8) * 2. + uTime);
        float ripple = smoothstep(.85, .99, ripples) * .11;
        vec3 water = mix(vec3(.04, .61, .75), vec3(.17, .8, .79), .5 + p.y * .3);
        water += ripple;
        water = mix(water, vec3(.81, .96, .83), shore * .88);
        gl_FragColor = vec4(mix(water, vec3(.04, .26, .36), uBlueprint * .65), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  materials.add(lagoonMaterial);
  const lagoon = mesh(town, new THREE.CircleGeometry(1, 64), lagoonMaterial, 0, 1.02, -25);
  lagoon.rotation.x = -Math.PI / 2;
  lagoon.scale.set(17.5, 11.3, 1);

  function umbrella(x: number, z: number, color: THREE.Material, rotation: number) {
    const parasol = groupAt(architecture, "Beach umbrella", x, 0.5, z);
    parasol.rotation.z = rotation;
    rod(parasol, white, v(0, 0, 0), v(0, 10.3, 0), 0.12);
    for (let i = 0; i < 8; i++) {
      mesh(parasol, new THREE.ConeGeometry(4.6, 2.6, 5, 1, true, i * Math.PI / 4, Math.PI / 4),
        i % 2 ? white : color, 0, 9, 0);
    }
    sphere(parasol, gold, 0, 10.5, 0, 0.23);
  }
  umbrella(-21, -22, red, 0.14);
  umbrella(23, -34, blue, -0.13);
  const towelA = box(architecture, red, -22, 0.8, -14, 4.2, 0.18, 7.8);
  towelA.rotation.y = -0.25;
  const towelB = box(architecture, blue, 22, 0.8, -25, 4.2, 0.18, 7.8);
  towelB.rotation.y = 0.24;
  for (const x of [-22, 22]) {
    box(architecture, white, x, 0.93, x < 0 ? -12 : -23, 3.5, 0.08, 0.28);
  }
  sphere(architecture, white, 15, 1.8, -12, 1.5);
  sphere(architecture, red, 14.45, 2.5, -11.15, 0.65, 0.75, 0.4);
  sphere(architecture, blue, 15.6, 1.55, -10.8, 0.7, 0.7, 0.35);

  function eye(target: THREE.Object3D, x: number, y: number, z: number,
    size: number, iris = blue, sleepy = false) {
    sphere(target, sleepy ? gold : white, x, y, z, size, size * (sleepy ? 1.2 : 1), size * 0.42);
    sphere(target, iris, x, y - (sleepy ? size * 0.15 : 0), z + size * 0.35, size * 0.46, size * 0.5, 0.14);
    sphere(target, black, x, y - (sleepy ? size * 0.15 : 0), z + size * 0.48, size * 0.22, size * 0.31, 0.1);
    if (!sleepy) sphere(target, white, x - size * 0.1, y + size * 0.18, z + size * 0.57, size * 0.09);
    if (sleepy) box(target, turquoise, x, y + size * 0.6, z + size * 0.2, size * 1.8, size * 0.72, size * 0.6, 0.15);
  }
  function smile(target: THREE.Object3D, x: number, y: number, z: number, width: number) {
    tube(target, brown, [v(x - width, y + 0.2, z), v(x, y - 0.2, z + 0.03), v(x + width, y + 0.2, z)], 0.065);
  }
  function floating(group: THREE.Group, phase: number, sway = 0.02) {
    bake(group);
    animated.push({ group, y: group.position.y, phase, sway });
  }

  const sponge = groupAt(town, "SpongeBob swimming", -7.3, 0.5, -18);
  sponge.rotation.y = 0.08;
  box(sponge, yellow, 0, 5, 0, 5.6, 4.8, 1.85, 0.48);
  box(sponge, white, 0, 2.55, 0, 5.6, 0.72, 1.85, 0.1);
  box(sponge, brown, 0, 1.75, 0, 5.5, 1.05, 1.82, 0.15);
  for (let i = 0; i < 4; i++) box(sponge, black, -1.9 + i * 1.25, 1.98, 0.98, 0.7, 0.17, 0.1);
  const tie = mesh(sponge, new THREE.ConeGeometry(0.4, 1.1, 4), red, 0, 2.32, 1.04);
  tie.rotation.z = Math.PI;
  sphere(sponge, red, 0, 2.85, 1.04, 0.22);
  eye(sponge, -1.08, 5.9, 0.97, 1.13);
  eye(sponge, 1.08, 5.9, 0.97, 1.13);
  sphere(sponge, yellow, 0, 5.05, 1.4, 0.35, 0.7, 0.7);
  smile(sponge, 0, 3.95, 1.05, 1.5);
  box(sponge, white, -0.38, 3.8, 1.17, 0.6, 0.68, 0.3, 0.03);
  box(sponge, white, 0.38, 3.8, 1.17, 0.6, 0.68, 0.3, 0.03);
  for (const side of [-1, 1]) {
    sphere(sponge, peach, side * 2.05, 4.48, 0.99, 0.5, 0.34, 0.1);
    for (let i = 0; i < 3; i++) sphere(sponge, red, side * (1.83 + i * 0.18), 4.48 + i % 2 * 0.16, 1.11, 0.075);
    for (let i = 0; i < 3; i++) {
      const x = side * 1.08 + (i - 1) * 0.59;
      rod(sponge, black, v(x, 6.8, 1), v(x + (i - 1) * 0.16, 7.35, 1), 0.065);
    }
    sphere(sponge, white, side * 2.95, 3.5, 0, 0.48);
    tube(sponge, yellow, [v(side * 3, 3.6, 0), v(side * 3.7, 3.3, 0), v(side * 4.2, 4.6, 0.15)], 0.16);
    sphere(sponge, yellow, side * 4.2, 4.7, 0.15, 0.31);
    for (let f = 0; f < 3; f++) rod(sponge, yellow,
      v(side * 4.2, 4.7, 0.15), v(side * (4 + f * 0.3), 5.25 - f * 0.1, 0.15), 0.1);
    rod(sponge, yellow, v(side * 1.35, 1.4, 0), v(side * 1.35, 0.3, 0), 0.18);
    box(sponge, black, side * 1.6, 0.2, 0.3, 1.5, 0.4, 1.05, 0.19);
  }
  for (const [x, y, r] of [[-2.15, 6.6, 0.31], [2.1, 7, 0.2], [-2.35, 3.45, 0.25],
    [2.3, 3.28, 0.31], [2.48, 5.7, 0.16], [-1.98, 5.2, 0.15]]) {
    sphere(sponge, pore, x, y, 0.91, r, r * 0.75, 0.08);
  }
  ring(sponge, red, 0, 1.75, 0, 3.35, 0.42, true).scale.y = 0.75;
  floating(sponge, 0);

  const patrick = groupAt(town, "Patrick on his float", 5, 0.55, -17.5);
  patrick.rotation.y = -0.1;
  sphere(patrick, pink, 0, 4.4, 0, 2.5, 3, 1.35);
  const head = mesh(patrick, new THREE.ConeGeometry(1.85, 5.1, 24), pink, 0, 7, 0);
  head.scale.z = 0.73;
  sphere(patrick, green, 0, 2.35, 0, 2.55, 1.25, 1.42);
  for (const side of [-1, 1]) {
    const arm = rod(patrick, pink, v(side * 1.7, 4.7, 0), v(side * 4.6, 6.45, 0.1), 0.94, 0.06);
    arm.rotation.z += side * -0.06;
    rod(patrick, pink, v(side * 1.2, 2, 0), v(side * 1.55, 0.4, 0.4), 0.73, 0.35);
    eye(patrick, side * 0.55, 6.3, 1.02, 0.6, black);
    box(patrick, black, side * 0.62, 7.2, 1.01, 0.66, 0.15, 0.12);
  }
  smile(patrick, 0, 5.03, 1.32, 0.82);
  sphere(patrick, brown, 0, 3.6, 1.33, 0.12);
  for (const [x, y] of [[-1.2, 2.65], [1.5, 2.2], [0.2, 1.85]]) {
    for (let petal = 0; petal < 5; petal++) {
      const a = petal * Math.PI * 0.4;
      sphere(patrick, violet, x + Math.cos(a) * 0.22, y + Math.sin(a) * 0.22, 1.36, 0.21, 0.21, 0.07);
    }
  }
  ring(patrick, gold, 0, 1.4, 0, 3.4, 0.5, true).scale.y = 0.8;
  floating(patrick, 2.3, 0.04);

  const squid = groupAt(town, "Squidward reluctantly at the beach", -13.3, 0.8, -30);
  squid.rotation.y = 0.12;
  sphere(squid, turquoise, 0, 8.8, 0, 2.3, 2.55, 1.6);
  sphere(squid, turquoise, 0, 6.6, 0, 0.62, 1.3, 0.58);
  mesh(squid, new THREE.CylinderGeometry(0.8, 1.45, 2.45, 16), brown, 0, 4.8, 0);
  eye(squid, -0.65, 8.5, 1.3, 0.75, red, true);
  eye(squid, 0.65, 8.5, 1.3, 0.75, red, true);
  sphere(squid, turquoise, 0, 7.2, 2.1, 0.56, 1.38, 0.66);
  tube(squid, deepBlue, [v(-0.7, 6.8, 1.31), v(0, 6.65, 1.5), v(0.7, 6.8, 1.31)], 0.045);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.65;
    tube(squid, turquoise, [v(x * 0.5, 3.7, 0), v(x, 1.4, 0.1), v(x * 1.5, 0.4, 0.75),
      v(x * 1.75, 0.5, 1.3)], 0.27);
  }
  for (const side of [-1, 1]) {
    sphere(squid, brown, side * 1.17, 5.45, 0, 0.6, 0.65, 0.6);
    tube(squid, turquoise, [v(side * 1.3, 5.3, 0), v(side * 2.3, 4.15, 0),
      v(side * 1.35, 3.7, 1), v(side * 0.1, 4.1, 1.3)], 0.23);
  }
  for (let i = 0; i < 5; i++) sphere(squid, slate, Math.sin(i * 1.8) * 1.1, 10.2 + Math.cos(i) * 0.3, 1.05, 0.12, 0.15, 0.08);
  floating(squid, 0.8, 0.012);

  const sandy = groupAt(town, "Sandy in her diving suit", 13.5, 0.8, -28);
  sandy.rotation.y = -0.14;
  sphere(sandy, white, 0, 3.7, 0, 1.7, 2.3, 1.15);
  box(sandy, silver, 0, 3.35, 1.08, 1.35, 1.12, 0.22, 0.15);
  sphere(sandy, red, -0.36, 3.55, 1.24, 0.13);
  sphere(sandy, blue, 0.08, 3.55, 1.24, 0.13);
  ring(sandy, red, 0, 1.9, 0, 1.22, 0.16, true);
  sphere(sandy, brownLight, 0, 7, 0, 1.43, 1.45, 1.05);
  sphere(sandy, peach, 0, 6.5, 0.88, 0.95, 0.58, 0.46);
  sphere(sandy, brown, 0, 6.78, 1.25, 0.23, 0.16, 0.16);
  for (const side of [-1, 1]) {
    sphere(sandy, brownLight, side * 1.05, 8.1, 0, 0.52, 0.7, 0.37);
    sphere(sandy, peach, side * 1.08, 8.1, 0.28, 0.28, 0.4, 0.1);
    eye(sandy, side * 0.52, 7.4, 0.83, 0.5, black);
    rod(sandy, white, v(side * 1.1, 2, 0), v(side * 1.35, 0.55, 0.15), 0.53);
    box(sandy, white, side * 1.35, 0.3, 0.45, 1.25, 0.6, 1.65, 0.24);
    tube(sandy, white, [v(side * 1.45, 4.7, 0), v(side * 2.3, 4.25, 0.1), v(side * 2.65, 5.2, 0.3)], 0.46);
    sphere(sandy, white, side * 2.68, 5.38, 0.3, 0.55);
    ring(sandy, red, side * 2.6, 4.96, 0.3, 0.4, 0.12, true);
  }
  smile(sandy, 0, 6.3, 1.31, 0.57);
  box(sandy, white, -0.19, 6.13, 1.41, 0.31, 0.4, 0.15, 0.02);
  box(sandy, white, 0.19, 6.13, 1.41, 0.31, 0.4, 0.15, 0.02);
  tube(sandy, brown, [v(0, 2.2, -0.9), v(2.8, 3.5, -1.8), v(3.1, 5.6, -1.4), v(1.9, 5.1, -1.1)], 0.85);
  ring(sandy, silver, 0, 5.4, 0, 1.94, 0.28, true);
  // Helmet outline and little reflected arc remain readable without a costly
  // transmissive material, while the transparent bubble stays independent.
  ring(sandy, white, 0, 7.2, 0.2, 2.23, 0.075);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 0.4;
    sphere(sandy, pink, -1.4 + Math.cos(a) * 0.43, 9 + Math.sin(a) * 0.43, 0.52, 0.34, 0.4, 0.15);
  }
  sphere(sandy, yellow, -1.4, 9, 0.72, 0.25);
  floating(sandy, 3, 0.015);
  const helmet = mesh(sandy, new THREE.SphereGeometry(2.27, 24, 16), glass, 0, 7.2, 0.1);
  helmet.renderOrder = 2;

  // Clustered sea plants and shells make the sandy town feel inhabited.
  for (let i = 0; i < 17; i++) {
    const x = (i % 2 ? -1 : 1) * (25 + (i * 7.7) % 28);
    const z = -7 - (i * 13.1) % 81;
    const color = [pink, violet, turquoise, red][i % 4];
    for (let branch = 0; branch < 3; branch++) {
      const start = v(x, 0.4, z);
      const tip = v(x + (branch - 1) * 1.4, 3.4 + (i + branch) % 4, z + Math.sin(i + branch) * 1.2);
      tube(architecture, color, [start, v(x + (branch - 1) * 0.8, 2, z), tip], 0.24);
      sphere(architecture, color, tip.x, tip.y, tip.z, 0.38);
    }
    sphere(architecture, peach, x + 2, 0.7, z + 2, 1.1, 0.6, 0.75);
  }
  for (let i = 0; i < 22; i++) {
    const a = i * 2.399;
    const r = 24 + i * 0.9;
    sphere(architecture, i % 3 ? gold : white, Math.cos(a) * r, 0.65, -41 + Math.sin(a) * r,
      0.35 + i % 3 * 0.12, 0.15, 0.5);
  }

  // A small original sign is drawn locally; there are no external image hosts.
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 768; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#243c53"; ctx.fillRect(0, 0, 768, 256);
      ctx.strokeStyle = "#eed396"; ctx.lineWidth = 12; ctx.strokeRect(12, 12, 744, 232);
      ctx.fillStyle = "#f7e7b9"; ctx.textAlign = "center";
      ctx.font = "bold 64px Georgia, serif"; ctx.fillText("BIKINI BOTTOM", 384, 109);
      ctx.font = "27px sans-serif"; ctx.fillText("WELCOME TO THE NEIGHBOURHOOD", 384, 174);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.push(texture);
      const signMaterial = new THREE.MeshBasicMaterial({ map: texture, fog: false });
      materials.add(signMaterial);
      mesh(architecture, new THREE.PlaneGeometry(14, 4.67), signMaterial, 0, 13.5, -44);
      for (const x of [-6.6, 6.6]) rod(architecture, brown, v(x, 0.4, -44.3), v(x, 15.6, -44.3), 0.26);
    }
  }
  bake(architecture);

  const light = new THREE.DirectionalLight(0xffebc9, 2.1);
  light.position.set(-28, 65, 30);
  light.target.position.set(0, 0, -35);
  town.add(light, light.target);
  const fill = new THREE.HemisphereLight(0xc4f5ee, 0xbe956c, 1.4);
  town.add(fill);
  let lastBlueprint = false;

  return {
    update(depth: number, time: number, blueprint: boolean, underwater: number, camera: THREE.Camera) {
      town.visible = depth > 850 && underwater > 0.1;
      if (!town.visible) return;
      lagoonMaterial.uniforms.uTime.value = time;
      lagoonMaterial.uniforms.uBlueprint.value = blueprint ? 1 : 0;
      for (const item of animated) {
        item.group.position.y = item.y + Math.sin(time * 1.25 + item.phase) * 0.14;
        item.group.rotation.z = Math.sin(time * 0.85 + item.phase) * item.sway;
      }
      // The camera remains in the same ocean world; no screen-space model swap.
      light.intensity = THREE.MathUtils.smoothstep(depth, 920, 988) * 2.1;
      fill.intensity = THREE.MathUtils.smoothstep(depth, 920, 988) * 1.4;
      treeGlass.visible = camera.position.y < town.position.y + 140;
      if (lastBlueprint !== blueprint) {
        for (const [material, color] of palettes) {
          material.color.copy(blueprint ? new THREE.Color(0x78bfd0) : color);
          material.wireframe = blueprint;
        }
        lastBlueprint = blueprint;
      }
    },
    dispose() {
      scene.remove(town);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      town.clear();
    },
  };
}
