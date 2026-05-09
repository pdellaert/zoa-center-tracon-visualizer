import {
  navdataAirwayUrl,
  navdataPointUrl,
} from '~/lib/config';
import {
  ARROW_LEGTYPES,
  destinationPoint,
  distanceBetween,
  MANUAL_ARROW_DISTANCE_NM,
  toTrue,
} from '~/lib/procedureGeojson';
import {
  applyAirportProcedureAnnotations,
  fetchAirportInfo,
  fetchProcedures,
} from '~/lib/procedureApi';
import {
  Airway,
  AirwayPoint,
  PointLookupResult,
  Procedure,
  Sequence,
} from '~/lib/types';
import { Coord, RouteFix } from '~/lib/routeTypes';

///////////////////////////////////////////////////
// Coord validity
///////////////////////////////////////////////////
// A fix with both lat and lon equal to zero is the API's sentinel for
// "coordinates unknown" — those points sit on the equator at Greenwich, which
// is never where a real navaid lives in this dataset. Treat such results as
// missing rather than rendering a line to (0, 0).
export const isValidCoord = (lat: number | null | undefined, lon: number | null | undefined): boolean =>
  lat != null &&
  lon != null &&
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  !(lat === 0 && lon === 0);

///////////////////////////////////////////////////
// Lat/lon parsing
///////////////////////////////////////////////////

const parseLatComponent = (s: string): number => {
  if (s.length === 2) return Number(s);
  if (s.length === 4) return Number(s.slice(0, 2)) + Number(s.slice(2, 4)) / 60;
  if (s.length === 6)
    return (
      Number(s.slice(0, 2)) +
      Number(s.slice(2, 4)) / 60 +
      Number(s.slice(4, 6)) / 3600
    );
  return NaN;
};

const parseLonComponent = (s: string): number => {
  if (s.length === 3) return Number(s);
  if (s.length === 5) return Number(s.slice(0, 3)) + Number(s.slice(3, 5)) / 60;
  if (s.length === 7)
    return (
      Number(s.slice(0, 3)) +
      Number(s.slice(3, 5)) / 60 +
      Number(s.slice(5, 7)) / 3600
    );
  return NaN;
};

export const parseLatLon = (raw: string): Coord | null => {
  const s = raw.replace('/', '');
  const m = s.match(/^(\d{2,6})([NS])(\d{3,7})([EW])$/);
  if (!m) return null;
  const [, latStr, ns, lonStr, ew] = m;
  if (latStr.length % 2 !== 0) return null;
  if (lonStr.length % 2 !== 1) return null;
  const lat = parseLatComponent(latStr);
  const lon = parseLonComponent(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lat: ns === 'N' ? lat : -lat,
    lon: ew === 'E' ? lon : -lon,
  };
};

export const latLonTokenToFix = (raw: string): RouteFix | null => {
  const c = parseLatLon(raw);
  if (!c || !isValidCoord(c.lat, c.lon)) return null;
  return { identifier: raw, lat: c.lat, lon: c.lon, label: raw };
};

///////////////////////////////////////////////////
// Caches
///////////////////////////////////////////////////

const pointCache = new Map<string, PointLookupResult[]>();
const airwayCache = new Map<string, Airway[]>();
// Per-airport caches for the procedures-by-kind triple. We fetch SIDs + STARs
// + approaches together so SID `runwayOrigin` annotations can be applied once
// up-front (the annotation pulls runway thresholds from the approaches).
interface AirportProcedurePack {
  sids: Procedure[];
  stars: Procedure[];
  apps: Procedure[];
}
const airportProceduresCache = new Map<string, Promise<AirportProcedurePack>>();

export const clearRouteCaches = () => {
  pointCache.clear();
  airwayCache.clear();
  airportProceduresCache.clear();
};

const fetchAirportProcedures = (airport: string): Promise<AirportProcedurePack> => {
  const cached = airportProceduresCache.get(airport);
  if (cached) return cached;
  const promise = (async (): Promise<AirportProcedurePack> => {
    const [sidResult, starResult, appResult, infoResult] = await Promise.allSettled([
      fetchProcedures('sid', airport),
      fetchProcedures('star', airport),
      fetchProcedures('app', airport),
      fetchAirportInfo(airport),
    ]);
    const sids = sidResult.status === 'fulfilled' ? sidResult.value : [];
    const stars = starResult.status === 'fulfilled' ? starResult.value : [];
    const apps = appResult.status === 'fulfilled' ? appResult.value : [];
    const info = infoResult.status === 'fulfilled' ? infoResult.value : null;
    applyAirportProcedureAnnotations(sids, stars, apps, info);
    return { sids, stars, apps };
  })();
  airportProceduresCache.set(airport, promise);
  return promise;
};

///////////////////////////////////////////////////
// Fix resolution
///////////////////////////////////////////////////

