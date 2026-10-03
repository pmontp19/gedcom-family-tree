import { useMemo, useState } from 'react';
import { getDisplayName, getLifeYears } from '@gedcom/shared';
import { ClipboardList, MessageSquareText } from 'lucide-react';
import { useTreeStore } from '@/hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { researchGaps } from '@/services/research';

const MAX_ROWS = 100;
const MAX_CHIPS = 4;

/** Who in the current view still has gaps, the most incomplete first. */
export function ResearchDialog() {
  const { viewData, interviews, selectPerson } = useTreeStore();
  const [open, setOpen] = useState(false);

  const pending = useMemo(() => {
    if (!open || !viewData) return [];
    return [...viewData.individuals.values()]
      .map(ind => ({ ind, gaps: researchGaps(ind, viewData) }))
      .filter(p => p.gaps.length > 0)
      .sort((a, b) => b.gaps.length - a.gaps.length);
  }, [open, viewData]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Recerca" title="Pendents de recerca" className="flex items-center gap-1.5">
          <ClipboardList className="h-4 w-4" />
          <span className="hidden min-[1440px]:inline">Recerca</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pendents de recerca</DialogTitle>
          <DialogDescription>
            {pending.length === 0
              ? 'No falta res bàsic de ningú de la vista actual.'
              : `${pending.length} ${pending.length === 1 ? 'persona' : 'persones'} de la vista actual amb buits. Obre'n una i prepara'n l'entrevista.`}
          </DialogDescription>
        </DialogHeader>
        <ul className="min-h-0 overflow-y-auto space-y-2 pr-1">
          {pending.slice(0, MAX_ROWS).map(({ ind, gaps }) => {
            const answered = Object.keys(interviews[ind.id] ?? {}).length;
            return (
              <li key={ind.id}>
                <button
                  type="button"
                  onClick={() => { setOpen(false); selectPerson(ind.id); }}
                  className="w-full text-left rounded-md border p-3 hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{getDisplayName(ind)}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{getLifeYears(ind)}</span>
                    {answered > 0 && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground shrink-0" title="Respostes d'entrevista">
                        <MessageSquareText className="h-3.5 w-3.5" /> {answered}
                      </span>
                    )}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1">
                    {gaps.slice(0, MAX_CHIPS).map(g => (
                      <span key={g.key} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{g.label}</span>
                    ))}
                    {gaps.length > MAX_CHIPS && (
                      <span className="px-1 py-0.5 text-xs text-muted-foreground">+{gaps.length - MAX_CHIPS}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
