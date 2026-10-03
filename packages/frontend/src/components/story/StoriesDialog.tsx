import { useState } from 'react';
import { BookOpen, Play, Download, Trash2, Upload, Package } from 'lucide-react';
import { useTreeStore } from '@/hooks';
import type { Story } from '@gedcom/shared/story';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

export function StoriesDialog() {
  const { stories, data, saveStory, deleteStory, playStory } = useTreeStore();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importFile = async (file: File) => {
    try {
      const { parseStory } = await import('@/services/stories');
      await saveStory(parseStory(await file.text()));
      setError(null);
    } catch (err) {
      console.error('Failed to import story:', err);
      setError(`${file.name} no és una història vàlida`);
    }
  };

  const share = async (story: Story) => {
    if (!data) return;
    try {
      const [{ buildPackage }, { downloadBlob, slugify }] = await Promise.all([
        import('@/services/story-package'), import('@/services/stories'),
      ]);
      downloadBlob(await buildPackage(story, data), `${slugify(story.title)}.historia.zip`);
    } catch (err) {
      console.error('Failed to build story package:', err);
      setError(`No s'ha pogut crear el paquet de «${story.title}»`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Històries" title="Històries" className="flex items-center gap-1.5">
          <BookOpen className="h-4 w-4" />
          <span className="hidden min-[1440px]:inline">Històries</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Històries</DialogTitle>
          <DialogDescription>
            Recorreguts guiats per la família per compartir: relat, arbre, fotos i documents, pas a pas.
            El paquet per compartir només porta les persones i les fotos de la història.
          </DialogDescription>
        </DialogHeader>

        {stories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Encara no hi ha cap història. Importa'n una o demana-la a la IA.
          </p>
        ) : (
          <ul className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
            {stories.map((story) => (
              <li key={story.id} className="flex items-center gap-2 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{story.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[story.subtitle, `${story.steps.length} ${story.steps.length === 1 ? 'pas' : 'passos'}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button size="sm" onClick={() => { setOpen(false); playStory(story); }} className="gap-1.5">
                  <Play className="h-3.5 w-3.5" /> Mira
                </Button>
                <Button variant="ghost" size="icon" onClick={() => void share(story)} aria-label={`Paquet per compartir ${story.title}`} title="Paquet per compartir (.historia.zip)">
                  <Package className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => void import('@/services/stories').then(m => m.exportStory(story))} aria-label={`Exporta ${story.title}`} title="Exporta la història (.historia.json)">
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { if (confirm(`Vols esborrar «${story.title}»?`)) void deleteStory(story.id); }}
                  aria-label={`Esborra ${story.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <label className="self-start">
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = '';
            }}
          />
          <Button variant="outline" size="sm" asChild>
            <span className="cursor-pointer gap-1.5"><Upload className="h-4 w-4" /> Importa una història</span>
          </Button>
        </label>
      </DialogContent>
    </Dialog>
  );
}
