import * as THREE from "three";
import { METRES_PER_UNIT, WATER_LEVEL, WAVE_GLSL, WAVE_GLSL_CALLS } from "./waves";
import { SKY_GLSL, SUN_DIRECTION } from "./lighting";
import { createMarineLife } from "./marineLife";
import { createBikiniBottom } from "./bikiniBottom";
import { oceanFogColor, WATER_OPTICS_GLSL } from "./waterOptics";

export interface DiveWorld {
  update: (depth: number, time: number, blueprint: boolean, underwater: number, camera: THREE.Camera) => void;
  dispose: () => void;
}

const worldY = (metres: number) => WATER_LEVEL - metres / METRES_PER_UNIT;
/** Open water is continuous. Encounters occupy their own depths; no artificial
 * walls confine the descent. The same optical water volume
 * surrounds every animal, reef and building at all times. */
export function createDiveWorld(scene: THREE.Scene): DiveWorld {
  const group = new THREE.Group();
  group.name = "Open ocean";
  scene.add(group);
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const add = <T extends THREE.Material>(geometry: THREE.BufferGeometry, material: T, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    geometries.add(geometry);
    materials.add(material);
    return mesh;
  };
  const shared = {
    uTime: { value: 0 },
    uDepth: { value: 0 },
    uBlueprint: { value: 0 },
    uUnderwater: { value: 0 },
    uFog: { value: new THREE.Color(0x063d4b) },
    uSunDirection: { value: new THREE.Vector3(...SUN_DIRECTION).normalize() },
  };

  // The same waves and the same sky are visible from both sides of the water.
  // This is an open plane: there is no circular aperture or pool boundary.
  const ceilingMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: shared,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld, vNormal;
      ${WAVE_GLSL}
      void main() {
        vec3 p = position;
        vec3 tangent = vec3(1.0, 0.0, 0.0);
        vec3 binormal = vec3(0.0, 1.0, 0.0);
        ${WAVE_GLSL_CALLS}
        vNormal = normalize(mat3(modelMatrix) * normalize(cross(tangent, binormal)));
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime, uBlueprint;
      uniform vec3 uFog;
      varying vec3 vWorld, vNormal;
      ${SKY_GLSL}
      ${WATER_OPTICS_GLSL}
      void main() {
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 normal = normalize(vNormal + vec3(sin(vWorld.z * 6.0 + uTime) * .025, 0., cos(vWorld.x * 7.2 - uTime) * .028));
        float facing = abs(dot(view, normal));
        vec3 refracted = refract(-view, -normal, 1.333);
        float window = smoothstep(.65, .69, facing);
        vec3 daylight = daylightSky(normalize(refracted + vec3(0., .0001, 0.)));
        float fresnel = .0204 + .9796 * pow(1.0 - facing, 5.0);
        vec3 reflected = mix(vec3(.025, .17, .22), vec3(.10, .34, .35), facing);
        vec3 color = mix(reflected, daylight, window * (1.0 - fresnel));
        color = underwaterExtinction(color, vWorld, cameraPosition);
        color = mix(color, vec3(.025, .16, .22), uBlueprint);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const ceiling = add(new THREE.PlaneGeometry(440, 440, 180, 180), ceilingMaterial);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = WATER_LEVEL;
  ceiling.visible = false;

  // Sparse reef shoulders provide scale near the surface while the entire
  // central viewing corridor stays open. They are separate natural outcrops,
  // never a surrounding tube and never an ocean-wide horizontal platform.
  const reef = new THREE.Group();
  reef.name = "Sunlit reef shoulders";
  group.add(reef);
  const terrainMaterial = (color: number, coral = false) => new THREE.ShaderMaterial({
    uniforms: { ...shared, uColor: { value: new THREE.Color(color) }, uCoral: { value: coral ? 1 : 0 } },
    vertexShader: `
      varying vec3 vWorld, vNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize((vec4(normalMatrix * normal, 0.) * viewMatrix).xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime, uBlueprint, uUnderwater, uCoral;
      uniform vec3 uColor, uFog, uSunDirection;
      varying vec3 vWorld, vNormal;
      ${WATER_OPTICS_GLSL}
      void main() {
        vec3 normal = normalize(vNormal);
        float depth = max(0., (${WATER_LEVEL.toFixed(3)} - vWorld.y) * ${METRES_PER_UNIT});
        float sunlight = solarAtDepth(depth);
        vec3 lightDirection = normalize(vec3(uSunDirection.x * .48, .83, uSunDirection.z * .48));
        float light = .30 + max(0., dot(normal, lightDirection)) * .75;
        vec2 p = vWorld.xz * .39 + vec2(vWorld.y * .13, 0.);
        p += vec2(sin(p.y * 1.6 + uTime * .20), cos(p.x * 1.2 - uTime * .16)) * .42;
        float web = abs(sin(p.x + sin(p.y * 1.3)) * sin(p.y + cos(p.x * .8)));
        float caustic = pow(1. - web, 17.) * sunlight * max(.1, normal.y);
        float grain = sin(vWorld.x * 8.4 + vWorld.y * 13.) * sin(vWorld.z * 9.7) * .025;
        vec3 color = uColor * (light * mix(.33, 1., sunlight) + grain);
        color += vec3(.28, .43, .31) * caustic;
        color += uColor * uCoral * .1;
        color = mix(color, underwaterExtinction(color, vWorld, cameraPosition), uUnderwater);
        color = mix(color, vec3(.035, .18, .21) * (.7 + light), uBlueprint);
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const stoneMaterial = terrainMaterial(0x7c9b83);
  const sandMaterial = terrainMaterial(0xcac398);
  const coralMaterials = [0xc78187, 0xb295c7, 0xceac69, 0x598f8b].map(color => terrainMaterial(color, true));
  const rockGeometry = new THREE.IcosahedronGeometry(1, 2);
  const rockPositions = rockGeometry.getAttribute("position");
  for (let index = 0; index < rockPositions.count; index++) {
    const x = rockPositions.getX(index), y = rockPositions.getY(index), z = rockPositions.getZ(index);
    const distortion = 1 + Math.sin(x * 7 + z * 4) * .12 + Math.cos(z * 9 - y * 3) * .06;
    rockPositions.setXYZ(index, x * distortion, y * distortion, z * distortion);
  }
  rockGeometry.computeVertexNormals();
  const coralGeometry = new THREE.IcosahedronGeometry(1, 1);
  for (let index = 0; index < 8; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const level = Math.floor(index / 2);
    const x = side * (38 + level * 5);
    const y = worldY(13 + level * 16);
    const z = -35 - level * 10;
    const rock = add(rockGeometry, stoneMaterial, reef);
    rock.position.set(x, y, z);
    rock.scale.set(18 + level * 3, 14 + level * 5, 22);
    rock.rotation.y = index * 1.7;
    const sand = add(rockGeometry, sandMaterial, reef);
    sand.position.set(x, y + 10 + level * 3.2, z - 2);
    sand.scale.set(16, 3.5, 18);
    for (let coralIndex = 0; coralIndex < 5; coralIndex++) {
      const angle = coralIndex * 2.4 + index;
      const coral = add(coralGeometry, coralMaterials[(index + coralIndex) % coralMaterials.length], reef);
      coral.position.set(x + Math.sin(angle) * 11, y + 13 + level * 3, z + Math.cos(angle) * 12);
      coral.scale.set(1.7 + coralIndex * .22, 2.1 + (coralIndex % 3) * 1.4, 1.7);
      coral.rotation.set(index * .3, angle, .22 * Math.sin(angle));
      const branch = add(coralGeometry, coralMaterials[(index + coralIndex) % coralMaterials.length], reef);
      branch.position.copy(coral.position).add(new THREE.Vector3(1.4, 1.2, .2));
      branch.scale.set(1.1, 2.2, 1.1);
      branch.rotation.z = -.55;
    }
  }

  // Refracted sunlight fans into the upper ocean. The optical density decreases
  // continuously with depth, rather than stopping at a geometric boundary.
  const rayMaterial = new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime, uUnderwater, uBlueprint;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        float stripe = pow(max(0., 1.0 - abs(vUv.x * 2.0 - 1.0)), 2.5);
        float depth = max(0., (${WATER_LEVEL.toFixed(3)} - vWorld.y) * ${METRES_PER_UNIT});
        float falloff = pow(vUv.y, 1.1) * (1.0 - smoothstep(.96, 1.0, vUv.y));
        float shimmer = .83 + .17 * sin(uTime * .32 + vUv.y * 22.0);
        float nearFade = smoothstep(.6, 6.0, distance(cameraPosition, vWorld));
        float attenuation = exp(-depth * .018);
        gl_FragColor = vec4(.43, .79, .69, stripe * falloff * shimmer * nearFade * attenuation * .095 * uUnderwater * (1.0 - uBlueprint));
      }`,
  });
  const sunDirection = shared.uSunDirection.value;
  const refractedSun = new THREE.Vector3(-sunDirection.x / 1.333, 0, -sunDirection.z / 1.333);
  refractedSun.y = -Math.sqrt(1 - refractedSun.lengthSq());
  for (let index = 0; index < 8; index++) {
    const length = 300 + index * 12;
    const ray = add(new THREE.PlaneGeometry(4.5 + index * .9, length), rayMaterial);
    ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), refractedSun);
    ray.position.set(-40 + index * 12, WATER_LEVEL, -160 + index * 11);
    ray.position.addScaledVector(refractedSun, length / 2);
  }

  // The entire kilometre is populated once. Particles advect in this fixed
  // volume; moving or resizing the camera never moves or respawns them.
  const particleCount = 12000;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  let seed = 1729;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let index = 0; index < particleCount; index++) {
    positions[index * 3] = random() * 200 - 100;
    positions[index * 3 + 1] = WATER_LEVEL - random() * 4120;
    positions[index * 3 + 2] = random() * 200 - 140;
    sizes[index] = .6 + random() * 1.4;
  }
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      attribute float aSize;
      varying float vAlpha, vLight;
      void main() {
        vec3 p = position;
        p.y = ${WATER_LEVEL} - mod(${WATER_LEVEL} - position.y + uTime * .16, 4120.);
        p.x += sin(uTime * .1 + position.y * .013) * .48;
        vLight = .13 + .87 * exp(-max(0., (${WATER_LEVEL} - p.y) * ${METRES_PER_UNIT}) * .025);
        vec4 view = viewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(aSize * 64.0 / max(1.0, -view.z), 1.0, 3.2);
        vAlpha = smoothstep(1., 7., -view.z) * exp(-length(p - cameraPosition) * .012);
        vAlpha *= step(p.y, ${WATER_LEVEL.toFixed(3)});
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform float uUnderwater, uBlueprint;
      varying float vAlpha, vLight;
      void main() {
        float circle = 1.0 - smoothstep(.12, .5, length(gl_PointCoord - .5));
        vec3 color = vec3(.30, .60, .74) * vLight;
        gl_FragColor = vec4(color, circle * vAlpha * .40 * uUnderwater * (1.0 - uBlueprint * .7));
      }`,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  group.add(particles);
  geometries.add(particleGeometry);
  materials.add(particleMaterial);

  const marineLife = createMarineLife(scene);
  const bikiniBottom = createBikiniBottom(scene);
  return {
    update(depth, time, blueprint, underwater, camera) {
      shared.uTime.value = time;
      shared.uDepth.value = depth;
      shared.uBlueprint.value = blueprint ? 1 : 0;
      shared.uUnderwater.value = underwater;
      oceanFogColor(depth, shared.uFog.value);
      ceiling.visible = underwater > .01;
      marineLife.update(depth, time, blueprint, underwater, camera);
      bikiniBottom.update(time, blueprint);
    },
    dispose() {
      marineLife.dispose();
      bikiniBottom.dispose();
      scene.remove(group);
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}
