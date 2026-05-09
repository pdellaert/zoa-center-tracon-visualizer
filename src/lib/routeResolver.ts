import {
  isValidNavdataIdentifier,
  navdataAirwayUrl,
  navdataPointUrl,
} from '~/lib/config';
import {
  ARROW_LEGTYPES,
  coordPair,
  destinationPoint,
  distanceBetween,
  isValidCoord,
  manualLegTip,
} from '~/lib/mapGeometry';
import {
  AirportProcedurePack,
  loadAirportProcedures,
} from '~/lib/procedureApi';
import { isTrunkTransition } from '~/lib/routeFilter';
import {
  Airway,
  AirwayPoint,
  PointLookupResult,
  ProcedureKind,
  Procedure,
  Sequence,
} from '~/lib/types';
import { Coord, RouteFix } from '~/lib/routeTypes';

export const VECTOR_FIX_IDENTIFIER = 'VECTOR';

const parseDmsComponent = (s: string, degLen: 2 | 3, max: number): number => {
  let deg: number;
  let min = 0;
  let sec = 0;
  if (s.length === degLen) {
    deg = Number(s);
  } else if (s.length === degLen + 2) {
    deg = Number(s.slice(0, degLen));
    min = Number(s.slice(degLen, degLen + 2));
  } else if (s.length === degLen + 4) {
    deg = Number(s.slice(0, degLen));
    min = Number(s.slice(degLen, degLen + 2));
    sec = Number(s.slice(degLen + 2, degLen + 4));
  } else {
    return NaN;
  }
  if (deg > max || min >= 60 || sec >= 60) return NaN;
  return deg + min / 60 + sec / 3600;
};

export const parseLatLon = (raw: string): Coord | null => {
  const s = raw.replace('/', '');
  const m = s.match(/^(\d{2,6})([NS])(\d{3,7})([EW])$/);
  if (!m) return null;
  const [, latStr, ns, lonStr, ew] = m;
  if (latStr.length % 2 !== 0) return null;
  if (lonStr.length % 2 !== 1) return null;
  const lat = parseDmsComponent(latStr, 2, 90);
  const lon = parseDmsComponent(lonStr, 3, 180);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
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

const pointCache = new Map<string, Promise<PointLookupResult[]>>();
const airwayCache = new Map<string, Promise<Airway[]>>();

const cachedFetch = <T>(
  cache: Map<string, Promise<T>>,
  id: string,
  url: string,
  empty: T,
  errorContext: string,
): Promise<T> => {
  const cached = cache.get(id);
  if (cached) return cached;
  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return empty;
      throw new Error(`Failed to fetch ${errorContext}`);
    }
    return (await response.json()) as T;
  })();
  // Don't cache rejections — let the next call retry.
  promise.catch(() => cache.delete(id));
  cache.set(id, promise);
  return promise;
};

const fetchPoints = (id: string): Promise<PointLookupResult[]> => {
  if (!isValidNavdataIdentifier(id)) return Promise.resolve([]);
  return cachedFetch(pointCache, id, navdataPointUrl(id), [] as PointLookupResult[], `point ${id}`);
};

const fetchAirway = (id: string): Promise<Airway[]> => {
  if (!isValidNavdataIdentifier(id)) return Promise.resolve([]);
  return cachedFetch(airwayCache, id, navdataAirwayUrl(id), [] as Airway[], `airway ${id}`);
};

const EMPTY_PACK: AirportProcedurePack = { sids: [], stars: [], apps: [] };
const loadAirportProceduresSafe = async (airport: string): Promise<AirportProcedurePack> => {
  try {
    return await loadAirportProcedures(airport);
  } catch {
    return EMPTY_PACK;
  }
};

export const resolveFix = async (
  id: string,
  anchor: Coord | null,
): Promise<RouteFix | null> => {
  const allResults = await fetchPoints(id);
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

export const resolveFixAllCandidates = async (id: string): Promise<RouteFix[]> => {
  const all = await fetchPoints(id);
  return all
    .filter((r) => isValidCoord(r.latitude, r.longitude))
    .map((r) => ({
      identifier: r.identifier,
      lat: r.latitude,
      lon: r.longitude,
      label: r.identifier,
    }));
};

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
  // navaid radials are magnetic-relative to the navaid's variation, but the
  // API doesn't expose per-navaid variation; v1 treats radial as true (small
  // angular error, documented in CLAUDE.md).
  const dest = destinationPoint(fix.lat, fix.lon, radial, distance);
  if (!isValidCoord(dest.latitude, dest.longitude)) return null;
  return {
    identifier: raw,
    lat: dest.latitude,
    lon: dest.longitude,
    label: raw,
  };
};

