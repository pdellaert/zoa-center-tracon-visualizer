import { Component } from 'solid-js';
import { MenuDropdown } from './MenuDropdown';
import { FixesPanel } from './FixesPanel';
import { DisplayedFix } from '~/lib/fixesTypes';

interface FixesDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  fixes: DisplayedFix[];
  onFixAdd: (input: string) => Promise<string | null>;
  onFixRemove: (id: string) => void;
}

export const FixesDropdown: Component<FixesDropdownProps> = (props) => (
  <MenuDropdown
    isOpen={props.isOpen}
    onClose={props.onClose}
    width="w-[280px]"
    height="max-h-[60vh]"
    toggleDataAttr="data-fixes-toggle"
  >
    <FixesPanel
      fixes={props.fixes}
      onAdd={props.onFixAdd}
      onRemove={props.onFixRemove}
    />
  </MenuDropdown>
);
