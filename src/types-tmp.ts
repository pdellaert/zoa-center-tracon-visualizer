import mapboxgl, { FillLayerSpecification } from "mapbox-gl";

interface BaseMap {
  name: string;
  url: string;
  sourceLayer: string;
  showDefault: boolean;
}

interface PersistedBaseMapState {
  id: string;
  baseMap: BaseMap;
  checked: boolean;
}

interface MountedBaseMapState {
  id: string;
  hasMounted: boolean;
}

interface MapStyle {
  value: string;
  label: string;
  disabled: boolean;
}

type AirspaceConfigDependentGroup = "RNO" | "SMF" | "A" | "B" | "C" | "D";

type AirspaceConfig =
  | "RNON"
  | "RNOS"
  | "SMFN"
  | "SMFS"
  | "SFOW"
  | "SFOE"
  | "SFO10"
  | "OAKE"
  | "SJCE"
  | "";

type AirportConfig = "SFOW" | "SFO19" | "SFO10" | "OAKW" | "OAKE" | "SJCW" | "SJCE";

type SectorName =
  | "Nugget"
  | "Silver"
  | "Elkhorn"
  | "Paradise"
  | "Seca"
  | "Morgan"
  | "Licke"
  | "Toga"
  | "Richmond"
  | "Sutro"
  | "Grove"
  | "Valley"
  | "Sunol"
  | "Boulder"
  | "Cedar"
  | "Foster"
  | "Laguna"
  | "Niles"
  | "Woodside";

interface AirspaceConfigWithPolys {
  sectorName: SectorName;
  defaultColor: string;
  configPolyUrls: {
    configs: AirspaceConfig[];
    url: string;
  }[];
}

interface AreaPolys {
  name: AirspaceConfigDependentGroup;
  defaultConfig: AirspaceConfig;
  possibleConfigs: AirspaceConfig[];
  sectorConfigs: AirspaceConfigWithPolys[];
}

interface AirspaceDisplayState {
  name: AirspaceConfigDependentGroup;
  selectedConfig: AirspaceConfig;
  sectors: SectorDisplayState[];
}

interface AppDisplayState {
  updateCount: number;
  areaDisplayStates: AirspaceDisplayState[];
}

interface PolyDefinition {
  name: AirspaceConfigDependentGroup;
  polys: AreaPolys;
}

interface SectorDisplayState {
  name: SectorName;
  parentAreaName: AirspaceConfigDependentGroup;
  isDisplayed: boolean;
  color: string;
}

interface PopupState {
  hoveredPolys: mapboxgl.MapboxGeoJSONFeature[];
  vis: boolean;
}

type RgbaDecimal = {
  r: number;
  g: number;
  b: number;
  a: number;
};

interface Settings {
  popup: {
    showUncheckedSectors: boolean;
    uncheckedSectorsInVisibleSectorsOnly: boolean;
    followMouse: boolean;
  };
}

export type {
  BaseMap,
  PersistedBaseMapState,
  MountedBaseMapState,
  MapStyle,
  AreaPolys,
  AirspaceConfig,
  AirspaceDisplayState,
  AppDisplayState,
  AirspaceConfigDependentGroup,
  SectorName,
  PolyDefinition,
  SectorDisplayState,
  PopupState,
  RgbaDecimal,
  Settings,
  AirportConfig,
};

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
  transitionType: "AreaNavigationCommon" | "AreaNavigationEnroute" | "AreaNavigationRunway";
  points: Point[];
}

export interface Point {
  identifier: string;
  latitude: number;
  longitude: number;
  minAltitude?: string;
  maxAltitude?: string;
}

export type FillPaint = FillLayerSpecification["paint"];
