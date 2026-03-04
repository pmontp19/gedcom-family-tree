import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { GedcomData, Individual, Family } from '@/models';
import { getDisplayName, getLifeYears } from '@/models/individual';
import { formatGedcomDate } from '@/parser/utils/date-parser';
import { Calendar, MapPin, Users, Heart, X } from 'lucide-react';
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

  return (
    <Card className="h-full rounded-none md:rounded-lg border-0 md:border">
      {/* Drag handle for mobile */}
      <div className="md:hidden flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
      </div>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 px-4 pt-2 md:pt-6">
        <CardTitle className="text-base md:text-lg">
          {getDisplayName(individual)}
        </CardTitle>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 md:h-10 md:w-10 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="h-[calc(60vh-120px)] md:h-[calc(100vh-200px)]">
          {/* Basic Info */}
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{getLifeYears(individual) || 'No dates'}</span>
            </div>

            {individual.sex && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{individual.sex === 'M' ? 'Male' : individual.sex === 'F' ? 'Female' : 'Unknown'}</span>
              </div>
            )}

            {/* Birth */}
            {individual.birth && (
              <div className="space-y-1">
                <h4 className="font-medium text-sm">Birth</h4>
                {individual.birth.date && (
                  <p className="text-sm text-muted-foreground">
                    {formatGedcomDate(individual.birth.date)}
                  </p>
                )}
                {individual.birth.place && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="break-words">{individual.birth.place}</span>
                  </p>
                )}
              </div>
            )}

            {/* Death */}
            {individual.death && (
              <div className="space-y-1">
                <h4 className="font-medium text-sm">Death</h4>
                {individual.death.date && (
                  <p className="text-sm text-muted-foreground">
                    {formatGedcomDate(individual.death.date)}
                  </p>
                )}
                {individual.death.place && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="break-words">{individual.death.place}</span>
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Parents */}
            {parents && (parents.husband || parents.wife) && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Parents
                </h4>
                {parents.husband && (
                  <PersonLink
                    id={parents.husband}
                    data={data}
                    onClick={onSelectPerson}
                  />
                )}
                {parents.wife && (
                  <PersonLink
                    id={parents.wife}
                    data={data}
                    onClick={onSelectPerson}
                  />
                )}
              </div>
            )}

            {/* Spouses & Children */}
            {spouseFamilies.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-1">
                  <Heart className="h-4 w-4" />
                  Family
                </h4>
                {spouseFamilies.map((fam) => (
                  <FamilySection
                    key={fam.id}
                    family={fam}
                    individualId={individual.id}
                    data={data}
                    onSelectPerson={onSelectPerson}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface PersonLinkProps {
  id: string;
  data: GedcomData;
  onClick?: (id: string) => void;
}

function PersonLink({ id, data, onClick }: PersonLinkProps) {
  const ind = data.individuals.get(id);
  if (!ind) return null;

  return (
    <button
      className="text-sm text-primary hover:underline block text-left py-1 touch-manipulation min-h-[44px] flex items-center"
      onClick={() => onClick?.(id)}
    >
      {getDisplayName(ind)}
    </button>
  );
}

interface FamilySectionProps {
  family: Family;
  individualId: string;
  data: GedcomData;
  onSelectPerson?: (id: string) => void;
}

function FamilySection({ family, individualId, data, onSelectPerson }: FamilySectionProps) {
  const spouseId = family.husband === individualId ? family.wife : family.husband;
  const spouse = spouseId ? data.individuals.get(spouseId) : null;

  return (
    <div className="pl-2 border-l-2 border-muted space-y-2">
      {spouse && (
        <div>
          <span className="text-xs text-muted-foreground">Spouse: </span>
          <PersonLink id={spouse.id} data={data} onClick={onSelectPerson} />
        </div>
      )}

      {family.marriage?.date && (
        <p className="text-xs text-muted-foreground">
          m. {formatGedcomDate(family.marriage.date)}
          {family.divorce && ` - div. ${formatGedcomDate(family.divorce.date)}`}
        </p>
      )}

      {family.children.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground">Children:</span>
          <div className="pl-2 space-y-1">
            {family.children.map(childId => (
              <PersonLink
                key={childId}
                id={childId}
                data={data}
                onClick={onSelectPerson}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
