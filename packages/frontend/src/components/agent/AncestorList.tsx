import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AncestorItem {
  id: string;
  name: string;
  birth_year: number | null;
  death_year: number | null;
  birthplace: string | null;
  sex: 'M' | 'F' | 'U' | null;
  generation: number;
  relation: string;
}

interface AncestorListProps {
  props: { items: AncestorItem[] };
}

export function AncestorList({ props }: AncestorListProps) {
  const { items } = props;
  const byGen = new Map<number, AncestorItem[]>();
  for (const item of items) {
    const g = byGen.get(item.generation) ?? [];
    g.push(item);
    byGen.set(item.generation, g);
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Ancestors ({items.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from(byGen.entries()).sort(([a], [b]) => a - b).map(([gen, people]) => (
          <div key={gen}>
            <p className="text-xs font-medium text-muted-foreground mb-1">Generation {gen}</p>
            <div className="space-y-1">
              {people.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="outline" className="ml-2 text-xs">{p.relation}</Badge>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {p.birth_year && p.death_year
                      ? `${p.birth_year}–${p.death_year}`
                      : p.birth_year ? `b. ${p.birth_year}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
