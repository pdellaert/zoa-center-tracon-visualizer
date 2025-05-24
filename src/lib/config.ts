import { CenterAreaDefinition, BaseMap, MapStyle, TraconAreaPolys, TraconPolyDefinition } from '~/lib/types';
import { DEFAULT_MAP_STYLE } from '~/lib/defaults';

///////////////////////////////////////////////////
// Center Areas
///////////////////////////////////////////////////
// Area East
import sector30 from '~/polys/center/east/30.geojson';
import sector33 from '~/polys/center/east/33.geojson';
import sector34 from '~/polys/center/east/34.geojson';
import sector44 from '~/polys/center/east/44.geojson';
import sector45 from '~/polys/center/east/45.geojson';
import sector46 from '~/polys/center/east/46.geojson';

// Area North
import sector29 from '~/polys/center/north/29.geojson';
import sector32 from '~/polys/center/north/32.geojson';
import sector40 from '~/polys/center/north/40.geojson';
import sector41 from '~/polys/center/north/41.geojson';
import sector42 from '~/polys/center/north/42.geojson';
import sector43 from '~/polys/center/north/43.geojson';

// Pac North
import sector31 from '~/polys/center/pacnorth/31.geojson';
import sector36 from '~/polys/center/pacnorth/36.geojson';

// Pac South
import sector14 from '~/polys/center/pacsouth/14.geojson';
import sector35 from '~/polys/center/pacsouth/35.geojson';

// Area South
import sector10 from '~/polys/center/south/10.geojson';
import sector11 from '~/polys/center/south/11.geojson';
import sector13 from '~/polys/center/south/13.geojson';
import sector15 from '~/polys/center/south/15.geojson';
import sector16 from '~/polys/center/south/16.geojson';
import sector22 from '~/polys/center/south/22.geojson';

///////////////////////////////////////////////////
// Tracon Areas
///////////////////////////////////////////////////
// E-NV
import nugget from '~/polys/tracon/e-nv/nugget.geojson';
import silver from '~/polys/tracon/e-nv/silver.geojson';

// E-CA
import smfnElkhorn from '~/polys/tracon/e-ca/smfn-elkhorn.geojson';
import smfnParadise from '~/polys/tracon/e-ca/smfn-paradise.geojson';
import smfsElkhorn from '~/polys/tracon/e-ca/smfs-elkhorn.geojson';
import smfsParadise from '~/polys/tracon/e-ca/smfs-paradise.geojson';

// A
import morgan from '~/polys/tracon/a/morgan.geojson';
import seca from '~/polys/tracon/a/seca.geojson';
import sfowLicke from '~/polys/tracon/a/sfow-licke.geojson';
import sfowToga from '~/polys/tracon/a/sfow-toga.geojson';
import sfoeLicke from '~/polys/tracon/a/sfoe-licke.geojson';
import sfoeToga from '~/polys/tracon/a/sfoe-toga.geojson';
import sjceLicke from '~/polys/tracon/a/sjce-licke.geojson';
import sjceToga from '~/polys/tracon/a/sjce-toga.geojson';

// B
import sfowBoulder from '~/polys/tracon/b/sfow-boulder.geojson';
import sfowCedar from '~/polys/tracon/b/sfow-cedar.geojson';
import sfowFoster from '~/polys/tracon/b/sfow-foster.geojson';
import sfowLaguna from '~/polys/tracon/b/sfow-laguna.geojson';
import sfowNiles from '~/polys/tracon/b/sfow-niles.geojson';
import sfowWoodside from '~/polys/tracon/b/sfow-woodside.geojson';
import sfoeBoulder from '~/polys/tracon/b/sfoe-boulder.geojson';
import sfoeCedar from '~/polys/tracon/b/sfoe-cedar.geojson';
import sfoeFoster from '~/polys/tracon/b/sfoe-foster.geojson';
import sfoeLaguna from '~/polys/tracon/b/sfoe-laguna.geojson';
import sfoeNiles from '~/polys/tracon/b/sfoe-niles.geojson';
import sfoeWoodside from '~/polys/tracon/b/sfoe-woodside.geojson';
import sfo10Woodside from '~/polys/tracon/b/sfo10-woodside.geojson';
import sfo10Niles from '~/polys/tracon/b/sfo10-niles.geojson';
import sfo10Foster from '~/polys/tracon/b/sfo10-foster.geojson';
import sfo10Boulder from '~/polys/tracon/b/sfo10-boulder.geojson';
import oakeFoster from '~/polys/tracon/b/oake-foster.geojson';
import oakeBoulder from '~/polys/tracon/b/oake-boulder.geojson';

