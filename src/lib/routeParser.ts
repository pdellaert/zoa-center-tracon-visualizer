export type TokenType =
  | 'sidProc'
  | 'starProc'
  | 'dct'
  | 'airway'
  | 'fix'
  | 'latlon'
  | 'frd';

export interface ClassifiedToken {
  raw: string;
  type: TokenType;
  index: number;
}

export interface ParseResult {
  tokens: ClassifiedToken[];
}

const LATLON_RE = /^\d{2,4}[NS]\/?\d{3,5}[EW]$/;
export const FRD_RE = /^[A-Z]{3,5}\d{6}$/;
const AIRWAY_RE = /^[A-Z]{1,2}\d{1,4}$/;

export const tokenize = (raw: string): string[] =>
  raw
    .split(/\s+/)
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0);

const classifyStandalone = (t: string): TokenType => {
  if (t === 'DCT') return 'dct';
  if (LATLON_RE.test(t)) return 'latlon';
  if (FRD_RE.test(t)) return 'frd';
  if (AIRWAY_RE.test(t)) return 'airway';
  return 'fix';
};

export const classifyToken = (
  t: string,
  position: 'first' | 'last' | 'middle',
): TokenType => {
  if (t.includes('.')) {
    if (position === 'first') return 'sidProc';
    if (position === 'last') return 'starProc';
    return 'fix';
  }
  return classifyStandalone(t);
};

export const parseRoute = (raw: string): ParseResult => {
  const rawTokens = tokenize(raw);
  const n = rawTokens.length;
  const tokens: ClassifiedToken[] = rawTokens.map((t, i) => {
    const position: 'first' | 'last' | 'middle' =
      i === 0 ? 'first' : i === n - 1 ? 'last' : 'middle';
    return { raw: t, type: classifyToken(t, position), index: i };
  });
  return { tokens };
};
