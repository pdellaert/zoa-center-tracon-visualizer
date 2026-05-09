import { Component, createMemo, For, Show } from 'solid-js';
import { Layer, Source } from 'solid-map-gl';
import { lineSegmentsToFeatures } from '~/lib/mapGeometry';
import { aggregateOverlayFixFeatures, Overlay, OverlayKind } from '~/lib/overlay';

interface AviationOverlayLayersProps {
  overlays: Overlay[];
}

const KIND_LINE_COLOR: Record<OverlayKind, string> = {
  sid: '#10b981',
  star: '#f59e0b',
  app: '#a855f7',
  route: '#3b82f6',
};

const LINE_WIDTH = 3;
const CASING_WIDTH = LINE_WIDTH + 2;
const DASH_PATTERN: [number, number] = [4, 3];
const ANCHOR_LAYER_ID = 'aviation-zorder-anchor';
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

export const AviationOverlayLayers: Component<AviationOverlayLayersProps> = (props) => {
  // Two fix sources — procedure (sid/star/app) vs route — mirror the original
  // two-component architecture (ProcedurePoints + RoutePoints). Unifying them
  // into a single source caused initial-mount labels to be invisible until a
  // subsequent overlay change forced solid-map-gl's createEffect on
  // `source.data` to re-fire (Mapbox symbol layers added synchronously after
  // addSource sometimes fail to render their features without a follow-up
  // setData). Splitting the source restores the working pattern.
  const procedureFixFeatures = createMemo(() =>
    aggregateOverlayFixFeatures(props.overlays.filter((o) => o.kind !== 'route')),
  );
  const routeFixFeatures = createMemo(() =>
    aggregateOverlayFixFeatures(props.overlays.filter((o) => o.kind === 'route')),
  );

  return (
    <>
      {/* Always-mounted invisible anchor: stable z-position marker so overlay
          line/arrow layers can reliably insert below the fix text/points
          (which mount conditionally and would otherwise race with new
          overlays' layers). */}
      <Source id="aviation-zorder-anchor-source" source={{ type: 'geojson', data: EMPTY_FC }}>
        <Layer
          id={ANCHOR_LAYER_ID}
          style={{ type: 'symbol', layout: { visibility: 'none' } }}
        />
      </Source>

      <For each={props.overlays}>
        {(overlay) => {
          const lineFeatures = createMemo(() => lineSegmentsToFeatures(overlay.lineSegments));
          const hasSegments = () => overlay.lineSegments.some((s) => s.coords.length >= 2);
          const hasArrows = () => overlay.arrowFeatures.length > 0;
          const kind = overlay.kind;
          const id = overlay.id;
          const color = KIND_LINE_COLOR[kind];

          return (
            <>
              <Show when={hasSegments()}>
                <Source
                  id={`${kind}-line-source-${id}`}
                  source={{
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: lineFeatures() },
                  }}
                >
                  <Layer
                    id={`${kind}-line-casing-${id}`}
                    beforeId={ANCHOR_LAYER_ID}
                    style={{
                      type: 'line',
                      filter: ['==', ['get', 'dashed'], false],
                      paint: { 'line-color': '#ffffff', 'line-width': CASING_WIDTH },
                    }}
                  />
                  <Layer
                    id={`${kind}-line-casing-dash-${id}`}
                    beforeId={ANCHOR_LAYER_ID}
                    style={{
                      type: 'line',
                      filter: ['==', ['get', 'dashed'], true],
                      paint: {
                        'line-color': '#ffffff',
                        'line-width': CASING_WIDTH,
                        'line-dasharray': DASH_PATTERN,
                      },
                    }}
                  />
                  <Layer
                    id={`${kind}-line-${id}`}
                    beforeId={ANCHOR_LAYER_ID}
                    style={{
                      type: 'line',
                      filter: ['==', ['get', 'dashed'], false],
                      paint: { 'line-color': color, 'line-width': LINE_WIDTH },
                    }}
                  />
                  <Layer
                    id={`${kind}-line-dash-${id}`}
                    beforeId={ANCHOR_LAYER_ID}
                    style={{
                      type: 'line',
                      filter: ['==', ['get', 'dashed'], true],
                      paint: {
                        'line-color': color,
                        'line-width': LINE_WIDTH,
                        'line-dasharray': DASH_PATTERN,
                      },
                    }}
                  />
                </Source>
              </Show>

              <Show when={hasArrows()}>
                <Source
                  id={`${kind}-arrow-source-${id}`}
                  source={{
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: overlay.arrowFeatures },
                  }}
                >
                  <Layer
                    id={`${kind}-arrow-casing-${id}`}
                    beforeId={ANCHOR_LAYER_ID}
                    style={{
                      type: 'line',
                      layout: { 'line-cap': 'round', 'line-join': 'round' },
                      paint: { 'line-color': '#ffffff', 'line-width': CASING_WIDTH },
                    }}
                  />
                  <Layer
                    id={`${kind}-arrow-${id}`}
                    beforeId={ANCHOR_LAYER_ID}
                    style={{
                      type: 'line',
                      layout: { 'line-cap': 'round', 'line-join': 'round' },
                      paint: { 'line-color': color, 'line-width': LINE_WIDTH },
                    }}
                  />
                </Source>
              </Show>
            </>
          );
        }}
      </For>

      <Show when={procedureFixFeatures().length > 0}>
        <Source
          id="procedure-fix-source"
          source={{
            type: 'geojson',
            data: { type: 'FeatureCollection', features: procedureFixFeatures() },
          }}
        >
          <Layer
            id="procedure-fix-text-layer"
            style={{
              type: 'symbol',
              layout: {
                'text-field': ['get', 'text'],
                'text-rotation-alignment': 'auto',
                'text-allow-overlap': true,
                'text-anchor': 'top',
                'text-size': 12,
                'text-offset': [0, 0.5],
              },
              paint: { 'text-color': '#000000' },
            }}
          />
          <Layer
            id="procedure-fix-points"
            style={{
              type: 'circle',
              paint: {
                'circle-radius': 4,
                'circle-color': '#000000',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
              },
            }}
          />
        </Source>
      </Show>

      <Show when={routeFixFeatures().length > 0}>
        <Source
          id="route-fix-source"
          source={{
            type: 'geojson',
            data: { type: 'FeatureCollection', features: routeFixFeatures() },
          }}
        >
          <Layer
            id="route-fix-text-layer"
            style={{
              type: 'symbol',
              layout: {
                'text-field': ['get', 'text'],
                'text-rotation-alignment': 'auto',
                'text-allow-overlap': true,
                'text-anchor': 'top',
                'text-size': 12,
                'text-offset': [0, 0.5],
              },
              paint: { 'text-color': '#000000' },
            }}
          />
          <Layer
            id="route-fix-points"
            style={{
              type: 'circle',
              paint: {
                'circle-radius': 4,
                'circle-color': '#000000',
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
              },
            }}
          />
        </Source>
      </Show>
    </>
  );
};
