import { useEffect, useMemo, useState, lazy, Suspense, type CSSProperties } from 'react';
import type { GedcomData } from '@gedcom/shared';
import type { Story, StoryStep, StoryStage, StoryMedia } from '@gedcom/shared/story';
import { getDisplayName, getLifeYears } from '@gedcom/shared';
import { ChevronLeft, ChevronRight, X, StickyNote, ScrollText, ImageOff, Play, Pause, Maximize, Minimize, Volume2, VolumeX, Landmark } from 'lucide-react';
import { useNarration, narrationSupported } from './useNarration';
import { Button } from '@/components/ui/button';
import { extractSubgraph, withoutPeople } from '@/visualization/subgraph-extractor';
import type { ThemeId } from '@/visualization/theme';

const FamilyTree = lazy(() => import('@/components/tree/FamilyTree').then(m => ({ default: m.FamilyTree })));
// Leaflet only loads with the first map step.
const MapStage = lazy(() => import('./MapStage').then(m => ({ default: m.MapStage })));

interface StoryPlayerProps {
  story: Story;
  data: GedcomData;
  themeId: ThemeId;
  /** Package audio files by zip path, for steps with recorded narration. */
  audio?: Map<string, string>;
  onClose: () => void;
}

/** Reading time at a calm pace, plus a moment to look at the stage. */
function stepSeconds(step: StoryStep): number {
  const words = [step.body, ...step.highlights].join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(8, Math.round(words / 3.5) + 4);
}

/** "1577" from "cap a 1577", for the big year behind the text and the cover. */
const yearOf = (date?: string) => date?.match(/\b(1[0-9]{3}|20[0-9]{2})\b/)?.[1];

/** -1 is the cover. */
const COVER = -1;

