import { MapStyle, BaseMap, AreaPolys, PolyDefinition, Settings } from "./types-tmp";
import { Viewport } from "solid-map-gl";

// E-NV
import nugget from "./polys/e-nv/nugget.geojson";
import silver from "./polys/e-nv/silver.geojson";

// E-CA
import smfnElkhorn from "./polys/e-ca/smfn-elkhorn.geojson";
import smfnParadise from "./polys/e-ca/smfn-paradise.geojson";
import smfsElkhorn from "./polys/e-ca/smfs-elkhorn.geojson";
import smfsParadise from "./polys/e-ca/smfs-paradise.geojson";

// A
import morgan from "./polys/a/morgan.geojson";
import seca from "./polys/a/seca.geojson";
import sfowLicke from "./polys/a/sfow-licke.geojson";
import sfowToga from "./polys/a/sfow-toga.geojson";
import sfoeLicke from "./polys/a/sfoe-licke.geojson";
import sfoeToga from "./polys/a/sfoe-toga.geojson";
import sjceLicke from "./polys/a/sjce-licke.geojson";
import sjceToga from "./polys/a/sjce-toga.geojson";

// B
import sfowBoulder from "./polys/b/sfow-boulder.geojson";
import sfowCedar from "./polys/b/sfow-cedar.geojson";
import sfowFoster from "./polys/b/sfow-foster.geojson";
import sfowLaguna from "./polys/b/sfow-laguna.geojson";
import sfowNiles from "./polys/b/sfow-niles.geojson";
import sfowWoodside from "./polys/b/sfow-woodside.geojson";
import sfoeBoulder from "./polys/b/sfoe-boulder.geojson";
import sfoeCedar from "./polys/b/sfoe-cedar.geojson";
import sfoeFoster from "./polys/b/sfoe-foster.geojson";
import sfoeLaguna from "./polys/b/sfoe-laguna.geojson";
import sfoeNiles from "./polys/b/sfoe-niles.geojson";
import sfoeWoodside from "./polys/b/sfoe-woodside.geojson";
import sfo10Woodside from "./polys/b/sfo10-woodside.geojson";
import sfo10Niles from "./polys/b/sfo10-niles.geojson";
import sfo10Foster from "./polys/b/sfo10-foster.geojson";
import sfo10Boulder from "./polys/b/sfo10-boulder.geojson";
import oakeFoster from "./polys/b/oake-foster.geojson";
import oakeBoulder from "./polys/b/oake-boulder.geojson";

// C
import sfowValley from "./polys/c/sfow-valley.geojson";
import sfowGrove from "./polys/c/sfow-grove.geojson";
import sfowSunol from "./polys/c/sfow-sunol.geojson";
import sfoeValley from "./polys/c/sfoe-valley.geojson";
import sfoeGrove from "./polys/c/sfoe-grove.geojson";
import sfoeSunol from "./polys/c/sfoe-sunol.geojson";
import sfo10Grove from "./polys/c/sfo10-grove.geojson";
import oakeGrove from "./polys/c/oake-grove.geojson";

// D
import sfowRichmond from "./polys/d/sfow-richmond.geojson";
import sfowSutro from "./polys/d/sfow-sutro.geojson";
import sfoeRichmond from "./polys/d/sfoe-richmond.geojson";
import sfoeSutro from "./polys/d/sfoe-sutro.geojson";
import oakeRichmond from "./polys/d/oake-richmond.geojson";
import oakeSutro from "./polys/d/oake-sutro.geojson";

const DEFAULT_MAP_STYLE: MapStyle = {
  value: "mapbox://styles/mapbox/empty-v9",
  label: "Empty",
  disabled: false,
};

const DEFAULT_VIEWPORT: Viewport = {
  center: [-121.4, 37.8],
  zoom: 7,
  pitch: 0,
  bearing: 0,
};

const MAP_STYLES: MapStyle[] = [
  DEFAULT_MAP_STYLE,
  {
    value: "mapbox://styles/mapbox/light-v11",
    label: "World Light",
    disabled: false,
  },
  {
    value: "mapbox://styles/kengreim/clw6l16rw002o01q1cq9h43ft",
    label: "Satellite Low Opacity",
    disabled: false,
  },
];

