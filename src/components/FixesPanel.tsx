import { Component, createSignal, For, Show } from 'solid-js';
import { DisplayedFix } from '~/lib/fixesTypes';

interface FixesPanelProps {
  fixes: DisplayedFix[];
  onAdd: (input: string) => Promise<string | null>;
  onRemove: (id: string) => void;
}

export const FixesPanel: Component<FixesPanelProps> = (props) => {
  const [input, setInput] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (isLoading()) return;
    setError(null);
    setIsLoading(true);
    try {
      const err = await props.onAdd(input());
      if (err) {
        setError(err);
      } else {
        setInput('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="flex flex-col space-y-3">
      <form onSubmit={handleSubmit} class="flex flex-col space-y-2">
        <label class="text-slate-300 text-xs">Fix / FRD / Lat-Lon</label>
        <div class="flex space-x-2">
          <input
            type="text"
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value.toUpperCase())}
            placeholder="PIRAT"
            class="flex-1 bg-slate-700 text-white px-2 py-1 rounded border border-slate-600 focus:border-blue-400 focus:outline-none uppercase font-mono text-sm"
          />
          <button
            type="submit"
            disabled={isLoading() || input().trim().length === 0}
            class="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm font-medium cursor-pointer transition-colors"
          >
            {isLoading() ? '…' : 'Add'}
          </button>
        </div>
        <Show when={error()}>
          <p class="text-red-300 text-xs">{error()}</p>
        </Show>
      </form>

      <Show when={props.fixes.length > 0}>
        <div class="flex flex-col space-y-1 max-h-64 overflow-y-auto overscroll-contain">
          <For each={props.fixes}>
            {(entry) => (
              <div class="flex items-center justify-between bg-slate-700 px-2 py-1 rounded">
                <div class="flex items-baseline space-x-2 min-w-0">
                  <span class="text-white font-mono text-sm truncate">{entry.input}</span>
                  <Show when={entry.candidates.length > 1}>
                    <span class="text-slate-400 text-xs shrink-0">
                      {entry.candidates.length} matches
                    </span>
                  </Show>
                </div>
                <button
                  type="button"
                  onClick={() => props.onRemove(entry.id)}
                  class="text-red-400 hover:text-red-300 focus:outline-none cursor-pointer shrink-0 ml-2"
                  title="Remove"
                  aria-label={`Remove ${entry.input}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
