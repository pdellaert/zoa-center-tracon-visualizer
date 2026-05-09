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
  Procedure,
  Sequence,
} from '~/lib/types';
import { Coord, RouteFix } from '~/lib/routeTypes';

// Re-exported for any consumer that imports from routeResolver. New code
// should import directly from '~/lib/mapGeometry'.
export { isValidCoord };

///////////////////////////////////////////////////
// Lat/lon parsing
///////////////////////////////////////////////////

const parseLatComponent = (s: string): number => {
  let deg: number;
  let min = 0;
  let sec = 0;
  if (s.length === 2) {
    deg = Number(s);
  } else if (s.length === 4) {
    deg = Number(s.slice(0, 2));
    min = Number(s.slice(2, 4));
  } else if (s.length === 6) {
    deg = Number(s.slice(0, 2));
    min = Number(s.slice(2, 4));
    sec = Number(s.slice(4, 6));
  } else {
    return NaN;
  }
  if (deg > 90 || min >= 60 || sec >= 60) return NaN;
  return deg + min / 60 + sec / 3600;
};

const parseLonComponent = (s: string): number => {
  let deg: number;
  let min = 0;
  let sec = 0;
  if (s.length === 3) {
    deg = Number(s);
  } else if (s.length === 5) {
    deg = Number(s.slice(0, 3));
    min = Number(s.slice(3, 5));
  } else if (s.length === 7) {
    deg = Number(s.slice(0, 3));
    min = Number(s.slice(3, 5));
    sec = Number(s.slice(5, 7));
  } else {
    return NaN;
  }
  if (deg > 180 || min >= 60 || sec >= 60) return NaN;
  return deg + min / 60 + sec / 3600;
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

///////////////////////////////////////////////////
// Caches
///////////////////////////////////////////////////

const pointCache = new Map<string, Promise<PointLookupResult[]>>();
const airwayCache = new Map<string, Promise<Airway[]>>();

// Wrap the shared per-airport loader so a network failure here returns an
// empty pack instead of bubbling up — the route builder treats absent
// procedures as "no SID found" / "no STAR found" rather than aborting.
const EMPTY_PACK: AirportProcedurePack = { sids: [], stars: [], apps: [] };
const loadAirportProceduresSafe = async (airport: string): Promise<AirportProcedurePack> => {
  try {
    return await loadAirportProcedures(airport);
  } catch {
    return EMPTY_PACK;
  }
};

///////////////////////////////////////////////////
// Fix resolution
///////////////////////////////////////////////////

const fetchPoints = (id: string): Promise<PointLookupResult[]> => {
  const cached = pointCache.get(id);
  if (cached) return cached;
  if (!isValidNavdataIdentifier(id)) {
    const empty = Promise.resolve<PointLookupResult[]>([]);
    pointCache.set(id, empty);
    return empty;
  }
  const promise = (async () => {
    const response = await fetch(navdataPointUrl(id));
    if (!response.ok) {
      if (response.status === 404) return [] as PointLookupResult[];
      throw new Error(`Failed to fetch point ${id}`);
    }
    return (await response.json()) as PointLookupResult[];
  })();
  // Don't cache rejections — let the next call retry.
  promise.catch(() => pointCache.delete(id));
  pointCache.set(id, promise);
  return promise;
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

const fetchAirway = (id: string): Promise<Airway[]> => {
  const cached = airwayCache.get(id);
  if (cached) return cached;
  if (!isValidNavdataIdentifier(id)) {
    const empty = Promise.resolve<Airway[]>([]);
    airwayCache.set(id, empty);
    return empty;
  }
  const promise = (async () => {
    const response = await fetch(navdataAirwayUrl(id));
    if (!response.ok) {
      if (response.status === 404) return [] as Airway[];
      throw new Error(`Failed to fetch airway ${id}`);
    }
    return (await response.json()) as Airway[];
  })();
  // Don't cache rejections — let the next call retry.
  promise.catch(() => airwayCache.delete(id));
  airwayCache.set(id, promise);
  return promise;
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
    // The type is `outboundCourse?: number | null`. Treat `0`, `null`, AND
    // `undefined` as sub-segment terminators — all three signal "no outbound
    // leg from this point" in the navdata.
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

// Cache the sub-segment split + identifier index per Airway. The split + index
// build is O(n); without this, every findAirwayPath call rebuilds it from
// scratch even when the same airway is sliced multiple times in a session.
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
  (await loadAirportProceduresSafe(airport)).sids;

const cachedArrivals = async (airport: string): Promise<Procedure[]> =>
  (await loadAirportProceduresSafe(airport)).stars;

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
const sequencesForTransition = (
  procedure: Procedure,
  transition: string | null,
): { sequences: Sequence[]; fallback: boolean } => {
  if (transition !== null) {
    const matched = procedure.sequences.filter((s) => s.transition === transition);
    if (matched.length > 0) return { sequences: matched, fallback: false };
  }
  // No transition specified, OR the specified transition isn't published —
  // fall back to the trunk. The `fallback` flag tells the caller whether the
  // user's transition input was silently dropped so they can surface a warning.
  const trunk = procedure.sequences.filter((s) =>
    isTrunkTransition(s.transition, procedure.identifier),
  );
  return { sequences: trunk, fallback: transition !== null };
};

const firstFixOfSequences = (sequences: Sequence[]): RouteFix | null => {
  for (const seq of sequences) {
    for (const point of seq.points) {
      if (!point.identifier) continue;
      const c = coordPair(point);
      if (!c) continue;
      return { identifier: point.identifier, lat: c.lat, lon: c.lon, label: point.identifier };
    }
  }
  return null;
};

const lastFixOfSequences = (sequences: Sequence[]): RouteFix | null => {
  for (let i = sequences.length - 1; i >= 0; i--) {
    const seq = sequences[i];
    for (let j = seq.points.length - 1; j >= 0; j--) {
      const point = seq.points[j];
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
  // True when the user supplied a transition name that wasn't published on
  // this procedure and we silently fell back to the trunk. The builder
  // surfaces this as a soft error so the user knows their typo was dropped.
  transitionFallback: boolean;
}

/**
 * If the chosen SID transition's LAST point is a manual-termination (vector)
 * leg, compute the arrow tip via the shared manualLegTip helper so the route's
 * en-route line attaches at exactly the rendered arrow tip — including the
 * arc-adjustment when the vector leg is the first leg off a steep runway
 * course. Falls back to the runway origin when no prior coord-bearing fix
 * exists in the transition (single-leg vector exits).
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

  let prev: { latitude: number; longitude: number } | null = null;
  for (let i = lastSeq.points.length - 2; i >= 0; i--) {
    const p = lastSeq.points[i];
    if (isValidCoord(p.latitude, p.longitude)) {
      prev = { latitude: p.latitude as number, longitude: p.longitude as number };
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
    identifier: 'VECTOR',
    lat: tip.latitude,
    lon: tip.longitude,
    label: '',
  };
};

export const resolveSidStar = async (
  input: SidStarInput,
  side: 'sid' | 'star',
  airport: string,
): Promise<SidStarResolution | null> => {
  const procedures = side === 'sid' ? await cachedDepartures(airport) : await cachedArrivals(airport);
  const procedure = procedures.find((p) => p.identifier === input.name);
  if (!procedure) return null;

  // We return the FULL procedure (every sequence the API published) so the
  // existing procedure renderer draws every runway entry / common trunk /
  // exit transition / runway tail. Only the *connecting fix* — the point at
  // which the en-route blue line attaches — is computed from the chosen
  // transition's sequence.
  const { sequences: transitionSeqs, fallback: transitionFallback } =
    sequencesForTransition(procedure, input.transition);
  // Short-circuit only when the user explicitly named a transition AND we
  // couldn't satisfy it (no match + empty trunk). When no transition is
  // specified, an empty transitionSeqs is legitimate: radar-vectors-only
  // SIDs (OAK6, SFO4, GAPP7 …) have only RW-prefixed sequences and no
  // trunk, so the trunk filter returns []. Downstream sidVectorTip and
  // lastFixOfSequences both return null in that case, connectingFix stays
  // null, and the builder bridges from the departure airport with a
  // dashed vector-handoff segment.
  if (input.transition !== null && transitionSeqs.length === 0) return null;

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
    transition: input.transition,
    endsWithVector,
    transitionFallback,
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
