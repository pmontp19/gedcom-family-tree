import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface PersonRef {
  id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  birthplace: string | null;
  sex: 'M' | 'F' | 'U' | null;
}

interface FamilyGroupProps {
  props: {
    father: PersonRef | null;
    mother: PersonRef | null;
    children: PersonRef[];
    marriage_year: number | null;
  };
}

function PersonRow({ person }: { person: PersonRef }) {
  const years = person.birth_year && person.death_year
    ? `${person.birth_year}–${person.death_year}`
    : person.birth_year ? `n. ${person.birth_year}` : '';
  return (
    <div className="flex justify-between text-sm">
      <span className="font-medium">{person.name}</span>
      {years && <span className="text-muted-foreground text-xs">{years}</span>}
    </div>
  );
}

export function FamilyGroup({ props }: FamilyGroupProps) {
  const { father, mother, children, marriage_year } = props;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          Família {marriage_year ? `(cas. ${marriage_year})` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Pares</p>
          {father && <PersonRow person={father} />}
          {mother && <PersonRow person={mother} />}
          {!father && !mother && <p className="text-sm text-muted-foreground">Desconeguts</p>}
        </div>
        {children.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Fills ({children.length})</p>
              {children.map(child => <PersonRow key={child.id} person={child} />)}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
