// Unified data model for the rendering layer. A single component
// (AviationOverlayLayers) consumes Overlay[] and emits the Mapbox sources
// + layers; both procedures and routes are reduced to this shape.
//
// Procedure overlays are minted per-sequence (matches sequenceLayerId today),
// route overlays are one per active route. Same renderer for both.

import {
  ArrowFeature,
  FixFeature,
  LineSegment,
} from '~/lib/mapGeometry';
import { Procedure } from '~/lib/types';
import { buildSequenceGeometry, sequenceLayerId } from '~/lib/procedureGeojson';
import { Route } from '~/lib/routeTypes';
import { buildRouteGeometry } from '~/lib/routeGeojson';

export type OverlayKind = 'sid' | 'star' | 'app' | 'route';

export interface Overlay {
  // Stable identifier used as the Mapbox source-id suffix. Must be unique
  // across all simultaneously-rendered overlays.
  id: string;
  kind: OverlayKind;
  lineSegments: LineSegment[];
  arrowFeatures: ArrowFeature[];
  // Fix features local to this overlay. The aggregator dedupes across
  // overlays at render time, picking the richest label per identifier.
  fixFeatures: FixFeature[];
}

// Per-Procedure-reference cache so the overlays array passed to the renderer
// has stable identities across unrelated signal ticks. Without this, every
// re-run of the App.tsx `overlays` memo would mint fresh Overlay objects and
// force Mapbox to tear down + remount every source/layer, even though the
// underlying procedure data hasn't changed.
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

// Single overlay per route. buildRouteGeometry already excludes the SID exit /
// STAR entry fixes from its fixFeatures so the procedure renderer's richer
// labels win at those coordinates.
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
