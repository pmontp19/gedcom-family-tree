import { useState, useMemo, useCallback } from 'react';
import type { GedcomData } from '@gedcom/shared';
import { getDisplayName, getLifeYears } from '@gedcom/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Search } from 'lucide-react';

interface FocusSelectorProps {
  data: GedcomData;
  onSelect: (id: string, generations: number) => void;
  onViewAll: () => void;
}

const MAX_RESULTS = 20;

export function FocusSelector({ data, onSelect, onViewAll }: FocusSelectorProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generations, setGenerations] = useState(4);

  const individuals = useMemo(() =>
    Array.from(data.individuals.values()).map(ind => ({
      id: ind.id,
      name: getDisplayName(ind),
      years: getLifeYears(ind),
    })),
    [data]
  );

  const matches = useMemo(() => {
    if (!query.trim()) return individuals;
    const q = query.toLowerCase();
    return individuals.filter(i => i.name.toLowerCase().includes(q));
  }, [query, individuals]);
  const filtered = useMemo(() => matches.slice(0, MAX_RESULTS), [matches]);

  const handleSubmit = useCallback(() => {
    if (selectedId) onSelect(selectedId, generations);
  }, [selectedId, generations, onSelect]);

  const isSmallTree = data.individuals.size <= 200;

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Tria la persona central</h2>
        <p className="text-sm text-muted-foreground">
          {data.individuals.size.toLocaleString('ca')} {data.individuals.size === 1 ? 'persona carregada' : 'persones carregades'}. Tria la persona central i quantes generacions vols mostrar.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per nom..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Results list */}
      <div className="border rounded-lg max-h-[max(15rem,calc(100dvh-31rem))] overflow-y-auto">
        {filtered.map(ind => (
          <button
            key={ind.id}
            onClick={() => setSelectedId(ind.id)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-b-0
              ${selectedId === ind.id ? 'bg-accent font-medium' : ''}`}
          >
            <span>{ind.name}</span>
            {ind.years && <span className="text-muted-foreground ml-2 text-xs">{ind.years}</span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground text-center">Cap resultat</p>
        )}
      </div>
      {matches.length > filtered.length && (
        <p className="text-xs text-muted-foreground -mt-4">
          Es mostren {filtered.length} de {matches.length.toLocaleString('ca')}. Escriu per afinar la cerca.
        </p>
      )}

      {/* Generation slider */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Generacions: {generations}</span>
          <span className="text-muted-foreground">1–10</span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          value={generations}
          onChange={e => setGenerations(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSubmit} disabled={!selectedId} className="flex-1">
          <Users className="h-4 w-4 mr-2" />
          Mostra l'arbre
        </Button>
        {isSmallTree && (
          <Button variant="outline" onClick={onViewAll}>
            Mostra-ho tot
          </Button>
        )}
      </div>
    </div>
  );
}
