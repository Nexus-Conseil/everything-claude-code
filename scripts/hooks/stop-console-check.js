#!/usr/bin/env node
/**
 * Stop hook - console.log audit of modified JS/TS files
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * After each response, scans the files modified since HEAD (git) for
 * console.log statements and reports them as Stop hook feedback.
 * Never forces Claude to continue (no `decision: block`).
 */

const fs = require('fs');
const { readStdinJson, output, getGitModifiedFiles, readFile } = require('../lib/utils');

function findOffenders(files) {
  const CONSOLE_LOG = /\bconsole\.log\s*\(/;
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

  const files = getGitModifiedFiles(['\\.(ts|tsx|js|jsx)$']);
  const offenders = findOffenders(files);
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

module.exports = { findOffenders };
