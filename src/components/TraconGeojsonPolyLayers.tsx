import {
  TraconAirspaceConfig,
  AppDisplayState,
  TraconPolyDefinition,
  TraconSectorDisplayState,
  TraconSectorName,
} from '~/types';
import { Component, createEffect, For, Show } from 'solid-js';
import { Layer } from 'solid-map-gl';
import { createStore, produce } from 'solid-js/store';
import { logIfDev } from '~/lib/dev';

interface GeojsonPolyLayersProps {
  displayStateStore: AppDisplayState;
  allPolys: TraconPolyDefinition[];
}

interface DisplayState extends TraconSectorDisplayState {
  config: TraconAirspaceConfig;
}

interface MapboxDisplayState extends TraconSectorDisplayState {
  config: TraconAirspaceConfig;
  hasBeenModified: boolean;
  isDisplayedTransparent: boolean;
  isDisplayedColor: boolean;
}

const createStartingLayers = (allPolys: TraconPolyDefinition[]): MapboxDisplayState[] =>
  allPolys.flatMap((polyDef) =>
    polyDef.polys.sectorConfigs.flatMap((sector) =>
      sector.configPolyUrls.flatMap((polyUrl) =>
        polyUrl.configs.map((config) => ({
          name: sector.sectorName,
          parentAreaName: polyDef.name,
          config: config,
          isDisplayed: false,
          isDisplayedTransparent: false,
          isDisplayedColor: false,
          color: sector.defaultColor,
          hasBeenModified: false,
        })),
      ),
    ),
  );

export const TraconGeojsonPolyLayers: Component<GeojsonPolyLayersProps> = (props) => {
  const startingLayers = createStartingLayers(props.allPolys);
  logIfDev('Starting map layers', startingLayers);
  const [allLayers, setAllLayers] = createStore(startingLayers);

  createEffect(() => {
    let displayFlat = props.displayStateStore.areaDisplayStates.flatMap((area) =>
      area.sectors.map((sector) => ({ ...sector, config: area.selectedConfig })),
    );

    let displayMap: Map<TraconSectorName, DisplayState> = new Map();
    displayFlat.forEach((s) => displayMap.set(s.name, s));

    logIfDev('Starting update of layers');
    logIfDev('Intended display state before signals', displayMap);

    setAllLayers(
      (layer) => displayMap.has(layer.name),
      produce((layer) => {
        let displayLayer = displayMap.get(layer.name)!;
        layer.hasBeenModified = layer.hasBeenModified || displayLayer.config === layer.config;
        layer.color = displayLayer.color;
        layer.isDisplayedTransparent = displayLayer.config === layer.config;
        layer.isDisplayedColor = layer.isDisplayedTransparent && displayLayer.isDisplayed;
        layer.isDisplayed = layer.isDisplayedColor || layer.isDisplayedTransparent;
      }),
    );

    logIfDev('Change in displayed polygons logic', allLayers);
  });

  return (
    <For each={allLayers}>
      {(layer) => (
        <Show when={layer.hasBeenModified}>
          <Layer
            id={`${layer.name}_${layer.config}_line`}
            style={{
              source: `${layer.name}_${layer.config}`,
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
            visible={layer.isDisplayedTransparent}
          />
          <Layer
            id={`${layer.name}_${layer.config}_fill`}
            style={{
              source: `${layer.name}_${layer.config}`,
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
            visible={layer.isDisplayedTransparent}
          />
        </Show>
      )}
    </For>
  );
};
