import { LegType } from '~/lib/types';

export const EARTH_RADIUS_NM = 3440.065;

export const MANUAL_ARROW_DISTANCE_NM = 5;
export const ARC_THRESHOLD_DEG = 60;
export const ARC_DISTANCE_NM = MANUAL_ARROW_DISTANCE_NM / 2;
export const ARC_STEPS = 12;

export const ARROW_LEGTYPES: LegType[] = [
  'HeadingToManual',
  'CourseToManual',
  'FromFixToManual',
  'ManualTermination',
];

// (0, 0) is the navdata API's "coordinates unknown" sentinel — Greenwich/Equator
// is never a real navaid. Treat it as missing rather than rendering to it.
export const isValidCoord = (
  lat: number | null | undefined,
  lon: number | null | undefined,
): boolean =>
  lat != null &&
  lon != null &&
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  !(lat === 0 && lon === 0);

export const coordPair = (
  p: { latitude: number | null | undefined; longitude: number | null | undefined },
): { lat: number; lon: number } | null => {
  if (!isValidCoord(p.latitude, p.longitude)) return null;
  return { lat: p.latitude as number, lon: p.longitude as number };
};

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

// destinationPoint/bearingBetween work in true (geographic) bearings; navdata
// emits magnetic bearings. variation > 0 = easterly.
export const toTrue = (magneticDeg: number, correction: number): number =>
  (magneticDeg + correction + 360) % 360;

export const angleDifference = (a: number, b: number): number =>
  Math.abs(((b - a + 540) % 360) - 180);

export const interpolateBearing = (from: number, to: number, t: number): number => {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
};

// Parse a SID/STAR runway-transition designator (e.g. "RW28R") into a magnetic
// heading in degrees. Returns null for non-runway transitions.
export const runwayHeading = (transition?: string | null): number | null => {
  if (!transition) return null;
  const m = transition.match(/^RW(\d{1,2})/);
  if (!m) return null;
  return (parseInt(m[1], 10) * 10) % 360;
};

// Both heading inputs must share a domain (both true OR both magnetic).
export const generateArcPoints = (
  start: { latitude: number; longitude: number },
  rwyHeading: number,
  courseHeading: number,
  arcDist: number = ARC_DISTANCE_NM,
): { coords: [number, number][]; end: { latitude: number; longitude: number } } => {
  const stepDist = arcDist / ARC_STEPS;
  const coords: [number, number][] = [];
  let pos = start;
  for (let i = 1; i <= ARC_STEPS; i++) {
    const t = i / ARC_STEPS;
    const bearing = interpolateBearing(rwyHeading, courseHeading, t);
    pos = destinationPoint(pos.latitude, pos.longitude, bearing, stepDist);
    coords.push([pos.longitude, pos.latitude]);
  }
  return { coords, end: pos };
};

export interface ManualLegTip {
  prev: { latitude: number; longitude: number };
  tip: { latitude: number; longitude: number };
  arc: { coords: [number, number][]; end: { latitude: number; longitude: number } } | null;
  courseTrue: number;
}

// Single source of truth for manual-termination (vector) leg tip math, shared
// by procedure renderer and route resolver. When the leg is the FIRST off a
// runway origin, pass the threshold as `prev` AND the runway transition (e.g.
// "RW28R") so arc-smoothing kicks in for steep departure courses.
export const manualLegTip = (
  prev: { latitude: number; longitude: number },
  courseMag: number,
  magneticCorrection: number,
  runwayTransition: string | null,
): ManualLegTip => {
  const courseTrue = toTrue(courseMag, magneticCorrection);
  const rwyHdgMag = runwayTransition ? runwayHeading(runwayTransition) : null;
  // Magnetic-vs-magnetic: the constant correction cancels in angleDifference.
  const needsArc =
    rwyHdgMag !== null && angleDifference(rwyHdgMag, courseMag) > ARC_THRESHOLD_DEG;

  let arc: ManualLegTip['arc'] = null;
  let straightStart = prev;
  if (needsArc) {
    arc = generateArcPoints(prev, toTrue(rwyHdgMag!, magneticCorrection), courseTrue);
    straightStart = arc.end;
  }
  const straightDist = needsArc
    ? MANUAL_ARROW_DISTANCE_NM - ARC_DISTANCE_NM
    : MANUAL_ARROW_DISTANCE_NM;
  const tip = destinationPoint(
    straightStart.latitude,
    straightStart.longitude,
    courseTrue,
    straightDist,
  );
  return { prev, tip, arc, courseTrue };
};

// Mapbox draws LineStrings as straight pixel lines between projected vertices,
// so a 2-point direct over hundreds of miles renders as a rhumb line. Returning
// densely-sampled great-circle vertices makes it follow the actual sphere.
// Antimeridian: longitudes are kept continuous past ±180°; Mapbox wraps them.
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
    if (prevLon !== null) {
      while (lon - prevLon > 180) lon -= 360;
      while (lon - prevLon < -180) lon += 360;
    }
    coords.push([lon, lat]);
    prevLon = lon;
  }
  return coords;
};

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
