import { Component, createEffect, createMemo, For, Show } from 'solid-js';
import { AppDisplayState, TraconAirspaceConfig, TraconAirspaceConfigDependentGroup } from '~/types';
import { SetStoreFunction } from 'solid-js/store';
import { Select } from '@kobalte/core/select';
import { SelectContent, SelectItem, SelectTrigger, SelectValue, Checkbox } from './ui-core';
import { cn } from '~/lib/utils';
import { useSectorState } from '~/lib/useSectorState';

interface SectorDisplayWithControlsProps {
  airspaceGroup: string | TraconAirspaceConfigDependentGroup;
  store: AppDisplayState;
  setStore: SetStoreFunction<AppDisplayState>;
  displayType: 'center' | 'tracon';
  airspaceConfigOptions?: TraconAirspaceConfig[];
  dependentOnConfig?: TraconAirspaceConfig;
  hideHeader?: boolean;
}

export const SectorDisplayWithControls: Component<SectorDisplayWithControlsProps> = (props) => {
  const isCenter = props.displayType === 'center';
  const sectorState = useSectorState(props.store, props.setStore);

  // Apply dependent configuration for Tracon if specified
  if (!isCenter && props.dependentOnConfig) {
    createEffect(() => {
      sectorState.updateTraconConfig(props.airspaceGroup as string, props.dependentOnConfig!);
    });
  }

  const thisAirspaceGroup = createMemo(() => {
    return isCenter
      ? props.store.centerDisplayStates.find((a) => a.name === props.airspaceGroup)
      : props.store.areaDisplayStates.find((a) => a.name === props.airspaceGroup);
  });

  const sectors = createMemo(() => thisAirspaceGroup()?.sectors);
  const checkedSectors = createMemo(() => sectors()?.filter((s) => s.isDisplayed));

  const showCheckAll = createMemo(() => {
    const checked = checkedSectors();
    const total = sectors();
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

  const handleCheckboxChange = (sectorName: string, value: boolean) => {
    sectorState.toggleSectorDisplay(props.displayType, props.airspaceGroup as string, sectorName, value);
  };

  const handleColorChange = (sectorName: string, color: string) => {
    sectorState.updateSectorColor(props.displayType, props.airspaceGroup as string, sectorName, color);
  };

  const handleToggleAll = (value: boolean) => {
    sectorState.toggleAllSectors(props.displayType, props.airspaceGroup as string, value);
  };

  return (
    <div>
      {!isCenter && (
        <Show when={typeof props.dependentOnConfig === 'undefined'}>
          <Select
            class="mt-4"
            options={props.airspaceConfigOptions ?? []}
            value={
              !isCenter
                ? props.store.areaDisplayStates.find((a) => a.name === props.airspaceGroup)?.selectedConfig
                : undefined
            }
            onChange={(val) => {
              if (val) {
                sectorState.updateTraconConfig(props.airspaceGroup as string, val);
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
      )}

      <div
        class={cn([
          'flex flex-col space-y-1',
          isCenter ? 'mt-2' : 'mt-4',
          { 'mt-2': !isCenter && typeof props.dependentOnConfig === 'undefined' },
        ])}
      >
        {(!props.hideHeader || isCenter) && <div class="text-white">{props.airspaceGroup}</div>}

        {
          <div class="flex flex-row space-x-2 cursor-pointer">
            <Show when={showCheckAll()}>
              <div class="text-gray-400 hover:text-gray-200 transition text-xs" onClick={() => handleToggleAll(true)}>
                Check all
              </div>
            </Show>
            <Show when={showUncheckAll()}>
              <div class="text-gray-400 hover:text-gray-200 transition text-xs" onClick={() => handleToggleAll(false)}>
                Uncheck all
              </div>
            </Show>
          </div>
        }

        <For each={sectors()}>
          {(sector) => (
            <div class="flex justify-between">
              <Checkbox
                label={sector.name}
                checked={sector.isDisplayed}
                onChange={(val) => handleCheckboxChange(sector.name, val)}
              />
              <input
                type="color"
                value={sector.color}
                class="w-6 h-6 mr-2"
                onChange={(e) => handleColorChange(sector.name, e.target.value)}
              />
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
