import { Component, createMemo, For, Show } from 'solid-js';
import { Layer, Source } from 'solid-map-gl';
import { Procedure, ProcedureKind } from '~/lib/types';
import { aggregateFixFeatures, buildProcedureGeometry, sequenceLayerId } from '~/lib/procedureGeojson';

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

export const ProcedurePoints: Component<ProcedurePointsProps> = (props) => {
  const fixFeatures = createMemo(() => aggregateFixFeatures(props.procedures));

  return (
    <>
      <For each={props.procedures}>
        {(procedure) => {
          const geometry = createMemo(() => buildProcedureGeometry(procedure));
          const kind = procedure.kind;

          return (
            <For each={geometry().sequences}>
              {(seqGeom) => {
                const hasLine = seqGeom.lineCoords.length >= 2;
                const hasArrows = seqGeom.arrowFeatures.length > 0;
                if (!hasLine && !hasArrows) return null;
                const id = sequenceLayerId(procedure, seqGeom.sequence);

                return (
                  <>
                    <Show when={hasLine}>
                      <Source
                        id={`${kind}-line-source-${id}`}
                        source={{
                          type: 'geojson',
                          data: {
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: seqGeom.lineCoords },
                            properties: {
                              procedure: procedure.identifier,
                              airport: procedure.airport,
                              transition: seqGeom.sequence.transition,
                            },
                          },
                        }}
                      >
                        <Layer
                          id={`${kind}-line-casing-${id}`}
                          style={{
                            type: 'line',
                            paint: {
                              'line-color': '#ffffff',
                              'line-width': CASING_WIDTH,
                            },
                          }}
                        />
                        <Layer
                          id={`${kind}-line-${id}`}
                          style={{
                            type: 'line',
                            paint: {
                              'line-color': KIND_LINE_COLOR[kind],
                              'line-width': LINE_WIDTH,
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