// Some airway responses bundle multiple disjoint sub-segments into one points
// array — e.g., B453 = [KURTT…MDO][BOXER…KURTT], halves meeting at KURTT
// (which appears twice). The API marks sub-segment ends with outboundCourse
// in {0, null, undefined} ("nowhere to go from here"). Splitting on those
// sentinels lets us route across sub-segments via shared endpoints.
const splitAirwaySubSegments = (airway: Airway): AirwayPoint[][] => {
  const segs: AirwayPoint[][] = [];
  let current: AirwayPoint[] = [];
  for (const p of airway.points) {
    current.push(p);
    if (p.outboundCourse == null || p.outboundCourse === 0) {
      segs.push(current);
      current = [];
    }
  }
  if (current.length > 0) segs.push(current);
  return segs;
};

interface AirwayIndex {
  subSegs: AirwayPoint[][];
  idToPositions: Map<string, { segIdx: number; ptIdx: number }[]>;
}

const airwayIndexCache = new WeakMap<Airway, AirwayIndex>();

const indexAirway = (airway: Airway): AirwayIndex => {
  const cached = airwayIndexCache.get(airway);
  if (cached) return cached;
  const subSegs = splitAirwaySubSegments(airway);
  const idToPositions = new Map<string, { segIdx: number; ptIdx: number }[]>();
  subSegs.forEach((seg, segIdx) => {
    seg.forEach((pt, ptIdx) => {
      const list = idToPositions.get(pt.identifier);
      if (list) list.push({ segIdx, ptIdx });
      else idToPositions.set(pt.identifier, [{ segIdx, ptIdx }]);
    });
  });
  const index = { subSegs, idToPositions };
  airwayIndexCache.set(airway, index);
  return index;
};

