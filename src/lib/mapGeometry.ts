// Shared geometry primitives used by both the Procedures and Routes pipelines.
// The split is: this file owns the math + the GeoJSON feature shapes; pipeline-
// specific renderers (procedureGeojson, routeGeojson) own the higher-level
// "build me geometry from a Procedure / Route" functions.

import { LegType } from '~/lib/types';

export const EARTH_RADIUS_NM = 3440.065;

export const MANUAL_ARROW_DISTANCE_NM = 5;

export const ARROW_LEGTYPES: LegType[] = [
  'HeadingToManual',
  'CourseToManual',
  'FromFixToManual',
  'ManualTermination',
];

///////////////////////////////////////////////////
// Coord validity
///////////////////////////////////////////////////
// A fix with both lat and lon equal to zero is the navdata API's sentinel for
// "coordinates unknown" — those points sit on the equator at Greenwich, which
// is never where a real navaid lives in this dataset. Treat such results as
// missing rather than rendering a line to (0, 0).
export const isValidCoord = (
  lat: number | null | undefined,
  lon: number | null | undefined,
): boolean =>
  lat != null &&
  lon != null &&
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  !(lat === 0 && lon === 0);

///////////////////////////////////////////////////
// Spherical math
///////////////////////////////////////////////////

export const destinationPoint = (
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceNM: number,
) => {
  const angular = distanceNM / EARTH_RADIUS_NM;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
};

export const bearingBetween = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

export const distanceBetween = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Magnetic→true conversion. The geometry layer (destinationPoint, bearingBetween)
// works against geographic north, so any magnetic-domain input (point.course
// from the API, runway-designator-derived headings) must be converted before
// being plotted. variation > 0 = easterly.
export const toTrue = (magneticDeg: number, correction: number): number =>
  (magneticDeg + correction + 360) % 360;

export const angleDifference = (a: number, b: number): number =>
  Math.abs(((b - a + 540) % 360) - 180);

export const interpolateBearing = (from: number, to: number, t: number): number => {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
};

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
export const greatCircleCoords = (
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

///////////////////////////////////////////////////
// GeoJSON feature shapes
///////////////////////////////////////////////////

export interface FixFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { text: string; identifier: string };
}

export interface ArrowFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  properties: Record<string, never>;
}

export interface LineSegment {
  coords: [number, number][];
  dashed: boolean;
}

export interface LineFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  properties: { dashed: boolean };
}

export interface SequenceGeometry {
  lineSegments: LineSegment[];
  fixFeatures: FixFeature[];
  arrowFeatures: ArrowFeature[];
}

export const lineSegmentsToFeatures = (segments: LineSegment[]): LineFeature[] =>
  segments.map((seg) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: seg.coords },
    properties: { dashed: seg.dashed },
  }));
