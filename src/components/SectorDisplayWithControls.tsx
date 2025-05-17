import { Component, createMemo, For, Show } from 'solid-js';
import { AppDisplayState } from '~/types.ts';
import { SetStoreFunction } from 'solid-js/store';
import { Checkbox } from './ui-core';
import { cn } from '~/lib/utils';

interface SectorDisplayWithControlsProps {
  airspaceGroup: string;
  store: AppDisplayState;
  setStore: SetStoreFunction<AppDisplayState>;
}

export const SectorDisplayWithControls: Component<SectorDisplayWithControlsProps> = (props) => {
  const thisAirspaceGroup = createMemo(() =>
    props.store.centerDisplayStates.find((a) => a.name === props.airspaceGroup),
  );

  const checkedSectors = createMemo(() => thisAirspaceGroup()?.sectors.filter((s) => s.isDisplayed));

  const showCheckAll = createMemo(() => {
    const checked = checkedSectors();
    const total = thisAirspaceGroup()?.sectors;
    if (checked === undefined || total === undefined) {
      return false;
    }
    return checked.length < total.length;
  });

  const showUncheckAll = createMemo(() => {
    const checked = checkedSectors();
    if (checked === undefined) {
      return false;
    }
    return checked.length > 0;
  });

  return (
    <div>
      <div class={cn(['flex flex-col space-y-1 mt-2'])}>
        <div class="text-white">{props.airspaceGroup}</div>
        <div class="flex flex-row space-x-2 cursor-pointer">
          <Show when={showCheckAll()}>
            <div
              class="text-gray-400 hover:text-gray-200 transition text-xs"
              onClick={() =>
                props.setStore(
                  'centerDisplayStates',
                  (a) => a.name === props.airspaceGroup,
                  'sectors',
                  (_s) => true,
                  'isDisplayed',
                  true,
                )
              }
            >
              Check all
            </div>
          </Show>
          <Show when={showUncheckAll()}>
            <div
              class="text-gray-400 hover:text-gray-200 transition text-xs"
              onClick={() =>
                props.setStore(
                  'centerDisplayStates',
                  (a) => a.name === props.airspaceGroup,
                  'sectors',
                  (_s) => true,
                  'isDisplayed',
                  false,
                )
              }
            >
              Uncheck all
            </div>
          </Show>
        </div>
        <For each={props.store.centerDisplayStates.find((a) => a.name === props.airspaceGroup)?.sectors}>
          {(sector) => (
            <div class="flex justify-between">
              <Checkbox
                label={sector.name}
                checked={sector.isDisplayed}
                onChange={(val) => {
                  props.setStore(
                    'centerDisplayStates',
                    (a) => a.name === props.airspaceGroup,
                    'sectors',
                    (s) => s.name === sector.name,
                    'isDisplayed',
                    val,
                  );
                  props.setStore('updateCount', (prev) => prev + 1);
                }}
              />
              <input
                type="color"
                value={sector.color}
                class="w-6 h-6 mr-2"
                onChange={(e) => {
                  props.setStore(
                    'centerDisplayStates',
                    (a) => a.name === props.airspaceGroup,
                    'sectors',
                    (s) => s.name === sector.name,
                    'color',
                    e.target.value,
                  );
                  props.setStore('updateCount', (prev) => prev + 1);
                }}
              />
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
