import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ALTITUDE_SCALE, MAX_ALT_VALUE } from '~/lib/defaults';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(val: number, min: number, max: number) {
  return val > max ? max : val < min ? min : val;
}

export function getLayerColor(baseColor: string, isDisplayed: boolean): string {
  return isDisplayed ? baseColor : 'transparent';
}

export function getLinePaint(color: string, isDisplayed: boolean) {
  return {
    'line-color': getLayerColor(color, isDisplayed),
    'line-width': 2,
    'line-color-transition': {
      duration: 0,
      delay: 0,
    },
  };
}

export function getFillPaint(color: string, isDisplayed: boolean) {
  return {
    'fill-color': getLayerColor(color, isDisplayed),
    'fill-opacity': isDisplayed ? 0.2 : 1.0,
    'fill-color-transition': {
      duration: 0,
      delay: 0,
    },
    'fill-opacity-transition': {
      duration: 0,
      delay: 0,
    },
  };
}

export function getFillExtrusionPaint(color: string, isDisplayed: boolean) {
  return {
    'fill-extrusion-color': getLayerColor(color, isDisplayed),
    'fill-extrusion-height': ['*', ['min', ['get', 'maxAlt'], MAX_ALT_VALUE], ALTITUDE_SCALE],
    'fill-extrusion-base': ['*', ['get', 'minAlt'], ALTITUDE_SCALE],
    // Hidden layers keep opacity 1.0 so queryRenderedFeatures still hits them (for "show unchecked sectors" popup)
    'fill-extrusion-opacity': isDisplayed ? 0.5 : 1.0,
    'fill-extrusion-color-transition': {
      duration: 0,
      delay: 0,
    },
    'fill-extrusion-opacity-transition': {
      duration: 0,
      delay: 0,
    },
  };
}
