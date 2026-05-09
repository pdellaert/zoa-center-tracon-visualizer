import { Accessor, Component, createSignal, Show } from 'solid-js';
import { Link, Check, X } from 'lucide-solid';
import {
  AppDisplayState,
  CenterAreaDefinition,
  TraconAirspaceConfig,
  TraconAirportConfig,
  TraconPolyDefinition,
} from '~/lib/types';
import { encodeStateToURL, URL_STATE_PARAM } from '~/lib/urlState';

interface ShareButtonProps {
  store: AppDisplayState;
  centerDefaults: CenterAreaDefinition[];
  traconDefaults: TraconPolyDefinition[];
  bayConfig: Accessor<TraconAirspaceConfig>;
  sfoConfig: Accessor<TraconAirportConfig>;
  oakConfig: Accessor<TraconAirportConfig>;
  sjcConfig: Accessor<TraconAirportConfig>;
}

export const ShareButton: Component<ShareButtonProps> = (props) => {
  const [copied, setCopied] = createSignal(false);
  const [error, setError] = createSignal(false);

  const handleCopy = async () => {
    try {
      const encoded = encodeStateToURL(props.store, props.centerDefaults, props.traconDefaults, {
        bayConfig: props.bayConfig(),
        sfoConfig: props.sfoConfig(),
        oakConfig: props.oakConfig(),
        sjcConfig: props.sjcConfig(),
      });

      const url = new URL(window.location.href);
      url.search = ''; // Clear existing params

      if (encoded) {
        url.searchParams.set(URL_STATE_PARAM, encoded);
      }

      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setError(false);

      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy URL:', e);
      setError(true);
      setCopied(false);

      // Reset error after 3 seconds
      setTimeout(() => setError(false), 3000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      class="flex items-center gap-1 h-8 px-3 text-sm font-medium rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer"
      classList={{ 'bg-red-600 hover:bg-red-500': error() }}
      title="Copy shareable URL with current sector states and configs"
    >
      <Show when={error()}>
        <X class="w-4 h-4" />
        <span>Failed!</span>
      </Show>
      <Show when={!error() && copied()}>
        <Check class="w-4 h-4" />
        <span>Copied!</span>
      </Show>
      <Show when={!error() && !copied()}>
        <Link class="w-4 h-4" />
        <span>Share</span>
      </Show>
    </button>
  );
};
