import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PathStep {
  name: string;
  relation_to_next: string | null;
}

interface RelationshipPathProps {
  props: {
    relationship: string;
    path: PathStep[];
  };
}

export function RelationshipPath({ props }: RelationshipPathProps) {
  const { relationship, path } = props;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Relationship</CardTitle>
          <Badge>{relationship}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1">
          {path.map((step, i) => (
            <div key={i} className="flex flex-col items-start">
              <div className="px-3 py-1.5 rounded-md bg-muted text-sm font-medium">
                {step.name}
              </div>
              {i < path.length - 1 && (
                <div className="flex items-center gap-1 my-1 ml-3 text-xs text-muted-foreground">
                  <span>↓</span>
                  {step.relation_to_next && <span>{step.relation_to_next}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
