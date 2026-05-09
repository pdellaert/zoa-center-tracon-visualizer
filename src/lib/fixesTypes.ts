export type FixKind = 'fix' | 'frd' | 'latlon';

export interface FixCandidate {
  identifier: string;
  lat: number;
  lon: number;
}

export interface DisplayedFix {
  id: string;
  input: string;
  kind: FixKind;
  candidates: FixCandidate[];
}
