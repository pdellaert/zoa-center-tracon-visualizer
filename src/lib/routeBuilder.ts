import { fetchAirportInfo } from '~/lib/procedureApi';
import { parseRoute, ClassifiedToken } from '~/lib/routeParser';
import {
  findSidByName,
  findStarByName,
  latLonTokenToFix,
  parseFixRadialDistance,
  prefetchArrivals,
  prefetchDepartures,
  procedureHasTransition,
  resolveAirwaySegment,
  resolveFix,
  resolveSidStar,
  SidStarInput,
} from '~/lib/routeResolver';
import {
  Coord,
  Route,
  RouteError,
  RouteFix,
  RouteInput,
  RouteSegment,
} from '~/lib/routeTypes';

interface HeadDecision {
  consumedTokens: number; // 0, 1, or 2
  sidInput: SidStarInput | null;
}

interface TailDecision {
  consumedTokens: number; // 0, 1, or 2
  starInput: SidStarInput | null;
}

const detectHead = async (tokens: ClassifiedToken[], departure: string): Promise<HeadDecision> => {
  if (tokens.length === 0) return { consumedTokens: 0, sidInput: null };
  const first = tokens[0];
  if (first.raw.includes('.')) {
    const [name, transition] = first.raw.split('.');
    return { consumedTokens: 1, sidInput: { name, transition: transition || null } };
  }
  // No dot — try to fuse against the airport's published SIDs.
  const sid = await findSidByName(departure, first.raw);
  if (!sid) return { consumedTokens: 0, sidInput: null };
  if (tokens.length >= 2 && procedureHasTransition(sid, tokens[1].raw)) {
    return { consumedTokens: 2, sidInput: { name: first.raw, transition: tokens[1].raw } };
  }
  return { consumedTokens: 1, sidInput: { name: first.raw, transition: null } };
};

const detectTail = async (
  tokens: ClassifiedToken[],
  destination: string,
  reservedHead: number,
): Promise<TailDecision> => {
  if (tokens.length === 0 || tokens.length <= reservedHead - 1) {
    return { consumedTokens: 0, starInput: null };
  }
  const last = tokens[tokens.length - 1];
  if (last.raw.includes('.')) {
    const parts = last.raw.split('.');
    // STAR convention: <transition>.<STAR>
    return {
      consumedTokens: 1,
      starInput: { name: parts[1] || parts[0], transition: parts[1] ? parts[0] : null },
    };
  }
  const star = await findStarByName(destination, last.raw);
  if (!star) return { consumedTokens: 0, starInput: null };
  const prevIdx = tokens.length - 2;
  // Allow the tail to share its boundary token with the head: when a single
  // fix is published as a transition under BOTH the SID (head) and the STAR
  // (tail) — e.g., the ORRCA fix in `TRUKN2 ORRCA ORRCA1` — the head greedy-
  // consumes it as the SID exit, but the tail still wants it as the STAR
  // entry. Letting prevIdx == reservedHead - 1 means the tail "co-owns" that
  // token: the body slice will be empty rather than negative, the SID exit
  // and STAR entry land at the same coord, and the route renders cleanly.
  if (prevIdx >= reservedHead - 1 && procedureHasTransition(star, tokens[prevIdx].raw)) {
    return {
      consumedTokens: 2,
      starInput: { name: last.raw, transition: tokens[prevIdx].raw },
    };
  }
  return { consumedTokens: 1, starInput: { name: last.raw, transition: null } };
};

const resolveBodyToken = async (
  tok: ClassifiedToken,
  anchor: Coord | null,
): Promise<RouteFix | null> => {
  if (tok.type === 'latlon') return latLonTokenToFix(tok.raw);
  if (tok.type === 'frd') return parseFixRadialDistance(tok.raw, anchor);
  // Treat 'fix' and 'airway' (when used as a fix) the same way — both are
  // identifier lookups. The airway-vs-fix distinction matters only when the
  // token is being interpreted as an airway between two surrounding fixes.
  return resolveFix(tok.raw, anchor);
};

