// Predicates for filtering procedure sequences when a route pushes a SID/STAR
// through the rendering pipeline. The user-toggled procedures (sidebar) always
// render in full; route-pushed procedures are sliced to just the path the
// route actually flies.

import { Sequence } from '~/lib/types';

// Sequences that the API considers part of the procedure's "trunk" — the
// path that applies regardless of which transition (if any) you chose. The
// navdata uses 'ALL' for runway-common tails of STARs (and some SIDs), in
// addition to the more obvious empty/null/procedure-named conventions.
export const isTrunkTransition = (
  t: string | null | undefined,
  procedureIdentifier: string,
): boolean => !t || t === '' || t === procedureIdentifier || t === 'ALL';

// True when the sequence belongs to the chosen route path:
//   - trunk (empty/null, equals procedure name, or 'ALL')
//   - per-runway entry (SID) or runway tail (STAR) — `RWnn` prefix
//   - the chosen transition (when one was filed)
// Sibling transitions (other published exits/entries) are excluded so the
// map shows only the path the route actually takes. The full procedure is
// drawn only when the user explicitly toggles it via the Procedures sidebar.
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
