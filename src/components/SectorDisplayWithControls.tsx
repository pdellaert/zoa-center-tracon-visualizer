import { Component, createEffect, createMemo, For, Show } from 'solid-js';
import { AppDisplayState, TraconAirspaceConfig, TraconAirspaceConfigDependentGroup } from '~/types';
import { SetStoreFunction } from 'solid-js/store';
import { Select } from '@kobalte/core/select';
import { SelectContent, SelectItem, SelectTrigger, SelectValue, Checkbox } from './ui-core';
import { cn } from '~/lib/utils';

// Combined interface that handles both Center and Tracon display props
interface SectorDisplayWithControlsProps {
  airspaceGroup: string | TraconAirspaceConfigDependentGroup;
  store: AppDisplayState;
  setStore: SetStoreFunction<AppDisplayState>;
  displayType: 'center' | 'tracon';
  airspaceConfigOptions?: TraconAirspaceConfig[];
  dependentOnConfig?: TraconAirspaceConfig;
}

// Original CenterSectorDisplayWithControls implementation for reference
export const CenterSectorDisplayWithControls: Component<Omit<SectorDisplayWithControlsProps, 'displayType' | 'airspaceConfigOptions' | 'dependentOnConfig'>> = (props) => {
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

// Original TraconSectorDisplayWithControls implementation for reference
export const TraconSectorDisplayWithControls: Component<Omit<SectorDisplayWithControlsProps, 'displayType'> & { airspaceGroup: TraconAirspaceConfigDependentGroup }> = (props) => {
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

// Combined component that selects the appropriate display type based on props
export const SectorDisplayWithControls: Component<SectorDisplayWithControlsProps> = (props) => {
  if (props.displayType === 'center') {
    return (
      <CenterSectorDisplayWithControls
        airspaceGroup={props.airspaceGroup as string}
        store={props.store}
        setStore={props.setStore}
      />
    );
  } else {
    return (
      <TraconSectorDisplayWithControls
        airspaceGroup={props.airspaceGroup as TraconAirspaceConfigDependentGroup}
        store={props.store}
        setStore={props.setStore}
        airspaceConfigOptions={props.airspaceConfigOptions}
        dependentOnConfig={props.dependentOnConfig}
      />
    );
  }
};
