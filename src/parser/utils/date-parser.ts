import type { GedcomDate } from '@/models';
import { MONTHS, formatGedcomDate as formatGedcomDateModel } from '@/models/gedcom-date';

export { MONTHS };
export const formatGedcomDate = formatGedcomDateModel;

const QUALIFIERS = ['ABT', 'EST', 'CAL', 'BEF', 'AFT', 'BET', 'FROM', 'TO', 'AND'];

export function parseDate(dateStr: string): GedcomDate {
  if (!dateStr || dateStr.trim() === '') {
    return {};
  }

  const parts = dateStr.trim().split(/\s+/);
  const result: GedcomDate = {};
  let index = 0;

  // Check for qualifier
  if (QUALIFIERS.includes(parts[index]?.toUpperCase())) {
    result.qualifier = parts[index].toUpperCase() as GedcomDate['qualifier'];
    index++;
  }

  // Try to parse day
  const dayOrYear = parseInt(parts[index], 10);
  if (isNaN(dayOrYear)) {
    // Could be month
    const monthNum = MONTHS[parts[index]?.toUpperCase()];
    if (monthNum) {
      result.month = monthNum;
      index++;
    }
  } else if (dayOrYear > 31) {
    // It's a year
    result.year = dayOrYear;
    index++;
  } else {
    // It's a day
    result.day = dayOrYear;
    index++;

    // Check for month
    const monthNum = MONTHS[parts[index]?.toUpperCase()];
    if (monthNum) {
      result.month = monthNum;
      index++;
    }
  }

  // Check for year
  const year = parseInt(parts[index], 10);
  if (!isNaN(year) && year > 31) {
    result.year = year;
    index++;
  }

  // Handle BET ... AND ... range
  if (result.qualifier === 'BET' && parts[index]?.toUpperCase() === 'AND') {
    index++;
    const endDate = parseDate(parts.slice(index).join(' '));
    result.endDate = endDate;
  }

  // If nothing parsed, store as text
  if (!result.day && !result.month && !result.year && !result.qualifier) {
    result.text = dateStr;
  }

  return result;
}
