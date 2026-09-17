export interface Token {
  level: number;
  tag: string;
  pointer?: string;
  data?: string;
}

const LINE_REGEX = /^(\d+)\s+(?:@([^@\s]+)@\s+)?(\w+)(?:\s+(.*))?$/;

export function tokenize(line: string): Token | null {
  const match = line.match(LINE_REGEX);
  if (!match) return null;

  const level = parseInt(match[1], 10);
  const pointer = match[2];
  const tag = match[3];
  const data = match[4];

  return { level, tag, pointer, data };
}

export function tokenizeLines(content: string): Token[] {
  // Strip UTF-8 BOM if present
  if (content.startsWith('\uFEFF')) {
    content = content.slice(1);
  }
  const lines = content.split(/\r?\n/);
  const tokens: Token[] = [];

  for (const line of lines) {
    if (line.length === 0 || !/^\d/.test(line)) continue;
    const token = tokenize(line);
    if (token) tokens.push(token);
  }

  return tokens;
}