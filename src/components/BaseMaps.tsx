import { Layer, Source } from "solid-map-gl";
import { Component, For, Show } from "solid-js";
import { MountedBaseMapState, PersistedBaseMapState } from "../types";

interface BasemapsProps {
  persistedMapsState: PersistedBaseMapState[];
  mountedMapsState: MountedBaseMapState[];
}

export const BaseMaps: Component<BasemapsProps> = (props) => {
  return (
    <For each={props.persistedMapsState}>
      {(map) => {
        let mountedState = props.mountedMapsState.find((m) => m.id === map.id);
        return (
          <Source
            id={map.baseMap.name}
            source={{
              type: "vector",
              url: map.baseMap.url,
            }}
          >
            <Show when={mountedState?.hasMounted}>
              <Layer
                id={map.baseMap.name}
                style={{
                  "source-layer": map.baseMap.sourceLayer,
                  type: "line",
                }}
                visible={map.checked}
              />
            </Show>
          </Source>
        );
      }}
    </For>
  );
};
