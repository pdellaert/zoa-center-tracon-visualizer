import { Component, For } from "solid-js";
import { Source } from "solid-map-gl";

interface GeojsonPolySourcesProps {
  sources: { id: string; url: string }[];
}

export const GeojsonPolySources: Component<GeojsonPolySourcesProps> = (props) => {
  return (
    <For each={props.sources}>
      {(source) => (
        <Source
          id={source.id}
          source={{
            type: "geojson",
            data: source.url,
          }}
        ></Source>
      )}
    </For>
  );
};
