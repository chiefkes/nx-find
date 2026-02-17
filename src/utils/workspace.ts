import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const EXCLUDED_PATHS = ['cypress', 'acceptance-tests'];

export function findRepoRoot(): string {
  let current = process.cwd();
  const root = '/';
  while (current !== root) {
    if (existsSync(join(current, 'nx.json'))) {
      return current;
    }
    current = dirname(current);
  }
  console.error('Not an Nx workspace — no nx.json found above the current directory.');
  process.exit(1);
}

export function getNxBin(repoRoot: string): string {
  return join(repoRoot, 'node_modules', '.bin', 'nx');
}

export function getAllTestFiles(repoRoot: string): string[] {
  const gitOutput = execSync(
    'git ls-files --cached --others --exclude-standard "**/*.test.ts" "**/*.test.tsx" "**/*.test.js" "**/*.test.jsx"',
    { cwd: repoRoot, encoding: 'utf-8' },
  );
  return gitOutput
    .trim()
    .split('\n')
    .filter((f) => f && !EXCLUDED_PATHS.some((excluded) => f.includes(excluded)));
}
