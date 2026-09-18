import { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFileLoad: (content: string, filename: string, bytes: ArrayBuffer) => void;
}

export function FileUpload({ onFileLoad }: FileUploadProps) {
  const readFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      // Read bytes, not text: gedlint's encoding rules only fire on the
      // original bytes, and decoding first would silently repair them.
      const bytes = e.target?.result as ArrayBuffer;
      onFileLoad(new TextDecoder('utf-8').decode(bytes), file.name, bytes);
    };
    reader.readAsArrayBuffer(file);
  }, [onFileLoad]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, [readFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }, [readFile]);

  return (
    <div
      className="flex flex-col items-center justify-center h-full border-2 border-dashed border-muted-foreground/25 rounded-lg p-8"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <Upload className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">Upload GEDCOM File</h3>
      <p className="text-sm text-muted-foreground text-center mb-4">
        Drag and drop a .ged file here, or click to select
      </p>
      <label>
        <input
          type="file"
          accept=".ged"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button variant="outline" asChild>
          <span className="cursor-pointer">
            <FileText className="h-4 w-4 mr-2" />
            Select File
          </span>
        </Button>
      </label>
    </div>
  );
}
