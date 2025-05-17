import { DEV } from "solid-js";
import { isServer } from "solid-js/web";

export function logIfDev(message?: any, ...optionalParams: any[]) {
  if (DEV && !isServer) {
    console.log(message, ...optionalParams);
  }
}

export function runIfDev(fn: () => void) {
  if (DEV && !isServer) {
    fn();
  }
}
