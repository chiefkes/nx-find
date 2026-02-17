#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, '../src/nx-find.ts');
const tsx = resolve(__dirname, '../node_modules/.bin/tsx');

execFileSync(tsx, [entry, ...process.argv.slice(2)], { stdio: 'inherit' });
