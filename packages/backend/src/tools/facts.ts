import { tool } from 'ai';
import { z } from 'zod';
import type { Citation, SerializedGedcomData } from '@gedcom/shared';
import { getSerializedIndividual, toPersonRef } from '@gedcom/shared';

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

/** Citations with the source title resolved, as an author needs them to cite. */
function cite(data: SerializedGedcomData, citations: Citation[] | undefined) {
  return (citations ?? []).map(c => ({
    source_id: c.id ?? null,
    title: (c.id ? data.sources?.[c.id]?.title : undefined) ?? c.text ?? null,
    page: c.page ?? null,
  }));
}

export function factsTools(data: SerializedGedcomData) {
  return {
    get_individual_detail: tool({
      description: 'Get full detail for a single individual by ID',
      inputSchema: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        const ind = getSerializedIndividual(data, individual_id);
        if (!ind) return null;
        return {
          ...toPersonRef(ind),
          given_name: ind.name?.given ?? null,
          surname: ind.name?.surname ?? null,
          death_place: ind.death?.place ?? null,
          death_year: ind.death?.date?.year ?? null,
          events_count: ind.events.length,
          is_in_family_as_child: ind.famc.length > 0,
          families_as_spouse: ind.fams.length,
          notes: ind.notes,
          sources: cite(data, ind.sources),
          media: ind.media ?? [],
          interview_notes: data.interviews?.[individual_id] ?? [],
        };
      },
    }),

    get_timeline: tool({
      description: 'Get all life events for an individual in chronological order',
      inputSchema: z.object({ individual_id: z.string() }),
      execute: async ({ individual_id }) => {
        const ind = getSerializedIndividual(data, individual_id);
        if (!ind) return null;

        const events: Array<{
          type: string;
          year: number | null;
          place: string | null;
          description: string | null;
          notes?: string[];
          sources?: ReturnType<typeof cite>;
        }> = [];

        // Birth
        if (ind.birth) {
          events.push({
            type: 'Birth',
            year: ind.birth.date?.year ?? null,
            place: ind.birth.place ?? null,
            description: null,
            notes: ind.birth.notes,
            sources: cite(data, ind.birth.sources),
          });
        }

        // Other events. BIRT/DEAT also live on `events`, but they are pushed
        // from `ind.birth`/`ind.death` above; adding them again duplicates rows.
        for (const ev of ind.events) {
          if (ev.type === 'BIRT' || ev.type === 'DEAT') continue;
          events.push({
            type: EVENT_LABELS[ev.type] ?? ev.type,
            year: ev.date?.year ?? null,
            place: ev.place ?? null,
            description: ev.value ?? null,
            notes: ev.notes,
            sources: cite(data, ev.sources),
          });
        }

        // Also include marriage events from families
        for (const famId of ind.fams) {
          const fam = data.families[famId];
          if (fam?.marriage) {
            const spouseId = fam.husband === individual_id ? fam.wife : fam.husband;
            const spouse = spouseId ? getSerializedIndividual(data, spouseId) : null;
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
            notes: ind.death.notes,
            sources: cite(data, ind.death.sources),
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
      inputSchema: z.object({ event_type: z.string() }),
      execute: async ({ event_type }) => {
        const type = event_type.toUpperCase();
        return Object.values(data.individuals)
          .filter(ind => ind.events.some(ev => ev.type === type))
          .map(toPersonRef);
      },
    }),
  };
}
