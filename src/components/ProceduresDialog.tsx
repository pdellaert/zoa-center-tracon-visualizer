import { Component } from "solid-js";
import { Sidebar } from "./ui-core/Sidebar";
import { AirportArrivals } from "./AirportArrivals";
import { ArrivalProcedure } from "~/types";

interface ProceduresDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onArrivalToggle: (arrival: ArrivalProcedure, isDisplayed: boolean) => void;
}

export const ProceduresDialog: Component<ProceduresDialogProps> = (props) => {
  return (
    <Sidebar isOpen={props.isOpen} onClose={props.onClose} title="Airport Procedures">
      <AirportArrivals onArrivalToggle={props.onArrivalToggle} />
    </Sidebar>
  );
};
