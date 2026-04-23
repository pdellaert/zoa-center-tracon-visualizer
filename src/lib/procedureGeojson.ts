import { FixDescription, LegType, Point, Procedure, ProcedureKind, Sequence } from '~/lib/types';

const SID_SKIP_LEGTYPES: LegType[] = ['HeadingToAltitude', 'CourseToAltitude'];
const ARROW_LEGTYPES: LegType[] = [
  'HeadingToManual',
  'CourseToManual',
  'FromFixToManual',
  'ManualTermination',
];
const MISSED_APPROACH_STOPPERS: FixDescription[] = ['MissedApproach', 'MissedApproachFirstLeg'];

const MANUAL_ARROW_DISTANCE_NM = 5;
const ARROW_WING_LENGTH_NM = 0.6;
const ARROW_WING_ANGLE_DEG = 30;
const EARTH_RADIUS_NM = 3440.065;
const ARC_THRESHOLD_DEG = 60;
const ARC_DISTANCE_NM = MANUAL_ARROW_DISTANCE_NM / 2;
const ARC_STEPS = 12;

export const makeAltitudesString = (minAlt?: string | null, maxAlt?: string | null) => {
  if (minAlt && maxAlt) {
    if (minAlt === maxAlt) return `\n${minAlt}`;
    return `\n${maxAlt}\n${minAlt}`;
  }
  if (minAlt) return `\nAoA ${minAlt}`;
  if (maxAlt) return `\nAoB ${maxAlt}`;
  return '';
};

const appLabelSuffix = (descriptions: FixDescription[]): string => {
  if (descriptions.includes('InitialApproach')) return ' (IAF)';
  if (descriptions.includes('IntermediateApproach')) return ' (IF)';
  if (descriptions.includes('FinalApproach')) return ' (FAF)';
  return '';
};

export const formatFixLabel = (point: Point, kind: ProcedureKind): string => {
  const base = point.identifier ?? '';
  const suffix = kind === 'app' ? appLabelSuffix(point.descriptions) : '';
  return `${base}${suffix}${makeAltitudesString(point.minAltitude, point.maxAltitude)}`;
};

const hasCoords = (p: Point): p is Point & { latitude: number; longitude: number } =>
  p.latitude != null && p.longitude != null;

const isMissedApproachBoundary = (point: Point): boolean =>
  point.descriptions.some((d) => MISSED_APPROACH_STOPPERS.includes(d));

const isRunwayThreshold = (point: Point): boolean => point.descriptions.includes('RunwayHelipad');

const destinationPoint = (lat: number, lon: number, bearingDeg: number, distanceNM: number) => {
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

const bearingBetween = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const distanceBetween = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const runwayHeading = (transition?: string): number | null => {
  if (!transition) return null;
  const m = transition.match(/^RW(\d{1,2})/);
  if (!m) return null;
  return (parseInt(m[1], 10) * 10) % 360;
};

const angleDifference = (a: number, b: number): number =>
  Math.abs(((b - a + 540) % 360) - 180);

const interpolateBearing = (from: number, to: number, t: number): number => {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
};

/**
 * Generate arc points that smoothly transition from rwyHeading to courseHeading
 * over ARC_DISTANCE_NM, starting at the given position. Returns the arc coords
 * (excluding the start, which is already in lineCoords) and the final position.
 */
const generateArcPoints = (
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

const flushSegment = (
  segments: LineSegment[],
  coords: [number, number][],
  dashed: boolean,
): void => {
  if (coords.length >= 2) segments.push({ coords: [...coords], dashed });
};

export const buildSequenceGeometry = (sequence: Sequence, kind: ProcedureKind): SequenceGeometry => {
  const lineSegments: LineSegment[] = [];
  const fixFeatures: FixFeature[] = [];
  const arrowFeatures: ArrowFeature[] = [];

  let currentCoords: [number, number][] = [];
  let previous: { latitude: number; longitude: number } | null = null;
  let dashOrigin: [number, number] | null = null;
  let isAtRunwayOrigin = false;

  if (kind === 'sid' && sequence.runwayOrigin) {
    currentCoords.push([sequence.runwayOrigin.longitude, sequence.runwayOrigin.latitude]);
    previous = {
      latitude: sequence.runwayOrigin.latitude,
      longitude: sequence.runwayOrigin.longitude,
    };
    isAtRunwayOrigin = true;
  }

  for (const point of sequence.points) {
    if (kind === 'app' && isMissedApproachBoundary(point)) {
      if (isRunwayThreshold(point) && hasCoords(point)) {
        currentCoords.push([point.longitude, point.latitude]);
        fixFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
          properties: { text: formatFixLabel(point, kind), identifier: point.identifier ?? '' },
        });
      }
      break;
    }

    if (kind === 'sid' && SID_SKIP_LEGTYPES.includes(point.legType)) continue;

    if (ARROW_LEGTYPES.includes(point.legType)) {
      if (previous) {
        const rwyHdg = isAtRunwayOrigin ? runwayHeading(sequence.transition) : null;
        const needsArc =
          rwyHdg !== null && angleDifference(rwyHdg, point.course) > ARC_THRESHOLD_DEG;

        let straightStart: { latitude: number; longitude: number };
        if (needsArc) {
          const arc = generateArcPoints(previous, rwyHdg!, point.course);
          currentCoords.push(...arc.coords);
          straightStart = arc.end;
        } else {
          straightStart = previous;
        }

        const straightDist = needsArc
          ? MANUAL_ARROW_DISTANCE_NM - ARC_DISTANCE_NM
          : MANUAL_ARROW_DISTANCE_NM;
        const tip = destinationPoint(
          straightStart.latitude,
          straightStart.longitude,
          point.course,
          straightDist,
        );
        currentCoords.push([tip.longitude, tip.latitude]);
        flushSegment(lineSegments, currentCoords, false);
        currentCoords = [];

        const backBearing = (point.course + 180) % 360;
        const leftWing = destinationPoint(
          tip.latitude,
          tip.longitude,
          (backBearing - ARROW_WING_ANGLE_DEG + 360) % 360,
          ARROW_WING_LENGTH_NM,
        );
        const rightWing = destinationPoint(
          tip.latitude,
          tip.longitude,
          (backBearing + ARROW_WING_ANGLE_DEG) % 360,
          ARROW_WING_LENGTH_NM,
        );
        arrowFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [leftWing.longitude, leftWing.latitude],
              [tip.longitude, tip.latitude],
              [rightWing.longitude, rightWing.latitude],
            ],
          },
          properties: {},
        });

        dashOrigin = [tip.longitude, tip.latitude];
        previous = tip;
      }
      isAtRunwayOrigin = false;
      continue;
    }

    if (!hasCoords(point)) continue;

    const coord: [number, number] = [point.longitude, point.latitude];

    if (dashOrigin) {
      lineSegments.push({ coords: [dashOrigin, coord], dashed: true });
      dashOrigin = null;
      currentCoords = [coord];
    } else {
      // Arc from runway if the angle to this fix is steep
      if (isAtRunwayOrigin && previous) {
        const rwyHdg = runwayHeading(sequence.transition);
        if (rwyHdg !== null) {
          const bearing = bearingBetween(
            previous.latitude,
            previous.longitude,
            point.latitude,
            point.longitude,
          );
          if (angleDifference(rwyHdg, bearing) > ARC_THRESHOLD_DEG) {
            const dist = distanceBetween(
              previous.latitude,
              previous.longitude,
              point.latitude,
              point.longitude,
            );
            const arcDist = Math.min(dist / 2, ARC_DISTANCE_NM);
            const arc = generateArcPoints(previous, rwyHdg, bearing, arcDist);
            currentCoords.push(...arc.coords);
          }
        }
      }
      currentCoords.push(coord);
    }

    fixFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coord },
      properties: { text: formatFixLabel(point, kind), identifier: point.identifier ?? '' },
    });
    previous = { latitude: point.latitude, longitude: point.longitude };
    isAtRunwayOrigin = false;
  }

  flushSegment(lineSegments, currentCoords, false);

  return { lineSegments, fixFeatures, arrowFeatures };
};

