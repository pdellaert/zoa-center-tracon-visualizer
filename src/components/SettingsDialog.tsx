import {
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui-core';
import { Component, Show } from 'solid-js';
import { Settings } from '~/lib/types';
import { SetStoreFunction } from 'solid-js/store';

interface SettingsProps {
  settings: Settings;
  setSettings: SetStoreFunction<Settings>;
}

export const SettingsDialog: Component<SettingsProps> = (props) => {
  return (
    <Dialog>
      <DialogTrigger class="flex items-center justify-center h-8 px-3 text-sm font-medium rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors cursor-pointer">
        Settings
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Changes will be be saved automatically to your local browser.</DialogDescription>
        </DialogHeader>
        <div class="flex items-center">
          <Checkbox
            checked={props.settings.popup.followMouse}
            onChange={(val: boolean) => props.setSettings('popup', 'followMouse', val)}
          ></Checkbox>
          <label class="ml-1.5">Popup: follow mouse</label>
        </div>
        <div class="flex items-center">
          <Checkbox
            checked={props.settings.popup.showUncheckedSectors}
            onChange={(val: boolean) => props.setSettings('popup', 'showUncheckedSectors', val)}
          ></Checkbox>
          <label class="ml-1.5">Popup: show information for non-displayed sectors</label>
        </div>
        <Show when={props.settings.popup.showUncheckedSectors}>
          <div class="flex items-center">
            <Checkbox
              checked={props.settings.popup.uncheckedSectorsInVisibleSectorsOnly}
              onChange={(val: boolean) => props.setSettings('popup', 'uncheckedSectorsInVisibleSectorsOnly', val)}
            ></Checkbox>
            <label class="ml-1.5">
              Popup: show information for non-displayed sectors only when hovering visible sectors
            </label>
          </div>
        </Show>
        {/*Stuff here*/}
      </DialogContent>
    </Dialog>
  );
};
