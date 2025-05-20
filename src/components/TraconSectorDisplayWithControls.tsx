import { Component, createEffect, For, Show } from 'solid-js';
import { TraconAirspaceConfig, TraconAirspaceConfigDependentGroup, AppDisplayState } from '../types';
import { SetStoreFunction } from 'solid-js/store';
import { Select } from '@kobalte/core/select';
import { SelectContent, SelectItem, SelectTrigger, SelectValue, Checkbox } from './ui-core';
import { cn } from '../lib/utils';

interface TraconSectorDisplayWithControlsProps {
  airspaceGroup: TraconAirspaceConfigDependentGroup;
  airspaceConfigOptions?: TraconAirspaceConfig[];
  store: AppDisplayState;
  setStore: SetStoreFunction<AppDisplayState>;
  dependentOnConfig?: TraconAirspaceConfig;
}

export const TraconSectorDisplayWithControls: Component<TraconSectorDisplayWithControlsProps> = (props) => {
  // TODO -- need to make sure this works
  if (props.dependentOnConfig) {
    createEffect(() => {
      props.setStore(
        'areaDisplayStates',
        (a) => a.name === props.airspaceGroup,
        'selectedConfig',
        props.dependentOnConfig!,
      );
    });
  }

  return (
    <div>
      <Show when={typeof props.dependentOnConfig === 'undefined'}>
        <Select
          class="mt-4"
          options={props.airspaceConfigOptions ?? []}
          value={props.store.areaDisplayStates.find((a) => a.name === props.airspaceGroup)?.selectedConfig}
          onChange={(val) => {
            if (val) {
              props.setStore('areaDisplayStates', (a) => a.name === props.airspaceGroup, 'selectedConfig', val);
              props.setStore('updateCount', (prev) => prev + 1);
            }
          }}
          disallowEmptySelection={true}
          itemComponent={(props) => <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>}
        >
          <SelectTrigger aria-label="Map Style" class="w-[180px] cursor-pointer">
            <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      </Show>

      <div class={cn(['flex flex-col space-y-1 mt-4', { 'mt-2': typeof props.dependentOnConfig === 'undefined' }])}>
        <For each={props.store.areaDisplayStates.find((a) => a.name === props.airspaceGroup)?.sectors}>
          {(sector) => (
            <div class="flex justify-between">
              <Checkbox
                label={sector.name}
                checked={sector.isDisplayed}
                onChange={(val) => {
                  props.setStore(
                    'areaDisplayStates',
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
                    'areaDisplayStates',
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