export const lineSegmentsToFeatures = (segments: LineSegment[]): LineFeature[] =>
  segments.map((seg) => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: seg.coords },
    properties: { dashed: seg.dashed },
  }));

export interface ProcedureSequenceGeometry {
  sequence: Sequence;
  lineSegments: LineSegment[];
  arrowFeatures: ArrowFeature[];
}

export interface ProcedureGeometry {
  sequences: ProcedureSequenceGeometry[];
  fixFeatures: FixFeature[];
}

const pickBetterFix = (a: FixFeature, b: FixFeature): FixFeature =>
  b.properties.text.length > a.properties.text.length ? b : a;

export const buildProcedureGeometry = (procedure: Procedure): ProcedureGeometry => {
  const sequencesGeom: ProcedureSequenceGeometry[] = [];
  const bestByIdentifier = new Map<string, FixFeature>();

  for (const sequence of procedure.sequences) {
    const geom = buildSequenceGeometry(sequence, procedure.kind);
    sequencesGeom.push({
      sequence,
      lineSegments: geom.lineSegments,
      arrowFeatures: geom.arrowFeatures,
    });
    for (const feat of geom.fixFeatures) {
      const id = feat.properties.identifier;
      if (!id) continue;
      const existing = bestByIdentifier.get(id);
      bestByIdentifier.set(id, existing ? pickBetterFix(existing, feat) : feat);
    }
  }

  return { sequences: sequencesGeom, fixFeatures: Array.from(bestByIdentifier.values()) };
};

export const procedureKey = (procedure: Procedure): string =>
  `${procedure.kind}:${procedure.airport}:${procedure.identifier}`;

export const sequenceLayerId = (procedure: Procedure, sequence: Sequence): string => {
  const transition = sequence.transition ? sequence.transition : 'null';
  return `${procedure.kind}-${procedure.airport}-${procedure.identifier}-${transition}`;
};

export const procedureLayerId = (procedure: Procedure): string =>
  `${procedure.kind}-${procedure.airport}-${procedure.identifier}`;

export const aggregateFixFeatures = (procedures: Procedure[]): FixFeature[] => {
  const bestByIdentifier = new Map<string, FixFeature>();
  for (const procedure of procedures) {
    for (const sequence of procedure.sequences) {
      const geom = buildSequenceGeometry(sequence, procedure.kind);
      for (const feat of geom.fixFeatures) {
        const id = feat.properties.identifier;
        if (!id) continue;
        const existing = bestByIdentifier.get(id);
        bestByIdentifier.set(id, existing ? pickBetterFix(existing, feat) : feat);
      }
    }
  }
  return Array.from(bestByIdentifier.values());
};
