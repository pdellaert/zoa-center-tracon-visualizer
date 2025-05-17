import { Component, JSX } from "solid-js";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  return (
    <div
      class={`fixed left-53 top-0 h-full z-50 transition-opacity duration-300 ease-in-out ${
        //props.isOpen ? "translate-x-52" : "-translate-x-full"
        props.isOpen ? "opacity-100 visible" : "opacity-0 invisible"
      }`}
    >
      <div class="h-full w-48 bg-slate-800 shadow-xl">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 class="text-xl font-semibold text-white">{props.title}</h2>
          <button
            onClick={props.onClose}
            class="text-slate-400 hover:text-slate-200 focus:outline-none"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div class="p-4 h-[calc(100%-4rem)] overflow-y-auto overscroll-contain">
          {props.children}
        </div>
      </div>
    </div>
  );
};
