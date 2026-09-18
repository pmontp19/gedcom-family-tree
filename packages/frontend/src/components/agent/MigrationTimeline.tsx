import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MigrationStep {
  year: number | null;
  place: string;
  personName: string;
  event: string;
}

interface MigrationTimelineProps {
  props: {
    rootName: string;
    steps: MigrationStep[];
  };
}

const EVENT_LABELS: Record<string, string> = {
  BIRT: 'Born',
  DEAT: 'Died',
  MARR: 'Married',
  DIV: 'Divorced',
  RESI: 'Lived',
  IMMI: 'Immigrated',
  EMIG: 'Emigrated',
  NATU: 'Naturalized',
  CENS: 'Census',
  BURI: 'Buried',
  BAPM: 'Baptized',
  OCCU: 'Worked',
  EDUC: 'Studied',
  MILI: 'Served',
};

export function MigrationTimeline({ props }: MigrationTimelineProps) {
  const { rootName, steps } = props;
  const places = new Set(steps.map(s => s.place));

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Migration: {rootName}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {steps.length} placed {steps.length === 1 ? 'event' : 'events'} across {places.size}{' '}
          {places.size === 1 ? 'place' : 'places'}
        </p>
      </CardHeader>
      <CardContent>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events with a place recorded.</p>
        ) : (
          <div className="relative pl-4 space-y-3">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border ml-1.5" />
            {steps.map((step, i) => (
              <div key={i} className="relative flex gap-3 text-sm">
                <div className="absolute -left-4 flex h-3 w-3 items-center justify-center rounded-full bg-background border border-border mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="w-14 shrink-0 tabular-nums text-xs text-muted-foreground">{step.year ?? 'undated'}</span>
                    <span className="font-medium truncate">📍 {step.place}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <Badge variant="outline" className="mr-1.5 text-xs">
                      {EVENT_LABELS[step.event] ?? step.event}
                    </Badge>
                    {step.personName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
