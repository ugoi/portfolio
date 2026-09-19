import * as THREE from "three";
import { WATER_LEVEL, METRES_PER_UNIT } from "./waterScale.ts";

// One water volume, including the town. Values are linear-light colours.
// Absorption and suspended-particle scattering depend on the optical path,
// never on a chapter, a species or proximity to the destination.
export function oceanFogColor(depth: number, target = new THREE.Color()) {
  const sunlight = Math.exp(-Math.max(0, depth) * .006);
  return target.setRGB(
    .003 + .004 * sunlight,
    .011 + .064 * sunlight,
    .025 + .080 * sunlight,
  );
}

export const WATER_OPTICS_GLSL = `
  float solarAtDepth(float metres) {
    return exp(-max(0., metres) * .025);
  }
  vec3 waterFogColor(float metres) {
    return mix(vec3(.003, .011, .025), vec3(.007, .075, .105), exp(-max(0., metres) * .006));
  }
  vec3 underwaterExtinction(vec3 litColor, vec3 world, vec3 eye) {
    float distanceM = length(eye - world) * ${METRES_PER_UNIT};
    float eyeDepth = max(0., (${WATER_LEVEL} - eye.y) * ${METRES_PER_UNIT});
    vec3 absorption = exp(-distanceM * vec3(.07, .023, .012));
    float scattering = 1. - exp(-distanceM * .04);
    return mix(litColor * absorption, waterFogColor(eyeDepth), scattering);
  }
`;
