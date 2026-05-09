import {
  ArrowFeature,
  FixFeature,
  LineSegment,
} from '~/lib/mapGeometry';
import { Procedure } from '~/lib/types';
import { buildSequenceGeometry, sequenceLayerId } from '~/lib/procedureGeojson';
import { isRouteRelevantSequence } from '~/lib/routeFilter';
import { Route } from '~/lib/routeTypes';
import { buildRouteGeometry } from '~/lib/routeGeojson';

export type OverlayKind = 'sid' | 'star' | 'app' | 'route';

export interface Overlay {
  // Used as the Mapbox source-id suffix; must be unique across simultaneously-
  // rendered overlays.
  id: string;
  kind: OverlayKind;
  lineSegments: LineSegment[];
  arrowFeatures: ArrowFeature[];
  fixFeatures: FixFeature[];
}

// Stable identities across signal ticks: without this, every overlays-memo
// re-run would mint fresh objects and force Mapbox to tear down/remount every
// source/layer, even when the underlying procedure data hasn't changed.
const procedureOverlaysCache = new WeakMap<Procedure, Overlay[]>();

export const buildProcedureOverlays = (procedure: Procedure): Overlay[] => {
  const cached = procedureOverlaysCache.get(procedure);
  if (cached) return cached;
  const correction = procedure.magneticCorrection ?? 0;
  const overlays = procedure.sequences.map((sequence) => {
    const geom = buildSequenceGeometry(sequence, procedure.kind, correction);
    return {
      id: sequenceLayerId(procedure, sequence),
      kind: procedure.kind,
      lineSegments: geom.lineSegments,
      arrowFeatures: geom.arrowFeatures,
      fixFeatures: geom.fixFeatures,
    };
  });
  procedureOverlaysCache.set(procedure, overlays);
  return overlays;
};

// Stable Procedure ref per (originalProcedure, transition) so route resubmits
// hit procedureOverlaysCache. Without this, the spread literal in
// filterProcedureForRoute mints a fresh Procedure each call and the outer
// cache (keyed by reference) misses every tick.
const filteredByTransition = new WeakMap<Procedure, Map<string, Procedure>>();

export const filterProcedureForRoute = (
  procedure: Procedure,
  transition: string | null,
): Procedure => {
  const key = transition ?? '';
  let inner = filteredByTransition.get(procedure);
  if (!inner) {
    inner = new Map();
    filteredByTransition.set(procedure, inner);
  } else {
    const cached = inner.get(key);
    if (cached) return cached;
  }
  const filtered: Procedure = {
    ...procedure,
    sequences: procedure.sequences.filter((s) =>
      isRouteRelevantSequence(s, procedure.identifier, transition),
    ),
  };
  inner.set(key, filtered);
  return filtered;
};

const routeOverlayCache = new WeakMap<Route, Overlay>();

export const buildRouteOverlay = (route: Route): Overlay => {
  const cached = routeOverlayCache.get(route);
  if (cached) return cached;
  const geom = buildRouteGeometry(route);
  const overlay: Overlay = {
    id: 'route',
    kind: 'route',
    lineSegments: geom.lineSegments,
    arrowFeatures: [],
    fixFeatures: geom.fixFeatures,
  };
  routeOverlayCache.set(route, overlay);
  return overlay;
};

const pickBetterFix = (a: FixFeature, b: FixFeature): FixFeature =>
  b.properties.text.length > a.properties.text.length ? b : a;

export const aggregateOverlayFixFeatures = (overlays: Overlay[]): FixFeature[] => {
  const bestByIdentifier = new Map<string, FixFeature>();
  for (const overlay of overlays) {
    for (const feat of overlay.fixFeatures) {
      const id = feat.properties.identifier;
      if (!id) continue;
      const existing = bestByIdentifier.get(id);
      bestByIdentifier.set(id, existing ? pickBetterFix(existing, feat) : feat);
    }
  }
  return Array.from(bestByIdentifier.values());
};
