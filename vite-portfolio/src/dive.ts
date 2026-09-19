import { WATER_LEVEL, METRES_PER_UNIT } from "./waterScale.ts";

export const MAX_DIVE_DEPTH = 40;

// Use the actual sticky viewport height: mobile browser chrome can change
// innerHeight while the stable (svh) scene and the document stay the same size.
export function depthAtScroll(
  scrollY: number,
  journeyTop: number,
  journeyHeight: number,
  viewportHeight: number,
): number {
  const travel = journeyHeight - viewportHeight;
  if (travel <= 0) return 0;
  return Math.min(1, Math.max(0, (scrollY - journeyTop) / travel)) * MAX_DIVE_DEPTH;
}

// Scroll first approaches the water from above. The readout reports actual
// immersion below the mean surface, rather than counting this approach as depth.
export function cameraAtDive(value: number, mobile: boolean) {
  const targetDepth = Math.min(MAX_DIVE_DEPTH, Math.max(0, value));
  const fraction = Math.min(1, targetDepth / 0.8);
  const enter = fraction * fraction * (3 - 2 * fraction);
  const surfaceY = mobile ? 3.8 : 3.2;
  const y = surfaceY + (WATER_LEVEL - targetDepth / METRES_PER_UNIT - surfaceY) * enter;
  return { y, depth: Math.max(0, (WATER_LEVEL - y) * METRES_PER_UNIT) };
}
