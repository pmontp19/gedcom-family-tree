// The research side: what the tree does not know yet about a person, turned
// into questions to ask a relative (or to look up in an archive), and the
// answers an interview brings back. Answers live in the browser, per tree.

import type { GedcomData, Individual } from '@gedcom/shared';
import { getDisplayName } from '@gedcom/shared';

/**
 * No death on record and born within a century, or birth unknown: treat as alive.
 * ponytail: the usual 100-year rule; errs towards hiding someone who has died.
 */
export function isLiving(ind: Individual, now = new Date().getFullYear()): boolean {
  if (ind.death || ind.events.some(e => e.type === 'DEAT' || e.type === 'BURI')) return false;
  const born = ind.birth?.date?.year;
  return born === undefined || born > now - 100;
}

export interface Question {
  /** Stable per person, so an answer finds its question again. */
  key: string;
  /** Short name of the gap, for lists. */
  label: string;
  question: string;
  /** Ask a relative, or look it up in an archive. */
  ask: 'family' | 'archive';
}

/** What the tree is missing about this person, most basic first. */
export function researchGaps(ind: Individual, data: GedcomData, now = new Date().getFullYear()): Question[] {
  const name = ind.name?.given ?? getDisplayName(ind);
  const gaps: Question[] = [];
  const add = (key: string, label: string, question: string, ask: Question['ask'] = 'family') =>
    gaps.push({ key, label, question, ask });

  if (!ind.birth?.date?.year) add('birth-date', 'Data de naixement', `Quan va néixer ${name}?`);
  if (!ind.birth?.place) add('birth-place', 'Lloc de naixement', `On va néixer ${name}?`);
  if (!isLiving(ind, now) && !ind.death) {
    add('death', 'Defunció', `Quan i on va morir ${name}? On està enterrat o enterrada?`);
  } else if (ind.birth?.date?.year && ind.birth.date.year < now - 80 && !ind.death) {
    add('death', 'Defunció', `${name} encara viu? Si no, quan i on va morir?`);
  }

  const parents = ind.famc.map(id => data.families.get(id)).find(f => f && (f.husband || f.wife));
  if (!parents) add('parents', 'Pares', `Com es deien el pare i la mare de ${name}? D'on eren?`);
  else if (!parents.husband) add('father', 'Pare', `Com es deia el pare de ${name}?`);
  else if (!parents.wife) add('mother', 'Mare', `Com es deia la mare de ${name}?`);

  for (const famId of ind.fams) {
    const fam = data.families.get(famId);
    const spouseId = fam && (fam.husband === ind.id ? fam.wife : fam.husband);
    const spouse = spouseId ? data.individuals.get(spouseId) : undefined;
    if (fam && spouse && !fam.marriage?.date?.year) {
      const spouseName = spouse.name?.given ?? getDisplayName(spouse);
      add(`marriage:${famId}`, 'Casament', `Quan i on es van casar ${name} i ${spouseName}? Com es van conèixer?`);
    }
  }

  if (!ind.events.some(e => e.type === 'OCCU')) add('occupation', 'Ofici', `A què es dedicava ${name}?`);
  if (ind.media.length === 0) add('photo', 'Foto', `Hi ha alguna fotografia de ${name}? Qui la guarda?`);
  const cited = ind.sources.length > 0 || [ind.birth, ind.death, ...ind.events].some(e => e?.sources?.length);
  if (!cited) {
    add('sources', 'Fonts', `Buscar la partida de baptisme o naixement de ${name} (arxiu parroquial o registre civil).`, 'archive');
  }
  return gaps;
}

/** The gaps, plus the open questions every interview should end with. */
export function interviewQuestions(ind: Individual, data: GedcomData): Question[] {
  const name = ind.name?.given ?? getDisplayName(ind);
  return [
    ...researchGaps(ind, data),
    { key: 'memories', label: 'Records', question: `Quins records en tens, de ${name}? Com era?`, ask: 'family' },
    { key: 'stories', label: 'Històries', question: `Hi ha alguna història de família sobre ${name}?`, ask: 'family' },
  ];
}

export interface Answer {
  question: string;
  answer: string;
  /** ISO date of the last edit. */
  date: string;
}

/** person id → question key → answer */
export type Interviews = Record<string, Record<string, Answer>>;

const keyFor = (tree: string) => `interviews:${tree}`;

export function loadInterviews(tree: string): Interviews {
  try {
    return JSON.parse(localStorage.getItem(keyFor(tree)) ?? '{}') as Interviews;
  } catch (err) {
    console.warn('Interviews unavailable:', err);
    return {};
  }
}

export function persistInterviews(tree: string, interviews: Interviews): void {
  try {
    localStorage.setItem(keyFor(tree), JSON.stringify(interviews));
  } catch (err) {
    console.warn('Could not save interviews:', err);
  }
}

/** A blank answer removes the entry: nothing was learnt. */
export function withAnswer(interviews: Interviews, personId: string, key: string, question: string, answer: string): Interviews {
  const person = { ...interviews[personId] };
  if (answer.trim()) person[key] = { question, answer, date: new Date().toISOString() };
  else delete person[key];
  return { ...interviews, [personId]: person };
}

/** Plain text to paste into an email or print before the next visit. */
export function interviewText(ind: Individual, data: GedcomData, answers: Record<string, Answer> = {}): string {
  const lines = [`Entrevista sobre ${getDisplayName(ind)}`, ''];
  for (const q of interviewQuestions(ind, data)) {
    lines.push(`- ${q.question}`, answers[q.key] ? `  ${answers[q.key].answer}` : '  ', '');
  }
  return lines.join('\n');
}
