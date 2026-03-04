import { defineRegistry } from '@json-render/react';
import { catalog } from '@/catalog';
import { useTreeStore } from '@/hooks/useTreeStore';
import { PersonCard } from './agent/PersonCard';
import { AncestorList } from './agent/AncestorList';
import { Timeline } from './agent/Timeline';
import { StatsGrid } from './agent/StatsGrid';
import { RelationshipPath } from './agent/RelationshipPath';
import { FamilyGroup } from './agent/FamilyGroup';

export const { registry } = defineRegistry(catalog, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: {
    PersonCard: PersonCard as any,
    AncestorList: AncestorList as any,
    Timeline: Timeline as any,
    StatsGrid: StatsGrid as any,
    RelationshipPath: RelationshipPath as any,
    FamilyGroup: FamilyGroup as any,
  },
  actions: {
    navigate_to_person: async (params) => {
      const p = params as { individual_id: string; name: string };
      useTreeStore.getState().selectPerson(p.individual_id);
    },
  },
});
