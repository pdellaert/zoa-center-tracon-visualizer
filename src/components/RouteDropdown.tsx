import { Component } from 'solid-js';
import { MenuDropdown } from './MenuDropdown';
import { RoutePanel } from './RoutePanel';
import { Route, RouteInput } from '~/lib/routeTypes';

interface RouteDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteSubmit: (input: RouteInput) => Promise<void> | void;
  onRouteClear: () => void;
  routeResult: Route | null;
}

export const RouteDropdown: Component<RouteDropdownProps> = (props) => (
  <MenuDropdown
    isOpen={props.isOpen}
    onClose={props.onClose}
    width="w-[320px]"
    height="max-h-[60vh]"
    toggleDataAttr="data-route-toggle"
  >
    <RoutePanel
      onSubmit={props.onRouteSubmit}
      onClear={props.onRouteClear}
      result={props.routeResult}
    />
  </MenuDropdown>
);
