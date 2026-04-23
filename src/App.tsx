import { makePersisted } from '@solid-primitives/storage';
import { Accessor, Component, createEffect, createMemo, createSignal, DEV, For, Setter, Show, untrack } from 'solid-js';
import { DEFAULT_MAP_STYLE, DEFAULT_SETTINGS, DEFAULT_VIEWPORT } from '~/lib/defaults';
import { Section, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui-core';
import { MapStyleSelector } from '~/components/MapStyleSelector';
import { createStore, produce } from 'solid-js/store';
import { BASE_MAPS, CENTER_POLY_DEFINITIONS, TRACON_POLY_DEFINITIONS } from '~/lib/config';
import {
  CenterAirspaceDisplayState,
  AppDisplayState,
  CenterAreaDefinition,
  FillPaint,
  MountedBaseMapState,
  PersistedBaseMapState,
  PopupState,
  Settings,
  Procedure,
  TraconAirspaceConfig,
  TraconAirportConfig,
  TraconAreaPolys,
  TraconAirspaceDisplayState,
} from '~/lib/types';
import { Checkbox } from '~/components/ui-core/Checkbox';
import { Footer } from '~/components/Footer';
import { MapReset } from '~/components/MapReset';

// Mapbox
import MapGL from 'solid-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { BaseMaps } from '~/components/BaseMaps';
import { BaseMapColorSync } from '~/components/BaseMapColorSync';
import { StyleSwitchFix } from '~/components/StyleSwitchFix';
import { GeojsonPolySources } from '~/components/GeojsonPolySources';
import { GeojsonPolyLayers } from '~/components/GeojsonPolyLayers';
import { SectorDisplayWithControls } from '~/components/SectorDisplayWithControls';
import { SettingsDialog } from '~/components/SettingsDialog';
import { GeoJSONFeature, MapMouseEvent } from 'mapbox-gl';
import { getUniqueLayers, isTransparentFill, getGeojsonSources } from '~/lib/geojson';
import { logIfDev } from '~/lib/dev';
import { InfoPopup } from '~/components/InfoPopup';
import { ProceduresDialog } from '~/components/ProceduresDialog';
import { ProcedurePoints } from '~/components/ProcedurePoints';
import { ShareButton } from '~/components/ShareButton';
import {
  getURLStateParam,
  decodeStateFromURL,
  applyURLStateToDefaults,
  getURLConfigState,
  DEFAULT_CONFIGS,
} from '~/lib/urlState';

const createCenterDefaultState = (area: CenterAreaDefinition): CenterAirspaceDisplayState => ({
  name: area.name,
  sectors: area.sectors.map((s) => ({
    name: s.sectorName,
    isDisplayed: false,
    color: s.defaultColor,
  })),
});

const createTraconDefaultState = (config: TraconAreaPolys): TraconAirspaceDisplayState => ({
  name: config.name,
  selectedConfig: config.defaultConfig,
  sectors: config.sectorConfigs.map((c) => ({
    name: c.sectorName,
    parentAreaName: config.name,
    isDisplayed: false,
    color: c.defaultColor,
  })),
});

const App: Component = () => {
  const [viewport, setViewport] = makePersisted(createSignal(DEFAULT_VIEWPORT), {
    name: 'viewport',
  });

  const [mapStyle, setMapStyle] = makePersisted(createSignal(DEFAULT_MAP_STYLE), {
    name: 'mapStyle',
  });

  const [persistedBaseMaps, setPersistedBaseMaps] = makePersisted(
    createStore<PersistedBaseMapState[]>(
      BASE_MAPS.map((m) => ({
        id: m.name,
        baseMap: m,
        checked: m.showDefault,
      })),
    ),
    { name: 'baseMaps' },
  );

  const [mountedBaseMaps, setMountedBaseMaps] = createStore<MountedBaseMapState[]>(
    persistedBaseMaps.map((m) => ({ id: m.baseMap.name, hasMounted: m.checked })),
  );

  const [cursor, setCursor] = createSignal('grab');

  const [settings, setSettings] = makePersisted(createStore<Settings>(DEFAULT_SETTINGS), {
    name: 'settings',
  });

  const centerSources = CENTER_POLY_DEFINITIONS.flatMap((a) =>
    a.sectors.map((s: { sectorName: string; polyUrl: string }) => ({
      id: s.sectorName,
      url: s.polyUrl,
    })),
  );

  const traconSources = TRACON_POLY_DEFINITIONS.flatMap((p) => getGeojsonSources(p.polys));

  const allSources = [...centerSources, ...traconSources];

  const [activeTab, setActiveTab] = createSignal<'tracon' | 'center'>('tracon');

  // Check for URL state parameter and decode it
  const urlStateParam = getURLStateParam();
  const decodedURLState = decodeStateFromURL(urlStateParam);
  const urlConfigState = getURLConfigState(decodedURLState);

  // Create default state
  const defaultDisplayState: AppDisplayState = {
    centerDisplayStates: CENTER_POLY_DEFINITIONS.map(createCenterDefaultState),
    areaDisplayStates: TRACON_POLY_DEFINITIONS.map((p) => createTraconDefaultState(p.polys)),
  };

  // Invalidate persisted state if area names don't match current config
  // (handles renames without requiring users to clear localStorage)
  const storedDisplay = localStorage.getItem('currentDisplay');
  if (storedDisplay) {
    try {
      const parsed = JSON.parse(storedDisplay) as AppDisplayState;
      const expectedCenterNames = CENTER_POLY_DEFINITIONS.map((a) => a.name);
      const expectedTraconNames = TRACON_POLY_DEFINITIONS.map((p) => p.polys.name);
      const storedCenterNames = parsed.centerDisplayStates?.map((s) => s.name) ?? [];
      const storedTraconNames = parsed.areaDisplayStates?.map((s) => s.name) ?? [];

      if (
        expectedCenterNames.some((name, i) => storedCenterNames[i] !== name) ||
        expectedTraconNames.some((name, i) => storedTraconNames[i] !== name)
      ) {
        localStorage.removeItem('currentDisplay');
      }
    } catch {
      localStorage.removeItem('currentDisplay');
    }
  }

  // Create persisted store (will load from localStorage if available)
  const [allStore, setAllStore] = makePersisted(createStore<AppDisplayState>(defaultDisplayState), {
    name: 'currentDisplay',
  });

  // If URL state exists, override whatever makePersisted loaded from localStorage
  if (decodedURLState) {
    const urlDisplayState = applyURLStateToDefaults(
      decodedURLState,
      CENTER_POLY_DEFINITIONS,
      TRACON_POLY_DEFINITIONS,
      createCenterDefaultState,
      createTraconDefaultState,
    );
    setAllStore(urlDisplayState);
  }

  const [popup, setPopup] = createStore<PopupState>({
    hoveredPolys: [],
    vis: false,
  });

  const [displayedProcedures, setDisplayedProcedures] = createSignal<Procedure[]>([]);
  const [isProceduresOpen, setIsProceduresOpen] = createSignal(false);
  const [is3D, setIs3D] = createSignal(false);

  const toggle3D = () => {
    const newIs3D = !is3D();
    setIs3D(newIs3D);
    setViewport((v) => ({
      ...v,
      pitch: newIs3D ? 50 : 0,
      bearing: newIs3D ? -15 : 0,
    }));
  };

  const altitudeHover = (evt: MapMouseEvent) => {
    if (is3D()) {
      setPopup('vis', false);
      return;
    }
    if (!evt.target.isStyleLoaded()) return;
    const features: GeoJSONFeature[] = evt.target.queryRenderedFeatures(evt.point, {
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['has', 'minAlt'], ['has', 'maxAlt']],
    });
    const fillLayers = getUniqueLayers(features.filter((f) => f.layer?.type == 'fill'));
    if (fillLayers.length > 0) {
      logIfDev(fillLayers);
      let transparentLayers: GeoJSONFeature[] = [];
      let visibleLayers: GeoJSONFeature[] = [];
      fillLayers.forEach((l) =>
        isTransparentFill(l.layer?.paint as FillPaint) ? transparentLayers.push(l) : visibleLayers.push(l),
      );
      if (settings.popup.showUncheckedSectors) {
        setPopup(
          produce((state) => {
            state.vis = settings.popup.uncheckedSectorsInVisibleSectorsOnly ? visibleLayers.length > 0 : true;
            state.hoveredPolys = fillLayers;
          }),
        );
      } else {
        setPopup(
          produce((state) => {
            state.vis = visibleLayers.length > 0;
            state.hoveredPolys = visibleLayers;
          }),
        );
      }
    } else {
      setPopup('vis', false);
    }
  };

  createEffect(() => {
    if (popup.vis) setCursor('crosshair');
    else setCursor('grab');
  });

  const handleProcedureToggle = (procedure: Procedure, isDisplayed: boolean) => {
    setDisplayedProcedures((prev) => {
      if (isDisplayed) {
        return [...prev, procedure];
      }
      return prev.filter(
        (p) =>
          !(
            p.kind === procedure.kind &&
            p.airport === procedure.airport &&
            p.identifier === procedure.identifier
          ),
      );
    });
  };

  // Helper to create a persisted config signal that uses URL state if available
  // makePersisted ignores initial value if localStorage has data, so we must
  // explicitly set the value after creation when URL state is present
  const createConfigSignal = <T,>(
    defaultValue: T,
    urlValue: T | undefined,
    storageName: string,
  ): [Accessor<T>, Setter<T>] => {
    const [get, set] = makePersisted(createSignal<T>(defaultValue), { name: storageName });
    // If URL state exists, override whatever makePersisted loaded from localStorage
    if (urlValue !== undefined) {
      set(() => urlValue);
    }
    return [get, set];
  };

  const [bayConfig, setBayConfig] = createConfigSignal<TraconAirspaceConfig>(
    DEFAULT_CONFIGS.bayConfig,
    urlConfigState.bayConfig,
    'bayConfig',
  );
  const [sfoConfig, setSfoConfig] = createConfigSignal<TraconAirportConfig>(
    DEFAULT_CONFIGS.sfoConfig,
    urlConfigState.sfoConfig,
    'sfoConfig',
  );
  const [oakConfig, setOakConfig] = createConfigSignal<TraconAirportConfig>(
    DEFAULT_CONFIGS.oakConfig,
    urlConfigState.oakConfig,
    'oakConfig',
  );
  const [sjcConfig, setSjcConfig] = createConfigSignal<TraconAirportConfig>(
    DEFAULT_CONFIGS.sjcConfig,
    urlConfigState.sjcConfig,
    'sjcConfig',
  );

  const sfoOptions = createMemo(() => {
    if (bayConfig() === 'SFOW') {
      return ['SFOW'];
    } else if (bayConfig() === 'SFOE') {
      return ['SFO19', 'SFO10'];
    } else {
      return [];
    }
  });

  const oakOptions = createMemo(() => (bayConfig() === 'SFOW' ? ['OAKW', 'OAKE'] : ['OAKE']));
  const sjcOptions = createMemo(() => (bayConfig() === 'SFOW' ? ['SJCW', 'SJCE'] : ['SJCE']));

  const areaA: Accessor<TraconAirspaceConfig> = createMemo(() => {
    if (bayConfig() === 'SFOW') {
      return sjcConfig() === 'SJCE' ? 'SJCE' : 'SFOW';
    } else {
      return bayConfig() === 'SFOE' ? 'SFOE' : '';
    }
  });

  const areaBC: Accessor<TraconAirspaceConfig> = createMemo(() => {
    if (bayConfig() === 'SFOW') {
      return oakConfig() === 'OAKE' ? 'OAKE' : 'SFOW';
    } else {
      if (bayConfig() === 'SFOE') {
        return sfoConfig() === 'SFO19' ? 'SFOE' : 'SFO10';
      } else {
        return '';
      }
    }
  });

  const areaD: Accessor<TraconAirspaceConfig> = createMemo(() => {
    if (bayConfig() === 'SFOW') {
      return oakConfig() === 'OAKE' ? 'OAKE' : 'SFOW';
    } else {
      return bayConfig() === 'SFOE' ? 'SFOE' : '';
    }
  });

  const rapcon: Accessor<TraconAirspaceConfig> = createMemo(() => {
    return bayConfig();
  });

  createEffect((isInitialLoad) => {
    const currentBayConfig = bayConfig();

    if (currentBayConfig === 'SFOW') {
      setSfoConfig(DEFAULT_CONFIGS.sfoConfig);

      if (!isInitialLoad) {
        setOakConfig(DEFAULT_CONFIGS.oakConfig);
        setSjcConfig(DEFAULT_CONFIGS.sjcConfig);
      }
    } else if (currentBayConfig === 'SFOE') {
      const currentSfoConfig = untrack(sfoConfig);
      if (currentSfoConfig === DEFAULT_CONFIGS.sfoConfig || currentSfoConfig == null) {
        setSfoConfig('SFO19');
      }

      setOakConfig('OAKE');
      setSjcConfig('SJCE');
    }
    return false;
  }, true);

  // Console debugging effects only created in DEV
  if (import.meta.env.DEV) {
    createEffect(() => {
      console.log('Sectors display state', allStore.areaDisplayStates);
    });
    createEffect(() => {
      console.log('Popup visibility state changed', popup.vis);
    });
  }

  return (
    <div class="flex h-screen">
      <div class="flex flex-col bg-slate-900 p-4 justify-between overflow-auto overscroll-contain z-50 pr-6">
        <div class="flex flex-col space-y-4">
          <h1 class="text-white text-2xl">ZOA Visualizer</h1>

          <button
            onClick={() => setIsProceduresOpen((prev) => !prev)}
            class="flex items-center justify-center w-36 h-10 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors cursor-pointer"
            title="Airport Procedures"
          >
            Procedures
          </button>

          <Section header="Style">
            <MapStyleSelector style={mapStyle} setStyle={setMapStyle} />
          </Section>

          <Section header="Base Maps">
            <div class="flex flex-col space-y-1">
              <For each={persistedBaseMaps}>
                {(m) => (
                  <Checkbox
                    label={m.baseMap.name}
                    checked={m.checked}
                    onChange={(val: boolean) => {
                      setPersistedBaseMaps(
                        (m1) => m1.id === m.id,
                        produce((m2) => {
                          m2.checked = val;
                        }),
                      );
                      let persisted = persistedBaseMaps.find((m1) => m1.id == m.id);
                      setMountedBaseMaps(
                        (m1) => m1.id === m.id,
                        produce((m2) => {
                          m2.hasMounted = m2.hasMounted || persisted!.checked;
                        }),
                      );
                    }}
                  />
                )}
              </For>
            </div>
          </Section>

          <Section header="" class="space-y-2">
            <div class="flex border-b border-slate-600 mb-2">
              <button
                class={`px-4 py-2 font-medium ${activeTab() === 'tracon' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setActiveTab('tracon')}
              >
                TRACON
              </button>
              <button
                class={`px-4 py-2 font-medium ${activeTab() === 'center' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                onClick={() => setActiveTab('center')}
              >
                Center
              </button>
            </div>

            <Show when={activeTab() === 'tracon'}>
              {/*Temporary select for SFOW/SFOE*/}
              <div>
                <span class="block text-md text-white mb-1">Bay Flow</span>
                <Select
                  options={['SFOW', 'SFOE']}
                  value={bayConfig()}
                  onChange={(val) => {
                    if (val) {
                      setBayConfig(val);
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
              </div>

              <div>
                <span class="block text-md text-white mb-1">Airport Configs</span>
                <div class="flex flex-col space-y-2">
                  <Select
                    options={sfoOptions()}
                    value={sfoConfig()}
                    onChange={(val) => {
                      if (val) {
                        setSfoConfig(val);
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

                  <Select
                    options={oakOptions()}
                    value={oakConfig()}
                    onChange={(val) => {
                      if (val) {
                        setOakConfig(val);
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

                  <Select
                    options={sjcOptions()}
                    value={sjcConfig()}
                    onChange={(val) => {
                      if (val) {
                        setSjcConfig(val);
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
                </div>
              </div>

              <SectorDisplayWithControls
                displayType="tracon"
                airspaceGroup={'Area A'}
                store={allStore}
                setStore={setAllStore}
                dependentOnConfig={areaA()}
              />

              <SectorDisplayWithControls
                displayType="tracon"
                airspaceGroup={'Area B'}
                store={allStore}
                setStore={setAllStore}
                dependentOnConfig={areaBC()}
              />

              <SectorDisplayWithControls
                displayType="tracon"
                airspaceGroup={'Area C'}
                store={allStore}
                setStore={setAllStore}
                dependentOnConfig={areaBC()}
              />

              <SectorDisplayWithControls
                displayType="tracon"
                airspaceGroup={'Area D'}
                store={allStore}
                setStore={setAllStore}
                dependentOnConfig={areaD()}
              />

              <SectorDisplayWithControls
                displayType="tracon"
                airspaceGroup={'Area E CA'}
                airspaceConfigOptions={['SMFS', 'SMFN']}
                store={allStore}
                setStore={setAllStore}
              />

              <SectorDisplayWithControls
                displayType="tracon"
                airspaceGroup={'Area E NV'}
                airspaceConfigOptions={['RNOS', 'RNON']}
                store={allStore}
                setStore={setAllStore}
              />

              <SectorDisplayWithControls
                displayType="tracon"
                airspaceGroup={'FAT'}
                airspaceConfigOptions={['FATS', 'FATN']}
                store={allStore}
                setStore={setAllStore}
              />

              <SectorDisplayWithControls
                displayType="tracon"
                airspaceGroup={'RAPCON'}
                store={allStore}
                setStore={setAllStore}
                dependentOnConfig={rapcon()}
              />
            </Show>

            <Show when={activeTab() === 'center'}>
              <SectorDisplayWithControls
                displayType="center"
                airspaceGroup={'Area North'}
                store={allStore}
                setStore={setAllStore}
              />

              <SectorDisplayWithControls
                displayType="center"
                airspaceGroup={'Area East'}
                store={allStore}
                setStore={setAllStore}
              />

              <SectorDisplayWithControls
                displayType="center"
                airspaceGroup={'Area South'}
                store={allStore}
                setStore={setAllStore}
              />

              <SectorDisplayWithControls
                displayType="center"
                airspaceGroup={'Pac North'}
                store={allStore}
                setStore={setAllStore}
              />

              <SectorDisplayWithControls
                displayType="center"
                airspaceGroup={'Pac South'}
                store={allStore}
                setStore={setAllStore}
              />
            </Show>
          </Section>
        </div>
        <Footer />
      </div>
      <div class="grow relative">
        <InfoPopup popupState={popup} settings={settings} />

        <div class="absolute top-5 left-5 z-50 flex space-x-2">
          <SettingsDialog settings={settings} setSettings={setSettings} />
          <ShareButton
            store={allStore}
            centerDefaults={CENTER_POLY_DEFINITIONS}
            traconDefaults={TRACON_POLY_DEFINITIONS}
            bayConfig={bayConfig}
            sfoConfig={sfoConfig}
            oakConfig={oakConfig}
            sjcConfig={sjcConfig}
          />
        </div>

        <div class="absolute top-5 right-5 z-50 flex space-x-2">
          <MapReset viewport={viewport()} setViewport={setViewport} />
          <div
            class="text-gray-700 font-bold text-sm hover:cursor-pointer border border-gray-400 rounded p-1 bg-white/50 hover:bg-gray-300/50 transition select-none"
            onClick={toggle3D}
          >
            {is3D() ? '2D' : '3D'}
          </div>
        </div>

        <MapGL
          options={{
            accessToken: import.meta.env.VITE_MAPBOX_KEY,
            style: mapStyle().value,
          }}
          viewport={viewport()}
          onViewportChange={setViewport}
          class="h-full w-full"
          debug={!!DEV}
          onMouseMove={altitudeHover}
          cursorStyle={cursor()}
        >
          <StyleSwitchFix />
          <BaseMaps persistedMapsState={persistedBaseMaps} mountedMapsState={mountedBaseMaps} />
          <BaseMapColorSync isDark={mapStyle().label === 'World Dark'} />
          <GeojsonPolySources sources={allSources} />
          <GeojsonPolyLayers displayStateStore={allStore} type="tracon" allPolys={TRACON_POLY_DEFINITIONS} is3D={is3D} />
          <GeojsonPolyLayers displayStateStore={allStore} type="center" is3D={is3D} />
          <ProcedurePoints procedures={displayedProcedures()} />
        </MapGL>
      </div>

      <ProceduresDialog
        isOpen={isProceduresOpen()}
        onClose={() => setIsProceduresOpen(false)}
        onProcedureToggle={handleProcedureToggle}
      />
    </div>
  );
};

export default App;
