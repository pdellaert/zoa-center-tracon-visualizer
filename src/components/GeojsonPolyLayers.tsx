import { AppDisplayState, TraconPolyDefinition } from '~/lib/types';
import { Accessor, Component, For, Show } from 'solid-js';
import { Layer } from 'solid-map-gl';
import { useLayerManagement } from '~/lib/useLayerManagement';
import { getFillExtrusionPaint, getFillPaint, getLinePaint } from '~/lib/utils';

type BaseProps = { displayStateStore: AppDisplayState; is3D: Accessor<boolean> };

export const GeojsonPolyLayers: Component<
  (BaseProps & { type: 'center' }) | (BaseProps & { type: 'tracon'; allPolys: TraconPolyDefinition[] })
> = (props) => {
  const { layers, getLayerId, shouldRender, isVisible } = useLayerManagement(
    props.type,
    props.displayStateStore,
    props.type === 'tracon' ? props.allPolys : undefined,
  );

  return (
    <For each={layers}>
      {(layer) => {
        const layerId = getLayerId(layer);

        return (
          <Show when={shouldRender(layer)}>
            <Show when={!props.is3D()}>
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
            <Show when={props.is3D()}>
              <Layer
                id={`${layerId}_fill-extrusion`}
                style={{
                  source: layerId,
                  type: 'fill-extrusion',
                  paint: getFillExtrusionPaint(layer.color, layer.isDisplayedColor),
                }}
                visible={isVisible(layer)}
              />
            </Show>
          </Show>
        );
      }}
    </For>
  );
};
