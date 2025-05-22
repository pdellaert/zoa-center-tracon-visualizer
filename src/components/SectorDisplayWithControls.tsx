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
  hideHeader?: boolean; // Set to true to hide the area header (useful when it's the only area for an airport)
}

// Unified implementation for both Center and Tracon sector displays
export const SectorDisplayWithControls: Component<SectorDisplayWithControlsProps> = (props) => {
  const isCenter = props.displayType === 'center';
  
  // Apply dependent configuration for Tracon if specified
  if (!isCenter && props.dependentOnConfig) {
    createEffect(() => {
      props.setStore(
        'areaDisplayStates',
        (a) => a.name === props.airspaceGroup,
        'selectedConfig',
        props.dependentOnConfig!,
      );
    });
  }

  // Common memoized values for both types
  const thisAirspaceGroup = createMemo(() => {
    return isCenter 
      ? props.store.centerDisplayStates.find((a) => a.name === props.airspaceGroup)
      : props.store.areaDisplayStates.find((a) => a.name === props.airspaceGroup);
  });

  const sectors = createMemo(() => thisAirspaceGroup()?.sectors);
  const checkedSectors = createMemo(() => sectors()?.filter((s) => s.isDisplayed));

  // Computed values for both display types
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

  // Common handler for checkbox changes
  const handleCheckboxChange = (sectorName: string, value: boolean) => {
    if (isCenter) {
      props.setStore(
        'centerDisplayStates',
        (a) => a.name === props.airspaceGroup,
        'sectors',
        (s) => s.name === sectorName,
        'isDisplayed',
        value,
      );
    } else {
      props.setStore(
        'areaDisplayStates',
        (a) => a.name === props.airspaceGroup,
        'sectors',
        (s) => s.name === sectorName,
        'isDisplayed',
        value,
      );
    }
    props.setStore('updateCount', (prev) => prev + 1);
  };

  // Common handler for color changes
  const handleColorChange = (sectorName: string, color: string) => {
    if (isCenter) {
      props.setStore(
        'centerDisplayStates',
        (a) => a.name === props.airspaceGroup,
        'sectors',
        (s) => s.name === sectorName,
        'color',
        color,
      );
    } else {
      props.setStore(
        'areaDisplayStates',
        (a) => a.name === props.airspaceGroup,
        'sectors',
        (s) => s.name === sectorName,
        'color',
        color,
      );
    }
    props.setStore('updateCount', (prev) => prev + 1);
  };

  // Handler for Check/Uncheck all (for both display types)
  const handleToggleAll = (value: boolean) => {
    if (isCenter) {
      props.setStore(
        'centerDisplayStates',
        (a) => a.name === props.airspaceGroup,
        'sectors',
        (_s) => true,
        'isDisplayed',
        value,
      );
    } else {
      props.setStore(
        'areaDisplayStates',
        (a) => a.name === props.airspaceGroup,
        'sectors',
        (_s) => true,
        'isDisplayed',
        value,
      );
    }
    props.setStore('updateCount', (prev) => prev + 1);
  };

  return (
    <div>
      {/* Configuration selector (Tracon only) */}
      {!isCenter && (
        <Show when={typeof props.dependentOnConfig === 'undefined'}>
          <Select
            class="mt-4"
            options={props.airspaceConfigOptions ?? []}
            value={!isCenter ? props.store.areaDisplayStates.find((a) => a.name === props.airspaceGroup)?.selectedConfig : undefined}
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
      )}

      {/* Common sector controls */}
      <div class={cn([
        'flex flex-col space-y-1', 
        isCenter ? 'mt-2' : 'mt-4',
        { 'mt-2': !isCenter && typeof props.dependentOnConfig === 'undefined' }
      ])}>
        {/* Title for both Center and Tracon displays (unless hidden) */}
        {(!props.hideHeader || isCenter) && (
          <div class="text-white">{props.airspaceGroup}</div>
        )}
        
        {/* Check/Uncheck all buttons */}
        {
          <div class="flex flex-row space-x-2 cursor-pointer">
            <Show when={showCheckAll()}>
              <div
                class="text-gray-400 hover:text-gray-200 transition text-xs"
                onClick={() => handleToggleAll(true)}
              >
                Check all
              </div>
            </Show>
            <Show when={showUncheckAll()}>
              <div
                class="text-gray-400 hover:text-gray-200 transition text-xs"
                onClick={() => handleToggleAll(false)}
              >
                Uncheck all
              </div>
            </Show>
          </div>
        }
        
        {/* Sector list with checkboxes */}
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