const fetchPoints = async (id: string): Promise<PointLookupResult[]> => {
  const cached = pointCache.get(id);
  if (cached) return cached;
  const response = await fetch(navdataPointUrl(id));
  if (!response.ok) {
    if (response.status === 404) {
      pointCache.set(id, []);
      return [];
    }
    throw new Error(`Failed to fetch point ${id}`);
  }
  const raw = (await response.json()) as PointLookupResult[];
  pointCache.set(id, raw);
  return raw;
};

export const resolveFix = async (
  id: string,
  anchor: Coord | null,
): Promise<RouteFix | null> => {
  const allResults = await fetchPoints(id);
  // Drop any API result whose coords are missing or 0,0 — those are sentinel
  // entries we can't draw to.
  const results = allResults.filter((r) => isValidCoord(r.latitude, r.longitude));
  if (results.length === 0) return null;
  const pick =
    anchor && results.length > 1
      ? results.reduce((best, cur) =>
          distanceBetween(anchor.lat, anchor.lon, cur.latitude, cur.longitude) <
          distanceBetween(anchor.lat, anchor.lon, best.latitude, best.longitude)
            ? cur
            : best,
        )
      : results[0];
  return {
    identifier: pick.identifier,
    lat: pick.latitude,
    lon: pick.longitude,
    label: pick.identifier,
  };
};

///////////////////////////////////////////////////
// Fix-radial-distance
///////////////////////////////////////////////////

export const parseFixRadialDistance = async (
  raw: string,
  anchor: Coord | null,
): Promise<RouteFix | null> => {
  const m = raw.match(/^([A-Z]{3,5})(\d{3})(\d{3})$/);
  if (!m) return null;
  const [, fixId, radialStr, distStr] = m;
  const fix = await resolveFix(fixId, anchor);
  if (!fix) return null;
  const radial = Number(radialStr);
  const distance = Number(distStr);
  // NOTE: navaid radials are magnetic-relative to the navaid's own variation,
  // but the API doesn't expose per-navaid variation. v1 treats the radial as
  // true (small angular error, documented in CLAUDE.md).
  const dest = destinationPoint(fix.lat, fix.lon, radial, distance);
  if (!isValidCoord(dest.latitude, dest.longitude)) return null;
  return {
    identifier: raw,
    lat: dest.latitude,
    lon: dest.longitude,
    label: raw,
  };
};

///////////////////////////////////////////////////
// Airway slicing
///////////////////////////////////////////////////

const fetchAirway = async (id: string): Promise<Airway[]> => {
  const cached = airwayCache.get(id);
  if (cached) return cached;
  const response = await fetch(navdataAirwayUrl(id));
  if (!response.ok) {
    if (response.status === 404) {
      airwayCache.set(id, []);
      return [];
    }
    throw new Error(`Failed to fetch airway ${id}`);
  }
  const raw = (await response.json()) as Airway[];
  airwayCache.set(id, raw);
  return raw;
};

export interface AirwaySliceResult {
  fixes: RouteFix[];
  airwayIdentifier: string;
}

/**
 * Some airway responses bundle multiple disjoint sub-segments into a single
 * `points` array — e.g., B453 contains [KURTT…MDO][BOXER…KURTT], two halves
 * meeting at KURTT (which appears twice in the array). The API marks the end
 * of a sub-segment with `outboundCourse === 0` ("nowhere to go from here").
 *
 * Split the array at those sentinels so each sub-segment is a contiguous
 * path; then we can find a real route across sub-segments via shared
 * endpoints rather than naively slicing across array boundaries.
 */
const splitAirwaySubSegments = (airway: Airway): AirwayPoint[][] => {
  const segs: AirwayPoint[][] = [];
  let current: AirwayPoint[] = [];
  for (const p of airway.points) {
    current.push(p);
    if (p.outboundCourse === 0) {
      segs.push(current);
      current = [];
    }
  }
  if (current.length > 0) segs.push(current);
  return segs;
};

/**
 * BFS from `fromId` to `toId` across the airway's sub-segment graph. Within
 * each sub-segment, consecutive points are bidirectional neighbors. Across
 * sub-segments, points sharing an identifier are treated as the same node
 * (junction). Returns the shortest hop-path of `AirwayPoint`s, or null if
 * no path exists.
 */
