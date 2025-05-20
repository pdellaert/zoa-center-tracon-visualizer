import { Component, For } from 'solid-js';
import { Source } from 'solid-map-gl';

interface TraconGeojsonPolySourcesProps {
  sources: { id: string; url: string }[];
}

export const TraconGeojsonPolySources: Component<TraconGeojsonPolySourcesProps> = (props) => {
  return (
    <For each={props.sources}>
      {(source) => (
        <Source
          id={source.id}
          source={{
            type: 'geojson',
            data: source.url,
          }}
        ></Source>
      )}
    </For>
  );
};
