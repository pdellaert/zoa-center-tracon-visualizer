import { AppDisplayState, TraconAirspaceConfig } from '~/types';
import { SetStoreFunction } from 'solid-js/store';

export function useSectorState(_store: AppDisplayState, setStore: SetStoreFunction<AppDisplayState>) {
  const toggleSectorDisplay = (
    displayType: 'center' | 'tracon',
    airspaceGroup: string,
    sectorName: string,
    value: boolean,
  ) => {
    const stateKey = displayType === 'center' ? 'centerDisplayStates' : 'areaDisplayStates';

    setStore(
      stateKey,
      (a) => a.name === airspaceGroup,
      'sectors',
      (s) => s.name === sectorName,
      'isDisplayed',
      value,
    );
  };

  const updateSectorColor = (
    displayType: 'center' | 'tracon',
    airspaceGroup: string,
    sectorName: string,
    color: string,
  ) => {
    const stateKey = displayType === 'center' ? 'centerDisplayStates' : 'areaDisplayStates';

    setStore(
      stateKey,
      (a) => a.name === airspaceGroup,
      'sectors',
      (s) => s.name === sectorName,
      'color',
      color,
    );
  };

  const toggleAllSectors = (displayType: 'center' | 'tracon', airspaceGroup: string, value: boolean) => {
    const stateKey = displayType === 'center' ? 'centerDisplayStates' : 'areaDisplayStates';

    setStore(
      stateKey,
      (a) => a.name === airspaceGroup,
      'sectors',
      (_s) => true,
      'isDisplayed',
      value,
    );
  };

  const updateTraconConfig = (airspaceGroup: string, config: TraconAirspaceConfig) => {
    setStore('areaDisplayStates', (a) => a.name === airspaceGroup, 'selectedConfig', config);
  };

  return {
    toggleSectorDisplay,
    updateSectorColor,
    toggleAllSectors,
    updateTraconConfig,
  };
}
