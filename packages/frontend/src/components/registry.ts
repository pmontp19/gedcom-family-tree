import { defineRegistry } from '@json-render/react';
import { catalog } from '@/catalog';
import { useTreeStore } from '@/hooks/useTreeStore';
import { PersonCard } from './agent/PersonCard';
import { AncestorList } from './agent/AncestorList';
import { Timeline } from './agent/Timeline';
import { StatsGrid } from './agent/StatsGrid';
import { RelationshipPath } from './agent/RelationshipPath';
import { FamilyGroup } from './agent/FamilyGroup';
import { MigrationTimeline } from './agent/MigrationTimeline';

export const { registry } = defineRegistry(catalog, {
  components: {
    PersonCard,
    AncestorList,
    Timeline,
    StatsGrid,
    RelationshipPath,
    FamilyGroup,
    MigrationTimeline,
  },
  actions: {
    navigate_to_person: async (params) => {
      const p = params as { individual_id: string; name: string };
      useTreeStore.getState().selectPerson(p.individual_id);
    },
  },
});
