import {
  AppDisplayState,
  TraconPolyDefinition,
} from '~/types';
import { Component, For, Show } from 'solid-js';
import { Layer } from 'solid-map-gl';
import { useLayerManagement } from '~/lib/useLayerManagement';
import { getFillPaint, getLinePaint } from '~/lib/utils';

// Types are now imported from useLayerManagement hook

/**
 * Generic polygon layer component that can display both Center and Tracon layers
 * Uses a discriminated union type pattern to handle both layer types
 */
export const GeojsonPolyLayers: Component<
  | { displayStateStore: AppDisplayState; type: 'center' }
  | { displayStateStore: AppDisplayState; type: 'tracon'; allPolys: TraconPolyDefinition[] }
> = (props) => {
  // Use the extracted layer management hook
  const { layers, getLayerId, shouldRender, isVisible } = useLayerManagement(
    props.type, 
    props.displayStateStore, 
    props.type === 'tracon' ? props.allPolys : undefined
  );

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
                paint: getLinePaint(layer.color, layer.isDisplayedColor),
              }}
              visible={isVisible(layer)}
            />
            <Layer
              id={`${layerId}_fill`}
              style={{
                source: layerId,
                type: 'fill',
                paint: getFillPaint(layer.color, layer.isDisplayedColor),
              }}
              visible={isVisible(layer)}
            />
          </Show>
        );
      }}
    </For>
  );
};
