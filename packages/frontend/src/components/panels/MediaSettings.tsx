import { useRef, useState, useEffect } from 'react';
import { useMediaStore } from '@/hooks/useMediaStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderOpen, Images, Link2, X } from 'lucide-react';

interface MediaSettingsProps {
  onClose: () => void;
}

export function MediaSettings({ onClose }: MediaSettingsProps) {
  const { indexedCount, mediaBase, addFiles, setMediaBase } = useMediaStore();
  const [baseInput, setBaseInput] = useState(mediaBase ?? '');
  const folderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    addFiles(files.map((file) => ({
      file,
      // webkitRelativePath is like "actes/documents_familiars/x.jpg" when selecting a folder
      path: file.webkitRelativePath || file.name,
    })));
    if (folderRef.current) folderRef.current.value = '';
  };

  return (
    <>
      {/* Click-away layer */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-full mt-1 right-0 z-50 w-80 rounded-lg border border-border bg-background shadow-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm flex items-center gap-1.5">
            <Images className="h-4 w-4" />
            Fotos i documents
          </h4>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            Carpeta d'imatges local
          </label>
          <label>
            <input
              ref={folderRef}
              type="file"
              multiple
              onChange={handleFolderChange}
              className="hidden"
              // @ts-expect-error non-standard but widely supported
              webkitdirectory=""
              directory=""
            />
            <Button variant="outline" size="sm" className="w-full" asChild>
              <span className="cursor-pointer">Triar carpeta (p. ex. actes/)</span>
            </Button>
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            O servidor HTTP (base URL)
          </label>
          <div className="flex gap-1.5">
            <Input
              value={baseInput}
              onChange={(e) => setBaseInput(e.target.value)}
              placeholder="http://localhost:8080"
              className="h-8 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              onClick={() => {
                const trimmed = baseInput.trim();
                setMediaBase(trimmed || null);
                onClose();
              }}
            >
              Desa
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Serveix la carpeta amb <code>python3 -m http.server 8080</code> des de l'arrel del projecte.
          </p>
        </div>

        <p className="text-xs text-muted-foreground border-t pt-2">
          {indexedCount > 0
            ? `${indexedCount} fitxers indexats localment`
            : 'Sense imatges indexades. Pots arrossegar la carpeta d\'imatges directament sobre l\'arbre.'}
        </p>
      </div>
    </>
  );
}
