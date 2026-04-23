import { Component } from 'solid-js';
import { Sidebar } from './ui-core/Sidebar';
import { AirportProcedures } from './AirportProcedures';
import { Procedure } from '~/lib/types';

interface ProceduresDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProcedureToggle: (procedure: Procedure, isDisplayed: boolean) => void;
}

export const ProceduresDialog: Component<ProceduresDialogProps> = (props) => {
  return (
    <Sidebar isOpen={props.isOpen} onClose={props.onClose} title="Airport Procedures">
      <AirportProcedures onProcedureToggle={props.onProcedureToggle} />
    </Sidebar>
  );
};
