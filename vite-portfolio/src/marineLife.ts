import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WATER_LEVEL, METRES_PER_UNIT } from "./waterScale.ts";
import { WATER_OPTICS_GLSL } from "./waterOptics.ts";
import { advanceMarineSimulation, createMarineSimulation, marineHash as hash } from "./marinePhysics.ts";

export interface MarineLife {
  update: (depth: number, time: number, blueprint: boolean, underwater: number, camera: THREE.Camera) => void;
  dispose: () => void;
}

// Rounded silver body, a forked tail, folded fins and separate eye surfaces.
// Every anatomical part shares a buffer, so a school needs one draw call.
function fishGeometry() {
  const positions: number[] = [], parts: number[] = [], indices: number[] = [];
  const vertex = (x: number, y: number, z: number, part = 0) => {
    parts.push(part);
    positions.push(x, y, z);
  };
  const rings = 18, sides = 14;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const r = Math.pow(Math.sin(t * Math.PI), .75) * (.7 + t * .3);
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      vertex(-1.03 + t * 2.05, Math.cos(a) * r * .34, Math.sin(a) * r * .21);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j;
    indices.push(a, a + 1, a + sides + 1, a + 1, a + sides + 2, a + sides + 1);
  }
  const fin = (points: [number, number, number][]) => {
    const start = parts.length;
    points.forEach(p => vertex(...p, 1));
    for (let i = 1; i < points.length - 1; i++) indices.push(start, start + i, start + i + 1);
  };
  fin([[-.88, 0, 0], [-1.58, .63, .01], [-1.38, .14, .02], [-1.5, 0, .025], [-1.38, -.14, .02], [-1.58, -.56, .01]]);
  fin([[.45, .24, 0], [-.1, .65, 0], [-.59, .29, 0], [-.7, .12, 0]]);
  fin([[.22, -.12, .18], [-.38, -.42, .47], [-.12, -.2, .18]]);
  fin([[.22, -.12, -.18], [-.38, -.42, -.47], [-.12, -.2, -.18]]);
  fin([[-.26, -.27, 0], [-.72, -.46, 0], [-.67, -.1, 0]]);
  for (const sign of [-1, 1]) {
    const offset = parts.length;
    for (let y = 0; y <= 6; y++) for (let x = 0; x <= 8; x++) {
      const a = y / 6 * Math.PI, b = x / 8 * Math.PI * 2;
      vertex(.64 + Math.sin(a) * Math.cos(b) * .079, .075 + Math.cos(a) * .079,
        sign * .157 + Math.sin(a) * Math.sin(b) * .04, 2);
    }
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) {
      const a = offset + y * 9 + x;
      indices.push(a, a + 9, a + 1, a + 1, a + 9, a + 10);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aPart", new THREE.Float32BufferAttribute(parts, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function rayGeometry() {
  const positions: number[] = [], indices: number[] = [];
  const across = 40, along = 18;
  for (let i = 0; i <= across; i++) {
    const u = i / across * 2 - 1, wing = Math.abs(u);
    const leading = -2.1 * (1 - Math.pow(wing, .7)) + wing * .4;
    const trailing = 2.05 * Math.pow(1 - wing, .65) + wing * .4;
    for (let j = 0; j <= along; j++) {
      const v = j / along;
      positions.push(u * 5.2, Math.sin(v * Math.PI) * .42 * (1 - wing * wing),
        THREE.MathUtils.lerp(leading, trailing, v));
    }
  }
  for (let i = 0; i < across; i++) for (let j = 0; j < along; j++) {
    const a = i * (along + 1) + j;
    indices.push(a, a + 1, a + along + 1, a + 1, a + along + 2, a + along + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aPart", new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3), 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Persistent inhabitants of the sunlit lagoon. The observer never moves them. */
export function createMarineLife(scene: THREE.Scene): MarineLife {
  const root = new THREE.Group();
  root.name = "Persistent lagoon habitats — 6 to 42 metres";
  scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  const time = { value: 0 }, blueprint = { value: 0 };
  const dummy = new THREE.Object3D(), direction = new THREE.Vector3();
  const forward = new THREE.Vector3(1, 0, 0);
  const retain = <T extends THREE.BufferGeometry>(g: T): T => { geometries.add(g); return g; };
  const bodyMaterial = (mode: number) => {
    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: false, depthWrite: true,
      uniforms: { uTime: time, uBlueprint: blueprint, uMode: { value: mode } },
      vertexShader: `
        uniform float uTime, uMode;
        attribute float aPart;
        #ifdef USE_INSTANCING
        attribute float aPhase;
        #endif
        varying vec3 vNormal, vWorld, vLocal;
        varying float vPart, vSeed;
        void main() {
          vec3 p = position;
          float phase = 0.;
          mat4 transform = modelMatrix;
          #ifdef USE_INSTANCING
          phase = aPhase;
          transform = modelMatrix * instanceMatrix;
          #endif
          if (uMode < .5 || uMode > 1.5) {
            float tail = 1. - smoothstep(-1.4, .4, p.x);
            p.z += sin(uTime * (uMode > 1.5 ? 2. : 3.6) + phase - p.x * 2.8) * tail * tail * .23;
          } else {
            p.y += sin(uTime * 1.2 - abs(p.x) * .5) * pow(abs(p.x) / 5.2, 1.5) * 1.1;
          }
          vec4 world = transform * vec4(p, 1.);
          vWorld = world.xyz;
          vLocal = position;
          vNormal = normalize(mat3(transform) * normal);
          vPart = aPart;
          vSeed = phase;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform float uBlueprint, uMode;
        varying vec3 vNormal, vWorld, vLocal;
        varying float vPart, vSeed;
        ${WATER_OPTICS_GLSL}
        void main() {
          vec3 n = normalize(vNormal), view = normalize(cameraPosition - vWorld);
          float rim = pow(1. - abs(dot(n, view)), 2.2);
          float diffuse = .3 + .7 * max(0., dot(n, normalize(vec3(-.4, .9, .7))));
          float flash = pow(max(0., dot(reflect(normalize(vec3(.4, -.9, -.7)), n), view)), 24.);
          vec3 dorsal = mix(vec3(.045, .26, .31), vec3(.10, .29, .49), sin(vSeed) * .5 + .5);
          vec3 color = mix(vec3(.68, .88, .85), dorsal, smoothstep(-.08, .3, vLocal.y));
          float stripe = exp(-pow((vLocal.y - .025) * 23., 2.));
          color = mix(color, vec3(.72, .62, .26), stripe * .36);
          if (vPart > .5) color = mix(vec3(.10, .43, .46), vec3(.59, .77, .55), rim * .6);
          if (vPart > 1.5) color = vec3(.015, .035, .041) + flash * .65;
          if (uMode > .5 && uMode < 1.5) {
            color = mix(vec3(.08, .20, .25), vec3(.22, .40, .43), rim * .7);
            if (!gl_FrontFacing) color = vec3(.47, .65, .64);
            float spots = pow(max(0., sin(vLocal.x * 9.) * sin(vLocal.z * 11.)), 14.);
            color += spots * .07;
          }
          float solar = solarAtDepth(max(0., (${WATER_LEVEL.toFixed(4)} - vWorld.y) * ${METRES_PER_UNIT.toFixed(4)}));
          color *= (.38 + .62 * diffuse) * (.14 + .86 * solar);
          color += (vec3(.35, .72, .82) * rim * .34 + vec3(.6, .9, 1.) * flash * .48) * solar;
          if (uMode > 1.5) {
            float dots = pow(max(0., cos(vLocal.x * 26.)), 18.) * exp(-pow((vLocal.y + .16) * 26., 2.));
            color = color * .5 + vec3(.15, .68, .72) * dots * .85 + vec3(.025, .07, .1) * rim;
          }
          color = mix(color, vec3(.22, .65, .7) * (.3 + rim), uBlueprint * .65);
          // Distance changes radiance through water, never fish transparency.
          gl_FragColor = vec4(underwaterExtinction(color, vWorld, cameraPosition), 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    materials.add(material);
    return material;
  };
  const fish = retain(fishGeometry());
  const simulation = createMarineSimulation();
  const silverMaterial = bodyMaterial(0), lanternMaterial = bodyMaterial(2);
  const schoolMeshes = simulation.schools.map(({ habitat, bodies }) => {
    const geometry = retain(fish.clone());
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(
      Float32Array.from(bodies.map(body => body.phase)), 1));
    const mesh = new THREE.InstancedMesh(geometry, habitat.kind === 'silver' ? silverMaterial : lanternMaterial, bodies.length);
    mesh.name = `${habitat.kind} school at ${Math.round((WATER_LEVEL - habitat.centre.y) * METRES_PER_UNIT)} m`;
    mesh.position.set(habitat.centre.x, habitat.centre.y, habitat.centre.z);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Conservative fixed bounds include all soft-wall habitats and tail motion.
    // Three's frustum decides drawing; neither scroll nor depth gates presence.
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 55);
    instances.push(mesh);
    root.add(mesh);
    return mesh;
  });

  const rayGeometryMain = retain(rayGeometry());
  rayGeometryMain.computeBoundingSphere();
  if (rayGeometryMain.boundingSphere) rayGeometryMain.boundingSphere.radius += 1.2;
  const rayMaterial = bodyMaterial(1);
  const rayDetails: THREE.BufferGeometry[] = [];
  const rayDetail = (geometry: THREE.BufferGeometry) => {
    geometry.setAttribute("aPart", new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count), 1));
    rayDetails.push(retain(geometry));
  };
  rayDetail(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, .08, 1.4), new THREE.Vector3(.1, -.07, 3.1),
    new THREE.Vector3(.4, -.17, 5), new THREE.Vector3(.8, -.3, 6.1),
  ]), 22, .035, 5, false));
  for (const sign of [-1, 1]) {
    rayDetail(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(sign * .52, .09, -1.2), new THREE.Vector3(sign * .62, .12, -2.1),
      new THREE.Vector3(sign * .7, .26, -2.6), new THREE.Vector3(sign * .88, .31, -2.45),
    ]), 12, .12, 7, false));
  }
  const rays = [12, 23, 34].map((metres, i) => {
    const ray = new THREE.Group();
    ray.name = `Ray habitat at ${metres} m`;
    ray.add(new THREE.Mesh(rayGeometryMain, rayMaterial));
    rayDetails.forEach(geometry => ray.add(new THREE.Mesh(geometry, rayMaterial)));
    ray.scale.setScalar(i === 2 ? .8 : 1.15);
    root.add(ray);
    return { ray, centre: new THREE.Vector3(i % 2 ? -9 : 9, WATER_LEVEL - metres / METRES_PER_UNIT, -24), phase: i * 2.7 };
  });

  const jellyVertex = `
    uniform float uTime, uKind;
    attribute float aPhase;
    varying vec3 vNormal, vWorld, vLocal;
    varying float vPhase;
    void main() {
      vec3 p = position;
      float pulse = sin(uTime * 1.6 + aPhase);
      if (uKind < .5) { p.xz *= 1. + pulse * .09; p.y *= 1. - pulse * .12; }
      else {
        float trail = max(0., -p.y);
        p.x += sin(uTime * .8 + aPhase - trail * 1.5) * trail * .075;
        p.z += cos(uTime * .65 + aPhase - trail * 1.2) * trail * .06;
      }
      mat4 transform = modelMatrix * instanceMatrix;
      vec4 world = transform * vec4(p, 1.);
      vWorld = world.xyz;
      vNormal = normalize(mat3(transform) * normal);
      vLocal = position;
      vPhase = aPhase;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`;
  const jellyMaterial = (kind: number) => {
    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
      uniforms: { uTime: time, uBlueprint: blueprint, uKind: { value: kind } },
      vertexShader: jellyVertex,
      fragmentShader: `
        uniform float uTime, uBlueprint, uKind;
        varying vec3 vNormal, vWorld, vLocal;
        varying float vPhase;
        ${WATER_OPTICS_GLSL}
        void main() {
          vec3 view = normalize(cameraPosition - vWorld);
          float fresnel = pow(1. - abs(dot(normalize(vNormal), view)), 2.);
          float ribs = pow(.5 + .5 * cos(atan(vLocal.z, vLocal.x) * 16.), 18.);
          float edge = exp(-abs(vLocal.y + .05) * 19.);
          float pulse = .7 + .3 * sin(uTime * 1.6 + vPhase);
          vec3 color = mix(vec3(.27, .48, .56), vec3(.17, .58, .68), fresnel * .75 + .12);
          color += vec3(.1, .34, .39) * (ribs * .25 + edge * .45) * pulse;
          float alpha = .08 + fresnel * .36 + ribs * .055 + edge * .23;
          if (uKind > .5) { color = mix(vec3(.19, .41, .52), vec3(.18, .62, .67), fresnel); alpha = .26 + fresnel * .32; }
          if (uKind > 1.5) { color = vec3(.29, .61, .66) * pulse; alpha = .46; }
          color = mix(color, vec3(.21, .65, .73), uBlueprint * .7);
          gl_FragColor = vec4(underwaterExtinction(color, vWorld, cameraPosition), alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    materials.add(material);
    return material;
  };
  const bellGeometry = retain(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * .54).scale(1, .65, 1));
  const cores: THREE.BufferGeometry[] = [];
  for (let lobe = 0; lobe < 4; lobe++) {
    const a = lobe / 4 * Math.PI * 2;
    cores.push(new THREE.SphereGeometry(.22, 8, 6).scale(1, .6, 1).translate(Math.cos(a) * .23, .12, Math.sin(a) * .23));
  }
  const coreGeometry = retain(mergeGeometries(cores)!);
  cores.forEach(geometry => geometry.dispose());
  const strands: THREE.BufferGeometry[] = [];
  for (let strand = 0; strand < 12; strand++) {
    const a = strand / 12 * Math.PI * 2, length = 1.7 + hash(strand * 3) * 1.9;
    const points = Array.from({ length: 10 }, (_, j) => {
      const t = j / 9, radius = .84 - t * .3;
      return new THREE.Vector3(Math.cos(a) * radius + Math.sin(t * 9 + a) * t * .12,
        -.06 - t * length, Math.sin(a) * radius + Math.cos(t * 8 + a) * t * .1);
    });
    strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 14, strand % 4 ? .012 : .027, 4, false));
  }
  for (let arm = 0; arm < 4; arm++) {
    const a = arm / 4 * Math.PI * 2;
    const points = Array.from({ length: 10 }, (_, j) => {
      const t = j / 9;
      return new THREE.Vector3(Math.cos(a + t * 5) * (.15 + t * .32), .06 - t * 2,
        Math.sin(a + t * 5) * (.15 + t * .32));
    });
    strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, .047, 4, false));
  }
  const strandGeometry = retain(mergeGeometries(strands)!);
  strands.forEach(geometry => geometry.dispose());
  const jellyGeometries = [bellGeometry, strandGeometry, coreGeometry];
  const jellyMaterials = [jellyMaterial(0), jellyMaterial(1), jellyMaterial(2)];
  jellyGeometries.forEach(geometry => geometry.setAttribute('aPhase',
    new THREE.InstancedBufferAttribute(new Float32Array([.4, 2.7, 5.1]), 1)));
  const jellies = Array.from({ length: 4 }, (_, i) => {
    const metres = 14 + i * 8;
    const centre = new THREE.Vector3(Math.sin(i * 2.7) * 8, WATER_LEVEL - metres / METRES_PER_UNIT, -21 - hash(i) * 8);
    const meshes = jellyGeometries.map((geometry, part) => {
      const mesh = new THREE.InstancedMesh(geometry, jellyMaterials[part], 3);
      mesh.name = `Jellyfish ${part} at ${metres} m`;
      mesh.position.copy(centre);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 29);
      instances.push(mesh);
      root.add(mesh);
      return mesh;
    });
    return { meshes, phase: i * .71 };
  });

  const place = (currentTime: number) => {
    advanceMarineSimulation(simulation, currentTime);
    simulation.schools.forEach(({ habitat, bodies }, schoolIndex) => {
      const mesh = schoolMeshes[schoolIndex];
      bodies.forEach((body, i) => {
        dummy.position.set(body.position.x - habitat.centre.x, body.position.y - habitat.centre.y, body.position.z - habitat.centre.z);
        direction.set(body.velocity.x, body.velocity.y, body.velocity.z).normalize();
        dummy.quaternion.setFromUnitVectors(forward, direction);
        dummy.scale.setScalar(body.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
    rays.forEach(({ ray, centre, phase }) => {
      const angle = currentTime * .085 + phase;
      ray.position.set(centre.x + Math.sin(angle) * 7, centre.y + Math.sin(currentTime * .13 + phase) * 3, centre.z + Math.cos(angle) * 7);
      ray.rotation.set(.08 * Math.sin(angle), angle - Math.PI / 2, -.06 * Math.cos(angle));
    });
    jellies.forEach(({ meshes, phase }) => {
      for (let i = 0; i < 3; i++) {
        const angle = phase + i * 2.4;
        dummy.position.set(Math.sin(angle) * 7 + Math.sin(currentTime * .075 + angle) * 2,
          (i - 1) * 9 + Math.sin(currentTime * .19 + angle) * 2.3,
          Math.cos(angle) * 6 + Math.cos(currentTime * .065 + angle) * 1.7);
        dummy.rotation.set(Math.sin(currentTime * .14 + angle) * .08, angle, Math.sin(currentTime * .17 + angle) * .1);
        dummy.scale.setScalar(.85 + hash(i * 33 + phase) * .65);
        dummy.updateMatrix();
        meshes.forEach(mesh => mesh.setMatrixAt(i, dummy.matrix));
      }
      meshes.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; });
    });
  };
  place(0);
  return {
    update(_currentDepth, currentTime, construction) {
      time.value = currentTime;
      blueprint.value = construction ? 1 : 0;
      place(currentTime);
    },
    dispose() {
      root.removeFromParent();
      instances.forEach(mesh => mesh.dispose());
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}
