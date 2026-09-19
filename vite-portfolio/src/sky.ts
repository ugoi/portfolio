import * as THREE from "three";
import { SKY_GLSL, SUN_DIRECTION } from "./lighting";

export function createSky(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const sunDirection = new THREE.Vector3(...SUN_DIRECTION).normalize();
  const geometry = new THREE.SphereGeometry(250, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uSunDirection: { value: sunDirection } },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        // cameraPosition also follows Reflector's mirrored camera, so the
        // solar reflection retains the exact same world-space direction.
        vDirection = world.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      varying vec3 vDirection;
      ${SKY_GLSL}
      void main() {
        gl_FragColor = vec4(daylightSky(vDirection), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Open sky and afternoon sun";
  mesh.renderOrder = -1000;
  mesh.frustumCulled = false;
  // Generate the buoy's environmental lighting from the very same sky, once.
  const environmentScene = new THREE.Scene();
  environmentScene.add(mesh);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, .035, .1, 300);
  pmrem.dispose();
  scene.add(mesh);
  scene.environment = environment.texture;
  return {
    update(camera: THREE.Camera, underwater: number) {
      mesh.position.copy(camera.position);
      mesh.visible = underwater < .01;
    },
    dispose() {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      environment.dispose();
    },
  };
}