const BASE_MAPS: BaseMap[] = [
  {
    name: "LO W-S",
    url: "mapbox://kengreim.4525vady",
    sourceLayer: "01GE9SE1H343T0ZZQ6DP787MKV-2yipi9",
    showDefault: true,
  },
  {
    name: "HI W-S",
    url: "mapbox://kengreim.06318cwy",
    sourceLayer: "3_HI-W-536qzx",
    showDefault: false,
  },
  {
    name: "LO E-N",
    url: "mapbox://kengreim.24hjuu7e",
    sourceLayer: "2_LO-E-68fxnv",
    showDefault: false,
  },
  {
    name: "HI E-N",
    url: "mapbox://kengreim.1pttoy8k",
    sourceLayer: "4_HI-E-ddd7d9",
    showDefault: false,
  },
];

const BAY_DEFAULT_CONFIG = "SFOW";

const DEFAULT_SETTINGS: Settings = {
  popup: {
    showUncheckedSectors: false,
    uncheckedSectorsInVisibleSectorsOnly: false,
    followMouse: true,
  },
};

const E_NV_POLYS: AreaPolys = {
  name: "RNO",
  defaultConfig: "RNOS",
  possibleConfigs: ["RNOS", "RNON"],
  sectorConfigs: [
    {
      sectorName: "Nugget",
      defaultColor: "#e60049",
      configPolyUrls: [
        {
          configs: ["RNOS", "RNON"],
          url: nugget,
        },
      ],
    },
    {
      sectorName: "Silver",
      defaultColor: "#0bb4ff",
      configPolyUrls: [
        {
          configs: ["RNOS", "RNON"],
          url: silver,
        },
      ],
    },
  ],
};

const E_CA_POLYS: AreaPolys = {
  name: "SMF",
  defaultConfig: "SMFS",
  possibleConfigs: ["SMFS", "SMFN"],
  sectorConfigs: [
    {
      sectorName: "Paradise",
      defaultColor: "#e6d800",
      configPolyUrls: [
        {
          configs: ["SMFS"],
          url: smfsParadise,
        },
        {
          configs: ["SMFN"],
          url: smfnParadise,
        },
      ],
    },
    {
      sectorName: "Elkhorn",
      defaultColor: "#50e991",
      configPolyUrls: [
        {
          configs: ["SMFS"],
          url: smfsElkhorn,
        },
        {
          configs: ["SMFN"],
          url: smfnElkhorn,
        },
      ],
    },
  ],
};

const D_POLYS: AreaPolys = {
  name: "D",
  defaultConfig: "SFOW",
  possibleConfigs: ["SFOW", "SFOE", "OAKE"],
  sectorConfigs: [
    {
      sectorName: "Richmond",
      defaultColor: "#fd9a5c",
      configPolyUrls: [
        {
          configs: ["SFOW"],
          url: sfowRichmond,
        },
        {
          configs: ["SFOE"],
          url: sfoeRichmond,
        },
        {
          configs: ["OAKE"],
          url: oakeRichmond,
        },
      ],
    },
    {
      sectorName: "Sutro",
      defaultColor: "#5100e6",
      configPolyUrls: [
        {
          configs: ["SFOW"],
          url: sfowSutro,
        },
        {
          configs: ["SFOE"],
          url: sfoeSutro,
        },
        {
          configs: ["OAKE"],
          url: oakeSutro,
        },
      ],
    },
  ],
};

const A_POLYS: AreaPolys = {
  name: "A",
  defaultConfig: "SFOW",
  possibleConfigs: ["SFOW", "SFOE", "SJCE"],
  sectorConfigs: [
    {
      sectorName: "Morgan",
      defaultColor: "#621065",
      configPolyUrls: [
        {
          configs: ["SFOW", "SFOE", "SJCE"],
          url: morgan,
        },
      ],
    },
    {
      sectorName: "Seca",
      defaultColor: "#31754f",
      configPolyUrls: [
        {
          configs: ["SFOW", "SFOE", "SJCE"],
          url: seca,
        },
      ],
    },
    {
      sectorName: "Toga",
      defaultColor: "#674040",
      configPolyUrls: [
        {
          configs: ["SFOW"],
          url: sfowToga,
        },
        {
          configs: ["SFOE"],
          url: sfoeToga,
        },
        {
          configs: ["SJCE"],
          url: sjceToga,
        },
      ],
    },
    {
      sectorName: "Licke",
      defaultColor: "#1abdaa",
      configPolyUrls: [
        {
          configs: ["SFOW"],
          url: sfowLicke,
        },
        {
          configs: ["SFOE"],
          url: sfoeLicke,
        },
        {
          configs: ["SJCE"],
          url: sjceLicke,
        },
      ],
    },
  ],
};