// C
import sfowValley from '~/polys/tracon/c/sfow-valley.geojson';
import sfowGrove from '~/polys/tracon/c/sfow-grove.geojson';
import sfowSunol from '~/polys/tracon/c/sfow-sunol.geojson';
import sfoeValley from '~/polys/tracon/c/sfoe-valley.geojson';
import sfoeGrove from '~/polys/tracon/c/sfoe-grove.geojson';
import sfoeSunol from '~/polys/tracon/c/sfoe-sunol.geojson';
import sfo10Grove from '~/polys/tracon/c/sfo10-grove.geojson';
import oakeGrove from '~/polys/tracon/c/oake-grove.geojson';

// D
import sfowRichmond from '~/polys/tracon/d/sfow-richmond.geojson';
import sfowSutro from '~/polys/tracon/d/sfow-sutro.geojson';
import sfoeRichmond from '~/polys/tracon/d/sfoe-richmond.geojson';
import sfoeSutro from '~/polys/tracon/d/sfoe-sutro.geojson';
import oakeRichmond from '~/polys/tracon/d/oake-richmond.geojson';
import oakeSutro from '~/polys/tracon/d/oake-sutro.geojson';

///////////////////////////////////////////////////
// Base Maps
///////////////////////////////////////////////////
export const NAVDATA_API_URL = 'https://navdata.oakartcc.org';

export const MAP_STYLES: MapStyle[] = [
  DEFAULT_MAP_STYLE,
  {
    value: 'mapbox://styles/mapbox/light-v11',
    label: 'World Light',
    disabled: false,
  },
  {
    value: 'mapbox://styles/kengreim/clw6l16rw002o01q1cq9h43ft',
    label: 'Satellite Low Opacity',
    disabled: false,
  },
];

export const BASE_MAPS: BaseMap[] = [
  {
    name: 'LO W-S',
    url: 'mapbox://kengreim.4525vady',
    sourceLayer: '01GE9SE1H343T0ZZQ6DP787MKV-2yipi9',
    showDefault: true,
  },
  {
    name: 'HI W-S',
    url: 'mapbox://kengreim.06318cwy',
    sourceLayer: '3_HI-W-536qzx',
    showDefault: false,
  },
  {
    name: 'LO E-N',
    url: 'mapbox://kengreim.24hjuu7e',
    sourceLayer: '2_LO-E-68fxnv',
    showDefault: false,
  },
  {
    name: 'HI E-N',
    url: 'mapbox://kengreim.1pttoy8k',
    sourceLayer: '4_HI-E-ddd7d9',
    showDefault: false,
  },
];

///////////////////////////////////////////////////
// Center Maps
///////////////////////////////////////////////////
const CENTER_AREA_NORTH_POLYS: CenterAreaDefinition = {
  name: 'Area North',
  sectors: [
    {
      sectorName: '29',
      defaultColor: '#e60049',
      polyUrl: sector29,
    },
    {
      sectorName: '32',
      defaultColor: '#0bb4ff',
      polyUrl: sector32,
    },
    {
      sectorName: '40',
      defaultColor: '#e6d800',
      polyUrl: sector40,
    },
    {
      sectorName: '41',
      defaultColor: '#fd9a5c',
      polyUrl: sector41,
    },
    {
      sectorName: '42',
      defaultColor: '#5100e6',
      polyUrl: sector42,
    },
    {
      sectorName: '43',
      defaultColor: '#621065',
      polyUrl: sector43,
    },
  ],
};

const CENTER_AREA_EAST_POLYS: CenterAreaDefinition = {
  name: 'Area East',
  sectors: [
    {
      sectorName: '30',
      defaultColor: '#31754f',
      polyUrl: sector30,
    },
    {
      sectorName: '33',
      defaultColor: '#674040',
      polyUrl: sector33,
    },
    {
      sectorName: '34',
      defaultColor: '#1abdaa',
      polyUrl: sector34,
    },
    {
      sectorName: '44',
      defaultColor: '#bca843',
      polyUrl: sector44,
    },
    {
      sectorName: '45',
      defaultColor: '#a30707',
      polyUrl: sector45,
    },
    {
      sectorName: '46',
      defaultColor: '#141955',
      polyUrl: sector46,
    },
  ],
};

const CENTER_PAC_NORTH_POLYS: CenterAreaDefinition = {
  name: 'Pac North',
  sectors: [
    {
      sectorName: '31',
      defaultColor: '#7D7F7D',
      polyUrl: sector31,
    },
    {
      sectorName: '36',
      defaultColor: '#FAD201',
      polyUrl: sector36,
    },
  ],
};

const CENTER_PAC_SOUTH_POLYS: CenterAreaDefinition = {
  name: 'Pac South',
  sectors: [
    {
      sectorName: '14',
      defaultColor: '#721422',
      polyUrl: sector14,
    },
    {
      sectorName: '35',
      defaultColor: '#2271B3',
      polyUrl: sector35,
    },
  ],
};

