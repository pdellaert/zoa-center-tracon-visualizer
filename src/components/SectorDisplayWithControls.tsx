import { Component, createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { AppDisplayState, TraconAirspaceConfig, TraconAirspaceConfigDependentGroup } from '~/lib/types';
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
  hideConfigSelector?: boolean;
}

export const SectorDisplayWithControls: Component<SectorDisplayWithControlsProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);
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
      <div class={cn(['flex flex-col space-y-1 mt-2'])}>
        {(!props.hideHeader || isCenter) && (
          <div class="text-white flex items-center cursor-pointer group">
            <svg
              class={`w-4 h-4 text-gray-400 group-hover:text-white transition-all duration-200 transform ${isExpanded() ? 'rotate-90' : ''} mr-2 cursor-pointer`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              onClick={() => setIsExpanded(!isExpanded())}
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            <span
              class="group-hover:text-white transition-colors duration-200 cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded())}
            >
              {props.airspaceGroup}
            </span>

            <div class="flex ml-auto space-x-2">
              <Show when={showCheckAll()}>
                <div
                  class="text-gray-400 hover:text-gray-200 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleAll(true);
                  }}
                  title="Check all"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </Show>
              <Show when={showUncheckAll()}>
                <div
                  class="text-gray-400 hover:text-gray-200 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleAll(false);
                  }}
                  title="Uncheck all"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </Show>
            </div>
          </div>
        )}

        <Show
          when={
            isExpanded() && !props.hideConfigSelector && !isCenter && typeof props.dependentOnConfig === 'undefined'
          }
        >
          <Select
            class="mt-2"
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

        <Show when={isExpanded()}>
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
        </Show>
      </div>
    </div>
  );
};
