import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { GedcomData, Individual, Family, Event } from '@gedcom/shared';
import { getDisplayName, getLifeYears, formatDateLong } from '@gedcom/shared';
import {
  X, MapPin, Users, Heart, Home, Briefcase, GraduationCap,
  Plane, Baby, Skull, Church, Scale
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PersonPanelProps {
  individual: Individual;
  data: GedcomData;
  onClose?: () => void;
  onSelectPerson?: (id: string) => void;
}

export function PersonPanel({ individual, data, onClose, onSelectPerson }: PersonPanelProps) {
  const parents = individual.famc ? data.families.get(individual.famc) : null;
  const spouseFamilies = individual.fams.map(id => data.families.get(id)).filter(Boolean) as Family[];
  const lifeYears = getLifeYears(individual);
  const genderLabel = individual.sex === 'M' ? 'Male' : individual.sex === 'F' ? 'Female' : null;

  return (
    <Card className="h-full rounded-none md:rounded-lg border-0 md:border">
      {/* Drag handle for mobile */}
      <div className="md:hidden flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
      </div>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-2 md:pt-6">
        <div className="min-w-0">
          <CardTitle className="text-base md:text-lg leading-tight">
            {getDisplayName(individual)}
          </CardTitle>
          {(lifeYears || genderLabel) && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {[lifeYears, genderLabel].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 md:h-10 md:w-10 shrink-0 ml-2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="h-[calc(60vh-120px)] md:h-[calc(100vh-200px)]">
          <div className="space-y-4">
            <EventsTimeline individual={individual} />

            {parents && (parents.husband || parents.wife) && (
              <>
                <Separator />
                <SectionHeader icon={<Users className="h-4 w-4" />} label="Parents" />
                <div className="flex gap-2 flex-wrap">
                  {parents.husband && (
                    <RelativeCard id={parents.husband} data={data} onClick={onSelectPerson} />
                  )}
                  {parents.wife && (
                    <RelativeCard id={parents.wife} data={data} onClick={onSelectPerson} />
                  )}
                </div>
              </>
            )}

            {spouseFamilies.length > 0 && (
              <>
                <Separator />
                <SectionHeader icon={<Heart className="h-4 w-4" />} label="Family" />
                {spouseFamilies.map((fam) => (
                  <FamilySection
                    key={fam.id}
                    family={fam}
                    individualId={individual.id}
                    data={data}
                    onSelectPerson={onSelectPerson}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h4 className="font-medium text-sm flex items-center gap-1.5 text-foreground">
      {icon}
      {label}
    </h4>
  );
}

// ─── Events Timeline ────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  BIRT: 'Birth', DEAT: 'Death', MARR: 'Marriage', DIV: 'Divorce',
  RESI: 'Residence', OCCU: 'Occupation', EDUC: 'Education',
  IMMI: 'Immigration', EMIG: 'Emigration',
};

function eventIcon(type: string) {
  const cls = 'h-3.5 w-3.5';
  switch (type) {
    case 'BIRT': return <Baby className={cls} />;
    case 'DEAT': return <Skull className={cls} />;
    case 'MARR': return <Church className={cls} />;
    case 'DIV':  return <Scale className={cls} />;
    case 'RESI': return <Home className={cls} />;
    case 'OCCU': return <Briefcase className={cls} />;
    case 'EDUC': return <GraduationCap className={cls} />;
    case 'IMMI':
    case 'EMIG': return <Plane className={cls} />;
    default:     return <Heart className={cls} />;
  }
}

function EventsTimeline({ individual }: { individual: Individual }) {
  // Collect all events (birth/death are stored separately but also in events array in most parsers;
  // deduplicate by ensuring birth/death are included)
  const allEvents: Event[] = [...individual.events];
  if (individual.birth && !allEvents.some(e => e.type === 'BIRT')) {
    allEvents.unshift(individual.birth);
  }
  if (individual.death && !allEvents.some(e => e.type === 'DEAT')) {
    allEvents.push(individual.death);
  }

  if (allEvents.length === 0) return null;

  const sorted = [...allEvents].sort((a, b) => {
    const ay = a.date?.year ?? Infinity;
    const by = b.date?.year ?? Infinity;
    return ay - by;
  });

  return (
    <div className="space-y-2">
      <SectionHeader icon={null} label="Life Events" />
      <div className="relative ml-3 border-l border-border space-y-3 pl-4">
        {sorted.map((event, i) => (
          <div key={i} className="relative">
            {/* Timeline dot */}
            <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-muted-foreground/50 border border-background" />
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground min-w-0">
                <span className="text-muted-foreground shrink-0">{eventIcon(event.type)}</span>
                <span>{EVENT_LABELS[event.type] ?? event.type}</span>
              </div>
              {event.date && (
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDateLong(event.date)}
                </span>
              )}
            </div>
            {event.place && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="break-words">{event.place}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Relative Card ───────────────────────────────────────────────────────────

interface RelativeCardProps {
  id: string;
  data: GedcomData;
  onClick?: (id: string) => void;
  highlight?: boolean;
}

function RelativeCard({ id, data, onClick, highlight }: RelativeCardProps) {
  const ind = data.individuals.get(id);
  if (!ind) return null;

  const lifeYears = getLifeYears(ind);
  const genderColor =
    ind.sex === 'M' ? 'bg-blue-400' :
    ind.sex === 'F' ? 'bg-pink-400' :
    'bg-muted-foreground/40';

  return (
    <button
      onClick={() => onClick?.(id)}
      className={`flex-1 min-w-[120px] text-left rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground touch-manipulation ${
        highlight ? 'bg-muted border-muted-foreground/20' : 'bg-card border-border'
      }`}
    >
      <div className="flex items-center gap-1.5 font-medium leading-snug">
        <span className={`w-2 h-2 rounded-full shrink-0 ${genderColor}`} />
        <span className="truncate">{getDisplayName(ind)}</span>
      </div>
      {lifeYears && (
        <p className="text-xs text-muted-foreground mt-0.5 pl-3.5">{lifeYears}</p>
      )}
    </button>
  );
}

// ─── Family Section ──────────────────────────────────────────────────────────

interface FamilySectionProps {
  family: Family;
  individualId: string;
  data: GedcomData;
  onSelectPerson?: (id: string) => void;
}

function FamilySection({ family, individualId, data, onSelectPerson }: FamilySectionProps) {
  const spouseId = family.husband === individualId ? family.wife : family.husband;
  const spouse = spouseId ? data.individuals.get(spouseId) : null;

  const marriageDate = family.marriage?.date ? formatDateLong(family.marriage.date) : null;
  const divorceDate = family.divorce?.date ? formatDateLong(family.divorce.date) : null;

  return (
    <div className="space-y-2">
      {spouse && (
        <RelativeCard id={spouse.id} data={data} onClick={onSelectPerson} highlight />
      )}
      {(marriageDate || divorceDate) && (
        <p className="text-xs text-muted-foreground pl-1">
          {marriageDate && `m. ${marriageDate}`}
          {divorceDate && ` · div. ${divorceDate}`}
        </p>
      )}
      {family.children.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground pl-1">Children</span>
          <div className="flex flex-wrap gap-2">
            {family.children.map(childId => (
              <RelativeCard key={childId} id={childId} data={data} onClick={onSelectPerson} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
