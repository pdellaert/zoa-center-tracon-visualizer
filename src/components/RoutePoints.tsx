import { Component, createMemo, Show } from 'solid-js';
import { Layer, Source } from 'solid-map-gl';
import { Route } from '~/lib/routeTypes';
import { lineSegmentsToFeatures } from '~/lib/procedureGeojson';
import { buildRouteGeometry } from '~/lib/routeGeojson';

interface RoutePointsProps {
  route: Route | null;
}

const ROUTE_LINE_COLOR = '#3b82f6';
const LINE_WIDTH = 3;
const CASING_WIDTH = LINE_WIDTH + 2;
const DASH_PATTERN: [number, number] = [4, 3];
const ANCHOR_LAYER_ID = 'route-zorder-anchor';
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

export const RoutePoints: Component<RoutePointsProps> = (props) => {
  const geometry = createMemo(() =>
    props.route ? buildRouteGeometry(props.route) : { lineSegments: [], fixFeatures: [] },
  );

  return (
    <>
      {/* Always-mounted invisible anchor: stable z-position marker so route
          line layers can reliably insert below the fix text/points. Mounting
          this BEFORE ProcedurePoints in App.tsx ensures route layers sit
          below procedure layers in the rendering stack. */}
      <Source id="route-zorder-anchor-source" source={{ type: 'geojson', data: EMPTY_FC }}>
        <Layer
          id={ANCHOR_LAYER_ID}
          style={{ type: 'symbol', layout: { visibility: 'none' } }}
        />
      </Source>

      <Show when={geometry().lineSegments.length > 0}>
        <Source
          id="route-line-source"
          source={{
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: lineSegmentsToFeatures(geometry().lineSegments),
            },
          }}
        >
          <Layer
            id="route-line-casing"
            beforeId={ANCHOR_LAYER_ID}
            style={{
              type: 'line',
              filter: ['==', ['get', 'dashed'], false],
              paint: {
                'line-color': '#ffffff',
                'line-width': CASING_WIDTH,
              },
            }}
          />
          <Layer
            id="route-line-casing-dash"
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
            id="route-line"
            beforeId={ANCHOR_LAYER_ID}
            style={{
              type: 'line',
              filter: ['==', ['get', 'dashed'], false],
              paint: {
                'line-color': ROUTE_LINE_COLOR,
                'line-width': LINE_WIDTH,
              },
            }}
          />
          <Layer
            id="route-line-dash"
            beforeId={ANCHOR_LAYER_ID}
            style={{
              type: 'line',
              filter: ['==', ['get', 'dashed'], true],
              paint: {
                'line-color': ROUTE_LINE_COLOR,
                'line-width': LINE_WIDTH,
                'line-dasharray': DASH_PATTERN,
              },
            }}
          />
        </Source>
      </Show>

      <Show when={geometry().fixFeatures.length > 0}>
        <Source
          id="route-fix-source"
          source={{
            type: 'geojson',
            data: { type: 'FeatureCollection', features: geometry().fixFeatures },
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
              paint: {
                'text-color': '#000000',
              },
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
