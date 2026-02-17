# nx-find

A CLI tool for quickly finding and running Jest tests in Nx monorepos. Instead of manually figuring out which Nx project owns a test file, `nx-find` resolves it for you and launches `nx test` in watch mode.

## Install

Requires [Node.js](https://nodejs.org/).

```bash
pnpm install
pnpm link --global
```

## Usage

Run from anywhere inside an Nx workspace.

### Interactive mode

```bash
nx-find test
```

Opens an interactive fuzzy search over every test file in the repo. Start typing to filter, press **Enter** to run the selected test in watch mode.

### Search by name

```bash
nx-find test Button
```

Finds all test files matching `Button` (e.g. `Button.test.tsx`, `ButtonGroup.test.ts`). If there's exactly one match it runs immediately. If there are multiple matches, the interactive search opens pre-filled with your query.

### Run by path

```bash
nx-find test libs/ui/src/Button/Button.test.tsx
```

When given a relative path to a test file, it resolves the owning Nx project and runs the test directly — no search needed.

## How it works

1. Walks up from the current directory to find the Nx workspace root (`nx.json`).
2. Uses `git ls-files` to collect all `*.test.{ts,tsx,js,jsx}` files (excluding `cypress` and `acceptance-tests` directories).
3. Resolves each test file to its Nx project by finding the nearest `project.json`.
4. Runs `nx test <project> --watch --skip-nx-cache --testPathPatterns="<pattern>"`.
