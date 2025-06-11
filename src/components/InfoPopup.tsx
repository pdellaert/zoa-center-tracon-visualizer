import { Component, createMemo, For, Show } from 'solid-js';
import { FillPaint, PopupState, Settings } from '~/lib/types';
import { comparePolyAlts, getFillColor, isTransparentFill } from '~/lib/geojson';
import { createMousePosition } from '@solid-primitives/mouse';
import { cn } from '~/lib/utils';

interface InfoPopupProps {
  popupState: PopupState;
  settings: Settings;
}

export const InfoPopup: Component<InfoPopupProps> = (props) => {
  const sortedPolys = createMemo(() =>
    props.popupState.hoveredPolys.toSorted(comparePolyAlts).map((p) => ({
      poly: p,
      isTransparent: isTransparentFill(p.layer?.paint as FillPaint),
      color: getFillColor(p.layer?.paint as FillPaint),
    })),
  );
  const pos = createMousePosition(window);
  const styleOffset = createMemo(() =>
    props.settings.popup.followMouse ? { top: `${pos.y + 5}px`, left: `${pos.x + 5}px` } : {},
  );

  return (
    <div>
      <Show when={props.popupState.vis}>
        <div
          class={cn(
            'bg-gray-200/80 rounded border border-gray-800 p-1.5 z-40 items-center',
            { fixed: props.settings.popup.followMouse },
            { 'absolute top-14 left-5 w-48': !props.settings.popup.followMouse },
          )}
          style={styleOffset()}
        >
          <table>
            <For each={sortedPolys()}>
              {(polyInfo) => (
                <tr>
                  <td
                    class={cn(
                      { 'font-bold': !polyInfo.isTransparent },
                      { italic: polyInfo.isTransparent },
                      { 'w-20': !props.settings.popup.followMouse },
                    )}
                    style={{
                      color: polyInfo.isTransparent
                        ? '#4b5563' // Tailwind default gray-600
                        : getFillColor(polyInfo.poly.layer?.paint as FillPaint),
                    }}
                  >
                    {polyInfo.poly.source ? polyInfo.poly.source.replace(/_[A-Z]+$/, '') : ''}
                  </td>
                  <td class="font-mono w-12 text-center ml-3">
                    {polyInfo.poly.properties?.minAlt === 0
                      ? 'SFC'
                      : polyInfo.poly.properties?.minAlt.toString().padStart(3, '0')}
                  </td>
                  <td class="font-mono w-12 text-center">
                    {polyInfo.poly.properties?.maxAlt === 999
                      ? 'UNL'
                      : polyInfo.poly.properties?.maxAlt.toString().padStart(3, '0')}
                  </td>
                </tr>
              )}
            </For>
          </table>
        </div>
      </Show>
    </div>
  );
};
