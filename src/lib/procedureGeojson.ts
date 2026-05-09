import { FixDescription, LegType, Point, Procedure, ProcedureKind, Sequence } from '~/lib/types';
import {
  angleDifference,
  ArrowFeature,
  ARROW_LEGTYPES,
  bearingBetween,
  destinationPoint,
  distanceBetween,
  FixFeature,
  interpolateBearing,
  isValidCoord,
  LineSegment,
  MANUAL_ARROW_DISTANCE_NM,
  SequenceGeometry,
  toTrue,
} from '~/lib/mapGeometry';

const SID_SKIP_LEGTYPES: LegType[] = ['HeadingToAltitude', 'CourseToAltitude'];
const MISSED_APPROACH_STOPPERS: FixDescription[] = ['MissedApproach', 'MissedApproachFirstLeg'];

const ARROW_WING_LENGTH_NM = 0.6;
const ARROW_WING_ANGLE_DEG = 30;
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
  isValidCoord(p.latitude, p.longitude);

const isMissedApproachBoundary = (point: Point): boolean =>
  point.descriptions.some((d) => MISSED_APPROACH_STOPPERS.includes(d));

const isRunwayThreshold = (point: Point): boolean => point.descriptions.includes('RunwayHelipad');

const runwayHeading = (transition?: string): number | null => {
  if (!transition) return null;
  const m = transition.match(/^RW(\d{1,2})/);
  if (!m) return null;
  return (parseInt(m[1], 10) * 10) % 360;
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

const flushSegment = (
  segments: LineSegment[],
  coords: [number, number][],
  dashed: boolean,
): void => {
  if (coords.length >= 2) segments.push({ coords: [...coords], dashed });
};

export const buildSequenceGeometry = (
  sequence: Sequence,
  kind: ProcedureKind,
  magneticCorrection: number = 0,
): SequenceGeometry => {
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
        const rwyHdgMag = isAtRunwayOrigin ? runwayHeading(sequence.transition) : null;
        // Threshold comparison stays in magnetic — both operands are magnetic,
        // and a constant offset cancels in angleDifference.
        const needsArc =
          rwyHdgMag !== null && angleDifference(rwyHdgMag, point.course) > ARC_THRESHOLD_DEG;

        const courseTrue = toTrue(point.course, magneticCorrection);

        let straightStart: { latitude: number; longitude: number };
        if (needsArc) {
          const arc = generateArcPoints(
            previous,
            toTrue(rwyHdgMag!, magneticCorrection),
            courseTrue,
          );
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
          courseTrue,
          straightDist,
        );
        currentCoords.push([tip.longitude, tip.latitude]);
        flushSegment(lineSegments, currentCoords, false);
        currentCoords = [];

        const backBearing = (courseTrue + 180) % 360;
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
        const rwyHdgMag = runwayHeading(sequence.transition);
        if (rwyHdgMag !== null) {
          // bearingBetween returns true; convert rwyHdg to true so both
          // operands live in the same domain.
          const rwyHdgTrue = toTrue(rwyHdgMag, magneticCorrection);
          const bearing = bearingBetween(
            previous.latitude,
            previous.longitude,
            point.latitude,
            point.longitude,
          );
          if (angleDifference(rwyHdgTrue, bearing) > ARC_THRESHOLD_DEG) {
            const dist = distanceBetween(
              previous.latitude,
              previous.longitude,
              point.latitude,
              point.longitude,
            );
            const arcDist = Math.min(dist / 2, ARC_DISTANCE_NM);
            const arc = generateArcPoints(previous, rwyHdgTrue, bearing, arcDist);
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

export const procedureKey = (procedure: Procedure): string =>
  `${procedure.kind}:${procedure.airport}:${procedure.identifier}`;

export const sequenceLayerId = (procedure: Procedure, sequence: Sequence): string => {
  const transition = sequence.transition ? sequence.transition : 'null';
  return `${procedure.kind}-${procedure.airport}-${procedure.identifier}-${transition}`;
};
