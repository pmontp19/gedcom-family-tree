export interface Token {
  level: number;
  tag: string;
  pointer?: string;
  data?: string;
}

// The value delimiter is a single space: CONC splits often land on a space
// that belongs to the value, so swallowing more would join words.
const LINE_REGEX = /^(\d+)\s+(?:@([^@\s]+)@\s+)?(\w+)(?: (.*))?$/;

export function tokenize(line: string): Token | null {
  const match = line.match(LINE_REGEX);
  if (!match) return null;

  const level = parseInt(match[1], 10);
  const pointer = match[2];
  const tag = match[3];
  const data = tag === 'CONC' || tag === 'CONT' ? match[4] : match[4]?.trimStart();

  return { level, tag, pointer, data };
}

export function tokenizeLines(content: string): Token[] {
  // Strip UTF-8 BOM if present
  if (content.startsWith('\uFEFF')) {
    content = content.slice(1);
  }
  // 5.5.1 allows CR, LF, CRLF or LFCR terminators and leading whitespace.
  const lines = content.split(/\r\n|\r|\n/);
  const tokens: Token[] = [];

  for (const raw of lines) {
    const line = raw.trimStart();
    if (!/^\d/.test(line)) continue;
    const token = tokenize(line);
    if (token) tokens.push(token);
  }

  return tokens;
}