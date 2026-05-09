import { Component } from 'solid-js';
import { MenuDropdown } from './MenuDropdown';
import { AirportProcedures } from './AirportProcedures';
import { Procedure } from '~/lib/types';

interface ProceduresDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onProcedureToggle: (procedure: Procedure, isDisplayed: boolean) => void;
}

export const ProceduresDropdown: Component<ProceduresDropdownProps> = (props) => (
  <MenuDropdown
    isOpen={props.isOpen}
    onClose={props.onClose}
    width="w-[200px]"
    height="h-[40vh]"
    toggleDataAttr="data-procedures-toggle"
  >
    <AirportProcedures onProcedureToggle={props.onProcedureToggle} />
  </MenuDropdown>
);
