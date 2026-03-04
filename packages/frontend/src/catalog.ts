import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';

const personRef = z.object({
  id: z.string(),
  name: z.string(),
  birth_year: z.number().nullable(),
  death_year: z.number().nullable(),
  birthplace: z.string().nullable(),
  sex: z.enum(['M', 'F', 'U']).nullable(),
});

export const catalog = defineCatalog(schema, {
  components: {
    PersonCard: {
      props: personRef,
      description: 'Display a single person as a card',
    },
    AncestorList: {
      props: z.object({
        items: z.array(personRef.extend({
          generation: z.number(),
          relation: z.string(),
        })),
      }),
      description: 'Table of ancestors by generation',
    },
    Timeline: {
      props: z.object({
        name: z.string(),
        events: z.array(z.object({
          type: z.string(),
          year: z.number().nullable(),
          place: z.string().nullable(),
          description: z.string().nullable(),
        })),
      }),
      description: 'Chronological life events',
    },
    StatsGrid: {
      props: z.object({
        stats: z.array(z.object({
          label: z.string(),
          value: z.union([z.string(), z.number()]),
          unit: z.string().nullable(),
        })),
      }),
      description: 'Grid of statistics',
    },
    RelationshipPath: {
      props: z.object({
        relationship: z.string(),
        path: z.array(z.object({
          name: z.string(),
          relation_to_next: z.string().nullable(),
        })),
      }),
      description: 'Visual relationship path',
    },
    FamilyGroup: {
      props: z.object({
        father: personRef.nullable(),
        mother: personRef.nullable(),
        children: z.array(personRef),
        marriage_year: z.number().nullable(),
      }),
      description: 'A family unit',
    },
  },
  actions: {
    navigate_to_person: {
      params: z.object({
        individual_id: z.string(),
        name: z.string(),
      }),
      description: 'Focus this person in the tree view',
    },
  },
});
