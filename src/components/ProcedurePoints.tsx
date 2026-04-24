import { Component, createMemo, For, Show } from 'solid-js';
import { Layer, Source } from 'solid-map-gl';
import { Procedure, ProcedureKind } from '~/lib/types';
import {
  aggregateFixFeatures,
  buildProcedureGeometry,
  lineSegmentsToFeatures,
  sequenceLayerId,
} from '~/lib/procedureGeojson';

interface ProcedurePointsProps {
  procedures: Procedure[];
}

const KIND_LINE_COLOR: Record<ProcedureKind, string> = {
  sid: '#10b981',
  star: '#f59e0b',
  app: '#a855f7',
};

const LINE_WIDTH = 3;
const CASING_WIDTH = LINE_WIDTH + 2;
const DASH_PATTERN: [number, number] = [4, 3];
const ANCHOR_LAYER_ID = 'procedure-zorder-anchor';
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

export const ProcedurePoints: Component<ProcedurePointsProps> = (props) => {
  const fixFeatures = createMemo(() => aggregateFixFeatures(props.procedures));

  return (
    <>
      {/* Always-mounted invisible anchor: stable z-position marker so procedure
          line layers can reliably insert below the fix text/points (which mount
          conditionally and would otherwise race with new procedures' layers). */}
      <Source id="procedure-zorder-anchor-source" source={{ type: 'geojson', data: EMPTY_FC }}>
        <Layer
          id={ANCHOR_LAYER_ID}
          style={{ type: 'symbol', layout: { visibility: 'none' } }}
        />
      </Source>

      <For each={props.procedures}>
        {(procedure) => {
          const geometry = createMemo(() => buildProcedureGeometry(procedure));
          const kind = procedure.kind;

          return (
            <For each={geometry().sequences}>
              {(seqGeom) => {
                const hasSegments = seqGeom.lineSegments.some((s) => s.coords.length >= 2);
                const hasArrows = seqGeom.arrowFeatures.length > 0;
                if (!hasSegments && !hasArrows) return null;
                const id = sequenceLayerId(procedure, seqGeom.sequence);

                return (
                  <>
                    <Show when={hasSegments}>
                      <Source
                        id={`${kind}-line-source-${id}`}
                        source={{
                          type: 'geojson',
                          data: {
                            type: 'FeatureCollection',
                            features: lineSegmentsToFeatures(seqGeom.lineSegments),
                          },
                        }}
                      >
                        {/* Solid casing */}
                        <Layer
                          id={`${kind}-line-casing-${id}`}
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
                        {/* Dashed casing */}
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
                        {/* Solid line */}
                        <Layer
                          id={`${kind}-line-${id}`}
                          beforeId={ANCHOR_LAYER_ID}
                          style={{
                            type: 'line',
                            filter: ['==', ['get', 'dashed'], false],
                            paint: {
                              'line-color': KIND_LINE_COLOR[kind],
                              'line-width': LINE_WIDTH,
                            },
                          }}
                        />
                        {/* Dashed line */}
                        <Layer
                          id={`${kind}-line-dash-${id}`}
                          beforeId={ANCHOR_LAYER_ID}
                          style={{
                            type: 'line',
                            filter: ['==', ['get', 'dashed'], true],
                            paint: {
                              'line-color': KIND_LINE_COLOR[kind],
                              'line-width': LINE_WIDTH,
                              'line-dasharray': DASH_PATTERN,
                            },
                          }}
                        />
                      </Source>
                    </Show>

                    <Show when={hasArrows}>
                      <Source
                        id={`${kind}-arrow-source-${id}`}
                        source={{
                          type: 'geojson',
                          data: { type: 'FeatureCollection', features: seqGeom.arrowFeatures },
                        }}
                      >
                        <Layer
                          id={`${kind}-arrow-casing-${id}`}
                          beforeId={ANCHOR_LAYER_ID}
                          style={{
                            type: 'line',
                            layout: { 'line-cap': 'round', 'line-join': 'round' },
                            paint: {
                              'line-color': '#ffffff',
                              'line-width': CASING_WIDTH,
                            },
                          }}
                        />
                        <Layer
                          id={`${kind}-arrow-${id}`}
                          beforeId={ANCHOR_LAYER_ID}
                          style={{
                            type: 'line',
                            layout: { 'line-cap': 'round', 'line-join': 'round' },
                            paint: {
                              'line-color': KIND_LINE_COLOR[kind],
                              'line-width': LINE_WIDTH,
                            },
                          }}
                        />
                      </Source>
                    </Show>
                  </>
                );
              }}
            </For>
          );
        }}
      </For>

      <Show when={fixFeatures().length > 0}>
        <Source
          id="procedure-fix-source"
          source={{
            type: 'geojson',
            data: { type: 'FeatureCollection', features: fixFeatures() },
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
              paint: {
                'text-color': '#000000',
              },
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
    </>
  );
};
