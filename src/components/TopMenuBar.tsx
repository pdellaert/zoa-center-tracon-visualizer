import { Component, JSX } from 'solid-js';
import { ProceduresDropdown } from './ProceduresDropdown';
import { Procedure } from '~/lib/types';

interface TopMenuBarProps {
  proceduresOpen: boolean;
  setProceduresOpen: (open: boolean) => void;
  onProcedureToggle: (procedure: Procedure, isDisplayed: boolean) => void;
  children?: JSX.Element;
}

export const TopMenuBar: Component<TopMenuBarProps> = (props) => {
  return (
    <div class="flex items-center bg-slate-900 px-4 h-12 shrink-0 z-50">
      <div class="relative">
        <button
          data-procedures-toggle
          onClick={() => props.setProceduresOpen(!props.proceduresOpen)}
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
      <div class="ml-auto flex items-center space-x-2">{props.children}</div>
    </div>
  );
};
