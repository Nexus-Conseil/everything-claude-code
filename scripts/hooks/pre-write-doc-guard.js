#!/usr/bin/env node
/**
 * PreToolUse (Write) hook - documentation file guard
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Warns when Claude creates a stray Markdown file instead of consolidating
 * documentation in README.md or docs/. Standard files (README, CLAUDE,
 * AGENTS, CONTRIBUTING, CHANGELOG, LICENSE, SECURITY, CODE_OF_CONDUCT,
 * SKILL.md) and files under docs/, skills/, agents/, commands/, rules/,
 * contexts/, templates/, test directories, .claude/ or .github/ are allowed.
 *
 * Non-blocking: emits a `systemMessage` only.
 */

const path = require('path');
const { readStdinJson, output } = require('../lib/utils');

const DOC_FILE = /\.md$/i;
const ALLOWED_BASENAMES =
  /^(README|CLAUDE|AGENTS|CONTRIBUTING|CHANGELOG|LICENSE|SECURITY|CODE_OF_CONDUCT|SKILL)(\.[A-Za-z0-9_-]+)?\.md$/i;
const ALLOWED_DIRS =
  /(^|[\\/])(docs?|skills|agents|commands|rules|contexts|templates|tests?|__tests__|fixtures|\.claude|\.github)([\\/]|$)/i;

function isStrayDocFile(filePath) {
  if (!filePath || !DOC_FILE.test(filePath)) return false;
  if (ALLOWED_BASENAMES.test(path.basename(filePath))) return false;
  if (ALLOWED_DIRS.test(path.dirname(filePath))) return false;
  return true;
}

async function main() {
  let input = {};
  try {
    input = await readStdinJson();
  } catch {
    return;
  }

  const filePath = (input.tool_input && input.tool_input.file_path) || '';
  if (!isStrayDocFile(filePath)) return;

  output({
    systemMessage:
      `[Hook] New documentation file: ${filePath}. ` +
      'Keep documentation consolidated (README.md or docs/) unless this file was explicitly requested.'
  });
}

if (require.main === module) {
  main().catch(() => process.exit(0));
}

module.exports = { isStrayDocFile };
