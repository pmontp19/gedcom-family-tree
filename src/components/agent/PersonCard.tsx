import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PersonCardProps {
  props: {
    id: string;
    name: string;
    birth_year: number | null;
    death_year: number | null;
    birthplace: string | null;
    sex: 'M' | 'F' | 'U' | null;
  };
  emit: (event: string) => void;
}

export function PersonCard({ props }: PersonCardProps) {
  const { name, birth_year, death_year, birthplace, sex } = props;
  const lifespan = birth_year && death_year
    ? `${birth_year} – ${death_year}`
    : birth_year ? `b. ${birth_year}`
    : death_year ? `d. ${death_year}`
    : null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{name}</CardTitle>
          {sex && sex !== 'U' && (
            <Badge variant="secondary" className="shrink-0">
              {sex === 'M' ? 'Male' : 'Female'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-1 text-muted-foreground">
        {lifespan && <p>📅 {lifespan}</p>}
        {birthplace && <p>📍 {birthplace}</p>}
        <p className="text-xs text-muted-foreground/60 font-mono">{props.id}</p>
      </CardContent>
    </Card>
  );
}
