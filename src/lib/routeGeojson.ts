import { distanceBetween, FixFeature, LineSegment } from '~/lib/procedureGeojson';
import { isValidCoord } from '~/lib/routeResolver';
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

const EARTH_RADIUS_NM = 3440.065;

/**
 * Interpolate a great-circle path between two lat/lons using slerp on unit
 * vectors. Mapbox renders LineStrings by projecting each vertex to screen
 * coords and connecting them with straight pixel lines, so a 2-point direct
 * leg on a Mercator map appears as a rhumb line — visibly wrong for any
 * leg over a few hundred miles. Returning enough vertices makes the line
 * follow the actual great circle on screen.
 *
 * Step density adapts to distance (≈50 NM per segment, capped at 128 steps)
 * so short legs stay cheap.
 *
 * Longitudes are kept continuous past ±180° if the path crosses the
 * antimeridian — Mapbox wraps them back into view automatically.
 */
const greatCircleCoords = (
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): [number, number][] => {
  const phi1 = (fromLat * Math.PI) / 180;
  const lam1 = (fromLon * Math.PI) / 180;
  const phi2 = (toLat * Math.PI) / 180;
  const lam2 = (toLon * Math.PI) / 180;

  const x1 = Math.cos(phi1) * Math.cos(lam1);
  const y1 = Math.cos(phi1) * Math.sin(lam1);
  const z1 = Math.sin(phi1);

  const x2 = Math.cos(phi2) * Math.cos(lam2);
  const y2 = Math.cos(phi2) * Math.sin(lam2);
  const z2 = Math.sin(phi2);

  const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
  const theta = Math.acos(dot);
  const distNm = theta * EARTH_RADIUS_NM;

  if (theta < 1e-9 || distNm < 1) {
    return [
      [fromLon, fromLat],
      [toLon, toLat],
    ];
  }

  const steps = Math.max(2, Math.min(128, Math.ceil(distNm / 50)));
  const sinTheta = Math.sin(theta);
  const coords: [number, number][] = [];
  let prevLon: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const f = Math.sin((1 - t) * theta) / sinTheta;
    const g = Math.sin(t * theta) / sinTheta;
    const x = f * x1 + g * x2;
    const y = f * y1 + g * y2;
    const z = f * z1 + g * z2;
    const lat = (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI;
    let lon = (Math.atan2(y, x) * 180) / Math.PI;
    // Keep longitudes continuous across the antimeridian.
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    coords.push([lon, lat]);
    prevLon = lon;
  }
  return coords;
};

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
