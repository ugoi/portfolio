import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface MarineLife {
  update: (depth: number, time: number, blueprint: boolean, underwater: number, camera: THREE.Camera) => void;
  dispose: () => void;
}
const smooth = (a: number, b: number, v: number) => {
  const t = THREE.MathUtils.clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const band = (d: number, enter: number, full: number, leave: number, end: number) =>
  smooth(enter, full, d) * (1 - smooth(leave, end, d));
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return v - Math.floor(v);
};

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

/** Encounters follow camera Y; physical depth still determines their light and presence. */
export function createMarineLife(scene: THREE.Scene): MarineLife {
  const root = new THREE.Group();
  root.name = "Ocean life — sunlight to twilight";
  scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const instances: THREE.InstancedMesh[] = [];
  const time = { value: 0 }, depth = { value: 0 }, blueprint = { value: 0 };
  const schoolOpacity = { value: 0 }, rayOpacity = { value: 0 };
  const lanternOpacity = { value: 0 }, jellyOpacity = { value: 0 };
  const dummy = new THREE.Object3D();
  const retain = <T extends THREE.BufferGeometry>(g: T): T => { geometries.add(g); return g; };
  const bodyMaterial = (opacity: { value: number }, mode: number) => {
    const material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
      uniforms: { uTime: time, uDepth: depth, uBlueprint: blueprint, uOpacity: opacity, uMode: { value: mode } },
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
        uniform float uDepth, uBlueprint, uOpacity, uMode;
        varying vec3 vNormal, vWorld, vLocal;
        varying float vPart, vSeed;
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
          float solar = exp(-uDepth * .0031);
          color *= (.38 + .62 * diffuse) * (.28 + .72 * solar);
          color += (vec3(.35, .72, .82) * rim * .34 + vec3(.6, .9, 1.) * flash * .48) * solar;
          if (uMode > 1.5) {
            float dots = pow(max(0., cos(vLocal.x * 26.)), 18.) * exp(-pow((vLocal.y + .16) * 26., 2.));
            color = color * .5 + vec3(.22, .74, .73) * dots * .65 + vec3(.06, .16, .20) * rim;
          }
          color = mix(color, vec3(.22, .65, .7) * (.3 + rim), uBlueprint * .65);
          gl_FragColor = vec4(color, uOpacity * exp(-length(cameraPosition - vWorld) * .010));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    materials.add(material);
    return material;
  };
  const fish = retain(fishGeometry());
  const makeSchool = (count: number, material: THREE.Material) => {
    const geometry = retain(fish.clone());
    geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(
      Float32Array.from({ length: count }, (_, i) => hash(i + count) * Math.PI * 2), 1));
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    instances.push(mesh);
    root.add(mesh);
    return mesh;
  };
  const school = makeSchool(72, bodyMaterial(schoolOpacity, 0));
  const lanterns = makeSchool(35, bodyMaterial(lanternOpacity, 2));
  const ray = new THREE.Group();
  ray.name = "Passing ray";
  root.add(ray);
  const rayMaterial = bodyMaterial(rayOpacity, 1);
  ray.add(new THREE.Mesh(retain(rayGeometry()), rayMaterial));
  const rayDetail = (geometry: THREE.BufferGeometry) => {
    geometry.setAttribute("aPart", new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count), 1));
    ray.add(new THREE.Mesh(retain(geometry), rayMaterial));
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

  const jellyVertex = `
    uniform float uTime, uPhase, uKind;
    varying vec3 vNormal, vWorld, vLocal;
    void main() {
      vec3 p = position;
      float pulse = sin(uTime * 1.6 + uPhase);
      if (uKind < .5) { p.xz *= 1. + pulse * .09; p.y *= 1. - pulse * .12; }
      else {
        float trail = max(0., -p.y);
        p.x += sin(uTime * .8 + uPhase - trail * 1.5) * trail * .075;
        p.z += cos(uTime * .65 + uPhase - trail * 1.2) * trail * .06;
      }
      vec4 world = modelMatrix * vec4(p, 1.);
      vWorld = world.xyz;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vLocal = position;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`;
  const jellies: THREE.Group[] = [];
  const bellGeometry = retain(new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * .54));
  const coreGeometry = retain(new THREE.SphereGeometry(.22, 10, 8));
  for (let i = 0; i < 8; i++) {
    const jelly = new THREE.Group();
    jelly.name = `Drifting jellyfish ${i + 1}`;
    jellies.push(jelly);
    root.add(jelly);
    const phase = hash(i + 130) * Math.PI * 2;
    const jellyMaterial = (kind: number) => {
      const material = new THREE.ShaderMaterial({
        side: THREE.DoubleSide, transparent: true, depthWrite: false,
        uniforms: { uTime: time, uDepth: depth, uOpacity: jellyOpacity, uBlueprint: blueprint,
          uPhase: { value: phase }, uKind: { value: kind } },
        vertexShader: jellyVertex,
        fragmentShader: `
          uniform float uTime, uOpacity, uBlueprint, uPhase, uKind;
          varying vec3 vNormal, vWorld, vLocal;
          void main() {
            vec3 view = normalize(cameraPosition - vWorld);
            float fresnel = pow(1. - abs(dot(normalize(vNormal), view)), 2.);
            float ribs = pow(.5 + .5 * cos(atan(vLocal.z, vLocal.x) * 16.), 18.);
            float edge = exp(-abs(vLocal.y + .08) * 19.);
            float pulse = .7 + .3 * sin(uTime * 1.6 + uPhase);
            vec3 color = mix(vec3(.61, .24, .43), vec3(.27, .57, .68), fresnel * .75 + .12);
            color += vec3(.34, .25, .32) * (ribs * .25 + edge * .45) * pulse;
            float alpha = .08 + fresnel * .36 + ribs * .055 + edge * .23;
            if (uKind > .5) { color = mix(vec3(.58, .40, .58), vec3(.28, .67, .70), fresnel); alpha = .26 + fresnel * .32; }
            if (uKind > 1.5) { color = vec3(.70, .32, .47); alpha = .46; }
            color = mix(color, vec3(.21, .65, .73), uBlueprint * .7);
            gl_FragColor = vec4(color, alpha * uOpacity * exp(-length(cameraPosition - vWorld) * .012));
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      materials.add(material);
      return material;
    };
    const bellMaterial = jellyMaterial(0), tendrilMaterial = jellyMaterial(1), coreMaterial = jellyMaterial(2);
    const bell = new THREE.Mesh(bellGeometry, bellMaterial);
    bell.scale.y = .65;
    jelly.add(bell);
    const cores: THREE.BufferGeometry[] = [];
    for (let lobe = 0; lobe < 4; lobe++) {
      const a = lobe / 4 * Math.PI * 2;
      cores.push(coreGeometry.clone().scale(1, .6, 1).translate(Math.cos(a) * .23, .12, Math.sin(a) * .23));
    }
    const joinedCores = mergeGeometries(cores);
    if (joinedCores) jelly.add(new THREE.Mesh(retain(joinedCores), coreMaterial));
    cores.forEach(g => g.dispose());
    const strands: THREE.BufferGeometry[] = [];
    for (let strand = 0; strand < 16; strand++) {
      const a = strand / 16 * Math.PI * 2, length = 1.7 + hash(strand * 3 + i * 19) * 1.9;
      const points = Array.from({ length: 12 }, (_, j) => {
        const t = j / 11, radius = .84 - t * .3;
        return new THREE.Vector3(Math.cos(a) * radius + Math.sin(t * 9 + a) * t * .12,
          -.06 - t * length, Math.sin(a) * radius + Math.cos(t * 8 + a) * t * .1);
      });
      strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 18, strand % 4 ? .009 : .022, 4, false));
    }
    for (let arm = 0; arm < 4; arm++) {
      const a = arm / 4 * Math.PI * 2;
      const points = Array.from({ length: 14 }, (_, j) => {
        const t = j / 13;
        return new THREE.Vector3(Math.cos(a + t * 5) * (.15 + t * .32), .06 - t * 2,
          Math.sin(a + t * 5) * (.15 + t * .32));
      });
      strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 22, .044, 5, false));
    }
    const joinedStrands = mergeGeometries(strands);
    if (joinedStrands) jelly.add(new THREE.Mesh(retain(joinedStrands), tendrilMaterial));
    strands.forEach(g => g.dispose());
  }

  return {
    update(currentDepth, currentTime, construction, underwater, camera) {
      depth.value = currentDepth;
      time.value = currentTime;
      blueprint.value = construction ? 1 : 0;
      // The town is a separate scene beat; all encounters clear before arrival.
      const immersion = smooth(.05, .75, underwater) * (1 - smooth(850, 940, currentDepth));
      root.visible = immersion > .001;
      if (!root.visible) return;
      root.position.y = camera.position.y;
      const mobile = camera instanceof THREE.PerspectiveCamera && camera.aspect < .85;
      const heroX = mobile ? 3 : 8.3;
      schoolOpacity.value = band(currentDepth, 2, 15, 180, 240) * immersion;
      rayOpacity.value = band(currentDepth, 55, 90, 210, 280) * immersion;
      lanternOpacity.value = band(currentDepth, 510, 610, 860, 940) * immersion;
      jellyOpacity.value = band(currentDepth, 190, 260, 870, 940) * immersion;
      school.visible = schoolOpacity.value > .002;
      ray.visible = rayOpacity.value > .002;
      lanterns.visible = lanternOpacity.value > .002;
      if (school.visible) {
        for (let i = 0; i < school.count; i++) {
          const h = hash(i + 5), flank = i > 50 ? -1 : 1;
          dummy.position.set(heroX * flank + (hash(i + 18) - .5) * (mobile ? 6 : 14)
            + Math.sin(currentTime * .13 + h * 5) * 2.3,
          -2.4 + (hash(i + 63) - .5) * 7 + Math.sin(currentTime * .44 + h * 10) * .26,
          -13 - hash(i + 28) * 17 + Math.sin(currentTime * .16 + h * 8));
          dummy.rotation.set(0, Math.sin(currentTime * .13 + h * 5) * .24 + (flank < 0 ? Math.PI : 0),
            Math.sin(currentTime * .2 + h * 7) * .05);
          dummy.scale.setScalar(.25 + hash(i + 91) * .28);
          dummy.updateMatrix(); school.setMatrixAt(i, dummy.matrix);
        }
        school.instanceMatrix.needsUpdate = true;
      }
      if (ray.visible) {
        ray.position.set(heroX + Math.sin(currentTime * .12) * 1.8, -.9 + Math.sin(currentTime * .3) * .38, -22);
        ray.rotation.set(.15, -.55 + Math.sin(currentTime * .12) * .15, -.10);
        ray.scale.setScalar(mobile ? .75 : 1);
      }
      if (lanterns.visible) {
        for (let i = 0; i < lanterns.count; i++) {
          const h = hash(i + 190);
          dummy.position.set((hash(i + 55) - .5) * (mobile ? 13 : 29) + Math.sin(currentTime * .1 + h * 8) * 1.4,
            -2 + (hash(i + 102) - .5) * 12 + Math.sin(currentTime * .19 + h * 7) * .35, -13 - hash(i + 128) * 23);
          dummy.rotation.set(0, i % 3 ? .2 : Math.PI + .2, Math.sin(h * 4) * .12);
          dummy.scale.setScalar(.22 + hash(i + 211) * .26);
          dummy.updateMatrix(); lanterns.setMatrixAt(i, dummy.matrix);
        }
        lanterns.instanceMatrix.needsUpdate = true;
      }
      jellies.forEach((jelly, i) => {
        jelly.visible = jellyOpacity.value > .002;
        if (!jelly.visible) return;
        const h = hash(i + 331), near = i < 2;
        jelly.position.set(near ? heroX + (i ? 2 : -.5) : (h - .5) * (mobile ? 17 : 33),
          (near ? .4 - i * 4.5 : (hash(i + 412) - .5) * 12) + Math.sin(currentTime * .22 + h * 7) * .6,
          near ? -16 - i * 5 : -22 - hash(i + 309) * 20);
        jelly.rotation.set(Math.sin(currentTime * .14 + h * 8) * .10, h * Math.PI, Math.sin(currentTime * .17 + h * 5) * .12);
        jelly.scale.setScalar(near ? (mobile ? .82 : 1.17) : .55 + hash(i + 444) * .65);
      });
    },
    dispose() {
      root.removeFromParent();
      instances.forEach(mesh => mesh.dispose());
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
  };
}