export function StoryPlayer({ story, data: fullData, themeId, audio, onClose }: StoryPlayerProps) {
  const data = useMemo(() => withoutPeople(fullData, story.hidden), [fullData, story.hidden]);
  const [index, setIndex] = useState(COVER);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(narrationSupported);
  // Presenting: in fullscreen the controls fade out while the mouse rests.
  const [idle, setIdle] = useState(false);
  const last = story.steps.length - 1;
  const step = index === COVER ? null : story.steps[index];

  const go = (i: number) => setIndex(Math.max(COVER, Math.min(i, last)));
  const next = () => {
    if (index < last) go(index + 1);
    else setPlaying(false);
  };

  // With the voice on, the narration paces autoplay instead of the timer.
  const narrating = playing && voiceOn && !!step;
  const narrationAudio = step?.audio ? audio?.get(step.audio) : undefined;
  const spoken = useNarration(step ? `${step.title}. ${step.body}` : '', narrating, next, narrationAudio);

  useEffect(() => {
    if (!fullscreen) return;
    let timer = window.setTimeout(() => setIdle(true), 2500);
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener('mousemove', wake);
    return () => { window.clearTimeout(timer); window.removeEventListener('mousemove', wake); setIdle(false); };
  }, [fullscreen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose();
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, last));
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, COVER));
      else if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        setPlaying(p => !p);
        setIndex(i => (i === COVER ? 0 : i));
      } else if (e.key === 'f') toggleFullscreen();
      else if (e.key === 'v' && narrationSupported) setVoiceOn(v => !v);
    };
    const onFullscreen = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [last, onClose]);

  // Leaving the player must not leave the browser in fullscreen.
  useEffect(() => () => { if (document.fullscreenElement) void document.exitFullscreen(); }, []);

  if (!step) {
    return (
      <Cover
        story={story}
        data={data}
        onStart={(autoplay) => { setPlaying(autoplay); setIndex(0); }}
        onClose={onClose}
      />
    );
  }

  const seconds = stepSeconds(step);
  const chrome = `transition-opacity duration-500 ${fullscreen && idle ? 'opacity-0' : ''}`;

  return (
    <div className={`h-dvh w-screen bg-background flex flex-col overflow-hidden ${fullscreen && idle ? 'cursor-none' : ''}`}>
      <header className={`flex items-center gap-3 px-4 py-3 border-b ${chrome}`}>
        <button type="button" onClick={() => go(COVER)} className="min-w-0 flex-1 text-left" title="Torna a la portada">
          <h1 className="font-serif text-lg leading-tight truncate">{story.title}</h1>
          {story.subtitle && <p className="text-xs text-muted-foreground truncate">{story.subtitle}</p>}
        </button>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {index + 1} / {story.steps.length}
        </span>
        <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? 'Surt de pantalla completa' : 'Pantalla completa'} title="Pantalla completa (F)" className="shrink-0 hidden sm:inline-flex">
          {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tanca la història" className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* The path: one segment per step, jump to any of them. The current one
          fills while autoplay runs and moves on when full. */}
      <nav className={`flex gap-1 px-4 pt-2 ${chrome}`} aria-label="Passos de la història">
        {story.steps.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Pas ${i + 1}: ${s.title}`}
            aria-current={i === index ? 'step' : undefined}
            title={s.title}
            className="group flex-1 py-2"
          >
            <span className="block h-1 rounded-full overflow-hidden bg-muted group-hover:bg-muted-foreground/30">
              {i < index && <span className="block h-full bg-primary" />}
              {i === index && (
                narrating ? (
                  <span className="block h-full bg-primary transition-[width] duration-300" style={{ width: `${spoken * 100}%` }} />
                ) : playing ? (
                  <span
                    key={`${index}-timer`}
                    className="story-timer block h-full bg-primary"
                    style={{ '--story-duration': `${seconds}s` } as CSSProperties}
                    onAnimationEnd={next}
                  />
                ) : <span className="block h-full bg-primary" />
              )}
            </span>
          </button>
        ))}
      </nav>

      <main className="flex-1 min-h-0 flex flex-col md:flex-row">
        <section className="order-1 md:order-2 h-[42vh] md:h-auto md:flex-1 relative border-b md:border-b-0 md:border-l bg-muted/30 overflow-hidden">
          <Stage stage={step.stage} stepKey={index} people={step.people} data={data} themeId={themeId} />
        </section>
        <div key={index} className="order-2 md:order-1 flex-1 min-h-0 md:flex-none md:w-[440px] lg:w-[500px] xl:w-[34vw] xl:max-w-[760px] relative">
          {yearOf(step.date) && (
            <span aria-hidden className="story-fade hidden md:block [@media(max-height:820px)]:hidden absolute bottom-0 left-4 font-serif text-[clamp(9rem,11vw,16rem)] leading-[0.75] text-foreground/[0.06] tabular-nums select-none pointer-events-none" style={{ '--delay': '500ms' } as CSSProperties}>
              {yearOf(step.date)}
            </span>
          )}
          <article className="relative h-full overflow-y-auto">
            <StepText step={step} data={data} presenting={fullscreen} />
          </article>
        </div>
      </main>

      <footer className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 border-t ${chrome}`}>
        <Button variant="outline" onClick={() => go(index - 1)} className="justify-self-start">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <div className="flex items-center gap-1">
        {narrationSupported && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setVoiceOn(v => !v)}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? 'Reprodueix sense veu' : 'Reprodueix amb veu'}
            title="Narració en veu alta (V)"
          >
            {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => setPlaying(p => !p)}
          aria-label={playing ? 'Atura la reproducció' : 'Reprodueix automàticament'}
          title="Reproducció automàtica (espai)"
          className="gap-1.5"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span className="hidden sm:inline">{playing ? 'Pausa' : 'Reprodueix'}</span>
        </Button>
        </div>
        {index < last ? (
          <Button onClick={() => go(index + 1)} className="justify-self-end">
            Següent <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={onClose} className="justify-self-end">Fi</Button>
        )}
      </footer>
    </div>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}

