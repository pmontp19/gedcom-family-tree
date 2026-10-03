import { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import type { GedcomData, Story, StoryStep, StoryStage, StoryMedia } from '@gedcom/shared';
import { getDisplayName, getLifeYears } from '@gedcom/shared';
import { ChevronLeft, ChevronRight, X, StickyNote, ScrollText, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractSubgraph } from '@/visualization/subgraph-extractor';
import type { ThemeId } from '@/visualization/theme';

const FamilyTree = lazy(() => import('@/components/tree/FamilyTree').then(m => ({ default: m.FamilyTree })));

interface StoryPlayerProps {
  story: Story;
  data: GedcomData;
  themeId: ThemeId;
  onClose: () => void;
}

export function StoryPlayer({ story, data, themeId, onClose }: StoryPlayerProps) {
  const [index, setIndex] = useState(0);
  const step = story.steps[index];
  const last = story.steps.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, last));
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onClose]);

  return (
    <div className="h-screen w-screen bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-lg leading-tight truncate">{story.title}</h1>
          {story.subtitle && <p className="text-xs text-muted-foreground truncate">{story.subtitle}</p>}
        </div>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {index + 1} / {story.steps.length}
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tanca la història" className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* The path: one segment per step, jump to any of them. */}
      <nav className="flex gap-1 px-4 pt-2" aria-label="Passos de la història">
        {story.steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Pas ${i + 1}: ${s.title}`}
            aria-current={i === index ? 'step' : undefined}
            title={s.title}
            className="group flex-1 py-2"
          >
            <span className={`block h-1 rounded-full transition-colors ${
              i <= index ? 'bg-primary' : 'bg-muted group-hover:bg-muted-foreground/30'
            }`} />
          </button>
        ))}
      </nav>

      <main className="flex-1 min-h-0 flex flex-col md:flex-row">
        <section className="order-1 md:order-2 h-[40vh] md:h-auto md:flex-1 relative border-b md:border-b-0 md:border-l bg-muted/30">
          <Stage stage={step.stage} people={step.people} data={data} themeId={themeId} />
        </section>
        <article key={index} className="order-2 md:order-1 flex-1 md:flex-none md:w-[420px] lg:w-[480px] overflow-y-auto px-6 py-6 animate-in fade-in duration-300">
          <StepText step={step} data={data} />
        </article>
      </main>

      <footer className="flex items-center justify-between gap-2 px-4 py-3 border-t">
        <Button variant="outline" onClick={() => setIndex(i => i - 1)} disabled={index === 0}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        {index < last ? (
          <Button onClick={() => setIndex(i => i + 1)}>
            Següent <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={onClose}>Fi</Button>
        )}
      </footer>
    </div>
  );
}

function StepText({ step, data }: { step: StoryStep; data: GedcomData }) {
  const people = step.people.map(id => data.individuals.get(id)).filter(p => !!p);
  return (
    <div className="space-y-5 max-w-prose">
      <div>
        {step.date && (
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{step.date}</p>
        )}
        <h2 className="font-serif text-2xl leading-tight text-balance">{step.title}</h2>
      </div>

      <div className="font-serif text-[17px] leading-relaxed space-y-4">
        {step.body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
      </div>

      {step.highlights.length > 0 && (
        <ul className="space-y-2">
          {step.highlights.map((h, i) => (
            <li key={i} className="border-l-2 border-primary pl-3 text-sm font-medium">{h}</li>
          ))}
        </ul>
      )}

      {people.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Persones">
          {people.map(p => (
            <li key={p.id} className="rounded-full border px-3 py-1 text-xs">
              {getDisplayName(p)}
              {getLifeYears(p) && <span className="text-muted-foreground"> · {getLifeYears(p)}</span>}
            </li>
          ))}
        </ul>
      )}

      {step.notes.length > 0 && (
        <aside className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <StickyNote className="h-3.5 w-3.5" /> Notes de recerca
          </p>
          {step.notes.map((n, i) => <p key={i}>{n}</p>)}
        </aside>
      )}
    </div>
  );
}

function Stage({ stage, people, data, themeId }: { stage: StoryStage; people: string[]; data: GedcomData; themeId: ThemeId }) {
  switch (stage.kind) {
    case 'tree': return <TreeStage focusId={stage.focusId} generations={stage.generations} people={people} data={data} themeId={themeId} />;
    case 'media': return <MediaStage items={stage.items} data={data} />;
    case 'document': return <DocumentStage {...stage} data={data} />;
  }
}

function TreeStage({ focusId, generations, people, data, themeId }: {
  focusId: string; generations: number; people: string[]; data: GedcomData; themeId: ThemeId;
}) {
  const view = useMemo(
    () => data.individuals.has(focusId) ? extractSubgraph(data, focusId, generations) : null,
    [data, focusId, generations],
  );
  const highlightIds = useMemo(() => new Set(people), [people]);
  if (!view) return <Missing text="Aquesta persona no és a l'arbre carregat" />;
  return (
    <Suspense fallback={null}>
      <FamilyTree data={view} focusId={focusId} highlightIds={highlightIds} themeId={themeId} />
    </Suspense>
  );
}

/** The image an item points at: a direct URL, or the person's OBJE resolved from the package. */
function mediaUrl(item: StoryMedia, data: GedcomData): string | undefined {
  if (item.src) return item.src;
  if (!item.personId || !item.file) return undefined;
  return data.individuals.get(item.personId)?.media.find(m => m.file === item.file)?.url;
}

function MediaStage({ items, data }: { items: StoryMedia[]; data: GedcomData }) {
  return (
    <div className={`h-full grid gap-4 p-4 md:p-8 ${items.length > 1 ? 'grid-cols-1 sm:grid-cols-2 overflow-y-auto' : ''}`}>
      {items.map((item, i) => {
        const url = mediaUrl(item, data);
        return (
          <figure key={i} className="min-h-0 flex flex-col items-center justify-center gap-2">
            {url ? (
              <img src={url} alt={item.caption ?? ''} className="min-h-0 max-h-full max-w-full object-contain rounded-md shadow-md" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
                <ImageOff className="h-8 w-8" /> Imatge no disponible
              </div>
            )}
            {item.caption && <figcaption className="text-sm text-muted-foreground text-center">{item.caption}</figcaption>}
          </figure>
        );
      })}
    </div>
  );
}

function DocumentStage({ sourceId, title, page, excerpt, data }: {
  sourceId?: string; title: string; page?: string; excerpt?: string; data: GedcomData;
}) {
  const source = sourceId ? data.sources.get(sourceId) : undefined;
  return (
    <div className="h-full overflow-y-auto flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-lg rounded-md border bg-card text-card-foreground shadow-md p-6 space-y-3">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <ScrollText className="h-3.5 w-3.5" /> Document
        </p>
        <h3 className="font-serif text-xl leading-snug">{source?.title ?? title}</h3>
        {(source?.author || page) && (
          <p className="text-sm text-muted-foreground">{[source?.author, page].filter(Boolean).join(' · ')}</p>
        )}
        {excerpt && (
          <blockquote className="font-serif italic leading-relaxed border-l-2 pl-4 whitespace-pre-line">{excerpt}</blockquote>
        )}
      </div>
    </div>
  );
}

function Missing({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-6 text-center">{text}</div>;
}
