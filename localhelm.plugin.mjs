/**
 * IngotVault plugin for LocalHelm.
 * Check reads mirror tips. Backup runs this repo's CLI for repos that are behind.
 * Never --force-with-lease. Never touches origin.
 */
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', ...args], {
      cwd: root,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (status) => {
      resolve({ status: status ?? 1, stdout, stderr });
    });
  });
}

async function status() {
  const result = await run(['scripts/helm-bridge.ts']);
  const line = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? '';
  let body;
  try {
    body = JSON.parse(line);
  } catch {
    throw new Error(result.stderr.trim() || result.stdout.trim() || 'IngotVault check returned no JSON.');
  }
  if (body.error) throw new Error(body.error);
  return body;
}

function planRows(body) {
  const attention = body.outcomes.filter((row) => row.status !== 'ok' && row.status !== 'no-commits');
  if (!attention.length) {
    return [{ id: 'workspace', action: 'skip', writes: false, reason: 'Mirrors match the covered local refs.' }];
  }
  return attention.map((row) => ({
    id: row.id,
    action: row.writes ? 'backup' : 'skip',
    writes: row.writes,
    reason: row.writes
      ? `${row.status}: ${row.detail}. ingotvault --repo ${row.id}`
      : `${row.status}: ${row.detail}. Not backed up from here.`,
  }));
}

const plugin = {
  id: 'ingotvault',
  label: 'IngotVault',
  async board() {
    return {
      plugin: 'ingotvault',
      title: 'IngotVault',
      rowLabel: 'vault',
      note: 'Check compares covered local branches and tags to the spare mirror. Backup runs ingotvault for repos that are behind or have no mirror yet. Diverged repos are listed and skipped. Never --force-with-lease. Never origin.',
      columns: [{ id: 'job', label: 'job' }],
      rows: [
        {
          id: 'workspace',
          label: 'Workspace',
          cells: { job: 'check, then backup if a mirror is behind' },
          actions: [
            { id: 'check', label: 'Check', write: false, icon: 'lucide:search-check' },
            { id: 'backup', label: 'Backup', write: true, icon: 'lucide:archive' },
          ],
        },
      ],
    };
  },
  async plan(action) {
    if (action !== 'check' && action !== 'backup') throw new Error(`Unknown IngotVault action: ${action}`);
    const body = await status();
    const rows = planRows(body);
    if (action === 'check') {
      return { rows: rows.map((row) => ({ ...row, writes: false, action: row.action === 'backup' ? 'check' : 'skip' })) };
    }
    return { rows };
  },
  async apply(action, ids = []) {
    if (action === 'check') {
      const body = await status();
      return { ok: true, detail: body.clean ? 'Mirrors match.' : 'Some repos need a backup.' };
    }
    if (action !== 'backup') throw new Error(`Unknown IngotVault action: ${action}`);
    const results = [];
    for (const id of ids) {
      if (!id || id === 'workspace') continue;
      const result = await run(['src/cli.ts', '--repo', id]);
      const detail = result.stdout.trim() || result.stderr.trim();
      results.push({ id, ok: result.status === 0, detail });
    }
    if (!results.length) throw new Error('Nothing to back up.');
    const failed = results.filter((row) => !row.ok);
    return { ok: failed.length === 0, results, log: failed.map((row) => row.detail).filter(Boolean) };
  },
};

export default plugin;
