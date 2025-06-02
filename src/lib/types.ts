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
  centerDisplayStates: CenterAirspaceDisplayState[];
  areaDisplayStates: TraconAirspaceDisplayState[];
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
export type TraconAirspaceConfigDependentGroup = 'FAT' | 'RNO' | 'SMF' | 'Area A' | 'Area B' | 'Area C' | 'Area D';

export type TraconAirspaceConfig =
  | 'FATN'
  | 'FATS'
  | 'RNON'
  | 'RNOS'
  | 'SMFN'
  | 'SMFS'
  | 'SFOW'
  | 'SFOE'
  | 'SFO10'
  | 'OAKE'
  | 'SJCE'
  | '';

export type TraconAirportConfig = 'SFOW' | 'SFO19' | 'SFO10' | 'OAKW' | 'OAKE' | 'SJCW' | 'SJCE';

export type TraconSectorName =
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
  | 'Woodside'
  | 'Friant'
  | 'Chandler'
  | 'FAT South';

export interface TraconAirspaceConfigWithPolys {
  sectorName: TraconSectorName;
  defaultColor: string;
  configPolyUrls: {
    configs: TraconAirspaceConfig[];
    url: string;
  }[];
}

export interface TraconAreaPolys {
  name: TraconAirspaceConfigDependentGroup;
  defaultConfig: TraconAirspaceConfig;
  possibleConfigs: TraconAirspaceConfig[];
  sectorConfigs: TraconAirspaceConfigWithPolys[];
}

export interface TraconAirspaceDisplayState {
  name: TraconAirspaceConfigDependentGroup;
  selectedConfig: TraconAirspaceConfig;
  sectors: TraconSectorDisplayState[];
}

export interface TraconAppDisplayState {
  areaDisplayStates: TraconAirspaceDisplayState[];
}

export interface TraconPolyDefinition {
  name: TraconAirspaceConfigDependentGroup;
  polys: TraconAreaPolys;
}

export interface TraconSectorDisplayState {
  name: TraconSectorName;
  parentAreaName: TraconAirspaceConfigDependentGroup;
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
