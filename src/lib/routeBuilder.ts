import { fetchAirportInfo } from '~/lib/procedureApi';
import { coordPair } from '~/lib/mapGeometry';
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
  consumedTokens: 0 | 1 | 2;
  sidInput: SidStarInput | null;
}

interface TailDecision {
  consumedTokens: 0 | 1 | 2;
  starInput: SidStarInput | null;
}

const airportFix = (identifier: string, coord: Coord): RouteFix => ({
  identifier,
  lat: coord.lat,
  lon: coord.lon,
  label: identifier,
});

const headTokenStr = (tokens: ClassifiedToken[], head: HeadDecision): string =>
  head.consumedTokens === 2 ? `${tokens[0].raw} ${tokens[1].raw}` : tokens[0].raw;

const tailTokenStr = (tokens: ClassifiedToken[], tail: TailDecision): string => {
  const lastIdx = tokens.length - 1;
  return tail.consumedTokens === 2
    ? `${tokens[lastIdx - 1].raw} ${tokens[lastIdx].raw}`
    : tokens[lastIdx].raw;
};

const detectHead = async (tokens: ClassifiedToken[], departure: string): Promise<HeadDecision> => {
  if (tokens.length === 0) return { consumedTokens: 0, sidInput: null };
  const first = tokens[0];
  if (first.raw.includes('.')) {
    const [name, transition] = first.raw.split('.');
    return { consumedTokens: 1, sidInput: { name, transition: transition || null } };
  }
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
    // STAR convention: <transition>.<STAR>
    const parts = last.raw.split('.');
    return {
      consumedTokens: 1,
      starInput: { name: parts[1] || parts[0], transition: parts[1] ? parts[0] : null },
    };
  }
  const star = await findStarByName(destination, last.raw);
  if (!star) return { consumedTokens: 0, starInput: null };
  const prevIdx = tokens.length - 2;
  // Allow head and tail to co-own the boundary token: a fix published as a
  // transition under BOTH the SID and STAR (e.g. ORRCA in `TRUKN2 ORRCA
  // ORRCA1`). Without this, the head greedy-consumes ORRCA and the tail can't
  // see it. With prevIdx == reservedHead - 1, the body slice clamps to empty
  // and SID exit / STAR entry land at the same coord.
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
  return resolveFix(tok.raw, anchor);
};

