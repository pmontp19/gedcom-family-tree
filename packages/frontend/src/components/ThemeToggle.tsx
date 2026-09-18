import { Sun, Moon, TreeDeciduous, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { ThemeId } from '@/visualization/theme';

const THEME_OPTIONS: Array<{ id: ThemeId; label: string; icon: React.ReactNode }> = [
  { id: 'light', label: 'Clar', icon: <Sun /> },
  { id: 'dark', label: 'Fosc', icon: <Moon /> },
  { id: 'heritage', label: 'Piugpelat Heritage', icon: <TreeDeciduous /> },
];

interface ThemeToggleProps {
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
}

export function ThemeToggle({ theme, onThemeChange }: ThemeToggleProps) {
  const current = THEME_OPTIONS.find(t => t.id === theme) ?? THEME_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" title="Tema">
          <span className="contents [&_svg]:h-4 [&_svg]:w-4">{current.icon}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map(option => (
          <DropdownMenuItem key={option.id} onSelect={() => onThemeChange(option.id)}>
            <span className="contents [&_svg]:h-4 [&_svg]:w-4">{option.icon}</span>
            {option.label}
            {option.id === theme && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
