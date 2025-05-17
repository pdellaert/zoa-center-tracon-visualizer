import { AppDisplayState, CenterDisplayState } from '../types';
import { Component, createEffect, For } from 'solid-js';
import { Layer } from 'solid-map-gl';
import { createStore, produce } from 'solid-js/store';
import { logIfDev } from '~/lib/dev.ts';

interface GeojsonPolyLayersProps {
  displayStateStore: AppDisplayState;
}

interface MapboxDisplayState extends CenterDisplayState {
  isDisplayedTransparent: boolean;
  isDisplayedColor: boolean;
}

const createStartingLayers = (allPolys: AppDisplayState): MapboxDisplayState[] =>
  allPolys.centerDisplayStates.flatMap((a) =>
    a.sectors.map((s) => ({
      name: s.name,
      isDisplayed: false,
      color: s.color,
      isDisplayedTransparent: false,
      isDisplayedColor: false,
    })),
  );

export const GeojsonPolyLayers: Component<GeojsonPolyLayersProps> = (props) => {
  const startingLayers = createStartingLayers(props.displayStateStore);
  logIfDev('Starting map layers', startingLayers);
  const [allLayers, setAllLayers] = createStore(startingLayers);

  createEffect(() => {
    let displayFlat = props.displayStateStore.centerDisplayStates.flatMap((area) => area.sectors);

    let displayMap: Map<string, CenterDisplayState> = new Map();
    displayFlat.forEach((s) => displayMap.set(s.name, s));

    logIfDev('Starting update of layers');
    logIfDev('Intended display state before signals', displayMap);

    setAllLayers(
      (layer) => displayMap.has(layer.name),
      produce((layer) => {
        let displayLayer = displayMap.get(layer.name)!;
        layer.color = displayLayer.color;
        layer.isDisplayedTransparent = !displayLayer.isDisplayed;
        layer.isDisplayedColor = displayLayer.isDisplayed;
      }),
    );

    logIfDev('Change in displayed polygons logic', allLayers);
  });

  return (
    <For each={allLayers}>
      {(layer) => (
        <>
          <Layer
            id={`${layer.name}_line`}
            style={{
              source: layer.name,
              type: 'line',
              paint: {
                'line-color': layer.isDisplayedColor ? layer.color : 'transparent',
                'line-width': 2,
                'line-color-transition': {
                  duration: 0,
                  delay: 0,
                },
              },
            }}
          />
          <Layer
            id={`${layer.name}_fill`}
            style={{
              source: layer.name,
              type: 'fill',
              paint: {
                'fill-color': layer.isDisplayedColor ? layer.color : 'transparent',
                'fill-opacity': layer.isDisplayedColor ? 0.2 : 1.0,
                'fill-color-transition': {
                  duration: 0,
                  delay: 0,
                },
                'fill-opacity-transition': {
                  duration: 0,
                  delay: 0,
                },
              },
            }}
          />
        </>
      )}
    </For>
  );
};
