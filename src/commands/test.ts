import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, resolve, join, relative } from 'node:path';

import { search } from '@inquirer/prompts';

import { findRepoRoot, getNxBin, getAllTestFiles } from '../utils/workspace.js';

type ProjectInfo = {
  name: string;
  sourceRoot: string;
};

type Match = {
  filePath: string;
  project: ProjectInfo;
};

// ANSI escape sequences
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREY = '\x1b[90m';
const CYAN = '\x1b[36m';
const BOLD_WHITE = `${BOLD}\x1b[37m`;
const BOLD_YELLOW = `\x1b[33m${BOLD}`;
const CLEAR_SCREEN = '\x1Bc';

const projectCache = new Map<string, ProjectInfo>();
const projectJsonCache = new Map<string, ProjectInfo>();

function findProject(filePath: string, repoRoot: string): ProjectInfo {
  let current = resolve(repoRoot, dirname(filePath));
  const root = resolve(repoRoot);
  while (current.length >= root.length) {
    const projectJsonPath = join(current, 'project.json');
    const cached = projectJsonCache.get(projectJsonPath);
    if (cached) {
      return cached;
    }
    if (existsSync(projectJsonPath)) {
      const project = JSON.parse(readFileSync(projectJsonPath, 'utf-8'));
      projectJsonCache.set(projectJsonPath, project);
      return project;
    }
    current = dirname(current);
  }
  throw new Error(`No project.json found for ${filePath}`);
}

function findProjectCached(filePath: string, repoRoot: string): ProjectInfo {
  const cached = projectCache.get(filePath);
  if (cached) {
    return cached;
  }
  const project = findProject(filePath, repoRoot);
  projectCache.set(filePath, project);
  return project;
}

function isRelativePath(value: string | undefined, repoRoot: string): value is string {
  return value !== undefined && value.includes('/') && existsSync(resolve(repoRoot, value));
}

function runTest(filePath: string, project: ProjectInfo, repoRoot: string, nxBin: string) {
  const testPattern = relative(project.sourceRoot, filePath).replace(/\.(test\.)?[jt]sx?$/, '');
  const nxArgs = [
    'test',
    project.name,
    '--watch',
    '--skip-nx-cache',
    `--testPathPatterns="${testPattern}"`,
  ];

  const cmd = [nxBin, ...nxArgs].join(' ');
  const displayCmd = cmd.replace(nxBin, 'nx');
  console.log(`\nProject:  ${project.name}`);
  console.log(`Running:  ${displayCmd}\n`);

  try {
    execSync(cmd, { stdio: 'inherit', cwd: repoRoot });
  } catch {
    process.exit(1);
  }
}

function highlightMatch(text: string, term: string): string {
  if (!term) return text;
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const index = lowerText.indexOf(lowerTerm);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + term.length);
  const after = text.slice(index + term.length);

  return `${GREY}${before}${RESET}${BOLD_WHITE}${match}${RESET}${GREY}${after}${RESET}`;
}

const HEADER_PATTERN_MODE = `${BOLD_YELLOW}Pattern Mode Usage${RESET}`;

async function runPatternSearchMode(
  repoRoot: string,
  nxBin: string,
  initialTerm?: string,
  matchCount?: number,
) {
  const hasBanner = Boolean(matchCount && initialTerm);
  const headerLine = hasBanner
    ? `${BOLD_YELLOW}Found ${matchCount} matches for "${initialTerm}" — please pick one${RESET}`
    : HEADER_PATTERN_MODE;

  console.log(headerLine);
  console.log(`  › Press ${BOLD}Enter${RESET} to run the selected test.`);
  console.log(`  › Press ${BOLD}Ctrl+C${RESET} to quit.\n`);

  const allTestFiles = getAllTestFiles(repoRoot);
  let bannerVisible = hasBanner;
  let initialTermSeen = !hasBanner;

  // Simulate typing the initial term into the search input
  if (initialTerm) {
    setTimeout(() => {
      for (const char of initialTerm) {
        process.stdin.emit('data', char);
      }
    }, 0);
  }

  const selected = await search<string>({
    message: 'pattern',
    theme: {
      style: {
        // Replace grey with cyan on the active row so it stands out
        highlight: (text: string) => text.replaceAll('\x1b[90m', CYAN),
      },
    },
    source: async (term) => {
      // Wait until the pre-filled term has landed before watching for edits
      if (!initialTermSeen) {
        if (term === initialTerm) {
          initialTermSeen = true;
        }
      } else if (bannerVisible && term !== initialTerm) {
        bannerVisible = false;
        // Save cursor, overwrite the banner line with the default header, restore cursor
        process.stdout.write(`\x1b[s\x1b[1;1H\x1b[2K${HEADER_PATTERN_MODE}\x1b[u`);
      }
      if (!term) {
        return allTestFiles.slice(0, 20).map((filePath) => ({
          name: `${GREY}${filePath}${RESET}`,
          value: filePath,
          description: 'Start typing to filter by a filename regex pattern.',
        }));
      }

      const lowerTerm = term.toLowerCase();
      const filtered = allTestFiles.filter((f) => f.toLowerCase().includes(lowerTerm));

      if (filtered.length === 0) {
        return [];
      }

      return filtered.slice(0, 50).map((filePath) => ({
        name: highlightMatch(filePath, term),
        value: filePath,
        description: findProjectCached(filePath, repoRoot).name,
      }));
    },
  });

  const project = findProjectCached(selected, repoRoot);
  runTest(selected, project, repoRoot, nxBin);
}

export async function runTestCommand(args: string[]) {
  const repoRoot = findRepoRoot();
  const nxBin = getNxBin(repoRoot);
  const input = args[0];

  // Clear screen and move cursor to top-left
  process.stdout.write(CLEAR_SCREEN);

  // No input provided — enter interactive pattern search mode
  if (!input) {
    await runPatternSearchMode(repoRoot, nxBin);
    return;
  }

  // Strip path, .test, and file extension to get the base component name
  const baseName = basename(input).replace(/\.(test\.)?[jt]sx?$/, '');

  // If a valid relative path was given, resolve the project directly and run
  if (isRelativePath(input, repoRoot)) {
    const project = findProject(input, repoRoot);
    runTest(input, project, repoRoot, nxBin);
    return;
  }

  const safeBaseName = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hasTestExt = /\.test\.[jt]sx?$/i.test(input);
  const filterRegex = hasTestExt
    ? new RegExp(`${safeBaseName}\\.test\\.[jt]sx?$`, 'i')
    : new RegExp(`${safeBaseName}[^/]*\\.test\\.[jt]sx?$`, 'i');

  const found = getAllTestFiles(repoRoot).filter((f) => filterRegex.test(f));

  if (found.length === 0) {
    console.error(`No test files found matching: ${baseName}`);
    process.exit(1);
  }

  const matches: Match[] = found.map((filePath) => ({
    filePath,
    project: findProject(filePath, repoRoot),
  }));

  // Single match — run directly
  if (matches.length === 1) {
    runTest(matches[0].filePath, matches[0].project, repoRoot, nxBin);
    return;
  }

  // Multiple matches — open pattern search mode pre-filled with the arg
  await runPatternSearchMode(repoRoot, nxBin, input, matches.length);
}

