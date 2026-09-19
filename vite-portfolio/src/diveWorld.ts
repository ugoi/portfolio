import * as THREE from "three";
import { METRES_PER_UNIT, WATER_LEVEL, WAVE_GLSL, WAVE_GLSL_CALLS } from "./waves";
import { SKY_GLSL, SUN_DIRECTION } from "./lighting";

// The buoy and the pool use the same world scale: four scene units per metre.
// The camera can reach 40 m with enough space left above the tiled floor.
const RADIUS = 22;
const FLOOR_DEPTH = 40.9;
const HEIGHT = FLOOR_DEPTH / METRES_PER_UNIT;
const LAMP_DEPTHS = [5, 15, 25, 35] as const;
const LAMPS_PER_LEVEL = 6;

export interface DiveWorld {
  update: (depth: number, time: number, blueprint: boolean, underwater: number) => void;
  dispose: () => void;
}

export function createDiveWorld(scene: THREE.Scene): DiveWorld {
  const group = new THREE.Group();
  group.name = "Deep diving pool";
  scene.add(group);
  const textures: THREE.Texture[] = [];
  const instances: THREE.InstancedMesh[] = [];
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const add = <T extends THREE.Material>(geometry: THREE.BufferGeometry, material: T) => {
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    geometries.add(geometry);
    materials.add(material);
    return mesh;
  };
  const shared = {
    uTime: { value: 0 },
    uDepth: { value: 0 },
    uBlueprint: { value: 0 },
    uUnderwater: { value: 0 },
    uFog: { value: new THREE.Color(0x07343f) },
    uSunDirection: { value: new THREE.Vector3(...SUN_DIRECTION).normalize() },
  };
  const tiled = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { ...shared, uFloor: { value: 0 } },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime, uDepth, uBlueprint, uFloor, uUnderwater;
      uniform vec3 uFog, uSunDirection;
      varying vec3 vWorld;
      float grid(vec2 uv) {
        vec2 d = abs(fract(uv - .5) - .5) / max(fwidth(uv), vec2(.015));
        return 1.0 - min(min(d.x, d.y), 1.0);
      }
      vec2 cellPoint(vec2 cell) {
        return fract(sin(vec2(dot(cell, vec2(127.1, 311.7)),
          dot(cell, vec2(269.5, 183.3)))) * 43758.5453);
      }
      float causticLight(vec2 p) {
        // Domain-warped cellular boundaries form irregular refracted light
        // webs, rather than the straight diamond lattice of crossed sines.
        p += vec2(sin(p.y * 1.7 + sin(p.x * .8) + uTime * .19),
          cos(p.x * 1.4 + cos(p.y * .6) - uTime * .16)) * .34;
        vec2 cell = floor(p);
        vec2 local = fract(p);
        float nearest = 8.0;
        float next = 8.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 seed = cellPoint(cell + offset);
            vec2 point = .5 + .34 * sin(seed * 6.28318 + uTime * .18);
            float d = length(offset + point - local);
            next = min(next, max(nearest, d));
            nearest = min(nearest, d);
          }
        }
        float edge = next - nearest;
        return (1.0 - smoothstep(.008, .055, edge))
          * (.55 + .45 * sin(p.x * .7 + p.y * .5 + uTime * .24));
      }
      void main() {
        float depth = max(0.0, (${WATER_LEVEL.toFixed(2)} - vWorld.y) * .25);
        float angle = atan(vWorld.x, -vWorld.z);
        vec2 surface = mix(vec2(angle * ${RADIUS.toFixed(1)}, vWorld.y), vWorld.xz, uFloor);
        vec2 tileUV = surface / .8;
        float grout = grid(tileUV);
        vec2 tileID = floor(tileUV);
        float variation = fract(sin(dot(tileID, vec2(27.31, 83.17))) * 43758.5453);
        vec3 tile = mix(vec3(.30, .48, .48), vec3(.41, .60, .58), variation * .55);
        // Dark ceramic bands are built into the wall at each five-metre level.
        float band = 1.0 - smoothstep(.11, .15, abs(mod(depth + .15, 5.0) - .15));
        float verticalStripe = 1.0 - smoothstep(.028, .055, abs(sin(angle * 2.0)));
        tile = mix(tile, vec3(.028, .12, .18), max(band * .88, verticalStripe * .58) * (1.0 - uFloor));
        tile = mix(tile, vec3(.09, .16, .17), grout * .62);
        vec3 normal = mix(normalize(vec3(-vWorld.x, 0., -vWorld.z)), vec3(0., 1., 0.), uFloor);
        vec3 eye = normalize(cameraPosition - vWorld);
        // The sun refracts at the air/water boundary. A ray must reach the
        // opening without passing through the concrete wall to light a tile.
        vec3 sun = -refract(-uSunDirection, vec3(0., 1., 0.), 1.0 / 1.333);
        vec3 opening = vWorld + sun * (${WATER_LEVEL.toFixed(2)} - vWorld.y) / max(.1, sun.y);
        float openingLight = 1.0 - smoothstep(${(RADIUS - 1.3).toFixed(2)}, ${RADIUS.toFixed(2)}, length(opening.xz));
        vec2 p = surface * .46;
        float caustic = causticLight(p);
        float sunlight = exp(-depth * .073);
        float incidence = max(.0, dot(normal, sun));
        vec3 illumination = vec3(.16, .25, .30) + vec3(.34, .46, .43) * sunlight;
        illumination += vec3(1.08, .98, .72) * sunlight * openingLight * incidence;
        // Lights use the same positions as the visible recessed fittings.
        // The nearest level dominates; distant levels become the soft ambient
        // bounce above, keeping this bounded to six lights per fragment.
        float lampLevel = clamp(floor((depth - 5.0) / 10.0 + .5), 0., 3.) * 10.0 + 5.0;
        vec3 specular = vec3(0.);
        for (int index = 0; index < ${LAMPS_PER_LEVEL}; index++) {
          float a = float(index) * 1.04719755 + .52359878;
          vec3 inward = vec3(-sin(a), 0., cos(a));
          vec3 lamp = vec3(sin(a) * ${(RADIUS - .48).toFixed(2)}, ${WATER_LEVEL.toFixed(2)} - lampLevel / .25, -cos(a) * ${(RADIUS - .48).toFixed(2)});
          vec3 toLamp = lamp - vWorld;
          float distanceM = length(toLamp) * .25;
          vec3 lightDirection = normalize(toLamp);
          float diffuse = max(0., dot(normal, lightDirection));
          float forward = max(0., dot(inward, -lightDirection));
          // The small broad lobe represents light scattered off the fixture
          // surround. The forward lobe travels into the water and across tiles.
          float distribution = .11 + .89 * forward * forward;
          vec3 transmittance = exp(-distanceM * vec3(.19, .075, .055));
          vec3 lampLight = vec3(1.0, .86, .64) * transmittance
            * (24.0 * distribution / (.24 + distanceM * distanceM));
          illumination += lampLight * diffuse;
          vec3 halfVector = normalize(lightDirection + eye);
          specular += lampLight * pow(max(0., dot(normal, halfVector)), 80.) * .22 * (1.0 - grout);
        }
        vec3 color = tile * illumination;
        color += specular;
        color += vec3(.44, .59, .43) * caustic * sunlight * (.14 + openingLight * incidence * .8);
        float distanceToEye = length(cameraPosition - vWorld);
        vec3 absorption = exp(-distanceToEye * vec3(.029, .0095, .006));
        color *= mix(vec3(1.0), absorption, uUnderwater);
        float haze = (1.0 - exp(-distanceToEye * (.010 + uDepth * .00022))) * uUnderwater;
        color = mix(color, uFog, haze);
        vec3 technical = vec3(.012, .05, .075) + vec3(.07, .30, .36) * grid(surface / 4.0);
        technical += vec3(.02, .09, .12) * grout;
        color = mix(color, technical, uBlueprint);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const wall = add(new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT + 1.5, 128, 1, true), tiled);
  wall.position.y = WATER_LEVEL + .75 - HEIGHT / 2;

  const floorMaterial = tiled.clone();
  // Share the live uniform objects; material.clone otherwise copies them.
  Object.assign(floorMaterial.uniforms, shared);
  floorMaterial.uniforms.uFloor.value = 1;
  floorMaterial.side = THREE.FrontSide;
  const floor = add(new THREE.CircleGeometry(RADIUS, 128), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = WATER_LEVEL - HEIGHT;

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xa9b4af, roughness: .44, metalness: .16,
  });
  const rim = add(new THREE.TorusGeometry(RADIUS - .12, .19, 8, 128), rimMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = WATER_LEVEL + .36;
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0xb3b7a8, roughness: .83 });
  const deck = add(new THREE.RingGeometry(RADIUS, 34, 128), deckMaterial);
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = WATER_LEVEL + .32;

  const labelMaterials: THREE.MeshBasicMaterial[] = [];
  for (let metres = 5; metres <= 40; metres += 5) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#adc6c6";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#174955";
    ctx.font = "700 172px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(metres).padStart(2, "0"), 238, 113);
    ctx.font = "600 33px sans-serif";
    ctx.fillText("METER", 256, 224);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, color: 0x8dc4ca });
    labelMaterials.push(material);
    // Repeated markings remain visible in both narrow and wide viewports.
    for (const angle of [-.75, 0, .75, Math.PI]) {
      const marker = add(new THREE.PlaneGeometry(3.8, 1.9), material);
      marker.position.set(Math.sin(angle) * (RADIUS - .15), WATER_LEVEL - metres / METRES_PER_UNIT + 1.25, -Math.cos(angle) * (RADIUS - .15));
      marker.rotation.y = -angle;
    }
  }

  // Each 28 cm fitting has a recessed body, stainless trim and a glass lens.
  // Instancing keeps all 24 fittings to a few draw calls, including their beams.
  const fixtureTransforms: THREE.Matrix4[] = [];
  const beamTransforms: THREE.Matrix4[] = [];
  const fixturePose = new THREE.Object3D();
  fixturePose.rotation.order = "YXZ";
  for (const metres of LAMP_DEPTHS) {
    for (let index = 0; index < LAMPS_PER_LEVEL; index++) {
      const angle = index * Math.PI * 2 / LAMPS_PER_LEVEL + Math.PI / 6;
      fixturePose.position.set(Math.sin(angle) * (RADIUS - .17), WATER_LEVEL - metres / METRES_PER_UNIT, -Math.cos(angle) * (RADIUS - .17));
      fixturePose.rotation.set(0, -angle, 0);
      fixturePose.updateMatrix();
      fixtureTransforms.push(fixturePose.matrix.clone());
      fixturePose.rotation.x = .12;
      fixturePose.updateMatrix();
      beamTransforms.push(fixturePose.matrix.clone());
    }
  }
  const addInstanced = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    transforms = fixtureTransforms,
  ) => {
    const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
    instances.push(mesh);
    transforms.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    geometries.add(geometry);
    materials.add(material);
    return mesh;
  };
  const fixtureMaterial = new THREE.MeshStandardMaterial({ color: 0x172b30, roughness: .58, metalness: .3 });
  const steelMaterial = new THREE.MeshStandardMaterial({ color: 0xaebbb6, roughness: .29, metalness: .82 });
  const fixtureGeometry = new THREE.CylinderGeometry(.56, .56, .14, 32);
  fixtureGeometry.rotateX(Math.PI / 2);
  fixtureGeometry.translate(0, 0, -.02);
  addInstanced(fixtureGeometry, fixtureMaterial);
  const bezelGeometry = new THREE.TorusGeometry(.47, .068, 8, 40);
  bezelGeometry.translate(0, 0, .09);
  addInstanced(bezelGeometry, steelMaterial);
  const lightVertex = `
    varying vec2 vUv;
    varying vec3 vWorld, vNormal;
    void main() {
      vUv = uv;
      mat4 transform = modelMatrix * instanceMatrix;
      vec4 world = transform * vec4(position, 1.0);
      vWorld = world.xyz;
      vNormal = normalize(mat3(transform) * normal);
      gl_Position = projectionMatrix * viewMatrix * world;
    }`;
  const lensMaterial = new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: lightVertex,
    fragmentShader: `
      uniform float uUnderwater, uBlueprint, uDepth;
      uniform vec3 uFog;
      varying vec2 vUv;
      varying vec3 vWorld, vNormal;
      void main() {
        float radius = length(vUv - .5) * 2.0;
        float glassEdge = smoothstep(.79, .98, radius);
        vec3 color = mix(vec3(3.6, 3.0, 2.15), vec3(.45, .49, .44), glassEdge);
        color *= .94 + .06 * cos(radius * 76.0);
        float facing = max(0., dot(vNormal, normalize(cameraPosition - vWorld)));
        color *= .6 + .4 * facing;
        float eyeDistance = distance(cameraPosition, vWorld);
        color *= exp(-eyeDistance * vec3(.029, .0095, .006) * uUnderwater);
        float haze = (1.0 - exp(-eyeDistance * (.010 + uDepth * .00022))) * uUnderwater;
        color = mix(color, uFog, haze);
        color = mix(color, vec3(.05, .35, .40), uBlueprint);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const lensGeometry = new THREE.CircleGeometry(.416, 32);
  lensGeometry.translate(0, 0, .112);
  addInstanced(lensGeometry, lensMaterial);
  const screwTransforms: THREE.Matrix4[] = [];
  for (const matrix of fixtureTransforms) {
    for (let index = 0; index < 4; index++) {
      const angle = index * Math.PI / 2 + Math.PI / 4;
      const offset = new THREE.Matrix4().makeTranslation(Math.cos(angle) * .48, Math.sin(angle) * .48, .157);
      screwTransforms.push(matrix.clone().multiply(offset));
    }
  }
  addInstanced(new THREE.CircleGeometry(.026, 8), fixtureMaterial, screwTransforms);
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: lightVertex,
    fragmentShader: `
      uniform float uUnderwater, uBlueprint;
      varying vec2 vUv;
      varying vec3 vWorld, vNormal;
      void main() {
        float radius = length(vUv - .5) * 2.0;
        float glow = exp(-radius * radius * 7.5) * (1.0 - smoothstep(.5, 1., radius));
        float eyeDistance = distance(cameraPosition, vWorld);
        float facing = max(0., dot(vNormal, normalize(cameraPosition - vWorld)));
        vec3 color = vec3(1., .89, .66) * exp(-eyeDistance * vec3(.029, .0095, .006));
        gl_FragColor = vec4(color, glow * .38 * sqrt(facing) * uUnderwater * (1.0 - uBlueprint));
      }`,
  });
  const glowGeometry = new THREE.PlaneGeometry(3.4, 3.4);
  glowGeometry.translate(0, 0, .18);
  addInstanced(glowGeometry, glowMaterial);
  const beamMaterial = new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: lightVertex,
    fragmentShader: `
      uniform float uUnderwater, uBlueprint;
      varying vec2 vUv;
      varying vec3 vWorld, vNormal;
      void main() {
        vec3 eye = normalize(cameraPosition - vWorld);
        float edge = pow(abs(dot(vNormal, eye)), .8);
        float density = pow(vUv.y, 2.2) * (1.0 - smoothstep(.88, 1., vUv.y));
        float eyeDistance = distance(cameraPosition, vWorld);
        float nearFade = smoothstep(.3, 2., eyeDistance);
        vec3 tint = vec3(.78, .88, .74) * exp(-eyeDistance * vec3(.025, .009, .005));
        gl_FragColor = vec4(tint, edge * density * nearFade * .095 * uUnderwater * (1.0 - uBlueprint));
      }`,
  });
  const beamGeometry = new THREE.ConeGeometry(3.8, 15, 24, 1, true);
  beamGeometry.rotateX(-Math.PI / 2);
  beamGeometry.translate(0, 0, 7.8);
  addInstanced(beamGeometry, beamMaterial, beamTransforms);

  // Narrow construction joints and rounded ledges give the shaft scale without
  // introducing obstacles or a decorative science-fiction framework.
  const jointMaterial = new THREE.MeshStandardMaterial({ color: 0x456266, roughness: .61, metalness: .08 });
  for (const metres of [10, 20, 30, 40]) {
    const joint = add(new THREE.TorusGeometry(RADIUS - .09, .12, 8, 128), jointMaterial);
    joint.rotation.x = Math.PI / 2;
    joint.position.y = WATER_LEVEL - metres / METRES_PER_UNIT;
  }

  const ropeMaterial = new THREE.MeshBasicMaterial({ color: 0x618589 });
  const rope = add(new THREE.CylinderGeometry(.035, .035, HEIGHT, 7), ropeMaterial);
  rope.position.set(-8, WATER_LEVEL - HEIGHT / 2, -8);
  const ropeMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xd0baa0 });
  for (let metres = 5; metres <= 40; metres += 5) {
    const marker = add(new THREE.CylinderGeometry(.085, .085, .4, 8), ropeMarkerMaterial);
    marker.position.set(-8, WATER_LEVEL - metres / METRES_PER_UNIT, -8);
  }
  const floorTargetMaterial = new THREE.MeshBasicMaterial({ color: 0x0a2b3d });
  const floorTarget = add(new THREE.RingGeometry(2.0, 2.3, 72), floorTargetMaterial);
  floorTarget.rotation.x = -Math.PI / 2;
  floorTarget.position.set(0, floor.position.y + .025, 0);
  const crossA = add(new THREE.PlaneGeometry(.28, 4.8), floorTargetMaterial);
  crossA.rotation.x = -Math.PI / 2;
  crossA.position.set(0, floor.position.y + .03, 0);
  const crossB = add(new THREE.PlaneGeometry(4.8, .28), floorTargetMaterial);
  crossB.rotation.x = -Math.PI / 2;
  crossB.position.copy(crossA.position);

  // The reflector is one-sided. This second surface gives the submerged
  // camera the same Gerstner waves viewed from below, including a Snell window.
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
      uniform float uTime, uBlueprint, uDepth;
      uniform vec3 uFog;
      varying vec3 vWorld, vNormal;
      ${SKY_GLSL}
      void main() {
        if (length(vWorld.xz) > ${RADIUS.toFixed(1)}) discard;
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 normal = normalize(vNormal + vec3(sin(vWorld.z * 6.0 + uTime) * .028, 0., cos(vWorld.x * 7.2 - uTime) * .03));
        float facing = abs(dot(view, normal));
        // Total internal reflection outside the 48.6-degree Snell window.
        // Refraction samples exactly the same outdoor sky and sun as above.
        vec3 refracted = refract(-view, -normal, 1.333);
        float window = smoothstep(.65, .69, facing);
        vec3 daylight = daylightSky(normalize(refracted + vec3(0., .0001, 0.)));
        float fresnel = .0204 + .9796 * pow(1.0 - facing, 5.0);
        vec3 reflectedWater = mix(vec3(.025, .15, .18), vec3(.10, .32, .32), facing);
        vec3 color = mix(reflectedWater, daylight, window * (1.0 - fresnel));
        float distanceToEye = length(cameraPosition - vWorld);
        color *= exp(-distanceToEye * vec3(.029, .0095, .006));
        color = mix(color, uFog, 1.0 - exp(-distanceToEye * (.009 + uDepth * .0002)));
        color = mix(color, vec3(.04, .16, .20), uBlueprint);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const ceiling = add(new THREE.PlaneGeometry(46, 46, 96, 96), ceilingMaterial);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.y = WATER_LEVEL;
  ceiling.visible = false;

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
        float stripe = pow(max(0., 1.0 - abs(vUv.x * 2.0 - 1.0)), 3.0);
        float falloff = pow(vUv.y, 1.8) * (1.0 - smoothstep(.92, 1.0, vUv.y));
        float shimmer = .88 + .12 * sin(uTime * .4 + vUv.y * 12.0);
        float nearFade = smoothstep(.4, 3.0, distance(cameraPosition, vWorld));
        float inside = 1.0 - smoothstep(${(RADIUS - .8).toFixed(2)}, ${RADIUS.toFixed(2)}, length(vWorld.xz));
        gl_FragColor = vec4(.70, .84, .70, stripe * falloff * shimmer * nearFade * inside * .048 * uUnderwater * (1.0 - uBlueprint));
      }`,
  });
  const sunDirection = shared.uSunDirection.value;
  const refractedSun = new THREE.Vector3(-sunDirection.x / 1.333, 0, -sunDirection.z / 1.333);
  refractedSun.y = -Math.sqrt(1 - refractedSun.lengthSq());
  for (let index = 0; index < 5; index++) {
    const length = 62;
    const ray = add(new THREE.PlaneGeometry(2.2 + index * .45, length), rayMaterial);
    ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), refractedSun);
    ray.position.set(-11 + index * 4.8, WATER_LEVEL, -14 + index * .5);
    ray.position.addScaledVector(refractedSun, length / 2);
  }

  const particleCount = 480;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  // Fixed distribution prevents layout changes and makes paused views stable.
  let seed = 1729;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let index = 0; index < particleCount; index++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * (RADIUS - 1);
    positions[index * 3] = Math.sin(angle) * radius;
    positions[index * 3 + 1] = WATER_LEVEL - random() * HEIGHT;
    positions[index * 3 + 2] = Math.cos(angle) * radius;
  }
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: shared,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y = ${WATER_LEVEL.toFixed(2)} - mod(${WATER_LEVEL.toFixed(2)} - p.y - uTime * .07, ${HEIGHT.toFixed(2)});
        p.x += sin(uTime * .12 + p.y) * .12;
        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(38.0 / max(1.0, -view.z), 1.0, 3.0);
        vAlpha = smoothstep(0.5, 3.0, -view.z) * exp(-length(view.xyz) * .022);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform float uUnderwater, uBlueprint;
      varying float vAlpha;
      void main() {
        float circle = 1.0 - smoothstep(.13, .5, length(gl_PointCoord - .5));
        gl_FragColor = vec4(.62, .87, .87, circle * vAlpha * .34 * uUnderwater * (1.0 - uBlueprint));
      }`,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  group.add(particles);
  geometries.add(particleGeometry);
  materials.add(particleMaterial);

  const shallow = new THREE.Color(0x063d4b);
  const deep = new THREE.Color(0x031724);
  return {
    update(depth, time, blueprint, underwater) {
      shared.uTime.value = time;
      shared.uDepth.value = depth;
      shared.uBlueprint.value = blueprint ? 1 : 0;
      shared.uUnderwater.value = underwater;
      shared.uFog.value.copy(shallow).lerp(deep, Math.min(depth / 40, 1));
      ceiling.visible = underwater > .01;
      labelMaterials.forEach((material) => {
        material.color.set(blueprint ? 0x3d929b : 0x8dc4ca);
      });
    },
    dispose() {
      instances.forEach((mesh) => mesh.dispose());
      scene.remove(group);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