const C_POLYS: AreaPolys = {
  name: "C",
  defaultConfig: "SFOW",
  possibleConfigs: ["SFOW", "SFOE", "SFO10", "OAKE"],
  sectorConfigs: [
    {
      sectorName: "Valley",
      defaultColor: "#bca843",
      configPolyUrls: [
        {
          configs: ["SFOW", "OAKE"],
          url: sfowValley,
        },
        {
          configs: ["SFOE", "SFO10"],
          url: sfoeValley,
        },
      ],
    },
    {
      sectorName: "Grove",
      defaultColor: "#a30707",
      configPolyUrls: [
        {
          configs: ["SFOW"],
          url: sfowGrove,
        },
        {
          configs: ["SFOE"],
          url: sfoeGrove,
        },
        {
          configs: ["SFO10"],
          url: sfo10Grove,
        },
        {
          configs: ["OAKE"],
          url: oakeGrove,
        },
      ],
    },
    {
      sectorName: "Sunol",
      defaultColor: "#141955",
      configPolyUrls: [
        {
          configs: ["SFOW", "OAKE"],
          url: sfowSunol,
        },
        {
          configs: ["SFOE", "SFO10"],
          url: sfoeSunol,
        },
      ],
    },
  ],
};

const B_POLYS: AreaPolys = {
  name: "B",
  defaultConfig: "SFOW",
  possibleConfigs: ["SFOW", "SFOE", "SFO10", "OAKE"],
  sectorConfigs: [
    {
      sectorName: "Boulder",
      defaultColor: "#7D7F7D",
      configPolyUrls: [
        {
          configs: ["SFOW"],
          url: sfowBoulder,
        },
        {
          configs: ["SFOE"],
          url: sfoeBoulder,
        },
        {
          configs: ["SFO10"],
          url: sfo10Boulder,
        },
        {
          configs: ["OAKE"],
          url: oakeBoulder,
        },
      ],
    },
    {
      sectorName: "Cedar",
      defaultColor: "#FAD201",
      configPolyUrls: [
        {
          configs: ["SFOW", "OAKE"],
          url: sfowCedar,
        },
        {
          configs: ["SFOE", "SFO10"],
          url: sfoeCedar,
        },
      ],
    },
    {
      sectorName: "Foster",
      defaultColor: "#721422",
      configPolyUrls: [
        {
          configs: ["SFOW"],
          url: sfowFoster,
        },
        {
          configs: ["SFOE"],
          url: sfoeFoster,
        },
        {
          configs: ["SFO10"],
          url: sfo10Foster,
        },
        {
          configs: ["OAKE"],
          url: oakeFoster,
        },
      ],
    },
    {
      sectorName: "Laguna",
      defaultColor: "#2271B3",
      configPolyUrls: [
        {
          configs: ["SFOW", "OAKE"],
          url: sfowLaguna,
        },
        {
          configs: ["SFOE", "SFO10"],
          url: sfoeLaguna,
        },
      ],
    },
    {
      sectorName: "Niles",
      defaultColor: "#317F43",
      configPolyUrls: [
        {
          configs: ["SFOW", "OAKE"],
          url: sfowNiles,
        },
        {
          configs: ["SFOE"],
          url: sfoeNiles,
        },
        {
          configs: ["SFO10"],
          url: sfo10Niles,
        },
      ],
    },
    {
      sectorName: "Woodside",
      defaultColor: "#1D1E33",
      configPolyUrls: [
        {
          configs: ["SFOW", "OAKE"],
          url: sfowWoodside,
        },
        {
          configs: ["SFOE"],
          url: sfoeWoodside,
        },
        {
          configs: ["SFO10"],
          url: sfo10Woodside,
        },
      ],
    },
  ],
};

const POLY_DEFINITIONS: PolyDefinition[] = [
  { name: "RNO", polys: E_NV_POLYS },
  { name: "SMF", polys: E_CA_POLYS },
  { name: "A", polys: A_POLYS },
  { name: "B", polys: B_POLYS },
  { name: "C", polys: C_POLYS },
  { name: "D", polys: D_POLYS },
];

export {
  DEFAULT_MAP_STYLE,
  MAP_STYLES,
  BASE_MAPS,
  POLY_DEFINITIONS,
  DEFAULT_VIEWPORT,
  DEFAULT_SETTINGS,
};

export const NAVDATA_API_URL = "https://navdata.oakartcc.org";
