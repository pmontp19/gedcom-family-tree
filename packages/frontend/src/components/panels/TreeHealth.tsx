import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, ChevronRight } from 'lucide-react';
import { useTreeStore } from '@/hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { GedlintGroup } from '@/services/gedlint';

const SEVERITY_ORDER = ['error', 'warning', 'info'];

const SEVERITY_STYLE: Record<string, string> = {
  error: 'text-destructive border-destructive/40 bg-destructive/10',
  warning: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
  info: 'text-sky-600 dark:text-sky-400 border-sky-500/40 bg-sky-500/10',
};

const SEVERITY_LABEL: Record<string, string> = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Recommendations',
};

function RuleRow({ group }: { group: GedlintGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 p-3 text-left hover:bg-muted/50 rounded-md"
      >
        <ChevronRight
          className={`h-4 w-4 mt-0.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <code className="text-xs font-mono font-semibold">{group.code}</code>
            <span className="text-xs text-muted-foreground truncate">{group.rule_name}</span>
          </span>
          <span className="block text-sm mt-0.5">{group.title}</span>
        </span>
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums mt-0.5">
          &times;{group.count}
        </span>
      </button>
      {open && (group.why || group.remedy) && (
        <div className="px-3 pb-3 pl-9 space-y-2 text-sm text-muted-foreground">
          {group.why && (
            <p>
              <span className="font-semibold text-foreground">Why. </span>
              {group.why}
            </p>
          )}
          {group.remedy && (
            <p>
              <span className="font-semibold text-foreground">Remedy. </span>
              {group.remedy}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function TreeHealth() {
  const { lintResult, linting } = useTreeStore();

  if (linting) {
    return (
      <Button variant="outline" size="sm" disabled className="flex items-center gap-1.5">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Checking…</span>
      </Button>
    );
  }

  if (!lintResult) return null;

  const { errors, warnings, infos } = lintResult.summary;
  const healthy = errors === 0 && warnings === 0;
  const counts = { error: errors, warning: warnings, info: infos };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`flex items-center gap-1.5 ${healthy ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40' : errors > 0 ? 'text-destructive border-destructive/40' : 'text-amber-600 dark:text-amber-400 border-amber-500/40'}`}
        >
          {healthy ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          <span className="hidden sm:inline">Tree Health</span>
          <span className="text-xs font-semibold tabular-nums">
            {healthy ? 'Healthy' : `${errors + warnings}`}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tree Health</DialogTitle>
          <DialogDescription>
            gedlint checked the GEDCOM file for structural errors, suspicious data and upgrade notes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {SEVERITY_ORDER.map((severity) => (
            <div
              key={severity}
              className={`rounded-md border p-3 ${SEVERITY_STYLE[severity]}`}
            >
              <div className="text-2xl font-semibold tabular-nums">{counts[severity as keyof typeof counts]}</div>
              <div className="text-xs">{SEVERITY_LABEL[severity]}</div>
            </div>
          ))}
        </div>

        {lintResult.groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No issues found. This file is clean.
          </p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
            {SEVERITY_ORDER.map((severity) => {
              const groups = lintResult.groups.filter((g) => g.severity === severity);
              if (!groups.length) return null;
              return (
                <section key={severity} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {SEVERITY_LABEL[severity]}
                  </h3>
                  <ul className="space-y-2">
                    {groups.map((group) => (
                      <RuleRow key={group.code} group={group} />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
