/// <reference lib="webworker" />

import { parseGedcomWithFormat } from '@gedcom/parser';

interface ParseRequest {
  type: 'parse';
  id: number;
  content: string;
}

interface ParseResponse {
  type: 'parse-result';
  id: number;
  data: ReturnType<typeof parseGedcomWithFormat>['data'];
  format: string;
}

interface ParseError {
  type: 'parse-error';
  id: number;
  message: string;
}

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  try {
    const { data, format } = parseGedcomWithFormat(e.data.content);
    const response: ParseResponse = { type: 'parse-result', id: e.data.id, data, format };
    self.postMessage(response);
  } catch (err) {
    const response: ParseError = {
      type: 'parse-error',
      id: e.data.id,
      message: err instanceof Error ? err.message : 'Parse failed',
    };
    self.postMessage(response);
  }
};
