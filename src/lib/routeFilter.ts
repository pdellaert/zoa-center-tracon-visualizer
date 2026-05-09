import { Sequence } from '~/lib/types';

// Trunk = applies regardless of chosen transition. The navdata uses 'ALL' for
// runway-common tails of STARs (and some SIDs), alongside the
// empty/null/procedure-named conventions.
export const isTrunkTransition = (
  t: string | null | undefined,
  procedureIdentifier: string,
): boolean => !t || t === '' || t === procedureIdentifier || t === 'ALL';

// True when the sequence belongs to a route's path: trunk, per-runway (RWnn),
// or the chosen transition. Sibling transitions are excluded so the map shows
// only the path the route actually flies — the full procedure renders only
// when the user toggles it from the sidebar.
export const isRouteRelevantSequence = (
  seq: Sequence,
  procedureIdentifier: string,
  chosenTransition: string | null,
): boolean => {
  const t = seq.transition;
  if (isTrunkTransition(t, procedureIdentifier)) return true;
  if (t && /^RW\d/.test(t)) return true;
  return chosenTransition !== null && t === chosenTransition;
};
