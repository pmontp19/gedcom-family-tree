import { useState } from 'react';
import { BookOpen, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTreeStore } from '@/hooks/useTreeStore';
import { parseStory } from '@/services/stories';
import { API_URL } from '@/config';

interface StoryCardProps {
  props: { story_id: string; title: string; subtitle: string | null; steps: number };
}

export function StoryCard({ props }: StoryCardProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  // Saved on watch, not on render: a chat replayed later must not resurrect a deleted story.
  const watch = async () => {
    setState('loading');
    try {
      const res = await fetch(`${API_URL}/api/stories/${encodeURIComponent(props.story_id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const story = parseStory(await res.text());
      const { saveStory, playStory } = useTreeStore.getState();
      await saveStory(story);
      playStory(story);
      setState('idle');
    } catch (err) {
      console.error('Failed to load story:', err);
      setState('error');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-start gap-2">
          <BookOpen className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          {props.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {[props.subtitle, `${props.steps} ${props.steps === 1 ? 'pas' : 'passos'}`].filter(Boolean).join(' · ')}
        </p>
        <Button size="sm" onClick={watch} disabled={state === 'loading'} className="gap-1.5">
          <Play className="h-3.5 w-3.5" /> Desa i mira-la
        </Button>
        {state === 'error' && (
          <p className="text-xs text-destructive">No s'ha pogut carregar la història. Torna-la a demanar.</p>
        )}
      </CardContent>
    </Card>
  );
}