export const buildRoute = async (input: RouteInput): Promise<Route> => {
  const errors: RouteError[] = [];

  const [depInfo, destInfo] = await Promise.all([
    fetchAirportInfo(input.departure),
    fetchAirportInfo(input.destination),
  ]);

  // Best-effort prefetch — not fatal if missing (errors will surface later).
  await Promise.allSettled([
    prefetchDepartures(input.departure),
    prefetchArrivals(input.destination),
  ]);

  const departureCoord: Coord | null =
    depInfo && depInfo.latitude !== null && depInfo.longitude !== null
      ? { lat: depInfo.latitude, lon: depInfo.longitude }
      : null;
  const destinationCoord: Coord | null =
    destInfo && destInfo.latitude !== null && destInfo.longitude !== null
      ? { lat: destInfo.latitude, lon: destInfo.longitude }
      : null;

  // Empty-route fast path: when the user provides only departure + destination
  // (no fixes, no SID/STAR), draw a single direct line between the two airports.
  if (input.raw.trim() === '' && departureCoord && destinationCoord) {
    return {
      departure: input.departure,
      destination: input.destination,
      raw: input.raw,
      segments: [
        {
          kind: 'direct',
          from: {
            identifier: input.departure,
            lat: departureCoord.lat,
            lon: departureCoord.lon,
            label: input.departure,
          },
          to: {
            identifier: input.destination,
            lat: destinationCoord.lat,
            lon: destinationCoord.lon,
            label: input.destination,
          },
        },
      ],
      sidProcedure: null,
      starProcedure: null,
      sidTransition: null,
      starTransition: null,
      sidExitFix: null,
      starEntryFix: null,
      errors,
    };
  }

  const { tokens } = parseRoute(input.raw);

  const head = await detectHead(tokens, input.departure);
  const tail = await detectTail(tokens, input.destination, head.consumedTokens);

  // When head and tail co-own a boundary token (see detectTail), the slice
  // bounds invert by one — clamp to an empty slice instead of letting
  // Array.prototype.slice produce surprising results.
  const bodyStart = head.consumedTokens;
  const bodyEnd = Math.max(bodyStart, tokens.length - tail.consumedTokens);
  const bodyTokens = tokens.slice(bodyStart, bodyEnd);

  // Resolve SID first so its exit fix can anchor the body.
  let sidProcedure: Route['sidProcedure'] = null;
  let sidTransition: string | null = null;
  let sidExitFix: RouteFix | null = null;
  let lastFix: RouteFix | null = null;
  let anchor: Coord | null = departureCoord;
  // When the SID's chosen transition ends in a vector (manual-termination
  // arrow), the FIRST segment we emit after the SID should be dashed and
  // begin at the arrow tip — that's the implicit ATC vector handoff.
  let nextSegmentDashed = false;

  if (head.sidInput) {
    const resolved = await resolveSidStar(head.sidInput, 'sid', input.departure);
    if (!resolved) {
      const tokenStr = head.consumedTokens === 2
        ? `${tokens[0].raw} ${tokens[1].raw}`
        : tokens[0].raw;
      errors.push({ token: tokenStr, reason: `SID "${head.sidInput.name}" not found at ${input.departure}` });
    } else {
      sidProcedure = resolved.procedure;
      sidTransition = resolved.transition;
      sidExitFix = resolved.connectingFix;
      if (resolved.connectingFix) {
        lastFix = resolved.connectingFix;
        anchor = { lat: resolved.connectingFix.lat, lon: resolved.connectingFix.lon };
        nextSegmentDashed = resolved.endsWithVector;
      } else {
        // Radar-vectors-only SID (SFO4, GAPP7, OAK6 …): the procedure exists
        // but has no published exit fix. The SID still draws via its runway
        // sequences; we'll bridge from the departure airport (dep-airport
        // fallback below) to the first filed fix with a dashed segment to
        // represent the ATC vector hand-off.
        nextSegmentDashed = true;
      }
    }
  }

  // Seed the en-route line at the departure airport whenever no SID exit
  // fix is available — covers both "no SID filed" and "SID found but
  // exit-fix unknown" (radar-vectors).
  if (!lastFix && departureCoord) {
    lastFix = {
      identifier: input.departure,
      lat: departureCoord.lat,
      lon: departureCoord.lon,
      label: input.departure,
    };
    anchor = departureCoord;
  }

  // Body iteration. Each token's resolution is wrapped so a transient failure
  // (5xx on a fix lookup, parse error, etc.) doesn't abort the whole route —
  // the bad token is recorded in `errors[]` and we move on.
  const segments: RouteSegment[] = [];
  let i = 0;
  while (i < bodyTokens.length) {
    const tok = bodyTokens[i];

    if (tok.type === 'dct') {
      i += 1;
      continue;
    }

    try {
    if (tok.type === 'airway') {
      if (!lastFix) {
        errors.push({ token: tok.raw, reason: 'Airway needs a preceding fix' });
        i += 1;
        continue;
      }
      // Determine the airway's terminal fix identifier. Normally this is the
      // next body token (a fix). But when the airway sits at the very end of
      // the body and the tail STAR has a transition, that transition fix has
      // been swallowed by the tail-fusion step — use its identifier instead.
      // (Example: `... B453 MDO WITTI5` where MDO is both the airway's
      // endpoint and the STAR's entry transition.)
      const next = bodyTokens[i + 1];
      let terminalId: string | null = null;
      let consumed = 2;
      if (next && (next.type === 'fix' || next.type === 'airway')) {
        terminalId = next.raw;
      } else if (i === bodyTokens.length - 1 && tail.starInput?.transition) {
        terminalId = tail.starInput.transition;
        consumed = 1; // the STAR transition fix isn't part of the body
      }
      if (!terminalId) {
        errors.push({ token: tok.raw, reason: 'Airway needs a following fix' });
        i += 1;
        continue;
      }
      const slice = await resolveAirwaySegment(tok.raw, lastFix.identifier, terminalId);
      if (!slice) {
        // Recovery 1: maybe the "airway" token is actually a 5-character fix
        // (e.g., V52). If it resolves as a fix, treat it as one.
        const asFix = await resolveBodyToken({ ...tok, type: 'fix' }, anchor);
        if (asFix) {
          if (lastFix)
            segments.push({ kind: 'direct', from: lastFix, to: asFix, dashed: nextSegmentDashed });
          nextSegmentDashed = false;
          lastFix = asFix;
          anchor = { lat: asFix.lat, lon: asFix.lon };
          i += 1;
          continue;
        }
        // Recovery 2: airway exists, but the navdata response doesn't include
        // both endpoints (common where airways cross national boundaries —
        // e.g., J523 ends at CFSKH and the data omits the rest into Canada).
        // Resolve the terminal fix as a standalone point and draw a direct
        // line so the route stays connected; surface a warning.
        const fromIdentifier = lastFix.identifier;
        const terminalFix = await resolveFix(terminalId, anchor);
        if (terminalFix) {
          segments.push({
            kind: 'direct',
            from: lastFix,
            to: terminalFix,
            dashed: nextSegmentDashed,
          });
          nextSegmentDashed = false;
          lastFix = terminalFix;
          anchor = { lat: terminalFix.lat, lon: terminalFix.lon };
          errors.push({
            token: tok.raw,
            reason: `Airway doesn't connect ${fromIdentifier} and ${terminalId} — drew direct`,
          });
          i += consumed;
          continue;
        }
        errors.push({
          token: tok.raw,
          reason: `Airway not found between ${lastFix.identifier} and ${terminalId}`,
        });
        i += 1;
        continue;
      }
      segments.push({
        kind: 'airway',
        identifier: slice.airwayIdentifier,
        fixes: slice.fixes,
      });
      // Reset dashed flag once we've crossed an airway boundary; the vector
      // hand-off only applies to the very first post-SID hop.
      nextSegmentDashed = false;
      lastFix = slice.fixes[slice.fixes.length - 1];
      anchor = { lat: lastFix.lat, lon: lastFix.lon };
      i += consumed;
      continue;
    }

    // 'fix', 'latlon', 'frd'
    const fix = await resolveBodyToken(tok, anchor);
    if (!fix) {
      errors.push({ token: tok.raw, reason: `Could not resolve ${tok.type}` });
      i += 1;
      continue;
    }
    if (lastFix)
      segments.push({ kind: 'direct', from: lastFix, to: fix, dashed: nextSegmentDashed });
    nextSegmentDashed = false;
    lastFix = fix;
    anchor = { lat: fix.lat, lon: fix.lon };
    i += 1;
    } catch (err) {
      errors.push({
        token: tok.raw,
        reason: err instanceof Error ? err.message : String(err),
      });
      i += 1;
    }
  }

  // Resolve STAR at the tail
  let starProcedure: Route['starProcedure'] = null;
  let starTransition: string | null = null;
  let starEntryFix: RouteFix | null = null;
  if (tail.starInput) {
    const resolved = await resolveSidStar(tail.starInput, 'star', input.destination);
    if (!resolved) {
      const lastIdx = tokens.length - 1;
      const tokenStr = tail.consumedTokens === 2
        ? `${tokens[lastIdx - 1].raw} ${tokens[lastIdx].raw}`
        : tokens[lastIdx].raw;
      errors.push({
        token: tokenStr,
        reason: `STAR "${tail.starInput.name}" not found at ${input.destination}`,
      });
    } else {
      starProcedure = resolved.procedure;
      starTransition = resolved.transition;
      starEntryFix = resolved.connectingFix;
      if (
        lastFix &&
        resolved.connectingFix &&
        lastFix.identifier !== resolved.connectingFix.identifier
      ) {
        segments.push({
          kind: 'direct',
          from: lastFix,
          to: resolved.connectingFix,
          dashed: nextSegmentDashed,
        });
        nextSegmentDashed = false;
      }
    }
  }

  // Final leg: when no STAR is in play, the en-route line should land at the
  // destination airport itself rather than dangling at the last filed fix.
  // (When a STAR is present, its own runway-tail sequences carry the path to
  // the runway, so adding a redundant straight line would draw under it.)
  if (!starProcedure && lastFix && destinationCoord) {
    const airportFix: RouteFix = {
      identifier: input.destination,
      lat: destinationCoord.lat,
      lon: destinationCoord.lon,
      label: input.destination,
    };
    segments.push({ kind: 'direct', from: lastFix, to: airportFix, dashed: nextSegmentDashed });
    nextSegmentDashed = false;
  }

  return {
    departure: input.departure,
    destination: input.destination,
    raw: input.raw,
    segments,
    sidProcedure,
    starProcedure,
    sidTransition,
    starTransition,
    sidExitFix,
    starEntryFix,
    errors,
  };
};
