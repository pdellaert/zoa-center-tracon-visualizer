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

SolidJS app visualizing Oakland Center (ZOA) and NorCal TRACON airspace on a Mapbox GL map, plus on-demand airport procedures (SIDs/STARs/APPs) and full filed-flight-plan routes overlaid on the map. Stack: SolidJS, solid-map-gl, Mapbox GL 3, TailwindCSS 4, Kobalte (headless UI), Corvu (dialogs).

### Three rendering pipelines

The map has three independent feature families, each with its own state tree and rendering component tree. They share the same Mapbox instance but don't interact with each other's state.

1. **Static airspace polygons** (Center sectors + TRACON areas). Polygon definitions and colors are in `lib/config.ts`; display state (which sectors are visible, per-sector color, per-area selected config) is persisted to localStorage and optionally overridden by URL state for shareable links. Rendered by `GeojsonPolySources` + `GeojsonPolyLayers`. Supports a **2D/3D toggle** (session-only, not persisted): 2D mode renders flat `fill` + `line` layers (default, top-down); 3D mode renders `fill-extrusion` layers using each polygon feature's `minAlt`/`maxAlt` properties (in 100s of feet) to set extrusion base/height, with altitude scaled by `ALTITUDE_SCALE` in `lib/defaults.ts` and `maxAlt: 999` (unlimited) capped at `MAX_ALT_VALUE` (FL600). Toggling also adjusts viewport pitch/bearing. The altitude info popup (`InfoPopup`) only shows in 2D mode — `altitudeHover` early-returns in 3D since stacked extrusions made the readout confusing.

2. **Airport procedures** (SIDs, STARs, APPs). Fetched live from the Nav Data service when a user adds an airport. Not persisted — session-only. Rendered by `ProcedurePoints`. See "Procedures pipeline" below.

3. **Routes** (filed IFR flight plans). User types a route string in the Route panel; the system parses → resolves fixes/airways/procedures → builds segments → renders. Not persisted — session-only. Rendered by `RoutePoints`, with the SID/STAR procedures pushed through the existing `ProcedurePoints`. See "Routes pipeline" below.

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

