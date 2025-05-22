import {
  AppDisplayState,
  CenterDisplayState,
  TraconAirspaceConfig,
  TraconPolyDefinition,
  TraconSectorDisplayState,
} from '~/types';
import { Component, createEffect, For, Show } from 'solid-js';
import { Layer } from 'solid-map-gl';
import { createStore, produce } from 'solid-js/store';
import { logIfDev } from '~/lib/dev';

// Base type for all geojson polygon layers
type GeojsonLayerBase = {
  name: string;
  color: string;
  isDisplayed: boolean;
  isDisplayedColor: boolean;
  isDisplayedTransparent: boolean;
};

// Center-specific layer properties
type CenterGeojsonLayer = GeojsonLayerBase & {
  type: 'center';
};

// Tracon-specific layer properties
type TraconGeojsonLayer = GeojsonLayerBase & {
  type: 'tracon';
  parentAreaName: string;
  config: TraconAirspaceConfig;
  hasBeenModified: boolean;
};

// Union type for all layer types
type GeojsonLayer = CenterGeojsonLayer | TraconGeojsonLayer;

/**
 * Generic polygon layer component that can display both Center and Tracon layers
 * Uses a discriminated union type pattern to handle both layer types
 */
export const GeojsonPolyLayers: Component<
  | { displayStateStore: AppDisplayState; type: 'center' }
  | { displayStateStore: AppDisplayState; type: 'tracon'; allPolys: TraconPolyDefinition[] }
> = (props) => {
  // Create the appropriate initial layers based on type
  const createInitialLayers = (): GeojsonLayer[] => {
    if (props.type === 'center') {
      return createCenterLayers();
    } else {
      if (props.type === 'tracon' && !props.allPolys) {
        console.error('allPolys is required for tracon layers');
        return [];
      }
      return createTraconLayers();
    }
  };

  // Create Center layers
  const createCenterLayers = (): CenterGeojsonLayer[] => {
    return props.displayStateStore.centerDisplayStates.flatMap((area) =>
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
    if (props.type !== 'tracon' || !props.allPolys) return [];
    
    return props.allPolys.flatMap((polyDef) =>
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

  // Update layers when display state changes
  createEffect(() => {
    if (props.type === 'center') {
      updateCenterLayers();
    } else {
      updateTraconLayers();
    }
  });

  // Update Center layers
  const updateCenterLayers = () => {
    const displayFlat = props.displayStateStore.centerDisplayStates.flatMap((area) => area.sectors);
    const displayMap = new Map<string, CenterDisplayState>();
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
  const updateTraconLayers = () => {
    const displayFlat = props.displayStateStore.areaDisplayStates.flatMap((area) =>
      area.sectors.map((sector) => ({ 
        ...sector, 
        config: area.selectedConfig 
      })),
    );

    const displayMap = new Map<string, TraconSectorDisplayState & { config: TraconAirspaceConfig }>();
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

  return (
    <For each={layers}>
      {(layer) => {
        const layerId = getLayerId(layer);
        
        return (
          <Show when={shouldRender(layer)}>
            <Layer
              id={`${layerId}_line`}
              style={{
                source: layerId,
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
              visible={isVisible(layer)}
            />
            <Layer
              id={`${layerId}_fill`}
              style={{
                source: layerId,
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
              visible={isVisible(layer)}
            />
          </Show>
        );
      }}
    </For>
  );
}

// The wrapper components have been removed in favor of using the discriminated union pattern directly

