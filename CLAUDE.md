# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm install` - Install dependencies
- `pnpm dev` or `pnpm start` - Start dev server (port 42635)
- `pnpm run build` - Production build to `dist/`
- `pnpm run serve` - Preview production build

No linting, formatting, or test tools are configured. TypeScript strict mode is enforced — run `npx tsc --noEmit` to typecheck. Requires Node 22 (`nvm use 22` before running npm/pnpm/tsc).

## Environment

- `VITE_MAPBOX_KEY` — Mapbox access token (required)
- `NAVDATA_API_URL` in `lib/config.ts` — base URL of the Nav Data service (default: `https://navdata.oakartcc.org`; the v1 contract is the stable one, consumed via the `navdataUrl(kind, airport)` helper)

## Architecture

SolidJS app visualizing Oakland Center (ZOA) and NorCal TRACON airspace on a Mapbox GL map, plus on-demand airport procedures (SIDs/STARs/APPs) overlaid on the map. Stack: SolidJS, solid-map-gl, Mapbox GL 3, TailwindCSS 4, Kobalte (headless UI), Corvu (dialogs).

### Two rendering pipelines

The map has two independent feature families, each with its own state tree and rendering component tree. They share the same Mapbox instance but don't interact with each other's state.

1. **Static airspace polygons** (Center sectors + TRACON areas). Polygon definitions and colors are in `lib/config.ts`; display state (which sectors are visible, per-sector color, per-area selected config) is persisted to localStorage and optionally overridden by URL state for shareable links. Rendered by `GeojsonPolySources` + `GeojsonPolyLayers`. Supports a **2D/3D toggle** (session-only, not persisted): 2D mode renders flat `fill` + `line` layers (default, top-down); 3D mode renders `fill-extrusion` layers using each polygon feature's `minAlt`/`maxAlt` properties (in 100s of feet) to set extrusion base/height, with altitude scaled by `ALTITUDE_SCALE` in `lib/defaults.ts` and `maxAlt: 999` (unlimited) capped at `MAX_ALT_VALUE` (FL600). Toggling also adjusts viewport pitch/bearing.

2. **Airport procedures** (SIDs, STARs, APPs). Fetched live from the Nav Data service when a user adds an airport. Not persisted — session-only. Rendered by `ProcedurePoints`. See "Procedures pipeline" below.

### State management

- `createSignal` / `createStore` + `produce` for reactive state.
- `@solid-primitives/storage`'s `makePersisted` for localStorage persistence (sectors, base maps, settings).
- URL state (`lib/urlState.ts`) can override localStorage for sharing; procedures are NOT URL-encoded.
- Store updates use path-based syntax (`setStore('path', (item) => item.id === x, 'field', value)`) and `produce()` for complex mutations.

Polygon display state is hierarchical:

```
AppDisplayState
  centerDisplayStates: CenterAirspaceDisplayState[]   // ZOA Center
  areaDisplayStates: TraconAirspaceDisplayState[]     // TRACON areas
    name, selectedConfig, sectors[]
      name, isDisplayed, color
```

### Procedures pipeline

Lives in `components/AirportProcedures.tsx` (sidebar UI), `components/ProcedurePoints.tsx` (map rendering), and `lib/procedureGeojson.ts` (shared geometry logic).