const findAirwayPath = (
  airway: Airway,
  fromId: string,
  toId: string,
): AirwayPoint[] | null => {
  const subSegs = splitAirwaySubSegments(airway);

  // Index every occurrence so duplicates can join sub-segments.
  const idToPositions = new Map<string, { segIdx: number; ptIdx: number }[]>();
  subSegs.forEach((seg, segIdx) => {
    seg.forEach((pt, ptIdx) => {
      const list = idToPositions.get(pt.identifier);
      if (list) list.push({ segIdx, ptIdx });
      else idToPositions.set(pt.identifier, [{ segIdx, ptIdx }]);
    });
  });
  if (!idToPositions.has(fromId) || !idToPositions.has(toId)) return null;

  const visited = new Set<string>([fromId]);
  const parent = new Map<string, string>();
  const queue: string[] = [fromId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === toId) break;
    const positions = idToPositions.get(id) ?? [];
    for (const { segIdx, ptIdx } of positions) {
      const seg = subSegs[segIdx];
      for (const neighborIdx of [ptIdx - 1, ptIdx + 1]) {
        if (neighborIdx < 0 || neighborIdx >= seg.length) continue;
        const neighborId = seg[neighborIdx].identifier;
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        parent.set(neighborId, id);
        queue.push(neighborId);
      }
    }
  }

  if (!visited.has(toId)) return null;

  // Reconstruct identifier path from parent pointers, then map back to
  // AirwayPoint instances (any occurrence will do for coords).
  const idPath: string[] = [];
  for (let cur: string | undefined = toId; cur != null; cur = parent.get(cur)) {
    idPath.push(cur);
  }
  idPath.reverse();
  return idPath.map((pid) => {
    const pos = idToPositions.get(pid)![0];
    return subSegs[pos.segIdx][pos.ptIdx];
  });
};

export const resolveAirwaySegment = async (
  id: string,
  fromId: string,
  toId: string,
): Promise<AirwaySliceResult | null> => {
  const airways = await fetchAirway(id);
  if (airways.length === 0) return null;

  // Try each airway result (the API can return multiple airways with the same
  // identifier in different regions); take the first one that yields a path
  // between fromId and toId.
  for (const aw of airways) {
    const path = findAirwayPath(aw, fromId, toId);
    if (!path) continue;
    const fixes: RouteFix[] = path
      .filter((p) => isValidCoord(p.latitude, p.longitude))
      .map((p) => ({
        identifier: p.identifier,
        lat: p.latitude,
        lon: p.longitude,
        label: p.identifier,
      }));
    if (fixes.length < 2) continue;
    return { fixes, airwayIdentifier: aw.airwayIdentifier };
  }
  return null;
};

///////////////////////////////////////////////////
// SID/STAR resolution
///////////////////////////////////////////////////

const cachedDepartures = async (airport: string): Promise<Procedure[]> =>
  (await fetchAirportProcedures(airport)).sids;

const cachedArrivals = async (airport: string): Promise<Procedure[]> =>
  (await fetchAirportProcedures(airport)).stars;

/**
 * The "connecting fix" for a SID/STAR transition — the fix at which the en-route
 * line should join. For a SID, that's the LAST point of the chosen transition's
 * sequence (the SID exit). For a STAR, that's the FIRST point of the chosen
 * transition's sequence (the STAR entry).
 *
 * When the user supplied no transition (bare SID/STAR name), we fall back to
 * the matching trunk sequence (transition is null/empty or equals the
 * procedure identifier). That means the connection point is whichever fix the
 * trunk's first/last point lands on — typically the published common fix.
 */
// Sequences that the API considers part of the procedure's "trunk" — the
// path that applies regardless of which transition (if any) you chose. The
// navdata uses 'ALL' for runway-common tails of STARs (and some SIDs),
// in addition to the more obvious empty/null/procedure-named conventions.
const isTrunkTransition = (t: string | null | undefined, procedureIdentifier: string): boolean =>
  !t || t === '' || t === procedureIdentifier || t === 'ALL';

const sequencesForTransition = (procedure: Procedure, transition: string | null): Sequence[] => {
  if (transition !== null) {
    const matched = procedure.sequences.filter((s) => s.transition === transition);
    if (matched.length > 0) return matched;
  }
  return procedure.sequences.filter((s) => isTrunkTransition(s.transition, procedure.identifier));
};

const firstFixOfSequences = (sequences: Sequence[]): RouteFix | null => {
  for (const seq of sequences) {
    for (const point of seq.points) {
      if (point.identifier && isValidCoord(point.latitude, point.longitude)) {
        return {
          identifier: point.identifier,
          lat: point.latitude as number,
          lon: point.longitude as number,
          label: point.identifier,
        };
      }
    }
  }
  return null;
};

const lastFixOfSequences = (sequences: Sequence[]): RouteFix | null => {
  for (let i = sequences.length - 1; i >= 0; i--) {
    const seq = sequences[i];
    for (let j = seq.points.length - 1; j >= 0; j--) {
      const point = seq.points[j];
      if (point.identifier && isValidCoord(point.latitude, point.longitude)) {
        return {
          identifier: point.identifier,
          lat: point.latitude as number,
          lon: point.longitude as number,
          label: point.identifier,
        };
      }
    }
  }
  return null;
};

export interface SidStarInput {
  name: string;
  transition: string | null; // null = no transition (use trunk only)
}

