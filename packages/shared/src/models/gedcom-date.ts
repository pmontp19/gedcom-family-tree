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

// The UI is in Catalan.
const MONTH_NAMES: Record<number, string> = {
  1: 'gener', 2: 'febrer', 3: 'març', 4: 'abril', 5: 'maig', 6: 'juny',
  7: 'juliol', 8: 'agost', 9: 'setembre', 10: 'octubre', 11: 'novembre', 12: 'desembre'
};

const QUALIFIER_LABELS: Partial<Record<NonNullable<GedcomDate['qualifier']>, string>> = {
  ABT: 'cap a', EST: 'est.', CAL: 'calc.',
  BEF: 'abans de', AFT: 'després de', BET: 'entre',
  FROM: 'des de', TO: 'fins a'
};

/** "de" contracts before a vowel: "d'abril", "d'octubre". */
const de = (word: string) => (/^[aeiouàèéíòóú]/i.test(word) ? `d'${word}` : `de ${word}`);

/** A date for reading, in Catalan: "20 de juny de 1975", "cap a 1820". */
export function formatDateLong(date: GedcomDate | undefined): string {
  if (!date) return '';
  if (date.text) return date.text;

  const formatPart = (d: GedcomDate): string => {
    const month = d.month ? MONTH_NAMES[d.month] : undefined;
    if (d.day && month && d.year) return `${d.day} ${de(month)} ${de(String(d.year))}`;
    if (d.day && month) return `${d.day} ${de(month)}`;
    if (month && d.year) return `${month} ${de(String(d.year))}`;
    if (d.year) return String(d.year);
    return month ?? '';
  };

  if (date.qualifier === 'BET' && date.endDate) {
    return `entre ${formatPart(date)} i ${formatPart(date.endDate)}`;
  }
  if (date.qualifier === 'FROM' && date.endDate) {
    return `${de(formatPart(date))} a ${formatPart(date.endDate)}`;
  }

  const prefix = date.qualifier ? QUALIFIER_LABELS[date.qualifier] ?? date.qualifier : '';
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
