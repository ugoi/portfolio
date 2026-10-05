import { Float32BufferAttribute, PlaneGeometry } from "three";

// One continuous surface, with detail concentrated around the visitor and buoy.
// Beyond 24 units the cells widen smoothly; there is no second, lower water plane.
export function createOceanGeometry() {
  const segments = 256;
  const geometry = new PlaneGeometry(2, 2, segments, segments);
  const positions = geometry.attributes.position;
  const spacing = new Float32Array(positions.count);
  function coordinate(t: number) {
    const step = Math.abs(t) * segments / 2;
    const outer = Math.max(0, step - 64);
    return Math.sign(t) * (step * .375 + 452 * (outer / 64) ** 3);
  }
  function cellWidth(t: number) {
    const outer = Math.max(0, Math.abs(t) * segments / 2 - 64);
    return .375 + 3 * 452 / 64 * (outer / 64) ** 2;
  }
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i);
    spacing[i] = Math.max(cellWidth(x), cellWidth(y));
    positions.setXY(i, coordinate(x), coordinate(y));
  }
  geometry.setAttribute("aCellWidth", new Float32BufferAttribute(spacing, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
