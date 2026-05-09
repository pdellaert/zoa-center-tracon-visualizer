import { Component, createSignal, For, Show } from 'solid-js';
import { Route, RouteInput } from '~/lib/routeTypes';
import { routeTotalNm } from '~/lib/routeGeojson';

interface RoutePanelProps {
  onSubmit: (input: RouteInput) => Promise<void> | void;
  onClear: () => void;
  result: Route | null;
}

export const RoutePanel: Component<RoutePanelProps> = (props) => {
  const [departure, setDeparture] = createSignal('');
  const [destination, setDestination] = createSignal('');
  const [raw, setRaw] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const dep = departure().trim().toUpperCase();
    const dest = destination().trim().toUpperCase();
    const route = raw().trim().toUpperCase();
    if (!dep || !dest) return;
    setIsLoading(true);
    try {
      await props.onSubmit({ departure: dep, destination: dest, raw: route });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setDeparture('');
    setDestination('');
    setRaw('');
    props.onClear();
  };

  return (
    <form onSubmit={handleSubmit} class="flex flex-col space-y-3">
      <div class="flex space-x-2">
        <div class="flex flex-col w-20">
          <label class="text-slate-300 text-xs mb-1">Departure</label>
          <input
            type="text"
            maxlength="4"
            value={departure()}
            onInput={(e) => setDeparture(e.currentTarget.value.toUpperCase())}
            placeholder="KSFO"
            class="bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:border-blue-400 focus:outline-none uppercase font-mono text-sm"
          />
        </div>
        <div class="flex flex-col w-20">
          <label class="text-slate-300 text-xs mb-1">Destination</label>
          <input
            type="text"
            maxlength="4"
            value={destination()}
            onInput={(e) => setDestination(e.currentTarget.value.toUpperCase())}
            placeholder="KSEA"
            class="bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:border-blue-400 focus:outline-none uppercase font-mono text-sm"
          />
        </div>
      </div>

      <div class="flex flex-col">
        <label class="text-slate-300 text-xs mb-1">Route</label>
        <textarea
          rows={3}
          value={raw()}
          onInput={(e) => setRaw(e.currentTarget.value)}
          placeholder="MOD3.LIN OAL J88 BOI ABC.PIRAT3"
          class="bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:border-blue-400 focus:outline-none font-mono text-sm resize-none"
        />
      </div>

      <div class="flex space-x-2">
        <button
          type="submit"
          disabled={isLoading()}
          class="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-wait text-white px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors"
        >
          {isLoading() ? 'Loading…' : 'Show Route'}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={isLoading()}
          class="bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white px-3 py-1.5 rounded text-sm cursor-pointer transition-colors"
        >
          Clear
        </button>
      </div>

      <Show when={!isLoading() && props.result}>
        {(result) => (
          <div class="text-xs space-y-2">
            <Show when={result().errors.length > 0}>
              <div class="bg-red-900/40 border border-red-700/60 rounded px-2 py-1.5">
                <div class="text-red-200 font-semibold mb-1">
                  {result().errors.length}{' '}
                  {result().errors.length === 1 ? 'problem' : 'problems'}
                </div>
                <ul class="text-red-100 space-y-0.5">
                  <For each={result().errors}>
                    {(err) => (
                      <li>
                        <span class="font-mono text-red-300">{err.token}</span>
                        <span class="text-red-200"> — {err.reason}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </Show>
            <Show when={result().segments.length > 0}>
              <div class="text-slate-400">{Math.round(routeTotalNm(result()))} NM</div>
            </Show>
          </div>
        )}
      </Show>
    </form>
  );
};
