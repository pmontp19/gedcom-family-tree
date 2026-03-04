import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';

interface TreeControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
}

export function TreeControls({ onFit }: TreeControlsProps) {
  return (
    <div className="fixed bottom-4 right-4 md:absolute md:top-4 md:right-4
      bg-background/80 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none
      rounded-full p-1 touch-manipulation">
      <Button
        variant="outline"
        size="icon"
        onClick={onFit}
        title="Reset View"
        className="h-11 w-11 md:h-10 md:w-10 rounded-full"
      >
        <Maximize2 className="h-5 w-5 md:h-4 md:w-4" />
      </Button>
    </div>
  );
}
