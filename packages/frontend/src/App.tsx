import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useTreeStore } from '@/hooks';
import { TreeControls } from '@/components/tree/TreeControls';
import type { FamilyTreeRef } from '@/components/tree/FamilyTree';
import { FileUpload, PersonPanel, TreeHealth } from '@/components/panels';
import { FocusSelector } from '@/components/panels/FocusSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StoriesDialog } from '@/components/story/StoriesDialog';
import { ResearchDialog } from '@/components/research/ResearchDialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FileText, Users, Bot, User, Focus } from 'lucide-react';
import type { ThemeId } from '@/visualization/theme';
import { AI_ENABLED } from '@/config';

// Split off the heavy parts: Pixi only loads with the tree view, the AI SDK
// only when the AI panel opens. The upload screen ships without either.
const FamilyTree = lazy(() => import('@/components/tree/FamilyTree').then(m => ({ default: m.FamilyTree })));
const StoryPlayer = lazy(() => import('@/components/story/StoryPlayer').then(m => ({ default: m.StoryPlayer })));
const AgentPanel = lazy(() => import('@/components/panels/AgentPanel').then(m => ({ default: m.AgentPanel })));

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
}


function getInitialTheme(): ThemeId {
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'heritage') return stored;
  } catch (err) {
    console.warn('Theme preference unavailable:', err);
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  const {
    data, viewData, rawData, filename, format, screen, parsing,
    selectedId, focusId, personPanelOpen, loadFile, selectPerson, togglePersonPanel,
    setFocus, viewAll, changeFocus, clear, playingStory, playStory, openPackage,
  } = useTreeStore();
  const [agentOpen, setAgentOpen] = useState(false);
  // The AI reads the GEDCOM uploaded with it: a story package has none.
  const aiAvailable = AI_ENABLED && !!rawData;
  const agentVisible = aiAvailable && agentOpen;
  const [theme, setTheme] = useState<ThemeId>(getInitialTheme);
  const treeRef = useRef<FamilyTreeRef>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('theme-heritage', theme === 'heritage');
    try {
      localStorage.setItem('theme', theme);
    } catch (err) {
      console.warn('Could not persist theme:', err);
    }
  }, [theme]);

  const selectedPerson = selectedId && viewData ? viewData.individuals.get(selectedId) : null;
  // Closing the panel keeps the selection highlighted; the header button reopens it.
  const personPanelVisible = !!selectedPerson && personPanelOpen;

  // Screen: Upload
  if (screen === 'upload' || !data) {
    return (
      <div className="h-screen w-screen p-8">
        <div className="max-w-md mx-auto">
          <div className="flex justify-end mb-2">
            <ThemeToggle theme={theme} onThemeChange={setTheme} />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Arbre genealògic</h1>
          <p className="text-center text-muted-foreground mb-8">
            Visor de fitxers GEDCOM
          </p>
          {parsing ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
              <p className="text-sm text-muted-foreground">Llegint el fitxer GEDCOM…</p>
            </div>
          ) : (
            <FileUpload onFileLoad={loadFile} onPackageLoad={openPackage} />
          )}
        </div>
      </div>
    );
  }

  // Screen: Focus Select
  if (screen === 'focus-select') {
    return (
      <div className="h-screen w-screen p-8">
        <div className="flex justify-between items-center max-w-lg mx-auto mb-4">
          <Button variant="ghost" size="sm" onClick={clear}>
            &larr; Enrere
          </Button>
          <ThemeToggle theme={theme} onThemeChange={setTheme} />
        </div>
        <FocusSelector data={data} onSelect={setFocus} onViewAll={viewAll} />
      </div>
    );
  }

  // Screen: Story. Its own screen, not an overlay: two Pixi apps alive at
  // once break each other, so the tree view unmounts while a story plays.
  if (playingStory) {
    return (
      <Suspense fallback={<Spinner />}>
        <StoryPlayer story={playingStory} data={data} themeId={theme} onClose={() => playStory(null)} />
      </Suspense>
    );
  }

  // Screen: Tree View
  const displayData = viewData ?? data;

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-2 md:px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2 md:gap-4 min-w-0 overflow-hidden">
          <h1 className="text-lg font-semibold flex items-center gap-2 shrink-0">
            <Users className="h-5 w-5" />
            <span className="hidden sm:inline">Arbre genealògic</span>
          </h1>
          <Separator orientation="vertical" className="h-6 hidden md:block" />
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate">{filename}</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded whitespace-nowrap shrink-0">{format}</span>
          </div>
          <span className="hidden 2xl:block text-sm text-muted-foreground whitespace-nowrap">
            {displayData.individuals.size} {displayData.individuals.size === 1 ? 'persona' : 'persones'}, {displayData.families.size} {displayData.families.size === 1 ? 'família' : 'famílies'}
          </span>
        </div>
        <div className="flex gap-1 md:gap-2 shrink-0">
          <ResearchDialog />
          <StoriesDialog />
          <TreeHealth />
          <ThemeToggle theme={theme} onThemeChange={setTheme} />
          <Button variant="outline" size="sm" onClick={changeFocus} aria-label="Canvia el focus" title="Canvia el focus" className="flex items-center gap-1.5">
            <Focus className="h-4 w-4" />
            <span className="hidden min-[1440px]:inline">Canvia el focus</span>
          </Button>
          {selectedPerson && (
            <Button
              variant="outline"
              size="sm"
              onClick={togglePersonPanel}
              aria-label="Mostra la fitxa de la persona"
              className="md:hidden flex items-center gap-1.5"
            >
              <User className="h-4 w-4" />
            </Button>
          )}
          {aiAvailable && (
            <Button
              variant={agentOpen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAgentOpen(o => !o)}
              aria-label="Pregunta a la IA"
              title="Pregunta a la IA"
              className="flex items-center gap-1.5"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden min-[1440px]:inline">Pregunta a la IA</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={clear} className="hidden lg:flex">
            Carrega'n un altre
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Tree view */}
        <div className="flex-1 min-h-[50vh] md:min-h-0 relative">
          <Suspense fallback={<Spinner />}>
            <FamilyTree
              ref={treeRef}
              data={displayData}
              selectedId={selectedId ?? undefined}
              focusId={focusId ?? undefined}
              onSelect={(ind) => selectPerson(ind.id)}
              themeId={theme}
            />
          </Suspense>

          {/* Controls overlay */}
          <TreeControls onFit={() => treeRef.current?.resetView()} />
        </div>

        {/* Backdrop for mobile panels */}
        {(personPanelVisible || agentVisible) && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => {
              if (personPanelOpen) togglePersonPanel();
              setAgentOpen(false);
            }}
          />
        )}

        {/* Side panel - bottom sheet on mobile */}
        {personPanelVisible && (
          <div className="fixed md:relative inset-x-0 bottom-0 md:inset-x-auto
            h-[60vh] md:h-auto w-full md:w-80
            border-t md:border-l border-border bg-background z-50 md:z-auto
            rounded-t-2xl md:rounded-none overflow-hidden">
            <PersonPanel
              individual={selectedPerson}
              data={data}
              onClose={togglePersonPanel}
              onSelectPerson={selectPerson}
            />
          </div>
        )}

        {/* Agent panel - full screen on mobile */}
        {agentVisible && (
          <div className="fixed md:relative inset-0 md:inset-auto
            w-full md:w-96 z-50 md:z-auto bg-background">
            <Suspense fallback={<Spinner />}>
              <AgentPanel onClose={() => setAgentOpen(false)} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
