#!/usr/bin/env node
/**
 * PostToolUse (Edit|MultiEdit|Write) hook - JS/TS quality checks
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * For .js/.jsx/.ts/.tsx files:
 *   1. format with Prettier when it is installed in the project (best effort)
 *   2. type-check .ts/.tsx files with the nearest tsconfig.json (errors for
 *      the edited file only, 10 lines max)
 *   3. flag console.log statements
 *
 * Findings are returned as `additionalContext` so Claude can act on them.
 * Set ECC_SKIP_PRETTIER=1 or ECC_SKIP_TSC=1 to disable a step.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { readStdinJson, output, grepFile } = require('../lib/utils');

const SOURCE_FILE = /\.(ts|tsx|js|jsx)$/i;
const TS_FILE = /\.(ts|tsx)$/i;

function findTsconfigDir(startDir) {
  let dir = startDir;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'tsconfig.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function runPrettier(filePath) {
  try {
    execSync(`npx --no-install prettier --write "${filePath}"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000
    });
  } catch {
    // Prettier not installed or failed: nothing to do
  }
}

function typeCheck(filePath) {
  const dir = findTsconfigDir(path.dirname(filePath));
  if (!dir) return [];

  let out = '';
  try {
    out = execSync('npx --no-install tsc --noEmit --pretty false', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 45000
    });
  } catch (err) {
    out = `${err.stdout || ''}\n${err.stderr || ''}`;
  }

  const relative = path.relative(dir, filePath).split(path.sep).join('/');
  return out
    .split('\n')
    .filter(line => line.includes(relative) || line.includes(filePath))
    .slice(0, 10);
}

function consoleLogLines(filePath) {
  return grepFile(filePath, /\bconsole\.log\s*\(/)
    .slice(0, 5)
    .map(hit => `${hit.lineNumber}: ${hit.content.trim()}`);
}

async function main() {
  let input = {};
  try {
    input = await readStdinJson();
  } catch {
    return;
  }

  const filePath = (input.tool_input && input.tool_input.file_path) || '';
  if (!SOURCE_FILE.test(filePath) || !fs.existsSync(filePath)) return;

  const notes = [];

  if (!process.env.ECC_SKIP_PRETTIER) {
    runPrettier(filePath);
  }

  if (TS_FILE.test(filePath) && !process.env.ECC_SKIP_TSC) {
    const errors = typeCheck(filePath);
    if (errors.length > 0) {
      notes.push(`[Hook] TypeScript errors in ${filePath}:\n${errors.join('\n')}`);
    }
  }

  const logs = consoleLogLines(filePath);
  if (logs.length > 0) {
    notes.push(
      `[Hook] console.log found in ${filePath}:\n${logs.join('\n')}\n[Hook] Remove console.log before committing`
    );
  }

  if (notes.length > 0) {
    output({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: notes.join('\n')
      }
    });
  }
}

if (require.main === module) {
  main().catch(() => process.exit(0));
}

module.exports = { findTsconfigDir, consoleLogLines, SOURCE_FILE };
