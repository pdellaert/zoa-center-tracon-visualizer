import { Component, JSX } from 'solid-js';
import { ProceduresDropdown } from './ProceduresDropdown';
import { RouteDropdown } from './RouteDropdown';
import { Procedure } from '~/lib/types';
import { Route, RouteInput } from '~/lib/routeTypes';

interface TopMenuBarProps {
  proceduresOpen: boolean;
  setProceduresOpen: (open: boolean) => void;
  onProcedureToggle: (procedure: Procedure, isDisplayed: boolean) => void;
  routeOpen: boolean;
  setRouteOpen: (open: boolean) => void;
  onRouteSubmit: (input: RouteInput) => Promise<void> | void;
  onRouteClear: () => void;
  routeResult: Route | null;
  children?: JSX.Element;
}

export const TopMenuBar: Component<TopMenuBarProps> = (props) => {
  const toggleProcedures = () => {
    const next = !props.proceduresOpen;
    if (next) props.setRouteOpen(false);
    props.setProceduresOpen(next);
  };

  const toggleRoute = () => {
    const next = !props.routeOpen;
    if (next) props.setProceduresOpen(false);
    props.setRouteOpen(next);
  };

  return (
    <div class="flex items-center bg-slate-900 px-4 h-12 shrink-0 z-50 space-x-2">
      <div class="relative">
        <button
          data-procedures-toggle
          onClick={toggleProcedures}
          class={`flex items-center justify-center w-36 h-8 text-white rounded transition-colors cursor-pointer ${
            props.proceduresOpen
              ? 'bg-slate-600 ring-1 ring-blue-400/60'
              : 'bg-slate-700 hover:bg-slate-600'
          }`}
          title="Airport Procedures"
        >
          Procedures
        </button>
        <ProceduresDropdown
          isOpen={props.proceduresOpen}
          onClose={() => props.setProceduresOpen(false)}
          onProcedureToggle={props.onProcedureToggle}
        />
      </div>
      <div class="relative">
        <button
          data-route-toggle
          onClick={toggleRoute}
          class={`flex items-center justify-center w-24 h-8 text-white rounded transition-colors cursor-pointer ${
            props.routeOpen
              ? 'bg-slate-600 ring-1 ring-blue-400/60'
              : 'bg-slate-700 hover:bg-slate-600'
          }`}
          title="Flight Plan Route"
        >
          Route
        </button>
        <RouteDropdown
          isOpen={props.routeOpen}
          onClose={() => props.setRouteOpen(false)}
          onRouteSubmit={props.onRouteSubmit}
          onRouteClear={props.onRouteClear}
          routeResult={props.routeResult}
        />
      </div>
      <div class="ml-auto flex items-center space-x-2">{props.children}</div>
    </div>
  );
};