1. **Fetch**: On Add Airport, `Promise.allSettled` fans out four parallel GETs — three procedure endpoints (`/v1/departures|arrivals|approaches/{airport}`) plus `/v1/airports/{airport}` for the airport's magnetic `variation` and `courseType`. A 404 on a procedure kind is non-fatal — the remaining subsections still render. A failed airport call is also non-fatal — procedures render without magnetic correction (status quo behavior).
2. **Runway coords**: Approach responses include `RunwayHelipad`-tagged points; `runwayCoordsFromApproaches` extracts a `{"RW10L": {lat,lon}}` map. `annotateSidRunwayOrigins` attaches the *opposite-end* coord to each SID sequence (aircraft depart from the opposite end — `RW10L` takeoff lifts off at the `RW28R` threshold). `oppositeRunway` flips `L↔R` and `A↔B` (A/B sometimes appears in SID data for parallels published elsewhere as L/R). `lookupRunway` tries all suffix variants.
3. **State**: Per-airport `AirportSection` in the sidebar store; three collapsible subsections (SIDs/STARs/APPs) each holding `ProcedureDisplayState[]` with per-item `isDisplayed` checkboxes. Toggling calls back into `App.tsx` to push/remove from a `displayedProcedures: Procedure[]` signal.
4. **Render**: `ProcedurePoints` consumes `displayedProcedures`. For each procedure, `buildProcedureGeometry` walks all sequences applying per-kind rules:
   - SID: skip `HeadingToAltitude`/`CourseToAltitude` (no coords); seed line at `sequence.runwayOrigin` if set; `HeadingToManual`/`CourseToManual`/`FromFixToManual`/`ManualTermination` render as a chevron arrowhead along `point.course` (also applies to STAR/APP).
   - APP: stop iterating at the first `MissedApproachFirstLeg` / `MissedApproach`-tagged point; include that point only if also `RunwayHelipad` (the MAP/runway threshold). Append `(IAF)`/`(IF)`/`(FAF)` label suffixes for matching descriptions.
   - **Dashed vectors**: when a manual-termination arrow is followed by another fix, a dashed line connects the arrow tip to that fix (ATC vectors — path undefined). Lines are emitted as `LineSegment[]` with a `dashed` boolean; the renderer uses filtered Mapbox layers with `line-dasharray` for dashed segments.
   - **Arc smoothing**: any SID leg off a runway whose angle from the runway heading exceeds 60° draws a smooth arc (12 interpolated bearing steps over half the distance, capped at 2.5 NM) before continuing straight. Prevents sharp visual turns on steep departure headings.
   - **Magnetic variation**: navdata returns `point.course` and runway-designator headings (`RW28R` → 280°) in MAGNETIC degrees, but `destinationPoint`/`bearingBetween` operate in TRUE (geographic-north). `buildSequenceGeometry` takes a `magneticCorrection` (resolved from the airport's `variation` when `courseType === "Magnetic"`, else 0) and applies `toTrue()` at every site that feeds a magnetic value into the geometry layer. Magnetic-vs-magnetic comparisons (the arc-threshold check) stay magnetic since a constant offset cancels.
5. **Fix dedup**: Lines render per-sequence with ids including `kind + airport + identifier + transition` so procedures with the same name at different airports (e.g., KSFO + KOAK PIRAT3) don't collide. Fix labels/circles render from ONE global `procedure-fix-source` whose features are deduplicated by fix identifier across ALL displayed procedures (`aggregateFixFeatures`). The richer label wins (longer string → has IAF/IF/FAF annotation or altitude constraints).

### Routes pipeline

Lives in `components/RouteDropdown.tsx` + `components/RoutePanel.tsx` (UI), `components/RoutePoints.tsx` (map rendering), and `lib/routeParser.ts` / `lib/routeResolver.ts` / `lib/routeBuilder.ts` / `lib/routeGeojson.ts` (logic). State signals in `App.tsx`: `displayedRoute: Route | null` (single active route) and `routeProcedures: RouteProcedureEntry[]` (route-pushed SID/STAR with chosen transition).

Single active route at a time. Session-only — not URL-encoded, not localStorage-persisted.

1. **Parse** (`routeParser.parseRoute`). Tokenize on whitespace, classify each token by position + shape: `dct` / `latlon` (with or without slash) / `frd` / `airway` (regex `^[A-Z]{1,2}\d{1,4}$`) / `fix`. Dot-bearing first/last token tagged `sidProc` / `starProc`. Pure function; no I/O.

2. **Resolvers** (`routeResolver.ts`). Each independent, in-memory cached.
   - `parseLatLon`: `4530N12000W`, `5000N/10900W`, `45N120W`, `45N/120W`, plus DMS-second variants. Strips `/` first.
   - `parseFixRadialDistance`: `OAK270030` → fix lookup + `destinationPoint`. Radial treated as TRUE for v1 (real navaid radials are magnetic-relative to the navaid's variation, but the API doesn't expose per-navaid variation; small angular error).
   - `resolveFix`: fetches `/v1/points/{id}`, picks nearest result to anchor for ambiguity. Drops candidates with sentinel-zero coords (see "Coord validity" below).
   - `resolveAirwaySegment`: fetches `/v1/airways/{id}` and **BFS-es** across sub-segments. Some airway responses bundle multiple disjoint paths into a single `points` array — `outboundCourse === 0` marks the end of a sub-segment. The resolver splits on those sentinels, then traverses a graph where points sharing an identifier across sub-segments are treated as the same node (junction). Example: `B453` is `[KURTT…MDO][BOXER…KURTT]` — slicing `KANUA→MDO` finds the path through the shared `KURTT` junction.
   - `resolveSidStar`: fetches departures + arrivals + approaches together (single cached `fetchAirportProcedures`) and applies `applyAirportProcedureAnnotations` so SID `runwayOrigin` and `magneticCorrection` match what the Procedures sidebar produces. Returns the **full** Procedure (every published sequence). Computes a `connectingFix` from the chosen transition's sequences (last fix for SID, first fix for STAR). Detects vector-exit SIDs (last leg is `HeadingToManual` / `CourseToManual` / `FromFixToManual` / `ManualTermination`) and returns the arrow tip as `connectingFix` with `endsWithVector: true`. Returns `connectingFix: null` (procedure still set) for radar-vectors-only SIDs (SFO4, GAPP7, OAK6) where no terminating fix is published.

3. **Build** (`routeBuilder.buildRoute`). Empty-route fast path: blank textarea → single direct from departure airport coord to destination airport coord. Otherwise:
   - Pre-fetch departure + destination airport info (`/v1/airports/{id}`) for coords + magnetic correction. Pre-fetch the procedure triples for both airports.
   - **Head detection** (`detectHead`): dot-bearing first token splits on `.` (SID name + transition). No-dot first token tries `findSidByName`; if found AND `tokens[1]` is a published transition, fuse 2 tokens; otherwise consume only 1 with `transition: null`.
   - **Tail detection** (`detectTail`): symmetric, with STAR convention `<transition>.<STAR>`. Allows the boundary token (`prevIdx >= reservedHead - 1`) to be **co-owned** by head and tail — handles routes like `TRUKN2 ORRCA ORRCA1` where ORRCA is published as a transition under both procedures. Body slice clamps to empty when overlap exists.
   - **Body iteration**: walks classified tokens, maintaining `lastFix` and `nextSegmentDashed`. Airways look at the next body token (or, if at body end, the tail STAR's transition fix) for the slice terminal. When an airway slice fails, falls back to (1) treat-as-fix, then (2) draw a direct from prev → terminal-fix and add a soft warning to `route.errors` (covers data gaps near borders, e.g., J523 ending at CFSKH).
   - **Dep-airport seed**: when `lastFix` is still null after head resolution (no SID, SID failed, or radar-vectors SID), `lastFix` becomes a synthetic departure-airport `RouteFix`. Combined with `nextSegmentDashed = true` for radar-vectors SIDs, the first body segment becomes a dashed dep→first-fix line representing the ATC vector hand-off.
   - **STAR resolution**: if connecting fix exists and differs from `lastFix`, push a connecting direct.
   - **Final-leg-to-airport**: when no STAR is in play, push a final direct from `lastFix` to destination airport coord (so the en-route line lands at the airport rather than dangling at the last filed fix). With STAR present, the STAR's runway-tail handles the landing.
   - **Errors are non-fatal**: each unresolved token pushes `{token, reason}` into `route.errors[]` rather than throwing; partial render still happens.

4. **Render** (`routeGeojson.buildRouteGeometry` + `components/RoutePoints.tsx`).
   - **Direct segments use great-circle interpolation** (slerp on unit vectors) with adaptive density (~50 NM per vertex, capped at 128 steps). Necessary because Mapbox renders LineStrings by projecting each vertex independently, so a 2-point direct on Mercator looks like a rhumb line. Antimeridian crossings keep longitudes continuous past ±180° (Mapbox wraps them visually).
   - **Airway segments** are rendered as straight hops between consecutive fixes — already densely sampled, the great-circle error is negligible.
   - **Direct segments carry a `dashed?: boolean`** flag (true for the first post-vector-exit-SID segment and route-warning fallbacks).
   - **Fix dedup**: `buildRouteGeometry` builds en-route `FixFeature[]` keyed by identifier, excluding `sidExitFix` and `starEntryFix` (those are drawn by the procedure renderer to avoid double-labels at the same coord).
   - **`RoutePoints`** mirrors `ProcedurePoints` structure: invisible `route-zorder-anchor` symbol layer, `route-line-source` (casing + line + dashed-variants via Mapbox layer filters), `route-fix-source` (text + circle). Mounted **before** `ProcedurePoints` in `App.tsx` so route layers sit below procedure layers in the rendering stack.

5. **SID/STAR push-through**. `routeProcedures: RouteProcedureEntry[]` (procedure + chosen transition) is merged with `displayedProcedures` (user-toggled) by a `combinedProcedures` memo before being passed to `<ProcedurePoints>`. Route entries are sequence-filtered: include trunk (`!t || t === '' || t === procedureIdentifier || t === 'ALL'`), per-runway (`/^RW\d/`), and the chosen transition; exclude sibling transitions. **`'ALL'` is a critical trunk-marker** — the navdata uses it for runway-common tails (e.g., COMIX2 STAR's post-COMIX path, FQM3's post-FQM path). User-toggled procedures render in full and **win on key collision** (so toggling a procedure already pushed by the route renders the full version).

6. **Coord validity**. `isValidCoord(lat, lon)` (exported from `routeResolver.ts`) treats `lat === 0 && lon === 0`, missing, or non-finite as "no coords". The navdata API uses `0, 0` as a sentinel for "coords unknown" — those points sit on the equator at Greenwich and would otherwise draw stray lines. `procedureGeojson.hasCoords` applies the same rule for SID/STAR rendering. Airway slicing drops sentinel-zero points; if fewer than 2 valid fixes remain, the slice is skipped.

7. **Color / kind**. Route line color: `#3b82f6` (blue). `BaseMapColorSync` regex updated to `/^(sid|star|app|route)-(line-casing|arrow-casing)(-|$)/` to invert casing colors on dark/light style switches; the fix-points circle matcher includes both `procedure-fix-points` and `route-fix-points`.

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
- **Z-order anchor for procedures** (`ProcedurePoints.tsx`): `map.addLayer(style)` with no `beforeId` appends to the TOP of the stack, so procedures added *after* the fix source mounts would otherwise paint over the fix dots/labels. To prevent this, `ProcedurePoints` mounts an always-on invisible symbol layer `procedure-zorder-anchor` first; every per-sequence line/arrow `<Layer>` uses `beforeId="procedure-zorder-anchor"` to insert below it, while the fix source remains `<Show>`-wrapped (mounts only when there's data, so `addSource` sees populated features — the reactive `setData` path in solid-map-gl's Source races on first mount and can leave a source empty).

## Conventions

- **Imports**: Always use `~` path alias (e.g., `import { cn } from '~/lib/utils'`), never relative paths
- **Class names**: Use `cn()` utility (clsx + tailwind-merge) for merging Tailwind classes
- **SolidJS patterns**: `createSignal` for reactive state, `createStore` + `produce` for complex state, `createMemo` for derived values inside reactive scopes (required when derivation is expensive or referenced multiple times), `Show`/`For` for conditional/list rendering
- **Colors**: Hex colors in config, converted to RGBA dynamically via `color-string` library
- **Components**: PascalCase, one per file, descriptive suffixes (`*Dialog`, `*Popup`, `*Button`, `*Controls`)
- **Types**: `const` arrays + `(typeof X)[number]` pattern for literal union types that need runtime iteration (see `TRACON_AIRSPACE_CONFIGS`). Nullable API fields get `| null` in types (e.g., `Point.identifier/latitude/longitude` are null on altitude-only SID legs).
