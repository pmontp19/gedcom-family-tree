import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface TreeControlsProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
}

export function TreeControls({ onZoomIn, onZoomOut, onFit }: TreeControlsProps) {
  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" size="icon" onClick={onZoomIn} title="Zoom In">
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onZoomOut} title="Zoom Out">
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={onFit} title="Fit to View">
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
