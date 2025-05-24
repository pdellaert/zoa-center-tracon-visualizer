import { createStore, produce } from 'solid-js/store';
import { createEffect, createMemo } from 'solid-js';
import { AppDisplayState, CenterAirspaceDisplayState, TraconAirspaceDisplayState, TraconPolyDefinition } from '~/types';
import { logIfDev } from '~/lib/dev';

export type GeojsonLayerBase = {
  name: string;
  color: string;
  isDisplayed: boolean;
  isDisplayedColor: boolean;
  isDisplayedTransparent: boolean;
};

export type CenterGeojsonLayer = GeojsonLayerBase & {
  type: 'center';
};

export type TraconGeojsonLayer = GeojsonLayerBase & {
  type: 'tracon';
  parentAreaName: string;
  config: string;
  hasBeenModified: boolean;
};

export type GeojsonLayer = CenterGeojsonLayer | TraconGeojsonLayer;

export function useLayerManagement(
  displayType: 'center' | 'tracon',
  displayStateStore: AppDisplayState,
  allPolys?: TraconPolyDefinition[],
) {
  // Create the appropriate initial layers based on type
  const createInitialLayers = (): GeojsonLayer[] => {
    if (displayType === 'center') {
      return createCenterLayers();
    } else {
      if (displayType === 'tracon' && !allPolys) {
        console.error('allPolys is required for tracon layers');
        return [];
      }
      return createTraconLayers();
    }
  };

  // Create Center layers
  const createCenterLayers = (): CenterGeojsonLayer[] => {
    return displayStateStore.centerDisplayStates.flatMap((area) =>
      area.sectors.map((sector) => ({
        type: 'center',
        name: sector.name,
        color: sector.color,
        isDisplayed: false,
        isDisplayedColor: false,
        isDisplayedTransparent: false,
      })),
    );
  };

  // Create Tracon layers
  const createTraconLayers = (): TraconGeojsonLayer[] => {
    if (displayType !== 'tracon' || !allPolys) return [];

    return allPolys.flatMap((polyDef) =>
      polyDef.polys.sectorConfigs.flatMap((sector) =>
        sector.configPolyUrls.flatMap((polyUrl) =>
          polyUrl.configs.map((config) => ({
            type: 'tracon',
            name: sector.sectorName,
            parentAreaName: polyDef.name,
            config: config,
            color: sector.defaultColor,
            isDisplayed: false,
            isDisplayedColor: false,
            isDisplayedTransparent: false,
            hasBeenModified: false,
          })),
        ),
      ),
    );
  };

  // Initialize layers
  const [layers, setLayers] = createStore<GeojsonLayer[]>(createInitialLayers());
  logIfDev('Initial layers', layers);

  // Memoize relevant parts of the store to avoid unnecessary updates
  const centerDisplayStates = createMemo(() => displayStateStore.centerDisplayStates);
  const areaDisplayStates = createMemo(() => displayStateStore.areaDisplayStates);

  // Set up effect to update layers when displayStateStore changes
  createEffect(() => {
    if (displayType === 'center') {
      const states = centerDisplayStates();
      updateCenterLayers(states);
    } else {
      const states = areaDisplayStates();
      updateTraconLayers(states);
    }
  });

  // Update Center layers
  const updateCenterLayers = (states: CenterAirspaceDisplayState[]) => {
    const displayFlat = states.flatMap((area) => area.sectors);
    const displayMap = new Map();
    displayFlat.forEach((s) => displayMap.set(s.name, s));

    logIfDev('Updating center layers', displayMap);

    setLayers(
      (layer) => layer.type === 'center' && displayMap.has(layer.name),
      produce((layer) => {
        if (layer.type !== 'center') return;

        const displayLayer = displayMap.get(layer.name)!;
        layer.color = displayLayer.color;
        layer.isDisplayedTransparent = !displayLayer.isDisplayed;
        layer.isDisplayedColor = displayLayer.isDisplayed;
      }),
    );
  };

  // Update Tracon layers
  const updateTraconLayers = (states: TraconAirspaceDisplayState[]) => {
    const displayFlat = states.flatMap((area) =>
      area.sectors.map((sector) => ({
        ...sector,
        config: area.selectedConfig,
      })),
    );

    const displayMap = new Map();
    displayFlat.forEach((s) => displayMap.set(s.name, s));

    logIfDev('Updating tracon layers', displayMap);

    setLayers(
      (layer) => layer.type === 'tracon' && displayMap.has(layer.name),
      produce((layer) => {
        if (layer.type !== 'tracon') return;

        const displayLayer = displayMap.get(layer.name)!;
        layer.hasBeenModified = layer.hasBeenModified || displayLayer.config === layer.config;
        layer.color = displayLayer.color;
        layer.isDisplayedTransparent = displayLayer.config === layer.config;
        layer.isDisplayedColor = layer.isDisplayedTransparent && displayLayer.isDisplayed;
        layer.isDisplayed = layer.isDisplayedColor || layer.isDisplayedTransparent;
      }),
    );
  };

  // Generate appropriate layer ID based on layer type
  const getLayerId = (layer: GeojsonLayer): string => {
    if (layer.type === 'center') {
      return layer.name;
    } else {
      return `${layer.name}_${layer.config}`;
    }
  };

  // Determine if a layer should be rendered
  const shouldRender = (layer: GeojsonLayer): boolean => {
    if (layer.type === 'center') {
      return true;
    } else {
      return layer.hasBeenModified;
    }
  };

  // Determine if a layer should be visible
  const isVisible = (layer: GeojsonLayer): boolean => {
    if (layer.type === 'center') {
      return true;
    } else {
      return layer.isDisplayedTransparent;
    }
  };

  return {
    layers,
    setLayers,
    getLayerId,
    shouldRender,
    isVisible,
  };
}
