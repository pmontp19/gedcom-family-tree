import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGedcom } from '@gedcom/parser';
import { researchGaps, interviewQuestions, interviewText, withAnswer } from '@/services/research';

// demo-catala.ged: Josep I1 is a root ancestor, Maria I4 has only a birth year,
// Jordi I11 was born 1956 and has no death.
const data = parseGedcom(readFileSync(join(__dirname, '../../../demo-catala.ged'), 'utf-8'));
const gaps = (id: string, now = 2026) => researchGaps(data.individuals.get(id)!, data, now).map(g => g.key);

describe('researchGaps', () => {
  it('asks for what the tree lacks', () => {
    expect(gaps('I1')).toEqual(['parents', 'photo']); // born, died, cited, a pagès
    expect(gaps('I4')).toEqual(['death', 'occupation', 'photo', 'sources']);
  });

  it('asks whether someone is still alive only past 80, and never for a death under that', () => {
    expect(gaps('I11', 2026)).not.toContain('death'); // 70
    expect(gaps('I11', 2040)).toContain('death'); // 84
  });

  it('asks how a couple met when the marriage has no date', () => {
    const noDate = { ...data, families: new Map(data.families).set('F3', { ...data.families.get('F3')!, marriage: undefined }) };
    const q = researchGaps(data.individuals.get('I6')!, noDate).find(g => g.key === 'marriage:F3');
    expect(q?.question).toBe('Quan i on es van casar Joan i Montserrat? Com es van conèixer?');
  });
});

describe('interviews', () => {
  it('stores answers per person and forgets blank ones', () => {
    let interviews = withAnswer({}, 'I4', 'occupation', 'A què es dedicava Maria?', 'Modista');
    expect(interviews.I4.occupation.answer).toBe('Modista');
    interviews = withAnswer(interviews, 'I4', 'occupation', 'A què es dedicava Maria?', '  ');
    expect(interviews.I4).toEqual({});
  });

  it('prints every question with its answer, ending with the open ones', () => {
    const maria = data.individuals.get('I4')!;
    const text = interviewText(maria, data, withAnswer({}, 'I4', 'occupation', 'q', 'Modista').I4);
    expect(text).toContain('- A què es dedicava Maria?\n  Modista');
    expect(interviewQuestions(maria, data).at(-1)?.key).toBe('stories');
  });
});
