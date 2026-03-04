export interface GedcomDate {
  day?: number;
  month?: number;
  year?: number;
  qualifier?: 'ABT' | 'EST' | 'CAL' | 'BEF' | 'AFT' | 'BET' | 'AND' | 'FROM' | 'TO';
  endDate?: GedcomDate;
  text?: string;
}

export const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
};

export function formatGedcomDate(date: GedcomDate | undefined): string {
  if (!date) return '';
  if (date.text) return date.text;

  const parts: string[] = [];
  if (date.qualifier) parts.push(date.qualifier);
  if (date.day) parts.push(String(date.day));
  if (date.month) parts.push(Object.keys(MONTHS).find(k => MONTHS[k] === date.month) || '');
  if (date.year) parts.push(String(date.year));

  return parts.join(' ');
}