function Cover({ story, data, onStart, onClose }: {
  story: Story; data: GedcomData; onStart: (autoplay: boolean) => void; onClose: () => void;
}) {
  const root = data.individuals.get(story.rootId);
  const years = story.steps.map(s => Number(yearOf(s.date))).filter(Boolean);
  const span = years.length > 1 ? `${Math.min(...years)} · ${Math.max(...years)}` : '';
  // The years the story walks through, drifting behind the title.
  const ribbon = [...new Set(story.steps.map(s => yearOf(s.date)).filter(Boolean))].sort().join('   ');
  // The story's first picture, behind everything, barely there.
  const backdrop = story.steps.flatMap(s => s.stage.kind === 'media' ? s.stage.items : [])
    .map(item => mediaUrl(item, data)).find(Boolean);

  return (
    <div className="h-dvh w-screen bg-background relative overflow-hidden flex flex-col">
      {backdrop && (
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <img src={backdrop} alt="" className="story-kenburns story-fade h-full w-full object-cover opacity-20 grayscale" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
        </div>
      )}
      {!backdrop && <div aria-hidden className="absolute inset-0 flex items-center pointer-events-none select-none">
        <p className="story-drift story-fade whitespace-nowrap font-serif text-[22vh] leading-none text-foreground/[0.045] tabular-nums pl-[8vw]">
          {ribbon} {ribbon}
        </p>
      </div>}
      <div className="relative flex justify-end p-3">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tanca la història">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative flex-1 flex flex-col justify-center px-8 md:px-[10vw] pb-16 max-w-6xl">
        {span && (
          <p className="story-rise text-xs md:text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground tabular-nums" style={{ '--i': 0 } as CSSProperties}>
            {span}
          </p>
        )}
        <h1 className="story-rise font-serif text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight text-balance mt-4" style={{ '--i': 1 } as CSSProperties}>
          {story.title}
        </h1>
        {story.subtitle && (
          <p className="story-rise font-serif italic text-xl md:text-2xl text-muted-foreground mt-6 text-balance max-w-3xl" style={{ '--i': 2 } as CSSProperties}>
            {story.subtitle}
          </p>
        )}
        <div className="story-rise mt-10 flex flex-wrap items-center gap-3" style={{ '--i': 3 } as CSSProperties}>
          <Button size="lg" onClick={() => onStart(true)} className="gap-2">
            <Play className="h-4 w-4" /> Reprodueix
          </Button>
          <Button size="lg" variant="outline" onClick={() => onStart(false)} className="gap-2">
            Pas a pas <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground ml-1">
            {story.steps.length} capítols{root ? ` · ${getDisplayName(root)}` : ''}
          </span>
        </div>
        <p className="story-fade hidden md:block mt-8 text-xs text-muted-foreground" style={{ '--delay': '1400ms' } as CSSProperties}>
          ← → per avançar · espai per reproduir · F pantalla completa
        </p>
      </div>
    </div>
  );
}

