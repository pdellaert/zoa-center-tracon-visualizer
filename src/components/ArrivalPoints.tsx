import { Component, For } from 'solid-js';
import { Layer, Source } from 'solid-map-gl';
import { ArrivalProcedure, Sequence } from '~/types';

interface ArrivalPointsProps {
  arrivals: ArrivalProcedure[];
}

// const pointsToGeojsonCoords = (points: Point[]) => {
//   let x = [...new Set(points.map((p) => [p.longitude, p.latitude]))];
//   console.log(x);
//   return x;
// };

const transitionString = (arrival: ArrivalProcedure, sequence: Sequence) => {
  let transitionId = sequence.transition ? sequence.transition : 'null';
  return `${arrival.arrivalIdentifier}-${transitionId}`;
};

const makeFixFeatures = (sequence: Sequence) => {
  return sequence.points.map((p) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [p.longitude, p.latitude],
    },
    properties: {
      text: `${p.identifier}${makeAltitudesString(p.minAltitude, p.maxAltitude)}`,
    },
  }));
};

const makeAltitudesString = (minAlt?: string, maxAlt?: string) => {
  if (minAlt && maxAlt) {
    if (minAlt === maxAlt) {
      return `\n${minAlt}`;
    } else {
      return `\n${maxAlt}\n${minAlt}`;
    }
  } else {
    if (minAlt) {
      return `\nAoA ${minAlt}`;
    } else if (maxAlt) {
      return `\nAoB ${maxAlt}`;
    } else {
      return '';
    }
  }
};

export const ArrivalPoints: Component<ArrivalPointsProps> = (props) => {
  return (
    <For each={props.arrivals}>
      {(arrival) => (
        <For each={arrival.sequences}>
          {(sequence) => (
            <>
              <Source
                id={transitionString(arrival, sequence)}
                source={{
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    geometry: {
                      type: 'LineString',
                      coordinates: sequence.points.map((p) => [p.longitude, p.latitude]),
                    },
                    properties: {
                      arrival: arrival.arrivalIdentifier,
                      transition: sequence.transition,
                    },
                  },
                }}
              >
                <Layer
                  id={`arrival-line-${transitionString(arrival, sequence)}`}
                  style={{
                    type: 'line',
                    paint: {
                      'line-color': '#ababab',
                      'line-width': 4,
                    },
                  }}
                />
                {/*<Layer*/}
                {/*  id={`arrival-points-${transitionString(arrival, sequence)}`}*/}
                {/*  style={{*/}
                {/*    type: "circle",*/}
                {/*    paint: {*/}
                {/*      "circle-radius": 4,*/}
                {/*      "circle-color": "#000000",*/}
                {/*      "circle-stroke-width": 1,*/}
                {/*      "circle-stroke-color": "#fff",*/}
                {/*    },*/}
                {/*  }}*/}
                {/*/>*/}
              </Source>
              <Source
                id={`${transitionString(arrival, sequence)}-text`}
                source={{
                  type: 'geojson',
                  data: { type: 'FeatureCollection', features: makeFixFeatures(sequence) },
                }}
              >
                <Layer
                  id={`${transitionString(arrival, sequence)}-text-layer`}
                  style={{
                    type: 'symbol',
                    layout: {
                      'text-field': ['get', 'text'],
                      // "text-font": textFontFamily,
                      'text-rotation-alignment': 'auto',
                      'text-allow-overlap': true,
                      'text-anchor': 'top',
                      'text-size': 12,
                      'text-offset': [0, 0.5],
                    },
                    paint: {
                      'text-color': '#000000',
                      // "text-halo-blur": textHaloBlur,
                      // "text-halo-color": textHaloColor,
                      // "text-halo-width": textHaloWidth,
                      // "text-opacity": textOpacity,
                    },
                  }}
                />
                <Layer
                  id={`arrival-points-${transitionString(arrival, sequence)}`}
                  style={{
                    type: 'circle',
                    paint: {
                      'circle-radius': 4,
                      'circle-color': '#000000',
                      'circle-stroke-width': 1,
                      'circle-stroke-color': '#fff',
                    },
                  }}
                />
              </Source>
            </>
          )}
        </For>
      )}
    </For>
  );
};
