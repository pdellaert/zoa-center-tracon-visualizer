import { Component, createSignal, For, Show } from "solid-js";
import { Checkbox } from "./ui-core/Checkbox";
import { AirportSection, ArrivalProcedure, ArrivalProcedureDisplayState } from "~/types";
import { createStore, produce } from "solid-js/store";
import { NAVDATA_API_URL } from "~/config.ts";

interface AirportArrivalsProps {
  onArrivalToggle: (arrival: ArrivalProcedure, isDisplayed: boolean) => void;
}

export const AirportArrivals: Component<AirportArrivalsProps> = (props) => {
  const [airportInput, setAirportInput] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [airportSections, setAirportSections] = createStore<AirportSection[]>([]);

  const handleAirportSubmit = async (e: Event) => {
    e.preventDefault();
    const airport = airportInput().trim().toUpperCase();

    if (!airport) {
      setError("Please enter an airport identifier");
      return;
    }

    // if (!/^K[A-Z]{3}$/.test(airport)) {
    //   setError("Please enter a valid US airport identifier (e.g. KSFO)");
    //   return;
    // }

    // Check if airport already exists
    if (airportSections.some((section) => section.id === airport)) {
      setError("This airport has already been added");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${NAVDATA_API_URL}/arrivals/${airport}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No arrival procedures found for ${airport}`);
        }
        throw new Error("Failed to fetch arrivals");
      }
      const procedures: ArrivalProcedure[] = await response.json();

      let arrivals: ArrivalProcedureDisplayState[] = [];
      for (const p of procedures) {
        arrivals.push({
          id: p.arrivalIdentifier,
          isDisplayed: false,
          procedure: p,
        });
      }

      setAirportSections(
        produce((sections) => {
          sections.push({
            id: airport,
            isExpanded: true,
            arrivals: arrivals,
          });
        }),
      );

      setAirportInput("");
      setError(null);
    } catch (error) {
      console.error("Error fetching arrivals:", error);
      setError(error instanceof Error ? error.message : "Failed to fetch arrivals");
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

  const deleteSection = (airportId: string) => {
    // First, uncheck all arrivals for this airport
    const section = airportSections.find((s) => s.id === airportId);
    if (section) {
      section.arrivals.forEach((arrival) => {
        if (arrival.isDisplayed) {
          props.onArrivalToggle(arrival.procedure, false);
        }
      });
    }

    // Then remove the section
    setAirportSections((sections) => sections.filter((s) => s.id !== airportId));
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
            {isLoading() ? "Loading..." : "Add"}
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
                  title={section.isExpanded ? "Collapse" : "Expand"}
                >
                  <svg
                    class={`w-4 h-4 transform transition-transform ${
                      section.isExpanded ? "rotate-90" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
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
                <div class="mt-3 space-y-1 pl-4">
                  <For each={section.arrivals}>
                    {(arrival) => (
                      <Checkbox
                        label={arrival.id}
                        checked={arrival.isDisplayed}
                        onChange={(checked) => {
                          setAirportSections(
                            (a) => a.id === section.id,
                            "arrivals",
                            (arr) => arr.id === arrival.id,
                            "isDisplayed",
                            checked,
                          );
                          props.onArrivalToggle(arrival.procedure, checked);
                        }}
                      />
                    )}
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
