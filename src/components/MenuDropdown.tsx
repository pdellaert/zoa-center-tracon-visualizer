import { Component, createEffect, JSX, onCleanup } from 'solid-js';

interface MenuDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  // Tailwind class controlling panel width, e.g. 'w-[320px]'.
  width: string;
  // Tailwind class controlling panel height, e.g. 'max-h-[60vh]' or 'h-[40vh]'.
  height: string;
  // CSS attribute name (e.g. 'data-route-toggle') on the toggle button so
  // outside-click handling can ignore clicks that are about to flip the
  // open state via the toggle itself.
  toggleDataAttr: string;
  children: JSX.Element;
}

export const MenuDropdown: Component<MenuDropdownProps> = (props) => {
  let panelRef: HTMLDivElement | undefined;

  const handleMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (panelRef && panelRef.contains(target)) return;
    if (target.closest(`[${props.toggleDataAttr}]`)) return;
    props.onClose();
  };

  // Only attach the document-level outside-click listener while the dropdown
  // is open; createEffect's cleanup runs before the next iteration so the
  // listener detaches cleanly on close + on component unmount.
  createEffect(() => {
    if (!props.isOpen) return;
    document.addEventListener('mousedown', handleMouseDown);
    onCleanup(() => document.removeEventListener('mousedown', handleMouseDown));
  });

  return (
    <div
      ref={panelRef}
      class={`absolute top-full left-0 mt-1 ${props.width} ${props.height} bg-slate-800 rounded-lg shadow-2xl border border-slate-700 transition-all duration-200 ease-out z-[100] ${
        props.isOpen
          ? 'opacity-100 visible translate-y-0'
          : 'opacity-0 invisible -translate-y-2 pointer-events-none'
      }`}
    >
      <div class={`p-4 ${props.height} overflow-y-auto overscroll-contain`}>
        {props.children}
      </div>
    </div>
  );
};
