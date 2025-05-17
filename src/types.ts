import { FillLayerSpecification } from 'mapbox-gl';

///////////////////////////////////////////////////
// Common interfaces
///////////////////////////////////////////////////
export interface MapStyle {
  value: string;
  label: string;
  disabled: boolean;
}

export interface BaseMap {
  name: string;
  url: string;
  sourceLayer: string;
  showDefault: boolean;
}

export interface PersistedBaseMapState {
  id: string;
  baseMap: BaseMap;
  checked: boolean;
}

export interface MountedBaseMapState {
  id: string;
  hasMounted: boolean;
}

export interface Settings {
  popup: {
    showUncheckedSectors: boolean;
    uncheckedSectorsInVisibleSectorsOnly: boolean;
    followMouse: boolean;
  };
}

export interface PopupState {
  hoveredPolys: mapboxgl.GeoJSONFeature[];
  vis: boolean;
}

export type RgbaDecimal = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type FillPaint = FillLayerSpecification['paint'];

export interface AppDisplayState {
  updateCount: number;
  centerDisplayStates: CenterAirspaceDisplayState[];
}

///////////////////////////////////////////////////
// Center interfaces
///////////////////////////////////////////////////
export interface CenterSectorDefinition {
  sectorName: string;
  defaultColor: string;
  polyUrl: string;
}

export interface CenterAreaDefinition {
  name: string;
  sectors: CenterSectorDefinition[];
}

export interface CenterDisplayState {
  name: string;
  isDisplayed: boolean;
  color: string;
}

export interface CenterAirspaceDisplayState {
  name: string;
  sectors: CenterDisplayState[];
}

///////////////////////////////////////////////////
// Tracon interfaces
///////////////////////////////////////////////////
export type AirspaceConfigDependentGroup = 'RNO' | 'SMF' | 'A' | 'B' | 'C' | 'D';

export type AirspaceConfig = 'RNON' | 'RNOS' | 'SMFN' | 'SMFS' | 'SFOW' | 'SFOE' | 'SFO10' | 'OAKE' | 'SJCE' | '';

export type AirportConfig = 'SFOW' | 'SFO19' | 'SFO10' | 'OAKW' | 'OAKE' | 'SJCW' | 'SJCE';

export type SectorName =
  | 'Nugget'
  | 'Silver'
  | 'Elkhorn'
  | 'Paradise'
  | 'Seca'
  | 'Morgan'
  | 'Licke'
  | 'Toga'
  | 'Richmond'
  | 'Sutro'
  | 'Grove'
  | 'Valley'
  | 'Sunol'
  | 'Boulder'
  | 'Cedar'
  | 'Foster'
  | 'Laguna'
  | 'Niles'
  | 'Woodside';

export interface AirspaceConfigWithPolys {
  sectorName: SectorName;
  defaultColor: string;
  configPolyUrls: {
    configs: AirspaceConfig[];
    url: string;
  }[];
}

export interface AreaPolys {
  name: AirspaceConfigDependentGroup;
  defaultConfig: AirspaceConfig;
  possibleConfigs: AirspaceConfig[];
  sectorConfigs: AirspaceConfigWithPolys[];
}

export interface AirspaceDisplayState {
  name: AirspaceConfigDependentGroup;
  selectedConfig: AirspaceConfig;
  sectors: SectorDisplayState[];
}

export interface TraconAppDisplayState {
  updateCount: number;
  areaDisplayStates: AirspaceDisplayState[];
}

export interface PolyDefinition {
  name: AirspaceConfigDependentGroup;
  polys: AreaPolys;
}

export interface SectorDisplayState {
  name: SectorName;
  parentAreaName: AirspaceConfigDependentGroup;
  isDisplayed: boolean;
  color: string;
}

///////////////////////////////////////////////////
// Airport & Arrival interfaces
///////////////////////////////////////////////////
export interface AirportSection {
  id: string;
  isExpanded: boolean;
  arrivals: ArrivalProcedureDisplayState[];
}

export interface ArrivalProcedure {
  arrivalIdentifier: string;
  sequences: Sequence[];
}

export interface ArrivalProcedureDisplayState {
  id: string;
  isDisplayed: boolean;
  procedure: ArrivalProcedure;
}

export interface Sequence {
  transition?: string;
  transitionType: 'AreaNavigationCommon' | 'AreaNavigationEnroute' | 'AreaNavigationRunway';
  points: Point[];
}

export interface Point {
  identifier: string;
  latitude: number;
  longitude: number;
  minAltitude?: string;
  maxAltitude?: string;
}