const CENTER_AREA_SOUTH_POLYS: CenterAreaDefinition = {
  name: 'Area South',
  sectors: [
    {
      sectorName: '10',
      defaultColor: '#317F43',
      polyUrl: sector10,
    },
    {
      sectorName: '11',
      defaultColor: '#1D1E33',
      polyUrl: sector11,
    },
    {
      sectorName: '13',
      defaultColor: '#e47070',
      polyUrl: sector13,
    },
    {
      sectorName: '15',
      defaultColor: '#a35b01',
      polyUrl: sector15,
    },
    {
      sectorName: '16',
      defaultColor: 'rgba(46,44,44,0.99)',
      polyUrl: sector16,
    },
    {
      sectorName: '22',
      defaultColor: '#8ce142',
      polyUrl: sector22,
    },
  ],
};

export const CENTER_POLY_DEFINITIONS = [
  CENTER_AREA_NORTH_POLYS,
  CENTER_AREA_EAST_POLYS,
  CENTER_AREA_SOUTH_POLYS,
  CENTER_PAC_NORTH_POLYS,
  CENTER_PAC_SOUTH_POLYS,
];

///////////////////////////////////////////////////
// Tracon Maps
///////////////////////////////////////////////////
const E_NV_POLYS: TraconAreaPolys = {
  name: 'RNO',
  defaultConfig: 'RNOS',
  possibleConfigs: ['RNOS', 'RNON'],
  sectorConfigs: [
    {
      sectorName: 'Nugget',
      defaultColor: '#e60049',
      configPolyUrls: [
        {
          configs: ['RNOS', 'RNON'],
          url: nugget,
        },
      ],
    },
    {
      sectorName: 'Silver',
      defaultColor: '#0bb4ff',
      configPolyUrls: [
        {
          configs: ['RNOS', 'RNON'],
          url: silver,
        },
      ],
    },
  ],
};

const E_CA_POLYS: TraconAreaPolys = {
  name: 'SMF',
  defaultConfig: 'SMFS',
  possibleConfigs: ['SMFS', 'SMFN'],
  sectorConfigs: [
    {
      sectorName: 'Paradise',
      defaultColor: '#e6d800',
      configPolyUrls: [
        {
          configs: ['SMFS'],
          url: smfsParadise,
        },
        {
          configs: ['SMFN'],
          url: smfnParadise,
        },
      ],
    },
    {
      sectorName: 'Elkhorn',
      defaultColor: '#50e991',
      configPolyUrls: [
        {
          configs: ['SMFS'],
          url: smfsElkhorn,
        },
        {
          configs: ['SMFN'],
          url: smfnElkhorn,
        },
      ],
    },
  ],
};

const D_POLYS: TraconAreaPolys = {
  name: 'Area D',
  defaultConfig: 'SFOW',
  possibleConfigs: ['SFOW', 'SFOE', 'OAKE'],
  sectorConfigs: [
    {
      sectorName: 'Richmond',
      defaultColor: '#fd9a5c',
      configPolyUrls: [
        {
          configs: ['SFOW'],
          url: sfowRichmond,
        },
        {
          configs: ['SFOE'],
          url: sfoeRichmond,
        },
        {
          configs: ['OAKE'],
          url: oakeRichmond,
        },
      ],
    },
    {
      sectorName: 'Sutro',
      defaultColor: '#5100e6',
      configPolyUrls: [
        {
          configs: ['SFOW'],
          url: sfowSutro,
        },
        {
          configs: ['SFOE'],
          url: sfoeSutro,
        },
        {
          configs: ['OAKE'],
          url: oakeSutro,
        },
      ],
    },
  ],
};

const A_POLYS: TraconAreaPolys = {
  name: 'Area A',
  defaultConfig: 'SFOW',
  possibleConfigs: ['SFOW', 'SFOE', 'SJCE'],
  sectorConfigs: [
    {
      sectorName: 'Morgan',
      defaultColor: '#621065',
      configPolyUrls: [
        {
          configs: ['SFOW', 'SFOE', 'SJCE'],
          url: morgan,
        },
      ],
    },
    {
      sectorName: 'Seca',
      defaultColor: '#31754f',
      configPolyUrls: [
        {
          configs: ['SFOW', 'SFOE', 'SJCE'],
          url: seca,
        },
      ],
    },
    {
      sectorName: 'Toga',
      defaultColor: '#674040',
      configPolyUrls: [
        {
          configs: ['SFOW'],
          url: sfowToga,
        },
        {
          configs: ['SFOE'],
          url: sfoeToga,
        },
        {
          configs: ['SJCE'],
          url: sjceToga,
        },
      ],
    },
    {
      sectorName: 'Licke',
      defaultColor: '#1abdaa',
      configPolyUrls: [
        {
          configs: ['SFOW'],
          url: sfowLicke,
        },
        {
          configs: ['SFOE'],
          url: sfoeLicke,
        },
        {
          configs: ['SJCE'],
          url: sjceLicke,
        },
      ],
    },
  ],
};

