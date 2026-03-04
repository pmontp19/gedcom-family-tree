export interface Token {
  level: number;
  tag: string;
  pointer?: string;
  data?: string;
}

const POINTER_REGEX = /^@(\w+)@$/;

export function tokenize(line: string): Token {
  const trimmed = line.trim();
  const parts = trimmed.split(/\s+/);
  const level = parseInt(parts[0], 10);

  let index = 1;
  let pointer: string | undefined;
  let tag: string;
  let data: string | undefined;

  // Check if second part is a pointer
  if (parts[index]?.startsWith('@')) {
    const pointerMatch = parts[index].match(POINTER_REGEX);
    if (pointerMatch) {
      pointer = pointerMatch[1];
      index++;
    }
  }

  tag = parts[index] || '';
  index++;

  // Rest is data
  if (index < parts.length) {
    data = parts.slice(index).join(' ');
  }

  return { level, tag, pointer, data };
}

export function tokenizeLines(content: string): Token[] {
  const lines = content.split(/\r?\n/);
  const tokens: Token[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and lines not starting with a level number
    if (trimmed.length === 0 || !/^\d/.test(trimmed)) continue;
    tokens.push(tokenize(trimmed));
  }

  return tokens;
}
