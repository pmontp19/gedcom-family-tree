import { useState } from 'react';
import type { GedcomData, Individual } from '@gedcom/shared';
import { getDisplayName } from '@gedcom/shared';
import { Copy, Check } from 'lucide-react';
import { useTreeStore } from '@/hooks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { interviewQuestions, interviewText, type Question } from '@/services/research';
import { AI_ENABLED } from '@/config';

interface InterviewDialogProps {
  individual: Individual;
  data: GedcomData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InterviewDialog({ individual, data, open, onOpenChange }: InterviewDialogProps) {
  const { interviews, saveAnswer } = useTreeStore();
  const answers = interviews[individual.id] ?? {};
  const questions = interviewQuestions(individual, data);
  // Typed text waits here; it is saved on blur and when the dialog closes,
  // not per keystroke (each save also reaches the AI backend).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const save = (q: Question) => {
    const draft = drafts[q.key];
    if (draft !== undefined && draft !== (answers[q.key]?.answer ?? '')) saveAnswer(individual.id, q.key, q.question, draft);
  };

  const close = (next: boolean) => {
    if (!next) {
      questions.forEach(save);
      setDrafts({});
    }
    onOpenChange(next);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(interviewText(individual, data, answers));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const section = (title: string, ask: Question['ask']) => {
    const items = questions.filter(q => q.ask === ask);
    if (items.length === 0) return null;
    return (
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {items.map(q => (
          <div key={q.key} className="space-y-1.5">
            <label htmlFor={`q-${q.key}`} className="text-sm font-medium block">{q.question}</label>
            <textarea
              id={`q-${q.key}`}
              rows={2}
              value={drafts[q.key] ?? answers[q.key]?.answer ?? ''}
              onChange={(e) => setDrafts(d => ({ ...d, [q.key]: e.target.value }))}
              onBlur={() => save(q)}
              placeholder={ask === 'family' ? 'Resposta…' : 'Què has trobat…'}
              className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
        ))}
      </section>
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Entrevista sobre {getDisplayName(individual)}</DialogTitle>
          <DialogDescription>
            Preguntes a partir del que l'arbre encara no sap. Les respostes es desen en aquest navegador
            {AI_ENABLED ? ' i la IA les fa servir per escriure històries.' : '.'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto space-y-6 pr-1">
          {section('Per preguntar a la família', 'family')}
          {section("Per buscar a l'arxiu", 'archive')}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => void copy()} className="gap-1.5">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiat' : 'Copia com a text'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
