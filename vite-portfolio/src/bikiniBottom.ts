import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { METRES_PER_UNIT, WATER_LEVEL } from "./waterScale";
import { WATER_OPTICS_GLSL } from "./waterOptics";

/** A permanent, locally lit neighbourhood on the same ocean floor. */
export function createBikiniBottom(scene: THREE.Scene) {
  const town = new THREE.Group();
  town.name = "Bikini Bottom — a day at Goo Lagoon";
  town.position.y = WATER_LEVEL - 1007 / METRES_PER_UNIT;
  scene.add(town);
  const architecture = new THREE.Group();
  town.add(architecture);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const painted = new Set<THREE.ShaderMaterial>();
  const textures: THREE.Texture[] = [];
  const animated: { group: THREE.Group; y: number; phase: number; sway: number }[] = [];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // These positions are shared by the visible fixtures and their illumination.
  // Positions and radiant power are fixed in world space, including during a
  // reverse ascent. No camera-depth gate reveals or brightens the neighbourhood.
  const lamps = [
    { position: v(-25, 13, -49), color: 0xffce97, power: 17 },
    { position: v(14, 24, -52), color: 0xffd3a8, power: 28 },
    { position: v(-6, 22, -53), color: 0xb8e3f1, power: 24 },
    { position: v(34, 16, -67), color: 0xa8dbe7, power: 19 },
    { position: v(-19, 11, -10), color: 0xb9e1ed, power: 19 },
    { position: v(18, 12, -13), color: 0xffd8b1, power: 20 },
    { position: v(0, 17, -35), color: 0xffd5aa, power: 23 },
    { position: v(43, 14, -34), color: 0xa3dce9, power: 18 },
  ];
  const lampUniforms = {
    uLampPosition: { value: lamps.map(({ position }) => position.clone().add(town.position)) },
    uLampColor: { value: lamps.map(({ color, power }) => new THREE.Color(color).multiplyScalar(power)) },
  };
  const worldVertex = `
    varying vec3 vWorld, vWorldNormal;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 world = modelMatrix * vec4(position, 1.);
      vWorld = world.xyz;
      vWorldNormal = normalize((vec4(normalMatrix * normal, 0.) * viewMatrix).xyz);
      gl_Position = projectionMatrix * viewMatrix * world;
    }`;
  const townLighting = `
    ${WATER_OPTICS_GLSL}
    uniform vec3 uLampPosition[${lamps.length}], uLampColor[${lamps.length}];
    uniform float uBlueprint;
    varying vec3 vWorld, vWorldNormal;
    varying vec2 vUv;
    vec3 townLight(vec3 albedo, vec3 normal, float gloss) {
      vec3 eye = normalize(cameraPosition - vWorld);
      float depth = max(0., (${WATER_LEVEL.toFixed(2)} - vWorld.y) * ${METRES_PER_UNIT});
      vec3 illumination = vec3(.55, .72, .82) * solarAtDepth(depth)
        * max(.08, dot(normal, normalize(vec3(.18, 1., -.3))));
      vec3 specular = vec3(0.);
      for (int i = 0; i < ${lamps.length}; i++) {
        vec3 delta = uLampPosition[i] - vWorld;
        float metres = length(delta) * ${METRES_PER_UNIT};
        vec3 direction = normalize(delta);
        // Inverse-square falloff and the same wavelength extinction as the
        // rest of the ocean, on the lamp-to-surface path as well as to the eye.
        vec3 incoming = uLampColor[i] * exp(-metres * vec3(.11, .063, .052))
          / (1. + metres * metres);
        float diffuse = max(dot(normal, direction), 0.);
        // A little local scattered/bounced light keeps shaded faces readable;
        // it is supplied by these fixtures, not a depth-triggered global fill.
        illumination += incoming * (.14 + diffuse * .86);
        vec3 halfDirection = normalize(direction + eye);
        specular += incoming * pow(max(dot(normal, halfDirection), 0.), 40.) * gloss;
      }
      vec3 base = mix(albedo, vec3(.08, .28, .35), uBlueprint * .7);
      return base * illumination + specular;
    }`;

  const paint = (color: number) => {
    const albedo = new THREE.Color(color);
    // Retain each character's identity, with weathered, less saturated paint.
    albedo.lerp(new THREE.Color(0x81959b), .12).multiplyScalar(.87);
    const material = new THREE.ShaderMaterial({
      uniforms: { ...lampUniforms, uAlbedo: { value: albedo }, uBlueprint: { value: 0 } },
      vertexShader: worldVertex,
      fragmentShader: `${townLighting}
        uniform vec3 uAlbedo;
        void main() {
          vec3 lit = townLight(uAlbedo, normalize(vWorldNormal), .06);
          gl_FragColor = vec4(underwaterExtinction(lit, vWorld, cameraPosition), 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    materials.add(material);
    painted.add(material);
    return material;
  };
  const sand = paint(0xbcb499);
  const path = paint(0x8eaba7);
  const peach = paint(0xe8aa7a);
  const orange = paint(0xe99424);
  const orangeDark = paint(0xa45b20);
  const yellow = paint(0xf6ce31);
  const pore = paint(0xd29d16);
  const pink = paint(0xef8d9d);
  const green = paint(0x92cb55);
  const leaf = paint(0x569a36);
  const leafLight = paint(0x7eb73e);
  const violet = paint(0xa45ba3);
  const turquoise = paint(0x85b7b4);
  const slate = paint(0x657fa0);
  const slateLight = paint(0x8098b5);
  const blue = paint(0x479bd3);
  const deepBlue = paint(0x255673);
  const white = paint(0xe4e5dc);
  const black = paint(0x243d49);
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
  const inflatedVolume = (target: THREE.Object3D, material: THREE.Material,
    outline: [number, number][], centreY: number, halfDepth: number) => {
    const shape = new THREE.Shape();
    for (let i = 0; i < outline.length; i++) {
      const point = new THREE.Vector2(...outline[i]);
      const previous = new THREE.Vector2(...outline[(i + outline.length - 1) % outline.length]);
      const next = new THREE.Vector2(...outline[(i + 1) % outline.length]);
      const arrival = point.clone().lerp(previous, .18);
      const departure = point.clone().lerp(next, .18);
      if (i === 0) shape.moveTo(arrival.x, arrival.y);
      else shape.lineTo(arrival.x, arrival.y);
      shape.quadraticCurveTo(point.x, point.y, departure.x, departure.y);
    }
    shape.closePath();
    // Sample the smooth outline by polar angle around the belly. Latitude
    // rings inflate both sides, sharing the equator and tip normals;
    // unlike extrusion, every arm/head tip tapers to a rounded narrow edge.
    const boundary = shape.getSpacedPoints(512);
    const angular = 128; const latitudes = 40;
    const radii: number[] = [];
    const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
    for (let i = 0; i < angular; i++) {
      const angle = i / angular * Math.PI * 2;
      const dx = Math.cos(angle); const dy = Math.sin(angle);
      let distance = Infinity;
      for (let j = 0; j < boundary.length - 1; j++) {
        const a = boundary[j]; const b = boundary[j + 1];
        const sx = b.x - a.x; const sy = b.y - a.y;
        const denominator = cross(dx, dy, sx, sy);
        if (Math.abs(denominator) < 1e-8) continue;
        const t = cross(a.x, a.y - centreY, sx, sy) / denominator;
        const u = cross(a.x, a.y - centreY, dx, dy) / denominator;
        if (t > 0 && u >= 0 && u <= 1) distance = Math.min(distance, t);
      }
      radii.push(Number.isFinite(distance) ? distance : 1);
    }
    // Remove tiny angular sampling changes before they can print radial bands
    // into the smooth surface, without losing the five-point outline.
    for (let pass = 0; pass < 3; pass++) {
      const before = radii.slice();
      for (let i = 0; i < angular; i++) {
        radii[i] = (before[(i + angular - 1) % angular] + before[i] * 2 + before[(i + 1) % angular]) / 4;
      }
    }
    const radiusAt = (angle: number) => {
      const index = ((angle / (Math.PI * 2) + 1) % 1) * angular;
      return THREE.MathUtils.lerp(radii[Math.floor(index)], radii[(Math.floor(index) + 1) % angular], index % 1);
    };
    const frontAt = (x: number, y: number) => {
      const radius = radiusAt(Math.atan2(y - centreY, x));
      const radial = Math.hypot(x, y - centreY) / radius;
      // The quartic boundary profile suppresses star-angle creases at the
      // centre. A broad independent dome gives the belly a round curvature
      // instead of flattening it into a plate or forming an origami hub.
      const dome = Math.exp(-.032 * x * x - .012 * (y - centreY) ** 2);
      return halfDepth * dome * Math.sqrt(Math.max(0, 1 - radial ** 4));
    };
    const normalAt = (x: number, y: number) => v(
      -(frontAt(x + .005, y) - frontAt(x - .005, y)) / .01,
      -(frontAt(x, y + .005) - frontAt(x, y - .005)) / .01, 1,
    ).normalize();
    const positions = [0, centreY, halfDepth];
    const uvs = [0, centreY];
    const indices: number[] = [];
    for (let latitude = 1; latitude < latitudes; latitude++) {
      const phi = latitude / latitudes * Math.PI;
      for (let i = 0; i < angular; i++) {
        const angle = i / angular * Math.PI * 2;
        const r = Math.sin(phi) * radii[i];
        const x = Math.cos(angle) * r; const y = centreY + Math.sin(angle) * r;
        const z = Math.abs(Math.cos(phi)) < 1e-6 ? 0 : Math.sign(Math.cos(phi)) * frontAt(x, y);
        positions.push(x, y, z);
        uvs.push(x, y);
      }
    }
    const back = positions.length / 3;
    positions.push(0, centreY, -halfDepth); uvs.push(0, centreY);
    for (let i = 0; i < angular; i++) {
      const next = (i + 1) % angular;
      indices.push(0, 1 + i, 1 + next);
      for (let ring = 0; ring < latitudes - 2; ring++) {
        const a = 1 + ring * angular + i; const d = 1 + ring * angular + next;
        const b = a + angular; const c = d + angular;
        indices.push(a, b, c, a, c, d);
      }
      const last = 1 + (latitudes - 2) * angular;
      indices.push(last + i, back, last + next);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return { body: mesh(target, geometry, material), frontAt, normalAt };
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

  // Visible sealed lamps account for every source in townLight(). Their lenses
  // alone emit; the houses, people, sign, sand and lagoon only reflect light.
  for (const [index, lamp] of lamps.entries()) {
    const fixture = groupAt(architecture, `Sealed ocean lamp ${index + 1}`, 0, 0, 0);
    const { x, y, z } = lamp.position;
    const poleX = x + 1.4;
    rod(fixture, slate, v(poleX, .5, z), v(poleX, y + 1.05, z), .22, .15);
    rod(fixture, silver, v(poleX, y + .9, z), v(x, y + .9, z), .16);
    ring(fixture, silver, x, y - .4, z, .64, .13, true);
    ring(fixture, silver, x, y + .45, z, .64, .13, true);
    const hood = mesh(fixture, new THREE.ConeGeometry(.9, .48, 12), slate, x, y + .78, z);
    hood.name = "Lamp weather hood";
    for (let bar = 0; bar < 4; bar++) {
      const angle = bar * Math.PI * .5;
      const dx = Math.cos(angle) * .65; const dz = Math.sin(angle) * .65;
      rod(fixture, silver, v(x + dx, y - .4, z + dz), v(x + dx, y + .45, z + dz), .055);
    }
    const lensMaterial = new THREE.ShaderMaterial({
      uniforms: { uEmission: { value: new THREE.Color(lamp.color).multiplyScalar(3.5) } },
      vertexShader: worldVertex,
      fragmentShader: `${WATER_OPTICS_GLSL}
        varying vec3 vWorld;
        uniform vec3 uEmission;
        void main() {
          gl_FragColor = vec4(underwaterExtinction(uEmission, vWorld, cameraPosition), 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    materials.add(lensMaterial);
    sphere(fixture, lensMaterial, x, y, z, .57, .43, .57);
  }

  // The sandy seabed continues beyond the town. A low dune gives the
  // neighbourhood shape without leaving an island floating in open water.
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
    const collar = mesh(target, new THREE.CylinderGeometry(size + .12, size + .17, .65, 32),
      slate, x, y, z - .16);
    collar.rotation.x = Math.PI / 2;
    sphere(target, blue, x, y, z + .16, size * .88, size * .88, .12);
    ring(target, silver, x, y, z + .25, size, 0.18);
    rod(target, white, v(x - size * 0.5, y + size * 0.52, z + 0.29),
      v(x + size * 0.22, y + size * 0.8, z + 0.29), 0.055);
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
  function fruitMount(name: string, x: number, y: number) {
    const radius = fruitRadius(y);
    const z = Math.sqrt(Math.max(.01, radius * radius - x * x));
    const slope = (fruitRadius(y + .03) - fruitRadius(y - .03)) / .06;
    const outward = v(x / radius, -slope, z / radius).normalize();
    const mount = groupAt(pineapple, name, x, y, z);
    mount.quaternion.setFromUnitVectors(v(0, 0, 1), outward);
    return mount;
  }
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
  const door = fruitMount("Door mounted to the pineapple skin", 0, 3.9);
  // The deep socket intersects the narrowing fruit even at the bottom corners.
  box(door, deepBlue, 0, 0, -1.15, 3.9, 7.5, 4.2, 1.2);
  box(door, blue, 0, 0, .88, 3.05, 6.7, .23, 1.05);
  ring(door, silver, 0, .1, 1.08, .63, .12);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    rod(door, silver, v(0, .1, 1.08), v(Math.cos(a) * .95, .1 + Math.sin(a) * .95, 1.08), .07);
  }
  porthole(fruitMount("Lower tangent-mounted porthole", -3.5, 11.6), 0, 0, .04, 1.7);
  porthole(fruitMount("Upper tangent-mounted porthole", 3.3, 15.1), 0, 0, .04, 1.35);
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
  const glass = new THREE.ShaderMaterial({
    uniforms: { ...lampUniforms, uBlueprint: { value: 0 } },
    transparent: true, depthWrite: false,
    vertexShader: worldVertex,
    fragmentShader: `${townLighting}
      void main() {
        vec3 normal = normalize(vWorldNormal);
        float fresnel = pow(1. - abs(dot(normal, normalize(cameraPosition - vWorld))), 4.);
        vec3 lit = townLight(vec3(.08, .15, .17), normal, .9);
        gl_FragColor = vec4(underwaterExtinction(lit, vWorld, cameraPosition), .025 + fresnel * .22);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  materials.add(glass);
  painted.add(glass);
  const treeGlass = mesh(town, new THREE.SphereGeometry(9.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass, 34, 0.8, -81);
  treeGlass.name = "Transparent tree dome";
  rod(domeHome, brown, v(0, 0, 0), v(0, 7.4, 0), 0.7, 0.35);
  sphere(domeHome, leaf, 0, 6.8, 0, 4.7, 2.8, 4.7);
  sphere(domeHome, leafLight, -1.2, 8.7, 0.3, 3.2, 2.2, 3.2);

  // Goo Lagoon: the cartoon's deliberately impossible beach beneath the sea.
  sphere(architecture, peach, 0, 0.25, -25, 19, 0.7, 13);
  const lagoonMaterial = new THREE.ShaderMaterial({
    uniforms: { ...lampUniforms, uTime: { value: 0 }, uBlueprint: { value: 0 } },
    side: THREE.DoubleSide,
    vertexShader: worldVertex,
    fragmentShader: `${townLighting}
      uniform float uTime;
      void main() {
        vec2 p = (vUv - .5) * 2.;
        float shore = smoothstep(.77, 1., length(p));
        vec3 normal = normalize(vec3(
          cos(p.x * 31. + p.y * 6. + uTime * .7) * .07,
          1., cos(p.y * 27. - uTime * .5) * .055));
        vec3 water = mix(vec3(.015, .045, .058), vec3(.19, .23, .21), shore * .65);
        vec3 lit = townLight(water, normal, .8);
        gl_FragColor = vec4(underwaterExtinction(lit, vWorld, cameraPosition), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  materials.add(lagoonMaterial);
  painted.add(lagoonMaterial);
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
  eye(sponge, -1.15, 5.9, 0.97, 1.07);
  eye(sponge, 1.15, 5.9, 0.97, 1.07);
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
  const patrickMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...lampUniforms, uBlueprint: { value: 0 },
      uSkin: { value: pink.uniforms.uAlbedo.value },
      uShorts: { value: green.uniforms.uAlbedo.value },
      uFlowers: { value: violet.uniforms.uAlbedo.value },
    },
    vertexShader: worldVertex,
    fragmentShader: `${townLighting}
      uniform vec3 uSkin, uShorts, uFlowers;
      float flower(vec2 centre) {
        vec2 delta = vUv - centre;
        float petal = .31 + .115 * cos(atan(delta.y, delta.x) * 5.);
        return 1. - smoothstep(petal - .025, petal + .025, length(delta));
      }
      void main() {
        // Cloth follows the actual curved volume around both legs and belly.
        float cloth = (1. - smoothstep(3.51, 3.57, vUv.y)) * smoothstep(1.08, 1.14, vUv.y);
        float petals = max(flower(vec2(-1.2, 2.65)), max(flower(vec2(1.5, 2.2)), flower(vec2(.2, 1.85))));
        vec3 albedo = mix(uSkin, mix(uShorts, uFlowers, petals), cloth);
        vec3 lit = townLight(albedo, normalize(vWorldNormal), .055);
        gl_FragColor = vec4(underwaterExtinction(lit, vWorld, cameraPosition), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  materials.add(patrickMaterial); painted.add(patrickMaterial);
  const { body: patrickBody, frontAt, normalAt } = inflatedVolume(patrick, patrickMaterial, [
    [0, 10.25], [1.62, 6.42], [4.65, 6.8], [2.18, 4.1], [2.4, .25],
    [0, 1.7], [-2.4, .25], [-2.18, 4.1], [-4.65, 6.8], [-1.62, 6.42],
  ], 4.3, 1.8);
  patrickBody.name = "Patrick inflated continuous five-point body";
  const faceMount = (name: string, x: number, y: number, offset = 0) => {
    const mount = groupAt(patrick, name, x, y, frontAt(x, y) + offset);
    mount.quaternion.setFromUnitVectors(v(0, 0, 1), normalAt(x, y));
    return mount;
  };
  for (const side of [-1, 1]) {
    eye(faceMount("Eye on curved face", side * .59, 6.6, -.025), 0, 0, 0, .55, black);
    box(faceMount("Eyebrow on curved face", side * .6, 7.42, .025), black, 0, 0, 0, .62, .13, .08, .035);
  }
  const grin: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const x = -.82 + i / 8 * 1.64;
    const y = 4.98 + .4 * (x / .82) ** 2;
    grin.push(v(x, y, frontAt(x, y) + .025));
  }
  tube(patrick, brown, grin, .055);
  sphere(faceMount("Navel on curved belly", 0, 3.9, .01), brown, 0, 0, 0, .1, .1, .035);
  ring(patrick, gold, 0, 1.4, 0, 3.4, 0.5, true).scale.y = 0.8;
  floating(patrick, 2.3, 0.04);

  const squid = groupAt(town, "Squidward reluctantly at the beach", -13.3, 0.8, -30);
  squid.rotation.y = 0.12;
  const headProfile = new THREE.CatmullRomCurve3([
    v(0, 6.75, 0), v(.55, 6.95, 0), v(.94, 7.5, 0),
    v(1.24, 8.25, 0), v(1.52, 9.15, 0), v(1.58, 9.75, 0),
    v(1.29, 10.45, 0), v(.7, 10.85, 0), v(0, 11, 0),
  ]).getPoints(40).map((point) => new THREE.Vector2(Math.max(0, point.x), point.y));
  const squidHead = mesh(squid, new THREE.LatheGeometry(headProfile, 32), turquoise);
  squidHead.scale.z = .69;
  squidHead.name = "Squidward elongated tapered head";
  sphere(squid, turquoise, 0, 6.55, 0, .47, 1.08, .45);
  mesh(squid, new THREE.CylinderGeometry(.9, 1.5, 2.8, 20), brown, 0, 4.95, 0);
  eye(squid, -.59, 8.65, .98, .55, red, true);
  eye(squid, .59, 8.65, .98, .55, red, true);
  sphere(squid, turquoise, 0, 7.7, 1.49, .43, 1.07, .54);
  tube(squid, deepBlue, [v(-.55, 7.4, .48), v(0, 7.25, .55), v(.55, 7.4, .48)], .045);
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.65;
    tube(squid, turquoise, [v(x * 0.5, 3.7, 0), v(x, 1.4, 0.1), v(x * 1.5, 0.4, 0.75),
      v(x * 1.75, 0.5, 1.3)], .3);
  }
  for (const side of [-1, 1]) {
    sphere(squid, brown, side * 1.17, 5.45, 0, 0.6, 0.65, 0.6);
    tube(squid, turquoise, [v(side * 1.3, 5.3, 0), v(side * 2.3, 4.15, 0),
      v(side * 1.35, 3.7, 1), v(side * 0.1, 4.1, 1.3)], 0.23);
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.sin(i * 1.8) * .8;
    const y = 10.15 + Math.cos(i) * .26;
    const index = headProfile.findIndex((point) => point.y >= y);
    const lower = headProfile[Math.max(0, index - 1)]; const upper = headProfile[Math.max(1, index)];
    const radius = THREE.MathUtils.lerp(lower.x, upper.x, (y - lower.y) / (upper.y - lower.y));
    const z = Math.sqrt(Math.max(0, radius * radius - x * x)) * .69 + .012;
    sphere(squid, slate, x, y, z, .085, .11, .025);
  }
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
      const signMaterial = new THREE.ShaderMaterial({
        uniforms: { ...lampUniforms, uMap: { value: texture }, uBlueprint: { value: 0 } },
        vertexShader: worldVertex,
        fragmentShader: `${townLighting}
          uniform sampler2D uMap;
          void main() {
            vec3 albedo = texture2D(uMap, vUv).rgb;
            vec3 lit = townLight(albedo, normalize(vWorldNormal), .025);
            gl_FragColor = vec4(underwaterExtinction(lit, vWorld, cameraPosition), 1.);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      materials.add(signMaterial);
      painted.add(signMaterial);
      mesh(architecture, new THREE.PlaneGeometry(14, 4.67), signMaterial, 0, 13.5, -44);
      for (const x of [-6.6, 6.6]) rod(architecture, brown, v(x, 0.4, -44.3), v(x, 15.6, -44.3), 0.26);
    }
  }
  bake(architecture);

  let lastBlueprint = false;

  return {
    update(time: number, blueprint: boolean) {
      lagoonMaterial.uniforms.uTime.value = time;
      for (const item of animated) {
        item.group.position.y = item.y + Math.sin(time * 1.25 + item.phase) * 0.14;
        item.group.rotation.z = Math.sin(time * 0.85 + item.phase) * item.sway;
      }
      if (lastBlueprint !== blueprint) {
        for (const material of painted) {
          material.uniforms.uBlueprint.value = blueprint ? 1 : 0;
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
