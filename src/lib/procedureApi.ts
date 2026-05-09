import { navdataAirportUrl, navdataUrl } from '~/lib/config';
import { AirportInfo, Procedure, ProcedureKind } from '~/lib/types';

interface RawProcedureResponse {
  departureIdentifier?: string;
  arrivalIdentifier?: string;
  approachIdentifier?: string;
  sequences: Procedure['sequences'];
}

const identifierFor = (kind: ProcedureKind, raw: RawProcedureResponse): string | undefined => {
  if (kind === 'sid') return raw.departureIdentifier;
  if (kind === 'star') return raw.arrivalIdentifier;
  return raw.approachIdentifier;
};

export const fetchProcedures = async (kind: ProcedureKind, airport: string): Promise<Procedure[]> => {
  const response = await fetch(navdataUrl(kind, airport));
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Failed to fetch ${kind} procedures for ${airport}`);
  }
  const raw: RawProcedureResponse[] = await response.json();
  return raw.map((r) => ({
    kind,
    airport,
    identifier: identifierFor(kind, r) ?? '',
    sequences: r.sequences,
  }));
};

export const fetchAirportInfo = async (airport: string): Promise<AirportInfo | null> => {
  const response = await fetch(navdataAirportUrl(airport));
  if (!response.ok) return null;
  const raw = await response.json();
  return {
    identifier: typeof raw.identifier === 'string' ? raw.identifier : airport,
    variation: typeof raw.variation === 'number' ? raw.variation : null,
    courseType: typeof raw.courseType === 'string' ? raw.courseType : null,
    latitude: typeof raw.latitude === 'number' ? raw.latitude : null,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : null,
  };
};

///////////////////////////////////////////////////
// Runway annotation helpers (used by both the Procedures sidebar and the
// Route feature so that SID sequences anchor at the proper departure-end
// runway threshold even when fetched from different code paths).
///////////////////////////////////////////////////

export const runwayCoordsFromApproaches = (
  approaches: Procedure[],
): Map<string, { latitude: number; longitude: number }> => {
  const map = new Map<string, { latitude: number; longitude: number }>();
  for (const procedure of approaches) {
    for (const sequence of procedure.sequences) {
      for (const point of sequence.points) {
        if (
          point.identifier &&
          point.latitude != null &&
          point.longitude != null &&
          point.descriptions.includes('RunwayHelipad') &&
          !map.has(point.identifier)
        ) {
          map.set(point.identifier, { latitude: point.latitude, longitude: point.longitude });
        }
      }
    }
  }
  return map;
};

const flipRunwaySuffix = (suffix: string): string => {
  switch (suffix) {
    case 'L':
      return 'R';
    case 'R':
      return 'L';
    case 'A':
      return 'B';
    case 'B':
      return 'A';
    default:
      return suffix;
  }
};

const runwayVariants = (runway: string): string[] => {
  const m = runway.match(/^RW(\d{1,2})([A-Z]?)$/);
  if (!m) return [runway];
  const [, num, suffix] = m;
  const variants = [runway];
  if (suffix === 'A') variants.push(`RW${num}L`, `RW${num}R`);
  else if (suffix === 'B') variants.push(`RW${num}R`, `RW${num}L`);
  else if (suffix === 'L') variants.push(`RW${num}A`);
  else if (suffix === 'R') variants.push(`RW${num}B`);
  return variants;
};

export const oppositeRunway = (runway: string): string | null => {
  const m = runway.match(/^RW(\d{1,2})([A-Z]?)$/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (num < 1 || num > 36) return null;
  const opposite = ((num - 1 + 18) % 36) + 1;
  const suffix = flipRunwaySuffix(m[2]);
  return `RW${String(opposite).padStart(2, '0')}${suffix}`;
};

export const lookupRunway = (
  map: Map<string, { latitude: number; longitude: number }>,
  runway: string,
): { latitude: number; longitude: number } | undefined => {
  for (const variant of runwayVariants(runway)) {
    const coords = map.get(variant);
    if (coords) return coords;
  }
  return undefined;
};

export const annotateSidRunwayOrigins = (
  sids: Procedure[],
  runwayCoords: Map<string, { latitude: number; longitude: number }>,
): void => {
  for (const sid of sids) {
    for (const sequence of sid.sequences) {
      if (!sequence.transition) continue;
      const opposite = oppositeRunway(sequence.transition);
      const coords =
        (opposite ? lookupRunway(runwayCoords, opposite) : undefined) ??
        lookupRunway(runwayCoords, sequence.transition);
      if (coords) sequence.runwayOrigin = coords;
    }
  }
};

/**
 * Apply the post-fetch annotations that AirportProcedures has historically
 * done inline:
 *   - SID sequences gain `runwayOrigin` so the line anchors at the runway
 *   - Every procedure gains `magneticCorrection` (when courseType=Magnetic)
 *     so geometry conversion uses true bearings.
 *
 * Mutates the inputs in place so the same Procedure references can be passed
 * directly into displayedProcedures.
 */
export const applyAirportProcedureAnnotations = (
  sids: Procedure[],
  stars: Procedure[],
  apps: Procedure[],
  info: AirportInfo | null,
): void => {
  annotateSidRunwayOrigins(sids, runwayCoordsFromApproaches(apps));
  const magneticCorrection =
    info && info.courseType === 'Magnetic' && info.variation !== null ? info.variation : undefined;
  if (magneticCorrection !== undefined) {
    for (const p of [...sids, ...stars, ...apps]) p.magneticCorrection = magneticCorrection;
  }
};
