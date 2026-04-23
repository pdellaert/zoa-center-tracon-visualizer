import { Viewport } from 'solid-map-gl';
import { MapStyle, Settings } from '~/lib/types';

/** Multiplier to convert minAlt/maxAlt (100s of feet) to meters, with a visual amplification factor. */
export const ALTITUDE_SCALE = 100 * 0.3048 * 3.0; // ≈ 91.44
/** Cap for maxAlt: 999 (unlimited) → FL600. */
export const MAX_ALT_VALUE = 600;

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
