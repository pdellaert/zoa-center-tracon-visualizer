import { Component, createSignal, For, Show } from 'solid-js';
import { Checkbox } from '~/components/ui-core/Checkbox';
import {
  AirportInfo,
  AirportSection,
  Procedure,
  ProcedureDisplayState,
  ProcedureKind,
  ProcedureSubsection,
} from '~/lib/types';
import { createStore, produce } from 'solid-js/store';
import { navdataAirportUrl, navdataUrl } from '~/lib/config';

interface AirportProceduresProps {
  onProcedureToggle: (procedure: Procedure, isDisplayed: boolean) => void;
}

interface RawProcedureResponse {
  departureIdentifier?: string;
  arrivalIdentifier?: string;
  approachIdentifier?: string;
  sequences: Procedure['sequences'];
}

const SUBSECTION_ORDER: { key: 'sids' | 'stars' | 'apps'; kind: ProcedureKind; label: string; empty: string }[] = [
  { key: 'sids', kind: 'sid', label: 'SIDs', empty: 'No SIDs published.' },
  { key: 'stars', kind: 'star', label: 'STARs', empty: 'No STARs published.' },
  { key: 'apps', kind: 'app', label: 'APPs', empty: 'No approaches published.' },
];

const identifierFor = (kind: ProcedureKind, raw: RawProcedureResponse): string | undefined => {
  if (kind === 'sid') return raw.departureIdentifier;
  if (kind === 'star') return raw.arrivalIdentifier;
  return raw.approachIdentifier;
};

