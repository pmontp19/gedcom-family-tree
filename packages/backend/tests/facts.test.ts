import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SerializedGedcomData } from '@gedcom/shared';
import { parseGedcom } from '../../parser/src/index.js';
import { factsTools } from '../src/tools/facts.js';

const DEMO_FILE = join(dirname(fileURLToPath(import.meta.url)), '../../../demo.ged');
const parsed = parseGedcom(readFileSync(DEMO_FILE, 'utf-8'));
const data: SerializedGedcomData = {
  individuals: Object.fromEntries(parsed.individuals),
  families: Object.fromEntries(parsed.families),
};

describe('get_timeline', () => {
  it('lists birth and death once each, though the parser keeps them on events too', async () => {
    const timeline = await factsTools(data).get_timeline.execute!(
      { individual_id: 'I1' },
      { toolCallId: 't1', messages: [] }
    );
    expect(timeline!.events.filter(e => e.type === 'Birth')).toHaveLength(1);
    expect(timeline!.events.filter(e => e.type === 'Death')).toHaveLength(1);
    expect(timeline!.events.map(e => e.type)).toEqual(['Birth', 'Immigration', 'Marriage', 'Death']);
  });
});
