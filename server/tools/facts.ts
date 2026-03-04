import { tool } from 'ai';
import { z } from 'zod';
import type { GedcomData } from '../types.js';
import { getIndividual, toPersonRef } from '../types.js';

const EVENT_LABELS: Record<string, string> = {
  BIRT: 'Birth',
  DEAT: 'Death',
  MARR: 'Marriage',
  DIV: 'Divorce',
  RESI: 'Residence',
  OCCU: 'Occupation',
  EDUC: 'Education',
  IMMI: 'Immigration',
  EMIG: 'Emigration',
  NATU: 'Naturalization',
  MILI: 'Military Service',
  BAPM: 'Baptism',
  BURI: 'Burial',
  CENS: 'Census',
  PROB: 'Probate',
  WILL: 'Will',
  GRAD: 'Graduation',
  RETI: 'Retirement',
};

export function factsTools(data: GedcomData) {
  return {
    get_individual_detail: tool({
      description: 'Get full detail for a single individual by ID',
      parameters: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        const ind = getIndividual(data, individual_id);
        if (!ind) return null;
        return {
          ...toPersonRef(ind),
          given_name: ind.name?.given ?? null,
          surname: ind.name?.surname ?? null,
          death_place: ind.death?.place ?? null,
          death_year: ind.death?.date?.year ?? null,
          events_count: ind.events.length,
          is_in_family_as_child: !!ind.famc,
          families_as_spouse: ind.fams.length,
        };
      },
    }),

    get_timeline: tool({
      description: 'Get all life events for an individual in chronological order',
      parameters: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        const ind = getIndividual(data, individual_id);
        if (!ind) return null;

        const events: Array<{
          type: string;
          year: number | null;
          place: string | null;
          description: string | null;
        }> = [];

        // Birth
        if (ind.birth) {
          events.push({
            type: 'Birth',
            year: ind.birth.date?.year ?? null,
            place: ind.birth.place ?? null,
            description: null,
          });
        }

        // Other events
        for (const ev of ind.events) {
          events.push({
            type: EVENT_LABELS[ev.type] ?? ev.type,
            year: ev.date?.year ?? null,
            place: ev.place ?? null,
            description: null,
          });
        }

        // Also include marriage events from families
        for (const famId of ind.fams) {
          const fam = data.families[famId];
          if (fam?.marriage) {
            const spouseId = fam.husband === individual_id ? fam.wife : fam.husband;
            const spouse = spouseId ? getIndividual(data, spouseId) : null;
            events.push({
              type: 'Marriage',
              year: fam.marriage.date?.year ?? null,
              place: fam.marriage.place ?? null,
              description: spouse ? `To ${spouse.name?.full ?? spouse.id}` : null,
            });
          }
        }

        // Death
        if (ind.death) {
          events.push({
            type: 'Death',
            year: ind.death.date?.year ?? null,
            place: ind.death.place ?? null,
            description: null,
          });
        }

        // Sort by year
        events.sort((a, b) => {
          if (a.year === null && b.year === null) return 0;
          if (a.year === null) return 1;
          if (b.year === null) return -1;
          return a.year - b.year;
        });

        return {
          name: ind.name?.full ?? ind.id,
          events,
        };
      },
    }),

    get_events_by_type: tool({
      description: 'Find all individuals who have a specific event type (e.g., IMMI for immigration)',
      parameters: z.object({ event_type: z.string() }),
      execute: async ({ event_type }) => {
        const type = event_type.toUpperCase();
        return Object.values(data.individuals)
          .filter(ind => ind.events.some(ev => ev.type === type))
          .map(toPersonRef);
      },
    }),
  };
}
