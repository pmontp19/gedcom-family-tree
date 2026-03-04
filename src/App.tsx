import { useState, useRef } from 'react';
import { useTreeStore } from '@/hooks';
import { FamilyTree, TreeControls, type FamilyTreeRef } from '@/components/tree';
import { FileUpload, PersonPanel } from '@/components/panels';
import { AgentPanel } from '@/components/panels/AgentPanel';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FileText, Users, Bot, User } from 'lucide-react';

function App() {
  const { data, filename, format, selectedId, loadFile, selectPerson, togglePersonPanel, clear } = useTreeStore();
  const [agentOpen, setAgentOpen] = useState(false);
  const treeRef = useRef<FamilyTreeRef>(null);

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
      <header className="flex items-center justify-between px-2 md:px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <h1 className="text-lg font-semibold flex items-center gap-2 shrink-0">
            <Users className="h-5 w-5" />
            <span className="hidden sm:inline">Family Tree</span>
          </h1>
          <Separator orientation="vertical" className="h-6 hidden md:block" />
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="truncate">{filename}</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded">{format}</span>
          </div>
          <span className="hidden lg:block text-sm text-muted-foreground">
            {data.individuals.size} individuals, {data.families.size} families
          </span>
        </div>
        <div className="flex gap-1 md:gap-2 shrink-0">
          {selectedPerson && (
            <Button
              variant="outline"
              size="sm"
              onClick={togglePersonPanel}
              className="md:hidden flex items-center gap-1.5"
            >
              <User className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant={agentOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAgentOpen(o => !o)}
            className="flex items-center gap-1.5"
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Ask AI</span>
          </Button>
          <Button variant="outline" size="sm" onClick={clear} className="hidden sm:flex">
            Load Different
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Tree view */}
        <div className="flex-1 min-h-[50vh] md:min-h-0 relative">
          <FamilyTree
            ref={treeRef}
            data={data}
            selectedId={selectedId ?? undefined}
            onSelect={(ind) => selectPerson(ind.id)}
          />

          {/* Controls overlay */}
          <TreeControls onFit={() => treeRef.current?.resetView()} />
        </div>

        {/* Backdrop for mobile panels */}
        {(selectedPerson || agentOpen) && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => {
              selectPerson(null);
              setAgentOpen(false);
            }}
          />
        )}

        {/* Side panel - bottom sheet on mobile */}
        {selectedPerson && (
          <div className="fixed md:relative inset-x-0 bottom-0 md:inset-x-auto
            h-[60vh] md:h-auto w-full md:w-80
            border-t md:border-l border-border bg-background z-50 md:z-auto
            rounded-t-2xl md:rounded-none overflow-hidden">
            <PersonPanel
              individual={selectedPerson}
              data={data}
              onClose={() => selectPerson(null)}
              onSelectPerson={selectPerson}
            />
          </div>
        )}

        {/* Agent panel - full screen on mobile */}
        {agentOpen && (
          <div className="fixed md:relative inset-0 md:inset-auto
            w-full md:w-96 z-50 md:z-auto bg-background">
            <AgentPanel onClose={() => setAgentOpen(false)} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
