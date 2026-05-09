import { Component, JSX } from 'solid-js';
import { ProceduresDropdown } from './ProceduresDropdown';
import { RouteDropdown } from './RouteDropdown';
import { FixesDropdown } from './FixesDropdown';
import { Procedure } from '~/lib/types';
import { Route, RouteInput } from '~/lib/routeTypes';
import { DisplayedFix } from '~/lib/fixesTypes';

export type OpenMenu = 'procedures' | 'route' | 'fixes' | null;

interface TopMenuBarProps {
  openMenu: OpenMenu;
  setOpenMenu: (m: OpenMenu) => void;
  onProcedureToggle: (procedure: Procedure, isDisplayed: boolean) => void;
  onRouteSubmit: (input: RouteInput) => Promise<void> | void;
  onRouteClear: () => void;
  routeResult: Route | null;
  fixes: DisplayedFix[];
  onFixAdd: (input: string) => Promise<string | null>;
  onFixRemove: (id: string) => void;
  children?: JSX.Element;
}

const buttonClass = (open: boolean, width: string) =>
  `flex items-center justify-center ${width} h-8 text-white rounded transition-colors cursor-pointer ${
    open ? 'bg-slate-600 ring-1 ring-blue-400/60' : 'bg-slate-700 hover:bg-slate-600'
  }`;

export const TopMenuBar: Component<TopMenuBarProps> = (props) => {
  const toggle = (id: NonNullable<OpenMenu>) =>
    props.setOpenMenu(props.openMenu === id ? null : id);
  const close = () => props.setOpenMenu(null);

  return (
    <div class="flex items-center bg-slate-900 px-4 h-12 shrink-0 z-50 space-x-2">
      <div class="relative">
        <button
          data-procedures-toggle
          onClick={() => toggle('procedures')}
          class={buttonClass(props.openMenu === 'procedures', 'w-36')}
          title="Airport Procedures"
        >
          Procedures
        </button>
        <ProceduresDropdown
          isOpen={props.openMenu === 'procedures'}
          onClose={close}
          onProcedureToggle={props.onProcedureToggle}
        />
      </div>
      <div class="relative">
        <button
          data-route-toggle
          onClick={() => toggle('route')}
          class={buttonClass(props.openMenu === 'route', 'w-24')}
          title="Flight Plan Route"
        >
          Route
        </button>
        <RouteDropdown
          isOpen={props.openMenu === 'route'}
          onClose={close}
          onRouteSubmit={props.onRouteSubmit}
          onRouteClear={props.onRouteClear}
          routeResult={props.routeResult}
        />
      </div>
      <div class="relative">
        <button
          data-fixes-toggle
          onClick={() => toggle('fixes')}
          class={buttonClass(props.openMenu === 'fixes', 'w-24')}
          title="Standalone Fixes"
        >
          Fixes
        </button>
        <FixesDropdown
          isOpen={props.openMenu === 'fixes'}
          onClose={close}
          fixes={props.fixes}
          onFixAdd={props.onFixAdd}
          onFixRemove={props.onFixRemove}
        />
      </div>
      <div class="ml-auto flex items-center space-x-2">{props.children}</div>
    </div>
  );
};
