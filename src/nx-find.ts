#!/usr/bin/env tsx
import { runTestCommand } from './commands/test.js';

const GREY = '\x1b[90m';
const RESET = '\x1b[0m';

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'test':
      await runTestCommand(args);
      break;
    default:
      console.log('Usage: nx-find <command> [options]');
      console.log('\nCommands:');
      console.log('  test [pattern]   Find and run Jest tests in watch mode');
      process.exit(command ? 1 : 0);
  }
}

main().catch((error) => {
  if (error instanceof Error && error.name === 'ExitPromptError') {
    console.log(`\n${GREY}Exited nx-find${RESET}\n`);
    process.exit(0);
  }
  throw error;
});
