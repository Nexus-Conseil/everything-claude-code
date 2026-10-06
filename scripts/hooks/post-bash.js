#!/usr/bin/env node
/**
 * PostToolUse (Bash) hook - log the PR URL after `gh pr create`
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Reads the tool result (`tool_response`) and, when a GitHub pull request
 * URL is found, emits a `systemMessage` with the URL and the review command.
 */

const { readStdinJson, output } = require('../lib/utils');

const PR_URL = /https:\/\/github\.com\/[^/\s"\\]+\/[^/\s"\\]+\/pull\/\d+/;

function extractPrUrl(toolResponse) {
  const text =
    typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse || '');
  const match = text.match(PR_URL);
  return match ? match[0] : null;
}

function reviewCommand(url) {
  const m = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  return m ? `gh pr review ${m[2]} --repo ${m[1]}` : null;
}

async function main() {
  let input = {};
  try {
    input = await readStdinJson();
  } catch {
    return;
  }

  const command = (input.tool_input && input.tool_input.command) || '';
  if (!/\bgh pr create\b/.test(command)) return;

  const response = input.tool_response !== undefined ? input.tool_response : input.tool_output;
  const url = extractPrUrl(response);
  if (!url) return;

  output({
    systemMessage: `[Hook] PR created: ${url}\n[Hook] To review: ${reviewCommand(url)}`
  });
}

if (require.main === module) {
  main().catch(() => process.exit(0));
}

module.exports = { extractPrUrl, reviewCommand };