export const buildRoute = async (input: RouteInput): Promise<Route> => {
  const errors: RouteError[] = [];

  // Kick off all four fetches in parallel. The airport-info cache makes the
  // fetchAirportInfo calls inside loadAirportProcedures (via prefetch*) free.
  const depPrefetchP = prefetchDepartures(input.departure);
  const destPrefetchP = prefetchArrivals(input.destination);
  const [depResult, destResult] = await Promise.allSettled([
    fetchAirportInfo(input.departure),
    fetchAirportInfo(input.destination),
  ]);
  const depInfo = depResult.status === 'fulfilled' ? depResult.value : null;
  const destInfo = destResult.status === 'fulfilled' ? destResult.value : null;
  if (depResult.status === 'rejected') {
    errors.push({ token: input.departure, reason: 'Could not fetch departure airport info' });
  }
  if (destResult.status === 'rejected') {
    errors.push({ token: input.destination, reason: 'Could not fetch destination airport info' });
  }
  await Promise.allSettled([depPrefetchP, destPrefetchP]);

  const departureCoord = depInfo ? coordPair(depInfo) : null;
  const destinationCoord = destInfo ? coordPair(destInfo) : null;

  if (input.raw.trim() === '' && departureCoord && destinationCoord) {
    return {
      departure: input.departure,
      destination: input.destination,
      raw: input.raw,
      segments: [
        {
          kind: 'direct',
          from: airportFix(input.departure, departureCoord),
          to: airportFix(input.destination, destinationCoord),
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

  const bodyStart = head.consumedTokens;
  // Clamp to empty when head/tail co-own the boundary token (see detectTail).
  const bodyEnd = Math.max(bodyStart, tokens.length - tail.consumedTokens);
  const bodyTokens = tokens.slice(bodyStart, bodyEnd);

  let sidProcedure: Route['sidProcedure'] = null;
  let sidTransition: string | null = null;
  let sidExitFix: RouteFix | null = null;
  let lastFix: RouteFix | null = null;
  let anchor: Coord | null = departureCoord;
  // True when the chosen SID transition ends in a vector (manual-termination
  // arrow): the FIRST post-SID segment renders dashed and starts at the arrow
  // tip, representing the implicit ATC vector hand-off.
  let nextSegmentDashed = false;

  if (head.sidInput) {
    const resolved = await resolveSidStar(head.sidInput, 'sid', input.departure);
    if (!resolved) {
      errors.push({
        token: headTokenStr(tokens, head),
        reason: `SID "${head.sidInput.name}" not found at ${input.departure}`,
      });
    } else {
      sidProcedure = resolved.procedure;
      sidTransition = resolved.transition;
      sidExitFix = resolved.connectingFix;
      if (resolved.transitionFallback && head.sidInput.transition) {
        errors.push({
          token: headTokenStr(tokens, head),
          reason: `Transition "${head.sidInput.transition}" not published for ${head.sidInput.name} — using trunk`,
        });
      }
      if (resolved.connectingFix) {
        lastFix = resolved.connectingFix;
        anchor = { lat: resolved.connectingFix.lat, lon: resolved.connectingFix.lon };
        nextSegmentDashed = resolved.endsWithVector;
      } else {
        // Radar-vectors-only SID (SFO4, GAPP7, OAK6 …): no published exit fix.
        // The dep-airport seed below + dashed flag bridges to the first fix.
        nextSegmentDashed = true;
      }
    }
  }

  if (!lastFix && departureCoord) {
    lastFix = airportFix(input.departure, departureCoord);
    anchor = departureCoord;
  }

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
      // The airway terminates at the next body token, OR — if the airway sits
      // at the body's tail — at the STAR's transition fix (already swallowed
      // by tail-fusion). E.g. `... B453 MDO WITTI5` where MDO is both the
      // airway endpoint and the STAR's entry transition.
      const next = bodyTokens[i + 1];
      let terminalId: string | null = null;
      let consumed = 2;
      if (next && (next.type === 'fix' || next.type === 'airway')) {
        terminalId = next.raw;
      } else if (i === bodyTokens.length - 1 && tail.starInput?.transition) {
        terminalId = tail.starInput.transition;
        consumed = 1;
      }
      if (!terminalId) {
        errors.push({ token: tok.raw, reason: 'Airway needs a following fix' });
        i += 1;
        continue;
      }
      const slice = await resolveAirwaySegment(tok.raw, lastFix.identifier, terminalId);
      if (!slice) {
        // Recovery 1: the "airway" token may actually be a fix (e.g., V52).
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
        // Recovery 2: airway exists but the response omits both endpoints
        // (common across borders — J523 ends at CFSKH, data omits the rest
        // into Canada). Draw a direct to keep the route connected; warn.
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
      nextSegmentDashed = false;
      lastFix = slice.fixes[slice.fixes.length - 1];
      anchor = { lat: lastFix.lat, lon: lastFix.lon };
      i += consumed;
      continue;
    }

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

  let starProcedure: Route['starProcedure'] = null;
  let starTransition: string | null = null;
  let starEntryFix: RouteFix | null = null;
  if (tail.starInput) {
    const resolved = await resolveSidStar(tail.starInput, 'star', input.destination);
    if (!resolved) {
      errors.push({
        token: tailTokenStr(tokens, tail),
        reason: `STAR "${tail.starInput.name}" not found at ${input.destination}`,
      });
    } else {
      starProcedure = resolved.procedure;
      starTransition = resolved.transition;
      starEntryFix = resolved.connectingFix;
      if (resolved.transitionFallback && tail.starInput.transition) {
        errors.push({
          token: tailTokenStr(tokens, tail),
          reason: `Transition "${tail.starInput.transition}" not published for ${tail.starInput.name} — using trunk`,
        });
      }
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

  // No STAR: land the en-route line at the destination airport so it doesn't
  // dangle at the last filed fix. With a STAR, its runway-tail handles this.
  if (!starProcedure && lastFix && destinationCoord) {
    segments.push({
      kind: 'direct',
      from: lastFix,
      to: airportFix(input.destination, destinationCoord),
      dashed: nextSegmentDashed,
    });
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
