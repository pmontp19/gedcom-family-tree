/// <reference lib="webworker" />

import { parseGedcom, detectFormat } from '@gedcom/parser';

interface ParseRequest {
  type: 'parse';
  content: string;
}

interface ParseResponse {
  type: 'parse-result';
  data: ReturnType<typeof parseGedcom>;
  format: string;
}

interface ParseError {
  type: 'parse-error';
  message: string;
}

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  try {
    const data = parseGedcom(e.data.content);
    const format = detectFormat(e.data.content);
    const response: ParseResponse = { type: 'parse-result', data, format };
    self.postMessage(response);
  } catch (err) {
    const response: ParseError = {
      type: 'parse-error',
      message: err instanceof Error ? err.message : 'Parse failed',
    };
    self.postMessage(response);
  }
};
