import { makePersisted } from "@solid-primitives/storage";
import { Component, createEffect, createSignal, DEV, For } from "solid-js";
import { DEFAULT_MAP_STYLE, DEFAULT_SETTINGS, DEFAULT_VIEWPORT } from "~/defaults.ts";
import { Section } from "~/components/ui-core/Section.tsx";
import { MapStyleSelector } from "~/components/MapStyleSelector.tsx";
import { createStore, produce } from "solid-js/store";
import { BASE_MAPS, CENTER_POLY_DEFINITIONS } from "~/config.ts";
import {
  AirspaceDisplayState,
  AppDisplayState,
  CenterAreaDefinition,
  FillPaint,
  MountedBaseMapState,
  PersistedBaseMapState,
  PopupState,
  Settings,
  ArrivalProcedure,
} from "~/types.ts";
import { Checkbox } from "~/components/ui-core/Checkbox.tsx";
import { Footer } from "~/components/Footer.tsx";
import { MapReset } from "~/components/MapReset.tsx";

// Mapbox
import MapGL from "solid-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { BaseMaps } from "~/components/BaseMaps.tsx";
import { GeojsonPolyLayers } from "~/components/GeojsonPolyLayers.tsx";
import { GeojsonPolySources } from "~/components/GeojsonPolySources.tsx";
import { SectorDisplayWithControls } from "~/components/SectorDisplayWithControls.tsx";
import { SettingsDialog } from "~/components/SettingsDialog.tsx";
import { GeoJSONFeature, MapMouseEvent } from "mapbox-gl";
import { getUniqueLayers, isTransparentFill } from "~/lib/geojson.ts";
import { logIfDev } from "~/lib/dev.ts";
import { InfoPopup } from "~/components/InfoPopup.tsx";
import { ProceduresDialog } from "~/components/ProceduresDialog.tsx";
import { ArrivalPoints } from "~/components/ArrivalPoints.tsx";

const createDefaultState = (area: CenterAreaDefinition): AirspaceDisplayState => ({
  name: area.name,
  sectors: area.sectors.map((s) => ({
    name: s.sectorName,
    isDisplayed: false,
    color: s.defaultColor,
  })),
});

const App: Component = () => {
  const [viewport, setViewport] = makePersisted(createSignal(DEFAULT_VIEWPORT), {
    name: "viewport",
  });

  const [mapStyle, setMapStyle] = makePersisted(createSignal(DEFAULT_MAP_STYLE), {
    name: "mapStyle",
  });

  const [persistedBaseMaps, setPersistedBaseMaps] = makePersisted(
    createStore<PersistedBaseMapState[]>(
      BASE_MAPS.map((m) => ({
        id: m.name,
        baseMap: m,
        checked: m.showDefault,
      })),
    ),
    { name: "baseMaps" },
  );

  const [mountedBaseMaps, setMountedBaseMaps] = createStore<MountedBaseMapState[]>(
    persistedBaseMaps.map((m) => ({ id: m.baseMap.name, hasMounted: m.checked })),
  );

  const [cursor, setCursor] = createSignal("grab");

  const [settings, setSettings] = makePersisted(createStore<Settings>(DEFAULT_SETTINGS), {
    name: "settings",
  });

  const sources = CENTER_POLY_DEFINITIONS.flatMap((a) =>
    a.sectors.map((s) => ({
      id: s.sectorName,
      url: s.polyUrl,
    })),
  );

  const [allStore, setAllStore] = makePersisted(
    createStore<AppDisplayState>({
      updateCount: 0,
      areaDisplayStates: CENTER_POLY_DEFINITIONS.map((a) => createDefaultState(a)),
    }),
    { name: "currentDisplay" },
  );

  const [popup, setPopup] = createStore<PopupState>({
    hoveredPolys: [],
    vis: false,
  });

  const [displayedArrivals, setDisplayedArrivals] = createSignal<ArrivalProcedure[]>([]);
  const [isProceduresOpen, setIsProceduresOpen] = createSignal(false);

  const altitudeHover = (evt: MapMouseEvent) => {
    if (!evt.target.isStyleLoaded()) return;
    const features: GeoJSONFeature[] = evt.target.queryRenderedFeatures(evt.point, {
      filter: ["all", ["==", ["geometry-type"], "Polygon"], ["has", "minAlt"], ["has", "maxAlt"]],
    });
    const fillLayers = getUniqueLayers(features.filter((f) => f.layer?.type == "fill"));
    if (fillLayers.length > 0) {
      logIfDev(fillLayers);
      let transparentLayers: GeoJSONFeature[] = [];
      let visibleLayers: GeoJSONFeature[] = [];
      fillLayers.forEach((l) =>
        isTransparentFill(l.layer?.paint as FillPaint)
          ? transparentLayers.push(l)
          : visibleLayers.push(l),
      );
      if (settings.popup.showUncheckedSectors) {
        setPopup(
          produce((state) => {
            state.vis = settings.popup.uncheckedSectorsInVisibleSectorsOnly
              ? visibleLayers.length > 0
              : true;
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
      setPopup("vis", false);
    }
  };

  createEffect(() => {
    if (popup.vis) setCursor("crosshair");
    else setCursor("grab");
  });

  const handleArrivalToggle = (arrival: ArrivalProcedure, isDisplayed: boolean) => {
    setDisplayedArrivals((prev) => {
      if (isDisplayed) {
        return [...prev, arrival];
      } else {
        return prev.filter((a) => a.arrivalIdentifier !== arrival.arrivalIdentifier);
      }
    });
  };

  return (
    <div class="flex h-screen">
      <div class="flex flex-col bg-slate-900 p-4 justify-between overflow-auto overscroll-contain z-50">
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

          <Section header="NCT Base Maps">
            <div class="flex flex-col space-y-1">
              <For each={persistedBaseMaps}>
                {(m) => (
                  <Checkbox
                    label={m.baseMap.name}
                    checked={m.checked}
                    onChange={(val) => {
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

          <Section header="Sectors" class="space-y-2">
            <SectorDisplayWithControls
              airspaceGroup={"Area North"}
              store={allStore}
              setStore={setAllStore}
            />

            <SectorDisplayWithControls
              airspaceGroup={"Area East"}
              store={allStore}
              setStore={setAllStore}
            />

            <SectorDisplayWithControls
              airspaceGroup={"Area South"}
              store={allStore}
              setStore={setAllStore}
            />

            <SectorDisplayWithControls
              airspaceGroup={"Pac North"}
              store={allStore}
              setStore={setAllStore}
            />

            <SectorDisplayWithControls
              airspaceGroup={"Pac South"}
              store={allStore}
              setStore={setAllStore}
            />
          </Section>
        </div>
        <Footer />
      </div>
      <div class="grow relative">
        <InfoPopup popupState={popup} settings={settings} />

        <div class="absolute top-5 left-5 z-50 flex space-x-2">
          <SettingsDialog settings={settings} setSettings={setSettings} />
        </div>

        <MapReset viewport={viewport()} setViewport={setViewport} />

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
          <BaseMaps persistedMapsState={persistedBaseMaps} mountedMapsState={mountedBaseMaps} />
          <GeojsonPolySources sources={sources} />
          <GeojsonPolyLayers displayStateStore={allStore} />
          <ArrivalPoints arrivals={displayedArrivals()} />
        </MapGL>
      </div>

      <ProceduresDialog
        isOpen={isProceduresOpen()}
        onClose={() => setIsProceduresOpen(false)}
        onArrivalToggle={handleArrivalToggle}
      />
    </div>
  );
};

export default App;