1. **Fetch**: On Add Airport, `Promise.allSettled` fans out three parallel GETs against the v1 Nav Data endpoints (`/v1/departures|arrivals|approaches/{airport}`). A 404 on one kind is non-fatal — the remaining subsections still render.
2. **Runway coords**: Approach responses include `RunwayHelipad`-tagged points; `runwayCoordsFromApproaches` extracts a `{"RW10L": {lat,lon}}` map. `annotateSidRunwayOrigins` attaches the *opposite-end* coord to each SID sequence (aircraft depart from the opposite end — `RW10L` takeoff lifts off at the `RW28R` threshold). `oppositeRunway` flips `L↔R` and `A↔B` (A/B sometimes appears in SID data for parallels published elsewhere as L/R). `lookupRunway` tries all suffix variants.
3. **State**: Per-airport `AirportSection` in the sidebar store; three collapsible subsections (SIDs/STARs/APPs) each holding `ProcedureDisplayState[]` with per-item `isDisplayed` checkboxes. Toggling calls back into `App.tsx` to push/remove from a `displayedProcedures: Procedure[]` signal.
4. **Render**: `ProcedurePoints` consumes `displayedProcedures`. For each procedure, `buildProcedureGeometry` walks all sequences applying per-kind rules:
   - SID: skip `HeadingToAltitude`/`CourseToAltitude` (no coords); seed line at `sequence.runwayOrigin` if set; `HeadingToManual`/`CourseToManual`/`FromFixToManual`/`ManualTermination` render as a chevron arrowhead along `point.course` (also applies to STAR/APP).
   - APP: stop iterating at the first `MissedApproachFirstLeg` / `MissedApproach`-tagged point; include that point only if also `RunwayHelipad` (the MAP/runway threshold). Append `(IAF)`/`(IF)`/`(FAF)` label suffixes for matching descriptions.
   - **Dashed vectors**: when a manual-termination arrow is followed by another fix, a dashed line connects the arrow tip to that fix (ATC vectors — path undefined). Lines are emitted as `LineSegment[]` with a `dashed` boolean; the renderer uses filtered Mapbox layers with `line-dasharray` for dashed segments.
   - **Arc smoothing**: any SID leg off a runway whose angle from the runway heading exceeds 60° draws a smooth arc (12 interpolated bearing steps over half the distance, capped at 2.5 NM) before continuing straight. Prevents sharp visual turns on steep departure headings.
5. **Fix dedup**: Lines render per-sequence with ids including `kind + airport + identifier + transition` so procedures with the same name at different airports (e.g., KSFO + KOAK PIRAT3) don't collide. Fix labels/circles render from ONE global `procedure-fix-source` whose features are deduplicated by fix identifier across ALL displayed procedures (`aggregateFixFeatures`). The richer label wins (longer string → has IAF/IF/FAF annotation or altitude constraints).

### Color / dark-light sync

Procedure line colors are per-kind (`SID emerald #10b981`, `STAR amber #f59e0b`, `APP purple #a855f7`) with a 2px-wider casing layer underneath for contrast against arbitrary polygon fills. `BaseMapColorSync` listens for Mapbox `styledata` and `idle` events and re-paints on every style change:

- Layers ending in `-text-layer` get text color inverted.
- `procedure-fix-points` gets circle fill/stroke inverted.
- Layer ids matching `/^(sid|star|app)-(line-casing|arrow-casing)-/` get line color inverted.

A feedback-loop guard (`applying` flag) prevents `setPaintProperty` from re-triggering itself via `styledata`.

### Mapbox integration quirks

- `StyleSwitchFix` wraps `setStyle` with `diff: false` to avoid "duplicate layer" errors when switching basemaps.
- Layer ids are meaningful — `BaseMapColorSync` matches by prefix/suffix patterns. When adding new layers, check that regex. Polygon layer id suffixes are `_line`/`_fill` (2D mode) or `_fill-extrusion` (3D mode); only one set is mounted at a time.
- Dynamic Source/Layer via solid-map-gl: sources accept a `<Source>` wrapper with one or more child `<Layer>`s; the component tree mirrors Mapbox's source/layer hierarchy.

## Conventions

- **Imports**: Always use `~` path alias (e.g., `import { cn } from '~/lib/utils'`), never relative paths
- **Class names**: Use `cn()` utility (clsx + tailwind-merge) for merging Tailwind classes
- **SolidJS patterns**: `createSignal` for reactive state, `createStore` + `produce` for complex state, `createMemo` for derived values inside reactive scopes (required when derivation is expensive or referenced multiple times), `Show`/`For` for conditional/list rendering
- **Colors**: Hex colors in config, converted to RGBA dynamically via `color-string` library
- **Components**: PascalCase, one per file, descriptive suffixes (`*Dialog`, `*Popup`, `*Button`, `*Controls`)
- **Types**: `const` arrays + `(typeof X)[number]` pattern for literal union types that need runtime iteration (see `TRACON_AIRSPACE_CONFIGS`). Nullable API fields get `| null` in types (e.g., `Point.identifier/latitude/longitude` are null on altitude-only SID legs).
