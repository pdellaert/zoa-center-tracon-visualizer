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

export interface SequenceGeometry {
  lineCoords: [number, number][];
  fixFeatures: FixFeature[];
  arrowFeatures: ArrowFeature[];
}

export const buildSequenceGeometry = (sequence: Sequence, kind: ProcedureKind): SequenceGeometry => {
  const lineCoords: [number, number][] = [];
  const fixFeatures: FixFeature[] = [];
  const arrowFeatures: ArrowFeature[] = [];
  let previous: { latitude: number; longitude: number } | null = null;

  // SID sequences departing from a known runway: seed the line at the runway threshold
  // so the procedure visibly starts at the airport, not at the first waypoint.
  if (kind === 'sid' && sequence.runwayOrigin) {
    lineCoords.push([sequence.runwayOrigin.longitude, sequence.runwayOrigin.latitude]);
    previous = {
      latitude: sequence.runwayOrigin.latitude,
      longitude: sequence.runwayOrigin.longitude,
    };
  }

  for (const point of sequence.points) {
    // APP: a MissedApproach or MissedApproachFirstLeg tag marks the end of the approach.
    // If the boundary point is the runway (RunwayHelipad), render it so the line reaches
    // the threshold; otherwise drop it. Either way, stop processing this sequence.
    if (kind === 'app' && isMissedApproachBoundary(point)) {
      if (isRunwayThreshold(point) && hasCoords(point)) {
        lineCoords.push([point.longitude, point.latitude]);
        fixFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
          properties: { text: formatFixLabel(point, kind), identifier: point.identifier ?? '' },
        });
      }
      break;
    }

    // SID: pure altitude-capture legs have no coords
    if (kind === 'sid' && SID_SKIP_LEGTYPES.includes(point.legType)) continue;

    // Manual-termination legs (any kind) render as a line ending in an arrowhead chevron
    if (ARROW_LEGTYPES.includes(point.legType)) {
      if (previous) {
        const tip = destinationPoint(
          previous.latitude,
          previous.longitude,
          point.course,
          MANUAL_ARROW_DISTANCE_NM,
        );
        lineCoords.push([tip.longitude, tip.latitude]);
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
        previous = tip;
      }
      continue;
    }

    if (!hasCoords(point)) continue;

    lineCoords.push([point.longitude, point.latitude]);
    fixFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
      properties: { text: formatFixLabel(point, kind), identifier: point.identifier ?? '' },
    });
    previous = { latitude: point.latitude, longitude: point.longitude };
  }

  return { lineCoords, fixFeatures, arrowFeatures };
};

export interface ProcedureSequenceGeometry {
  sequence: Sequence;
  lineCoords: [number, number][];
  arrowFeatures: ArrowFeature[];
}

export interface ProcedureGeometry {
  sequences: ProcedureSequenceGeometry[];
  fixFeatures: FixFeature[]; // deduplicated across all sequences of this procedure
}

/**
 * Prefer the fix feature with the richer label — annotations (IAF/IF/FAF) and
 * altitude constraints make the label longer, so string length is a good proxy.
 */
const pickBetterFix = (a: FixFeature, b: FixFeature): FixFeature =>
  b.properties.text.length > a.properties.text.length ? b : a;

export const buildProcedureGeometry = (procedure: Procedure): ProcedureGeometry => {
  const sequencesGeom: ProcedureSequenceGeometry[] = [];
  const bestByIdentifier = new Map<string, FixFeature>();

  for (const sequence of procedure.sequences) {
    const geom = buildSequenceGeometry(sequence, procedure.kind);
    sequencesGeom.push({
      sequence,
      lineCoords: geom.lineCoords,
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

/**
 * Aggregate fix features across every displayed procedure and dedup by fix
 * identifier. Two airports sharing a common arrival (e.g., KSFO PIRAT3 and
 * KOAK PIRAT3) overlap on many fixes; rendering them once avoids doubled
 * labels while keeping both procedure lines drawn independently.
 */
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
