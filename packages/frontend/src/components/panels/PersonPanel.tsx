import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { GedcomData, Individual, Family, Event, Citation } from '@gedcom/shared';
import { getDisplayName, getLifeYears, formatDateLong } from '@gedcom/shared';
import {
  X, MapPin, Users, Heart, Home, Briefcase, GraduationCap, Plane, Baby, Skull,
  Church, Scale, Image as ImageIcon, BookOpen, StickyNote, Droplets, Landmark, ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { findSiblings } from '@/services/relatives';

interface PersonPanelProps {
  individual: Individual;
  data: GedcomData;
  onClose?: () => void;
  onSelectPerson?: (id: string) => void;
}

const SEX_LABELS: Record<string, string> = { M: 'Home', F: 'Dona' };

export function PersonPanel({ individual, data, onClose, onSelectPerson }: PersonPanelProps) {
  const parentFamilies = individual.famc.map(id => data.families.get(id))
    .filter((f): f is Family => !!f && !!(f.husband || f.wife));
  const spouseFamilies = individual.fams.map(id => data.families.get(id)).filter(Boolean) as Family[];
  const siblings = findSiblings(individual, data);
  const lifeYears = getLifeYears(individual);
  const sexLabel = SEX_LABELS[individual.sex ?? ''];
  const otherNames = [...new Set(individual.aliases.map(n => n.full))]
    .filter(n => n && n !== individual.name?.full);
  // Only files something resolved to a loadable URL: the rest would render broken.
  const photos = individual.media.filter((m) => m.url);

  return (
    <Card className="h-full rounded-none md:rounded-lg border-0 md:border">
      {/* Drag handle for mobile */}
      <div className="md:hidden flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
      </div>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-2 md:pt-6">
        <div className="flex items-center gap-3 min-w-0">
          {photos[0] && (
            <img
              src={photos[0].url}
              alt={getDisplayName(individual)}
              className="h-14 w-14 rounded-lg object-cover border border-border shrink-0"
            />
          )}
          <div className="min-w-0">
            <CardTitle className="text-base md:text-lg leading-tight">
              {getDisplayName(individual)}
            </CardTitle>
            {(lifeYears || sexLabel) && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {[lifeYears, sexLabel].filter(Boolean).join(' · ')}
              </p>
            )}
            {otherNames.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                També: {otherNames.join(', ')}
              </p>
            )}
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Tanca"
            className="h-9 w-9 md:h-10 md:w-10 shrink-0 ml-2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="h-[calc(60vh-120px)] md:h-[calc(100vh-200px)]">
          {/* Right padding: the overlay scrollbar would sit on top of the cards. */}
          <div className="space-y-4 pr-3">
            <EventsTimeline individual={individual} data={data} />

            {photos.length > 1 && (
              <>
                <Separator />
                <SectionHeader icon={<ImageIcon className="h-4 w-4" />} label="Fotos" />
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((m) => (
                    <img
                      key={m.url}
                      src={m.url}
                      alt={m.title ?? getDisplayName(individual)}
                      title={m.title}
                      className="aspect-square w-full rounded-md object-cover border border-border"
                    />
                  ))}
                </div>
              </>
            )}

            {parentFamilies.length > 0 && (
              <>
                <Separator />
                <SectionHeader icon={<Users className="h-4 w-4" />} label="Pares" />
                {parentFamilies.map((fam, i) => (
                  <div key={fam.id} className="space-y-1.5">
                    {/* Adoption, foster or a second record of the same birth. */}
                    {parentFamilies.length > 1 && (
                      <span className="text-xs text-muted-foreground pl-1">Família d'origen {i + 1}</span>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      {fam.husband && <RelativeCard id={fam.husband} data={data} onClick={onSelectPerson} />}
                      {fam.wife && <RelativeCard id={fam.wife} data={data} onClick={onSelectPerson} />}
                    </div>
                  </div>
                ))}
              </>
            )}

            {siblings.length > 0 && (
              <>
                <Separator />
                <SectionHeader icon={<Users className="h-4 w-4" />} label="Germans" />
                <div className="flex gap-2 flex-wrap">
                  {siblings.map(s => (
                    <RelativeCard key={s.id} id={s.id} data={data} onClick={onSelectPerson} note={s.via} />
                  ))}
                </div>
              </>
            )}

            {spouseFamilies.length > 0 && (
              <>
                <Separator />
                <SectionHeader icon={<Heart className="h-4 w-4" />} label="Família" />
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

            {individual.notes.length > 0 && (
              <>
                <Separator />
                <SectionHeader icon={<StickyNote className="h-4 w-4" />} label="Notes" />
                <div className="space-y-2">
                  {individual.notes.map((note, i) => (
                    <p key={i} className="text-sm text-muted-foreground whitespace-pre-line break-words">{note}</p>
                  ))}
                </div>
              </>
            )}

            {individual.sources.length > 0 && (
              <>
                <Separator />
                <SectionHeader icon={<BookOpen className="h-4 w-4" />} label="Fonts" />
                <ul className="space-y-2">
                  {individual.sources.map((c, i) => <SourceItem key={i} citation={c} data={data} />)}
                </ul>
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
  BIRT: 'Naixement', DEAT: 'Defunció', MARR: 'Casament', DIV: 'Divorci',
  BAPM: 'Bateig', CHR: 'Bateig', CHRA: 'Bateig d\'adult', CONF: 'Confirmació', FCOM: 'Primera comunió',
  BURI: 'Enterrament', CREM: 'Cremació', ADOP: 'Adopció', BLES: 'Benedicció', ORDN: 'Ordenació',
  BARM: 'Bar mitsvà', BASM: 'Bat mitsvà',
  RESI: 'Residència', OCCU: 'Ofici', EDUC: 'Estudis', GRAD: 'Graduació', RETI: 'Jubilació',
  IMMI: 'Immigració', EMIG: 'Emigració', NATU: 'Naturalització', CENS: 'Cens', MILI: 'Servei militar',
  PROB: 'Testamentaria', WILL: 'Testament', PROP: 'Propietat',
  DSCR: 'Descripció', NATI: 'Nacionalitat', RELI: 'Religió', TITL: 'Títol',
  EVEN: 'Esdeveniment', FACT: 'Fet',
};

function eventIcon(type: string) {
  const cls = 'h-3.5 w-3.5';
  switch (type) {
    case 'BIRT': return <Baby className={cls} />;
    case 'DEAT':
    case 'BURI':
    case 'CREM': return <Skull className={cls} />;
    case 'BAPM':
    case 'CHR':
    case 'CHRA': return <Droplets className={cls} />;
    case 'MARR':
    case 'CONF':
    case 'FCOM': return <Church className={cls} />;
    case 'DIV':  return <Scale className={cls} />;
    case 'RESI':
    case 'PROP': return <Home className={cls} />;
    case 'OCCU': return <Briefcase className={cls} />;
    case 'EDUC':
    case 'GRAD': return <GraduationCap className={cls} />;
    case 'IMMI':
    case 'EMIG': return <Plane className={cls} />;
    case 'CENS':
    case 'NATU': return <Landmark className={cls} />;
    case 'WILL':
    case 'PROB': return <ScrollText className={cls} />;
    default:     return <Heart className={cls} />;
  }
}

function EventsTimeline({ individual, data }: { individual: Individual; data: GedcomData }) {
  // Birth/death live in their own fields too; make sure they show even when
  // a parser only filled those.
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
      <SectionHeader icon={null} label="Esdeveniments" />
      <div className="relative ml-3 border-l border-border space-y-3 pl-4">
        {sorted.map((event, i) => (
          <div key={i} className="relative">
            {/* Timeline dot */}
            <span className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-muted-foreground/50 border border-background" />
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground min-w-0">
                <span className="text-muted-foreground shrink-0">{eventIcon(event.type)}</span>
                <span>{event.descriptor ?? EVENT_LABELS[event.type] ?? event.type}</span>
              </div>
              {event.date && (
                <span className="text-xs text-muted-foreground text-right shrink-0 max-w-[50%]">
                  {formatDateLong(event.date)}
                </span>
              )}
            </div>
            {event.value && (
              <p className="text-sm text-foreground/90 mt-0.5 break-words">{event.value}</p>
            )}
            {event.place && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="break-words">{event.place}</span>
              </p>
            )}
            {event.notes?.map((note, j) => (
              <p key={j} className="text-xs text-muted-foreground italic whitespace-pre-line break-words mt-1">{note}</p>
            ))}
            {event.sources && event.sources.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {event.sources.map((c, j) => (
                  <li key={j} className="text-xs text-muted-foreground flex items-start gap-1">
                    <BookOpen className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="break-words">{citationLabel(c, data)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sources ─────────────────────────────────────────────────────────────────

function citationLabel(c: Citation, data: GedcomData): string {
  const source = c.id ? data.sources.get(c.id) : undefined;
  const title = source?.title ?? c.text ?? c.id ?? 'Font sense títol';
  return c.page ? `${title}, ${c.page}` : title;
}

function SourceItem({ citation, data }: { citation: Citation; data: GedcomData }) {
  const source = citation.id ? data.sources.get(citation.id) : undefined;
  const details = [source?.author, source?.publication].filter(Boolean).join(' · ');
  return (
    <li className="text-sm">
      <p className="text-foreground break-words">{source?.title ?? citation.text ?? citation.id}</p>
      {details && <p className="text-xs text-muted-foreground break-words">{details}</p>}
      {citation.page && <p className="text-xs text-muted-foreground break-words">{citation.page}</p>}
    </li>
  );
}

// ─── Relative Card ───────────────────────────────────────────────────────────

interface RelativeCardProps {
  id: string;
  data: GedcomData;
  onClick?: (id: string) => void;
  highlight?: boolean;
  /** Small qualifier after the years, e.g. "de pare" for a half-sibling. */
  note?: string;
}

function RelativeCard({ id, data, onClick, highlight, note }: RelativeCardProps) {
  const ind = data.individuals.get(id);
  if (!ind) return null;

  const lifeYears = getLifeYears(ind);
  const genderColor =
    ind.sex === 'M' ? 'bg-blue-400' :
    ind.sex === 'F' ? 'bg-pink-400' :
    'bg-muted-foreground/40';
  const sub = [lifeYears, note].filter(Boolean).join(' · ');

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
      {sub && <p className="text-xs text-muted-foreground mt-0.5 pl-3.5">{sub}</p>}
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
        <div className="flex">
          <RelativeCard id={spouse.id} data={data} onClick={onSelectPerson} highlight />
        </div>
      )}
      {(marriageDate || divorceDate) && (
        <p className="text-xs text-muted-foreground pl-1">
          {marriageDate && `Casament: ${marriageDate}`}
          {marriageDate && divorceDate && ' · '}
          {divorceDate && `Divorci: ${divorceDate}`}
        </p>
      )}
      {family.children.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground pl-1">Fills</span>
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
