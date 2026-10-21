import { Button } from '@/components/ui/button';
import { FlipVertical2, Maximize2 } from 'lucide-react';

interface TreeControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
  /** Painted tree only: the youngest at the top, like the 1974 tree. */
  inverted?: boolean;
  onInvert?: () => void;
}

export function TreeControls({ onFit, inverted, onInvert }: TreeControlsProps) {
  return (
    <div className="fixed bottom-4 right-4 md:absolute md:top-4 md:right-4
      bg-background/80 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none
      rounded-full p-1 touch-manipulation flex md:flex-col gap-1">
      <Button
        variant="outline"
        size="icon"
        onClick={onFit}
        title="Ajusta la vista"
        aria-label="Ajusta la vista"
        className="h-11 w-11 md:h-10 md:w-10 rounded-full"
      >
        <Maximize2 className="h-5 w-5 md:h-4 md:w-4" />
      </Button>
      {onInvert && (
        <Button
          variant="outline"
          size="icon"
          onClick={onInvert}
          title={inverted ? 'Els avantpassats a dalt' : 'Els més joves a dalt'}
          aria-label="Gira l'arbre"
          aria-pressed={inverted}
          className="h-11 w-11 md:h-10 md:w-10 rounded-full"
        >
          <FlipVertical2 className="h-5 w-5 md:h-4 md:w-4" />
        </Button>
      )}
    </div>
  );
}
