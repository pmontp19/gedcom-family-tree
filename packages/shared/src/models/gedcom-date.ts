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

const MONTH_NAMES: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August',
  9: 'September', 10: 'October', 11: 'November', 12: 'December'
};

const QUALIFIER_LABELS: Partial<Record<NonNullable<GedcomDate['qualifier']>, string>> = {
  ABT: 'ca.', EST: 'est.', CAL: 'calc.',
  BEF: 'before', AFT: 'after', BET: 'between'
};

export function formatDateLong(date: GedcomDate | undefined): string {
  if (!date) return '';
  if (date.text) return date.text;

  const prefix = date.qualifier ? QUALIFIER_LABELS[date.qualifier] ?? date.qualifier : '';

  const formatPart = (d: GedcomDate): string => {
    const month = d.month ? MONTH_NAMES[d.month] : undefined;
    if (d.day && month && d.year) return `${month} ${d.day}, ${d.year}`;
    if (month && d.year) return `${month} ${d.year}`;
    if (d.year) return String(d.year);
    if (month) return month;
    return '';
  };

  if (date.qualifier === 'BET' && date.endDate) {
    return `between ${formatPart(date)} and ${formatPart(date.endDate)}`;
  }

  const datePart = formatPart(date);
  return prefix ? `${prefix} ${datePart}` : datePart;
}

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
