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
export type TraconAirspaceConfigDependentGroup =
  | 'RAPCON'
  | 'FAT'
  | 'Area E NV'
  | 'Area E CA'
  | 'Area A'
  | 'Area B'
  | 'Area C'
  | 'Area D';

/** Valid TraconAirspaceConfig values - single source of truth */
export const TRACON_AIRSPACE_CONFIGS = [
  'FATN',
  'FATS',
  'RNON',
  'RNOS',
  'SMFN',
  'SMFS',
  'SFOW',
  'SFOE',
  'SFO10',
  'OAKE',
  'SJCE',
  '',
] as const;

export type TraconAirspaceConfig = (typeof TRACON_AIRSPACE_CONFIGS)[number];

/** Valid TraconAirportConfig values - single source of truth */
export const TRACON_AIRPORT_CONFIGS = ['SFOW', 'SFO19', 'SFO10', 'OAKW', 'OAKE', 'SJCW', 'SJCE'] as const;

export type TraconAirportConfig = (typeof TRACON_AIRPORT_CONFIGS)[number];

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
  | 'South'
  | 'Lemoore'
  | 'Fallon'
  | 'Travis';

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
// Airport & Procedure interfaces
///////////////////////////////////////////////////
export type ProcedureKind = 'sid' | 'star' | 'app';

export type LegType =
  | 'Initial'
  | 'TrackToFix'
  | 'CourseToFix'
  | 'DirectToFix'
  | 'HeadingToAltitude'
  | 'CourseToAltitude'
  | 'HeadingToManual'
  | 'CourseToManual'
  | 'FromFixToManual'
  | 'ManualTermination'
  | 'HeadingToIntercept'
  | 'HeadingToDme'
  | 'ConstantRadiusArc'
  | 'SingleCircuitTermination'
  | 'Turn';

export type FixDescription =
  | 'Essential'
  | 'ContinuousSegmentEnd'
  | 'FlyOver'
  | 'RunwayHelipad'
  | 'InitialApproach'
  | 'IntermediateApproach'
  | 'FinalApproachCourse'
  | 'FinalApproach'
  | 'TurnFinalApproach'
  | 'NamedStepdown'
  | 'Omnidirectional'
  | 'MissedApproach'
  | 'MissedApproachFirstLeg';

export interface Procedure {
  kind: ProcedureKind;
  airport: string;
  identifier: string;
  sequences: Sequence[];
}

export interface Sequence {
  transition?: string;
  transitionType: string;
  points: Point[];
  // Client-side annotation: coords of the runway this SID sequence departs from,
  // resolved by looking up matching RunwayHelipad points in the airport's approaches.
  runwayOrigin?: { latitude: number; longitude: number };
}

export interface Point {
  identifier: string | null;
  latitude: number | null;
  longitude: number | null;
  minAltitude?: string | null;
  maxAltitude?: string | null;
  legType: LegType;
  course: number;
  descriptions: FixDescription[];
}

export interface ProcedureDisplayState {
  id: string;
  isDisplayed: boolean;
  procedure: Procedure;
}

export interface ProcedureSubsection {
  isExpanded: boolean;
  items: ProcedureDisplayState[];
}

export interface AirportSection {
  id: string;
  isExpanded: boolean;
  subsections: {
    sids: ProcedureSubsection;
    stars: ProcedureSubsection;
    apps: ProcedureSubsection;
  };
}
