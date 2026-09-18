import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { tool } from 'ai';
import { z } from 'zod';

const exec = promisify(execFile);

// gedlint is a native binary built outside this repo; override the location
// with GEDLINT_BIN when it is installed elsewhere.
const GEDLINT_BIN = process.env.GEDLINT_BIN ?? '/Users/pere/Developer/gedlint/target/release/gedlint';

// gedlint exits 2 as soon as it reports a diagnostic, so a non-zero exit with
// usable stdout is the normal case, not a failure.
async function gedlint(args: string[]): Promise<string> {
  try {
    const { stdout } = await exec(GEDLINT_BIN, args, { maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout;
    if (stdout) return stdout;
    throw err;
  }
}

export interface GedlintReport {
  version: string;
  lines: number;
  individuals: number;
  families: number;
  summary: { errors: number; warnings: number; infos: number };
  diagnostics: Array<{ code: string; severity: string; line: number; message: string }>;
  groups: Array<{ code: string; severity: string; count: number; example: string }>;
}

/** `raw` is the untouched file: encoding rules only fire on the original bytes. */
export async function auditGedcom(raw: Buffer | string): Promise<GedlintReport> {
  const dir = await mkdtemp(join(tmpdir(), 'gedlint-'));
  const file = join(dir, 'tree.ged');
  try {
    await writeFile(file, raw);
    return JSON.parse(await gedlint(['--format', 'json', file])) as GedlintReport;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function explainRule(code: string): Promise<string> {
  // The code reaches us from the model: keep it away from gedlint's flag parser.
  if (!/^[A-Z]\d{3}$/.test(code)) throw new Error(`invalid rule code: ${code}`);
  return (await gedlint(['--explain', code])).trim();
}

export function auditTools(raw: Buffer | null) {
  return {
    audit_tree: tool({
      description:
        'Run the gedlint validator over the loaded GEDCOM file. Returns the version detected, ' +
        'counts of errors/warnings/recommendations, every diagnostic with its rule code and line, ' +
        'and the same diagnostics grouped per rule. Use for any question about file quality, ' +
        'validity, data errors or consistency.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!raw) return { error: 'No GEDCOM file has been uploaded yet.' };
        try {
          return await auditGedcom(raw);
        } catch (err) {
          return { error: `gedlint failed: ${(err as Error).message}` };
        }
      },
    }),

    explain_lint_rule: tool({
      description:
        'Explain one gedlint rule code (for example E201 or W301): why it matters and how to fix it. ' +
        'Call it for every rule code you report from audit_tree.',
      inputSchema: z.object({
        code: z.string().describe('Rule code such as E001, W301 or U502'),
      }),
      execute: async ({ code }) => {
        try {
          return { code, explanation: await explainRule(code.toUpperCase()) };
        } catch (err) {
          return { code, error: `gedlint failed: ${(err as Error).message}` };
        }
      },
    }),
  };
}