function StepText({ step, data, presenting }: { step: StoryStep; data: GedcomData; presenting: boolean }) {
  const people = step.people.map(id => data.individuals.get(id)).filter(p => !!p);
  const paragraphs = step.body.split(/\n\s*\n/);
  // Each block rises in turn: date, title, paragraphs, then the rest.
  let i = 0;
  const rise = (className = '') => ({ className: `story-rise ${className}`, style: { '--i': i++ } as CSSProperties });

  return (
    <div className="space-y-5 xl:space-y-7 max-w-prose xl:max-w-none px-6 py-8 md:px-8 md:py-10 xl:px-[3vw] xl:py-[4vh]">
        <div {...rise()}>
          {step.date && (
            <p className="text-xs xl:text-[clamp(0.75rem,0.75vw,1rem)] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">{step.date}</p>
          )}
          <h2 className="font-serif text-3xl xl:text-[clamp(1.875rem,2.4vw,3.5rem)] leading-tight text-balance">{step.title}</h2>
        </div>

        <div className="font-serif text-[17px] xl:text-[clamp(17px,1.2vw,26px)] leading-relaxed space-y-4">
          {paragraphs.map((p, k) => <p key={k} {...rise()}>{p}</p>)}
        </div>

        {step.context.length > 0 && (
          <aside {...rise('rounded-md border border-dashed border-primary/40 p-4 space-y-3')} aria-label="Context històric">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              <Landmark className="h-3.5 w-3.5" /> Mentrestant
            </p>
            {step.context.map((c, k) => (
              <p key={k} className="text-sm xl:text-[clamp(0.875rem,0.9vw,1.2rem)] leading-snug">
                <span className="font-semibold tabular-nums">{c.date}</span> · {c.text}
                {c.url && (
                  <> <a href={c.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 text-muted-foreground hover:text-foreground">Viquipèdia</a></>
                )}
              </p>
            ))}
          </aside>
        )}

        {step.highlights.length > 0 && (
          <ul {...rise('space-y-2')}>
            {step.highlights.map((h, k) => (
              <li key={k} className="border-l-2 border-primary pl-3 text-sm xl:text-[clamp(0.875rem,0.9vw,1.25rem)] font-medium">{h}</li>
            ))}
          </ul>
        )}

        {people.length > 0 && (
          <ul aria-label="Persones" {...rise('flex flex-wrap gap-2')}>
            {people.map(p => (
              <li key={p.id} className="rounded-full border px-3 py-1 text-xs xl:text-[clamp(0.75rem,0.75vw,1rem)]">
                {getDisplayName(p)}
                {getLifeYears(p) && <span className="text-muted-foreground"> · {getLifeYears(p)}</span>}
              </li>
            ))}
          </ul>
        )}

        {/* Research notes are for the researcher, not the audience. */}
        {step.notes.length > 0 && !presenting && (
          <aside {...rise('rounded-md bg-muted/60 p-3 text-xs text-muted-foreground space-y-1')}>
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              <StickyNote className="h-3.5 w-3.5" /> Notes de recerca
            </p>
            {step.notes.map((n, k) => <p key={k}>{n}</p>)}
          </aside>
        )}
    </div>
  );
}

/**
 * Consecutive map steps share one MapStage so the camera flies between them;
 * every other stage remounts per step and settles in.
 */
function Stage({ stage, stepKey, people, data, themeId }: {
  stage: StoryStage; stepKey: number; people: string[]; data: GedcomData; themeId: ThemeId;
}) {
  if (stage.kind === 'map') {
    return (
      <Suspense fallback={null}>
        <MapStage places={stage.places} route={stage.route} basemap={stage.basemap} />
      </Suspense>
    );
  }
  return (
    <div key={stepKey} className="story-settle absolute inset-0">
      {stage.kind === 'tree' && <TreeStage focusId={stage.focusId} generations={stage.generations} people={people} data={data} themeId={themeId} />}
      {stage.kind === 'media' && <MediaStage items={stage.items} data={data} />}
      {stage.kind === 'document' && <DocumentStage {...stage} data={data} />}
      {stage.kind === 'stats' && <StatsStage items={stage.items} />}
    </div>
  );
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

/** The image an item points at: a direct URL, or the person's or source's OBJE resolved from the package. */
function mediaUrl(item: StoryMedia, data: GedcomData): string | undefined {
  if (item.src) return item.src;
  if (!item.file) return undefined;
  const owner = item.personId ? data.individuals.get(item.personId) : item.sourceId ? data.sources.get(item.sourceId) : undefined;
  return owner?.media?.find(m => m.file === item.file)?.url;
}

function MediaStage({ items, data }: { items: StoryMedia[]; data: GedcomData }) {
  // One image fills the stage and drifts slowly; several sit side by side.
  if (items.length === 1) {
    const item = items[0];
    const url = mediaUrl(item, data);
    return (
      <figure className="absolute inset-0 m-0 bg-neutral-950 overflow-hidden">
        {url ? (
          <>
            <img src={url} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover blur-2xl opacity-40 scale-110" />
            <img src={url} alt={item.caption ?? ''} className="story-kenburns relative h-full w-full object-contain p-6 md:p-10" />
          </>
        ) : <NoImage />}
        {item.caption && (
          <figcaption className="story-rise absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-6 pt-12 pb-4 text-sm xl:text-[clamp(0.875rem,0.9vw,1.25rem)] text-white/90 font-serif italic" style={{ '--i': 3 } as CSSProperties}>
            {item.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  return (
    <div className="h-full grid gap-4 p-4 md:p-8 grid-cols-1 sm:grid-cols-2 overflow-y-auto">
      {items.map((item, i) => {
        const url = mediaUrl(item, data);
        return (
          <figure key={i} className="story-rise min-h-0 flex flex-col items-center justify-center gap-2" style={{ '--i': i } as CSSProperties}>
            {url ? (
              <img src={url} alt={item.caption ?? ''} className="min-h-0 max-h-full max-w-full object-contain rounded-md shadow-md" />
            ) : <NoImage />}
            {item.caption && <figcaption className="text-sm text-muted-foreground text-center">{item.caption}</figcaption>}
          </figure>
        );
      })}
    </div>
  );
}

function NoImage() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
      <ImageOff className="h-8 w-8" /> Imatge no disponible
    </div>
  );
}

function DocumentStage({ sourceId, title, page, excerpt, data }: {
  sourceId?: string; title: string; page?: string; excerpt?: string; data: GedcomData;
}) {
  const source = sourceId ? data.sources.get(sourceId) : undefined;
  return (
    <div className="h-full overflow-y-auto flex items-center justify-center p-4 md:p-10">
      <div className="story-rise w-full max-w-lg rounded-md border bg-card text-card-foreground shadow-xl p-6 md:p-8 space-y-3 -rotate-1" style={{ '--i': 1 } as CSSProperties}>
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <ScrollText className="h-3.5 w-3.5" /> Document
        </p>
        <h3 className="font-serif text-xl leading-snug">{source?.title ?? title}</h3>
        {(source?.author || page) && (
          <p className="text-sm text-muted-foreground">{[source?.author, page].filter(Boolean).join(' · ')}</p>
        )}
        {excerpt && (
          <blockquote className="story-fade font-serif italic leading-relaxed border-l-2 pl-4 whitespace-pre-line" style={{ '--delay': '700ms' } as CSSProperties}>
            {excerpt}
          </blockquote>
        )}
      </div>
    </div>
  );
}

type StatItem = Extract<StoryStage, { kind: 'stats' }>['items'][number];

function StatsStage({ items }: { items: StatItem[] }) {
  return (
    <div className="h-full overflow-y-auto flex items-center justify-center p-6 md:p-10">
      <dl className={`w-full max-w-4xl grid gap-4 md:gap-6 ${items.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {items.map((item, i) => (
          <div key={i} className="story-rise rounded-md border bg-card text-card-foreground shadow-md p-5 md:p-6 xl:p-8" style={{ '--i': i } as CSSProperties}>
            <dd className="font-serif text-5xl xl:text-[clamp(3rem,4vw,5.5rem)] leading-none tabular-nums">
              <CountUp value={item.value} delay={400 + i * 180} />
            </dd>
            <dt className="mt-3 text-sm xl:text-[clamp(0.875rem,0.95vw,1.25rem)] font-medium">{item.label}</dt>
            {item.detail && <p className="mt-1 text-xs xl:text-[clamp(0.75rem,0.8vw,1rem)] text-muted-foreground">{item.detail}</p>}
          </div>
        ))}
      </dl>
    </div>
  );
}

/** "8.190 avantpassats": the number climbs from 0, the rest stays; ends on the text exactly as written. */
function CountUp({ value, delay }: { value: string; delay: number }) {
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    // Whole numbers only: "8.190" groups thousands, "60,2" is left as written.
    const match = value.match(/^(\d[\d.]*)(.*)$/s);
    if (!match || match[2].startsWith(',') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const [, digits, rest] = match;
    const target = Number(digits.replace(/\./g, ''));
    const format = (n: number) => (digits.includes('.') ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(n)) + rest;
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / 1400, 0), 1);
      if (t >= 1) { setShown(null); return; }
      setShown(format(Math.round(target * (1 - (1 - t) ** 3))));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, delay]);

  return <>{shown ?? value}</>;
}

function Missing({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-6 text-center">{text}</div>;
}
