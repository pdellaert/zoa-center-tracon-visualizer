import { Select } from '@kobalte/core/select';
import { Accessor, Component, Setter } from 'solid-js';
import { SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui-core';
import { MAP_STYLES } from '~/lib/config';
import { MapStyle } from '~/lib/types';

interface MapStyleSelectorProps {
  style: Accessor<MapStyle>;
  setStyle: Setter<MapStyle>;
}

const MapStyleSelector: Component<MapStyleSelectorProps> = (props) => {
  return (
    <Select
      options={MAP_STYLES}
      optionValue="value"
      optionTextValue="label"
      optionDisabled="disabled"
      value={props.style()}
      onChange={props.setStyle}
      disallowEmptySelection={true}
      itemComponent={(props) => <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>}
    >
      <SelectTrigger aria-label="Map Style" class="w-[180px] cursor-pointer">
        <SelectValue<MapStyle>>{(state) => state.selectedOption().label}</SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  );
};

export { MapStyleSelector };
