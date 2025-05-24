import { Checkbox as CheckboxPrimitive, CheckboxRootProps } from '@kobalte/core/checkbox';
import { Check } from 'lucide-solid';
import { Component, Show, splitProps, ValidComponent } from 'solid-js';
import { PolymorphicProps } from '@kobalte/core';
import { cn } from '~/lib/utils';

interface StyledCheckboxProps extends CheckboxRootProps {
  label?: string;
}

type PolymorphicStyledCheckboxProps<T extends ValidComponent = 'div'> = PolymorphicProps<T, StyledCheckboxProps>;

const Checkbox: Component<PolymorphicStyledCheckboxProps> = (props) => {
  const [, rest] = splitProps(props, ['class']);
  return (
    <CheckboxPrimitive class={cn('items-center relative group flex space-x-2', props.class)} {...rest}>
      <CheckboxPrimitive.Input />
      <CheckboxPrimitive.Control class="h-[20px] w-[20px] rounded-sm border border-gray-200 bg-slate-800 hover:bg-slate-700 transition-colors data-checked:bg-orange-700 data-checked:hover:bg-orange-700 data-checked:text-white">
        <CheckboxPrimitive.Indicator>
          <Check size={18} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Control>
      <Show when={props.label}>
        <CheckboxPrimitive.Label class="ml-1.5 text-white text-sm select-none">{props.label}</CheckboxPrimitive.Label>
      </Show>
    </CheckboxPrimitive>
  );
};

export { Checkbox };
