import { Viewport } from 'solid-map-gl';
import { MapStyle, Settings } from '~/lib/types';

export const DEFAULT_MAP_STYLE: MapStyle = {
  value: 'mapbox://styles/mapbox/empty-v9',
  label: 'Empty',
  disabled: false,
};

export const DEFAULT_VIEWPORT: Viewport = {
  center: [-122.4, 37.8],
  zoom: 6.5,
  pitch: 0,
  bearing: 0,
};

export const DEFAULT_SETTINGS: Settings = {
  popup: {
    showUncheckedSectors: false,
    uncheckedSectorsInVisibleSectorsOnly: false,
    followMouse: true,
  },
};
