import { Component, onCleanup, onMount } from 'solid-js';
import { AirportProcedures } from './AirportProcedures';
import { Procedure } from '~/lib/types';

interface ProceduresDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onProcedureToggle: (procedure: Procedure, isDisplayed: boolean) => void;
}

export const ProceduresDropdown: Component<ProceduresDropdownProps> = (props) => {
  let panelRef: HTMLDivElement | undefined;

  const handleMouseDown = (e: MouseEvent) => {
    if (!props.isOpen) return;
    const target = e.target as HTMLElement;
    if (panelRef && panelRef.contains(target)) return;
    if (target.closest('[data-procedures-toggle]')) return;
    props.onClose();
  };

  onMount(() => document.addEventListener('mousedown', handleMouseDown));
  onCleanup(() => document.removeEventListener('mousedown', handleMouseDown));

  return (
    <div
      ref={panelRef}
      class={`absolute top-full left-0 mt-1 w-[200px] h-[40vh] bg-slate-800 rounded-lg shadow-2xl border border-slate-700 transition-all duration-200 ease-out z-[100] ${
        props.isOpen
          ? 'opacity-100 visible translate-y-0'
          : 'opacity-0 invisible -translate-y-2 pointer-events-none'
      }`}
    >
      <div class="p-4 h-full overflow-y-auto overscroll-contain">
        <AirportProcedures onProcedureToggle={props.onProcedureToggle} />
      </div>
    </div>
  );
};
