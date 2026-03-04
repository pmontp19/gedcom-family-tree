import { useTreeStore } from '@/hooks';
import { FamilyTree, TreeControls } from '@/components/tree';
import { FileUpload, PersonPanel } from '@/components/panels';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FileText, Users } from 'lucide-react';

function App() {
  const { data, filename, format, selectedId, loadFile, selectPerson, clear } = useTreeStore();

  const selectedPerson = selectedId && data ? data.individuals.get(selectedId) : null;

  if (!data) {
    return (
      <div className="h-screen w-screen p-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold text-center mb-2">Family Tree</h1>
          <p className="text-center text-muted-foreground mb-8">
            GEDCOM Parser & Visualizer
          </p>
          <FileUpload onFileLoad={loadFile} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Family Tree
          </h1>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{filename}</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded">{format}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {data.individuals.size} individuals, {data.families.size} families
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={clear}>
          Load Different File
        </Button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tree view */}
        <div className="flex-1 relative">
          <FamilyTree
            data={data}
            selectedId={selectedId ?? undefined}
            onSelect={(ind) => selectPerson(ind.id)}
          />

          {/* Controls overlay */}
          <div className="absolute top-4 right-4">
            <TreeControls />
          </div>
        </div>

        {/* Side panel */}
        {selectedPerson && (
          <div className="w-80 border-l overflow-hidden">
            <PersonPanel
              individual={selectedPerson}
              data={data}
              onClose={() => selectPerson(null)}
              onSelectPerson={selectPerson}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
