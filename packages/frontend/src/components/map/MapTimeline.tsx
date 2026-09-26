import { useMemo } from 'react';
import { Pause, Play, SkipBack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { eventLabel, histogram, type MapEvent } from '@/visualization/map-events';

const SPEEDS = [1, 5, 10, 25];

interface MapTimelineProps {
  events: MapEvent[];
  min: number;
  max: number;
  year: number;
  playing: boolean;
  speed: number;
  /** Events this recent (in years) count as "happening now". */
  window: number;
  onYearChange: (year: number) => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onSelectPerson: (id: string) => void;
}

export function MapTimeline({
  events, min, max, year, playing, speed, window,
  onYearChange, onTogglePlay, onSpeedChange, onSelectPerson,
}: MapTimelineProps) {
  const bucketSize = Math.max(1, Math.ceil((max - min + 1) / 80));
  const buckets = useMemo(() => histogram(events, min, max, bucketSize), [events, min, max, bucketSize]);
  const peak = Math.max(1, ...buckets);

  // Newest first: what just happened is what the eye looks for.
  const recent = useMemo(
    () => events.filter(e => e.year <= year && e.year > year - window).slice(-5).reverse(),
    [events, year, window],
  );

  return (
    <div className="absolute inset-x-2 bottom-2 md:inset-x-4 md:bottom-4 z-[1000] rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg p-3 space-y-2">
      <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => onYearChange(min)} title="Back to start">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={onTogglePlay} title={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <div className="text-2xl font-semibold tabular-nums w-16 text-center shrink-0">{year}</div>

        <div className="relative order-last basis-full md:order-none md:basis-auto md:flex-1 min-w-0 h-11">
          {/* Event density behind the slider: where the story is busy. */}
          <div className="absolute inset-x-1 top-0 h-6 flex items-end gap-px pointer-events-none" aria-hidden>
            {buckets.map((count, i) => {
              const bucketYear = min + i * bucketSize;
              return (
                <div
                  key={i}
                  className={bucketYear <= year ? 'flex-1 bg-primary/60 rounded-t-sm' : 'flex-1 bg-muted-foreground/20 rounded-t-sm'}
                  style={{ height: `${count ? Math.max(8, (count / peak) * 100) : 0}%` }}
                />
              );
            })}
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={year}
            onChange={e => onYearChange(Number(e.target.value))}
            className="absolute inset-x-0 bottom-0 w-full accent-primary cursor-pointer"
            aria-label="Year"
          />
        </div>

        <select
          value={speed}
          onChange={e => onSpeedChange(Number(e.target.value))}
          className="h-9 rounded-md border bg-background px-2 text-sm shrink-0 ml-auto md:ml-0"
          title="Years per second"
        >
          {SPEEDS.map(s => <option key={s} value={s}>{s} yr/s</option>)}
        </select>
      </div>

      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums px-1 -mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>

      <ul className="flex gap-2 overflow-x-auto text-xs min-h-6 pb-0.5">
        {recent.length === 0 && <li className="text-muted-foreground italic py-1">No events around {year}</li>}
        {recent.map(ev => (
          <li key={ev.key} className="shrink-0 rounded-full border bg-muted/50 px-2.5 py-1 flex items-center gap-1.5">
            <span className="tabular-nums text-muted-foreground">{ev.year}</span>
            <span className="font-medium">{eventLabel(ev.type)}</span>
            {ev.people.map((p, i) => (
              <span key={p.id}>
                {i > 0 && <span className="text-muted-foreground">&amp; </span>}
                <button className="underline-offset-2 hover:underline" onClick={() => onSelectPerson(p.id)}>
                  {p.name}
                </button>
              </span>
            ))}
            <span className="text-muted-foreground truncate max-w-40">· {ev.place}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
