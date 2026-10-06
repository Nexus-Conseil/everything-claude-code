#!/usr/bin/env node
/**
 * PostToolUse (Edit|MultiEdit|Write) hook - JS/TS quality checks
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * For .js/.jsx/.ts/.tsx files:
 *   1. format with the project's own Prettier (node_modules/prettier found
 *      by walking up from the file; a global Prettier is never used)
 *   2. type-check .ts/.tsx files with the project's own TypeScript and the
 *      nearest tsconfig.json (errors for the edited file only, 10 lines max)
 *   3. flag console.log statements
 *
 * Tools are executed with execFileSync (no shell), so the file path is
 * never interpreted by a shell. Findings are returned as `additionalContext`
 * so Claude can act on them.
 * Set ECC_SKIP_PRETTIER=1 or ECC_SKIP_TSC=1 to disable a step.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readStdinJson, output, grepFile } = require('../lib/utils');

const SOURCE_FILE = /\.(ts|tsx|js|jsx)$/i;
const TS_FILE = /\.(ts|tsx)$/i;

/**
 * Walk up from startDir looking for relativePath. Returns { dir, file } or null.
 */
function findUp(startDir, relativePath) {
  let dir = startDir;
  for (;;) {
    const candidate = path.join(dir, relativePath);
    if (fs.existsSync(candidate)) return { dir, file: candidate };
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Resolve a project-local package binary (node_modules/<pkg>/<bin>), never a global one.
 */
function resolveLocalBin(startDir, pkg, binCandidates) {
  for (const bin of binCandidates) {
    const found = findUp(startDir, path.join('node_modules', pkg, bin));
    if (found) return found.file;
  }
  return null;
}

function runNode(script, args, options = {}) {
  return execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  });
}

function runPrettier(filePath) {
  const bin = resolveLocalBin(path.dirname(filePath), 'prettier', ['bin/prettier.cjs', 'bin-prettier.js']);
  if (!bin) return; // Prettier is not a dependency of this project
  try {
    runNode(bin, ['--write', filePath], { timeout: 30000 });
  } catch {
    // Formatting failure is not a reason to disturb the session
  }
}

function typeCheck(filePath) {
  const tsconfig = findUp(path.dirname(filePath), 'tsconfig.json');
  if (!tsconfig) return [];
  const tsc = resolveLocalBin(tsconfig.dir, 'typescript', ['bin/tsc']);
  if (!tsc) return [];

  let out = '';
  try {
    out = runNode(tsc, ['--noEmit', '--pretty', 'false'], { cwd: tsconfig.dir, timeout: 45000 });
  } catch (err) {
    out = `${err.stdout || ''}\n${err.stderr || ''}`;
  }

  // tsc prints "<path relative to cwd>(<line>,<col>): error TS..."
  const relative = path.relative(tsconfig.dir, filePath).split(path.sep).join('/');
  return out
    .split('\n')
    .filter(line => line.includes(`${relative}(`) || line.includes(`${filePath}(`))
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

module.exports = { findUp, resolveLocalBin, consoleLogLines, SOURCE_FILE };
