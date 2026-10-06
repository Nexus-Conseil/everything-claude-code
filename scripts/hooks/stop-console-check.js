#!/usr/bin/env node
/**
 * Stop hook - console.log audit of modified JS/TS files
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * After each response, scans the JS/TS files modified since HEAD and the
 * untracked ones (git) for console.log statements and reports them as
 * Stop hook feedback. Paths are resolved against the repository root, so
 * the hook works from any subdirectory. Never forces Claude to continue.
 */

const fs = require('fs');
const path = require('path');
const { readStdinJson, output, runCommand, readFile } = require('../lib/utils');

const SOURCE_FILE = /\.(ts|tsx|js|jsx)$/i;
const CONSOLE_LOG = /\bconsole\.log\s*\(/;

function changedSourceFiles() {
  const top = runCommand('git rev-parse --show-toplevel');
  if (!top.success || !top.output) return [];

  // Run from the repository root so both commands return root-relative paths
  // for the whole repository, whatever the current directory.
  const listed = [];
  for (const cmd of ['git diff --name-only HEAD', 'git ls-files --others --exclude-standard']) {
    const result = runCommand(cmd, { cwd: top.output });
    if (result.success) listed.push(...result.output.split('\n'));
  }

  return [...new Set(listed)]
    .filter(file => file && SOURCE_FILE.test(file))
    .map(file => path.join(top.output, file));
}

function findOffenders(files) {
  return files.filter(file => fs.existsSync(file) && CONSOLE_LOG.test(readFile(file) || ''));
}

async function main() {
  let input = {};
  try {
    input = await readStdinJson();
  } catch {
    input = {};
  }

  // Never re-run while a Stop hook is already driving the loop
  if (input.stop_hook_active) return;

  const offenders = findOffenders(changedSourceFiles());
  if (offenders.length === 0) return;

  output({
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext:
        `[Hook] console.log found in modified files: ${offenders.join(', ')}. ` +
        'Remove console.log statements before committing.'
    }
  });
}

if (require.main === module) {
  main().catch(() => process.exit(0));
}

module.exports = { findOffenders, changedSourceFiles };
