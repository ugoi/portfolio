import * as THREE from "three";
import { METRES_PER_UNIT, WATER_LEVEL, WAVE_GLSL, WAVE_GLSL_CALLS } from "./waves";

// The buoy and the pool use the same world scale: four scene units per metre.
// The camera can reach 40 m with enough space left above the tiled floor.
const RADIUS = 22;
const FLOOR_DEPTH = 40.9;
const HEIGHT = FLOOR_DEPTH / METRES_PER_UNIT;

export interface DiveWorld {
  update: (depth: number, time: number, blueprint: boolean, underwater: number) => void;
  dispose: () => void;
}

export function createDiveWorld(scene: THREE.Scene): DiveWorld {
  const group = new THREE.Group();
  group.name = "Deep diving pool";
  scene.add(group);
  const textures: THREE.Texture[] = [];
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
      uniform vec3 uFog;
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
        vec3 tile = mix(vec3(.21, .48, .48), vec3(.30, .57, .56), variation * .6);
        // Dark ceramic bands are built into the wall at each five-metre level.
        float band = 1.0 - smoothstep(.11, .15, abs(mod(depth + .15, 5.0) - .15));
        float verticalStripe = 1.0 - smoothstep(.028, .055, abs(sin(angle * 2.0)));
        tile = mix(tile, vec3(.028, .12, .18), max(band * .88, verticalStripe * .58) * (1.0 - uFloor));
        tile = mix(tile, tile * .47, grout * .6);
        // Intersecting refracted wave patterns, strongest near the surface.
        vec2 p = surface * .46;
        float caustic = causticLight(p);
        float sunlight = exp(-depth * .073);
        // A row of inset pool lights gives the deep section readable scale.
        float lampDepth = mod(depth - 2.5 + 5.0, 10.0) - 5.0;
        float lampAngle = mod(angle + .28 + 1.0472, 2.0944) - 1.0472;
        float lampGlow = exp(-lampDepth * lampDepth * .38 - lampAngle * lampAngle * 11.0);
        float sideLight = .5 + .5 * max(0.0, cos(angle + .55));
        float broadShimmer = .88 + .12 * sin(surface.x * .16 + sin(surface.y * .11) + uTime * .09);
        vec3 illumination = vec3(.18, .30, .37)
          + vec3(.63, .70, .61) * sunlight * sideLight * broadShimmer;
        vec3 color = tile * illumination;
        color += vec3(.28, .45, .35) * caustic * sunlight * .6;
        color += vec3(.08, .31, .38) * lampGlow * .7;
        float distanceToEye = length(cameraPosition - vWorld);
        vec3 absorption = exp(-distanceToEye * vec3(.038, .014, .009));
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
    color: 0x557985, roughness: .48, metalness: .12,
  });
  const rim = add(new THREE.TorusGeometry(RADIUS - .12, .19, 8, 128), rimMaterial);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = WATER_LEVEL + .36;
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0x496369, roughness: .8 });
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

  const fixtureMaterial = new THREE.MeshBasicMaterial({ color: 0x183c48 });
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xb7f0ef });
  for (let metres = 2.5; metres < 40; metres += 10) {
    for (let index = 0; index < 3; index++) {
      const angle = index * Math.PI * 2 / 3 - .28;
      const fixture = add(new THREE.BoxGeometry(.72, .26, .16), fixtureMaterial);
      fixture.position.set(Math.sin(angle) * (RADIUS - .16), WATER_LEVEL - metres / METRES_PER_UNIT, -Math.cos(angle) * (RADIUS - .16));
      fixture.rotation.y = -angle;
      const light = add(new THREE.PlaneGeometry(.52, .10), lightMaterial);
      light.position.copy(fixture.position).add(new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(.1));
      light.rotation.y = -angle;
    }
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
      uniform float uTime, uBlueprint;
      varying vec3 vWorld, vNormal;
      void main() {
        if (length(vWorld.xz) > ${RADIUS.toFixed(1)}) discard;
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 normal = normalize(vNormal + vec3(sin(vWorld.z * 6.0 + uTime) * .028, 0., cos(vWorld.x * 7.2 - uTime) * .03));
        float facing = abs(dot(view, normal));
        float window = smoothstep(.60, .76, facing);
        vec2 refracted = vWorld.xz + normal.xz * 3.0;
        float panes = smoothstep(.12, .2, abs(sin(refracted.x * .26)))
          * smoothstep(.1, .17, abs(sin(refracted.y * .22)));
        vec3 daylight = mix(vec3(.11, .30, .35), vec3(.48, .77, .78), panes);
        vec3 color = mix(vec3(.035, .19, .25), daylight, window);
        color += pow(max(0.0, sin(refracted.x * 2.4) * cos(refracted.y * 2.1)), 12.0) * .12;
        float distanceToEye = length(cameraPosition - vWorld);
        color *= exp(-distanceToEye * vec3(.034, .015, .009));
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
        float shimmer = .8 + .2 * sin(uTime * .4 + vUv.y * 12.0);
        float nearFade = smoothstep(.4, 3.0, distance(cameraPosition, vWorld));
        gl_FragColor = vec4(.24, .68, .76, stripe * falloff * shimmer * nearFade * .055 * uUnderwater * (1.0 - uBlueprint));
      }`,
  });
  for (let index = 0; index < 5; index++) {
    const ray = add(new THREE.PlaneGeometry(2.4 + index * .6, 90), rayMaterial);
    ray.position.set(-12 + index * 5, WATER_LEVEL - 43, -8 + index * 1.8);
    ray.rotation.z = -.12;
    ray.rotation.y = .35;
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
      scene.remove(group);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