const C_POLYS: TraconAreaPolys = {
  name: 'Area C',
  defaultConfig: 'SFOW',
  possibleConfigs: ['SFOW', 'SFOE', 'SFO10', 'OAKE'],
  sectorConfigs: [
    {
      sectorName: 'Valley',
      defaultColor: '#bca843',
      configPolyUrls: [
        {
          configs: ['SFOW', 'OAKE'],
          url: sfowValley,
        },
        {
          configs: ['SFOE', 'SFO10'],
          url: sfoeValley,
        },
      ],
    },
    {
      sectorName: 'Grove',
      defaultColor: '#a30707',
      configPolyUrls: [
        {
          configs: ['SFOW'],
          url: sfowGrove,
        },
        {
          configs: ['SFOE'],
          url: sfoeGrove,
        },
        {
          configs: ['SFO10'],
          url: sfo10Grove,
        },
        {
          configs: ['OAKE'],
          url: oakeGrove,
        },
      ],
    },
    {
      sectorName: 'Sunol',
      defaultColor: '#141955',
      configPolyUrls: [
        {
          configs: ['SFOW', 'OAKE'],
          url: sfowSunol,
        },
        {
          configs: ['SFOE', 'SFO10'],
          url: sfoeSunol,
        },
      ],
    },
  ],
};

const B_POLYS: TraconAreaPolys = {
  name: 'Area B',
  defaultConfig: 'SFOW',
  possibleConfigs: ['SFOW', 'SFOE', 'SFO10', 'OAKE'],
  sectorConfigs: [
    {
      sectorName: 'Boulder',
      defaultColor: '#7D7F7D',
      configPolyUrls: [
        {
          configs: ['SFOW'],
          url: sfowBoulder,
        },
        {
          configs: ['SFOE'],
          url: sfoeBoulder,
        },
        {
          configs: ['SFO10'],
          url: sfo10Boulder,
        },
        {
          configs: ['OAKE'],
          url: oakeBoulder,
        },
      ],
    },
    {
      sectorName: 'Cedar',
      defaultColor: '#FAD201',
      configPolyUrls: [
        {
          configs: ['SFOW', 'OAKE'],
          url: sfowCedar,
        },
        {
          configs: ['SFOE', 'SFO10'],
          url: sfoeCedar,
        },
      ],
    },
    {
      sectorName: 'Foster',
      defaultColor: '#721422',
      configPolyUrls: [
        {
          configs: ['SFOW'],
          url: sfowFoster,
        },
        {
          configs: ['SFOE'],
          url: sfoeFoster,
        },
        {
          configs: ['SFO10'],
          url: sfo10Foster,
        },
        {
          configs: ['OAKE'],
          url: oakeFoster,
        },
      ],
    },
    {
      sectorName: 'Laguna',
      defaultColor: '#2271B3',
      configPolyUrls: [
        {
          configs: ['SFOW', 'OAKE'],
          url: sfowLaguna,
        },
        {
          configs: ['SFOE', 'SFO10'],
          url: sfoeLaguna,
        },
      ],
    },
    {
      sectorName: 'Niles',
      defaultColor: '#317F43',
      configPolyUrls: [
        {
          configs: ['SFOW', 'OAKE'],
          url: sfowNiles,
        },
        {
          configs: ['SFOE'],
          url: sfoeNiles,
        },
        {
          configs: ['SFO10'],
          url: sfo10Niles,
        },
      ],
    },
    {
      sectorName: 'Woodside',
      defaultColor: '#1D1E33',
      configPolyUrls: [
        {
          configs: ['SFOW', 'OAKE'],
          url: sfowWoodside,
        },
        {
          configs: ['SFOE'],
          url: sfoeWoodside,
        },
        {
          configs: ['SFO10'],
          url: sfo10Woodside,
        },
      ],
    },
  ],
};

export const TRACON_POLY_DEFINITIONS: TraconPolyDefinition[] = [
  { name: 'RNO', polys: E_NV_POLYS },
  { name: 'SMF', polys: E_CA_POLYS },
  { name: 'Area A', polys: A_POLYS },
  { name: 'Area B', polys: B_POLYS },
  { name: 'Area C', polys: C_POLYS },
  { name: 'Area D', polys: D_POLYS },
];
