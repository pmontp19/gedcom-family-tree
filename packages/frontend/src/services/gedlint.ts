// Typed client for the gedlint wasm engine.
//
// The engine and its worker live in public/gedlint/ verbatim from the gedlint
// repo (scripts/build-web.sh output), so they are served as-is and never go
// through the bundler: worker.js is a classic worker that importScripts() the
// base64 wasm next to it.

export interface GedlintDiagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
}

export interface GedlintGroup {
  code: string;
  severity: string;
  rule_name: string;
  count: number;
  title: string;
  why: string;
  remedy: string;
}

export interface GedlintResult {
  summary: { errors: number; warnings: number; infos: number };
  diagnostics: GedlintDiagnostic[];
  groups: GedlintGroup[];
}

interface RawDiagnostic {
  code: string;
  severity: string;
  message: string;
  line?: number;
}

interface RawGroup {
  code: string;
  severity: string;
  count: number;
  example: string;
}

interface RawResult {
  summary: { errors: number; warnings: number; infos: number };
  diagnostics: RawDiagnostic[];
  groups: RawGroup[];
}

/** One entry of `gedlint_registry()`: the rule catalogue shipped inside the wasm. */
export interface GedlintRule {
  code: string;
  name: string;
  title: string;
  why: string;
  remedy: string;
}

const SEVERITY: Record<string, GedlintDiagnostic['severity']> = {
  ERROR: 'error',
  WARN: 'warning',
  INFO: 'info',
};

/** Shape the engine output and fold the rule catalogue into the groups. */
export function toResult(raw: RawResult, rules: GedlintRule[]): GedlintResult {
  const byCode = new Map(rules.map((r) => [r.code, r]));
  return {
    summary: raw.summary,
    diagnostics: raw.diagnostics.map((d) => ({
      code: d.code,
      severity: SEVERITY[d.severity] ?? 'info',
      message: d.message,
      line: d.line,
    })),
    groups: raw.groups.map((g) => {
      const rule = byCode.get(g.code);
      return {
        code: g.code,
        severity: SEVERITY[g.severity] ?? 'info',
        rule_name: rule?.name ?? g.code,
        count: g.count,
        title: rule?.title ?? g.example,
        why: rule?.why ?? '',
        remedy: rule?.remedy ?? '',
      };
    }),
  };
}

let booting: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  booting ??= new Promise<Worker>((resolve, reject) => {
    const worker = new Worker(`${import.meta.env.BASE_URL}gedlint/worker.js`);
    const onBoot = (e: MessageEvent) => {
      if (e.data?.type === 'ready') {
        worker.removeEventListener('message', onBoot);
        resolve(worker);
      } else if (e.data?.type === 'boot-error') {
        worker.removeEventListener('message', onBoot);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', onBoot);
    worker.addEventListener('error', (e) => reject(new Error(e.message)));
  });
  return booting;
}

let nextId = 0;

/** Send one request and resolve with the JSON string the engine returned. */
async function request(msg: { type: string; data?: ArrayBuffer; config?: string }): Promise<string> {
  const worker = await getWorker();
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      worker.removeEventListener('message', handler);
      if (e.data.ok) resolve(e.data.json as string);
      else reject(new Error(e.data.error));
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ ...msg, id });
  });
}

let registry: Promise<GedlintRule[]> | null = null;

function getRegistry(): Promise<GedlintRule[]> {
  registry ??= request({ type: 'registry' }).then((json) => JSON.parse(json) as GedlintRule[]);
  return registry;
}

export async function runGedlint(fileContent: string | ArrayBuffer): Promise<GedlintResult> {
  const data =
    typeof fileContent === 'string'
      ? (new TextEncoder().encode(fileContent).buffer as ArrayBuffer)
      : fileContent;
  const [json, rules] = await Promise.all([
    request({ type: 'check', data, config: '' }),
    getRegistry(),
  ]);
  return toResult(JSON.parse(json) as RawResult, rules);
}