const fetchProcedures = async (kind: ProcedureKind, airport: string): Promise<Procedure[]> => {
  const response = await fetch(navdataUrl(kind, airport));
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Failed to fetch ${kind} procedures for ${airport}`);
  }
  const raw: RawProcedureResponse[] = await response.json();
  return raw.map((r) => ({
    kind,
    airport,
    identifier: identifierFor(kind, r) ?? '',
    sequences: r.sequences,
  }));
};

const fetchAirportInfo = async (airport: string): Promise<AirportInfo | null> => {
  const response = await fetch(navdataAirportUrl(airport));
  if (!response.ok) return null;
  const raw = await response.json();
  return {
    identifier: typeof raw.identifier === 'string' ? raw.identifier : airport,
    variation: typeof raw.variation === 'number' ? raw.variation : null,
    courseType: typeof raw.courseType === 'string' ? raw.courseType : null,
  };
};

const buildSubsection = (procedures: Procedure[]): ProcedureSubsection => ({
  isExpanded: false,
  items: procedures.map((p) => ({ id: p.identifier, isDisplayed: false, procedure: p })),
});

/**
 * Approaches expose runway threshold coords as points tagged RunwayHelipad.
 * Extract them into a map keyed by identifier (e.g., "RW10L") so SID sequences
 * can anchor their line at the departure runway without a separate API lookup.
 */
const runwayCoordsFromApproaches = (
  approaches: Procedure[],
): Map<string, { latitude: number; longitude: number }> => {
  const map = new Map<string, { latitude: number; longitude: number }>();
  for (const procedure of approaches) {
    for (const sequence of procedure.sequences) {
      for (const point of sequence.points) {
        if (
          point.identifier &&
          point.latitude != null &&
          point.longitude != null &&
          point.descriptions.includes('RunwayHelipad') &&
          !map.has(point.identifier)
        ) {
          map.set(point.identifier, { latitude: point.latitude, longitude: point.longitude });
        }
      }
    }
  }
  return map;
};

/**
 * Flip a parallel-runway suffix. L/R and A/B both appear in the wild for the
 * same physical pair (SIDs occasionally publish A/B where approaches use L/R).
 * We treat A≡L and B≡R, and flip A↔B just like L↔R. C stays.
 */
const flipRunwaySuffix = (suffix: string): string => {
  switch (suffix) {
    case 'L':
      return 'R';
    case 'R':
      return 'L';
    case 'A':
      return 'B';
    case 'B':
      return 'A';
    default:
      return suffix;
  }
};

/**
 * All equivalent spellings of a runway identifier. A↔L and B↔R are treated as
 * the same physical runway when looking up coords, since the API mixes these.
 */
const runwayVariants = (runway: string): string[] => {
  const m = runway.match(/^RW(\d{1,2})([A-Z]?)$/);
  if (!m) return [runway];
  const [, num, suffix] = m;
  const variants = [runway];
  if (suffix === 'A') variants.push(`RW${num}L`, `RW${num}R`);
  else if (suffix === 'B') variants.push(`RW${num}R`, `RW${num}L`);
  else if (suffix === 'L') variants.push(`RW${num}A`);
  else if (suffix === 'R') variants.push(`RW${num}B`);
  return variants;
};

/**
 * Flip a runway identifier to its opposite end.
 * RW10L ↔ RW28R, RW18 ↔ RW36, RW13C ↔ RW31C, RW28A ↔ RW10B.
 */
const oppositeRunway = (runway: string): string | null => {
  const m = runway.match(/^RW(\d{1,2})([A-Z]?)$/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (num < 1 || num > 36) return null;
  const opposite = ((num - 1 + 18) % 36) + 1;
  const suffix = flipRunwaySuffix(m[2]);
  return `RW${String(opposite).padStart(2, '0')}${suffix}`;
};

const lookupRunway = (
  map: Map<string, { latitude: number; longitude: number }>,
  runway: string,
): { latitude: number; longitude: number } | undefined => {
  for (const variant of runwayVariants(runway)) {
    const coords = map.get(variant);
    if (coords) return coords;
  }
  return undefined;
};

/**
 * For each SID sequence with a runway transition, anchor the line at the
 * *departure* end of the runway — which is the arrival threshold of the
 * opposite runway identifier (the aircraft only leaves the ground there).
 * Falls back to the same-name threshold if the opposite isn't published.
 */
const annotateSidRunwayOrigins = (
  sids: Procedure[],
  runwayCoords: Map<string, { latitude: number; longitude: number }>,
): void => {
  for (const sid of sids) {
    for (const sequence of sid.sequences) {
      if (!sequence.transition) continue;
      const opposite = oppositeRunway(sequence.transition);
      const coords =
        (opposite ? lookupRunway(runwayCoords, opposite) : undefined) ??
        lookupRunway(runwayCoords, sequence.transition);
      if (coords) sequence.runwayOrigin = coords;
    }
  }
};

export const AirportProcedures: Component<AirportProceduresProps> = (props) => {
  const [airportInput, setAirportInput] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [airportSections, setAirportSections] = createStore<AirportSection[]>([]);

  const handleAirportSubmit = async (e: Event) => {
    e.preventDefault();
    const airport = airportInput().trim().toUpperCase();

    if (!airport) {
      setError('Please enter an airport identifier');
      return;
    }

    if (airportSections.some((section) => section.id === airport)) {
      setError('This airport has already been added');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const [sidResult, starResult, appResult, airportResult] = await Promise.allSettled([
        fetchProcedures('sid', airport),
        fetchProcedures('star', airport),
        fetchProcedures('app', airport),
        fetchAirportInfo(airport),
      ]);

      const sids = sidResult.status === 'fulfilled' ? sidResult.value : [];
      const stars = starResult.status === 'fulfilled' ? starResult.value : [];
      const apps = appResult.status === 'fulfilled' ? appResult.value : [];

      const allFailed =
        sidResult.status === 'rejected' &&
        starResult.status === 'rejected' &&
        appResult.status === 'rejected';
      if (allFailed) {
        throw new Error(`No procedures found for ${airport}`);
      }

      annotateSidRunwayOrigins(sids, runwayCoordsFromApproaches(apps));

      const info = airportResult.status === 'fulfilled' ? airportResult.value : null;
      const magneticCorrection =
        info && info.courseType === 'Magnetic' && info.variation !== null
          ? info.variation
          : undefined;
      if (magneticCorrection !== undefined) {
        for (const p of [...sids, ...stars, ...apps]) p.magneticCorrection = magneticCorrection;
      }

      setAirportSections(
        produce((sections) => {
          sections.push({
            id: airport,
            isExpanded: true,
            subsections: {
              sids: buildSubsection(sids),
              stars: buildSubsection(stars),
              apps: buildSubsection(apps),
            },
          });
        }),
      );

      setAirportInput('');
      setError(null);
    } catch (err) {
      console.error('Error fetching procedures:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch procedures');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (airportId: string) => {
    setAirportSections(
      (section) => section.id === airportId,
      produce((section) => {
        section.isExpanded = !section.isExpanded;
      }),
    );
  };

  const toggleSubsection = (airportId: string, key: 'sids' | 'stars' | 'apps') => {
    setAirportSections(
      (section) => section.id === airportId,
      produce((section) => {
        section.subsections[key].isExpanded = !section.subsections[key].isExpanded;
      }),
    );
  };

  const deleteSection = (airportId: string) => {
    const section = airportSections.find((s) => s.id === airportId);
    if (section) {
      for (const { key } of SUBSECTION_ORDER) {
        for (const item of section.subsections[key].items) {
          if (item.isDisplayed) props.onProcedureToggle(item.procedure, false);
        }
      }
    }
    setAirportSections((sections) => sections.filter((s) => s.id !== airportId));
  };

  const toggleItem = (
    airportId: string,
    key: 'sids' | 'stars' | 'apps',
    item: ProcedureDisplayState,
    checked: boolean,
  ) => {
    setAirportSections(
      (a) => a.id === airportId,
      'subsections',
      key,
      'items',
      (i) => i.id === item.id,
      'isDisplayed',
      checked,
    );
    props.onProcedureToggle(item.procedure, checked);
  };

  return (
    <div class="flex flex-col space-y-4">
      <form class="space-y-2" onSubmit={handleAirportSubmit}>
        <label class="text-white text-sm">Enter Airport Identifier</label>
        <div class="flex space-x-2">
          <input
            type="text"
            class="bg-slate-700 text-white p-2 rounded w-full font-mono uppercase"
            value={airportInput()}
            onInput={(e) => setAirportInput(e.currentTarget.value)}
            placeholder="KSFO"
            maxLength={4}
          />
          <button
            type="submit"
            disabled={isLoading()}
            class="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-2 py-2 rounded transition-colors"
          >
            {isLoading() ? 'Loading...' : 'Add'}
          </button>
        </div>
        <Show when={error()}>
          <p class="text-red-400 text-sm">{error()}</p>
        </Show>
      </form>

      <div class="space-y-4">
        <For each={airportSections}>
          {(section) => (
            <div class="bg-slate-800 rounded py-4">
              <div class="flex items-center space-x-3">
                <button
                  onClick={() => toggleSection(section.id)}
                  class="text-slate-300 hover:text-white focus:outline-none"
                  title={section.isExpanded ? 'Collapse' : 'Expand'}
                >
                  <svg
                    class={`w-4 h-4 transform transition-transform ${section.isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <h3 class="text-white font-mono flex-grow">{section.id}</h3>
                <button
                  onClick={() => deleteSection(section.id)}
                  class="text-red-400 hover:text-red-300 focus:outline-none"
                  title="Remove airport"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
              <Show when={section.isExpanded}>
                <div class="mt-3 space-y-2 pl-4">
                  <For each={SUBSECTION_ORDER}>
                    {(sub) => {
                      const subsection = section.subsections[sub.key];
                      return (
                        <div>
                          <button
                            onClick={() => toggleSubsection(section.id, sub.key)}
                            class="flex items-center space-x-2 text-slate-200 hover:text-white focus:outline-none w-full"
                          >
                            <svg
                              class={`w-3 h-3 transform transition-transform ${subsection.isExpanded ? 'rotate-90' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                            <span class="text-sm font-semibold">
                              {sub.label} ({subsection.items.length})
                            </span>
                          </button>
                          <Show when={subsection.isExpanded}>
                            <div class="mt-1 space-y-1 pl-5">
                              <Show
                                when={subsection.items.length > 0}
                                fallback={<p class="text-slate-400 text-xs italic">{sub.empty}</p>}
                              >
                                <For each={subsection.items}>
                                  {(item) => (
                                    <Checkbox
                                      label={item.id}
                                      checked={item.isDisplayed}
                                      onChange={(checked) => toggleItem(section.id, sub.key, item, checked)}
                                    />
                                  )}
                                </For>
                              </Show>
                            </div>
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
