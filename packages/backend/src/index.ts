import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { pipeJsonRender } from '@json-render/core';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { catalog } from './catalog.js';
import { createGedcomTools } from './tools/index.js';
import { getStory } from './tools/stories.js';
import { gedcomStore } from './gedcom-store.js';
import type { SerializedGedcomData } from '@gedcom/shared';

const app = new Hono();

app.use('*', cors({ origin: 'http://localhost:5173' }));

app.post('/api/upload', async (c) => {
  // `raw` is the base64 of the original file bytes, kept for the gedlint audit.
  const { raw, ...data } = await c.req.json() as SerializedGedcomData & { raw?: string };
  gedcomStore.set(data, raw ? Buffer.from(raw, 'base64') : null);
  const indCount = Object.keys(data.individuals).length;
  const famCount = Object.keys(data.families).length;
  console.log(`[gedcom] loaded ${indCount} individuals, ${famCount} families`);
  return c.json({ ok: true, individuals: indCount, families: famCount });
});

app.post('/api/interviews', async (c) => {
  const { notes } = await c.req.json() as { notes: NonNullable<SerializedGedcomData['interviews']> };
  const data = gedcomStore.get();
  if (!data) return c.json({ error: 'no tree loaded' }, 409);
  data.interviews = notes;
  return c.json({ ok: true });
});

app.get('/api/stories/:id', (c) => {
  const story = getStory(c.req.param('id'));
  return story ? c.json(story) : c.json({ error: 'not found' }, 404);
});

app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json() as { messages: unknown[] };
  const data = gedcomStore.get();
  const tools = data ? createGedcomTools(data, gedcomStore.getRaw()) : undefined;

  const result = streamText({
    model: anthropic('claude-opus-4-6'),
    system: catalog.prompt({
      mode: 'chat',
      customRules: [
        'Always call search_individuals before assuming an ID — never guess IDs.',
        'When showing a single person, render a PersonCard component.',
        'When showing multiple ancestors or descendants, render an AncestorList.',
        'When asked to "show" or "navigate to" someone, trigger the navigate_to_person action.',
        'For statistics (counts, averages, distributions), render a StatsGrid.',
        'For life events chronology, render a Timeline.',
        'For family units (parents + children), render a FamilyGroup.',
        'For relationship paths between two people, render a RelationshipPath.',
        'For an ancestor report, pedigree or Ahnentafel numbering, call generate_ancestor_report and render the items with AncestorList.',
        'For questions about origins, where a family came from, or how it moved, call analyze_migration and render a MigrationTimeline.',
        'For questions about file quality, errors, duplicates, or GEDCOM validity, call audit_tree.',
        'Whenever you report a lint rule code, call explain_lint_rule for it and summarise the why and the remedy.',
        'When asked for a story, a relat or a història about the family, write one for relatives to watch: ' +
          'gather facts first (get_individual_detail, get_timeline, get_parents, get_children, analyze_migration), ' +
          'then call save_story and render a StoryCard with the story_id it returns. ' +
          'Write the story in Catalan, 4 to 8 steps in chronological order, each with a short warm narrative of 2 or 3 paragraphs. ' +
          'Use only facts from the tree; anything uncertain or family tradition goes in the step notes, never stated as fact. ' +
          'Vary the stages: the tree when people meet or are born, a document when a source backs the step (quote its page), ' +
          'photos when the person has media, a map (coordinates from geocode_places) when the family moves, with route for a migration. ' +
          'For a single Catalan village before 1960, a map with the orto-1945 or orto-1956 basemap shows it as the family saw it. ' +
          'If save_story returns errors, fix them and call it again. ' +
          'interview_notes (from get_individual_detail) are what relatives remember: they bring a story to life, ' +
          'told as family memory ("segons recorda la família"), and go in the step notes too.',
        'Be concise in text; let the components carry the data.',
      ],
    }),
    messages: messages as ModelMessage[],
    tools,
    stopWhen: stepCountIs(10),
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(pipeJsonRender(result.toUIMessageStream()));
    },
  });

  return createUIMessageStreamResponse({ stream });
});

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log('[server] listening on http://localhost:3001');
});
