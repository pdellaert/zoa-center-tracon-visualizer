import { Procedure } from '~/lib/types';

export interface Coord {
  lat: number;
  lon: number;
}

export interface RouteFix {
  identifier: string;
  lat: number;
  lon: number;
  label?: string;
}

export type RouteSegment =
  | {
      kind: 'direct';
      from: RouteFix;
      to: RouteFix;
      dashed?: boolean;
    }
  | {
      kind: 'airway';
      identifier: string;
      fixes: RouteFix[];
    };

export interface RouteProcedureEntry {
  procedure: import('~/lib/types').Procedure;
  transition: string | null;
}

export interface RouteError {
  token: string;
  reason: string;
}

export interface Route {
  departure: string;
  destination: string;
  raw: string;
  segments: RouteSegment[];
  sidProcedure: Procedure | null;
  starProcedure: Procedure | null;
  sidTransition: string | null;
  starTransition: string | null;
  // Null when the SID is radar-vectors-only (no published exit fix) or the
  // STAR has no published entry fix; the builder bridges via the departure
  // airport in those cases.
  sidExitFix: RouteFix | null;
  starEntryFix: RouteFix | null;
  errors: RouteError[];
}

export interface RouteInput {
  departure: string;
  destination: string;
  raw: string;
}
