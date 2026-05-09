import { Component, onCleanup, onMount } from 'solid-js';
import { RoutePanel } from './RoutePanel';
import { Route, RouteInput } from '~/lib/routeTypes';

interface RouteDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteSubmit: (input: RouteInput) => Promise<void> | void;
  onRouteClear: () => void;
  routeResult: Route | null;
}

export const RouteDropdown: Component<RouteDropdownProps> = (props) => {
  let panelRef: HTMLDivElement | undefined;

  const handleMouseDown = (e: MouseEvent) => {
    if (!props.isOpen) return;
    const target = e.target as HTMLElement;
    if (panelRef && panelRef.contains(target)) return;
    if (target.closest('[data-route-toggle]')) return;
    props.onClose();
  };

  onMount(() => document.addEventListener('mousedown', handleMouseDown));
  onCleanup(() => document.removeEventListener('mousedown', handleMouseDown));

  return (
    <div
      ref={panelRef}
      class={`absolute top-full left-0 mt-1 w-[320px] max-h-[60vh] bg-slate-800 rounded-lg shadow-2xl border border-slate-700 transition-all duration-200 ease-out z-[100] ${
        props.isOpen
          ? 'opacity-100 visible translate-y-0'
          : 'opacity-0 invisible -translate-y-2 pointer-events-none'
      }`}
    >
      <div class="p-4 max-h-[60vh] overflow-y-auto overscroll-contain">
        <RoutePanel
          onSubmit={props.onRouteSubmit}
          onClear={props.onRouteClear}
          result={props.routeResult}
        />
      </div>
    </div>
  );
};