export interface SidStarResolution {
  procedure: Procedure;
  // SID exit OR STAR entry — may be a synthetic vector-tip for SID, OR null
  // for radar-vectors-only SIDs that don't expose a terminating fix in the
  // navdata (SFO4, GAPP7, OAK6 …). The builder treats null as "exit at the
  // departure airport with a dashed vector hand-off to the first filed fix".
  connectingFix: RouteFix | null;
  transition: string | null; // chosen transition (echoed back so the renderer can filter)
  endsWithVector: boolean;
}

/**
 * If the chosen SID transition's LAST point is a manual-termination (vector)
 * leg, compute the arrow tip in the same way the procedure renderer does so
 * the route's en-route line attaches at the rendered arrow tip rather than at
 * the fix preceding the vector.
 */
const sidVectorTip = (
  transitionSeqs: Sequence[],
  magneticCorrection: number,
): RouteFix | null => {
  if (transitionSeqs.length === 0) return null;
  const lastSeq = transitionSeqs[transitionSeqs.length - 1];
  if (lastSeq.points.length === 0) return null;
  const lastPoint = lastSeq.points[lastSeq.points.length - 1];
  if (!ARROW_LEGTYPES.includes(lastPoint.legType)) return null;

  let prevCoord: { latitude: number; longitude: number } | null = null;
  for (let i = lastSeq.points.length - 2; i >= 0; i--) {
    const p = lastSeq.points[i];
    if (p.latitude != null && p.longitude != null) {
      prevCoord = { latitude: p.latitude, longitude: p.longitude };
      break;
    }
  }
  if (!prevCoord) return null;

  const courseTrue = toTrue(lastPoint.course, magneticCorrection);
  const tip = destinationPoint(
    prevCoord.latitude,
    prevCoord.longitude,
    courseTrue,
    MANUAL_ARROW_DISTANCE_NM,
  );
  return {
    identifier: 'VECTOR',
    lat: tip.latitude,
    lon: tip.longitude,
    label: '',
  };
};

const splitDotToken = (token: string, side: 'sid' | 'star'): SidStarInput => {
  const [a, b] = token.split('.');
  if (side === 'sid') return { name: a, transition: b ?? null };
  // STAR convention: <transition>.<STAR>
  return { name: b ?? a, transition: b ? a : null };
};

export const resolveSidStar = async (
  input: string | SidStarInput,
  side: 'sid' | 'star',
  airport: string,
): Promise<SidStarResolution | null> => {
  const parsed: SidStarInput = typeof input === 'string' ? splitDotToken(input, side) : input;
  const procedures = side === 'sid' ? await cachedDepartures(airport) : await cachedArrivals(airport);
  const procedure = procedures.find((p) => p.identifier === parsed.name);
  if (!procedure) return null;

  // We return the FULL procedure (every sequence the API published) so the
  // existing procedure renderer draws every runway entry / common trunk /
  // exit transition / runway tail. Only the *connecting fix* — the point at
  // which the en-route blue line attaches — is computed from the chosen
  // transition's sequence.
  const transitionSeqs = sequencesForTransition(procedure, parsed.transition);
  if (parsed.transition !== null && transitionSeqs.length === 0) return null;

  let connectingFix: RouteFix | null = null;
  let endsWithVector = false;
  if (side === 'sid') {
    const tip = sidVectorTip(transitionSeqs, procedure.magneticCorrection ?? 0);
    if (tip) {
      connectingFix = tip;
      endsWithVector = true;
    } else {
      connectingFix = lastFixOfSequences(transitionSeqs);
    }
  } else {
    connectingFix = firstFixOfSequences(transitionSeqs);
  }
  // Note: connectingFix can legitimately be null for radar-vectors-only SIDs
  // (no published exit fix). We still return the procedure so the builder
  // can render it; the builder bridges with a dashed dep-airport→first-fix
  // segment in that case.
  return {
    procedure,
    connectingFix,
    transition: parsed.transition,
    endsWithVector,
  };
};

///////////////////////////////////////////////////
// Pre-fetch helpers (used by builder)
///////////////////////////////////////////////////

export const prefetchDepartures = (airport: string) => cachedDepartures(airport);
export const prefetchArrivals = (airport: string) => cachedArrivals(airport);

export const findSidByName = async (
  airport: string,
  name: string,
): Promise<Procedure | null> => {
  const procs = await cachedDepartures(airport);
  return procs.find((p) => p.identifier === name) ?? null;
};

export const findStarByName = async (
  airport: string,
  name: string,
): Promise<Procedure | null> => {
  const procs = await cachedArrivals(airport);
  return procs.find((p) => p.identifier === name) ?? null;
};

export const procedureHasTransition = (procedure: Procedure, transition: string): boolean =>
  procedure.sequences.some((s) => s.transition === transition);
