import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { pipeJsonRender } from '@json-render/core';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { catalog } from './catalog.js';
import { createGedcomTools } from './tools/index.js';
import { gedcomStore } from './gedcom-store.js';
import type { GedcomData } from './types.js';

const app = new Hono();

app.use('*', cors({ origin: 'http://localhost:5173' }));

app.post('/api/upload', async (c) => {
  const data = await c.req.json() as GedcomData;
  gedcomStore.set(data);
  const indCount = Object.keys(data.individuals).length;
  const famCount = Object.keys(data.families).length;
  console.log(`[gedcom] loaded ${indCount} individuals, ${famCount} families`);
  return c.json({ ok: true, individuals: indCount, families: famCount });
});

app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json() as { messages: unknown[] };
  const data = gedcomStore.get();
  const tools = data ? createGedcomTools(data) : {};

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
        'Be concise in text; let the components carry the data.',
      ],
    }),
    messages: messages as Parameters<typeof streamText>[0]['messages'],
    tools,
    maxSteps: 10,
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