// BFS across the airway's sub-segment graph. Within each sub-segment,
// consecutive points are bidirectional neighbors. Across sub-segments, points
// sharing an identifier are the same node (junction).
const findAirwayPath = (
  airway: Airway,
  fromId: string,
  toId: string,
): AirwayPoint[] | null => {
  const { subSegs, idToPositions } = indexAirway(airway);
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

export interface AirwaySliceResult {
  fixes: RouteFix[];
  airwayIdentifier: string;
}

export const resolveAirwaySegment = async (
  id: string,
  fromId: string,
  toId: string,
): Promise<AirwaySliceResult | null> => {
  const airways = await fetchAirway(id);
  if (airways.length === 0) return null;

  // The API can return multiple airways with the same identifier in different
  // regions; take the first one that yields a path from fromId to toId.
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

const cachedDepartures = async (airport: string): Promise<Procedure[]> =>
  (await loadAirportProceduresSafe(airport)).sids;

const cachedArrivals = async (airport: string): Promise<Procedure[]> =>
  (await loadAirportProceduresSafe(airport)).stars;

// Sequences for the chosen transition. When transition is null OR not
// published, fall back to the trunk; the `fallback` flag tells callers their
// transition input was silently dropped so they can surface a warning.
const sequencesForTransition = (
  procedure: Procedure,
  transition: string | null,
): { sequences: Sequence[]; fallback: boolean } => {
  if (transition !== null) {
    const matched = procedure.sequences.filter((s) => s.transition === transition);
    if (matched.length > 0) return { sequences: matched, fallback: false };
  }
  const trunk = procedure.sequences.filter((s) =>
    isTrunkTransition(s.transition, procedure.identifier),
  );
  return { sequences: trunk, fallback: transition !== null };
};

const findFixInSequences = (sequences: Sequence[], fromEnd: boolean): RouteFix | null => {
  const seqCount = sequences.length;
  for (let si = 0; si < seqCount; si++) {
    const seq = sequences[fromEnd ? seqCount - 1 - si : si];
    const ptCount = seq.points.length;
    for (let pi = 0; pi < ptCount; pi++) {
      const point = seq.points[fromEnd ? ptCount - 1 - pi : pi];
      if (!point.identifier) continue;
      const c = coordPair(point);
      if (!c) continue;
      return { identifier: point.identifier, lat: c.lat, lon: c.lon, label: point.identifier };
    }
  }
  return null;
};

export interface SidStarInput {
  name: string;
  transition: string | null;
}

export interface SidStarResolution {
  procedure: Procedure;
  // SID exit OR STAR entry. May be a synthetic VECTOR-tip for SID, OR null for
  // radar-vectors-only SIDs (SFO4, GAPP7, OAK6) — the builder treats null as
  // "exit at the departure airport with a dashed vector hand-off".
  connectingFix: RouteFix | null;
  transition: string | null;
  endsWithVector: boolean;
  // True when the user supplied a transition that wasn't published; we silently
  // fell back to the trunk and surface this as a soft error.
  transitionFallback: boolean;
}

// When the chosen SID transition's last leg is a manual-termination (vector),
// compute the rendered arrow tip via manualLegTip so the en-route line attaches
// at exactly the rendered tip — including arc-adjustment when the vector leg
// is the first off a steep runway course.
const sidVectorTip = (
  transitionSeqs: Sequence[],
  magneticCorrection: number,
): RouteFix | null => {
  if (transitionSeqs.length === 0) return null;
  const lastSeq = transitionSeqs[transitionSeqs.length - 1];
  if (lastSeq.points.length === 0) return null;
  const lastPoint = lastSeq.points[lastSeq.points.length - 1];
  if (!ARROW_LEGTYPES.includes(lastPoint.legType)) return null;

  let prev: { latitude: number; longitude: number } | null = null;
  for (let i = lastSeq.points.length - 2; i >= 0; i--) {
    const c = coordPair(lastSeq.points[i]);
    if (c) {
      prev = { latitude: c.lat, longitude: c.lon };
      break;
    }
  }
  const isAtRunwayOrigin = prev === null && lastSeq.runwayOrigin != null;
  if (!prev && lastSeq.runwayOrigin) {
    prev = {
      latitude: lastSeq.runwayOrigin.latitude,
      longitude: lastSeq.runwayOrigin.longitude,
    };
  }
  if (!prev) return null;

  const { tip } = manualLegTip(
    prev,
    lastPoint.course,
    magneticCorrection,
    isAtRunwayOrigin ? lastSeq.transition ?? null : null,
  );
  return {
    identifier: VECTOR_FIX_IDENTIFIER,
    lat: tip.latitude,
    lon: tip.longitude,
    label: '',
  };
};

export type SidOrStarKind = Extract<ProcedureKind, 'sid' | 'star'>;

export const resolveSidStar = async (
  input: SidStarInput,
  side: SidOrStarKind,
  airport: string,
): Promise<SidStarResolution | null> => {
  const procedures = side === 'sid' ? await cachedDepartures(airport) : await cachedArrivals(airport);
  const procedure = procedures.find((p) => p.identifier === input.name);
  if (!procedure) return null;

  const { sequences: transitionSeqs, fallback: transitionFallback } =
    sequencesForTransition(procedure, input.transition);
  // Short-circuit only when the user explicitly named a transition AND we
  // couldn't satisfy it. Empty transitionSeqs without a named transition is
  // legitimate for radar-vectors-only SIDs (no trunk, only RW-prefixed
  // sequences) — the builder bridges from the departure airport.
  if (input.transition !== null && transitionSeqs.length === 0) return null;

  let connectingFix: RouteFix | null = null;
  let endsWithVector = false;
  if (side === 'sid') {
    const tip = sidVectorTip(transitionSeqs, procedure.magneticCorrection ?? 0);
    if (tip) {
      connectingFix = tip;
      endsWithVector = true;
    } else {
      connectingFix = findFixInSequences(transitionSeqs, true);
    }
  } else {
    connectingFix = findFixInSequences(transitionSeqs, false);
  }
  return {
    procedure,
    connectingFix,
    transition: input.transition,
    endsWithVector,
    transitionFallback,
  };
};

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
