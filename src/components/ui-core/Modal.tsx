import { Component, JSX } from 'solid-js';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
}

export const Modal: Component<ModalProps> = (props) => {
  return (
    <div class={`fixed inset-0 z-50 flex items-center justify-center ${props.isOpen ? 'visible' : 'invisible'}`}>
      {/* Backdrop */}
      <div
        class={`fixed inset-0 bg-black transition-opacity ${props.isOpen ? 'opacity-50' : 'opacity-0'}`}
        onClick={props.onClose}
      />

      {/* Modal */}
      <div
        class={`relative bg-slate-800 rounded-lg shadow-xl transition-all transform ${
          props.isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        } max-w-lg w-full mx-4`}
      >
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 class="text-xl font-semibold text-white">{props.title}</h2>
          <button onClick={props.onClose} class="text-slate-400 hover:text-slate-200 focus:outline-none">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div class="p-4">{props.children}</div>
      </div>
    </div>
  );
};
