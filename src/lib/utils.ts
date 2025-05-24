import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(val: number, min: number, max: number) {
  return val > max ? max : val < min ? min : val;
}

export function isTransparentFill(isDisplayed: boolean): boolean {
  return !isDisplayed;
}

export function getFillOpacity(isDisplayed: boolean): number {
  return isDisplayed ? 0.2 : 1.0;
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
    'fill-opacity': getFillOpacity(isDisplayed),
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
