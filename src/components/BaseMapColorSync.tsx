import { Component, createEffect, onCleanup } from 'solid-js';
import { useMapContext } from 'solid-map-gl';
import { BASE_MAPS } from '~/lib/config';

/**
 * Syncs map layer colors with the current map style (light vs dark).
 * Must be rendered inside <MapGL>.
 *
 * Uses 'idle' to check for layers needing color updates, but only
 * runs the actual paint logic when an external style change has
 * occurred (style switch, layer add/remove). Ignores styledata
 * events caused by our own setPaintProperty calls to avoid a
 * feedback loop.
 */
export const BaseMapColorSync: Component<{ isDark: boolean }> = (props) => {
  const [ctx] = useMapContext();

  createEffect(() => {
    const dark = props.isDark;
    let dirty = true;
    let applying = false;

    const apply = () => {
      if (!dirty) return;
      applying = true;
      dirty = false;

      // Base map lines
      const baseColor = dark ? '#ffffff' : '#000000';
      for (const bm of BASE_MAPS) {
        if (ctx.map.getLayer(bm.name)) {
          ctx.map.setPaintProperty(bm.name, 'line-color', baseColor);
        }
      }

      // Procedure layers (text labels, waypoint circles, line casings)
      const textColor = dark ? '#ffffff' : '#000000';
      const circleColor = dark ? '#ffffff' : '#000000';
      const circleStrokeColor = dark ? '#000000' : '#ffffff';
      const casingColor = dark ? '#000000' : '#ffffff';

      const procedureLineCasingPrefix = /^(sid|star|app)-(line-casing|arrow-casing)-/;

      for (const layer of ctx.map.getStyle().layers) {
        if (layer.id.endsWith('-text-layer')) {
          ctx.map.setPaintProperty(layer.id, 'text-color', textColor);
        } else if (layer.id === 'procedure-fix-points') {
          ctx.map.setPaintProperty(layer.id, 'circle-color', circleColor);
          ctx.map.setPaintProperty(layer.id, 'circle-stroke-color', circleStrokeColor);
        } else if (procedureLineCasingPrefix.test(layer.id)) {
          ctx.map.setPaintProperty(layer.id, 'line-color', casingColor);
        }
      }

      applying = false;
    };

    const markDirty = () => {
      if (!applying) dirty = true;
    };

    // Mark dirty on structural style changes (addLayer, removeLayer, setStyle)
    // but not from our own setPaintProperty calls
    ctx.map.on('styledata', markDirty);

    // Check on idle — cheap no-op when not dirty
    ctx.map.on('idle', apply);

    onCleanup(() => {
      ctx.map.off('styledata', markDirty);
      ctx.map.off('idle', apply);
    });
  });

  return null;
};
