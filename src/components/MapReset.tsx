import { Component, createMemo, Setter, Show } from "solid-js";
import { Viewport } from "solid-map-gl";
import { DEFAULT_VIEWPORT } from "~/defaults.ts";

interface MapResetProps {
  viewport: Viewport;
  setViewport: Setter<Viewport>;
}

const viewportsMatch = (v1: Viewport, v2: Viewport): boolean =>
  Math.abs(v1.center[0] - v2.center[0]) < 0.001 &&
  Math.abs(v1.center[1] - v2.center[1]) < 0.001 &&
  v1.zoom == v2.zoom &&
  v1.bearing == v2.bearing &&
  v1.pitch == v2.pitch;

export const MapReset: Component<MapResetProps> = (props) => {
  const displayed = createMemo(() => !viewportsMatch(props.viewport, DEFAULT_VIEWPORT));

  return (
    <Show when={displayed()}>
      <div
        class="absolute top-5 right-5 z-50 text-gray-700 font-bold text-sm hover:cursor-pointer border border-gray-400 rounded p-1 bg-white/50 hover:bg-gray-300/50 transition"
        onClick={() => props.setViewport(DEFAULT_VIEWPORT)}
      >
        Reset map view
      </div>
    </Show>
  );
};
