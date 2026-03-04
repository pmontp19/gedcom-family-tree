import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Stat {
  label: string;
  value: string | number;
  unit: string | null;
}

interface StatsGridProps {
  props: { stats: Stat[] };
}

export function StatsGrid({ props }: StatsGridProps) {
  const { stats } = props;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="flex flex-col p-2 rounded-md bg-muted/50">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className="text-lg font-semibold">
                {stat.value}
                {stat.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{stat.unit}</span>}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
