import {
  distanceBetween,
  FixFeature,
  greatCircleCoords,
  isValidCoord,
  LineSegment,
} from '~/lib/mapGeometry';
import { Route, RouteFix } from '~/lib/routeTypes';

/**
 * Total great-circle nautical miles across every segment of the route.
 * Direct legs use a single from→to haversine; airway legs sum the haversine
 * between consecutive fixes (close enough — airway hops are short).
 */
export const routeTotalNm = (route: Route): number => {
  let total = 0;
  for (const seg of route.segments) {
    if (seg.kind === 'direct') {
      if (!isValidCoord(seg.from.lat, seg.from.lon)) continue;
      if (!isValidCoord(seg.to.lat, seg.to.lon)) continue;
      total += distanceBetween(seg.from.lat, seg.from.lon, seg.to.lat, seg.to.lon);
    } else {
      const fixes = seg.fixes.filter((f) => isValidCoord(f.lat, f.lon));
      for (let i = 1; i < fixes.length; i++) {
        const a = fixes[i - 1];
        const b = fixes[i];
        total += distanceBetween(a.lat, a.lon, b.lat, b.lon);
      }
    }
  }
  return total;
};

export interface RouteGeometry {
  lineSegments: LineSegment[];
  fixFeatures: FixFeature[];
}

export const buildRouteGeometry = (route: Route): RouteGeometry => {
  const lineSegments: LineSegment[] = [];
  const fixById = new Map<string, RouteFix>();
  // SID exit / STAR entry fixes are already labeled by the procedure renderer
  // (the SID/STAR sequences pushed into displayedProcedures cover them).
  // Excluding them here avoids double-labeling at the same coordinate.
  const excludeIds = new Set<string>();
  if (route.sidExitFix) excludeIds.add(route.sidExitFix.identifier);
  if (route.starEntryFix) excludeIds.add(route.starEntryFix.identifier);

  const addFix = (f: RouteFix) => {
    if (!isValidCoord(f.lat, f.lon)) return;
    if (excludeIds.has(f.identifier)) return;
    const existing = fixById.get(f.identifier);
    if (!existing) {
      fixById.set(f.identifier, f);
      return;
    }
    const existingLabelLen = (existing.label ?? existing.identifier).length;
    const newLabelLen = (f.label ?? f.identifier).length;
    if (newLabelLen > existingLabelLen) fixById.set(f.identifier, f);
  };

  for (const segment of route.segments) {
    if (segment.kind === 'direct') {
      // Drop the segment entirely if either endpoint has missing/sentinel
      // coords — better to skip than to draw a line through (0, 0).
      if (!isValidCoord(segment.from.lat, segment.from.lon)) continue;
      if (!isValidCoord(segment.to.lat, segment.to.lon)) continue;
      lineSegments.push({
        coords: greatCircleCoords(segment.from.lat, segment.from.lon, segment.to.lat, segment.to.lon),
        dashed: segment.dashed === true,
      });
      addFix(segment.from);
      addFix(segment.to);
    } else {
      // Airway hops are typically short and densely sampled by intermediate
      // fixes already, so straight segments between consecutive fixes are a
      // close-enough approximation to the great-circle path.
      const validFixes = segment.fixes.filter((f) => isValidCoord(f.lat, f.lon));
      if (validFixes.length < 2) continue;
      lineSegments.push({
        coords: validFixes.map((f) => [f.lon, f.lat] as [number, number]),
        dashed: false,
      });
      for (const f of validFixes) addFix(f);
    }
  }

  const fixFeatures: FixFeature[] = Array.from(fixById.values()).map((f) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [f.lon, f.lat] },
    properties: { text: f.label ?? f.identifier, identifier: f.identifier },
  }));

  return { lineSegments, fixFeatures };
};
