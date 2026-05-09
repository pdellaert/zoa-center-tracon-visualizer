import { isValidNavdataIdentifier, navdataAirportUrl, navdataUrl } from '~/lib/config';
import { isValidCoord } from '~/lib/mapGeometry';
import { AirportInfo, Procedure, ProcedureKind } from '~/lib/types';

export interface AirportProcedurePack {
  sids: Procedure[];
  stars: Procedure[];
  apps: Procedure[];
}

const RUNWAY_RE = /^RW(\d{1,2})([A-Z]?)$/;

const airportProceduresCache = new Map<string, Promise<AirportProcedurePack>>();
const airportInfoCache = new Map<string, Promise<AirportInfo | null>>();

export const clearProcedureCache = () => {
  airportProceduresCache.clear();
  airportInfoCache.clear();
};

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
  if (!isValidNavdataIdentifier(airport)) return [];
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

export const fetchAirportInfo = (airport: string): Promise<AirportInfo | null> => {
  const cached = airportInfoCache.get(airport);
  if (cached) return cached;
  const promise = (async (): Promise<AirportInfo | null> => {
    if (!isValidNavdataIdentifier(airport)) return null;
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
  })();
  promise.catch(() => airportInfoCache.delete(airport));
  airportInfoCache.set(airport, promise);
  return promise;
};

export const runwayCoordsFromApproaches = (
  approaches: Procedure[],
): Map<string, { latitude: number; longitude: number }> => {
  const map = new Map<string, { latitude: number; longitude: number }>();
  for (const procedure of approaches) {
    for (const sequence of procedure.sequences) {
      for (const point of sequence.points) {
        if (
          point.identifier &&
          isValidCoord(point.latitude, point.longitude) &&
          point.descriptions.includes('RunwayHelipad') &&
          !map.has(point.identifier)
        ) {
          map.set(point.identifier, {
            latitude: point.latitude as number,
            longitude: point.longitude as number,
          });
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
  const m = runway.match(RUNWAY_RE);
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
  const m = runway.match(RUNWAY_RE);
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

export const applyAirportProcedureAnnotations = (
  pack: AirportProcedurePack,
  info: AirportInfo | null,
): void => {
  annotateSidRunwayOrigins(pack.sids, runwayCoordsFromApproaches(pack.apps));
  const magneticCorrection =
    info && info.courseType === 'Magnetic' && info.variation !== null ? info.variation : undefined;
  if (magneticCorrection !== undefined) {
    for (const p of [...pack.sids, ...pack.stars, ...pack.apps]) p.magneticCorrection = magneticCorrection;
  }
};

export const loadAirportProcedures = (airport: string): Promise<AirportProcedurePack> => {
  const cached = airportProceduresCache.get(airport);
  if (cached) return cached;
  const promise = (async (): Promise<AirportProcedurePack> => {
    const [sidResult, starResult, appResult, infoResult] = await Promise.allSettled([
      fetchProcedures('sid', airport),
      fetchProcedures('star', airport),
      fetchProcedures('app', airport),
      fetchAirportInfo(airport),
    ]);
    if (
      sidResult.status === 'rejected' &&
      starResult.status === 'rejected' &&
      appResult.status === 'rejected'
    ) {
      throw new Error(`No procedures found for ${airport}`);
    }
    const pack: AirportProcedurePack = {
      sids: sidResult.status === 'fulfilled' ? sidResult.value : [],
      stars: starResult.status === 'fulfilled' ? starResult.value : [],
      apps: appResult.status === 'fulfilled' ? appResult.value : [],
    };
    const info = infoResult.status === 'fulfilled' ? infoResult.value : null;
    applyAirportProcedureAnnotations(pack, info);
    return pack;
  })();
  promise.catch(() => airportProceduresCache.delete(airport));
  airportProceduresCache.set(airport, promise);
  return promise;
};
