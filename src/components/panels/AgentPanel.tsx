import { useState, useRef, useEffect } from 'react';
import { useChatUI, Renderer, StateProvider, VisibilityProvider } from '@json-render/react';
import { registry } from '@/components/registry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, X, Bot } from 'lucide-react';

interface AgentPanelProps {
  onClose: () => void;
}

export function AgentPanel({ onClose }: AgentPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, isStreaming, send, clear } = useChatUI({
    api: 'http://localhost:3001/api/chat',
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    send(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-96 border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Ask AI</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={clear} className="text-xs h-7">
            Clear
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8 space-y-1">
              <Bot className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>Ask about your ancestors</p>
              <p className="text-xs opacity-60">Try: "Tell me about John Smith"</p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  msg.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2 text-sm'
                    : 'max-w-full w-full space-y-2'
                }
              >
                {msg.text && (
                  <p className={msg.role === 'user' ? '' : 'text-sm text-foreground leading-relaxed'}>
                    {msg.text}
                  </p>
                )}
                {msg.spec && (
                  <StateProvider initialState={msg.spec.state ?? {}}>
                    <VisibilityProvider>
                      <Renderer spec={msg.spec} registry={registry} />
                    </VisibilityProvider>
                  </StateProvider>
                )}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex justify-start">
              <div className="text-xs text-muted-foreground animate-pulse">Thinking…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your family tree…"
          disabled={isStreaming}
          className="text-sm"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
