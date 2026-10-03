import { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readGedzip } from '@/services/gedzip';
import { decodeGedcom } from '@gedcom/parser';
import type { OpenedPackage } from '@/services/story-package';

interface FileUploadProps {
  onFileLoad: (
    content: string,
    filename: string,
    bytes: ArrayBuffer,
    media?: Map<string, string>,
  ) => void;
  onPackageLoad: (pkg: OpenedPackage, filename: string) => void;
}

export function FileUpload({ onFileLoad, onPackageLoad }: FileUploadProps) {
  const readFile = useCallback(async (file: File) => {
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        const { readPackage } = await import('@/services/story-package');
        onPackageLoad(await readPackage(file), file.name);
        return;
      }
      if (file.name.toLowerCase().endsWith('.gdz')) {
        const { text, bytes, media } = await readGedzip(file);
        onFileLoad(text, file.name, bytes, media);
        return;
      }
      // Read bytes, not text: gedlint's encoding rules only fire on the
      // original bytes, and decoding first would silently repair them.
      const bytes = await file.arrayBuffer();
      onFileLoad(decodeGedcom(bytes), file.name, bytes);
    } catch (err) {
      console.error('Failed to read file:', err);
      alert(`No s'ha pogut llegir ${file.name}`);
    }
  }, [onFileLoad, onPackageLoad]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  }, [readFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void readFile(file);
  }, [readFile]);

  return (
    <div
      className="flex flex-col items-center justify-center h-full border-2 border-dashed border-muted-foreground/25 rounded-lg p-8"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">Puja un fitxer GEDCOM</h3>
      <p className="text-sm text-muted-foreground text-center mb-4">
        Arrossega aquí un fitxer .ged o .gdz, o una història (.historia.zip), o fes clic per triar-lo
      </p>
      <label>
        <input
          type="file"
          accept=".ged,.gdz,.zip"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button variant="outline" asChild>
          <span className="cursor-pointer">
            <FileText className="h-4 w-4 mr-2" />
            Tria un fitxer
          </span>
        </Button>
      </label>
    </div>
  );
}
