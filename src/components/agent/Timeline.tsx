import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TimelineEvent {
  type: string;
  year: number | null;
  place: string | null;
  description: string | null;
}

interface TimelineProps {
  props: {
    name: string;
    events: TimelineEvent[];
  };
}

const EVENT_ICONS: Record<string, string> = {
  Birth: '🟢',
  Death: '⚫',
  Marriage: '💍',
  Divorce: '📄',
  Residence: '🏠',
  Occupation: '💼',
  Education: '🎓',
  Immigration: '🚢',
  Emigration: '✈️',
  Baptism: '✝️',
  Burial: '🪦',
  Census: '📋',
  Military: '🎖️',
};

export function Timeline({ props }: TimelineProps) {
  const { name, events } = props;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Timeline: {name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-4 space-y-3">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border ml-1.5" />
          {events.map((ev, i) => (
            <div key={i} className="relative flex gap-3 text-sm">
              <div className="absolute -left-4 flex h-3 w-3 items-center justify-center rounded-full bg-background border border-border mt-0.5" />
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span>{EVENT_ICONS[ev.type] ?? '📌'}</span>
                  <span className="font-medium">{ev.type}</span>
                  {ev.year && <span className="text-muted-foreground text-xs">{ev.year}</span>}
                </div>
                {ev.place && <p className="text-muted-foreground text-xs ml-5">📍 {ev.place}</p>}
                {ev.description && <p className="text-muted-foreground text-xs ml-5">{ev.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
